"""
Triage step (live mode). Offline mode replays analysis/decisions.json.

Triage sees everything the solver saw PLUS the reports and the guard findings —
but the solver's independence is preserved because the solver never saw the
comments.
"""
import json

from llm import chat_json
from prompts import triage_system
from knowledge import SOLVER_NOTES  # offline solver notes are still attached in live mode


def triage_live(question, reports, findings, solver_note, taxonomy):
    system = triage_system(sorted(taxonomy["verdicts"]), sorted(taxonomy["repairs"]))
    body = question[question["questionType"]]
    user = json.dumps({
        "questionId": question["_id"],
        "questionType": question["questionType"],
        "subject": question.get("subject"), "chapter": question.get("chapter"),
        "question": body.get("question"), "answer": body.get("answer"),
        "solution": body.get("solution"),
        "errorHistory": question.get("errorHistory"),
        "reports": [{"reportId": r["reportId"], "source": r["source"],
                     "reportedAt": r["reportedAt"], "comment": r["comment"]} for r in reports],
        "guard_findings": findings,
        "independent_solve": solver_note or SOLVER_NOTES.get(question["_id"]),
    }, ensure_ascii=False)
    decision = chat_json(system, user, temperature=0.1)
    decision.setdefault("replies", {})
    return decision
