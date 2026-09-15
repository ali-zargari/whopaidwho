import Link from "next/link";
import { ArrowUpRight, FileSearch } from "lucide-react";
import type { accountabilitySummary } from "@/lib/accountability";
export default function AccountabilityBadge({
  candidateId,
  cycle,
  summary,
}: {
  candidateId: string;
  cycle: number;
  summary: ReturnType<typeof accountabilitySummary>;
}) {
  return (
    <Link
      className={`accountability-badge ${summary.tone}`}
      href={`/candidate/${candidateId}?cycle=${cycle}#accountability`}
      prefetch={false}
    >
      <FileSearch size={14} />
      <span>
        {summary.label}
        <small>{summary.detail}</small>
      </span>
      <ArrowUpRight size={13} />
    </Link>
  );
}
