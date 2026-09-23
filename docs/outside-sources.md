# Outside-spending sources and import rules

## What the snapshot measures

The two-year FEC reporting-cycle total of **processed periodic independent expenditures**, separately for support and opposition, by candidate and spending committee/filer. These dollars do not enter the candidate's campaign account and must not be added to direct contributions or presented as campaign receipts.

The importer applies identical rules to every candidate. It includes all financial-profile IDs and current-race registration IDs in the local cycle snapshot, plus additional congressional candidate IDs returned by the source. Absence of a source row is labeled `no-reported-spending`; an ID outside the snapshot is **not indexed**, not zero.

## Authoritative endpoints

- [FEC aggregate by candidate and spender](https://api.open.fec.gov/v1/schedules/schedule_e/by_candidate/): `cycle=2024` or `2026`, `election_full=false`, `per_page=100`, `sort=idx`.
- [FEC candidate support/oppose totals](https://api.open.fec.gov/v1/schedules/schedule_e/totals/by_candidate/): same cycle, `election_full=false`, stable candidate ID and support/oppose ordering.
- [OpenFEC documentation](https://api.open.fec.gov/developers/) explicitly explains that candidate aggregates exclude 24- and 48-hour reports to avoid double-counting. These notices are also reported in periodic filings.
- [FEC aggregation implementation, pinned source revision](https://github.com/fecgov/openFEC/blob/65d9c7d0535a6c9b0e26a8215853f8bb77ed7aac/data/migrations/V0119__update_sched_c_d_e_f_and_related_tables.sql#L39): the view unions `disclosure.fec_fitem_sched_e` with `disclosure.fec_fitem_f57`, includes noncommittee Form 5 spending, and excludes memo-coded Schedule E items before aggregation. The app consumes the FEC's processed figures; it does not invent a separate amendment-merging rule for unprocessed notices.

`election_full=false` is deliberate: the UI's 2026 cycle means the 2025–2026 reporting period, not a Senate candidate's six-year election period. Net adjustments, including negative figures, are preserved.

### Supporting name and registration sources

The official cycle committee master (`cm24.zip`, `cm26.zip`) supplies committee type, organization type and connected-organization text. The official rapid-notice CSV supplies an unambiguous spender name only when a name is missing elsewhere. **No amount from this CSV enters a total.** Its [FEC documentation](https://www.fec.gov/campaign-finance-data/independent-expenditures-file-description/) warns that originals and amendments coexist.

## Freshness and coverage limits

- The retrieval timestamp is not a common report coverage date. Aggregate endpoints do not expose a common cutoff; `coverageEnd` is deliberately `null`.
- The current cycle can lag recent advertisements while periodic reports are filed and processed. Rapid notices are not silently added to periodic totals.
- Reported independent expenditures are not all political spending. Unreported spending and issue ads outside FEC reporting are not measured.
- Some source rows have an unresolved candidate or stance. These are excluded from candidate attribution and retained with their amounts in `audit.excludedUnresolvedRows`; the audit exposes their count and net amount. They must not be guessed from a name or silently assigned to a race.
- Candidate/filer labels are supplied by FEC source data. A Form 5 filer is not automatically a 501(c)(4), and a Super PAC is not automatically a dark-money organization. A known spender does not identify the original source of its funds.
- No candidate is given an honesty, corruption, coordination or legality score from these figures.

## Reproducible refresh

```sh
FEC_API_KEY=... python3 scripts/refresh-outside.py --cycles 2024 2026
```

An existing `FEC_API_KEY` in `.env.local` is also supported. Credentials never enter URLs stored in provenance, logs, snapshots or the cache. Alternatively, public website data access is available through the configuration explicitly published by FEC for that client:

```sh
python3 scripts/refresh-outside.py --public-website --cycles 2024 2026
```

This mode loads the published public client key into memory and uses the website's standard request headers. It makes serial requests with a short delay. A rate limit ends the import; the importer does not rotate credentials or loop around a limit. Cached responses expire after six hours. `--fresh` ignores the cache. A snapshot's `downloadStartedAt` and `downloadedAt` expose the actual interval of cached/source retrieval.

Every page's public URL, SHA-256, retrieval timestamp and byte count is recorded. All pages must have exact and stable counts, the first page is rechecked, all valid candidate/spender/stance keys must be unique, and spender totals must reconcile to the separate FEC candidate-total endpoint down to the cent. Every requested cycle validates before any snapshot is replaced. This checks source consistency; it does not independently audit a filer's underlying claims.

### Snapshot validation on September 23, 2026

Every attributed candidate/stance total reconciled to the FEC total endpoint in both cycles. Two additional checks queried the processed itemized endpoint with `is_notice=false` and `most_recent=true`, confirming that Form 5 records actually enter these totals:

| Cycle | Candidate ID | Filer | Itemized amount / aggregate | Filing image |
| --- | --- | --- | --- | --- |
| 2024 | H0CA22102 | Indivisible Project Inc. (C90017492) | $718.18 support; one F5 transaction | [FEC image 202401309600650208](https://docquery.fec.gov/cgi-bin/fecimg/?202401309600650208) |
| 2026 | H4AL06098 | American Chemistry Council, Inc. (C90011578) | $131,018 support; one F5 transaction | [FEC image 202607149874973279](https://docquery.fec.gov/cgi-bin/fecimg/?202607149874973279) |

The snapshots contain reported spending for 912 congressional candidate IDs in 2024 and 781 in 2026. The uniform zero/no-record checks cover 3,741 and 4,229 congressional IDs respectively, including local finance profiles, race registrations, and additional source IDs. The all-federal source also has 322 unresolved rows in 2024 and 105 in 2026; these are audited, not guessed into congressional totals.

```sh
python3 -m unittest discover -s tests -p 'outside_import_test.py'
```
