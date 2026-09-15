"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { STATES } from "@/lib/format";
export default function RaceFilters({
  cycle,
  cycles,
  state,
  office,
}: {
  cycle: number;
  cycles: number[];
  state: string;
  office: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function change(values: Record<string, string>) {
    const p = new URLSearchParams({
      cycle: String(cycle),
      state,
      office,
      ...values,
    });
    startTransition(() => router.push(`/races?${p}`));
  }
  return (
    <div className="race-filters">
      <label>
        Election cycle
        <select
          disabled={pending}
          aria-label="Race election cycle"
          value={cycle}
          onChange={(e) => change({ cycle: e.target.value })}
        >
          {cycles.map((c) => (
            <option key={c} value={c}>
              {c} election
            </option>
          ))}
        </select>
      </label>
      <label>
        State
        <select
          disabled={pending}
          aria-label="Race state"
          value={state}
          onChange={(e) => change({ state: e.target.value })}
        >
          <option value="">All states & territories</option>
          {Object.entries(STATES)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Office
        <select
          disabled={pending}
          aria-label="Race office"
          value={office}
          onChange={(e) => change({ office: e.target.value })}
        >
          <option value="">House & Senate</option>
          <option value="senate">U.S. Senate</option>
          <option value="house">U.S. House</option>
        </select>
      </label>
    </div>
  );
}
