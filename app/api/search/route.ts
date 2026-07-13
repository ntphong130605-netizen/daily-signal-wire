import { NextResponse } from "next/server";
import { filtersFromSearchParams, runSearch } from "@/lib/searchServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = filtersFromSearchParams(searchParams);
  const response = await runSearch(filters);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": filters.q
        ? "public, max-age=0, s-maxage=45, stale-while-revalidate=120"
        : "public, max-age=0, s-maxage=90, stale-while-revalidate=180"
    }
  });
}

