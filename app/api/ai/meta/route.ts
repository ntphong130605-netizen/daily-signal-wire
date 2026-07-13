import { POST as rewrite } from "@/app/api/ai/rewrite/route";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return rewrite(
    new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, section: "meta" })
    })
  );
}
