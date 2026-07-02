import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { buildAllowedOrigins } from "@/lib/cors";

const ALLOWED_ORIGINS = buildAllowedOrigins({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export default auth((req) => {
  const response = NextResponse.next();
  const origin = req.headers.get("origin") ?? "";
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");

  if (isApiRoute && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  if (isApiRoute && req.method === "OPTIONS") {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }

  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
