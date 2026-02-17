const { useMemo, useRef, useState } = React;

/* ─── Constants ─── */

const MAX_STEP = 6;
const AREA_VP = { w: 820, h: 560 };
const MINI_VP = { w: 820, h: 400 };
const PAD = 60;
const CURVE_SAMPLES = 200;
const SVG_FONT = '"Manrope", "Segoe UI", system-ui, sans-serif';
const SVG_MONO = '"Space Mono", "SFMono-Regular", Consolas, monospace';

const PRESETS = [
  { label: "x\u00b2 + 6x + 5",          a: 1,  b: 6,   c: 5  },
  { label: "x\u00b2 \u2212 4x + 1",     a: 1,  b: -4,  c: 1  },
  { label: "2x\u00b2 + 12x + 7",        a: 2,  b: 12,  c: 7  },
  { label: "\u2212x\u00b2 + 8x \u2212 3", a: -1, b: 8,   c: -3 },
  { label: "x\u00b2 + 2x + 1",          a: 1,  b: 2,   c: 1  },
];

/* ─── Math Utilities ─── */

function evaluateQuadratic(a, b, c, x) {
  return a * x * x + b * x + c;
}

function getDiscriminant(a, b, c) {
  return b * b - 4 * a * c;
}

function getRoots(a, b, c) {
  if (a === 0) {
    if (b === 0) return [];
    return [-c / b];
  }
  const disc = getDiscriminant(a, b, c);
  if (disc < 0) return [];
  if (Math.abs(disc) < 1e-12) return [-b / (2 * a)];
  const sqrtDisc = Math.sqrt(disc);
  const r1 = (-b - sqrtDisc) / (2 * a);
  const r2 = (-b + sqrtDisc) / (2 * a);
  return [r1, r2].sort((x, y) => x - y);
}

function getVertex(a, b, c) {
  if (a === 0) return { x: NaN, y: NaN };
  const x = -b / (2 * a);
  const y = evaluateQuadratic(a, b, c, x);
  return { x, y };
}

/* ─── Fraction Arithmetic ─── */

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

/** Create a reduced fraction { n, d } with d > 0.
 *  If inputs are not integers (irrational / decimal coefficients),
 *  stores the numeric value and marks irrational so formatters
 *  fall back to decimal display. */
function Q(num, den) {
  if (den === 0) return { n: 0, d: 1 };
  if (!Number.isInteger(num) || !Number.isInteger(den)) {
    return { n: num / den, d: 1, irrational: true };
  }
  const sign = den < 0 ? -1 : 1;
  const g = gcd(Math.abs(num), Math.abs(den));
  return { n: (sign * num) / g, d: Math.abs(den) / g };
}

/* ── String formatters (for clipboard copy / plain-text contexts) ── */

function fmtQStr(q) {
  if (q.irrational) return fmtNumber(q.n);
  if (q.d === 1) return q.n < 0 ? `\u2212${Math.abs(q.n)}` : String(q.n);
  if (q.n < 0) return `\u2212${Math.abs(q.n)}/${q.d}`;
  return `${q.n}/${q.d}`;
}

function fmtQAbsStr(q) {
  if (q.irrational) return fmtNumber(Math.abs(q.n));
  if (q.d === 1) return String(Math.abs(q.n));
  return `${Math.abs(q.n)}/${q.d}`;
}

function fmtQSignedStr(q) {
  if (q.n >= 0) return `+ ${fmtQAbsStr(q)}`;
  return `\u2212 ${fmtQAbsStr(q)}`;
}

/* ── HTML fraction component ── */

function Frac({ n, d }) {
  return (
    <span className="frac">
      <span className="frac-num">{n}</span>
      <span className="frac-den">{d}</span>
    </span>
  );
}

/* ── JSX formatters (return string for integers, JSX for real fractions) ── */

function fmtQ(q) {
  if (q.irrational) return fmtNumber(q.n);
  if (q.d === 1) return q.n < 0 ? `\u2212${Math.abs(q.n)}` : String(q.n);
  const sign = q.n < 0 ? "\u2212" : "";
  return <>{sign}<Frac n={Math.abs(q.n)} d={q.d} /></>;
}

function fmtQAbs(q) {
  if (q.irrational) return fmtNumber(Math.abs(q.n));
  if (q.d === 1) return String(Math.abs(q.n));
  return <Frac n={Math.abs(q.n)} d={q.d} />;
}

function fmtQSigned(q) {
  if (q.n >= 0) return <><span>+ </span>{fmtQAbs(q)}</>;
  return <><span>{"\u2212 "}</span>{fmtQAbs(q)}</>;
}

/* ── Fraction helpers ── */

function qIsZero(q) { return q.n === 0; }
function qIsPos(q) { return q.n > 0; }
function qIsNeg(q) { return q.n < 0; }
function qVal(q) { return q.n / q.d; }

/* ─── Completing the Square Steps ─── */

function getCompletingSteps(a, b, c) {
  // Numeric values (used for geometry/graphing)
  const p = b / a;
  const halfP = p / 2;
  const halfPSq = halfP * halfP;
  const h = -halfP;
  const k = c - a * halfPSq;

  // Exact fractions (used for display)
  const pF = Q(b, a);                         // p = b/a
  const halfPF = Q(b, 2 * a);                 // p/2 = b/(2a)
  const halfPSqF = Q(b * b, 4 * a * a);       // (p/2)² = b²/(4a²)
  const hF = Q(-b, 2 * a);                    // h = −b/(2a)
  const kF = Q(4 * a * c - b * b, 4 * a);     // k = c − b²/(4a)
  const cOverAF = Q(c, a);                    // c/a
  const remainderF = Q(4 * a * c - b * b, 4 * a * a); // c/a − (p/2)²

  return { p, halfP, halfPSq, h, k, pF, halfPF, halfPSqF, hF, kF, cOverAF, remainderF };
}

/* ─── Formatting ─── */

function fmtNumber(n) {
  if (!Number.isFinite(n)) return "\u2014";
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

function formatQuadratic(a, b, c) {
  let s = "";
  if (a === 1) s += "x\u00b2";
  else if (a === -1) s += "\u2212x\u00b2";
  else s += `${fmtNumber(a)}x\u00b2`;
  if (b !== 0) {
    if (b === 1) s += " + x";
    else if (b === -1) s += " \u2212 x";
    else if (b > 0) s += ` + ${fmtNumber(b)}x`;
    else s += ` \u2212 ${fmtNumber(Math.abs(b))}x`;
  }
  if (c !== 0) {
    if (c > 0) s += ` + ${fmtNumber(c)}`;
    else s += ` \u2212 ${fmtNumber(Math.abs(c))}`;
  }
  return s;
}

/** JSX version of vertex form — for rendering in HTML */
function formatVertexForm(a, hF, kF) {
  return (
    <>
      {a === 1 ? "" : a === -1 ? "\u2212" : fmtNumber(a)}
      {qIsZero(hF)
        ? "x\u00b2"
        : qIsPos(hF)
          ? <>(x {"\u2212 "}{fmtQAbs(hF)}){"\u00b2"}</>
          : <>(x + {fmtQAbs(hF)}){"\u00b2"}</>}
      {!qIsZero(kF) && (
        qIsPos(kF) ? <> + {fmtQAbs(kF)}</> : <> {"\u2212 "}{fmtQAbs(kF)}</>
      )}
    </>
  );
}

/** String version of vertex form — for clipboard copy */
function formatVertexFormStr(a, hF, kF) {
  let s = "";
  if (a === 1) s += "";
  else if (a === -1) s += "\u2212";
  else s += fmtNumber(a);
  if (qIsZero(hF)) s += "x\u00b2";
  else if (qIsPos(hF)) s += `(x \u2212 ${fmtQAbsStr(hF)})\u00b2`;
  else s += `(x + ${fmtQAbsStr(hF)})\u00b2`;
  if (!qIsZero(kF)) {
    if (qIsPos(kF)) s += ` + ${fmtQAbsStr(kF)}`;
    else s += ` \u2212 ${fmtQAbsStr(kF)}`;
  }
  return s;
}

/* ─── SVG Coordinate Utilities ─── */

function getAutoViewRange(a, b, c) {
  const roots = getRoots(a, b, c);
  const vertex = getVertex(a, b, c);
  let center = Number.isFinite(vertex.x) ? vertex.x : 0;
  let halfWidth = 6;

  if (roots.length >= 2) {
    const span = roots[1] - roots[0];
    center = (roots[0] + roots[1]) / 2;
    halfWidth = Math.max(4, span * 0.8);
  } else if (roots.length === 1) {
    center = roots[0];
    halfWidth = 5;
  }
  halfWidth = Math.min(Math.max(halfWidth, 3), 20);

  const xMin = center - halfWidth;
  const xMax = center + halfWidth;

  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const x = xMin + (i / CURVE_SAMPLES) * (xMax - xMin);
    const y = evaluateQuadratic(a, b, c, x);
    if (Number.isFinite(y)) {
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  if (!Number.isFinite(yMin)) { yMin = -10; yMax = 10; }
  const yPad = Math.max(1, (yMax - yMin) * 0.15);
  yMin -= yPad;
  yMax += yPad;
  if (yMin > 0) yMin = Math.min(-1, yMin);
  if (yMax < 0) yMax = Math.max(1, yMax);
  return { xMin, xMax, yMin, yMax };
}

function toSvg(mathX, mathY, bounds, vp) {
  const plotW = vp.w - PAD * 2;
  const plotH = vp.h - PAD * 2;
  const xRatio = (mathX - bounds.xMin) / (bounds.xMax - bounds.xMin);
  const yRatio = (mathY - bounds.yMin) / (bounds.yMax - bounds.yMin);
  return {
    x: PAD + xRatio * plotW,
    y: vp.h - PAD - yRatio * plotH,
  };
}

/* ─── SVG Fraction Label ─── */
/*
 * Renders a horizontal sequence of text segments and stacked fractions in SVG.
 *
 * `parts` is an array where each element is:
 *   - A string: rendered as plain SVG text
 *   - { q: fractionObj }:               rendered as the fraction value
 *   - { q: fractionObj, abs: true }:    rendered as the absolute value
 *   - { q: fractionObj, signed: true }: rendered with explicit sign ("+ 3/4" or "− 1/2")
 *
 * Integer fractions (d === 1) render as plain text. Real fractions (d > 1)
 * render as stacked numerator / bar / denominator.
 */

function SvgFracLabel({ x, y, parts, fontSize, fill, fontWeight, textAnchor }) {
  fontSize = fontSize || 14;
  fill = fill || "var(--ink)";
  fontWeight = fontWeight || 400;
  textAnchor = textAnchor || "middle";

  const CW = fontSize * 0.62;
  const SMALL_FS = Math.round(fontSize * 0.82);
  const SMALL_CW = SMALL_FS * 0.62;

  // Measure and classify each part
  const items = parts.map((part) => {
    if (typeof part === "string") {
      return { type: "text", text: part, w: part.length * CW };
    }

    const q = part.q;
    const isAbs = !!part.abs;
    const isSigned = !!part.signed;

    // Irrational → decimal text
    if (q.irrational) {
      const val = isAbs ? Math.abs(q.n) : q.n;
      let s;
      if (isSigned) {
        s = val >= 0 ? `+ ${fmtNumber(Math.abs(val))}` : `\u2212 ${fmtNumber(Math.abs(val))}`;
      } else {
        s = fmtNumber(val);
      }
      return { type: "text", text: s, w: s.length * CW };
    }

    // Integer fraction → plain text
    if (q.d === 1) {
      let s;
      if (isSigned) {
        s = q.n >= 0 ? `+ ${Math.abs(q.n)}` : `\u2212 ${Math.abs(q.n)}`;
      } else if (isAbs) {
        s = String(Math.abs(q.n));
      } else {
        s = q.n < 0 ? `\u2212${Math.abs(q.n)}` : String(q.n);
      }
      return { type: "text", text: s, w: s.length * CW };
    }

    // Real fraction → stacked rendering
    let prefix = "";
    if (isSigned) {
      prefix = q.n >= 0 ? "+ " : "\u2212 ";
    } else if (!isAbs && q.n < 0) {
      prefix = "\u2212";
    }
    const numStr = String(Math.abs(q.n));
    const denStr = String(q.d);
    const barW = Math.max(numStr.length, denStr.length) * SMALL_CW + 8;
    const prefixW = prefix.length * CW;
    return { type: "frac", prefix, numStr, denStr, barW, prefixW, w: prefixW + barW };
  });

  // Total width and starting x
  const totalW = items.reduce((s, item) => s + item.w, 0);
  let startX;
  if (textAnchor === "middle") startX = x - totalW / 2;
  else if (textAnchor === "end") startX = x - totalW;
  else startX = x;

  // Precompute x positions
  const positions = [];
  let cx = startX;
  items.forEach((item) => {
    positions.push(cx);
    cx += item.w;
  });

  return (
    <g>
      {items.map((item, i) => {
        const ix = positions[i];

        if (item.type === "text") {
          return (
            <text key={i} x={ix} y={y} dominantBaseline="middle"
              fontSize={fontSize} fontFamily={SVG_MONO} fill={fill} fontWeight={fontWeight}>
              {item.text}
            </text>
          );
        }

        // Stacked fraction
        return (
          <g key={i}>
            {item.prefix && (
              <text x={ix} y={y} dominantBaseline="middle"
                fontSize={fontSize} fontFamily={SVG_MONO} fill={fill} fontWeight={fontWeight}>
                {item.prefix}
              </text>
            )}
            <text x={ix + item.prefixW + item.barW / 2} y={y - fontSize * 0.45}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={SMALL_FS} fontFamily={SVG_MONO} fill={fill} fontWeight={fontWeight}>
              {item.numStr}
            </text>
            <line
              x1={ix + item.prefixW + 2} y1={y - 1}
              x2={ix + item.prefixW + item.barW - 2} y2={y - 1}
              stroke={fill} strokeWidth="1.2"
            />
            <text x={ix + item.prefixW + item.barW / 2} y={y + fontSize * 0.45}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={SMALL_FS} fontFamily={SVG_MONO} fill={fill} fontWeight={fontWeight}>
              {item.denStr}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ─── Export Utilities ─── */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function svgToString(svgEl, vp) {
  const clone = svgEl.cloneNode(true);
  const w = vp ? vp.w : 820;
  const h = vp ? vp.h : 560;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", "#f8f9ff");
  clone.insertBefore(bg, clone.firstChild);
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(clone)}`;
}

function exportSvg(svgEl, filename, vp) {
  const str = svgToString(svgEl, vp);
  downloadBlob(new Blob([str], { type: "image/svg+xml;charset=utf-8" }), filename);
}

async function exportPng(svgEl, filename, vp, scale = 2) {
  const str = svgToString(svgEl, vp);
  const svgBlob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    const w = (vp ? vp.w : 820) * scale;
    const h = (vp ? vp.h : 560) * scale;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function openMagnifiedGraph(svgEl, title) {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const svgMarkup = serializer.serializeToString(svgEl);
  const popup = window.open("", "_blank", "width=1400,height=1000,scrollbars=yes,resizable=yes");
  if (!popup) return;
  popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    :root {
      --ink: #0b0d17;
      --sky: #f7f3ea;
      --accent: #ff6b3d;
      --accent-dark: #d24720;
      --panel: #ffffff;
      --muted: rgba(11, 13, 23, 0.55);
      --border: rgba(15, 23, 42, 0.12);
      --area-x2: rgba(59, 130, 246, 0.14);
      --area-x2-solid: #3b82f6;
      --area-bx: rgba(245, 158, 11, 0.14);
      --area-bx-solid: #f59e0b;
      --area-complete: rgba(255, 107, 61, 0.22);
      --area-complete-solid: #ff6b3d;
      --area-const: rgba(15, 23, 42, 0.06);
      --area-const-solid: rgba(11, 13, 23, 0.45);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f8f9ff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      font-family: "Manrope", "Segoe UI", system-ui, sans-serif;
    }
    .wrap { width: 100%; max-width: 1300px; text-align: center; }
    h2 {
      font-family: "Fraunces", "Times New Roman", serif;
      font-size: 1.4rem;
      color: #0b0d17;
      margin-bottom: 16px;
    }
    svg {
      width: 100%;
      height: auto;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 12px 40px rgba(10, 14, 30, 0.10);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>${title}</h2>
    ${svgMarkup}
  </div>
</body>
</html>`);
  popup.document.close();
}

/* ─── Step Content Generator ─── */

function getStepContent(step, a, b, c, cs) {
  const aIsOne = a === 1;
  const aIsNeg1 = a === -1;
  const quadStr = formatQuadratic(a, b, c);

  return [
    // Step 0: State the Quadratic
    {
      label: "Step 1 of 7",
      heading: "State the Quadratic",
      body: "We want to convert this quadratic from standard form into vertex form: a(x \u2212 h)\u00b2 + k. This reveals the vertex of the parabola directly.",
      math: (
        <div className="math-display">
          <div>Standard form: {quadStr}</div>
          <div>Target: a(x {"\u2212"} h){"\u00b2"} + k</div>
        </div>
      ),
    },
    // Step 1: Factor out a
    {
      label: "Step 2 of 7",
      heading: "Factor Out the Leading Coefficient",
      body: aIsOne
        ? "The leading coefficient is already 1, so we can work directly with the expression. We need the x\u00b2 coefficient to be 1 before completing the square."
        : aIsNeg1
          ? "Factor out \u22121 from all terms so the x\u00b2 coefficient inside is 1."
          : <>Factor out {fmtNumber(a)} from all terms so the x{"\u00b2"} coefficient inside is 1.</>,
      math: (
        <div className="math-display">
          {aIsOne ? (
            <div>{quadStr}</div>
          ) : (
            <div>{aIsNeg1 ? "\u2212" : fmtNumber(a)}(x{"\u00b2 "}{fmtQSigned(cs.pF)}x {fmtQSigned(cs.cOverAF)})</div>
          )}
        </div>
      ),
    },
    // Step 2: Identify linear coefficient
    {
      label: "Step 3 of 7",
      heading: "Identify the Linear Coefficient",
      body: <>Inside the brackets, the coefficient of x is {fmtQ(cs.pF)}. We need half of this value: {fmtQ(cs.pF)} {"\u00f7"} 2 = {fmtQ(cs.halfPF)}.</>,
      math: (
        <div className="math-display">
          <div>Linear coefficient: p = {fmtQ(cs.pF)}</div>
          <div>Half of p: p/2 = {fmtQ(cs.halfPF)}</div>
        </div>
      ),
    },
    // Step 3: Find the magic number
    {
      label: "Step 4 of 7",
      heading: 'Find the "Magic Number"',
      body: <>Square the half-coefficient to get the number that completes the square: ({fmtQ(cs.halfPF)}){"\u00b2"} = {fmtQ(cs.halfPSqF)}. This is the area of the missing corner piece in the geometric model.</>,
      math: (
        <div className="math-display">
          <div>(p/2){"\u00b2"} = ({fmtQ(cs.halfPF)}){"\u00b2"} = {fmtQ(cs.halfPSqF)}</div>
        </div>
      ),
    },
    // Step 4: Complete the square
    {
      label: "Step 5 of 7",
      heading: "Complete the Square",
      body: <>Add and subtract {fmtQ(cs.halfPSqF)} inside the brackets. Adding it creates a perfect square trinomial; subtracting it keeps the expression equivalent.</>,
      math: (() => {
        const inner = <>x{"\u00b2 "}{fmtQSigned(cs.pF)}x + {fmtQ(cs.halfPSqF)} {"\u2212 "}{fmtQAbs(cs.halfPSqF)} {fmtQSigned(cs.cOverAF)}</>;
        return (
          <div className="math-display">
            {aIsOne ? (
              <div>{inner}</div>
            ) : (
              <div>{aIsNeg1 ? "\u2212" : fmtNumber(a)}({inner})</div>
            )}
            <div style={{ marginTop: 8, color: "var(--accent-dark)", fontWeight: 600 }}>
              {"\u2191"} perfect square trinomial
            </div>
          </div>
        );
      })(),
    },
    // Step 5: Write vertex form
    {
      label: "Step 6 of 7",
      heading: "Rewrite in Vertex Form",
      body: <>The perfect square trinomial x{"\u00b2 "}{fmtQSigned(cs.pF)}x + {fmtQ(cs.halfPSqF)} factors as (x {fmtQSigned(cs.halfPF)}){"\u00b2"}. Collect the remaining constants and distribute a.</>,
      math: (() => {
        const binSq = qIsNeg(cs.halfPF)
          ? <>(x {"\u2212 "}{fmtQAbs(cs.halfPF)}){"\u00b2"}</>
          : <>(x + {fmtQAbs(cs.halfPF)}){"\u00b2"}</>;
        return (
          <div className="math-display">
            {!aIsOne && (
              <div>{aIsNeg1 ? "\u2212" : fmtNumber(a)}[{binSq} {fmtQSigned(cs.remainderF)}]</div>
            )}
            <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>= {formatVertexForm(a, cs.hF, cs.kF)}</div>
          </div>
        );
      })(),
    },
    // Step 6: Verify with graph
    {
      label: "Step 7 of 7",
      heading: "Verify with the Graph",
      body: <>The vertex form {formatVertexForm(a, cs.hF, cs.kF)} tells us the vertex is at ({fmtQ(cs.hF)}, {fmtQ(cs.kF)}). The parabola opens {a > 0 ? "upward" : "downward"} because a {a > 0 ? "> 0" : "< 0"}.</>,
      math: (
        <div className="math-display">
          <div>Vertex form: y = {formatVertexForm(a, cs.hF, cs.kF)}</div>
          <div>Vertex: ({fmtQ(cs.hF)}, {fmtQ(cs.kF)})</div>
          <div>Opens: {a > 0 ? "upward (a > 0)" : "downward (a < 0)"}</div>
        </div>
      ),
      isFinal: true,
    },
  ][step] || null;
}

/* ─── React Components ─── */

function Breadcrumb() {
  return (
    <nav className="breadcrumb">
      <a href="../../../">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      </a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../">Algebra</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../">Quadratics</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <span className="breadcrumb-current">Completing the Square</span>
    </nav>
  );
}

function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="hamburger-btn" onClick={() => setIsOpen(true)} aria-label="Open menu">
        <svg viewBox="0 0 24 24">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div className={`menu-overlay${isOpen ? " open" : ""}`} onClick={() => setIsOpen(false)}></div>

      <div className={`menu-panel${isOpen ? " open" : ""}`}>
        <div className="menu-section">
          <div className="menu-section-title">Navigate</div>
          <a href="../../../" className="menu-link">🏠 Home</a>
        </div>

        <div className="menu-divider"></div>

        <div className="menu-section">
          <div className="menu-section-title">Algebra</div>
          <a href="../../" className="menu-link">Quadratics</a>
          <a href="../quadratic-equation/" className="menu-link indent">Quadratic Graph Studio</a>
          <a href="../quadratic-inequality/" className="menu-link indent">Inequality Solver</a>
          <a href="../quadratic-inequality-region/" className="menu-link indent">Inequality Regions</a>
          <a href="../parabola-transformations/" className="menu-link indent">Transformations</a>
          <a href="../discriminant-visualizer/" className="menu-link indent">Discriminant</a>
          <a href="../completing-the-square/" className="menu-link indent active">Completing the Square</a>
          <a href="../sketch-binomial-factors/" className="menu-link indent">Binomial Multiplication</a>
          <a href="../quadratic-form-converter/" className="menu-link indent">Form Converter</a>
        </div>

        <div className="menu-divider"></div>

        <div className="menu-section">
          <div className="menu-section-title">Coming Soon</div>
          <span className="menu-link" style={{opacity: 0.5, cursor: 'not-allowed'}}>Geometry</span>
          <span className="menu-link" style={{opacity: 0.5, cursor: 'not-allowed'}}>Calculus</span>
        </div>
      </div>
    </>
  );
}

function RelatedTools() {
  const tools = [
    {
      name: "Quadratic Graph Studio",
      href: "../quadratic-equation/",
      desc: "Explore parabolas with sliders and real-time updates"
    },
    {
      name: "Inequality Solver",
      href: "../quadratic-inequality/",
      desc: "Solve inequalities with sign analysis and intervals"
    },
    {
      name: "Binomial Multiplication",
      href: "../sketch-binomial-factors/",
      desc: "Visualize FOIL method with area model diagrams"
    }
  ];

  return (
    <div className="related-tools">
      <h3 className="related-tools-title">Related Tools</h3>
      <div className="related-tools-grid">
        {tools.map((tool, i) => (
          <a key={i} href={tool.href} className="related-tool-link">
            <div className="related-tool-name">{tool.name}</div>
            <p className="related-tool-desc">{tool.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <header className="hero">
      <p className="eyebrow">Math Lab</p>
      <h1>Completing the Square</h1>
      <p className="subhead">
        Convert any quadratic into vertex form with a step-by-step geometric
        and algebraic walkthrough. See <em>why</em> it's called completing
        the square.
      </p>
    </header>
  );
}

function CoefInput({ label, value, onChange }) {
  return (
    <div className="coef-group">
      <label>{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || v === "-") { onChange(v); return; }
          const n = Number(v);
          if (Number.isFinite(n)) onChange(n);
        }}
        aria-label={`Coefficient ${label}`}
      />
    </div>
  );
}

function InputPanel({ a, b, c, onAChange, onBChange, onCChange, onPreset }) {
  return (
    <div className="input-panel">
      <div className="coef-row">
        <CoefInput label="a" value={a} onChange={onAChange} />
        <span className="coef-formula">x<sup>2</sup> +</span>
        <CoefInput label="b" value={b} onChange={onBChange} />
        <span className="coef-formula">x +</span>
        <CoefInput label="c" value={c} onChange={onCChange} />
      </div>
      <div className="presets">
        {PRESETS.map((p, i) => (
          <button key={i} className="preset-btn" onClick={() => onPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepNav({ step, onStep }) {
  return (
    <div className="step-nav">
      <button className="nav-btn" disabled={step <= 0} onClick={() => onStep(step - 1)} aria-label="Previous step">
        &larr; Back
      </button>
      <div className="step-dots">
        {Array.from({ length: MAX_STEP + 1 }, (_, i) => (
          <button
            key={i}
            className={`step-dot${i === step ? " active" : i < step ? " completed" : ""}`}
            onClick={() => onStep(i)}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>
      <button className="nav-btn" disabled={step >= MAX_STEP} onClick={() => onStep(step + 1)} aria-label="Next step">
        Next &rarr;
      </button>
    </div>
  );
}

/* ─── Area Model SVG ─── */

function AreaModelSvg({ a, b, c, cs, step, svgRef }) {
  const fade = (on) => ({
    opacity: on ? 1 : 0,
    transition: "opacity 420ms ease",
  });

  // Work inside-brackets: x² + px + (c/a)
  const absP = Math.abs(cs.p);
  const absHalfP = Math.abs(cs.halfP);

  // We represent x as a symbolic unit length; pick a "base" size for x
  const xSize = 4;

  // Total sizes for the completed square
  const fullSide = xSize + absHalfP;
  const constSize = Math.max(0.6, Math.min(2, Math.sqrt(Math.abs(cs.p !== 0 ? qVal(cs.cOverAF) : c))));

  // Scale to fit viewport
  const maxW = AREA_VP.w - PAD * 2 - 40;
  const maxH = AREA_VP.h - PAD * 2 - 40;

  const needsWidth = step <= 2 ? (xSize + absP + constSize + 1.5) : (fullSide + constSize + 1.5);
  const needsHeight = step <= 2 ? Math.max(xSize, absP, constSize) : fullSide;

  const scale = useMemo(() => {
    const sW = maxW / Math.max(needsWidth, 0.1);
    const sH = maxH / Math.max(needsHeight, 0.1);
    const s = Math.min(sW, sH);
    return Number.isFinite(s) && s > 0 ? Math.min(s, 120) : 60;
  }, [needsWidth, needsHeight, maxW, maxH]);

  // Pixel dimensions
  const pxX = xSize * scale;
  const pxHalfP = absHalfP * scale;
  const pxP = absP * scale;
  const pxConst = constSize * scale;
  const pxFull = fullSide * scale;

  // Centering offset
  const totalUsedW = step <= 2 ? (pxX + 12 + pxP + 12 + pxConst) : (pxFull + 16 + pxConst);
  const totalUsedH = step <= 2 ? pxX : pxFull;
  const offX = PAD + Math.max(0, (maxW - totalUsedW) / 2);
  const offY = PAD + 20 + Math.max(0, (maxH - totalUsedH) / 2);

  // Show flags
  const showSeparated = step <= 1;
  const showSplit = step === 2;
  const showRearranged = step >= 3 && step <= 5;
  const showGap = step === 3;
  const showFilled = step >= 4;
  const showLabels = step >= 4;
  const showFinalForm = step === 5;
  const showBracket = !!(step >= 1 && a !== 1);

  // Color fills
  const fillX2 = "var(--area-x2)";
  const fillBx = "var(--area-bx)";
  const fillComplete = "var(--area-complete)";
  const fillConst = "var(--area-const)";

  const strokeX2 = "var(--area-x2-solid)";
  const strokeBx = "var(--area-bx-solid)";
  const strokeComplete = "var(--area-complete-solid)";

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${AREA_VP.w} ${AREA_VP.h}`} role="img" aria-label="Area model for completing the square">
      <style>{`text { font-family: ${SVG_FONT}; }`}</style>

      {/* ── Steps 0-1: Separated pieces ── */}
      <g style={fade(showSeparated)}>
        {/* x² square */}
        <rect x={offX} y={offY} width={pxX} height={pxX} fill={fillX2} stroke={strokeX2} strokeWidth="2" rx="4" />
        <text x={offX + pxX / 2} y={offY + pxX / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontFamily={SVG_MONO} fill="var(--ink)" fontWeight="700">
          x²
        </text>
        <text x={offX + pxX / 2} y={offY - 10} textAnchor="middle" dominantBaseline="middle"
          fontSize="13" fontFamily={SVG_MONO} fill="rgba(11, 13, 23, 0.55)">x</text>
        <text x={offX - 10} y={offY + pxX / 2} textAnchor="end" dominantBaseline="middle"
          fontSize="13" fontFamily={SVG_MONO} fill="rgba(11, 13, 23, 0.55)">x</text>

        {/* px rectangle */}
        <rect x={offX + pxX + 12} y={offY} width={pxP} height={pxX} fill={fillBx} stroke={strokeBx} strokeWidth="2" rx="4" />
        <SvgFracLabel x={offX + pxX + 12 + pxP / 2} y={offY + pxX / 2}
          parts={[{q: cs.pF}, "x"]} fontSize={14} fill="var(--ink)" fontWeight={700} />
        <SvgFracLabel x={offX + pxX + 12 + pxP / 2} y={offY - 10}
          parts={["|", {q: cs.pF}, "| = ", {q: cs.pF, abs: true}]} fontSize={13} fill="rgba(11, 13, 23, 0.55)" />

        {/* c/a constant square */}
        <rect x={offX + pxX + 12 + pxP + 12} y={offY} width={pxConst} height={pxConst} fill={fillConst} stroke="rgba(15, 23, 42, 0.2)" strokeWidth="1.5" rx="4" />
        <SvgFracLabel x={offX + pxX + 12 + pxP + 12 + pxConst / 2} y={offY + pxConst / 2}
          parts={[{q: cs.cOverAF}]} fontSize={12} fill="rgba(11, 13, 23, 0.7)" />
      </g>

      {/* ── Step 2: Split the rectangle ── */}
      <g style={fade(showSplit)}>
        {/* x² square */}
        <rect x={offX} y={offY} width={pxX} height={pxX} fill={fillX2} stroke={strokeX2} strokeWidth="2" rx="4" />
        <text x={offX + pxX / 2} y={offY + pxX / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontFamily={SVG_MONO} fill="var(--ink)" fontWeight="700">
          x²
        </text>
        <text x={offX + pxX / 2} y={offY - 10} textAnchor="middle" dominantBaseline="middle"
          fontSize="13" fontFamily={SVG_MONO} fill="rgba(11, 13, 23, 0.55)">x</text>
        <text x={offX - 10} y={offY + pxX / 2} textAnchor="end" dominantBaseline="middle"
          fontSize="13" fontFamily={SVG_MONO} fill="rgba(11, 13, 23, 0.55)">x</text>

        {/* First half of px rectangle */}
        <rect x={offX + pxX + 12} y={offY} width={pxHalfP} height={pxX} fill={fillBx} stroke={strokeBx} strokeWidth="2" rx="4" />
        <SvgFracLabel x={offX + pxX + 12 + pxHalfP / 2} y={offY + pxX / 2}
          parts={[{q: cs.halfPF}, "x"]} fontSize={12} fill="rgba(11, 13, 23, 0.7)" />
        <SvgFracLabel x={offX + pxX + 12 + pxHalfP / 2} y={offY - 10}
          parts={[{q: cs.halfPF, abs: true}]} fontSize={13} fill="rgba(11, 13, 23, 0.55)" />

        {/* Second half of px rectangle */}
        <rect x={offX + pxX + 12 + pxHalfP + 6} y={offY} width={pxHalfP} height={pxX} fill={fillBx} stroke={strokeBx} strokeWidth="2" rx="4" />
        <SvgFracLabel x={offX + pxX + 12 + pxHalfP + 6 + pxHalfP / 2} y={offY + pxX / 2}
          parts={[{q: cs.halfPF}, "x"]} fontSize={12} fill="rgba(11, 13, 23, 0.7)" />
        <SvgFracLabel x={offX + pxX + 12 + pxHalfP + 6 + pxHalfP / 2} y={offY - 10}
          parts={[{q: cs.halfPF, abs: true}]} fontSize={13} fill="rgba(11, 13, 23, 0.55)" />

        {/* Dashed cut line */}
        <line
          x1={offX + pxX + 12 + pxHalfP + 3}
          y1={offY - 6}
          x2={offX + pxX + 12 + pxHalfP + 3}
          y2={offY + pxX + 6}
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />

        {/* c/a constant square */}
        <rect x={offX + pxX + 12 + pxHalfP * 2 + 18} y={offY} width={pxConst} height={pxConst} fill={fillConst} stroke="rgba(15, 23, 42, 0.2)" strokeWidth="1.5" rx="4" />
        <SvgFracLabel x={offX + pxX + 12 + pxHalfP * 2 + 18 + pxConst / 2} y={offY + pxConst / 2}
          parts={[{q: cs.cOverAF}]} fontSize={12} fill="rgba(11, 13, 23, 0.7)" />

        {/* "Split in half" annotation */}
        <text x={offX + pxX + 12 + pxHalfP + 3} y={offY + pxX + 28} textAnchor="middle"
          fontSize="13" fontFamily={SVG_MONO} fill="var(--accent-dark)" fontWeight="600">
          split in half
        </text>
      </g>

      {/* ── Steps 3-5: Rearranged L-shape / completed square ── */}
      <g style={fade(showRearranged)}>
        {/* x² square (top-left) */}
        <rect x={offX} y={offY} width={pxX} height={pxX} fill={fillX2} stroke={strokeX2} strokeWidth="2" rx="4" />
        <text x={offX + pxX / 2} y={offY + pxX / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontFamily={SVG_MONO} fill="var(--ink)" fontWeight="700">
          x²
        </text>

        {/* Right half-rectangle (x × p/2) */}
        <rect x={offX + pxX} y={offY} width={pxHalfP} height={pxX} fill={fillBx} stroke={strokeBx} strokeWidth="2" rx="2" />
        <SvgFracLabel x={offX + pxX + pxHalfP / 2} y={offY + pxX / 2}
          parts={[{q: cs.halfPF}, "x"]} fontSize={11} fill="rgba(11, 13, 23, 0.7)" />

        {/* Bottom half-rectangle (p/2 × x) */}
        <rect x={offX} y={offY + pxX} width={pxX} height={pxHalfP} fill={fillBx} stroke={strokeBx} strokeWidth="2" rx="2" />
        <SvgFracLabel x={offX + pxX / 2} y={offY + pxX + pxHalfP / 2}
          parts={[{q: cs.halfPF}, "x"]} fontSize={11} fill="rgba(11, 13, 23, 0.7)" />

        {/* Corner gap / completed piece */}
        {showGap && (
          <rect x={offX + pxX} y={offY + pxX} width={pxHalfP} height={pxHalfP}
            fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="8 5" rx="2" />
        )}
        {showGap && (
          <text x={offX + pxX + pxHalfP / 2} y={offY + pxX + pxHalfP / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize="12" fontFamily={SVG_MONO} fill="var(--accent-dark)" fontWeight="700">
            ?
          </text>
        )}

        {showFilled && (
          <rect x={offX + pxX} y={offY + pxX} width={pxHalfP} height={pxHalfP}
            fill={fillComplete} stroke={strokeComplete} strokeWidth="2.5" rx="2" />
        )}
        {showFilled && (
          <SvgFracLabel x={offX + pxX + pxHalfP / 2} y={offY + pxX + pxHalfP / 2}
            parts={[{q: cs.halfPSqF}]} fontSize={11} fill="var(--accent-dark)" fontWeight={700} />
        )}

        {/* Outer border of completed square */}
        {showFilled && (
          <rect x={offX} y={offY} width={pxFull} height={pxFull}
            fill="none" stroke="var(--ink)" strokeWidth="3" rx="6" />
        )}

        {/* Edge labels for completed square */}
        {showLabels && (
          <g>
            <SvgFracLabel x={offX + pxFull / 2} y={offY - 12}
              parts={["x ", {q: cs.halfPF, signed: true}]} fontSize={14} fill="var(--ink)" fontWeight={700} />
            <SvgFracLabel x={offX - 14} y={offY + pxFull / 2} textAnchor="end"
              parts={["x ", {q: cs.halfPF, signed: true}]} fontSize={14} fill="var(--ink)" fontWeight={700} />
          </g>
        )}

        {/* Center label on step 5 */}
        {showFinalForm && (
          <SvgFracLabel x={offX + pxFull / 2} y={offY + pxFull + 30}
            parts={["= (x ", {q: cs.halfPF, signed: true}, ")\u00b2"]} fontSize={16} fill="var(--ink)" fontWeight={700} />
        )}

        {/* Constant piece to the side */}
        {step >= 3 && (
          <g>
            <rect x={offX + pxFull + 16} y={offY} width={pxConst} height={pxConst}
              fill={fillConst} stroke="rgba(15, 23, 42, 0.2)" strokeWidth="1.5" rx="4" />
            <SvgFracLabel x={offX + pxFull + 16 + pxConst / 2} y={offY + pxConst / 2}
              parts={[{q: cs.cOverAF}]} fontSize={11} fill="rgba(11, 13, 23, 0.7)" />
          </g>
        )}

        {/* Step 3: label pointing at gap */}
        {showGap && (
          <SvgFracLabel x={offX + pxX + pxHalfP + 16} y={offY + pxX + pxHalfP / 2} textAnchor="start"
            parts={["missing: (", {q: cs.halfPF}, ")\u00b2 = ", {q: cs.halfPSqF}]}
            fontSize={13} fill="var(--accent-dark)" fontWeight={600} />
        )}

        {/* Step 4-5: "-halfPSq" annotation */}
        {showFilled && !showFinalForm && (
          <SvgFracLabel x={offX + pxFull / 2} y={offY + pxFull + 28}
            parts={["added ", {q: cs.halfPSqF}, ", so subtract ", {q: cs.halfPSqF}]}
            fontSize={13} fill="var(--accent-dark)" fontWeight={600} />
        )}
      </g>

      {/* Bracket annotation when a ≠ 1 */}
      {showBracket && step <= 5 && (
        <g style={fade(true)}>
          <path
            d={`M ${offX - 28} ${offY - 4} Q ${offX - 36} ${offY - 4} ${offX - 36} ${offY + 6} L ${offX - 36} ${offY + (step <= 2 ? pxX : pxFull) - 6} Q ${offX - 36} ${offY + (step <= 2 ? pxX : pxFull) + 4} ${offX - 28} ${offY + (step <= 2 ? pxX : pxFull) + 4}`}
            fill="none" stroke="var(--muted)" strokeWidth="1.5"
          />
          <text x={offX - 44} y={offY + (step <= 2 ? pxX : pxFull) / 2}
            textAnchor="end" dominantBaseline="middle"
            fontSize="18" fontFamily={SVG_MONO} fill="var(--ink)" fontWeight="700">
            {a === -1 ? "\u2212" : fmtNumber(a)}
          </text>
        </g>
      )}

      {/* Note about absolute lengths */}
      {cs.p < 0 && step >= 1 && step <= 5 && (
        <text x={AREA_VP.w / 2} y={AREA_VP.h - 14} textAnchor="middle"
          fontSize="11" fill="rgba(210, 71, 32, 0.7)">
          Note: geometry uses absolute lengths; algebraic signs are preserved in the formulas.
        </text>
      )}
    </svg>
  );
}

/* ─── Mini Parabola (step 6) ─── */

function MiniParabola({ a, b, c, cs, svgRef }) {
  const bounds = useMemo(() => getAutoViewRange(a, b, c), [a, b, c]);

  const curvePoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateQuadratic(a, b, c, mx);
      if (Number.isFinite(my)) {
        const s = toSvg(mx, my, bounds, MINI_VP);
        const cy = Math.max(-50, Math.min(MINI_VP.h + 50, s.y));
        pts.push(`${s.x.toFixed(2)},${cy.toFixed(2)}`);
      }
    }
    return pts.join(" ");
  }, [a, b, c, bounds]);

  // Grid
  const gridData = useMemo(() => {
    const lines = [];
    const labels = [];
    const xRange = bounds.xMax - bounds.xMin;
    const yRange = bounds.yMax - bounds.yMin;
    const xStep = xRange > 30 ? 5 : xRange > 12 ? 2 : 1;
    const yStep = yRange > 30 ? 5 : yRange > 12 ? 2 : 1;

    for (let gx = Math.ceil(bounds.xMin / xStep) * xStep; gx <= bounds.xMax; gx += xStep) {
      const s = toSvg(gx, 0, bounds, MINI_VP);
      lines.push({ x1: s.x, y1: PAD, x2: s.x, y2: MINI_VP.h - PAD });
      if (gx !== 0) labels.push({ x: s.x, y: toSvg(0, 0, bounds, MINI_VP).y + 16, text: fmtNumber(gx), anchor: "middle" });
    }
    for (let gy = Math.ceil(bounds.yMin / yStep) * yStep; gy <= bounds.yMax; gy += yStep) {
      const s = toSvg(0, gy, bounds, MINI_VP);
      lines.push({ x1: PAD, y1: s.y, x2: MINI_VP.w - PAD, y2: s.y });
      if (gy !== 0) labels.push({ x: toSvg(0, 0, bounds, MINI_VP).x - 8, y: s.y + 4, text: fmtNumber(gy), anchor: "end" });
    }
    return { lines, labels };
  }, [bounds]);

  // Axis positions
  const origin = toSvg(0, 0, bounds, MINI_VP);
  const vertexSvg = toSvg(cs.h, cs.k, bounds, MINI_VP);

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${MINI_VP.w} ${MINI_VP.h}`} role="img" aria-label="Parabola graph">
      <defs>
        <clipPath id="mini-plot">
          <rect x={PAD} y={PAD - 10} width={MINI_VP.w - PAD * 2} height={MINI_VP.h - PAD * 2 + 20} />
        </clipPath>
      </defs>

      {/* Grid */}
      {gridData.lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(15, 23, 42, 0.06)" strokeWidth="1" />
      ))}

      {/* Axes */}
      <line x1={PAD} y1={origin.y} x2={MINI_VP.w - PAD} y2={origin.y} stroke="rgba(15, 23, 42, 0.25)" strokeWidth="1.5" />
      <line x1={origin.x} y1={PAD} x2={origin.x} y2={MINI_VP.h - PAD} stroke="rgba(15, 23, 42, 0.25)" strokeWidth="1.5" />

      {/* Grid labels */}
      {gridData.labels.map((lb, i) => (
        <text key={i} x={lb.x} y={lb.y} textAnchor={lb.anchor} fontSize="11" fontFamily={SVG_MONO} fill="rgba(11, 13, 23, 0.35)">
          {lb.text}
        </text>
      ))}

      {/* Curve */}
      <g clipPath="url(#mini-plot)">
        <polyline points={curvePoints} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      </g>

      {/* Vertex dot */}
      <circle cx={vertexSvg.x} cy={vertexSvg.y} r="7" fill="var(--accent)" stroke="#fff" strokeWidth="2.5" />

      {/* Vertex label */}
      <SvgFracLabel x={vertexSvg.x + 14} y={vertexSvg.y - 12} textAnchor="start"
        parts={["(", {q: cs.hF}, ", ", {q: cs.kF}, ")"]}
        fontSize={14} fill="var(--accent-dark)" fontWeight={700} />

      {/* "vertex" annotation */}
      <text x={vertexSvg.x + 14} y={vertexSvg.y + 6}
        fontSize="11" fontFamily={SVG_FONT} fill="var(--muted)">
        vertex
      </text>
    </svg>
  );
}

/* ─── Explanation Panel ─── */

function ExplanationPanel({ content }) {
  if (!content) return null;
  return (
    <div className="explanation-card" key={content.label}>
      <div className="step-label">{content.label}</div>
      <h3>{content.heading}</h3>
      <p>{content.body}</p>
      {content.math}
    </div>
  );
}

/* ─── Result Card ─── */

function ResultCard({ a, cs }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const str = formatVertexFormStr(a, cs.hF, cs.kF);
    navigator.clipboard.writeText(`y = ${str}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="result-card">
      <h3>Vertex Form</h3>
      <div className="result-equation">
        y = {formatVertexForm(a, cs.hF, cs.kF)}
      </div>
      <div className="result-detail">
        Vertex: ({fmtQ(cs.hF)}, {fmtQ(cs.kF)})
      </div>
      <div className="result-detail">
        Axis of symmetry: x = {fmtQ(cs.hF)}
      </div>
      <button className="copy-btn" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy vertex form"}
      </button>
    </div>
  );
}

/* ─── Export Footer ─── */

function ExportFooter({ svgRef, a, b, c, step }) {
  const vp = step >= MAX_STEP ? MINI_VP : AREA_VP;
  const base = `completing-square-${a}-${b}-${c}`;
  return (
    <div className="export-footer">
      <button onClick={() => exportSvg(svgRef.current, `${base}.svg`, vp)} disabled={!svgRef.current}>
        Export SVG
      </button>
      <button onClick={() => exportPng(svgRef.current, `${base}.png`, vp)} disabled={!svgRef.current}>
        Export PNG
      </button>
    </div>
  );
}

/* ─── App Root ─── */

function App() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(6);
  const [c, setC] = useState(5);
  const [step, setStep] = useState(0);

  const areaSvgRef = useRef(null);
  const miniSvgRef = useRef(null);

  const numA = typeof a === "number" ? a : 0;
  const numB = typeof b === "number" ? b : 0;
  const numC = typeof c === "number" ? c : 0;

  const error = numA === 0 ? "The leading coefficient a must be non-zero for a quadratic." : null;

  const cs = useMemo(() => {
    if (numA === 0) return null;
    return getCompletingSteps(numA, numB, numC);
  }, [numA, numB, numC]);

  const content = useMemo(() => {
    if (!cs) return null;
    return getStepContent(step, numA, numB, numC, cs);
  }, [step, numA, numB, numC, cs]);

  const quadStr = formatQuadratic(numA, numB, numC);

  function handlePreset(preset) {
    setA(preset.a);
    setB(preset.b);
    setC(preset.c);
    setStep(0);
  }

  function safeSetStep(s) {
    setStep(Math.max(0, Math.min(MAX_STEP, s)));
  }

  const activeSvgRef = step >= MAX_STEP ? miniSvgRef : areaSvgRef;

  return (
    <>
      <HamburgerMenu />
      <div className="page">
        <Breadcrumb />
        <HeroSection />
        <InputPanel
          a={a} b={b} c={c}
          onAChange={(v) => { setA(v); setStep(0); }}
          onBChange={(v) => { setB(v); setStep(0); }}
          onCChange={(v) => { setC(v); setStep(0); }}
          onPreset={handlePreset}
        />

        {error && <div className="error-banner">{error}</div>}

        {!error && cs ? (
          <>
            <div className="main-grid">
              <div className="graph-card">
                <div className="svg-container">
                  {step < MAX_STEP ? (
                    <AreaModelSvg a={numA} b={numB} c={numC} cs={cs} step={step} svgRef={areaSvgRef} />
                  ) : (
                    <MiniParabola a={numA} b={numB} c={numC} cs={cs} svgRef={miniSvgRef} />
                  )}
                </div>
                <div className="graph-toolbar">
                  <button className="magnify-btn" onClick={() => openMagnifiedGraph(activeSvgRef.current, quadStr)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="16.5" y1="16.5" x2="21" y2="21" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                      <line x1="11" y1="8" x2="11" y2="14" />
                    </svg>
                    Magnify
                  </button>
                </div>
              </div>

              <div className="sidebar">
                <ExplanationPanel content={content} />
                {step >= MAX_STEP && <ResultCard a={numA} cs={cs} />}
              </div>
            </div>

            <StepNav step={step} onStep={safeSetStep} />
            <ExportFooter svgRef={activeSvgRef} a={numA} b={numB} c={numC} step={step} />
            <RelatedTools />
          </>
        ) : !error && (
          <div className="graph-card">
            <div className="no-graph">Set a non-zero value for <strong>a</strong> to start.</div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Mount ─── */

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
