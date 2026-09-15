import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="page-shell">
      <div className="empty-state">
        <span className="eyebrow">404 · RECORD NOT FOUND</span>
        <h1>That page isn’t in the public record.</h1>
        <p>
          The candidate may not have financial records for this cycle. Try
          another reporting period in the explorer.
        </p>
        <Link href="/" className="primary-button">
          Back to the explorer
        </Link>
      </div>
    </main>
  );
}
