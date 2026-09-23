import { CYCLES, snapshot } from "@/lib/data";
import { currentCycle } from "@/lib/format";
import { committeeRecords } from "@/lib/records";
import {
  outsideSnapshot,
  affiliationSnapshot,
  fundingLinksSnapshot,
} from "@/lib/influence";
export async function GET() {
  try {
    await Promise.all(CYCLES.map((c) => committeeRecords("", c)));
    const influence = await Promise.all(
      CYCLES.map(async (cycle) => {
        const [outside, affiliations, links] = await Promise.all([
          outsideSnapshot(cycle),
          affiliationSnapshot(cycle),
          fundingLinksSnapshot(cycle),
        ]);
        return {
          cycle,
          outsideDownloadedAt: outside.downloadedAt,
          affiliationsDownloadedAt: affiliations.downloadedAt,
          fundingLinksDownloadedAt: links.downloadedAt,
          fundingLinksCoverage: links.coverage.status,
        };
      }),
    );
    return Response.json(
      {
        status: "ok",
        currentCycle: currentCycle(),
        currentCycleAvailable: CYCLES.includes(currentCycle()),
        influence,
        cycles: CYCLES.map((c) => ({
          cycle: c,
          candidates: snapshot(c).candidates.length,
          downloadedAt: snapshot(c).downloadedAt,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return Response.json(
      { status: "error", message: "A required data snapshot is unavailable." },
      { status: 503 },
    );
  }
}
