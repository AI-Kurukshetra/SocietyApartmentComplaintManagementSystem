import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  plumbing: (
    <path
      d="M12 3c0 4.2-6 6.5-6 10.5A6 6 0 0 0 12 19a6 6 0 0 0 6-5.5C18 9.5 12 7.2 12 3z"
      fill="currentColor"
    />
  ),
  electrical: (
    <path
      d="M13.5 2 6 11h4l-1.5 9L18 9h-4l1.5-7z"
      fill="currentColor"
    />
  ),
  security: (
    <path
      d="M12 2 4.5 5.2V11c0 5.1 3.2 9.1 7.5 10.9 4.3-1.8 7.5-5.8 7.5-10.9V5.2L12 2z"
      fill="currentColor"
    />
  ),
  cleaning: (
    <path
      d="M7 3h10l-2 6H5l2-6zm-1 8h10l-1 9H7l-1-9z"
      fill="currentColor"
    />
  ),
  general: (
    <path
      d="M5 5h14v4H5V5zm0 6h14v4H5v-4z"
      fill="currentColor"
    />
  ),
};

function resolveServiceKind(name?: string | null) {
  const value = name?.toLowerCase() ?? "";

  if (value.includes("plumb") || value.includes("water") || value.includes("leak")) {
    return "plumbing";
  }

  if (value.includes("electric") || value.includes("power") || value.includes("light")) {
    return "electrical";
  }

  if (value.includes("security") || value.includes("guard") || value.includes("access")) {
    return "security";
  }

  if (value.includes("clean") || value.includes("house") || value.includes("trash")) {
    return "cleaning";
  }

  return "general";
}

export function ServiceIcon({ name }: { name?: string | null }) {
  const kind = resolveServiceKind(name);

  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        {icons[kind]}
      </svg>
      <span className="sr-only">{name ?? "Service"}</span>
    </span>
  );
}
