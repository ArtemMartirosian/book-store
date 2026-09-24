import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DOCUMENT_LOCALE_HEADER, documentLocaleFromPath } from "./app/lib/document-locale";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DOCUMENT_LOCALE_HEADER, documentLocaleFromPath(request.nextUrl.pathname));

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/:locale(hy|ru|en)/:path*", "/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
