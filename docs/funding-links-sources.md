# Upstream funding receipts and nonprofit context

## What the snapshot means

The importer considers every outside spender in the cycle's `outside-YYYY.json` snapshot. It queries the FEC's processed Schedule A for receipt records of **$1 million or more per receipt**, then keeps affirmatively coded organizations and committees, excluding memo records. This is one uniform size threshold across candidates, parties, organizations and cycles. It is a bounded view of large receipts, not a complete donor ranking.

`amount` is the sum of the imported positive receipt records for the displayed source and receipt kind. It is **not** a donor's complete cycle total, a net contribution total, an original donor total, or money attributable to any candidate. Contributions, affiliated transfers, loans, loan repayments, refunds/offsets and other receipts stay in separate groups. In particular, a Form 3X line 17 receipt is labeled `other-receipt`, not converted into a campaign contribution. Recipient spending and these receipts must never be added together.

Every imported spender has an entry. `no-qualifying-receipts` means none survived this bounded query, not that the spender has no donors. A failed or truncated import is rejected by default. `--allow-partial` explicitly permits `partial-query`, where empty entries are `unavailable`; partial entries must never appear as zero, exhaustive donor lists, or complete rankings.

## FEC sources and amendment handling

- [OpenFEC API documentation](https://api.open.fec.gov/developers/): `/v1/schedules/schedule_a/`, `two_year_transaction_period=YYYY`, `min_amount=1000000`, `sort=-contribution_receipt_amount`, `per_page=100`.
- [About receipts data](https://www.fec.gov/campaign-finance-data/about-campaign-finance-data/about-receipts-data/): Schedule A covers contributions and other receipts; form and line determine their meaning.
- [FEC methodology](https://www.fec.gov/campaign-finance-data/about-campaign-finance-data/methodology/): the processed API supplies the FEC's processed record view. This importer does not try to resolve amendments by choosing the largest filing number from raw data.
- [Raw OTHER dictionary](https://www.fec.gov/campaign-finance-data/any-transaction-one-committee-another-file-description/): raw files contain amended versions and memo records. They are not summed by this importer.

Schedule A uses keyset pagination, so all returned `last_indexes` are forwarded. Unique FEC `sub_id` values are required. Exact counts must agree across pages. Amounts are accumulated as decimal values. Source response hashes, fetch timestamps and public query URLs are saved with the snapshot; API credentials are neither printed nor persisted. Every displayed receipt also links to its original filing image when supplied by the FEC.

Independent-expenditure filers that are not political committees have a separate processed receipt endpoint: `/v1/schedules/schedule_a_form5/`, with `contribution_amount` and `contributor_type` fields. The importer queries it using the same cycle and per-receipt threshold. Its current response omits the filer ID and exposes a signatory name, so recipient identity is resolved through `/v1/filings/?file_number=...` and requires both the exact file number and the receipt's `link_id` matching the filing's `sub_id`. The signatory name is never used as an organization match. The original [FEC Form 5 implementation](https://github.com/fecgov/openFEC/blob/develop/webservices/resources/form_56.py) and [model](https://github.com/fecgov/openFEC/blob/develop/webservices/common/models/itemized.py) define these fields. Form 5 contributions use their distinct processed record schema, which has no Schedule A memo flag. Original filing-image links and recipient-resolution evidence are retained for each such record.

Both receipt endpoints must complete, and all qualifying organization rows in Form 5 must resolve, before the default import can replace a snapshot. `coverage.scheduleA` and `coverage.form5` separately report counts and status. An unqueried Form 5 source cannot silently become a no-qualifying-receipts status.

`is_individual` is a transaction-code classification; it can include receipts from organizations. The importer deliberately does not filter on that flag, and instead requires an affirmative `entity_type` of ORG, COM, PAC, PTY or CCM. Individual names and addresses are not imported into the public snapshot. Transactions reported on loans and transfer lines are retained with those explicit labels.

## IRS verification and the original-donor limit

The [IRS Exempt Organizations Business Master File](https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf) was posted September 8, 2026 when checked September 23, 2026. Official state CSV files use paths such as [Virginia BMF](https://www.irs.gov/pub/irs-soi/eo_va.csv). The importer joins only an exact full organization name after case/punctuation normalization, identical state, identical first five ZIP digits, and a unique EIN. It never removes legal suffixes or other meaningful words and never uses fuzzy matches or political affiliations. Unmatched or ambiguous names remain unclassified.

`nonprofit-source` means an IRS-listed organization matched using that documented rule. The entry includes EIN, IRS name, subsection, status code, matching method and source URL. This is current registry context, not proof of tax status on the historical receipt date. IRS registry coverage is not universal; absence is not evidence of taxable status.

The [IRS contributor disclosure explanation](https://www.irs.gov/charities-non-profits/public-disclosure-and-availability-of-exempt-organizations-returns-and-applications-contributors-identities-not-subject-to-disclosure) says nonprofit contributor identities generally need not appear in public annual returns, with exceptions including private foundations and section 527 political organizations. A nonprofit classification alone does not establish whether its original donors were disclosed elsewhere. Therefore `originalDonorVisibility` remains `not-determined`; no imported amount is labeled dark money.

[IRS Form 990 downloads](https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads) can support future grant tracing. Grants disclosed by a granting organization on its public return can establish a dated organization-to-organization connection. They cannot establish that the grant financed a particular political receipt or candidate expenditure. This importer does not claim to trace those grants or original donors.

## Other source access checked September 23, 2026

- [OpenSecrets API notice](https://www.opensecrets.org/open-data/api) explicitly says its API offerings ended April 15, 2025 and directs custom data inquiries to its commercial contact. The [bulk download page](https://www.opensecrets.org/open-data/bulk-data) returned HTTP 403 in this check, so current download access and licensing are unverified. No OpenSecrets data is included.
- [ProPublica Itemizer](https://projects.propublica.org/itemizer/) remains accessible, but sampled 2026 committee pages showed 2025 coverage dates, including [DCCC](https://projects.propublica.org/itemizer/committee/C00000935/2026) and [Andy Barr for Congress](https://projects.propublica.org/itemizer/committee/C00467571/2026). These samples do not establish a global shutdown date; they do make freshness unsuitable to assume.
- [Historical ProPublica Campaign Finance API documentation](https://projects.propublica.org/api-docs/campaign-finance/) still exists. Its key-signup destination redirects to the [Data Store Archive](https://projects.propublica.org/datastore/), which explicitly says it is no longer updated. Current API availability and new-key provisioning were not verified. Historical refresh-frequency promises are not treated as current evidence.

## Refresh

The September 23, 2026 snapshot contains complete threshold queries: Schedule A has 2,939 source rows for 2024 and 1,118 for 2026; Form 5 has two rows for 2024 and one for 2026. Each Form 5 cycle includes one organization receipt resolved to its FEC filer ID; the other 2024 row is an individual and is excluded. After filtering, 548 displayed receipt records connect 116 of 811 spenders in 2024; 367 records connect 100 of 567 spenders in 2026. Strict IRS matching identifies 33 grouped nonprofit connections in 2024 and 30 in 2026. These counts describe this threshold-based dataset; they are not totals for all political fundraising.

```sh
python3 scripts/refresh-funding-links.py --cycles 2024 2026
python3 -m unittest discover -s tests -p funding_links_import_test.py
```

Set `FEC_API_KEY` for a project-owned key. The default demo credential is rate limited; a 429 stops fetching and preserves cached pages for a later resume. Cached sources expire after six hours during online imports. `--fresh` bypasses the cache immediately; `--offline` explicitly permits older checksummed sources, preserving their actual fetch timestamps. These two flags cannot be combined. The outside-spending snapshots must exist first. `--max-pages` bounds exploratory requests and implies partial coverage unless the complete result fits within the limit.

All requested cycles finish source loading, validation and JSON serialization before any published snapshot changes. Complete JSON files are staged under unique adjacent temporary names, flushed, then published with atomic file replacement. Readers see a complete old or new file, never an in-progress JSON write. Several file replacements are not a filesystem transaction, but a later cycle's validation or serialization failure leaves all earlier published cycles unchanged. `downloadedAt` comes from the actual source timestamps; `builtAt` separately records when the snapshot was assembled.

`--public-website` uses the FEC's explicitly published public website client configuration through the shared outside-spending source client. The value stays in memory, the importer fetches serially, and a rate-limit response stops the import. It does not rotate credentials or retry through another route on a 429.
