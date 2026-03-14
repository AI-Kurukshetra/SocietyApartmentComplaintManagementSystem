export type UserRole = "resident" | "society_admin" | "maintenance_staff";

export type ComplaintStatus =
  | "open"
  | "in_progress"
  | "on_hold"
  | "resolved";

export interface Society {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  contact_email: string | null;
  created_at: string;
}

export interface Apartment {
  id: string;
  society_id: string;
  apartment_number: string;
  block_name: string | null;
  floor_label: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  society_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  society_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  apartment_id: string | null;
  apartment_number: string | null;
  phone: string | null;
  created_at: string;
  society?: Society | null;
  apartment?: Apartment | null;
}

export interface StaffCategory {
  id: string;
  staff_user_id: string;
  category_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  complaint_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author?: Profile | null;
}

export interface Complaint {
  id: string;
  society_id: string;
  resident_user_id: string;
  apartment_id: string;
  category_id: string;
  assigned_staff_id: string | null;
  title: string;
  description: string;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ComplaintCardData extends Complaint {
  apartment?: Apartment | null;
  service?: Service | null;
  resident?: Profile | null;
  assignedStaff?: Profile | null;
  comments?: Comment[];
}