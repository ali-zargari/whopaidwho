"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main id="main" className="page-shell">
      <div className="empty-state">
        <h1>We couldn’t load this page.</h1>
        <p>
          Please try again. The original records are also available at FEC.gov.
        </p>
        <button className="primary-button" onClick={() => retry()}>
          Try again
        </button>
      </div>
    </main>
  );
}
