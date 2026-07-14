import { configuredHtmlVerificationFile } from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ verification: string }> }
) {
  const { verification } = await params;
  const expectedFile = configuredHtmlVerificationFile();
  if (!expectedFile || verification !== expectedFile) {
    return new Response("Not Found", { status: 404 });
  }

  const configuredContent = process.env.GOOGLE_SITE_VERIFICATION_CONTENT?.trim();
  return new Response(
    configuredContent || `google-site-verification: ${expectedFile}`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Robots-Tag": "noindex"
      }
    }
  );
}
