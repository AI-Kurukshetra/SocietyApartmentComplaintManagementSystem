import type { UserRole } from "@/lib/types";

export function getRoleHome(role: UserRole) {
  switch (role) {
    case "society_admin":
      return "/admin";
    case "maintenance_staff":
      return "/maintenance";
    default:
      return "/resident";
  }
}
