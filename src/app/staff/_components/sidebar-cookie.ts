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

/** `<html data-staff-sidebar="collapsed">`: the static-shell sidebar (Suspense fallback) renders collapsed in CSS. */
export const SIDEBAR_HTML_ATTR = "data-staff-sidebar";

/**
 * Review I1 (DESIGN-4 4.2, no flash): run before first paint, like THEME_INIT_SCRIPT. The cookie has path /staff, so it
 * is only visible (and the attribute only set) on /staff pages. The shell is prerendered and cannot read the cookie.
 */
export const SIDEBAR_INIT_SCRIPT = `(function(){try{if(/(?:^|; )${SIDEBAR_COOKIE}=${SIDEBAR_COLLAPSED}(?:;|$)/.test(document.cookie))document.documentElement.setAttribute("${SIDEBAR_HTML_ATTR}","${SIDEBAR_COLLAPSED}")}catch(e){}})()`;
