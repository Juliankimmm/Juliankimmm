/*
 * drawTypedLetterhead(doc, f, W, M) -> bottomY
 *
 * Typeset law-firm letterhead drawn with jsPDF's built-in Times faces (vector text only).
 *
 * Typographic system
 *   - Small caps: each lowercase letter is set as its capital at P.sc of the line size; every
 *     glyph of a line sits on one baseline. All small-caps classes share one horizontal set
 *     width P.hs (PDF Tz), restored on exit together with the rest of the graphics state.
 *   - Type classes (size pt / tracking em):  head  = line1, line3          (Times Roman)
 *                                             name  = firm name             (Times Bold)
 *                                             body  = centre, left, right   (Times Roman)
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
 */
function drawTypedLetterhead(doc, f, W, M) {
  var P = /*P*/{
    top: 47.65, xL: 43.6117, rAxis: 118.8317, cxOff: -2.44, sc: 0.78, hs: 1.132,
    sHead: 11.2, trHead: 0.09,
    sName: 17.7, trName: 0.1042,
    sBody: 11.193, trBody: 0.0072,
    sRNote: 9.0286, trRNote: 0.08,
    sLNote: 9.108, trLNote: 0, hsLNote: 1.1343,
    G: 6.4, ruleBelow: 7.2, ruleAbove: 7.4, ruleW: 138.6, ruleT: 1,
    L: 11.75, leftRow: 0.6, lRuleBelow: 7.1, lNoteBelow: 9.2, lRuleW: 106.2, lRuleT: 1,
    rNoteDy: -1.3, gap: 12, edge: 24, colC: 208, minK: 0.7
  }/*P*/;

  var bottom = -1;
  var stateSaved = false;
  var cs0 = 0;

  // ---------- text helpers ----------
  // characters the built-in (WinAnsi) Times can show; anything else is dropped
  var WIN = { 338: 1, 339: 1, 352: 1, 353: 1, 376: 1, 381: 1, 382: 1, 402: 1, 710: 1, 732: 1, 8211: 1, 8212: 1,
    8216: 1, 8217: 1, 8218: 1, 8220: 1, 8221: 1, 8222: 1, 8224: 1, 8225: 1, 8226: 1, 8230: 1, 8240: 1,
    8249: 1, 8250: 1, 8364: 1, 8482: 1 };
  function showable(t) {
    var i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (!((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || WIN[c])) return false;
    }
    return true;
  }
  function str(v) {
    var s = typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''), out = '', i, ch;
    s = s.replace(/\t/g, ' ');
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (ch === '\n' || ch === '\r' || showable(ch)) out += ch;
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
  function descOf(t, size) { return size * (/[gjpqyQJ(),;@\[\]{}|\/_$]/.test(t) ? 0.218 : 0.02); }

  // runs of equal size: lowercase letters become capitals at the small-cap size
  function runsOf(text, sc) {
    var out = [], i, ch, up, small, last = null;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      up = sc ? ch.toUpperCase() : ch;
      if (up !== ch && !showable(up)) up = ch;
      small = up !== ch;
      if (last && last.small === small) last.t += up;
      else { last = { t: up, small: small }; out.push(last); }
    }
    return out;
  }
  // advance width without kerning (jsPDF's Tj output is not kerned)
  function adv(t, size) {
    var w = 0, i;
    doc.setFontSize(size);
    for (i = 0; i < t.length; i++) w += doc.getTextWidth(t.charAt(i));
    return w;
  }
  // a set line; its width is linear in its size (tracking is in em)
  function makeLine(text, cls) {
    var ln = { text: text, style: cls.style, size: cls.size, size0: cls.size, tr: cls.tr, hs: cls.hs, lim: 0 };
    var runs = runsOf(text, cls.sc), u = 0, n = 0, i;
    doc.setFont('times', cls.style);
    for (i = 0; i < runs.length; i++) {
      runs[i].k = runs[i].small ? P.sc : 1;
      runs[i].u = adv(runs[i].t, 1) * runs[i].k;
      u += runs[i].u;
      n += runs[i].t.length;
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
  function band(ln) { return [ln.base - capH(ln.size, ln.style) - 1, ln.base + descOf(ln.text, ln.size) + 1]; }
  function crosses(a, b) { var p = band(a), q = band(b); return p[0] < q[1] && q[0] < p[1]; }

  // break a line into pieces no wider than maxW, preferring a break after a comma;
  // without comma breaks the pieces are balanced (narrowest measure giving as few lines)
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
  function breakText(text, cls, maxW) {
    var m = wordMetrics(text, cls), best = greedy(m, maxW), k = best.length, lo, hi, mid, t, it;
    if (k < 2 || best.usedComma) return best;
    lo = spanW(m, 0, m.words.length) / k; hi = maxW;
    for (it = 0; it < 14 && hi - lo > 0.5; it++) {
      mid = (lo + hi) / 2;
      t = greedy(m, mid);
      if (t.length <= k) { best = t; hi = mid; } else lo = mid;
    }
    return best;
  }
  function drawLine(ln, x, align) {
    var w = widthOf(ln), xx, i, r, tc, opts;
    xx = align === 'center' ? x - w / 2 : x;
    doc.setFont('times', ln.style);
    tc = ln.tr * ln.size;
    for (i = 0; i < ln.runs.length; i++) {
      r = ln.runs[i];
      doc.setFontSize(ln.size * r.k);
      opts = { horizontalScale: ln.hs };
      if (tc) opts.charSpace = tc;
      doc.text(r.t, xx, ln.base, opts);
      xx += (r.u * ln.size + tc * r.t.length) * ln.hs;
    }
    bottom = Math.max(bottom, ln.base + descOf(ln.text, ln.size));
  }

  try {
    if (!doc || typeof doc.text !== 'function') return 54;
    if (!f || typeof f !== 'object') f = {};
    W = +W;
    if (!(W > 200)) W = (doc.internal && doc.internal.pageSize) ? +doc.internal.pageSize.getWidth() || 612 : 612;
    if (typeof doc.saveGraphicsState === 'function') { doc.saveGraphicsState(); stateSaved = true; }
    doc.setTextColor(0);
    doc.setDrawColor(0);
    if (typeof doc.getCharSpace === 'function') cs0 = doc.getCharSpace() || 0;
    if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
    if (typeof doc.setLineDashPattern === 'function') doc.setLineDashPattern([], 0);

    var useSC = !(f.smallCaps === false || f.smallCaps === 'false' || f.smallCaps === 0);
    var trK = useSC ? 1 : 0.35;                    // mixed case takes far less tracking
    var CL = {
      head: { style: 'normal', size: P.sHead, tr: P.trHead * trK, hs: P.hs, sc: useSC },
      name: { style: 'bold', size: P.sName, tr: P.trName * trK, hs: P.hs, sc: useSC },
      body: { style: 'normal', size: P.sBody, tr: P.trBody * trK, hs: P.hs, sc: useSC },
      rnote: { style: 'normal', size: P.sRNote, tr: P.trRNote * trK, hs: P.hs, sc: useSC },
      lnote: { style: 'normal', size: P.sLNote, tr: P.trLNote, hs: P.hsLNote, sc: false }
    };

    var TXT = {
      line1: lines(oneLine(f.line1)), name: lines(oneLine(f.name)), line3: lines(oneLine(f.line3)),
      center: lines(f.center), right: lines(f.right), left: lines(f.left),
      rightNote: lines(oneLine(f.rightNote)), leftNote: lines(oneLine(f.leftNote))
    };
    var hasSides = !!(TXT.left.length || TXT.right.length || TXT.leftNote.length || TXT.rightNote.length);
    var below = hasSides || TXT.center.length > 0;

    // ---------- columns ----------
    var EDGE = P.edge, gap = P.gap, L = P.L;
    var xL = Math.max(EDGE, P.xL);
    var cx = W / 2 + (hasSides ? P.cxOff : 0);
    var rA = W - P.rAxis;
    var leftNomR = cx - P.colC / 2 - gap;          // nominal right edge of the left column
    var rightNomL = cx + P.colC / 2 + gap;         // nominal left edge of the right column
    var rHalf = Math.min(W - EDGE, W - xL + 1.5) - rA;   // right lines stay inside the type area
    var hMax = 2 * Math.min(cx - xL, W - xL - cx);
    var bodyCap = capH(CL.body.size, 'normal');

    // wrap state per source line: 0 = one line, > 0 = broken to that measure
    var WR = {}, key, i;
    for (key in TXT) if (TXT.hasOwnProperty(key)) { WR[key] = []; for (i = 0; i < TXT[key].length; i++) WR[key].push(0); }

    function layout() {
      var head = [], C = [], R = [], Lf = [], RN = [], LN = [], prev = null, ruleY = null, lRule = null, grid0, k, j;
      function expand(k2, cls, out) {
        var a, b, ps, l, src = TXT[k2];
        for (a = 0; a < src.length; a++) {
          ps = WR[k2][a] > 0 ? breakText(src[a], cls, WR[k2][a]) : [src[a]];
          for (b = 0; b < ps.length; b++) {
            l = makeLine(ps[b], cls);
            l.key = k2; l.src = a; l.wrapped = WR[k2][a] > 0;
            out.push(l);
          }
        }
        return out;
      }
      // header: stacked, centred, at most the type area wide
      var H = expand('line1', CL.head, []).concat(expand('name', CL.name, []), expand('line3', CL.head, []));
      for (k = 0; k < H.length; k++) {
        fit(H[k], hMax);
        H[k].base = (prev === null ? P.top : prev + P.G) + capH(H[k].size, H[k].style);
        prev = H[k].base;
        head.push(H[k]);
      }
      if (head.length && below) {
        ruleY = prev + P.ruleBelow;
        grid0 = ruleY + P.ruleAbove + bodyCap;
      } else {
        grid0 = P.top + bodyCap;
      }

      // blocks on the baseline grid
      expand('center', CL.body, C);
      expand('right', CL.body, R);
      expand('left', CL.body, Lf);
      expand('rightNote', CL.rnote, RN);
      expand('leftNote', CL.lnote, LN);
      var rRow = head.length ? -1 : 0;
      for (k = 0; k < C.length; k++) C[k].base = grid0 + k * L;
      for (k = 0; k < R.length; k++) R[k].base = grid0 + (rRow + k) * L;
      for (k = 0; k < Lf.length; k++) Lf[k].base = grid0 + (P.leftRow + k) * L;

      // the right block steps down a row if a wide header line would run into it
      if (R.length) {
        var rw = 0, shift = 0, capTop = R[0].base - bodyCap;
        for (k = 0; k < R.length; k++) rw = Math.max(rw, Math.min(widthOf(R[k]), 2 * rHalf));
        for (k = 0; k < head.length; k++) {
          if (cx + widthOf(head[k]) / 2 + gap > rA - rw / 2) shift = Math.max(shift, head[k].base + descOf(head[k].text, head[k].size) + 2 - capTop);
        }
        if (shift > 0) {
          shift = Math.ceil(shift / L) * L;
          for (k = 0; k < R.length; k++) R[k].base += shift;
        }
      }
      // right note: on the last centre row, at least two rows under the right block
      if (RN.length) {
        var rnBase = (C.length ? C[C.length - 1].base : grid0) + P.rNoteDy;
        if (R.length) rnBase = Math.max(rnBase, R[R.length - 1].base + 2 * L + P.rNoteDy);
        for (k = 0; k < RN.length; k++) RN[k].base = rnBase + k * L * CL.rnote.size / CL.body.size;
      }
      // left note: under a short rule below the left lines, or alone on the first grid row
      if (LN.length) {
        var lnBase = grid0;
        if (Lf.length) {
          lRule = Lf[Lf.length - 1].base + P.lRuleBelow;
          lnBase = lRule + P.lNoteBelow;
        }
        for (k = 0; k < LN.length; k++) LN[k].base = lnBase + k * 1.2 * CL.lnote.size;
      }

      // centre lines first, assuming the side lines beside them take at most their nominal column
      var sideL = Lf.concat(LN), sideR = R.concat(RN);
      for (k = 0; k < C.length; k++) {
        var lo = xL, hi = W - xL;
        for (j = 0; j < sideL.length; j++) if (crosses(C[k], sideL[j])) lo = Math.max(lo, xL + Math.min(widthOf(sideL[j]), leftNomR - xL) + gap);
        for (j = 0; j < sideR.length; j++) if (crosses(C[k], sideR[j])) hi = Math.min(hi, rA - Math.min(widthOf(sideR[j]) / 2, rA - rightNomL) - gap);
        fit(C[k], 2 * Math.max(5, Math.min(cx - lo, hi - cx)));
        C[k].x0 = cx - widthOf(C[k]) / 2;
        C[k].x1 = cx + widthOf(C[k]) / 2;
      }
      // then each side line takes the room the centre lines beside it leave
      function roomLeft(l) {
        var r = null, a;
        for (a = 0; a < C.length; a++) if (crosses(l, C[a])) r = (r === null) ? C[a].x0 - gap : Math.min(r, C[a].x0 - gap);
        if (r === null) r = Math.max(leftNomR, cx - gap);
        return Math.max(5, r - xL);
      }
      function roomRight(l) {
        var e = null, a;
        for (a = 0; a < C.length; a++) if (crosses(l, C[a])) e = (e === null) ? C[a].x1 + gap : Math.max(e, C[a].x1 + gap);
        if (e === null) e = rightNomL;
        return 2 * Math.max(2.5, Math.min(rA - e, rHalf));
      }
      for (k = 0; k < sideL.length; k++) fit(sideL[k], roomLeft(sideL[k]));
      for (k = 0; k < sideR.length; k++) fit(sideR[k], roomRight(sideR[k]));

      // unbroken lines squeezed below minK are broken on the next pass: header and centre
      // lines first (the side columns depend on them), then the side lines
      function squeezed(arr) {
        var out = [], a;
        for (a = 0; a < arr.length; a++) {
          if (!arr[a].wrapped && arr[a].size < P.minK * arr[a].size0 && arr[a].text.indexOf(' ') > 0) out.push(arr[a]);
        }
        return out;
      }
      var need = squeezed(head.concat(C));
      if (!need.length) need = squeezed(R.concat(Lf, RN, LN));
      // the rule is as long as the type it separates, at most P.ruleW
      var rw2 = 0;
      for (k = 0; k < head.length; k++) rw2 = Math.max(rw2, widthOf(head[k]));
      for (k = 0; k < C.length; k++) rw2 = Math.max(rw2, widthOf(C[k]));
      return { head: head, C: C, R: R, Lf: Lf, RN: RN, LN: LN, ruleY: ruleY, ruleW: Math.min(P.ruleW, rw2 || P.ruleW), lRule: lRule, need: need };
    }

    var lay = layout(), guard = 0;
    while (lay.need.length && guard++ < 6) {
      for (i = 0; i < lay.need.length; i++) WR[lay.need[i].key][lay.need[i].src] = lay.need[i].lim;
      lay = layout();
    }

    // ---------- draw ----------
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
    if (lay.lRule !== null) {
      var lw = 0;
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
    if (typeof doc.setCharSpace === 'function') doc.setCharSpace(cs0);
    doc.setFont('times', 'normal');
    doc.setTextColor(0);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
  } catch (e2) { }
  if (!(bottom > 0) || !isFinite(bottom)) bottom = Math.max(0, (+M > 0 ? +M : 54) - 26);
  return bottom;
}
