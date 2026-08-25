/*
 * Text-contrast audit for the desktop tree.
 *
 * Paste the exported string into a browser console on any page, or evaluate it
 * through a driver, and it returns every text rule on that page whose contrast
 * against its real painted backdrop is under the WCAG AA floor.
 *
 * Why this exists rather than a unit test: mobile's contrast can be checked
 * from tokens alone (lib/__tests__/mobile-contrast.test.ts) because that tree
 * paints flat surfaces. The desktop tree does not — its failures came from
 * opacity multipliers stacking, gradient fills, and two rules dimming the same
 * text by different mechanisms. None of those are visible in a stylesheet; all
 * of them need the composited result of an actual render.
 *
 * It measures rather than guesses:
 *   - backdrops are composited by walking elementsFromPoint bottom-up, not by
 *     reading one ancestor's background-color
 *   - the sample point is the text's own client rect, so a label inside a large
 *     container is measured where its glyphs are
 *   - gradient fills are expanded to their stops and scored at the worst one,
 *     but only linear/conic — radial gradients in this codebase are 0.6px
 *     sparkle overlays and scoring their bright stops as a fill reported a
 *     readable gold button as 1.27:1
 *   - background-clip:text is skipped on both sides: it is not measurable from
 *     `color`, and it is not a surface behind its siblings
 *   - the AA floor follows the large-text rule (3:1 at >=24px, or >=18.66px bold)
 *   - disabled text is measured and reported under `inactive`, not dropped
 *
 * That last one used to be a `continue`. WCAG 1.4.3 exempts inactive user
 * interface components, so skipping them is defensible for a greyed-out
 * button nobody needs to read — but the exemption is about controls, and
 * `:disabled` is not a reliable proxy for "nobody needs to read this". The
 * intake step rail is four disabled buttons whose labels are the only thing
 * telling a first-time visitor the form has four steps; they measured 1.43:1
 * and this audit reported the page clean. So disabled text is measured like
 * anything else and returned separately: `results` stays the list of AA
 * violations, `inactive` is the list a human has to judge, because the
 * question it asks — is this an inactive control, or is it content that
 * happens to sit on one? — is not one a stylesheet can answer.
 *
 * Caveat for headless/hidden viewports: rAF does not fire, so framer-motion
 * elements freeze at whatever inline opacity they stopped on and CSS
 * transitions never resolve. The preamble undoes exactly that and nothing
 * else — clearing motion's inline opacity, adding the class ScrollReveal's
 * IntersectionObserver would have added, and finishing frozen CSS animations.
 * Without it the audit reports most of a page as unreadable.
 *
 * Findings are grouped by (class, colour, size, weight): the output is a list
 * of rules to fix, not a list of nodes.
 */

export const CONTRAST_AUDIT = String.raw`
(() => {
  let s = document.getElementById('__contrastAudit');
  if (!s) { s = document.createElement('style'); s.id = '__contrastAudit'; document.head.appendChild(s); }
  s.textContent = '*, *::before, *::after { transition: none !important; }';
  for (const el of document.querySelectorAll('[style*="opacity"]')) {
    const io = el.style.opacity;
    if (io !== '' && Number(io) < 1) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); }
  }
  document.querySelectorAll('.scroll-reveal').forEach(e => e.classList.add('visible'));
  for (const a of document.getAnimations()) { try { a.finish(); } catch (e) {} }

  const parse = c => { const m = (c.match(/[\d.]+/g) || [0,0,0]).map(Number); return m.length === 3 ? [...m,1] : m; };
  const over = (f,b) => { const a = f[3]; return [0,1,2].map(i => f[i]*a + b[i]*(1-a)).concat(1); };
  const chan = v => { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const lum = a => 0.2126*chan(a[0]) + 0.7152*chan(a[1]) + 0.0722*chan(a[2]);
  const ratio = (a,b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
  const hex = c => '#' + c.slice(0,3).map(v => Math.round(v).toString(16).padStart(2,'0')).join('');

  const stopsOf = bgImage => {
    if (!bgImage || bgImage === 'none') return [];
    const out = [];
    const re = /(linear|conic)-gradient\(/gi;
    let m;
    while ((m = re.exec(bgImage))) {
      let depth = 1, i = re.lastIndex;
      while (i < bgImage.length && depth > 0) {
        if (bgImage[i] === '(') depth++; else if (bgImage[i] === ')') depth--;
        i++;
      }
      for (const c of bgImage.slice(re.lastIndex, i - 1).match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi) || []) {
        const p = parse(c);
        if (p[3] > 0) out.push(p);
      }
    }
    return out;
  };

  const textRect = el => {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!node) return el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
    return rects.length ? rects[0] : el.getBoundingClientRect();
  };

  const backdrops = el => {
    const r0 = textRect(el);
    if (r0.top < 0 || r0.bottom > innerHeight) el.scrollIntoView({ block: 'center' });
    const b = textRect(el);
    const x = Math.round(b.left + Math.min(b.width/2, 25)), y = Math.round(b.top + b.height/2);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
    const stack = document.elementsFromPoint(x, y);
    if (!stack.length) return null;
    let base = [10,10,15,1], variants = null;
    for (let i = stack.length - 1; i >= 0; i--) {
      const cs = getComputedStyle(stack[i]);
      if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') continue;
      const o = Number(cs.opacity), mul = isNaN(o) ? 1 : o;
      const bg = parse(cs.backgroundColor);
      if (bg[3] > 0) base = over([bg[0],bg[1],bg[2], bg[3]*mul], base);
      const st = stopsOf(cs.backgroundImage);
      if (st.length) variants = st.map(c => over([c[0],c[1],c[2], c[3]*mul], base));
    }
    return variants && variants.length ? variants : [base];
  };

  const off = el => !!(el.closest('[disabled]') || (el.matches && el.matches(':disabled')));

  const chainOpacity = el => {
    let o = 1, n = el;
    while (n && n !== document.documentElement) { const v = Number(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; }
    return o;
  };

  const groups = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT','STYLE','NOSCRIPT','TITLE'].includes(el.tagName)) continue;
    if (el.namespaceURI && el.namespaceURI.includes('svg')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (el.querySelector && el.querySelector('select, option, optgroup')) continue;
    const key = (el.className||'').toString().slice(0,60) + '|' + cs.color + '|' + cs.fontSize + '|' + cs.fontWeight + '|' + off(el);
    if (!groups.has(key)) groups.set(key, el);
  }

  const label = el => (el.className||'').toString().split(/\s+/).map(c => c.split('__').pop()).join(' ').slice(0,42) || el.tagName;
  const results = [], inactive = [], unmeasurable = [];
  for (const [, el] of groups) {
    const cs = getComputedStyle(el);
    const bds = backdrops(el);
    if (!bds) continue;
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const floor = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
    const fg = parse(cs.color);
    const clipped = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
    const alpha = fg[3] * chainOpacity(el);
    if (clipped || alpha < 0.05) {
      unmeasurable.push({ cls: label(el), why: clipped ? 'background-clip:text' : 'alpha ' + alpha.toFixed(2) });
      continue;
    }
    let worst = null;
    for (const bd of bds) {
      const eff = over([fg[0],fg[1],fg[2], alpha], bd);
      const rr = ratio(eff, bd);
      if (!worst || rr < worst.rr) worst = { rr, bd, eff };
    }
    if (worst.rr < floor) {
      const row = { cls: label(el), px: cs.fontSize, weight, ratio: +worst.rr.toFixed(2), floor,
                    fg: hex(worst.eff), bg: hex(worst.bd), text: (el.textContent||'').trim().replace(/\s+/g,' ').slice(0,26) };
      (off(el) ? inactive : results).push(row);
    }
  }
  results.sort((a,b) => a.ratio - b.ratio);
  inactive.sort((a,b) => a.ratio - b.ratio);
  return { url: location.pathname, checked: groups.size, failures: results.length, results, inactive, unmeasurable };
})()
`;

export default CONTRAST_AUDIT;
