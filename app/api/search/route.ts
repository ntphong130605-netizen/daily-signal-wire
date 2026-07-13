import { NextResponse } from "next/server";
import { publicCache } from "@/lib/http";
import { filtersFromSearchParams, runSearch } from "@/lib/searchServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = filtersFromSearchParams(searchParams);
  const response = await runSearch(filters);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": filters.q ? publicCache(45, 120) : publicCache(90, 180)
    }
  });
}
