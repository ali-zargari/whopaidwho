import { NextRequest, NextResponse } from "next/server";
import { CYCLES, DEFAULT_CYCLE, getCandidate, snapshot } from "@/lib/data";
import { candidateInfluence } from "@/lib/influence";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("cid") || "";
  const cycle = Number(
    request.nextUrl.searchParams.get("cycle") || DEFAULT_CYCLE,
  );
  if (!/^[HS][A-Z0-9]{8}$/.test(id) || !CYCLES.includes(cycle)) {
    return NextResponse.json(
      {
        error:
          "A valid congressional FEC candidate ID and supported cycle are required.",
      },
      { status: 400 },
    );
  }
  try {
    const data = await candidateInfluence(id, cycle);
    const known = CYCLES.some(
      (year) =>
        getCandidate(id, year) ||
        snapshot(year).registrations.some((r) => r.id === id),
    );
    if (!known && data.outside.status === "not-indexed") {
      return NextResponse.json(
        { error: "Candidate not found in the supported snapshots." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        ...data,
        methodologyUrl: "https://www.whopaidwho.com/methodology#outside",
        description:
          "Outside spending, selected upstream receipts, and personal donor affiliations are separate measures. They must not be added together or interpreted as a dark-money total.",
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Funding snapshots are temporarily unavailable." },
      { status: 503 },
    );
  }
}
