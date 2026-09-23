"""Regression tests for the independent-expenditure importer, without network."""
import importlib.util
from pathlib import Path
import unittest


SPEC = importlib.util.spec_from_file_location("outside_import", Path(__file__).resolve().parents[1] / "scripts/refresh-outside.py")
OUTSIDE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OUTSIDE)

HOUSE = "H0CA00001"
SENATE = "S0NY00001"
NEW = "H6TX00001"


def aggregate(candidate=HOUSE, spender="C00000001", stance="S", amount=125.25, count=1, cycle=2026):
    return {"candidate_id": candidate, "committee_id": spender, "committee_name": "EXAMPLE PAC", "support_oppose_indicator": stance, "total": amount, "count": count, "cycle": cycle}


def total(candidate=HOUSE, stance="S", amount=125.25, cycle=2026):
    return {"candidate_id": candidate, "support_oppose_indicator": stance, "total": amount, "cycle": cycle}


class OutsideImportTests(unittest.TestCase):
    def test_support_and_opposition_remain_separate_and_reconcile(self):
        rows = [aggregate(), aggregate(spender="C00000002", amount=14.75), aggregate(stance="O", amount=90)]
        candidates, audit = OUTSIDE.build_candidates(2026, rows, [total(amount=140), total(stance="O", amount=90)], {HOUSE})
        self.assertEqual(candidates[HOUSE]["support"], 140)
        self.assertEqual(candidates[HOUSE]["oppose"], 90)
        self.assertEqual(sum(row["support"] for row in candidates[HOUSE]["spenders"]), 140)
        self.assertEqual(audit["candidateStancesReconciled"], 2)

    def test_checked_candidates_without_rows_have_explicit_no_report_status(self):
        candidates, _ = OUTSIDE.build_candidates(2026, [], [], {HOUSE, NEW})
        self.assertEqual(candidates[NEW], {"support": 0, "oppose": 0, "status": "no-reported-spending", "spenders": []})
        self.assertNotIn(SENATE, candidates)

    def test_source_only_congressional_candidates_are_retained(self):
        candidates, _ = OUTSIDE.build_candidates(2026, [aggregate(candidate=NEW)], [total(candidate=NEW)], {HOUSE})
        self.assertEqual(candidates[NEW]["support"], 125.25)
        self.assertEqual(candidates[NEW]["status"], "reported")

    def test_duplicate_spender_row_is_rejected_instead_of_double_counted(self):
        with self.assertRaisesRegex(ValueError, "Duplicate aggregate"):
            OUTSIDE.build_candidates(2026, [aggregate(), aggregate()], [total(amount=250.50)], {HOUSE})

    def test_missing_page_or_shifted_row_fails_candidate_reconciliation(self):
        with self.assertRaisesRegex(ValueError, "fail reconciliation"):
            OUTSIDE.build_candidates(2026, [aggregate()], [total(amount=250)], {HOUSE})

    def test_missing_authoritative_candidate_total_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing from FEC totals"):
            OUTSIDE.build_candidates(2026, [aggregate()], [], {HOUSE})

    def test_duplicate_candidate_total_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate FEC candidate total"):
            OUTSIDE.build_candidates(2026, [aggregate()], [total(), total()], {HOUSE})

    def test_negative_adjustments_are_preserved_not_silently_clamped(self):
        candidates, _ = OUTSIDE.build_candidates(2026, [aggregate(amount=-12.50)], [total(amount=-12.50)], {HOUSE})
        self.assertEqual(candidates[HOUSE]["support"], -12.50)
        self.assertEqual(candidates[HOUSE]["status"], "reported")

    def test_unknown_stance_is_audited_and_never_guessed_as_support(self):
        candidates, audit = OUTSIDE.build_candidates(2026, [aggregate(stance=None, amount=900)], [], {HOUSE})
        self.assertEqual(candidates[HOUSE]["support"], 0)
        self.assertEqual(audit["excludedUnresolvedRows"][0]["amount"], 900)

    def test_distinct_source_rows_with_null_candidate_stay_in_unresolved_audit(self):
        # OpenFEC's outer join can mask different underlying IDs as null. They
        # cannot be attributed or deduplicated using that lost candidate ID.
        candidates, audit = OUTSIDE.build_candidates(2026, [aggregate(candidate=None), aggregate(candidate=None, amount=50)], [], {HOUSE})
        self.assertEqual(audit["unresolvedRowCount"], 2)
        self.assertEqual(audit["unresolvedNetAmount"], 175.25)
        self.assertEqual(candidates[HOUSE]["support"], 0)

    def test_missing_spender_is_visible_unknown_and_still_in_totals(self):
        row = aggregate(spender=None)
        row["committee_name"] = None
        candidates, _ = OUTSIDE.build_candidates(2026, [row], [total()], {HOUSE})
        self.assertEqual(candidates[HOUSE]["spenders"][0]["id"], "UNKNOWN")
        self.assertEqual(candidates[HOUSE]["spenders"][0]["name"], "Unidentified filer")

    def test_wrong_cycle_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "incorrect cycle"):
            OUTSIDE.build_candidates(2026, [aggregate(cycle=2024)], [], {HOUSE})

    def test_non_finite_missing_and_subcent_amounts_are_rejected(self):
        for value in [None, "NaN", "Infinity", "0.001", "bad"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                OUTSIDE.money(value)
        self.assertEqual(OUTSIDE.money("90071992547409.99"), 9007199254740999)

    def test_notice_names_never_sum_duplicated_or_amended_notice_amounts(self):
        raw = b"spe_id,spe_nam,exp_amo,amndt_ind\nC90000001,NONCOMMITTEE FILER,900000,N\nC90000001,NONCOMMITTEE FILER,900000,A\nC90000002,OLD NAME,4,N\nC90000002,NEW NAME,5,A\n"
        self.assertEqual(OUTSIDE.notice_names(raw), {"C90000001": "NONCOMMITTEE FILER"})

    def test_exact_complete_pagination_is_required(self):
        pagination = {"count": 201, "pages": 3, "page": 2, "per_page": 100, "is_count_exact": True}
        self.assertEqual(OUTSIDE.validate_pagination(pagination, 2), (201, 3))
        for changed in [{"is_count_exact": False}, {"pages": 2}, {"page": 1}, {"count": None}]:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                OUTSIDE.validate_pagination({**pagination, **changed}, 2)


if __name__ == "__main__":
    unittest.main()
