import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function requestId() {
  return crypto.randomUUID();
}

function limitFor(pathname: string, method: string) {
  if (pathname.startsWith("/api/auth/login")) return 12;
  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/ai")) {
    return method === "GET" ? 180 : 80;
  }
  if (pathname.startsWith("/api/analytics")) return 180;
  if (pathname.startsWith("/api/newsletter")) return 30;
  if (pathname.startsWith("/api/")) return method === "GET" ? 300 : 120;
  return 0;
}

function rateLimited(request: NextRequest) {
  const limit = limitFor(request.nextUrl.pathname, request.method);
  if (!limit) return null;

  const now = Date.now();
  const key = `${clientIp(request)}:${request.method}:${request.nextUrl.pathname}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  if (bucket.count >= limit) {
    return Math.ceil((bucket.resetAt - now) / 1000);
  }
  bucket.count += 1;
  return null;
}

function invalidOrigin(request: NextRequest) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

function withSecurityHeaders(response: NextResponse, id: string, pathname: string) {
  response.headers.set("X-Request-ID", id);
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Origin-Agent-Cluster", "?1");
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/api/cron")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export function middleware(request: NextRequest) {
  const id = requestId();
  const retryAfter = rateLimited(request);
  if (retryAfter !== null) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Rate limit reached.", requestId: id },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      ),
      id,
      request.nextUrl.pathname
    );
  }

  if (invalidOrigin(request)) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Invalid request origin.", requestId: id }, { status: 403 }),
      id,
      request.nextUrl.pathname
    );
  }

  return withSecurityHeaders(NextResponse.next(), id, request.nextUrl.pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map)$).*)"
  ]
};
