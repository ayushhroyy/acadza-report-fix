/* diff.js — word-level diffs and edit application for the console (no deps) */

// sanitize question HTML before injecting (strip scripts, handlers, js: urls),
// then cleanse production span-soup: the bank's HTML carries color:#000000
// spans (black = invisible on our dark theme) and mismatched nesting, so we
// unwrap every styling-only element (span/font/b/i with no class we need).
function sanitize(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  t.content.querySelectorAll('script,style,iframe,object,embed,link').forEach(el => el.remove());
  t.content.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      const n = a.name.toLowerCase(), v = (a.value || '').trim().toLowerCase();
      if (n.startsWith('on') || n === 'style' || v.startsWith('javascript:') || v.startsWith('data:text/html')) el.removeAttribute(a.name);
    });
  });
  // unwrap styling-only tags (keep structure: math, br, sub, sup, tables, marks)
  t.content.querySelectorAll('span, font, b, strong, i, em, u, div, p').forEach(el => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  return t.content;
}

// plain text of HTML (for snippets); math blocks become their visible text,
// or an ellipsis when math would read as broken flattened digits (dropMath)
function textOf(html, dropMath = false) {
  const d = document.createElement('div');
  d.appendChild(sanitize(html).cloneNode(true));
  d.querySelectorAll('math').forEach(m => {
    const txt = (m.textContent || '').replace(/\s+/g, ' ').trim();
    m.replaceWith(document.createTextNode(dropMath ? ' … ' : ` ${txt} `));
  });
  return (d.textContent || '').replace(/\s+/g, ' ').replace(/([,:;]) \./g, '.').trim();
}

// apply a {field, find, replace} edit to question HTML (string level, like the engine)
function applyEdit(html, edit) {
  if (!edit || edit.field !== 'question' && edit.field !== 'solution') return html;
  return html.replace(edit.find, () => edit.replace); // fn form: no $-substitution surprises
}

// LCS word diff between two short strings → HTML with <del>/<ins>
function wordDiff(before, after) {
  const A = String(before).split(/(\s+)/), B = String(after).split(/(\s+)/);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let out = '', i = 0, j = 0;
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  while (i < n && j < m) {
    if (A[i] === B[j]) { out += esc(A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out += A[i].trim() ? `<del>${esc(A[i])}</del>` : esc(A[i]); i++; }
    else { out += B[j].trim() ? `<ins>${esc(B[j])}</ins>` : esc(B[j]); j++; }
  }
  while (i < n) { out += A[i].trim() ? `<del>${esc(A[i])}</del>` : esc(A[i]); i++; }
  while (j < m) { out += B[j].trim() ? `<ins>${esc(B[j])}</ins>` : esc(B[j]); j++; }
  return out;
}

// highlight the keyed option letters inside rendered question HTML
// (superseded by renderRich's option rows, which highlight whole rows)

// ───────── rich renderer ─────────
// The bank's HTML is span-soup with mismatched nesting; letting the browser
// parse it scrambles option order (adoption agency). So we render linearly:
//   1. lift <math> blocks out as placeholders (they are well-formed)
//   2. strip tags, keep <br> as newlines, decode entities
//   3. split stem / options at plain-text "(A)".."(D)" markers
//   4. rebuild clean DOM and re-insert the math blocks in order
function decodeEntities(s) {
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  return ta.value;
}

function renderRich(html, keyLetters, insText) {
  const keys = (Array.isArray(keyLetters) ? keyLetters : [keyLetters]).map(String);
  const maths = [];
  let s = html.replace(/<math[\s\S]*?<\/math>/gi, m => { maths.push(m); return `⟦M${maths.length - 1}⟧`; });
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

  const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
  const insClean = insText ? clean(decodeEntities(insText)) : '';
  // a cleaned string still contains ⟦M i⟧ placeholders; substitute the math's
  // own visible text so comparisons run on what the reader actually sees
  const plainWithMath = t => t.replace(/⟦M(\d+)⟧/g, (_, i) => clean(maths[+i]));
  const hit = t => {
    if (!insClean || !t || t.length < 3) return false;
    const a = plainWithMath(t).toLowerCase(), b = insClean.slice(0, 120).toLowerCase();
    return a.includes(b) || b.includes(a);
  };

  const frag = document.createDocumentFragment();

  const buildInto = (node, str) => {
    const parts = str.split(/(⟦M\d+⟧|⟦INS⟦[\s\S]*?⟧INS⟧)/);
    parts.forEach(p => {
      const m = p.match(/^⟦M(\d+)⟧$/);
      if (m) {
        const t = document.createElement('template');
        t.innerHTML = maths[+m[1]];
        node.appendChild(t.content);
      } else if (p.startsWith('⟦INS⟦')) {
        const mark = document.createElement('mark');
        mark.className = 'ins';
        buildInto(mark, p.slice(5, -5));
        node.appendChild(mark);
      } else if (p) node.appendChild(document.createTextNode(p));
    });
  };

  // find an ascending run of plain-text option markers "(A)".."(D)"
  const markers = [...s.matchAll(/\(([A-D])\)/g)].map(m => ({ letter: m[1], idx: m.index }));
  let splitAt = -1;
  for (let i = 0; i < markers.length; i++) {
    const run = ['A', 'B', 'C', 'D'];
    const seq = markers.slice(i, i + 4);
    if (seq.length >= 2 && seq.every((m, j) => m.letter === run[j])) { splitAt = i; break; }
  }

  if (splitAt === -1) {
    // no clean option list in plain text → flowing render, one line per \n.
    // if an insert was requested, wrap its text so it renders highlighted
    if (insClean) s = s.split(insClean).join(`⟦INS⟦${insClean}⟧INS⟧`);
    const lines = s.split('\n');
    lines.forEach((line, i) => {
      buildInto(frag, line);
      if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
    });
    return frag;
  }

  const stem = s.slice(0, markers[splitAt].idx).trim();
  const stemP = document.createElement('p');
  if (hit(stem)) stemP.className = 'has-ins';
  frag.appendChild(stemP);
  const opts = [];
  for (let i = splitAt; i < splitAt + 4; i++) {
    const from = markers[i] ? markers[i].idx + 3 : s.length;
    const to = markers[i + 1] ? markers[i + 1].idx : s.length;
    opts.push({ letter: markers[i] ? markers[i].letter : null, text: s.slice(from, to).replace(/\n/g, ' ').trim() });
  }
  buildInto(stemP, stem);

  const list = document.createElement('div');
  list.className = 'opts';
  opts.forEach(o => {
    const row = document.createElement('div');
    row.className = 'opt' + (o.letter && keys.includes(o.letter) ? ' key' : '');
    if (hit(o.text)) row.classList.add('has-ins');
    if (o.letter) {
      const tag = document.createElement('span');
      tag.className = 'opt-letter';
      tag.textContent = `(${o.letter})`;
      row.appendChild(tag);
    }
    if (o.text) buildInto(row, o.text);
    else { row.classList.add('blank'); row.appendChild(document.createTextNode('— blank option —')); }
    list.appendChild(row);
  });
  frag.appendChild(list);
  return frag;
}
