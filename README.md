# Who Paid Who

A campaign finance explorer for U.S. House and Senate candidates, built with Next.js 16 and official Federal Election Commission data.

## What works

- Current and historical two-year reporting cycles, with shareable filters and pagination.
- Search by candidate name, state, or FEC ID; filter office, party, and state.
- Current Races from FEC election registrations, with candidate funding maps across cycles.
- Branded company-connected PAC examples, proportional funding categories, and a table alternative.
- Separate support/oppose outside-spending examples and explicit limits on original-donor visibility.
- Profiles with receipts, contributions, cash, debt, loans, transfers, refunds, and reporting dates.
- Itemized/unitemized individual contributions only where source summaries agree.
- Actual committee-reported transaction examples with original filing links, amendments, and memo notes.
- Compare up to three candidates within one cycle; selections survive searches and pagination.
- Accountability lookup across every imported candidate using the full FEC MUR title index, exact linked committee names, and respondent-level decisions.
- Searchable official enforcement documents, shared-penalty context, and a supplementary collection of sourced investigations and outcomes.
- CSV export of all matching financial summaries, with source and retrieval timestamps.
- Responsive layouts, keyboard navigation, useful empty/error states, and a methodology section.

**No API key, database, or paid data service is needed.** Saved FEC snapshots ship with the application. No financial values are fabricated and no external API is called during a page request.

## Run locally

Requires Node.js 20.9+ (Node 22 recommended) and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. For a production build:

```bash
npm run build
npm start
```

## Refresh the data

Requires Python 3 with a working system certificate store. The downloader uses HTTPS certificate verification; on macOS it can use `/etc/ssl/cert.pem`.

```bash
npm run data:refresh
# Or explicitly select supported FEC periods:
python3 scripts/refresh-data.py --cycles 2024 2026
```

The default is the current reporting cycle and the previous cycle. Odd calendar years map to the following even year (2027 → 2028). Refresh imports new cycles into `src/data/fec/catalog.ts`; there is no hard-coded cycle cap in the interface. If the current cycle has not been imported, the application labels the latest available snapshot and explicitly reports the missing current cycle.

The script downloads and validates all requested sources before replacing saved files. Each file replacement is atomic. A disk/process failure during the final multi-file commit can still require rerunning the refresh. Review the diff, run the checks, and rebuild/redeploy. The application serves immutable snapshots until it is restarted/redeployed; a page view does not trigger a download. Refresh failure from an unpublished future FEC file leaves existing snapshots intact.

Primary sources for each cycle:

- `https://www.fec.gov/files/bulk-downloads/{cycle}/weball{YY}.zip`
- `https://www.fec.gov/files/bulk-downloads/{cycle}/candidate_summary_{cycle}.csv`
- `https://www.fec.gov/files/bulk-downloads/{cycle}/pas2{YY}.zip`
- `https://www.fec.gov/files/bulk-downloads/{cycle}/cm{YY}.zip`
- `https://www.fec.gov/files/bulk-downloads/{cycle}/cn{YY}.zip`

Each snapshot stores the source URL, retrieval timestamp, and SHA-256 checksum. Candidate dates describe filing coverage, not retrieval time. Source files are public FEC datasets; residential contact fields from the candidate-summary CSV are not retained.

### Financial interpretation

The all-candidates file includes financial activity even for candidates not standing for election in that period. This is **not a current officeholder roster**. Candidate IDs can differ by office for the same person; rows are not merged by name.

Receipts are not synonymous with donations. Contributions shown are gross; refunds, loans, and transfers are separate. FEC reports can double-count transfers between a candidate's authorized committees, so reported amounts remain labeled and unadjusted. Funding percentages use total contributions as their denominator. Negative corrections remain signed and are not charted as positive shares.

Committee examples are **individual contributor-side records, not donor totals**. Only 24K/24Z transactions to a registered principal/authorized committee with a matching candidate ID and in-cycle transaction date are included. Exact duplicate source payloads are removed; amendment chains are not reconciled. The latest record from each of up to 12 committees is shown, sorted by transaction date, then filing number and row ID. Memo/amended/negative entries remain labeled. These examples exclude independent expenditures and do not reconcile to candidate-side receipts. Current Races separately shows company-connected PAC examples only where the registry reports organization type C and a connected organization. Logos map verified committee IDs to the company affiliation; personal employee contributions are not attributed to an employer. Outside-spending examples use types 24E (support) and 24A (oppose), preserve the latest record per spender and position, and are never added to campaign contributions. The race graph and outside-spending cards omit latest nonpositive or explicitly voided records without falling back to older positive entries. Raw records remain in the saved data. Neither sample is a complete ledger or a dark-money estimate. Full details are on `/methodology`.

Dictionaries: [all candidates](https://www.fec.gov/campaign-finance-data/all-candidates-file-description/), [candidate summary](https://www.fec.gov/campaign-finance-data/candidate-summary-file-description/), [committee records](https://www.fec.gov/campaign-finance-data/contributions-committees-candidates-file-description/), [transaction types](https://www.fec.gov/campaign-finance-data/transaction-type-code-descriptions/).

## Verify

### Refresh accountability records

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
.venv/bin/python scripts/refresh-accountability.py
```

This scans every page of the public FEC MUR index, including archived entries, and checks **every candidate ID** in the saved financial snapshots under the same rules. CM and CCL bulk files supply principal/authorized committee links. A complete normalized case title must uniquely match a linked committee name, and the case page must confirm that name as a respondent with a disposition. Ambiguous names and candidates linked to the same committee are excluded. There are no fuzzy matches, personal-name matches, or politician-specific exceptions in this importer.

The saved `src/data/accountability/fec-enforcement.json` includes the full title index, source URLs, UTC retrieval dates, hashes, coverage counts, excluded matches, and matched case documents. Schema, pagination, and validation failures preserve the previous snapshot. The optional `--cache-dir /path/to/cache` resumes a failed acquisition using the original source timestamps; omit it for a fresh refresh. A successful refresh still requires checks and deployment before it changes the website.

**This is a title-based lookup, not complete enforcement coverage.** It misses secondary-only respondents, changed/historical names, unstructured archived cases, and personal-name matters. It does not include administrative fines, ADR, every court, or every congressional ethics record. Multiple MUR numbers can describe one proceeding. Identical source penalties for the same respondent group across stages display once; amounts across case numbers are never summed. Only outcome groups containing the matched campaign respondent appear on that candidate’s page. Document dates are not disposition dates.

The supplementary narratives in `src/lib/accountability.ts` require manual primary-source review. They are independent of funding cycles and the automated FEC index; some overlap it. Verify the exact person/committee, latest outcome (including dismissals or clemency), limiting findings, source links, and UTC review date before publishing a change. Missing review is never a clean bill of health, and neither source counts nor funding percentages are corruption scores. The same criteria apply to all candidates. `data:refresh` does not update these narratives or the enforcement index.

### Checks

```bash
npm run check
# With the Python dependencies installed, also verify ingestion:
.venv/bin/python -m unittest discover -s tests -p '*_test.py'
npx playwright install chromium
npm run test:e2e
```

To verify an already-running production build or deployment:

```bash
PLAYWRIGHT_BASE_URL=https://whopaidwho.com npm run test:e2e
```

Tests cover snapshot integrity, source-verified totals, cycle handling, filtering/pagination, signed corrections, CSV escaping, committee-record provenance, race registration scope, company affiliation, outside-spending separation, and browser journeys at desktop/mobile sizes. CI runs checks and browser tests on pushes and pull requests.

## API

- `GET /api/politicians?cycle=2026&q=Sanders&office=senate&state=VT&sort=receipts&page=1` — paginated financial records (24/page), counts and provenance.
- `GET /api/donors?cid=S4VT00033&cycle=2024` — limited committee transaction examples and provenance, not aggregate donor rankings. The legacy route name is retained for compatibility.
- `GET /api/export?cycle=2026&state=CA` — CSV of all matching records, including source and reporting dates.
- `GET /api/health` — snapshot availability and supported cycles.

Unsupported explicit API cycles return 400. Unknown candidates return 404. No credentials, arbitrary upstream URLs, or write operations are accepted.

## Deploy

The application is a standard Next.js Node deployment. `next.config.ts` includes runtime committee JSON files in output tracing and emits standalone output. On Vercel, import the GitHub repository, select Next.js, use Node 22 and the default build command. No environment variables are required. Bind `whopaidwho.com` and `www.whopaidwho.com` to the production deployment, using the exact DNS records supplied by the host. Preserve unrelated MX/TXT records at Porkbun.

For self-hosting, retain `.next/standalone`, `.next/static`, the generated public assets, and the traced `src/data/fec/committee-records-*.json` files. Serve via Node behind an HTTPS reverse proxy.

### Operational limits

This release uses saved public snapshots. It is not a live donor feed, does not resolve every amendment, and does not cover presidential/state/local campaigns or a complete outside-spending ledger. Outside-spending examples do not determine whether original donors are disclosed. No accounts, tracking scripts, or persistent user data are collected by the application. Hosting infrastructure may maintain ordinary request logs. Monitor deployment health and refresh/redeploy datasets as new filings become available.
