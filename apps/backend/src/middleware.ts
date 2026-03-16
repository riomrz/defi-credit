import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // CORS headers for frontend → backend communication
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigins = [
    "http://localhost:3000",
    process.env.FRONTEND_URL ?? "",
  ].filter(Boolean);

  if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
    res.headers.set("Access-Control-Allow-Origin", origin || "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: "/api/:path*",
};
