"use client";
import { useRouter } from "next/navigation";
export default function CycleSwitcher({
  cycle,
  cycles,
  ids,
}: {
  cycle: number;
  cycles: number[];
  ids: string[];
}) {
  const router = useRouter();
  return (
    <div className="compare-cycle-switch">
      <label htmlFor="compare-cycle">Reporting cycle</label>
      <select
        id="compare-cycle"
        value={cycle}
        onChange={(e) =>
          router.push(`/compare?cycle=${e.target.value}&ids=${ids.join(",")}`)
        }
      >
        {cycles.map((c) => (
          <option key={c} value={c}>
            {c - 1}–{c}
          </option>
        ))}
      </select>
    </div>
  );
}
