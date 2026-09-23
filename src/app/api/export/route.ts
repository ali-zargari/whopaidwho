import { NextRequest, NextResponse } from "next/server";
import { CYCLES, filteredCandidates, parseFilters, snapshot } from "@/lib/data";
import { csvCell } from "@/lib/csv";
import { outsideOverview } from "@/lib/influence";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.has("cycle") && !CYCLES.includes(Number(params.get("cycle"))))
    return NextResponse.json(
      { error: `Supported cycles: ${CYCLES.join(", ")}.` },
      { status: 400 },
    );
  const filters = parseFilters(params);
  const all = filteredCandidates(filters);
  const data = snapshot(filters.cycle);
  const { outside, outsideDownloadedAt } = await outsideOverview(
    all.map((candidate) => candidate.id),
    filters.cycle,
  );
  const headers = [
    "candidate_id",
    "name",
    "party",
    "office",
    "state",
    "district",
    "cycle",
    "coverage_end",
    "reported_receipts",
    "reported_disbursements",
    "cash_on_hand",
    "debts_owed",
    "individual_contributions",
    "other_committee_contributions",
    "party_contributions",
    "candidate_contributions",
    "candidate_loans",
    "other_loans",
    "transfers_in",
    "transfers_out",
    "individual_refunds",
    "committee_refunds",
    "outside_spending_status",
    "outside_support",
    "outside_oppose",
    "outside_source",
    "outside_downloaded_at",
    "source",
    "downloaded_at",
  ];
  const lines = all.map((c) =>
    [
      c.id,
      c.name,
      c.party,
      c.office,
      c.state,
      c.district,
      c.cycle,
      c.coverageEnd,
      c.receipts,
      c.disbursements,
      c.cash,
      c.debt,
      c.individuals,
      c.committees,
      c.partyContributions,
      c.selfContributions,
      c.candidateLoans,
      c.otherLoans,
      c.transfersIn,
      c.transfersOut,
      c.individualRefunds,
      c.committeeRefunds,
      outside[c.id].status,
      outside[c.id].support,
      outside[c.id].oppose,
      outside[c.id].sourceUrl,
      outsideDownloadedAt,
      data.source,
      data.downloadedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return new Response(
    "\uFEFF" +
      headers.map(csvCell).join(",") +
      "\r\n" +
      lines.join("\r\n") +
      "\r\n",
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="who-paid-who-${filters.cycle}.csv"`,
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
