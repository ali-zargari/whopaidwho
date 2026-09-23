"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Network, Table2, Building2, Info } from "lucide-react";
import type { Candidate, Registration } from "@/lib/types";
import type { CommitteeRecord } from "@/lib/records";
import { usableExample } from "@/lib/record-examples";
import { brands } from "@/lib/brands";
import {
  coverage,
  money,
  date,
  contributionTotal,
  initials,
} from "@/lib/format";
export default function FundingMap({
  candidate,
  registration,
  corporateRecords,
  cycle,
}: {
  candidate: Candidate | null;
  registration: Registration;
  corporateRecords: CommitteeRecord[];
  cycle: number;
}) {
  const [view, setView] = useState<"map" | "table">("map");
  const [selected, setSelected] = useState<CommitteeRecord | null>(null);
  const total = candidate ? contributionTotal(candidate) : 0;
  const categories = candidate
    ? [
        {
          name: "Individuals",
          amount: candidate.individuals,
          color: "#176850",
        },
        {
          name: "Political committees",
          amount: candidate.committees,
          color: "#6484c1",
        },
        {
          name: "The candidate",
          amount: candidate.selfContributions,
          color: "#b38948",
        },
        {
          name: "Party committees",
          amount: candidate.partyContributions,
          color: "#8d9e89",
        },
      ]
    : [];
  const canChart = total > 0 && categories.every((c) => c.amount >= 0);
  const examples = corporateRecords.filter(usableExample).slice(0, 6);
  return (
    <>
      <section className="panel map-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">
              THE FUNDING CONNECTIONS · {cycle - 1}–{cycle}
            </span>
            <h2>{registration.name}’s funding map</h2>
          </div>
          <div className="view-tabs" role="tablist" aria-label="Funding view">
            <button
              id="funding-map-tab"
              role="tab"
              aria-selected={view === "map"}
              tabIndex={view === "map" ? 0 : -1}
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight", "End"].includes(e.key)) {
                  e.preventDefault();
                  setView("table");
                  document.getElementById("funding-table-tab")?.focus();
                }
              }}
              aria-controls={candidate ? "funding-map-content" : undefined}
              disabled={!candidate}
              onClick={() => setView("map")}
            >
              <Network size={15} />
              Map
            </button>
            <button
              id="funding-table-tab"
              role="tab"
              aria-selected={view === "table"}
              tabIndex={view === "table" ? 0 : -1}
              onKeyDown={(e) => {
                if (["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
                  e.preventDefault();
                  setView("map");
                  document.getElementById("funding-map-tab")?.focus();
                }
              }}
              aria-controls={candidate ? "funding-map-content" : undefined}
              disabled={!candidate}
              onClick={() => setView("table")}
            >
              <Table2 size={15} />
              Table
            </button>
          </div>
        </div>
        <p className="map-description">
          Full contribution categories on the left. Selected
          corporation-connected PAC transactions on the right. The company
          identifies the PAC’s registered affiliation, not the source of every
          dollar.
        </p>
        {!candidate ? (
          <div className="inline-empty">
            <Info size={26} />
            <h3>No financial summary for this candidate ID in {cycle}.</h3>
            <p>
              This is unavailable data, not zero funding. Try another funding
              cycle or inspect the original FEC record.
            </p>
          </div>
        ) : (
          <div
            id="funding-map-content"
            role="tabpanel"
            aria-labelledby={`funding-${view}-tab`}
          >
            <div className="map-key">
              <span>
                <i className="solid-key" />
                Solid lines: contribution totals
              </span>
              <span>
                <i className="dotted-key" />
                Dotted lines: one transaction per PAC
              </span>
              <span>{coverage(candidate)}</span>
            </div>
            {view === "map" ? (
              <div
                className="graph-scroll"
                tabIndex={0}
                aria-label="Funding network. Scroll horizontally on small screens; Table view provides the same values."
              >
                <svg
                  className="funding-network"
                  viewBox="0 0 1130 555"
                  width="1130"
                  height="555"
                  role="group"
                  aria-labelledby="funding-network-title funding-network-description"
                >
                  <title id="funding-network-title">{`Funding relationships for ${registration.name}`}</title>
                  <desc id="funding-network-description">{`${categories.map((c) => `${c.name}: ${money(c.amount)}`).join(". ")}. Company PAC connections are individual example transactions and are not proportional to total giving.`}</desc>
                  <text x="24" y="25" className="graph-column-label">
                    REPORTED CONTRIBUTION TOTALS
                  </text>
                  <text x="820" y="25" className="graph-column-label">
                    COMPANY-CONNECTED PAC EXAMPLES
                  </text>
                  {categories.map((c, i) => {
                    const y = 62 + i * 115;
                    return (
                      <g key={c.name}>
                        <path
                          d={`M 285 ${y + 42} C 345 ${y + 42}, 350 277, 413 277`}
                          fill="none"
                          stroke={c.color}
                          strokeOpacity=".38"
                          strokeWidth={
                            canChart ? Math.max(1, (c.amount / total) * 30) : 1
                          }
                          strokeDasharray={canChart ? undefined : "4 5"}
                        />
                        <foreignObject x="24" y={y} width="261" height="88">
                          <div
                            className="graph-total-node"
                            style={{ borderLeftColor: c.color }}
                          >
                            <span>{c.name}</span>
                            <strong>{money(c.amount)}</strong>
                            <small>
                              {canChart
                                ? `${((c.amount / total) * 100).toFixed(1)}% of contributions`
                                : "Signed or zero values; no proportional scale"}
                            </small>
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })}
                  <foreignObject x="413" y="208" width="260" height="145">
                    <div className="graph-candidate-node">
                      <span className="graph-candidate-label">
                        {cycle - 1}–{cycle} CAMPAIGN
                      </span>
                      <strong>{registration.name}</strong>
                      <span>{money(total)} contributions</span>
                      <small>{registration.id}</small>
                    </div>
                  </foreignObject>
                  {examples.map((record, i) => {
                    const y = 52 + i * 79;
                    const brand = brands[record.committeeId];
                    const name =
                      brand?.name ||
                      record.connectedOrganization ||
                      record.name;
                    return (
                      <g key={record.id}>
                        <path
                          d={`M 820 ${y + 32} C 750 ${y + 32}, 750 280, 675 280`}
                          fill="none"
                          stroke={
                            selected?.id === record.id ? "#176850" : "#94aab7"
                          }
                          strokeWidth={selected?.id === record.id ? 2.5 : 1.5}
                          strokeDasharray="3 6"
                        />
                        <foreignObject x="820" y={y} width="289" height="68">
                          <button
                            className={`graph-company-node ${selected?.id === record.id ? "active" : ""}`}
                            onClick={() => setSelected(record)}
                            aria-label={`${name} connected PAC, ${money(record.amount)} transaction, ${date(record.date)}. View source.`}
                          >
                            {brand ? (
                              <Image
                                src={brand.asset}
                                alt=""
                                width={32}
                                height={32}
                                unoptimized
                              />
                            ) : (
                              <span className="brand-fallback">
                                {initials(name)}
                              </span>
                            )}
                            <span>
                              <strong>{name}</strong>
                              <small>
                                Connected PAC · {money(record.amount)} record
                              </small>
                            </span>
                            <ArrowUpRight size={13} />
                          </button>
                        </foreignObject>
                      </g>
                    );
                  })}
                  {!examples.length && (
                    <foreignObject x="810" y="191" width="286" height="170">
                      <div className="graph-empty">
                        <Building2 size={25} />
                        <strong>No matched company PAC examples</strong>
                        <p>
                          The sample does not establish that company-connected
                          PAC contributions were zero.
                        </p>
                      </div>
                    </foreignObject>
                  )}
                </svg>
              </div>
            ) : (
              <div className="map-table-view">
                <table className="records-table">
                  <caption>Complete contribution categories</caption>
                  <thead>
                    <tr>
                      <th>Source category</th>
                      <th className="number-cell">Reported amount</th>
                      <th className="number-cell">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className="number-cell">{money(c.amount)}</td>
                        <td className="number-cell">
                          {canChart
                            ? `${((c.amount / total) * 100).toFixed(1)}%`
                            : "Not charted"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>Selected company-connected PAC transactions</h3>
                <p className="muted-text">
                  One latest matching record per committee, not cumulative
                  giving.
                </p>
                <div className="company-table-list">
                  {examples.map((r) => (
                    <button key={r.id} onClick={() => setSelected(r)}>
                      <span>
                        {brands[r.committeeId]?.name ||
                          r.connectedOrganization ||
                          r.name}
                      </span>
                      <strong>{money(r.amount)}</strong>
                      <span>{date(r.date)}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                  {!examples.length && (
                    <p>No matching examples in this snapshot.</p>
                  )}
                </div>
              </div>
            )}
            <div className="map-comparison">
              <strong>
                {candidate.individuals >= 0 && candidate.committees >= 0
                  ? candidate.individuals > candidate.committees
                    ? "Individuals contributed more than political committees."
                    : candidate.individuals < candidate.committees
                      ? "Political committees contributed more than individuals."
                      : "Individuals and political committees reported equal contributions."
                  : "This period contains signed adjustments."}
              </strong>
              <span>
                Individuals {money(candidate.individuals)}{" "}
                <span aria-hidden="true"> / </span> Other political committees{" "}
                {money(candidate.committees)}. The committee category includes
                more than company PACs.
              </span>
            </div>
          </div>
        )}
        {selected && (
          <div
            className="graph-inspector"
            role="region"
            aria-label="Selected PAC transaction"
          >
            <div>
              <span className="eyebrow">ONE REPORTED TRANSACTION</span>
              <h3>{selected.name}</h3>
              <p>
                FEC-connected organization:{" "}
                <strong>{selected.connectedOrganization}</strong>
              </p>
              <p>
                {money(selected.amount)} · {date(selected.date)}
                {selected.isMemo ? " · Memo entry" : ""}
                {selected.amendment === "A" ? " · Amended filing" : ""}
                {selected.amount < 0 ? " · Negative adjustment" : ""}
              </p>
              {selected.memo && <p>{selected.memo}</p>}
            </div>
            <div>
              <a
                className="secondary-button"
                href={`https://www.fec.gov/data/filings/?file_number=${selected.fileNumber}`}
                target="_blank"
                rel="noreferrer"
              >
                Original filing
                <ArrowUpRight size={14} />
              </a>
              <a
                className="text-button"
                href={`https://www.fec.gov/data/committee/${selected.committeeId}/?cycle=${cycle}`}
                target="_blank"
                rel="noreferrer"
              >
                Committee registration
                <ArrowUpRight size={14} />
              </a>
              <button className="text-button" onClick={() => setSelected(null)}>
                Close details
              </button>
            </div>
          </div>
        )}
        <p className="panel-note">
          PAC examples are selected from the latest matching transactions of up
          to eight corporation-connected committees; the map shows up to six.
          Latest nonpositive or explicitly voided records are omitted without
          substituting older records. Dotted lines are not weighted by dollars.
          Corporate PAC contributions are separate from employees’ personal
          contributions.{" "}
          <a href="/methodology#company-graph">Graph methodology ↗</a>
        </p>
      </section>
    </>
  );
}
