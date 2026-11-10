/* app.js — Acadza Report→Fix faculty console (vanilla JS, no build step) */
'use strict';

const CASES = (window.ACADZA && ACADZA.cases) || [];
const BONUS = (window.ACADZA && ACADZA.bonus) || [];

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const VERDICT_LABEL = {
  defect: 'defect', no_error: 'student is wrong', display_issue: 'display issue',
  app_issue: 'app issue', language_mode: 'language request',
  already_fixed: 'already fixed', not_actionable: 'not actionable',
};
const VERDICT_COLOR = {
  defect: 'var(--defect)', no_error: 'var(--clean)', display_issue: 'var(--info)',
  app_issue: 'var(--purple)', language_mode: 'var(--teal)',
  already_fixed: 'var(--gray)', not_actionable: 'var(--gray)',
};

// ───────── state ─────────
const state = {
  tab: 'queue',
  filter: 'all',
  selected: 0,
  review: JSON.parse(localStorage.getItem('acadza_review') || '{}'),
  audit: JSON.parse(localStorage.getItem('acadza_audit') || '[]'),
};

function saveState() {
  localStorage.setItem('acadza_review', JSON.stringify(state.review));
  localStorage.setItem('acadza_audit', JSON.stringify(state.audit));
}

function filteredCases() {
  return CASES.filter(c => {
    if (state.filter === 'all') return true;
    if (state.filter === 'defect') return c.decision.verdict === 'defect';
    return c.route === state.filter;
  }).sort((a, b) => b.urgency - a.urgency);
}

// ───────── header stats ─────────
function renderStats() {
  const n = v => CASES.filter(c => c.decision.verdict === v).length;
  const defects = n('defect');
  const auto = CASES.filter(c => c.route === 'auto_apply').length;
  const fac = CASES.filter(c => c.route === 'faculty_review').length;
  const reports = CASES.reduce((s, c) => s + c.reports.length, 0);
  const reviewed = Object.keys(state.review).length;
  $('#stats').innerHTML = `
    <span class="stat"><b>${reports}</b> reports</span>
    <span class="stat"><span class="dot" style="background:var(--defect)"></span><b>${defects}</b> defect questions</span>
    <span class="stat"><span class="dot" style="background:var(--clean)"></span><b>${auto}</b> auto-apply</span>
    <span class="stat"><span class="dot" style="background:var(--warn)"></span><b>${fac}</b> need you</span>
    <span class="stat"><span class="dot" style="background:var(--info)"></span><b>${reports - CASES.filter(c => c.decision.verdict === 'defect').reduce((s, c) => s + c.reports.length, 0)}</b> reports: student wrong / not content</span>
    <span class="stat"><b>${reviewed}/${CASES.length}</b> reviewed</span>`;
  $('#qcount').textContent = CASES.length;
  $('#bcount').textContent = BONUS.length;
  $('#acount').textContent = state.audit.length;
}

// ───────── queue list ─────────
function renderList() {
  const list = $('#caselist');
  list.innerHTML = '';
  const cases = filteredCases();
  if (!cases.length) { list.appendChild(el('div', 'empty', 'no cases match this filter')); return; }
  cases.forEach((c, idx) => {
    const q = c.question, body = q[q.questionType];
    const card = el('div', 'case-card' + (idx === state.selected && state.tab === 'queue' ? ' sel' : ''));
    const rev = state.review[c.questionId];
    card.innerHTML = `
      <div class="cc-top">
        <span class="vdot" style="background:${VERDICT_COLOR[c.decision.verdict]}"></span>
        <span style="font-size:11px;color:var(--faint);font-family:var(--mono)">${c.reports.map(r => r.reportId).join(' · ')}</span>
        <span class="cc-reports">${c.reports.length > 1 ? `<b>${c.reports.length}</b> reports` : '1 report'}</span>
      </div>
      <div class="cc-snippet">${esc(textOf(body.question, true).slice(0, 110))}</div>
      <div class="cc-meta">
        <span class="chip">${q.subject}</span>
        ${c.decision.repair ? `<span class="chip repair">${c.decision.repair}</span>` : ''}
        <span class="chip route-${c.route === 'auto_apply' ? 'auto' : c.route === 'faculty_review' ? 'fac' : 'no'}">
          ${c.route === 'auto_apply' ? 'auto' : c.route === 'faculty_review' ? 'faculty' : 'no change'}</span>
        ${rev ? `<span class="cc-done ${rev.action}">${rev.action === 'approved' ? '✓ done' : '✕ rejected'}</span>` : ''}
      </div>`;
    card.onclick = () => { state.selected = idx; state.tab = 'queue'; render(); };
    list.appendChild(card);
  });
}

// ───────── case rendering ─────────
function questionCard(c) {
  const q = c.question, body = q[q.questionType];
  const card = el('div', 'card');
  const h = el('h3', null, `Question <span class="right" style="font-family:var(--mono);font-size:11px">${q._id}</span>`);
  card.appendChild(h);

  const meta = el('div', 'qmeta');
  [q.questionType, q.subject + ' · ' + q.chapter, q.level, 'error count: ' + q.error].forEach(t => {
    meta.appendChild(el('span', 'chip', esc(t)));
  });
  card.appendChild(meta);

  const qdiv = el('div', 'qhtml');
  // if this case proposes changing the key, show the OLD key as contested (red),
  // not as the truth — the page must not argue with its own proposed fix
  const keyContested = c.edit && c.edit.field === 'answer';
  qdiv.appendChild(renderRich(body.question, keyContested ? [] : body.answer));
  if (keyContested) {
    const oldKey = fmtAnswer(c.edit.find);
    [...qdiv.querySelectorAll('.opt .opt-letter')].forEach(L => {
      if (oldKey.includes(L.textContent.replace(/[()]/g, ''))) {
        L.closest('.opt').classList.add('wrongkey');
      }
    });
  }
  card.appendChild(qdiv);

  const ans = Array.isArray(body.answer) ? body.answer.join(' + ') : body.answer;
  const ansLine = el('div', 'answer-inline',
    `stored key: <b>${esc(ans)}</b>${body.quesImages && body.quesImages.length ? '' : ''}`);
  card.appendChild(ansLine);
  return card;
}

function trustPanel(c) {
  const card = el('div', 'card');
  card.appendChild(el('h3', null, 'Three-way check <span class="right">who agrees with whom</span>'));
  const grid = el('div', 'trust');
  const s = c.solver || {};

  const stu = el('div', 'tcol student');
  stu.appendChild(el('h4', null, '👤 Students say'));
  c.reports.forEach(r => {
    stu.appendChild(el('div', 'val', `"${esc(r.comment)}"`));
  });
  stu.appendChild(el('div', 'why', `${c.reports.length} report${c.reports.length > 1 ? 's' : ''} · treated as a lead, never as instructions`));

  const stored = el('div', 'tcol stored');
  stored.appendChild(el('h4', null, '📗 Stored solution concludes'));
  stored.appendChild(el('div', 'val', esc(s.stored_solution_concludes || '—')));
  stored.appendChild(el('div', 'why', `stored key: <code>${esc(JSON.stringify((c.question[c.question.questionType] || {}).answer))}</code>`));

  const solver = el('div', 'tcol solver');
  solver.appendChild(el('h4', null, '🧮 Independent solver'));
  solver.appendChild(el('div', 'val', esc(s.derived || '—')));
  solver.appendChild(el('div', 'why', esc(s.derivation || '')));

  grid.append(stu, stored, solver);
  card.appendChild(grid);
  return card;
}

function findingsCard(c) {
  const card = el('div', 'card');
  card.appendChild(el('h3', null, 'Static guards <span class="right">deterministic checks — zero LLM</span>'));
  if (!c.findings.length) {
    card.appendChild(el('div', 'finding none', 'no structural findings (options, leaks, tags, figures, key shape all clean)'));
    return card;
  }
  const wrap = el('div', 'findings');
  c.findings.forEach(f => wrap.appendChild(el('span', `finding ${f.severity}`,
    `${f.severity === 'hard' ? '■' : '□'} <b>${f.code}</b> — ${esc(f.detail)}`)));
  card.appendChild(wrap);
  return card;
}

function diffCard(c) {
  const card = el('div', 'card');
  const d = c.decision;
  card.appendChild(el('h3', null, `Proposed fix <span class="right">${d.repair ? 'repair: ' + d.repair : 'no content change'}</span>`));

  if (!d.repair || d.verdict !== 'defect') {
    card.appendChild(el('div', 'diff-why',
      `nothing to write — ${d.verdict === 'defect' ? 'this repair has no writable fields' : 'stored content checks out'}`));
    return card;
  }
  if (c.edit_fail_reason) {
    card.appendChild(el('div', 'diff-why', `⚠ edit guard rejected the LLM's edit (<code>${esc(c.edit_fail_reason)}</code>) — demoted to faculty review`));
    return card;
  }
  if (!c.edit) {
    card.appendChild(el('div', 'diff-why', 'advice only — this repair is human-only by taxonomy; nothing is auto-written'));
    return card;
  }

  const edit = c.edit;
  const body = c.question[c.question.questionType];

  if (edit.field === 'answer') {
    const wrap = el('div');
    wrap.innerHTML = `
      <div class="diff-answer">
        <div class="da-side before"><div class="lbl">stored key</div><div class="val">${esc(fmtAnswer(edit.find))}</div></div>
        <div class="da-arrow">→</div>
        <div class="da-side after"><div class="lbl">corrected key</div><div class="val">${esc(fmtAnswer(edit.replace))}</div></div>
      </div>
      <div class="diff-why">answer field only — stem, options and solution untouched</div>`;
    card.appendChild(wrap);
    return card;
  }

  // HTML field diff
  const before = body[edit.field] || '';
  const grid = el('div', 'diff-render');
  const p1 = el('div', 'dpane');
  p1.innerHTML = `<div class="lbl">before (${edit.field})</div>`;
  const p1c = el('div', 'content'); p1c.appendChild(renderRich(before, body.answer)); p1.appendChild(p1c);

  const p2 = el('div', 'dpane after');
  p2.innerHTML = `<div class="lbl">after — highlighted insert</div>`;
  const p2c = el('div', 'content');
  p2c.appendChild(renderRich(applyEdit(before, edit), body.answer, edit.replace));
  p2.appendChild(p2c);
  grid.append(p1, p2);
  card.appendChild(grid);

  const src = el('div', 'srcdiff');
  src.innerHTML = `<div class="field">${edit.field} · surgical find → replace (word diff)</div>
    <div class="row"><span class="tag">find</span><span class="old">${wordDiff(textOf(edit.find), textOf(edit.replace)) || esc(textOf(edit.find))}</span></div>`;
  card.appendChild(src);
  return card;
}

function fmtAnswer(a) {
  if (typeof a === 'string' && a.trim().startsWith('[')) { try { a = JSON.parse(a); } catch (e) {} }
  return Array.isArray(a) ? a.join(' · ') : a;
}

function evidenceCard(c) {
  const card = el('div', 'card');
  card.appendChild(el('h3', null, `Evidence & routing <span class="right">confidence ${(c.decision.confidence * 100).toFixed(0)}%</span>`));
  card.appendChild(el('div', 'evidence', esc(c.decision.evidence)));
  if (c.decision.triage_note) {
    card.appendChild(el('div', 'route-reason', `<b>triage note:</b> ${esc(c.decision.triage_note)}`));
  }
  card.appendChild(el('div', 'route-reason',
    `<b>route → ${c.route}</b> · ${esc(c.routeReason)} · urgency ${c.urgency}`));
  return card;
}

function repliesCard(c) {
  const card = el('div', 'card');
  card.appendChild(el('h3', null, `Students' reports & replies <span class="right">${c.reports.length} thread${c.reports.length > 1 ? 's' : ''}</span>`));
  c.reports.forEach(r => {
    const rep = el('div', 'report');
    rep.innerHTML = `
      <div class="r-head"><b>${r.reportId}</b> · ${esc(r.source)} · ${new Date(r.reportedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · ${esc(r.studentId)}</div>
      <div class="r-comment">${esc(r.comment)}</div>`;
    const replyText = (c.decision.replies || {})[r.reportId] || '';
    if (replyText) {
      const rp = el('div', 'reply');
      rp.innerHTML = `<div class="who">↩ reply preview — sent on resolution</div>${esc(replyText)}`;
      rep.appendChild(rp);
    }
    card.appendChild(rep);
  });
  return card;
}

function renderCase() {
  const main = $('#main');
  main.innerHTML = '';
  const cases = filteredCases();
  if (!cases.length) { main.appendChild(el('div', 'empty', 'nothing here')); return; }
  const c = cases[Math.min(state.selected, cases.length - 1)];
  if (c) state.currentId = c.questionId;

  // injection banner first — it must be impossible to miss
  if (c.findings.some(f => f.code === 'prompt_injection')) {
    main.appendChild(el('div', 'injection',
      '⚠ prompt-injection attempt in a report comment — treated as untrusted data; verdict rests on independent solve + guards only'));
  }

  const strip = el('div', 'verdict-strip');
  strip.innerHTML = `
    <span class="vbadge ${c.decision.verdict}">${VERDICT_LABEL[c.decision.verdict]}</span>
    ${c.decision.repair ? `<span class="chip repair" style="font-size:13px;padding:6px 14px">${c.decision.repair}</span>` : ''}
    <span class="conf"><span>confidence</span>
      <span class="conf-bar"><i style="width:${c.decision.confidence * 100}%"></i></span>
      <b>${(c.decision.confidence * 100).toFixed(0)}%</b></span>
    <span class="urgency" title="mis-scoring (100) > unusable (60) > hygiene (30); +15 per corroborating report; +1 per day of age, capped at 7">urgency ${c.urgency} · ${c.reports.length} report${c.reports.length > 1 ? 's' : ''} · first ${c.reports[0].reportedAt.slice(0, 10)}</span>`;
  main.appendChild(strip);

  main.appendChild(questionCard(c));
  main.appendChild(diffCard(c));
  main.appendChild(trustPanel(c));
  main.appendChild(findingsCard(c));
  main.appendChild(evidenceCard(c));
  main.appendChild(repliesCard(c));
  renderActionbar(c);
}

// ───────── action bar ─────────
function renderActionbar(c) {
  let bar = $('#actionbar');
  if (!bar) { bar = el('div', '', ''); bar.id = 'actionbar'; document.body.appendChild(bar); }
  const rev = state.review[c.questionId];
  bar.innerHTML = '';

  if (rev) {
    bar.innerHTML = `<span style="color:var(--muted);font-size:13.5px">
      ${rev.action === 'approved' ? '✓ approved' : '✕ rejected'} ${new Date(rev.at).toLocaleString('en-IN')}
      ${rev.action === 'approved' && c.route === 'auto_apply' ? '· fix applied to question bank' : ''}
      ${rev.action === 'approved' && c.route === 'faculty_review' ? '· forwarded to CMS queue' : ''}
      ${rev.action === 'approved' && c.route === 'no_change' ? '· student will get the reply' : ''}</span>
      <button class="btn" onclick="undoReview('${c.questionId}')">undo</button>`;
    return;
  }

  const mk = (label, cls, key, fn) => {
    const b = el('button', `btn ${cls}`, `${label}<kbd>${key}</kbd>`);
    b.onclick = fn; return b;
  };
  if (c.route === 'auto_apply') {
    bar.appendChild(mk('Approve — apply fix', 'primary', 'a', () => approve('applied')));
    bar.appendChild(mk('Edit first', 'warn', 'e', openEditModal));
    bar.appendChild(mk('Reject', 'danger', 'x', () => rejectCase()));
  } else if (c.route === 'faculty_review') {
    bar.appendChild(mk('Approve — forward', 'primary', 'a', () => approve('forwarded')));
    bar.appendChild(mk('Edit then forward', 'warn', 'e', openEditModal));
    bar.appendChild(mk('Reject', 'danger', 'x', () => rejectCase()));
  } else {
    bar.appendChild(mk('Mark reviewed — send replies', 'primary', 'a', () => approve('replied')));
    bar.appendChild(mk('Flag for another look', 'warn', 'e', () => approve('escalated')));
  }
  const note = el('span', 'foot-note', '');
  note.style.cssText = 'color:var(--faint);font-size:11.5px';
  bar.appendChild(note);
}

function approve(kind) {
  const c = currentCase();
  const label = { applied: 'approved — fix applied', forwarded: 'approved — forwarded to CMS',
                  replied: 'reviewed — replies queued', escalated: 'escalated to faculty lead' }[kind];
  state.review[c.questionId] = { action: 'approved', at: new Date().toISOString() };
  state.audit.unshift({ at: new Date().toISOString(), action: label,
    caseId: c.questionId, reports: c.reports.map(r => r.reportId),
    repair: c.decision.repair || '-', route: c.route });
  saveState(); toast(`✓ ${label} — press k to go back and undo`); nextCase(); render();
}
function rejectCase() {
  const c = currentCase();
  state.review[c.questionId] = { action: 'rejected', at: new Date().toISOString() };
  state.audit.unshift({ at: new Date().toISOString(), action: 'rejected — engine overrode',
    caseId: c.questionId, reports: c.reports.map(r => r.reportId),
    repair: c.decision.repair || '-', route: c.route });
  saveState(); toast('✕ rejected — engine output overruled'); nextCase(); render();
}
window.undoReview = function (caseId) {
  const id = caseId || (currentCase() || {}).questionId;
  delete state.review[id];
  state.audit = state.audit.filter(a => a.caseId !== id);
  saveState(); render();
};

function currentCase() {
  const cases = filteredCases();
  return cases[Math.min(state.selected, cases.length - 1)];
}
function nextCase() {
  const cases = filteredCases();
  if (state.selected < cases.length - 1) state.selected++;
}

// ───────── edit modal ─────────
function openEditModal() {
  const c = currentCase();
  const edit = c.edit || { field: 'question', find: '', replace: '' };
  const m = $('#modal');
  m.innerHTML = '';
  const box = el('div', 'modal-box');
  box.innerHTML = `<h2>Edit the proposed fix — ${c.decision.repair || 'note'}</h2>
    <label>field (must stay inside the repair's allowed fields)</label>
    <input id="efield" value="${esc(edit.field)}">
    <label>find (must occur exactly once in the stored field)</label>
    <textarea id="efind" rows="3">${esc(edit.find)}</textarea>
    <label>replace</label>
    <textarea id="ereplace" rows="3">${esc(edit.replace)}</textarea>
    <label>why (audit note)</label>
    <input id="enote" placeholder="e.g. faculty corrected the unit to cm">
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">cancel</button>
      <button class="btn warn" id="edoprev">preview</button>
      <button class="btn primary" id="edosave">save edit + approve</button>
    </div>
    <div id="eprev" style="margin-top:14px"></div>`;
  m.appendChild(box);
  m.classList.add('open');
  $('#edoprev').onclick = () => {
    const f = $('#efield').value, find = $('#efind').value, rep = $('#ereplace').value;
    const body = c.question[c.question.questionType];
    const hay = body[f];
    let msg;
    if (f !== 'answer' && hay) {
      const n = hay.split(find).length - 1;
      msg = n === 1
        ? `✓ anchor unique in ${f} — surgical edit valid`
        : `✕ anchor occurs ${n}× in ${f} — must be exactly 1`;
    } else if (f === 'answer') {
      msg = `answer: ${esc(fmtAnswer(JSON.stringify(body.answer)))} → ${esc(fmtAnswer(rep))}`;
    } else msg = `✕ unknown field`;
    $('#eprev').innerHTML = `<div class="srcdiff"><div class="row"><span class="tag">check</span><span class="${msg.startsWith('✓') ? 'new' : 'old'}">${msg}</span></div>
      <div class="row"><span class="tag">diff</span><span>${wordDiff(find, rep)}</span></div></div>`;
  };
  $('#edosave').onclick = () => {
    const f = $('#efield').value, find = $('#efind').value, rep = $('#ereplace').value;
    const note = $('#enote').value || 'faculty edited the proposed fix';
    const body = c.question[c.question.questionType];
    if (f !== 'answer' && (body[f] || '').split(find).length - 1 !== 1) { toast('✕ anchor must occur exactly once'); return; }
    if (f === 'answer' && find !== JSON.stringify(body.answer) && find !== body.answer) { toast('✕ find must match stored answer'); return; }
    c.edit = { field: f, find, replace: rep };
    state.review[c.questionId] = { action: 'approved', at: new Date().toISOString() };
    state.audit.unshift({ at: new Date().toISOString(), action: 'edited then approved',
      caseId: c.questionId, reports: c.reports.map(r => r.reportId), note,
      repair: c.decision.repair || '-', route: c.route });
    saveState(); closeModal(); toast('✓ edited fix applied'); nextCase(); render();
  };
}
window.closeModal = () => $('#modal').classList.remove('open');

// ───────── bonus tab ─────────
function renderBonus() {
  const main = $('#main'); main.innerHTML = '';
  main.appendChild(el('div', 'verdict-strip', `
    <span class="vbadge defect">bonus</span>
    <span style="color:var(--muted);font-size:13.5px">defects nobody reported — found by sweeping all 43 questions with the same guards + a typo/glue sweep</span>`));
  const wrap = el('div');
  BONUS.forEach(b => {
    const card = el('div', 'card bonus-card');
    const q = CASES.find(c => c.questionId === b.questionId);
    card.innerHTML = `
      <div class="bonus-head">
        <span class="chip repair">${b.repair}</span>
        <span class="foundby">${esc(b.found_by)}</span>
        <span class="chip">confidence ${(b.confidence * 100).toFixed(0)}%</span>
        ${b.reports_that_missed_it ? `<span class="chip" style="color:var(--warn)">${esc(b.reports_that_missed_it)}</span>` : ''}
      </div>
      <div class="evidence" style="margin-bottom:12px">${esc(b.evidence)}</div>`;
    if (b.edit && q) {
      const body = q.question[q.question.questionType];
      const grid = el('div', 'diff-render');
      const p1 = el('div', 'dpane'); p1.innerHTML = '<div class="lbl">before</div>';
      const c1 = el('div', 'content'); c1.appendChild(sanitize(body[b.edit.field])); p1.appendChild(c1);
      const p2 = el('div', 'dpane after'); p2.innerHTML = '<div class="lbl">after</div>';
      const c2 = el('div', 'content'); c2.appendChild(renderRich(applyEdit(body[b.edit.field], b.edit), null, b.edit.replace)); p2.appendChild(c2);
      grid.append(p1, p2); card.appendChild(grid);
    } else if (b.note) {
      card.appendChild(el('div', 'diff-why', esc(b.note)));
    }
    wrap.appendChild(card);
  });
  main.appendChild(wrap);
  hideActionbar();
}

// ───────── audit tab ─────────
function renderAudit() {
  const main = $('#main'); main.innerHTML = '';
  main.appendChild(el('div', 'verdict-strip', `
    <span class="vbadge not_actionable">audit trail</span>
    <span style="color:var(--muted);font-size:13.5px">every approve / edit / reject — exportable (localStorage demo; wired to CMS API in prod)</span>`));
  if (!state.audit.length) { main.appendChild(el('div', 'empty', 'no actions yet — approve or reject a case')); return; }
  state.audit.forEach(a => {
    main.appendChild(el('div', 'audit-row', `
      <span class="when">${new Date(a.at).toLocaleString('en-IN')}</span>
      <span class="act ${a.action.includes('rejected') ? 'rejected' : a.action.includes('edited') ? 'edited' : 'approved'}">${esc(a.action)}</span>
      <span class="what">${esc(a.caseId)} · reports ${a.reports.join(', ')} · repair ${esc(a.repair)} · route ${esc(a.route)}
        ${a.note ? '<br>note: ' + esc(a.note) : ''}</span>`));
  });
  const exp = el('button', 'btn warn', 'export audit.json');
  exp.style.marginTop = '16px';
  exp.onclick = () => {
    const blob = new Blob([JSON.stringify(state.audit, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'acadza-audit.json'; a.click();
  };
  main.appendChild(exp);
  hideActionbar();
}

function hideActionbar() { const b = $('#actionbar'); if (b) b.style.display = 'none'; }
function showActionbar() { const b = $('#actionbar'); if (b) b.style.display = 'flex'; }

// ───────── chrome ─────────
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

function render() {
  renderStats();
  renderList();
  showActionbar();
  if (state.tab === 'queue') renderCase();
  else if (state.tab === 'bonus') renderBonus();
  else renderAudit();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
  $('#filters').style.display = state.tab === 'queue' ? 'flex' : 'none';
  document.querySelector('.sort-note').style.display = state.tab === 'queue' ? 'block' : 'none';
}

// wire chrome
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; render(); });
document.querySelectorAll('#filters button').forEach(b => b.onclick = () => {
  state.filter = b.dataset.filter; state.selected = 0; render();
});
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'j') { nextCase(); render(); }
  else if (k === 'k') { if (state.selected > 0) state.selected--; render(); }
  else if (k === '1') { state.tab = 'queue'; render(); }
  else if (k === '2') { state.tab = 'bonus'; render(); }
  else if (k === '3') { state.tab = 'audit'; render(); }
  else if (k === 'a') { const c = currentCase(); if (c && !state.review[c.questionId]) approve(c.route === 'no_change' ? 'replied' : c.route === 'auto_apply' ? 'applied' : 'forwarded'); }
  else if (k === 'x') { const c = currentCase(); if (c && !state.review[c.questionId]) rejectCase(); }
  else if (k === 'e') { const c = currentCase(); if (c && !state.review[c.questionId]) openEditModal(); }
  else if (k === 'escape') closeModal();
});
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

render();
