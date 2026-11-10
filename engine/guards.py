"""
Static guards — deterministic checks that run before (and independent of) the
LLM. Their findings are hard signals the triage step must respect: an option
that is verifiably blank is a fact, not an opinion.

Every guard returns a finding dict:
  {code, severity, detail}   severity: 'hard' (machine-verified fact)
                                        | 'soft' (signal for the LLM)
"""
import re
import html as _html

INJECTION_PATTERNS = [
    r"ignore (all|any|previous) instructions",
    r"you are (now )?(the )?admin",
    r"disregard .*(above|previous|instructions)",
    r"system prompt",
    r"act as (an?|the) (admin|bot|developer|system)",
    r"\bAPI[- ]?key\b",
    r"change (the )?answer (to|key)",
]
GIBBERISH_MAX_RATIO = 0.6  # max share of a comment that may be keyboard-mash runs


def visible_text(html_str):
    """Strip tags (keeping MathML content) and unescape entities."""
    s = re.sub(r"<script.*?</script>", " ", html_str, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return _html.unescape(re.sub(r"\s+", " ", s)).strip()


def check_options(question):
    """Blank option / duplicate option / option-count findings."""
    findings = []
    qtype = question["questionType"]
    body = question[qtype]
    html_q = body.get("question", "")
    text = visible_text(html_q)

    # visible option values, e.g. "(A) 100 N" — value runs until the next marker
    pairs = re.findall(r"\(([A-D])\)\s*(.*?)(?=\s*\([A-D]\)\s|$)", text, flags=re.S)
    values = {L: re.sub(r"\s+", " ", v).strip() for L, v in pairs}

    if qtype in ("scq", "mcq"):
        markers = sorted(set(re.findall(r"\(([A-D])\)", text)))
        for letter in markers:
            if not values.get(letter):
                findings.append({
                    "code": "blank_option",
                    "severity": "hard",
                    "detail": f"Option ({letter}) is present but empty in stored HTML; "
                              f"answer key is '{body.get('answer')}'",
                })
        present = [L for L in "ABCD" if L in markers]
        if 0 < len(present) < 4:
            findings.append({
                "code": "option_count",
                "severity": "hard",
                "detail": f"Only {len(present)} options stored ({', '.join(present)}); "
                          f"{qtype.upper()} expects 4",
            })
        for i, a in enumerate(present):
            for b in present[i + 1:]:
                if values.get(a) and values[a].lower() == values.get(b, "").lower():
                    findings.append({
                        "code": "duplicate_options",
                        "severity": "hard",
                        "detail": f"Options ({a}) and ({b}) are identical: '{values[a]}'",
                    })
    return findings


def check_latex_leak(question):
    """Raw LaTeX commands visible as text (\\frac{...}, \\(, \\begin{...})."""
    findings = []
    body = question[question["questionType"]]
    for field in ("question", "solution"):
        text = visible_text(body.get(field, ""))
        hits = re.findall(r"\\[a-zA-Z]+\{[^}]*\}|\\\[|\\\(", text)
        if hits:
            findings.append({
                "code": "latex_leak",
                "severity": "hard",
                "detail": f"{field} renders raw LaTeX as text: {' '.join(sorted(set(hits))[:3])}",
            })
    return findings


def check_exam_tag(question):
    """Source tags like '(NEET 2019)' inside the question text."""
    body = question[question["questionType"]]
    text = visible_text(body.get("question", ""))
    hits = re.findall(r"\((?:NEET|JEE|AIEEE|AIIMS|CBSE|KCET|MHT ?CET)[^)]{0,15}\)", text)
    return [{
        "code": "exam_tag",
        "severity": "hard",
        "detail": f"Source tag '{h}' inside question text",
    } for h in hits]


def check_figure(question):
    """Stem references a figure but none is stored."""
    body = question[question["questionType"]]
    text = visible_text(body.get("question", "")).lower()
    mentions = any(k in text for k in ("shown in figure", "shown in fig", "as shown", "the figure", "in the diagram"))
    has_image = bool(body.get("quesImages"))
    if mentions and not has_image:
        return [{
            "code": "figure_missing",
            "severity": "hard",
            "detail": "Stem references a figure but quesImages is empty",
        }]
    return []


def check_error_history(question):
    """Non-empty errorHistory → verify the reported issue still exists live."""
    hist = question.get("errorHistory") or []
    if not hist:
        return []
    return [{
        "code": "has_error_history",
        "severity": "soft",
        "detail": f"{len(hist)} prior fix(es): " + "; ".join(h.get("note", "")[:80] for h in hist),
    }]


def check_answer_shape(question):
    """Structural sanity of the stored answer for its type."""
    body = question[question["questionType"]]
    ans = body.get("answer")
    qtype = question["questionType"]
    findings = []
    if qtype in ("scq",):
        if not (isinstance(ans, str) and ans in "ABCD" and len(ans) == 1):
            findings.append({"code": "answer_shape", "severity": "hard",
                             "detail": f"scq answer should be one of A–D, stored: {ans!r}"})
    if qtype == "mcq":
        if isinstance(ans, str):
            findings.append({"code": "answer_shape", "severity": "hard",
                             "detail": f"mcq answer should be an array, stored as string: {ans!r}"})
        elif isinstance(ans, list):
            bad = [a for a in ans if not (isinstance(a, str) and a.strip() in ("A", "B", "C", "D"))]
            if bad:
                findings.append({"code": "answer_shape", "severity": "hard",
                                 "detail": f"mcq answer array has malformed elements: {bad!r}"})
    if qtype == "integerQuestion" and not isinstance(ans, str):
        findings.append({"code": "answer_shape", "severity": "hard",
                         "detail": f"integer answer should be a string, stored: {ans!r}"})
    return findings


def check_comment(comment):
    """Prompt-injection screening + gibberish detection on the report text."""
    findings = []
    low = comment.lower()
    for pat in INJECTION_PATTERNS:
        if re.search(pat, low):
            findings.append({
                "code": "prompt_injection",
                "severity": "hard",
                "detail": f"Comment matches injection pattern '{pat}' — treated as untrusted text, never as instructions",
            })
            break
    tokens = comment.split()
    if tokens:
        mash = [t for t in tokens if re.fullmatch(r"[asdfghjkl]+", t.lower()) and len(t) >= 4]
        if (len(mash) / len(tokens)) > GIBBERISH_MAX_RATIO:
            findings.append({
                "code": "comment_unintelligible",
                "severity": "soft",
                "detail": "Comment is keyboard-mash with no readable claim",
            })
        elif len(comment) < 6:
            findings.append({
                "code": "comment_low_signal",
                "severity": "soft",
                "detail": "Comment is very short ('wrong'-style): a lead, but carries no specifics",
            })
    return findings


def run_all(question, reports):
    """All static guards for one question + its reports."""
    findings = []
    for fn in (check_options, check_latex_leak, check_exam_tag,
               check_figure, check_error_history, check_answer_shape):
        findings += fn(question)
    for r in reports:
        findings += check_comment(r["comment"])
    return findings
