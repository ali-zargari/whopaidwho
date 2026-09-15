import { CYCLES, snapshot } from "@/lib/data";
import { currentCycle } from "@/lib/format";
import { committeeRecords } from "@/lib/records";
export async function GET() {
  try {
    await Promise.all(CYCLES.map((c) => committeeRecords("", c)));
    return Response.json(
      {
        status: "ok",
        currentCycle: currentCycle(),
        currentCycleAvailable: CYCLES.includes(currentCycle()),
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
