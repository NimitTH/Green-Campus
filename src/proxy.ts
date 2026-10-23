import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ARTICLE_NOT_FOUND_PATH, articleSlugFromPath, isPublishedArticle } from "@/lib/articles/not-found-check";
import { rootAuthRedirect } from "@/lib/auth/email-links";
import { isProtectedPath } from "@/lib/auth/routes";

// Proxy (Next 16 replacement for middleware): refreshes the Supabase session cookie and
// sends anonymous visitors of /dashboard, /activities, /my-submissions and /staff/** to /login. Role checks (staff,
// admin) live in server components via the DAL (src/lib/auth/dal.ts), not here.
export async function proxy(request: NextRequest) {
  // Email link that fell back to the site root ("/?code=..."): hand it to the callback.
  const rootRedirect = rootAuthRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (rootRedirect) return NextResponse.redirect(new URL(rootRedirect, request.nextUrl.origin));

  // A missing / unpublished / malformed article must be a real HTTP 404. The page cannot do it in
  // production (partial prerender: the static shell streams first, which fixes the status at 200), so check
  // here and rewrite to the static 404 route. Prefetches cannot be told apart here (Next strips its router
  // headers from request.headers in Proxy), so the check is cached per instance (published 60 s, missing
  // 10 s) with a 1.5 s timeout; a failed lookup (null) is not cached and lets the page render as before.
  // See src/lib/articles/not-found-check.ts for the staleness windows.
  const articleSlug = articleSlugFromPath(request.nextUrl.pathname);
  if (articleSlug !== null) {
    if ((await isPublishedArticle(articleSlug)) === false) {
      return NextResponse.rewrite(new URL(ARTICLE_NOT_FOUND_PATH, request.nextUrl.origin));
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims: getClaims refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Keep any cookie changes (e.g. a cleared expired session) on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files from public/.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
