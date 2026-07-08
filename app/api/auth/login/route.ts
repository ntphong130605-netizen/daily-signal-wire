import { adminCookie, createAdminSession } from "@/lib/auth";
import { rateLimit, requestKey } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const limited = rateLimit(requestKey(request, "login"), {
    limit: 5,
    windowMs: 15 * 60_000
  });
  if (!limited.allowed) {
    return Response.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${adminCookie.name}=${createAdminSession()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${adminCookie.options.maxAge}${
      adminCookie.options.secure ? "; Secure" : ""
    }`
  );
  return response;
}
