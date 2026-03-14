import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Apartment,
  Comment,
  Complaint,
  ComplaintCardData,
  Profile,
  Service,
  Society,
  StaffCategory,
} from "@/lib/types";

async function maybeSelectMany<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

async function maybeSelectSingle<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as T | null;
}

function normalizeUuid(value: string | null | undefined) {
  if (!value || value === "null" || value === "undefined") {
    return null;
  }

  return value;
}

export async function fetchSocieties(supabase: SupabaseClient) {
  return maybeSelectMany<Society>(
    supabase
      .from("societies")
      .select("id, name, slug, city, contact_email, created_at")
      .order("name", { ascending: true }),
  );
}

export async function fetchSocietyBySlug(
  supabase: SupabaseClient,
  slug: string,
) {
  if (!slug) {
    return null;
  }

  return maybeSelectSingle<Society>(
    supabase
      .from("societies")
      .select("id, name, slug, city, contact_email, created_at")
      .eq("slug", slug)
      .maybeSingle(),
  );
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const profile = await maybeSelectSingle<Profile>(
    supabase
      .from("users")
      .select(
        "id, society_id, email, full_name, role, apartment_id, apartment_number, phone, created_at",
      )
      .eq("id", userId)
      .maybeSingle(),
  );

  if (!profile) {
    return null;
  }

  const [society, apartment] = await Promise.all([
    maybeSelectSingle<Society>(
      supabase
        .from("societies")
        .select("id, name, slug, city, contact_email, created_at")
        .eq("id", profile.society_id)
        .maybeSingle(),
    ),
    profile.apartment_id
      ? maybeSelectSingle<Apartment>(
          supabase
            .from("apartments")
            .select(
              "id, society_id, apartment_number, block_name, floor_label, created_at",
            )
            .eq("id", profile.apartment_id)
            .maybeSingle(),
        )
      : Promise.resolve(null),
  ]);

  return {
    ...profile,
    apartment_number:
      profile.apartment_number ?? apartment?.apartment_number ?? null,
    apartment,
    society,
  };
}

export async function fetchApartmentsForSociety(
  supabase: SupabaseClient,
  societyId: string,
) {
  return maybeSelectMany<Apartment>(
    supabase
      .from("apartments")
      .select("id, society_id, apartment_number, block_name, floor_label, created_at")
      .eq("society_id", societyId)
      .order("apartment_number", { ascending: true }),
  );
}

export async function fetchServicesForSociety(
  supabase: SupabaseClient,
  societyId: string,
) {
  const { data, error } = await supabase
    .from("services")
    .select("id, society_id, name, description, is_active, created_at")
    .eq("society_id", societyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading services:", error);
    return [] as Service[];
  }

  return (data ?? []) as Service[];
}

export async function fetchUsersForSociety(
  supabase: SupabaseClient,
  societyId: string,
) {
  return maybeSelectMany<Profile>(
    supabase
      .from("users")
      .select(
        "id, society_id, email, full_name, role, apartment_id, apartment_number, phone, created_at",
      )
      .eq("society_id", societyId)
      .order("created_at", { ascending: false }),
  );
}

export async function fetchStaffForCategory(
  supabase: SupabaseClient,
  societyId: string,
  categoryId: string,
): Promise<Array<Pick<Profile, "id" | "full_name" | "email" | "role" | "society_id">>> {
  const { data, error } = await supabase
    .from("staff_categories")
    .select(
      `
      staff:users!staff_user_id (
        id,
        full_name,
        email,
        role,
        society_id
      )
    `,
    )
    .eq("category_id", categoryId);

  if (error) {
    console.error("Error loading staff:", error);
    return [];
  }

  return (data ?? []).flatMap((row) => {
    const staff = row.staff;

    if (Array.isArray(staff)) {
      return staff.filter(Boolean);
    }

    return staff ? [staff] : [];
  });
}

export async function fetchStaffCategoriesForSociety(
  supabase: SupabaseClient,
  societyId: string,
) {
  const mappings = await maybeSelectMany<StaffCategory>(
    supabase
      .from("staff_categories")
      .select("id, staff_user_id, category_id, created_at")
      .order("created_at", { ascending: true }),
  );

  if (!mappings.length) {
    return [] as Array<
      StaffCategory & { staff: Profile | null; category: Service | null }
    >;
  }

  const staffUserIds = Array.from(
    new Set(mappings.map((item) => item.staff_user_id).filter(Boolean)),
  );
  const categoryIds = Array.from(
    new Set(mappings.map((item) => item.category_id).filter(Boolean)),
  );

  const [staffUsers, categories] = await Promise.all([
    staffUserIds.length
      ? maybeSelectMany<Profile>(
          supabase
            .from("users")
            .select(
              "id, society_id, email, full_name, role, apartment_id, apartment_number, phone, created_at",
            )
            .in("id", staffUserIds)
            .eq("society_id", societyId)
            .eq("role", "maintenance_staff"),
        )
      : Promise.resolve([] as Profile[]),
    categoryIds.length
      ? maybeSelectMany<Service>(
          supabase
            .from("services")
            .select("id, society_id, name, description, is_active, created_at")
            .in("id", categoryIds)
            .eq("society_id", societyId),
        )
      : Promise.resolve([] as Service[]),
  ]);

  const staffMap = new Map(staffUsers.map((item) => [item.id, item]));
  const categoryMap = new Map(categories.map((item) => [item.id, item]));

  return mappings
    .filter(
      (item) => staffMap.has(item.staff_user_id) && categoryMap.has(item.category_id),
    )
    .map((item) => ({
      ...item,
      staff: staffMap.get(item.staff_user_id) ?? null,
      category: categoryMap.get(item.category_id) ?? null,
    }));
}

export async function fetchComplaintsByScope(
  supabase: SupabaseClient,
  scope:
    | { kind: "society"; societyId: string; limit?: number }
    | { kind: "user"; userId: string; societyId: string }
    | { kind: "assigned"; userId: string; societyId: string },
) {
  let query = supabase
    .from("complaints")
    .select(
      "id, society_id, resident_user_id, apartment_id, category_id, assigned_staff_id, title, description, status, created_at, updated_at, resolved_at",
    )
    .order("created_at", { ascending: false });

  if (scope.kind === "society") {
    query = query.eq("society_id", scope.societyId);

    if (scope.limit) {
      query = query.limit(scope.limit);
    }
  }

  if (scope.kind === "user") {
    const userId = normalizeUuid(scope.userId);

    if (!userId) {
      return [] satisfies ComplaintCardData[];
    }

    query = query.eq("resident_user_id", userId).eq("society_id", scope.societyId);
  }

  if (scope.kind === "assigned") {
    const userId = normalizeUuid(scope.userId);

    if (!userId) {
      return [] satisfies ComplaintCardData[];
    }

    query = query
      .eq("assigned_staff_id", userId)
      .eq("society_id", scope.societyId);
  }

  const complaints = await maybeSelectMany<Complaint>(query);

  return decorateComplaints(supabase, complaints);
}

export async function decorateComplaints(
  supabase: SupabaseClient,
  complaints: Complaint[],
) {
  if (!complaints.length) {
    return [] satisfies ComplaintCardData[];
  }

  const apartmentIds = Array.from(new Set(complaints.map((item) => item.apartment_id)));
  const categoryIds = Array.from(new Set(complaints.map((item) => item.category_id)));
  const residentIds = Array.from(new Set(complaints.map((item) => item.resident_user_id)));
  const assignedStaffIds = Array.from(
    new Set(
      complaints
        .map((item) => item.assigned_staff_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );
  const complaintIds = Array.from(new Set(complaints.map((item) => item.id)));

  const [apartments, services, residents, assignedStaff, comments] = await Promise.all([
    maybeSelectMany<Apartment>(
      supabase
        .from("apartments")
        .select("id, society_id, apartment_number, block_name, floor_label, created_at")
        .in("id", apartmentIds),
    ),
    maybeSelectMany<Service>(
      supabase
        .from("services")
        .select("id, society_id, name, description, is_active, created_at")
        .in("id", categoryIds),
    ),
    maybeSelectMany<Profile>(
      supabase
        .from("users")
        .select(
          "id, society_id, email, full_name, role, apartment_id, apartment_number, phone, created_at",
        )
        .in("id", residentIds),
    ),
    assignedStaffIds.length
      ? maybeSelectMany<Profile>(
          supabase
            .from("users")
            .select(
              "id, society_id, email, full_name, role, apartment_id, apartment_number, phone, created_at",
            )
            .in("id", assignedStaffIds),
        )
      : Promise.resolve([] as Profile[]),
    complaintIds.length
      ? maybeSelectMany<Comment>(
          supabase
            .from("comments")
            .select("id, complaint_id, user_id, comment, created_at")
            .in("complaint_id", complaintIds)
            .order("created_at", { ascending: true }),
        )
      : Promise.resolve([] as Comment[]),
  ]);

  const commentUserIds = Array.from(
    new Set(comments.map((item) => item.user_id).filter(Boolean)),
  );

  const commentUsers = commentUserIds.length
    ? await maybeSelectMany<Profile>(
        supabase
          .from("users")
          .select(
            "id, society_id, email, full_name, role, apartment_id, apartment_number, phone, created_at",
          )
          .in("id", commentUserIds),
      )
    : [];

  const apartmentMap = new Map(apartments.map((item) => [item.id, item]));
  const serviceMap = new Map(services.map((item) => [item.id, item]));
  const residentMap = new Map(residents.map((item) => [item.id, item]));
  const staffMap = new Map(assignedStaff.map((item) => [item.id, item]));
  const commentUserMap = new Map(commentUsers.map((item) => [item.id, item]));
  const commentsByComplaint = new Map<string, Comment[]>();

  comments.forEach((comment) => {
    const entry = {
      ...comment,
      author: commentUserMap.get(comment.user_id) ?? null,
    } satisfies Comment;
    const existing = commentsByComplaint.get(comment.complaint_id) ?? [];
    existing.push(entry);
    commentsByComplaint.set(comment.complaint_id, existing);
  });

  return complaints.map((item) => ({
    ...item,
    apartment: apartmentMap.get(item.apartment_id) ?? null,
    service: serviceMap.get(item.category_id) ?? null,
    resident: residentMap.get(item.resident_user_id) ?? null,
    assignedStaff: item.assigned_staff_id
      ? staffMap.get(item.assigned_staff_id) ?? null
      : null,
    comments: commentsByComplaint.get(item.id) ?? [],
  }));
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: { role: Profile["role"]; apartmentId: string | null },
) {
  const apartmentId = normalizeUuid(updates.apartmentId);
  let apartmentNumber: string | null = null;

  if (apartmentId) {
    const apartment = await maybeSelectSingle<Pick<Apartment, "apartment_number">>(
      supabase
        .from("apartments")
        .select("apartment_number")
        .eq("id", apartmentId)
        .maybeSingle(),
    );

    apartmentNumber = apartment?.apartment_number ?? null;
  }

  const { error } = await supabase
    .from("users")
    .update({
      apartment_id: apartmentId,
      apartment_number: apartmentNumber,
      role: updates.role,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createApartment(
  supabase: SupabaseClient,
  payload: {
    societyId: string;
    apartmentNumber: string;
    blockName?: string | null;
    floorLabel?: string | null;
  },
) {
  const { error } = await supabase.from("apartments").insert({
    apartment_number: payload.apartmentNumber,
    block_name: payload.blockName ?? null,
    floor_label: payload.floorLabel ?? null,
    society_id: payload.societyId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createService(
  supabase: SupabaseClient,
  payload: {
    societyId: string;
    name: string;
    description?: string | null;
  },
) {
  const { error } = await supabase.from("services").insert({
    description: payload.description ?? null,
    name: payload.name,
    society_id: payload.societyId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateServiceStatus(
  supabase: SupabaseClient,
  serviceId: string,
  isActive: boolean,
) {
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", serviceId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createStaffCategoryMapping(
  supabase: SupabaseClient,
  payload: {
    staffUserId: string;
    categoryId: string;
  },
) {
  const staffUserId = normalizeUuid(payload.staffUserId);
  const categoryId = normalizeUuid(payload.categoryId);

  if (!staffUserId || !categoryId) {
    throw new Error("Staff category mapping requires a valid staff user and category.");
  }

  const { error } = await supabase.from("staff_categories").insert({
    staff_user_id: staffUserId,
    category_id: categoryId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateComplaintStatus(
  supabase: SupabaseClient,
  complaintId: string,
  status: Complaint["status"],
) {
  const { error } = await supabase
    .from("complaints")
    .update({ status })
    .eq("id", complaintId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createComment(
  supabase: SupabaseClient,
  payload: { complaintId: string; userId: string; comment: string },
) {
  const complaintId = normalizeUuid(payload.complaintId);
  const userId = normalizeUuid(payload.userId);
  const comment = payload.comment.trim();

  if (!complaintId || !userId || !comment) {
    throw new Error("Comments require a complaint, user, and message.");
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      complaint_id: complaintId,
      user_id: userId,
      comment,
    })
    .select("id, complaint_id, user_id, comment, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Comment;
}

export async function createComplaint(
  supabase: SupabaseClient,
  payload: {
    societyId: string;
    residentUserId: string;
    apartmentId: string;
    categoryId: string;
    assignedStaffId: string;
    title: string;
    description: string;
  },
) {
  const residentUserId = normalizeUuid(payload.residentUserId);
  const apartmentId = normalizeUuid(payload.apartmentId);
  const categoryId = normalizeUuid(payload.categoryId);
  const assignedStaffId = normalizeUuid(payload.assignedStaffId);

  if (!residentUserId || !apartmentId || !categoryId || !assignedStaffId) {
    throw new Error(
      "Complaint submission requires valid resident, apartment, category, and staff ids.",
    );
  }

  const { error } = await supabase.from("complaints").insert({
    apartment_id: apartmentId,
    category_id: categoryId,
    service_id: categoryId,
    description: payload.description,
    resident_user_id: residentUserId,
    society_id: payload.societyId,
    assigned_staff_id: assignedStaffId,
    status: "open",
    title: payload.title,
  });

  if (error) {
    throw new Error(error.message);
  }
}
