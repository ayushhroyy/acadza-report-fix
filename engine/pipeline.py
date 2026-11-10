"""
Pipeline — report → fix, assembled from five stages.

  stage 1  group        reports are clustered by questionId (one analysis per
                        question → duplicate reports can never disagree)
  stage 2  guards       deterministic checks (guards.py) — hard facts the LLM
                        must respect; zero tokens
  stage 3  solve        independent derivation per question, comment-blind
                        (solver output in knowledge.py / analysis/, or live LLM)
  stage 4  triage       verdict/repair/evidence/edit/replies, taxonomy-closed
                        (analysis/decisions.json, or live LLM)
  stage 5  guard+route  edit scope validation (editgen.py) and routing
                        (routing.py) — pure code, the safety layer

Output: one row per REPORT (all 44) in results.json; cases additionally carry
guard findings, solver notes and urgency for the console (console/data.js).
"""
import json
import os

import guards
import editgen
import routing

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def run(live=False, data_dir=None):
    data_dir = data_dir or os.path.join(ROOT, "data")
    questions = load_json(os.path.join(data_dir, "questions.json"))
    reports = load_json(os.path.join(data_dir, "reports.json"))
    taxonomy = load_json(os.path.join(data_dir, "taxonomy.json"))
    decisions = load_json(os.path.join(HERE, "analysis", "decisions.json"))
    decisions_by_q = {d["questionId"]: d for d in decisions}

    by_question = {}
    for r in sorted(reports, key=lambda r: r["reportId"]):
        by_question.setdefault(r["questionId"], []).append(r)

    rows, cases = [], []
    for q in questions:
        qid = q["_id"]
        q_reports = by_question.get(qid)
        if not q_reports:
            continue  # unreported questions are swept separately (bonus)

        # stage 2 — guards
        findings = guards.run_all(q, q_reports)

        # stages 3-4 — solver + triage (offline replay of committed analysis,
        # or live LLM calls with the prompts in prompts.py)
        if live:
            from solver import solve_live
            from triage import triage_live
            solver_note = solve_live(q)
            decision = triage_live(q, q_reports, findings, solver_note, taxonomy)
        else:
            from knowledge import SOLVER_NOTES
            solver_note = SOLVER_NOTES.get(qid)
            decision = decisions_by_q[qid]
            assert solver_note is not None or qid in decisions_by_q, f"no analysis for {qid}"

        # stage 5 — edit guard + routing (always code)
        repair_spec = taxonomy["repairs"].get(decision["repair"])
        edit, fail = None, None
        if decision.get("edit"):
            try:
                edit = editgen.validate_edit(decision["edit"], q, repair_spec)
            except editgen.EditRejected as e:
                fail = str(e)
                edit = None
        route, route_reason = routing.route_case(
            decision, repair_spec, edit_ok=edit is not None, edit_fail_reason=fail)

        case = {
            "questionId": qid,
            "question": q,
            "reports": q_reports,
            "findings": findings,
            "solver": solver_note,
            "decision": decision,
            "edit": edit,
            "edit_fail_reason": fail,
            "route": route,
            "route_reason": route_reason,
            "urgency": routing.urgency_score(decision, len(q_reports), q_reports[0]["reportedAt"]),
        }
        cases.append(case)

        for r in q_reports:
            rows.append({
                "reportId": r["reportId"],
                "questionId": qid,
                "verdict": decision["verdict"],
                "repair": decision["repair"],
                "edit": edit,
                "route": route,
                "confidence": decision["confidence"],
                "evidence": decision["evidence"],
                "student_reply": decision["replies"].get(r["reportId"], ""),
            })

    rows.sort(key=lambda r: r["reportId"])
    return rows, cases
