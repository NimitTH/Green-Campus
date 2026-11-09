// DESIGN-4 4.2: the staff sidebar remembers "collapsed" in a cookie (path /staff, 1 year, SameSite=Lax).
// A plain module (no "use client"), so the server layout gets the real strings, not client references.

export const SIDEBAR_COOKIE = "staff-sidebar";
export const SIDEBAR_COLLAPSED = "collapsed";

/** The document.cookie assignment that stores (collapsed) or deletes (expanded) the choice. */
export function sidebarCookieAssignment(collapsed: boolean): string {
  return collapsed
    ? `${SIDEBAR_COOKIE}=${SIDEBAR_COLLAPSED}; path=/staff; max-age=31536000; samesite=lax`
    : `${SIDEBAR_COOKIE}=; path=/staff; max-age=0; samesite=lax`;
}
