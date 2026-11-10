"""
Solver step (live mode). Offline mode replays knowledge.py.

The solver call is deliberately comment-blind: it sees only the question.
"""
import json

from llm import chat_json
from prompts import SOLVER_SYSTEM


def solve_live(question):
    body = question[question["questionType"]]
    user = json.dumps({
        "questionType": question["questionType"],
        "subject": question.get("subject"), "chapter": question.get("chapter"),
        "question": body.get("question"), "answer": body.get("answer"),
        "solution": body.get("solution"),
        "quesImages": body.get("quesImages"), "solutionImages": body.get("solutionImages"),
    }, ensure_ascii=False)
    return chat_json(SOLVER_SYSTEM, user, temperature=0.0)
