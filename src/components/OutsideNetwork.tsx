"use client";

import { useState } from "react";
import { ArrowUpRight, Network } from "lucide-react";
import type { OutsideSpender } from "@/lib/influence";
import { money } from "@/lib/format";

export default function OutsideNetwork({
  name,
  candidateId,
  cycle,
  spenders,
}: {
  name: string;
  candidateId: string;
  cycle: number;
  spenders: OutsideSpender[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = spenders.find((spender) => spender.id === selected);
  const sides = ["support", "oppose"] as const;
  const leaders = Object.fromEntries(
    sides.map((stance) => [
      stance,
      spenders
        .filter((s) => s[stance] > 0)
        .sort((a, b) => b[stance] - a[stance] || a.id.localeCompare(b.id))
        .slice(0, 4),
    ]),
  ) as Record<(typeof sides)[number], OutsideSpender[]>;
  const source = (id: string) =>
    `https://www.fec.gov/data/independent-expenditures/?data_type=processed&candidate_id=${candidateId}&committee_id=${id}&cycle=${cycle}&is_notice=false&most_recent=true`;
  return (
    <div className="outside-network-wrap">
      <div
        className="outside-network"
        aria-label={`Largest outside spenders supporting and opposing ${name}`}
      >
        <svg
          className="outside-connectors"
          viewBox="0 0 1000 460"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {sides.flatMap((stance) =>
            leaders[stance].map((s, index) => (
              <path
                key={`${stance}-${s.id}`}
                d={
                  stance === "support"
                    ? `M 240 ${70 + index * 105} C 380 ${70 + index * 105} 370 230 460 230`
                    : `M 760 ${70 + index * 105} C 620 ${70 + index * 105} 630 230 540 230`
                }
                stroke={stance === "support" ? "#4a997d" : "#b67a74"}
                strokeWidth={selected === s.id ? 4 : 2}
                fill="none"
                strokeDasharray="6 5"
              />
            )),
          )}
        </svg>
        {sides.map((stance) => (
          <div className={`outside-network-side ${stance}`} key={stance}>
            <h3>
              {stance === "support" ? "Spends to support" : "Spends to oppose"}
            </h3>
            {leaders[stance].map((s) => (
              <button
                type="button"
                key={s.id}
                className={`outside-group-node ${selected === s.id ? "selected" : ""}`}
                aria-pressed={selected === s.id}
                aria-controls="outside-selection"
                onClick={() => setSelected(s.id)}
              >
                <span className="group-lettermark" aria-hidden="true">
                  {s.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")}
                </span>
                <span>
                  <span className="group-node-name">{s.name}</span>
                  <strong>{money(s[stance], true)}</strong>
                </span>
              </button>
            ))}
            {leaders[stance].length === 0 && (
              <p className="outside-network-empty">
                No positive amounts matched in these processed filings.
              </p>
            )}
          </div>
        ))}
        <div className="outside-network-target">
          <Network size={26} aria-hidden="true" />
          <strong>{name}</strong>
          <span>Target of outside spending</span>
          <small>Funds stay outside the campaign</small>
        </div>
      </div>
      <div
        id="outside-selection"
        className="outside-selection"
        role="region"
        aria-label="Selected outside spender"
        aria-live="polite"
      >
        {active ? (
          <>
            <div>
              <span className="eyebrow">SELECTED SPENDER · {active.id}</span>
              <h3>{active.name}</h3>
            </div>
            <p>
              Supporting: <strong>{money(active.support)}</strong> · Opposing:{" "}
              <strong>{money(active.oppose)}</strong>
            </p>
            <a href={source(active.id)} target="_blank" rel="noreferrer">
              Inspect this group’s spending <ArrowUpRight size={15} />
            </a>
          </>
        ) : (
          <p>
            Select a group to inspect its spending. The map shows up to four
            leading spenders per position; the full list is below. Connections
            show the reported position, not money paid to the candidate.
          </p>
        )}
      </div>
    </div>
  );
}
