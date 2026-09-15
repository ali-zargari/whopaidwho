import { Suspense } from "react";
import Navigation from "@/components/Navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MoveRight } from "lucide-react";
import "./globals.css";
import CompareProvider from "@/components/CompareProvider";
export const metadata: Metadata = {
  metadataBase: new URL("https://whopaidwho.com"),
  title: {
    default: "Who Paid Who — Follow campaign money",
    template: "%s | Who Paid Who",
  },
  description:
    "Explore U.S. congressional campaign finance. Search candidates, compare funding, and follow the public FEC records behind the numbers.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand" aria-label="Who Paid Who home">
              <span className="brand-mark">
                w<MoveRight size={18} />w
              </span>
              <span>
                who paid who<span className="brand-period">.</span>
              </span>
            </Link>
            <Suspense
              fallback={
                <nav aria-label="Main navigation">
                  <Link href="/races">Current races</Link>
                  <Link href="/">Explore</Link>
                  <Link href="/compare">Compare</Link>
                  <Link href="/accountability">Accountability</Link>
                  <Link href="/methodology">Our data</Link>
                </nav>
              }
            >
              <Navigation />
            </Suspense>
            <span className="header-note">PUBLIC RECORDS. OPEN QUESTIONS.</span>
          </div>
        </header>
        <CompareProvider>{children}</CompareProvider>
        <footer className="site-footer">
          <div>
            <Link href="/" className="footer-brand">
              who paid who.
            </Link>
            <span>Public money trails. Independent perspective.</span>
          </div>
          <div>
            <Link href="/methodology">Sources & methodology</Link>
            <a
              href="https://www.fec.gov/data/"
              target="_blank"
              rel="noreferrer"
            >
              FEC.gov <ArrowUpRight size={14} />
            </a>
          </div>
          <p>
            Financial figures come from FEC filings. Accountability records
            identify their sources and outcomes. Contributions alone do not
            establish wrongdoing.
          </p>
        </footer>
      </body>
    </html>
  );
}
