import { requireAdmin } from "@/lib/auth";

export async function protectMutation(request: Request) {
  await requireAdmin();
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    throw new Error("INVALID_ORIGIN");
  }
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "INVALID_ORIGIN") {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (
    message.includes("DATABASE_URL") ||
    message.includes("Environment variable not found")
  ) {
    return Response.json(
      {
        error:
          "DATABASE_URL is not configured. Add a production database URL in Vercel Project Settings."
      },
      { status: 503 }
    );
  }
  return Response.json({ error: message || "Request failed" }, { status: 500 });
}
