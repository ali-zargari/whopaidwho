"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Registration } from "@/lib/types";
export default function RaceControls({
  race,
  cycle,
  fundingCycle,
  candidate,
  registrations,
  cycles,
}: {
  race: string;
  cycle: number;
  fundingCycle: number;
  candidate: string;
  registrations: Registration[];
  cycles: number[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function change(values: { candidate?: string; fundingCycle?: number }) {
    startTransition(() =>
      router.push(
        `/races/${race}?${new URLSearchParams({ cycle: String(cycle), candidate: values.candidate || candidate, fundingCycle: String(values.fundingCycle || fundingCycle) })}`,
        { scroll: false },
      ),
    );
  }
  return (
    <div className="race-map-controls">
      <label>
        Candidate
        <select
          disabled={pending}
          aria-label="Map candidate"
          value={candidate}
          onChange={(e) => change({ candidate: e.target.value })}
        >
          {registrations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.party}
            </option>
          ))}
        </select>
      </label>
      <label>
        Funding cycle
        <select
          disabled={pending}
          aria-label="Map funding cycle"
          value={fundingCycle}
          onChange={(e) => change({ fundingCycle: Number(e.target.value) })}
        >
          {cycles.map((c) => (
            <option key={c} value={c}>
              {c - 1}–{c}
            </option>
          ))}
        </select>
      </label>
      <span>Changing the funding cycle follows the same FEC candidate ID.</span>
    </div>
  );
}
