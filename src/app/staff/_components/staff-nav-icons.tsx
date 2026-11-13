// DESIGN-4 4.2: line icons for the staff sidebar (inline SVG, no dependency). 20px, stroke="currentColor", decorative
// (the link text or aria-label names the item).

export type StaffIconName =
  | "home"
  | "reviews"
  | "activities"
  | "station"
  | "orders"
  | "rewards"
  | "articles"
  | "reports"
  | "students"
  | "users"
  | "rates"
  | "profile"
  | "notifications"
  | "signout"
  | "collapse"
  | "expand";

const PATHS: Record<StaffIconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </>
  ),
  reviews: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  activities: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  station: (
    <>
      <path d="M12 3v3" />
      <path d="M4 7h16" />
      <path d="m6 7-3 7a3 3 0 0 0 6 0Z" />
      <path d="m18 7-3 7a3 3 0 0 0 6 0Z" />
      <path d="M12 6v15M8 21h8" />
    </>
  ),
  orders: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
    </>
  ),
  rewards: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13" />
      <path d="M12 8c-1.5-3-5-3.5-5-1.5S10 8 12 8c2 0 5-.5 5-1.5S13.5 5 12 8Z" />
    </>
  ),
  articles: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" />
      <path d="M4 17a2 2 0 0 1 2-2h12M8 7h6M8 11h6" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V6M17 16v-8" />
    </>
  ),
  students: (
    <>
      <path d="M2 9 12 4l10 5-10 5Z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
  rates: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z" />
      <path d="M10 21h4" />
    </>
  ),
  signout: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  collapse: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M16 9l-3 3 3 3" />
    </>
  ),
  expand: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M13 9l3 3-3 3" />
    </>
  ),
};

export function StaffNavIcon({ name, className = "" }: { name: StaffIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-5 shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
