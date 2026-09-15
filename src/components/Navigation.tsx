"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
export default function Navigation() {
  const params = useSearchParams();
  const pathname = usePathname();
  const cycle = params.get("cycle");
  const suffix = cycle && /^\d{4}$/.test(cycle) ? `?cycle=${cycle}` : "";
  return (
    <nav aria-label="Main navigation">
      <Link
        href={`/races${suffix}`}
        aria-current={pathname.startsWith("/races") ? "page" : undefined}
      >
        Current races
      </Link>
      <Link
        href={`/${suffix}`}
        aria-current={pathname === "/" ? "page" : undefined}
      >
        Explore
      </Link>
      <Link
        href={`/compare${suffix}`}
        aria-current={pathname === "/compare" ? "page" : undefined}
      >
        Compare
      </Link>
      <Link
        href={`/methodology${suffix}`}
        aria-current={pathname === "/methodology" ? "page" : undefined}
      >
        Our data
        <ArrowUpRight size={14} />
      </Link>
    </nav>
  );
}
