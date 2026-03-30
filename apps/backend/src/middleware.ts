import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function getAllowedOrigins(): string[] {
  return [
    "http://localhost:3000",
    process.env.FRONTEND_URL ?? "",
  ].filter(Boolean);
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.includes(origin) || process.env.NODE_ENV === "development";

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : "",
        ...CORS_HEADERS,
      },
    });
  }

  const res = NextResponse.next();

  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  }

  return res;
}

export const config = {
  matcher: "/api/:path*",
};
