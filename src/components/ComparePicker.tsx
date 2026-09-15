"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import type { Candidate } from "@/lib/types";
import { STATES, partyName } from "@/lib/format";
export default function ComparePicker({
  cycle,
  ids,
}: {
  cycle: number;
  ids: string[];
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(
          `/api/politicians?cycle=${cycle}&q=${encodeURIComponent(query.trim())}&sort=receipts`,
          { signal: controller.signal },
        );
        if (!r.ok) throw Error("Search is unavailable. Please try again.");
        const data = await r.json();
        setResult(data.candidates);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Search failed");
          setResult([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, cycle]);
  const visible =
    query.trim().length >= 2
      ? result.filter((c) => !ids.includes(c.id)).slice(0, 6)
      : [];
  return (
    <div className="compare-picker">
      <label htmlFor="compare-search">Add a candidate to compare</label>
      <div className="picker-input">
        <Search size={18} />
        <input
          id="compare-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResult([]);
            setError("");
            if (e.target.value.trim().length < 2) setLoading(false);
          }}
          placeholder="Search by name or FEC ID…"
        />
      </div>
      <p className="picker-status" role="status">
        {error ||
          (loading
            ? "Searching…"
            : query.length < 2
              ? "Type at least 2 characters. All comparisons use the same reporting cycle."
              : visible.length === 0
                ? "No matching candidates. Try another name."
                : "Select a candidate below.")}
      </p>
      {visible.length > 0 && (
        <ul className="picker-results">
          {visible.map((c) => (
            <li key={c.id}>
              <Link
                href={`/compare?cycle=${cycle}&ids=${[...ids, c.id].join(",")}`}
              >
                <div>
                  <strong>{c.name}</strong>
                  <span>
                    {partyName(c.party)} · {STATES[c.state] || c.state}
                  </span>
                </div>
                <Plus size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
