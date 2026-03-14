import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const societySlug = "demo-society";

const apartments = [
  { apartment_number: "A-101", block_name: "A Wing" },
  { apartment_number: "A-202", block_name: "A Wing" },
  { apartment_number: "B-304", block_name: "B Wing" },
];

const services = [
  { name: "Plumbing", description: "Water leaks, clogs, and pipe repairs." },
  { name: "Electrical", description: "Electrical failures and wiring issues." },
  { name: "Security", description: "Access control and security concerns." },
];

const seedUsers = [
  {
    email: "admin@society.local",
    password: "Admin@12345",
    fullName: "Society Admin",
    role: "society_admin",
    apartmentNumber: "A-101",
  },
  {
    email: "resident@society.local",
    password: "Resident@12345",
    fullName: "Resident User",
    role: "resident",
    apartmentNumber: "A-202",
  },
];

async function getExistingUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    throw error;
  }

  return data.users.find((user) => user.email === email) ?? null;
}

async function getOrCreateUser(user) {
  const existingUser = await getExistingUserByEmail(user.email);

  if (existingUser) {
    return existingUser;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      role: user.role,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(`Failed to create seed user for ${user.email}.`);
  }

  return data.user;
}

async function main() {
  let { data: society, error: societyError } = await supabase
    .from("societies")
    .select("id, slug")
    .eq("slug", societySlug)
    .maybeSingle();

  if (societyError) {
    throw societyError;
  }

  if (!society) {
    const { error: societyInsertError } = await supabase
      .from("societies")
      .upsert(
        {
          name: "Demo Society",
          slug: societySlug,
          city: "Bengaluru",
          contact_email: "admin@demo-society.local",
        },
        { onConflict: "slug" },
      );

    if (societyInsertError) {
      throw societyInsertError;
    }

    const { data: reloadedSociety, error: reloadError } = await supabase
      .from("societies")
      .select("id, slug")
      .eq("slug", societySlug)
      .maybeSingle();

    if (reloadError) {
      throw reloadError;
    }

    if (!reloadedSociety) {
      throw new Error(`Failed to create society "${societySlug}".`);
    }

    society = reloadedSociety;
  }

  const { error: apartmentsError } = await supabase
    .from("apartments")
    .upsert(
      apartments.map((apartment) => ({
        ...apartment,
        society_id: society.id,
      })),
      { onConflict: "society_id,apartment_number" },
    );

  if (apartmentsError) {
    throw apartmentsError;
  }

  const { data: apartmentRows, error: apartmentQueryError } = await supabase
    .from("apartments")
    .select("id, apartment_number")
    .eq("society_id", society.id);

  if (apartmentQueryError) {
    throw apartmentQueryError;
  }

  const apartmentMap = new Map(
    apartmentRows.map((item) => [item.apartment_number, item.id]),
  );

  const { error: servicesError } = await supabase
    .from("services")
    .upsert(
      services.map((service) => ({
        ...service,
        society_id: society.id,
      })),
      { onConflict: "society_id,name" },
    );

  if (servicesError) {
    throw servicesError;
  }

  const { data: serviceRows, error: serviceQueryError } = await supabase
    .from("services")
    .select("id, name")
    .eq("society_id", society.id);

  if (serviceQueryError) {
    throw serviceQueryError;
  }

  const serviceMap = new Map(serviceRows.map((item) => [item.name, item.id]));

  const createdUsers = [];

  for (const user of seedUsers) {
    const authUser = await getOrCreateUser(user);
    const apartmentId = apartmentMap.get(user.apartmentNumber) ?? null;

    const { error: profileError } = await supabase.from("users").upsert({
      apartment_id: apartmentId,
      apartment_number: user.apartmentNumber,
      email: user.email,
      full_name: user.fullName,
      id: authUser.id,
      role: user.role,
      society_id: society.id,
    });

    if (profileError) {
      throw profileError;
    }

    createdUsers.push({ ...user, id: authUser.id });
  }

  const complaints = [
    {
      apartment_number: "A-202",
      title: "Water leakage in kitchen ceiling",
      description: "Water leakage reported in the kitchen ceiling.",
      service_name: "Plumbing",
      status: "open",
      user_id: createdUsers.find((item) => item.email === "resident@society.local")?.id,
    },
    {
      apartment_number: "A-202",
      title: "Parking gate remote not working",
      description: "Parking gate remote access is not working consistently.",
      service_name: "Security",
      status: "in_progress",
      user_id: createdUsers.find((item) => item.email === "resident@society.local")?.id,
    },
  ].filter((item) => item.user_id);

  const userIds = [...new Set(complaints.map((item) => item.user_id))];

  const { data: existingComplaints, error: complaintsQueryError } = await supabase
    .from("complaints")
    .select("resident_user_id, title")
    .in("resident_user_id", userIds);

  if (complaintsQueryError) {
    throw complaintsQueryError;
  }

  const existingComplaintKeys = new Set(
    existingComplaints.map(
      (item) => `${item.resident_user_id}:${item.title}`,
    ),
  );

  const complaintsToInsert = complaints.filter(
    (item) => !existingComplaintKeys.has(`${item.user_id}:${item.title}`),
  );

  if (complaintsToInsert.length) {
    const enrichedComplaints = complaintsToInsert.map((complaint) => {
      const apartmentId = apartmentMap.get(complaint.apartment_number) ?? null;
      const serviceId = serviceMap.get(complaint.service_name) ?? null;

      if (!apartmentId) {
        throw new Error(`No apartment found for ${complaint.apartment_number}.`);
      }

      if (!serviceId) {
        throw new Error(`No service found for ${complaint.service_name}.`);
      }

      return {
        apartment_id: apartmentId,
        description: complaint.description,
        resident_user_id: complaint.user_id,
        category_id: serviceId,
        service_id: serviceId,
        society_id: society.id,
        status: complaint.status,
        title: complaint.title,
      };
    });

    const { error: complaintsInsertError } = await supabase
      .from("complaints")
      .insert(enrichedComplaints);

    if (complaintsInsertError) {
      throw complaintsInsertError;
    }
  }

  console.log("Seed completed successfully.");
  console.log("Admin login: admin@society.local / Admin@12345");
  console.log("Resident login: resident@society.local / Resident@12345");
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
