"""
Routing — turns a validated case into one of:
  auto_apply      engine may write the fix (taxonomy.auto + confidence gate + valid edit)
  faculty_review  defect confirmed, but a human must act
  no_change       nothing to fix in this question's content

The taxonomy's `auto` flag is a CEILING, never a target: auto_apply requires
repair.auto == true AND confidence >= AUTO_CONFIDENCE AND a validated edit AND
no force_route override (used when the edit invents authored content).
"""
AUTO_CONFIDENCE = 0.85

# urgent = affects scoring or solvability NOW; explains the queue order in the console
URGENCY_TIERS = {
    # tier 0 — every student who attempts this is being mis-scored right now
    "answer_key": 0, "unsound": 0, "identical_options": 0,
    # tier 1 — question unusable or invisible where it should be
    "stem_data": 1, "diagram": 1, "option_repair": 1, "wrong_chapter": 1, "syllabus": 1,
    "wrong_question": 1,
    # tier 2 — hygiene; hurts trust, not scores
    "spelling": 2, "noise": 2, "exam_reference": 2, "markup_leak": 2,
    "answer_form": 2, "notation": 2, "solution_fix": 2, "solution_missing": 2,
    "type_mismatch": 1,
}
TIER_WEIGHT = {0: 100, 1: 60, 2: 30}
VERDICT_TIER = {"defect": None, "no_error": 3, "display_issue": 3, "app_issue": 3,
                "language_mode": 3, "already_fixed": 3, "not_actionable": 3}


def route_case(case, repair_spec, edit_ok, edit_fail_reason=None):
    verdict = case["verdict"]
    if verdict != "defect" or not case.get("repair"):
        return "no_change", "verdict is not a content defect"

    if case.get("force_route"):
        return case["force_route"], case.get("force_note", "forced by decision")

    if repair_spec is None or not repair_spec.get("auto"):
        return "faculty_review", f"taxonomy marks repair '{case['repair']}' as human-only"

    if not edit_ok:
        return "faculty_review", f"edit guard rejected: {edit_fail_reason}"

    if case["confidence"] < AUTO_CONFIDENCE:
        return "faculty_review", f"confidence {case['confidence']:.2f} < {AUTO_CONFIDENCE} gate"

    return "auto_apply", "repair.auto=true, validated surgical edit, confidence above gate"


def urgency_score(case, n_reports, first_report_iso):
    """Higher = closer to the top. Faculty see this number and its breakdown.

    mis-scoring (100) > unusable (60) > hygiene (30); then +15 per extra voice
    (corroboration raises stakes), +1 per day of age, capped at 7 (a broken
    question hurting students for longer should not lose to a fresh one).
    """
    repair = case.get("repair")
    base_tier = URGENCY_TIERS.get(repair, VERDICT_TIER.get(case["verdict"], 3))
    base = TIER_WEIGHT.get(base_tier, 10)
    age = max(0, min(7, (20261109 - int(first_report_iso[:10].replace("-", "")))))  # data window ends 2026-11-09
    return base + 15 * (n_reports - 1) + age
