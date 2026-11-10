"""
Edit guard — the safety layer between "the LLM proposes" and "the system writes".

An edit is admitted only if ALL hold:
  1. field ∈ repair.fields for the chosen repair (taxonomy.json is the contract)
  2. for `question`/`solution`: `find` occurs EXACTLY ONCE in the stored field
     (surgical, not a rewrite) and `replace` differs from `find`
  3. for `answer`: find must equal the currently stored answer (JSON-serialised
     for arrays), so we can never "change" an answer we misread
  4. repairs with fields == [] can never carry an edit (faculty-only repairs)

Anything failing here is demoted to faculty_review with the failure recorded.
"""
import json


class EditRejected(Exception):
    pass


def validate_edit(edit, question, repair_spec):
    """Raise EditRejected with a reason, or return a normalised edit."""
    if repair_spec is None:
        raise EditRejected("no repair chosen")
    allowed = repair_spec.get("fields", [])
    if not edit:
        if allowed:
            # a repair that may touch fields chose not to — fine (advice-only)
            return None
        return None
    if not allowed:
        raise EditRejected(f"repair '{repair_spec}' allows no writable fields; faculty-only")

    field = edit.get("field")
    if field not in allowed:
        raise EditRejected(f"field '{field}' outside repair scope {allowed}")

    body = question[question["questionType"]]

    if field in ("question", "solution"):
        hay = body.get(field, "")
        n = hay.count(edit["find"])
        if n != 1:
            raise EditRejected(f"anchor occurs {n}× (must be exactly 1) in stored {field}")
        if edit["find"] == edit["replace"]:
            raise EditRejected("replace is identical to find")
        return {"field": field, "find": edit["find"], "replace": edit["replace"]}

    if field == "answer":
        current = body.get("answer")
        # canonical serialisation for array answers
        cur_json = json.dumps(current, ensure_ascii=False)
        if edit["find"] != current and edit["find"] != cur_json:
            raise EditRejected(f"find {edit['find']!r} does not match stored answer {current!r}")
        return {"field": "answer", "find": edit["find"], "replace": edit["replace"]}

    if field == "questionType":
        # only ever reachable via type_mismatch; whitelisted values
        if edit["replace"] not in ("scq", "mcq", "integerQuestion"):
            raise EditRejected("questionType replace not in whitelist")
        return edit

    raise EditRejected(f"unknown field '{field}'")


def apply_edit(question, edit):
    """Return a copy of the question body with the edit applied (for diffing)."""
    body = json.loads(json.dumps(question[question["questionType"]]))
    if not edit:
        return body
    f = edit["field"]
    if f in ("question", "solution"):
        body[f] = body[f].replace(edit["find"], edit["replace"], 1)
    elif f == "answer":
        body["answer"] = edit["replace"]
        if isinstance(edit["replace"], str) and edit["replace"].startswith("["):
            try:
                body["answer"] = json.loads(edit["replace"])
            except ValueError:
                pass
    return body
