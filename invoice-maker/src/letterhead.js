/*
 * drawTypedLetterhead(doc, f, W, M) -> bottomY
 *
 * Typeset law-firm letterhead drawn with jsPDF's built-in Times faces (vector text only).
 *
 * Typographic system
 *   - Small caps: each lowercase letter is set as its capital at P.sc of the line size; every
 *     glyph of a line sits on one baseline. Each class has its own horizontal set width (PDF
 *     Tz: P.hs for the header, hsBody / hsLeft / hsRNote / hsLNote), restored on exit together
 *     with the rest of the graphics state, and its own extra word space (ws, em).
 *   - Type classes (size pt / tracking em):  head  = line1, line3          (Times Roman)
 *                                             name  = firm name             (Times Bold)
 *                                             body  = centre lines          (Times Roman)
 *                                             right = right lines           (body, tighter word space)
 *                                             left  = left lines            (Times Roman)
 *                                             rnote = right-hand note       (Times Roman, small caps)
 *                                             lnote = left-hand footnote    (Times Roman, mixed case)
 *   - Columns: left block flush left at P.xL; centre block centred on the page axis (shifted
 *     P.cxOff when side blocks exist); right block centred on an axis P.rAxis in from the right
 *     edge. Nothing passes the type area [xL, W - xL].
 *   - Vertical: header lines stack with one baseline-to-cap-top gap (P.G); a rule closes the
 *     header; below it every block hangs on one baseline grid of leading P.L: centre rows 0..n,
 *     right block from row -1, left block from row P.leftRow, right note on the last centre row.
 *   - Fitting: the centre column has priority over the side columns. A line too wide for the
 *     room its neighbours leave is set smaller; only if that would take it below P.minK of its
 *     size is it broken (after a comma when possible) onto extra lines, and the layout re-run.
 *     Side lines and notes have a fixed measure (lMaxW / rMaxW) and are broken at it first.
 *     A source line takes at most 2 lines (the name 3), set smaller down to FLOOR of its size
 *     before taking more; all pieces of one source line share one size. A letterhead ending
 *     below CAP is set at the largest overall scale that ends above it.
 */
function drawTypedLetterhead(doc, f, W, M) {
  // top = cap top of the first line: 12 pt lower than on the stationery scan (47.65), for a larger top margin
  var P = /*P*/{
    top: 59.65, xL: 43.6117, rAxis: 118.8317, cxOff: -2.44, sc: 0.78, hs: 1.132,
    sHead: 11.2, trHead: 0.09,
    sName: 17.7, trName: 0.1042,
    sBody: 10.45, trBody: 0, hsBody: 1.222, wsBody: 0.077, wsRight: -0.015,
    sLeft: 10.36, trLeft: 0.001, hsLeft: 1.246, wsLeft: -0.028,
    sRNote: 9.8, trRNote: 0, hsRNote: 1.21, wsRNote: 0.03,
    sLNote: 8.5, trLNote: 0.041, hsLNote: 1.12,
    G: 6.4, ruleBelow: 7.2, ruleAbove: 7.6, ruleW: 138.6, ruleT: 0.85,
    L: 11.75, leftRow: 0.65, lRuleBelow: 7.1, lNoteBelow: 9.2, lRuleW: 106.2, lRuleT: 0.85,
    rNoteDy: -1.0, gap: 12, edge: 24, colC: 208, minK: 0.7
  }/*P*/;


  var CAP = 260;     // the letterhead never runs below this y: a taller one is set smaller as a whole
  var FLOOR = 0.5;   // a broken line may shrink to this fraction of its size before it takes extra lines
  var bottom = -1;
  var stateSaved = false;

  // layout inputs: set once in the main block below, read by layout()
  var TXT = {}, WR = {}, useSC = true, below = false;
  var gap = P.gap, xL = P.xL, cx = 306, rA = 493, leftNomR = 0, rightNomL = 0, rHalf = 0, hMax = 0, lMaxW = 0, rMaxW = 0;

  // ---------- text helpers ----------
  // characters the built-in (WinAnsi) Times can show; others are transliterated (TRANS) or dropped
  var WIN = { 338: 1, 339: 1, 352: 1, 353: 1, 376: 1, 381: 1, 382: 1, 402: 1, 710: 1, 732: 1, 8211: 1, 8212: 1,
    8216: 1, 8217: 1, 8218: 1, 8220: 1, 8221: 1, 8222: 1, 8224: 1, 8225: 1, 8226: 1, 8230: 1, 8240: 1,
    8249: 1, 8250: 1, 8364: 1, 8482: 1 };
  var TRANS = { 8208: '-', 8209: '-', 8210: '-', 8722: '-', 8242: "'", 8243: '"', 8470: 'No.', 9742: 'Tel.', 9990: 'Tel.' };
  // jsPDF's Times metrics give these WinAnsi glyphs a default width; the font's real advances (em)
  var WFIX = {
    normal: { 338: 0.889, 339: 0.722, 352: 0.556, 353: 0.389, 381: 0.611, 382: 0.444, 8364: 0.5 },
    bold: { 338: 1, 339: 0.722, 352: 0.556, 353: 0.389, 381: 0.667, 382: 0.444, 8364: 0.5 }
  };
  function showable(t) {
    var i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (!((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN[c])) return false;
    }
    return true;
  }
  function str(v) {
    var s = typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''), out = '', i, ch, c;
    s = s.replace(/\t/g, ' ');
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      c = s.charCodeAt(i);
      if (ch === '\n' || ch === '\r' || showable(ch)) out += ch;
      else if (TRANS.hasOwnProperty(c)) out += TRANS[c];
      else if (/\s/.test(ch)) out += ' ';
    }
    return out;
  }
  function lines(v) {
    var parts = str(v).split(/\r\n|\r|\n/), out = [], i, t;
    for (i = 0; i < parts.length && out.length < 24; i++) {
      t = parts[i].replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
      if (t) out.push(t.length > 400 ? t.slice(0, 400) : t);   // sanity bounds for pasted junk
    }
    return out;
  }
  function oneLine(v) { return lines(v).join(' '); }
  function capH(size, style) { return size * (style === 'bold' ? 0.676 : 0.662); }
  // depth below the baseline (em) of the glyphs a run actually shows: small caps have no descenders
  function descK(t) {
    if (/[gjpqy|@()µ¸Ççýþÿ]/.test(t)) return 0.222;
    if (/[Q,;_$\[\]{}ƒ§¶]/.test(t)) return 0.16;
    return 0.02;
  }
  function inkBottom(ln) { return ln.base + ln.dk * ln.size; }

  // runs of equal size: lowercase letters become capitals at the small-cap size; spaces form
  // their own runs, which take the class's extra word space
  function runsOf(text, sc) {
    var out = [], i, ch, up, small, sp, last = null;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      up = sc ? ch.toUpperCase() : ch;
      if (up !== ch && !showable(up)) up = ch;
      small = up !== ch;
      sp = ch === ' ';
      if (last && last.small === small && last.sp === sp) last.t += up;
      else { last = { t: up, small: small, sp: sp }; out.push(last); }
    }
    return out;
  }
  // advance width without kerning (jsPDF's Tj output is not kerned); the font is already set
  function adv(t, size, style) {
    var w = 0, i, fx = WFIX[style] || WFIX.normal, c;
    doc.setFontSize(size);
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      w += fx.hasOwnProperty(c) ? fx[c] * size : doc.getTextWidth(t.charAt(i));
    }
    return w;
  }
  // a set line; its width is linear in its size (tracking is in em)
  function makeLine(text, cls) {
    var ln = { text: text, style: cls.style, size: cls.size, size0: cls.size, tr: cls.tr, hs: cls.hs, lim: 0, dk: 0 };
    var runs = runsOf(text, cls.sc), u = 0, n = 0, i;
    doc.setFont('times', cls.style);
    for (i = 0; i < runs.length; i++) {
      runs[i].k = runs[i].small ? P.sc : 1;
      runs[i].u = adv(runs[i].t, 1, cls.style) * runs[i].k + (runs[i].sp ? (cls.ws || 0) * runs[i].t.length : 0);
      u += runs[i].u;
      n += runs[i].t.length;
      ln.dk = Math.max(ln.dk, descK(runs[i].t) * runs[i].k);
    }
    ln.runs = runs;
    ln.u = u;                                      // glyph advances at size 1
    ln.n = n;                                      // glyph count
    ln.unit = (u + ln.tr * Math.max(0, n - 1)) * ln.hs;
    return ln;
  }
  function widthOf(ln) { return ln.unit * ln.size; }
  function fit(ln, maxW) {
    ln.lim = maxW;
    ln.size = ln.size0;
    if (ln.unit * ln.size0 > maxW && ln.unit > 0) ln.size = Math.max(0.5, maxW / ln.unit);
    return ln;
  }
  // one size per paragraph: the pieces of a broken source line all take the smallest fitted size
  function unify(arr) {
    var a = 0, b, c, s;
    while (a < arr.length) {
      s = arr[a].size;
      for (b = a + 1; b < arr.length && arr[b].key === arr[a].key && arr[b].src === arr[a].src; b++) s = Math.min(s, arr[b].size);
      for (c = a; c < b; c++) arr[c].size = s;
      a = b;
    }
  }
  function band(ln) { return [ln.base - capH(ln.size, ln.style) - 1, inkBottom(ln) + 1]; }
  function crosses(a, b) { var p = band(a), q = band(b); return p[0] < q[1] && q[0] < p[1]; }

  // ---------- line breaking ----------
  // prefix sums of word advances, so any run of words is measured in O(1)
  function wordMetrics(text, cls) {
    var words = text.split(' '), U = [0], N = [0], i, l;
    for (i = 0; i < words.length; i++) {
      l = makeLine(words[i], cls);
      U.push(U[i] + l.u);
      N.push(N[i] + l.n);
    }
    return { words: words, U: U, N: N, uSp: makeLine(' ', cls).u, tr: cls.tr, hs: cls.hs, size: cls.size };
  }
  // width of words a..b-1 joined by single spaces
  function spanW(m, a, b) {
    var u = m.U[b] - m.U[a] + (b - a - 1) * m.uSp, n = m.N[b] - m.N[a] + (b - a - 1);
    return (u + m.tr * Math.max(0, n - 1)) * m.hs * m.size;
  }
  function greedy(m, maxW) {
    var out = [], a = 0, b, fitN, commaN, take, piece, usedComma = false, W2 = m.words.length;
    while (a < W2) {
      fitN = a + 1; commaN = 0;
      for (b = a + 1; b <= W2; b++) {
        if (b > a + 1 && spanW(m, a, b) > maxW) break;
        fitN = b;
        if (b < W2 && /,$/.test(m.words[b - 1])) commaN = b;
      }
      take = fitN;
      if (fitN < W2 && commaN && commaN - a >= (fitN - a) / 2) { take = commaN; usedComma = true; }
      piece = m.words.slice(a, take).join(' ');
      if (take < W2) piece = piece.replace(/,$/, '');
      out.push(piece);
      a = take;
    }
    out.usedComma = usedComma;
    return out;
  }
  // pieces no wider than maxW, preferring a break after a comma; without comma breaks the pieces
  // are balanced (narrowest measure giving as few lines)
  function breakText(m, maxW) {
    var best = greedy(m, maxW), k = best.length, lo, hi, mid, t, it;
    if (k < 2 || best.usedComma) return best;
    lo = spanW(m, 0, m.words.length) / k; hi = maxW;
    for (it = 0; it < 14 && hi - lo > 0.5; it++) {
      mid = (lo + hi) / 2;
      t = greedy(m, mid);
      if (t.length <= k) { best = t; hi = mid; } else lo = mid;
    }
    return best;
  }
  // as breakText, but into at most maxN pieces: longer pieces are set smaller (down to FLOOR of
  // the size) to fit maxW; only text too long even at FLOOR gets more pieces
  function breakLimited(text, cls, maxW, maxN) {
    var m = wordMetrics(text, cls), n = m.words.length, ps, lo, hi, mid, t, it;
    if (n < 2 || spanW(m, 0, n) <= maxW) return [text];
    ps = breakText(m, maxW);
    if (ps.length <= maxN) return ps;
    ps = breakText(m, maxW / FLOOR);
    if (ps.length > maxN) return ps;
    lo = maxW; hi = maxW / FLOOR;
    for (it = 0; it < 14 && hi - lo > 0.5; it++) {
      mid = (lo + hi) / 2;
      t = greedy(m, mid);
      if (t.length <= maxN) { ps = t; hi = mid; } else lo = mid;
    }
    return ps;
  }

  // ---------- layout ----------
  function classes(z) {
    var trK = useSC ? 1 : 0.35;                    // mixed case takes far less tracking
    return {
      head: { style: 'normal', size: P.sHead * z, tr: P.trHead * trK, hs: P.hs, ws: 0, sc: useSC },
      name: { style: 'bold', size: P.sName * z, tr: P.trName * trK, hs: P.hs, ws: 0, sc: useSC },
      body: { style: 'normal', size: P.sBody * z, tr: P.trBody * trK, hs: P.hsBody, ws: P.wsBody, sc: useSC },
      right: { style: 'normal', size: P.sBody * z, tr: P.trBody * trK, hs: P.hsBody, ws: P.wsRight, sc: useSC },
      // the right column's heading line ('New York Office*') is word-spaced like the centre body
      rhead: { style: 'normal', size: P.sBody * z, tr: P.trBody * trK, hs: P.hsBody, ws: P.wsBody, sc: useSC },
      left: { style: 'normal', size: P.sLeft * z, tr: P.trLeft * trK, hs: P.hsLeft, ws: P.wsLeft, sc: useSC },
      rnote: { style: 'normal', size: P.sRNote * z, tr: P.trRNote * trK, hs: P.hsRNote, ws: P.wsRNote, sc: useSC },
      lnote: { style: 'normal', size: P.sLNote * z, tr: P.trLNote, hs: P.hsLNote, ws: 0, sc: false }
    };
  }
  // the source lines of field k2 as set lines; side fields are broken at their column measure,
  // others only once WR holds a measure for them; at most maxN pieces per source line;
  // cls0 (optional) replaces cls for source line 0
  function expand(k2, cls, out, measure, maxN, cls0) {
    var a, b, ps, l, w, c, src = TXT[k2];
    for (a = 0; a < src.length; a++) {
      c = a === 0 && cls0 ? cls0 : cls;
      w = WR[k2][a] > 0 ? Math.min(WR[k2][a], measure) : measure;
      ps = w < Infinity ? breakLimited(src[a], c, w, maxN) : [src[a]];
      for (b = 0; b < ps.length; b++) {
        l = makeLine(ps[b], c);
        l.key = k2; l.src = a; l.wrapped = WR[k2][a] > 0;
        out.push(l);
      }
    }
    return out;
  }
  // unbroken lines squeezed below minK of their size
  function squeezed(arr) {
    var out = [], a;
    for (a = 0; a < arr.length; a++) {
      if (!arr[a].wrapped && arr[a].size < P.minK * arr[a].size0 && arr[a].text.indexOf(' ') > 0) out.push(arr[a]);
    }
    return out;
  }
  // one pass at scale z (1 = nominal sizes and vertical spacing; horizontal measures never scale)
  function layout(z) {
    var CL = classes(z), L = P.L * z, bodyCap = capH(CL.body.size, 'normal');
    var head = [], C = [], R = [], Lf = [], RN = [], LN = [], prev = null, ruleY = null, lRule = null, grid0, k, j;
    var lo, hi, rw, shift, capTop, rnBase, lnBase, sideL, sideR, need, rw2;

    // header: stacked, centred, at most the type area wide
    var H = expand('line1', CL.head, [], Infinity, 2).concat(expand('name', CL.name, [], Infinity, 3), expand('line3', CL.head, [], Infinity, 2));
    for (k = 0; k < H.length; k++) fit(H[k], hMax);
    unify(H);
    for (k = 0; k < H.length; k++) {
      H[k].base = (prev === null ? P.top : prev + P.G * z) + capH(H[k].size, H[k].style);
      prev = H[k].base;
      head.push(H[k]);
    }
    if (head.length && below) {
      ruleY = prev + P.ruleBelow * z;
      grid0 = ruleY + P.ruleAbove * z + bodyCap;
    } else {
      grid0 = P.top + bodyCap;
    }

    // blocks on the baseline grid
    expand('center', CL.body, C, Infinity, 2);
    expand('right', CL.right, R, rMaxW, 2, CL.rhead);
    expand('left', CL.left, Lf, lMaxW, 2);
    expand('rightNote', CL.rnote, RN, rMaxW, 2);
    expand('leftNote', CL.lnote, LN, lMaxW, 2);
    // side lines are set to their column measure first; the centre may take some of it back below
    sideL = Lf.concat(LN); sideR = R.concat(RN);
    for (k = 0; k < sideL.length; k++) fit(sideL[k], lMaxW);
    for (k = 0; k < sideR.length; k++) fit(sideR[k], rMaxW);
    unify(sideL);
    unify(sideR);
    var rRow = head.length ? -1 : 0;
    for (k = 0; k < C.length; k++) C[k].base = grid0 + k * L;
    for (k = 0; k < R.length; k++) R[k].base = grid0 + (rRow + k) * L;
    for (k = 0; k < Lf.length; k++) Lf[k].base = grid0 + (P.leftRow + k) * L;

    // the right block steps down a row if a wide header line would run into it
    if (R.length) {
      rw = 0; shift = 0; capTop = R[0].base - bodyCap;
      for (k = 0; k < R.length; k++) rw = Math.max(rw, Math.min(widthOf(R[k]), rMaxW));
      for (k = 0; k < head.length; k++) {
        if (cx + widthOf(head[k]) / 2 + gap > rA - rw / 2) shift = Math.max(shift, band(head[k])[1] + 1 - capTop);
      }
      if (shift > 0) {
        shift = Math.ceil(shift / L) * L;
        for (k = 0; k < R.length; k++) R[k].base += shift;
      }
    }
    // right note: on the last centre row, at least two rows under the right block
    if (RN.length) {
      rnBase = (C.length ? C[C.length - 1].base : grid0) + P.rNoteDy * z;
      if (R.length) rnBase = Math.max(rnBase, R[R.length - 1].base + 2 * L + P.rNoteDy * z);
      for (k = 0; k < RN.length; k++) RN[k].base = rnBase + k * L * RN[k].size / CL.body.size;
    }
    // left note: under a short rule below the left lines (same gap from rule to cap top at any
    // size), or alone on the first grid row; a smaller note is set on a tighter leading
    if (LN.length) {
      lnBase = grid0;
      if (Lf.length) {
        lRule = Lf[Lf.length - 1].base + P.lRuleBelow * z;
        lnBase = lRule + P.lNoteBelow * z - (capH(CL.lnote.size, 'normal') - capH(LN[0].size, 'normal'));
      }
      for (k = 0; k < LN.length; k++) LN[k].base = lnBase + k * 1.2 * LN[k].size;
    }

    // centre lines first, assuming the side lines beside them take at most their nominal column
    for (k = 0; k < C.length; k++) {
      lo = xL; hi = W - xL;
      for (j = 0; j < sideL.length; j++) if (crosses(C[k], sideL[j])) lo = Math.max(lo, xL + Math.min(widthOf(sideL[j]), leftNomR - xL) + gap);
      for (j = 0; j < sideR.length; j++) if (crosses(C[k], sideR[j])) hi = Math.min(hi, rA - Math.min(widthOf(sideR[j]) / 2, rA - rightNomL) - gap);
      fit(C[k], 2 * Math.max(5, Math.min(cx - lo, hi - cx)));
    }
    unify(C);
    for (k = 0; k < C.length; k++) {
      C[k].x0 = cx - widthOf(C[k]) / 2;
      C[k].x1 = cx + widthOf(C[k]) / 2;
    }
    // then each side line takes its column measure, less what the centre lines beside it need
    for (k = 0; k < sideL.length; k++) {
      lo = null;
      for (j = 0; j < C.length; j++) if (crosses(sideL[k], C[j])) lo = lo === null ? C[j].x0 - gap : Math.min(lo, C[j].x0 - gap);
      fit(sideL[k], Math.max(5, Math.min(lMaxW, lo === null ? lMaxW : lo - xL)));
    }
    for (k = 0; k < sideR.length; k++) {
      hi = null;
      for (j = 0; j < C.length; j++) if (crosses(sideR[k], C[j])) hi = hi === null ? C[j].x1 + gap : Math.max(hi, C[j].x1 + gap);
      fit(sideR[k], Math.max(5, Math.min(rMaxW, hi === null ? rMaxW : 2 * (rA - hi))));
    }
    unify(sideL);
    unify(sideR);

    // squeezed lines are broken on the next pass: header and centre lines first (the side
    // columns depend on them), then the side lines
    need = squeezed(head.concat(C));
    if (!need.length) need = squeezed(sideR.concat(sideL));
    // the rule is as long as the type it separates, at most P.ruleW
    rw2 = 0;
    for (k = 0; k < head.length; k++) rw2 = Math.max(rw2, widthOf(head[k]));
    for (k = 0; k < C.length; k++) rw2 = Math.max(rw2, widthOf(C[k]));
    return { head: head, C: C, R: R, Lf: Lf, RN: RN, LN: LN, ruleY: ruleY, ruleW: Math.min(P.ruleW, rw2 || P.ruleW), lRule: lRule, need: need };
  }
  // layout at scale z, breaking squeezed lines until none is left (or a few passes)
  function settle(z) {
    var key, i, lay, guard = 0;
    WR = {};
    for (key in TXT) if (TXT.hasOwnProperty(key)) { WR[key] = []; for (i = 0; i < TXT[key].length; i++) WR[key].push(0); }
    lay = layout(z);
    while (lay.need.length && guard++ < 6) {
      for (i = 0; i < lay.need.length; i++) WR[lay.need[i].key][lay.need[i].src] = lay.need[i].lim;
      lay = layout(z);
    }
    return lay;
  }
  function bottomOf(lay) {
    var all = lay.head.concat(lay.C, lay.R, lay.RN, lay.Lf, lay.LN), b = -1, i;
    for (i = 0; i < all.length; i++) b = Math.max(b, inkBottom(all[i]));
    if (lay.ruleY !== null) b = Math.max(b, lay.ruleY + P.ruleT / 2);
    if (lay.lRule !== null && lay.Lf.length) b = Math.max(b, lay.lRule + P.lRuleT / 2);
    return b;
  }
  function drawLine(ln, x, align) {
    var w = widthOf(ln), xx, i, r, tc, opts;
    xx = align === 'center' ? x - w / 2 : x;
    doc.setFont('times', ln.style);
    tc = ln.tr * ln.size;
    for (i = 0; i < ln.runs.length; i++) {
      r = ln.runs[i];
      if (!r.sp) {
        doc.setFontSize(ln.size * r.k);
        opts = { horizontalScale: ln.hs };
        if (tc) opts.charSpace = tc;
        doc.text(r.t, xx, ln.base, opts);
      }
      xx += (r.u * ln.size + tc * r.t.length) * ln.hs;
    }
    bottom = Math.max(bottom, inkBottom(ln));
  }
  function fallbackY() {
    var m = NaN;
    try { m = +M; } catch (e) { }
    return Math.max(0, (m > 0 && isFinite(m) ? m : 54) - 26);
  }

  try {
    if (!doc || typeof doc.text !== 'function') return fallbackY();
    if (!f || typeof f !== 'object') f = {};
    W = +W;
    if (!(W > 200) || !isFinite(W)) W = (doc.internal && doc.internal.pageSize) ? +doc.internal.pageSize.getWidth() || 612 : 612;
    if (typeof doc.saveGraphicsState === 'function') { doc.saveGraphicsState(); stateSaved = true; }
    doc.setTextColor(0);
    doc.setDrawColor(0);
    if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
    if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([], 0);

    useSC = !(f.smallCaps === false || f.smallCaps === 'false' || f.smallCaps === 0);
    TXT = {
      line1: lines(oneLine(f.line1)), name: lines(oneLine(f.name)), line3: lines(oneLine(f.line3)),
      center: lines(f.center), right: lines(f.right), left: lines(f.left),
      rightNote: lines(oneLine(f.rightNote)), leftNote: lines(oneLine(f.leftNote))
    };
    var hasSides = !!(TXT.left.length || TXT.right.length || TXT.leftNote.length || TXT.rightNote.length);
    below = hasSides || TXT.center.length > 0;

    // ---------- columns ----------
    xL = Math.max(P.edge, P.xL);
    cx = W / 2 + (hasSides ? P.cxOff : 0);
    rA = W - P.rAxis;
    leftNomR = cx - P.colC / 2 - gap;              // nominal right edge of the left column
    rightNomL = cx + P.colC / 2 + gap;             // nominal left edge of the right column
    rHalf = Math.min(W - P.edge, W - xL + 1.5) - rA;   // right lines stay inside the type area
    hMax = 2 * Math.min(cx - xL, W - xL - cx);
    // fixed side measures: side lines break at these before they are set smaller
    lMaxW = Math.max(20, Math.min(150, cx - gap - 40 - xL));
    rMaxW = 2 * Math.max(10, Math.min(rA - (cx + P.colC / 2), rHalf));

    // ---------- fit; a letterhead running past CAP is set at the largest scale that ends above it ----------
    var lay = settle(1), low = bottomOf(lay), best = null, zLo = 0, zHi = 1, z, guard = 0;
    if (low > CAP) {
      z = 0.99 * (CAP - P.top) / (low - P.top);      // proportional guess, then bisection
      while (guard++ < 12) {
        lay = settle(z);
        low = bottomOf(lay);
        if (low > CAP) zHi = z;
        else { zLo = z; best = lay; if (CAP - low < 3) break; }
        if (zHi - zLo < 0.004) break;
        z = best ? (zLo + zHi) / 2 : z * 0.99 * (CAP - P.top) / (low - P.top);
      }
      if (best) lay = best;
    }

    // ---------- draw ----------
    var i, lw;
    for (i = 0; i < lay.head.length; i++) drawLine(lay.head[i], cx, 'center');
    if (lay.ruleY !== null) {
      doc.setLineWidth(P.ruleT);
      doc.line(cx - lay.ruleW / 2, lay.ruleY, cx + lay.ruleW / 2, lay.ruleY);
      bottom = Math.max(bottom, lay.ruleY + P.ruleT / 2);
    }
    for (i = 0; i < lay.C.length; i++) drawLine(lay.C[i], cx, 'center');
    for (i = 0; i < lay.R.length; i++) drawLine(lay.R[i], rA, 'center');
    for (i = 0; i < lay.RN.length; i++) drawLine(lay.RN[i], rA, 'center');
    for (i = 0; i < lay.Lf.length; i++) drawLine(lay.Lf[i], xL, 'left');
    if (lay.lRule !== null && lay.Lf.length) {
      lw = 0;
      for (i = 0; i < lay.Lf.length; i++) lw = Math.max(lw, widthOf(lay.Lf[i]));
      doc.setLineWidth(P.lRuleT);
      doc.line(xL, lay.lRule, xL + Math.min(P.lRuleW, lw), lay.lRule);
      bottom = Math.max(bottom, lay.lRule + P.lRuleT / 2);
    }
    for (i = 0; i < lay.LN.length; i++) drawLine(lay.LN[i], xL, 'left');
  } catch (e) {
    // never throw: whatever was drawn stays and the invoice continues below it
  }
  try {
    if (stateSaved) doc.restoreGraphicsState();     // also drops the horizontal text scale (Tz)
    if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
    doc.setFont('times', 'normal');
    doc.setTextColor(0);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
  } catch (e2) { }
  if (!(bottom > 0) || !isFinite(bottom)) bottom = fallbackY();
  return bottom;
}
