import { NextRequest, NextResponse } from "next/server";
import { parseFilters, searchCandidates, snapshot, CYCLES } from "@/lib/data";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.has("cycle") && !CYCLES.includes(Number(params.get("cycle"))))
    return NextResponse.json(
      { error: `Supported cycles: ${CYCLES.join(", ")}.` },
      { status: 400 },
    );
  const filters = parseFilters(params);
  const result = searchCandidates(filters);
  const data = snapshot(filters.cycle);
  return NextResponse.json(
    {
      ...result,
      cycle: filters.cycle,
      source: data.source,
      downloadedAt: data.downloadedAt,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
