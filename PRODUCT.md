# PRODUCT.md

## Who loses the most — and how the design shows it

The student who reports a broken question has already paid the cost: they lost
marks, doubted themselves, and spent the courage it takes to report. The
person who loses the *most* is the **next student** — and the thousand after
them — because a broken question keeps mis-scoring everyone who meets it until
someone fixes it. A defect caught by report R001 has typically already been
wrong for months.

So the product optimises for the *unreported victim*, not the reporter:

- **The queue orders by "who is being hurt right now"** — mis-scoring defects
  (wrong keys, two correct options, blank keyed option) outrank unusable
  questions, which outrank hygiene. Corroboration and age push cases up.
- **Auto-apply exists to cut time-to-fix, not to replace faculty** — it fires
  only where the fix is independently proven (solver + stored solution + guards
  all agree), because a *wrong* auto-fix hurts future students at machine
  speed. 18 of 44 reports resolved without waiting for a human; 8 genuinely
  needed one; 18 were students the system could answer kindly and correctly.
- **The reply is part of the fix.** Most reports are students being wrong; a
  wrong-but-answered student who gets a condescending (or no) reply learns
  "reporting is useless" — and the next real defect goes unreported. Replies
  teach the one decisive step, in the student's own language, Hinglish included.

## What I would never let the AI auto-apply

- **Authored content**: new distractors for missing/duplicate options (R009,
  R015), figures, replacement stems. An LLM can propose; only faculty can
  author. A plausible-but-wrong distractor is a *new* defect with no report to
  catch it.
- **Policy calls**: syllabus challenges (R026), chapter moves, question
  retirement. These change what *appears* for a chapter; getting them wrong at
  scale corrupts tests silently.
- **A new answer key without independent proof.** The bar is explicit: the
  solver must derive it and the stored solution must not contradict it (R001:
  solver, stored solution and three students all say 50 V; the key alone says
  130 V). One of the two agreeing is not enough — R016's solution confidently
  concluded a = 40 cm from its own equation that gives 20.
- **Anything a report comment asks for.** Comments are untrusted data (R027 is
  a literal prompt-injection attempt). Verdicts rest on physics and guards,
  never on instructions embedded in a report.

## The one metric for week 1

**Auto-apply reversal rate** — the share of auto-applied fixes faculty undo.
It is the single trust dial: if reversals run under ~3%, we widen automation
(stem_data, notation); if they spike, the proof bar was too low and we tighten
before faculty stop believing the green badges. (Secondary, watched not
optimised: median time from report to resolution, and report→fix conversion
per 1k attempts.)

## One idea beyond the brief

**Report → Fix → Restore.** When a key is corrected, every student who
attempted the question *before* the fix gets their marks restored and a
notification: "You were right — Q-68e870's key was wrong; your (D) is now
correct (+4)." Today a fixed question ends the story for the bank but not for
the students it mis-scored. Closing that loop turns error reports from a
complaint channel into a visible win — students start reporting *more*
(better defect discovery), and the report rate itself becomes a product health
metric: the cheapest QA pipeline Acadza has is a student who trusts the button.
