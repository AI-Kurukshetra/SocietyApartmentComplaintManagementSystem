export function toUserMessage(error: unknown, fallback: string) {
  if (!error) {
    return fallback;
  }

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (
    normalized.includes("already registered") ||
    normalized.includes("email already") ||
    normalized.includes("user already")
  ) {
    return "An account with this email already exists.";
  }

  if (normalized.includes("users_society_apartment_number_key")) {
    return "That apartment number is already registered in this society.";
  }

  if (normalized.includes("row-level security")) {
    return "You do not have permission to perform this action.";
  }

  if (normalized.includes("jwt") || normalized.includes("token")) {
    return "Your session expired. Please sign in again.";
  }

  if (normalized.includes("rate limit")) {
    return "Too many attempts. Please wait and try again.";
  }

  return fallback;
}

export function logError(context: string, error: unknown) {
  if (!error) {
    return;
  }

  console.error(`[${context}]`, error);
}
