# Reported employer and occupation data

`scripts/refresh-affiliations.py` imports the FEC's complete published **Contributions by individuals** bulk file for each selected two-year period. It checks every financial candidate in WhoPaidWho against the same matching and transaction rules. The resulting tables describe personal contributions grouped by the affiliation text disclosed on the records. They are not corporate contributions, company endorsements, verified employment histories, or a corruption score.

## Primary sources

- [FEC individual-contribution file definition](https://www.fec.gov/campaign-finance-data/contributions-individuals-file-description/): the file is a **subset** of itemized contributions; since 2015, its inclusion threshold generally uses cumulative giving over $200. A row in this file need not itself be over $200. The FEC specifically directs users of this bulk file to include memo items.
- [FEC transaction types](https://www.fec.gov/campaign-finance-data/transaction-type-code-descriptions/): identifies candidate receipts, intermediary activity, self-financing, refunds and other transaction categories.
- [FEC committee registry](https://www.fec.gov/campaign-finance-data/committee-master-file-description/) and [candidate/committee linkages](https://www.fec.gov/campaign-finance-data/candidate-committee-linkage-file-description/): link principal and authorized committees to candidate IDs.
- [FEC individual-contribution reporting](https://www.fec.gov/help-candidates-and-committees/filing-reports/individual-contributions/): explains employer/occupation disclosures and itemization.
- [FEC earmarked-contribution reporting](https://www.fec.gov/updates/earmarked-contributions/): explains why the recipient's personal-contribution records and the intermediary's records cannot be added together as separate donations.

## Reproduce

```sh
python3 scripts/refresh-affiliations.py --cycles 2024 2026
python3 -m unittest discover -s tests -p 'affiliations_import_test.py'
```

Pass `--force` to download new snapshots. Otherwise the SHA-256-validated local analytical cache is reused when it covers all requested committees. A stricter mapping may reuse a superset of cached committees; records from removed committees are skipped. The source archives are several gigabytes. The importer streams and decompresses them without saving the archives, which reduces disk requirements. Only `itcont.txt` is processed: date-partitioned copies elsewhere in the same archive are ignored. The importer verifies its CRC and uncompressed length, the HTTP download length, and records SHA-256 hashes of both the archive and the main member.

The ignored `.cache/affiliations/` cache contains only analytical fields needed to reproduce the aggregation. Contributor names, cities, states, ZIP codes and street addresses are not copied into that cache or the shipped snapshots.

## Inclusion and grouping

1. Start from each cycle's financial candidate IDs. Use only principal/authorized committee links (`P`/`A`) from the saved candidate record, same-cycle committee registry and same-cycle linkage file. A committee pointing to multiple candidate IDs is excluded, including presidential IDs outside the app and two office-specific IDs for the same person; the importer does not guess which profile should receive its transactions. These are committee-based amounts: a committee can retain receipts from a candidate's earlier campaign for a different office after its registered office changes. The current bulk registry does not preserve a complete dated history of those authorizations.
2. Require an explicit individual entity type (`IND`) and a direct or earmarked receipt type (`15` or `15E`). Unidentified entities, LLCs/partnerships, candidate self-contributions (`15C`), intermediary receipts and pass-through records (`15I`, `15T`, `24I`, `24T`), refunds (`22Y`), and other transaction types do not enter the affiliation tables. Refunds remain in the existing campaign summary, separately.
3. Preserve signed adjustments on included receipt records. `positiveAmount` and `negativeAmount` are shown separately; their sum is `amount`. This is not a net-of-all-refunds fundraising measure. Memo rows are retained under the FEC bulk-file guidance; a conduit committee's forwarding record is not counted a second time.
4. Require a valid transaction date inside the two-year period and no later than the retrieval date. Invalid, out-of-period and future-dated records are counted as exclusions instead of silently assigned to a period.
5. Normalize case and whitespace only. Do not merge corporate families, spelling variants or subsidiaries, and do not classify an individual as a corporate executive or registered lobbyist from a guessed association. Employer and occupation are independent views of the **same** contributions; their totals must not be added together.
6. Treat blank or explicitly requested/unreported affiliation text as missing information. `RETIRED`, `NOT EMPLOYED`, `SELF EMPLOYED` and similar disclosed answers remain visible as reported; they are not companies.
7. Publish the top 20 disclosed labels by signed amount for each view. The remaining labels have an explicit remainder amount; missing information has its own amount. Each full view reconciles to the included amount. Counts are transaction records, not unique people.

## Limits and interpretation

These affiliation totals cover the eligible published itemized subset, not all individual contributions. Joint-fundraising attribution memos (`15J`) are absent from the legacy INDIV file. The live OpenFEC employer/occupation aggregates can include those records and therefore have a different scope. Our included signed totals must not be divided by total campaign receipts and described as a corporate-funding percentage. Unitemized contributions have no employer/occupation breakdown here; neither unitemized nor missing information is evidence of grassroots status, concealed wrongdoing, or dark money.

Transaction dates are the earliest/latest **included transaction dates**, not the campaign's complete reporting coverage. The archive's `Last-Modified` time and download time are both recorded. A historical-cycle archive can be older than the current campaign summary or the live FEC website.

`SUB_ID` is the FEC's unique source-row identifier. Duplicate source rows are removed. `TRAN_ID` is unique only within a committee's report; the importer does not collapse identical transaction IDs across reports or treat `AMNDT_IND=A` as evidence that a row should be removed. Original and amendment-labelled records can both be valid parts of the FEC's published subset. This release consumes the published bulk extract; it does not reconstruct every original electronic filing or represent its amounts as a fully reconciled accounting ledger.

### September 23, 2026 release checks

The archive contained 58,208,756 source records for 2024 and 32,034,987 for 2026. Source archive update times were March 8, 2026 (2024 cycle) and September 20, 2026 (2026 cycle); both were retrieved September 23. All rows in the main member were examined, with the same rules applied to every covered candidate.

For an independent amendment check, every published bulk record from four committees was compared to the FEC's report-version metadata. The samples were Ossoff (`C00718866`, 2026; 377,670 rows), Johnson (`C00608695`, 2026; 608,102), Ocasio-Cortez (`C00639591`, 2024; 116,454), and Scott (`C00540302`, 2024; 131,771). No records from a superseded report were present. Scott's two additional Form 3P files were separately checked against the filings endpoint; they were accepted versions, illustrating the mixed-office committee-history limitation above. These are source-validation samples, not special candidate matching rules or a guarantee about every published record.

The checks use the official `/v1/reports/house-senate/` and `/v1/filings/` endpoints documented by [OpenFEC](https://api.open.fec.gov/developers/). Unit tests cover archive-member duplication, signed adjustments, memo/earmark retention, intermediary exclusion, missing affiliations, exact reconciliation, invalid/future dates, and ambiguous committee links including candidates outside the app.

## Outside groups and original donors

An employer entry is not an upstream funding link to a Super PAC or nonprofit. That requires recipient-side receipts for the outside spender and, where documented, additional organizational filings. A nonprofit's transfer can be disclosed while the nonprofit's original donors remain undisclosed. A transfer into a group cannot automatically be allocated to a particular candidate's independent expenditure. No 501(c)(4) status, donor transparency classification, or candidate-specific dark-money amount is inferred by this importer.
