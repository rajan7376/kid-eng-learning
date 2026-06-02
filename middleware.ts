import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  const needAuth =
    pathname.startsWith("/study") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/parent");

  if (needAuth && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/study";
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/parent") &&
    session?.role !== "parent" &&
    session?.role !== "admin"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/study";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && session) {
    const url = req.nextUrl.clone();
    url.pathname =
      session.role === "admin"
        ? "/admin"
        : session.role === "parent"
          ? "/parent"
          : "/study";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
