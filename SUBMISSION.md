# Submission checklist (for Ayush — not part of the repo deliverables)

## 1. Push to GitHub (do this first)

```bash
cd /Users/ayush/Desktop/acadza/acadza-report-fix
# create a PUBLIC repo named acadza-report-fix on github.com (New repository), then:
git remote add origin git@github.com:<your-username>/acadza-report-fix.git
git branch -M main
git push -u origin main
```

Optional but recommended: also deploy the console to Vercel/Netlify
(`console/` is a static folder — drag-and-drop on Netlify works) so the live
URL sits on a conventional host next to the repo. The ZCode Sites URL already
works: **https://acadza-report-fix-d7en.zai-ai.site**

## 2. Record the 3-minute video (Loom / QuickTime + voice)

Script below — speak in your own words, this is the beats to hit:

| Time | Show | Say (beats) |
|---|---|---|
| 0:00 | Console queue | "44 student reports on 39 questions. The queue is ordered by who's being hurt right now: wrong keys first, then unusable questions, then hygiene. Corroboration and age push cases up — the rule is on the header, not buried." |
| 0:25 | Click R001 group (3 reports) | "Three students said this LCR key was wrong. The engine never trusts the comment: the three-way check shows what the students said, what the stored solution itself concludes — 50 V, contradicting its own key — and an independent solve done without seeing any comment. All three agree on 50 V = option A, so this passes the proof bar for auto-apply: the old key shows struck-through red, the fix is C→A." |
| 0:55 | Approve with `a`, press `k`, undo | "One keypress to approve; k+undo if I change my mind. Everything lands in the audit tab, exportable." |
| 1:10 | THE tricky case — R034 (assertion–reason) | "This one looks like a normal wrong-answer claim. It isn't. The stored solution argues the assertion is false, then true, then answers D — using the wrong formula. First principles: two equal waves at 90° give 2I₀, not I₀, so the assertion is false; the reason is false too. Both-false isn't offered — the question is unsound. That's a human call, so it routes to faculty with the reasoning visible." |
| 1:45 | R027 (injection) | "And this is someone trying to game the system — a prompt injection in the report. The engine treats comments as data, never instructions: hazard banner, verdict rests on physics, key unchanged." |
| 2:00 | R011 (blank option) | "Here the blank option IS the keyed answer, and its content — 1:1 — is derivable from Newton's third law and matches the stored solution, so restoring it auto-applies. Contrast R009: option D is missing but it's a distractor — content nobody can derive — so that one is faculty-only despite what the taxonomy would allow." |
| 2:25 | Unreported tab | "Bonus: sweeps found ten defects nobody reported — including 'lead tonight blindness', where a lost space changes the meaning, and option B's 'Canolla'. Before finalising I diffed my analysis against a second independent pass: 43 of 44 verdicts agreed; it caught four hygiene finds I'd missed, and I caught its one harmful auto-apply — a key change its own evidence disproved. That cross-check is in PROMPTS.md." |
| 2:45 | Audit tab, close | "44 in, 26 defects: 18 auto-applied under the proof rules, 8 genuinely needing faculty, 18 students answered kindly and correctly — in their own language. This is the loop: report to fix, with the student told and the next student protected." |

## 3. Reply to Subham's email — draft

> Hi Subham,
>
> Submission for the build round:
>
> - Repo: <github link>
> - Live console: https://acadza-report-fix-d7en.zai-ai.site (static, no LLM
>   needed to run — results precomputed; engine re-runs offline or live with any
>   OpenAI-compatible key, both modes in the README)
> - Video (3 min): <loom link>
>
> Quick summary: guards → comment-blind solver → taxonomy-closed triage →
> edit-scope guard → route. 44 reports → 26 defects (18 auto-applied under the
> proof bar, 8 to faculty), 12 students-wrong, 6 platform/meta. Traps handled:
> the prompt-injection report, the already-fixed spelling case, the
> self-contradicting assertion–reason solution. Bonus: 10 unreported defects in
> the console's second tab. I also diffed my full analysis against a second
> independent pass before submitting (43/44 agreement; details in PROMPTS.md §4).
> PROMPTS.md has every prompt verbatim, three moments my AI was wrong, and the
> design log; PRODUCT.md is the one-pager.
>
> Your four questions:
>
> 1. Long-run intent: **[write this yourself, honestly — one real paragraph:
>    why product for lakhs of students, why this team, what you want to be
>    building in 2 years. Don't template it.]**
> 2. Months I can commit: **[e.g. "6+ months, extendable to a full year /
>    convertible role"]** — say the true number.
> 3. Earliest start: **[date]**.
> 4. Why this work, why now (2–3 lines, your own words): **[e.g. "Every
>    Indian student knows the pain of a wrong answer key at 11 PM. The
>    levers here — trust, verification, reply quality — are exactly the
>    product problems I want to get great at, and the stakes are real
>    students, today."]** — rewrite in your voice.
>
> Thanks for the build round — the trap cases were genuinely fun.
>
> Ayush

## 4. Before you hit send — 60-second QA

- [ ] Open the live URL in an incognito window; click through 5 cases, approve one, check the Audit tab
- [ ] `python3 engine/run.py` exits 0 from a fresh clone
- [ ] results.json has 44 rows; spot-check R017 (already_fixed) and R027 (no_error)
- [ ] Video audio audible, 3:00 ± 15s, unlisted
- [ ] Answers to the 4 questions are in YOUR voice, not mine
