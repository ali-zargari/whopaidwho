import { NextRequest, NextResponse } from "next/server";
import { CYCLES, getCandidate, DEFAULT_CYCLE } from "@/lib/data";
import { committeeRecords } from "@/lib/records";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("cid") || "";
  const cycle = Number(
    request.nextUrl.searchParams.get("cycle") || DEFAULT_CYCLE,
  );
  if (!/^[HS][A-Z0-9]{8}$/.test(id) || !CYCLES.includes(cycle))
    return NextResponse.json(
      {
        error: `A valid FEC candidate ID and supported cycle (${CYCLES.join(", ")}) are required.`,
      },
      { status: 400 },
    );
  if (!getCandidate(id, cycle))
    return NextResponse.json(
      { error: "Candidate not found in this cycle." },
      { status: 404 },
    );
  try {
    return NextResponse.json(
      {
        ...(await committeeRecords(id, cycle)),
        description:
          "Latest individual committee-reported transactions, not cumulative donor totals.",
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Committee records are temporarily unavailable. Please try again.",
      },
      { status: 503 },
    );
  }
}
