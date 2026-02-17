const { useMemo, useRef, useState } = React;

/* ─── Constants ─── */

const MAX_STEP = 6;
const GRAPH_VP = { w: 820, h: 560 };
const NUMLINE_VP = { w: 820, h: 120 };
const PAD = 60;
const CURVE_SAMPLES = 200;
const SVG_FONT = '"Manrope", "Segoe UI", system-ui, sans-serif';
const SVG_MONO = '"Space Mono", "SFMono-Regular", Consolas, monospace';

const INEQ_TYPES = [">", "\u2265", "<", "\u2264"];

const PRESETS = [
  { label: "x\u00b2 \u2212 5x + 6 > 0",      a: 1,  b: -5, c: 6,  ineq: ">"      },
  { label: "\u2212x\u00b2 + 4 \u2265 0",      a: -1, b: 0,  c: 4,  ineq: "\u2265" },
  { label: "x\u00b2 + 1 < 0",                 a: 1,  b: 0,  c: 1,  ineq: "<"      },
  { label: "x\u00b2 \u2212 6x + 9 \u2264 0",  a: 1,  b: -6, c: 9,  ineq: "\u2264" },
  { label: "2x\u00b2 + 3x \u2212 2 \u2265 0", a: 2,  b: 3,  c: -2, ineq: "\u2265" },
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

function matchesInequality(value, ineqType) {
  switch (ineqType) {
    case ">":      return value > 1e-10;
    case "\u2265": return value >= -1e-10;
    case "<":      return value < -1e-10;
    case "\u2264": return value <= 1e-10;
    default:       return false;
  }
}

function isStrictInequality(ineqType) {
  return ineqType === ">" || ineqType === "<";
}

function isPositiveDirection(ineqType) {
  return ineqType === ">" || ineqType === "\u2265";
}

function getTestPoints(roots) {
  if (roots.length === 0) return [0];
  if (roots.length === 1) {
    const r = roots[0];
    return [r - 1, r + 1];
  }
  const r1 = roots[0];
  const r2 = roots[1];
  return [r1 - 1, (r1 + r2) / 2, r2 + 1];
}

/* ─── Number Formatting ─── */

function fmtNumber(n) {
  if (!Number.isFinite(n)) return "\u2014";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (Number.isInteger(n)) return String(n);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 10) return n.toFixed(2);
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function fmtSigned(n) {
  const s = fmtNumber(n);
  if (s === "0") return "+ 0";
  return n >= 0 ? `+ ${s}` : `\u2212 ${fmtNumber(Math.abs(n))}`;
}

function formatInequality(a, b, c, ineqType) {
  const parts = [];
  if (a === 1) parts.push("x\u00b2");
  else if (a === -1) parts.push("\u2212x\u00b2");
  else if (a !== 0) parts.push(`${fmtNumber(a)}x\u00b2`);

  if (b !== 0) {
    if (parts.length === 0) {
      if (b === 1) parts.push("x");
      else if (b === -1) parts.push("\u2212x");
      else parts.push(`${fmtNumber(b)}x`);
    } else {
      if (b === 1) parts.push(" + x");
      else if (b === -1) parts.push(" \u2212 x");
      else if (b > 0) parts.push(` + ${fmtNumber(b)}x`);
      else parts.push(` \u2212 ${fmtNumber(Math.abs(b))}x`);
    }
  }

  if (c !== 0) {
    if (parts.length === 0) {
      parts.push(fmtNumber(c));
    } else {
      if (c > 0) parts.push(` + ${fmtNumber(c)}`);
      else parts.push(` \u2212 ${fmtNumber(Math.abs(c))}`);
    }
  }

  if (parts.length === 0) parts.push("0");
  return parts.join("") + ` ${ineqType} 0`;
}

function formatQuadratic(a, b, c) {
  return formatInequality(a, b, c, "=").replace(" = 0", "");
}

/* ─── Solution Solver ─── */

function getSolution(a, b, c, ineqType, roots) {
  const strict = isStrictInequality(ineqType);
  const wantsPositive = isPositiveDirection(ineqType);

  if (a === 0) {
    return {
      intervals: [],
      notation: "Not a quadratic (a = 0).",
      setBuilder: "",
      english: "This is a linear inequality since a = 0.",
      isEmpty: false,
      isDegenerate: true,
    };
  }

  const disc = getDiscriminant(a, b, c);
  const opensUp = a > 0;

  // No real roots
  if (disc < 0) {
    const alwaysPositive = opensUp;
    if ((wantsPositive && alwaysPositive) || (!wantsPositive && !alwaysPositive)) {
      return {
        intervals: [{ from: -Infinity, to: Infinity, fromOpen: true, toOpen: true }],
        notation: "(\u2212\u221e, +\u221e)",
        setBuilder: "{ x \u2208 \u211d }",
        english: "All real numbers satisfy this inequality.",
        isEmpty: false,
      };
    } else {
      return {
        intervals: [],
        notation: "\u2205",
        setBuilder: "{ }",
        english: "No real numbers satisfy this inequality.",
        isEmpty: true,
      };
    }
  }

  // One repeated root
  if (roots.length === 1) {
    const r = roots[0];
    if (wantsPositive && opensUp) {
      if (strict) {
        return {
          intervals: [
            { from: -Infinity, to: r, fromOpen: true, toOpen: true },
            { from: r, to: Infinity, fromOpen: true, toOpen: true },
          ],
          notation: `(\u2212\u221e, ${fmtNumber(r)}) \u222a (${fmtNumber(r)}, +\u221e)`,
          setBuilder: `{ x \u2208 \u211d | x \u2260 ${fmtNumber(r)} }`,
          english: `All real numbers except x = ${fmtNumber(r)}.`,
          isEmpty: false,
        };
      } else {
        return {
          intervals: [{ from: -Infinity, to: Infinity, fromOpen: true, toOpen: true }],
          notation: "(\u2212\u221e, +\u221e)",
          setBuilder: "{ x \u2208 \u211d }",
          english: "All real numbers satisfy this inequality.",
          isEmpty: false,
        };
      }
    } else if (!wantsPositive && opensUp) {
      if (strict) {
        return { intervals: [], notation: "\u2205", setBuilder: "{ }", english: "No real numbers satisfy this inequality.", isEmpty: true };
      } else {
        return {
          intervals: [{ from: r, to: r, fromOpen: false, toOpen: false }],
          notation: `{${fmtNumber(r)}}`,
          setBuilder: `{ x \u2208 \u211d | x = ${fmtNumber(r)} }`,
          english: `Only x = ${fmtNumber(r)}.`,
          isEmpty: false,
          isSinglePoint: true,
        };
      }
    } else if (wantsPositive && !opensUp) {
      if (strict) {
        return { intervals: [], notation: "\u2205", setBuilder: "{ }", english: "No real numbers satisfy this inequality.", isEmpty: true };
      } else {
        return {
          intervals: [{ from: r, to: r, fromOpen: false, toOpen: false }],
          notation: `{${fmtNumber(r)}}`,
          setBuilder: `{ x \u2208 \u211d | x = ${fmtNumber(r)} }`,
          english: `Only x = ${fmtNumber(r)}.`,
          isEmpty: false,
          isSinglePoint: true,
        };
      }
    } else {
      if (strict) {
        return {
          intervals: [
            { from: -Infinity, to: r, fromOpen: true, toOpen: true },
            { from: r, to: Infinity, fromOpen: true, toOpen: true },
          ],
          notation: `(\u2212\u221e, ${fmtNumber(r)}) \u222a (${fmtNumber(r)}, +\u221e)`,
          setBuilder: `{ x \u2208 \u211d | x \u2260 ${fmtNumber(r)} }`,
          english: `All real numbers except x = ${fmtNumber(r)}.`,
          isEmpty: false,
        };
      } else {
        return {
          intervals: [{ from: -Infinity, to: Infinity, fromOpen: true, toOpen: true }],
          notation: "(\u2212\u221e, +\u221e)",
          setBuilder: "{ x \u2208 \u211d }",
          english: "All real numbers satisfy this inequality.",
          isEmpty: false,
        };
      }
    }
  }

  // Two distinct roots
  const r1 = roots[0];
  const r2 = roots[1];

  if ((wantsPositive && opensUp) || (!wantsPositive && !opensUp)) {
    return {
      intervals: [
        { from: -Infinity, to: r1, fromOpen: true, toOpen: strict },
        { from: r2, to: Infinity, fromOpen: strict, toOpen: true },
      ],
      notation: `(\u2212\u221e, ${fmtNumber(r1)}${strict ? ")" : "]"} \u222a ${strict ? "(" : "["}${fmtNumber(r2)}, +\u221e)`,
      setBuilder: `{ x \u2208 \u211d | x ${strict ? "<" : "\u2264"} ${fmtNumber(r1)} or x ${strict ? ">" : "\u2265"} ${fmtNumber(r2)} }`,
      english: `x is less than${strict ? "" : " or equal to"} ${fmtNumber(r1)}, or greater than${strict ? "" : " or equal to"} ${fmtNumber(r2)}.`,
      isEmpty: false,
    };
  } else {
    return {
      intervals: [
        { from: r1, to: r2, fromOpen: strict, toOpen: strict },
      ],
      notation: `${strict ? "(" : "["}${fmtNumber(r1)}, ${fmtNumber(r2)}${strict ? ")" : "]"}`,
      setBuilder: `{ x \u2208 \u211d | ${fmtNumber(r1)} ${strict ? "<" : "\u2264"} x ${strict ? "<" : "\u2264"} ${fmtNumber(r2)} }`,
      english: `x is between ${fmtNumber(r1)} and ${fmtNumber(r2)}${strict ? " (exclusive)" : " (inclusive)"}.`,
      isEmpty: false,
    };
  }
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

  // Ensure x-axis is visible
  if (yMin > 0) yMin = Math.min(-1, yMin);
  if (yMax < 0) yMax = Math.max(1, yMax);

  return { xMin, xMax, yMin, yMax };
}

function toSvg(mathX, mathY, bounds) {
  const plotW = GRAPH_VP.w - PAD * 2;
  const plotH = GRAPH_VP.h - PAD * 2;
  const xRatio = (mathX - bounds.xMin) / (bounds.xMax - bounds.xMin);
  const yRatio = (mathY - bounds.yMin) / (bounds.yMax - bounds.yMin);
  return {
    x: PAD + xRatio * plotW,
    y: GRAPH_VP.h - PAD - yRatio * plotH,
  };
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
  const vb = clone.getAttribute("viewBox") || `0 0 ${vp.w} ${vp.h}`;
  const [, , w, h] = vb.split(/\s+/).map(Number);
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(w || vp.w));
  bg.setAttribute("height", String(h || vp.h));
  bg.setAttribute("fill", "#f8f9ff");
  clone.insertBefore(bg, clone.firstChild);
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serializer = new XMLSerializer();
  const str = serializer.serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${str}`;
}

async function exportSvg(svgEl, filename, vp) {
  const svgStr = svgToString(svgEl, vp);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

async function exportPng(svgEl, filename, vp, scale = 2) {
  const svgStr = svgToString(svgEl, vp);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = "async";
    const vb = svgEl.getAttribute("viewBox") || `0 0 ${vp.w} ${vp.h}`;
    const [, , w, h] = vb.split(/\s+/).map(Number);
    const width = (w || vp.w) * scale;
    const height = (h || vp.h) * scale;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f8f9ff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ─── Magnify (Popup Window) ─── */

function openMagnifiedGraph(svgEl, ineqStr) {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const svgMarkup = serializer.serializeToString(svgEl);

  const popup = window.open("", "_blank", "width=1400,height=1000,scrollbars=yes,resizable=yes");
  if (!popup) return;

  popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Graph \u2014 ${ineqStr}</title>
  <style>
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
    .wrap {
      width: 100%;
      max-width: 1300px;
      text-align: center;
    }
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
    <h2>${ineqStr}</h2>
    ${svgMarkup}
  </div>
</body>
</html>`);
  popup.document.close();
}

/* ─── Step Content Generator ─── */

function getStepContent(step, a, b, c, ineqType, roots, disc, vertex, solution) {
  const ineqStr = formatInequality(a, b, c, ineqType);
  const fxStr = formatQuadratic(a, b, c);
  const opensWord = a > 0 ? "upward" : "downward";

  return [
    // Step 0: State the inequality
    {
      label: "Step 1 of 7",
      heading: "State the Inequality",
      body: `We need to find all values of x that satisfy:`,
      math: <span style={{ fontWeight: 700 }}>{ineqStr}</span>,
      detail: `Here a = ${fmtNumber(a)}, b = ${fmtNumber(b)}, c = ${fmtNumber(c)}. Since a ${a > 0 ? "> 0" : "< 0"}, the parabola opens ${opensWord}.`,
    },
    // Step 1: Find the discriminant
    {
      label: "Step 2 of 7",
      heading: "Find the Discriminant",
      body: `The discriminant tells us how many times the parabola crosses the x-axis.`,
      math: (() => {
        const fourAC = 4 * a * c;
        return (
          <>
            <div>{`\u0394 = b\u00b2 \u2212 4ac`}</div>
            <div>{`\u0394 = (${fmtNumber(b)})\u00b2 \u2212 4(${fmtNumber(a)})(${fmtNumber(c)})`}</div>
            <div>{`\u0394 = ${fmtNumber(b * b)} ${fourAC >= 0 ? `\u2212 ${fmtNumber(fourAC)}` : `+ ${fmtNumber(Math.abs(fourAC))}`}`}</div>
            <div style={{ fontWeight: 700 }}>{`\u0394 = ${fmtNumber(disc)}`}</div>
          </>
        );
      })(),
      detail: disc > 0
        ? `\u0394 > 0 \u2014 two distinct real roots. The parabola crosses the x-axis twice.`
        : disc === 0
          ? `\u0394 = 0 \u2014 one repeated root. The parabola touches the x-axis at exactly one point.`
          : `\u0394 < 0 \u2014 no real roots. The parabola does not cross the x-axis.`,
    },
    // Step 2: Solve the equation
    {
      label: "Step 3 of 7",
      heading: "Solve the Related Equation",
      body: disc < 0
        ? `Since \u0394 < 0, the equation ${fxStr} = 0 has no real solutions.`
        : disc === 0
          ? `Since \u0394 = 0, we have one repeated root:`
          : `Using the quadratic formula x = (\u2212b \u00b1 \u221a\u0394) / 2a:`,
      math: roots.length === 0
        ? <span style={{ color: "var(--negative)" }}>No real roots.</span>
        : roots.length === 1
          ? <div style={{ fontWeight: 700 }}>{`x = ${fmtNumber(roots[0])}`}</div>
          : (
            <>
              <div>{`x = (${fmtNumber(-b)} \u00b1 \u221a${fmtNumber(disc)}) / ${fmtNumber(2 * a)}`}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{`x\u2081 = ${fmtNumber(roots[0])},  x\u2082 = ${fmtNumber(roots[1])}`}</div>
            </>
          ),
    },
    // Step 3: Plot the parabola
    {
      label: "Step 4 of 7",
      heading: "Plot the Parabola",
      body: `The graph shows f(x) = ${fxStr}. ${
        roots.length === 2
          ? `It crosses the x-axis at x = ${fmtNumber(roots[0])} and x = ${fmtNumber(roots[1])}.`
          : roots.length === 1
            ? `It touches the x-axis at x = ${fmtNumber(roots[0])}.`
            : `It does not cross the x-axis.`
      }`,
      detail: Number.isFinite(vertex.x)
        ? `The vertex is at (${fmtNumber(vertex.x)}, ${fmtNumber(vertex.y)}). The parabola opens ${opensWord}.`
        : null,
    },
    // Step 4: Sign analysis
    {
      label: "Step 5 of 7",
      heading: "Sign Analysis",
      body: roots.length === 0
        ? `With no real roots, the parabola is entirely ${a > 0 ? "above" : "below"} the x-axis. f(x) is always ${a > 0 ? "positive" : "negative"}.`
        : `The root${roots.length > 1 ? "s divide" : " divides"} the number line into ${roots.length + 1} interval${roots.length + 1 > 1 ? "s" : ""}. We test a point in each to determine the sign of f(x).`,
      showSignTable: roots.length > 0,
    },
    // Step 5: Shade the solution
    {
      label: "Step 6 of 7",
      heading: "Shade the Solution",
      body: solution.isEmpty
        ? `No region satisfies ${ineqStr}. The solution set is empty.`
        : solution.isSinglePoint
          ? `The parabola only touches zero at a single point. The solution is just that point.`
          : `The shaded region on the graph shows where f(x) ${ineqType} 0. The highlighted segments on the number line mark the solution intervals.`,
      detail: !solution.isEmpty && !solution.isSinglePoint
        ? `${isStrictInequality(ineqType) ? "Open" : "Closed"} circles on the number line indicate the endpoints are ${isStrictInequality(ineqType) ? "excluded from" : "included in"} the solution.`
        : null,
    },
    // Step 6: Write the solution
    {
      label: "Step 7 of 7",
      heading: "Write the Solution",
      body: `The complete solution to ${ineqStr}:`,
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
      <span className="breadcrumb-current">Inequality Solver</span>
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
          <a href="../quadratic-inequality/" className="menu-link indent active">Inequality Solver</a>
          <a href="../completing-the-square/" className="menu-link indent">Completing the Square</a>
          <a href="../sketch-binomial-factors/" className="menu-link indent">Binomial Multiplication</a>
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
      name: "Completing the Square",
      href: "../completing-the-square/",
      desc: "Convert to vertex form with visual area model"
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
      <h1>Quadratic Inequalities</h1>
      <p className="subhead">
        Solve and visualize quadratic inequalities step by step.
        See the solution on the graph and number line.
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

function InputPanel({ a, b, c, ineqType, onAChange, onBChange, onCChange, onIneqChange, onPreset }) {
  return (
    <div className="input-panel">
      <div className="coef-row">
        <CoefInput label="a" value={a} onChange={onAChange} />
        <span className="ineq-formula">x<sup>2</sup> +</span>
        <CoefInput label="b" value={b} onChange={onBChange} />
        <span className="ineq-formula">x +</span>
        <CoefInput label="c" value={c} onChange={onCChange} />
        <span className="ineq-formula">{ineqType} 0</span>
      </div>
      <div className="ineq-selector">
        {INEQ_TYPES.map((type) => (
          <button
            key={type}
            className={`ineq-btn${type === ineqType ? " active" : ""}`}
            onClick={() => onIneqChange(type)}
          >
            {type}
          </button>
        ))}
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
      <button
        className="nav-btn"
        disabled={step <= 0}
        onClick={() => onStep(step - 1)}
        aria-label="Previous step"
      >
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
      <button
        className="nav-btn"
        disabled={step >= MAX_STEP}
        onClick={() => onStep(step + 1)}
        aria-label="Next step"
      >
        Next &rarr;
      </button>
    </div>
  );
}

/* ─── Parabola SVG ─── */

function ParabolaSvg({ a, b, c, ineqType, roots, step, svgRef, solution }) {
  const bounds = useMemo(() => getAutoViewRange(a, b, c), [a, b, c]);
  const vertex = useMemo(() => getVertex(a, b, c), [a, b, c]);
  const testPoints = useMemo(() => getTestPoints(roots), [roots]);

  const fade = (on) => ({
    opacity: on ? 1 : 0,
    transition: "opacity 420ms ease",
  });

  const showAxes = step >= 0;
  const showRoots = step >= 2;
  const showCurve = step >= 3;
  const showVertex = step >= 3;
  const showTestPoints = step >= 4;
  const showShading = step >= 5;

  // Build curve polyline points
  const curvePoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateQuadratic(a, b, c, mx);
      if (Number.isFinite(my)) {
        const s = toSvg(mx, my, bounds);
        // Clamp to viewport
        const cy = Math.max(-50, Math.min(GRAPH_VP.h + 50, s.y));
        pts.push(`${s.x.toFixed(2)},${cy.toFixed(2)}`);
      }
    }
    return pts.join(" ");
  }, [a, b, c, bounds]);

  // Build shaded region path
  const shadePath = useMemo(() => {
    if (solution.isEmpty) return null;

    const segments = [];
    let currentSeg = null;

    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateQuadratic(a, b, c, mx);
      if (!Number.isFinite(my)) continue;

      const holds = matchesInequality(my, ineqType);
      const s = toSvg(mx, my, bounds);
      const sBase = toSvg(mx, 0, bounds);
      const clampedY = Math.max(-50, Math.min(GRAPH_VP.h + 50, s.y));

      if (holds) {
        if (!currentSeg) currentSeg = { topPts: [], basePts: [] };
        currentSeg.topPts.push(`${s.x.toFixed(2)},${clampedY.toFixed(2)}`);
        currentSeg.basePts.unshift(`${sBase.x.toFixed(2)},${sBase.y.toFixed(2)}`);
      } else {
        if (currentSeg) {
          segments.push(currentSeg);
          currentSeg = null;
        }
      }
    }
    if (currentSeg) segments.push(currentSeg);
    if (segments.length === 0) return null;

    return segments.map((seg) => {
      const allPts = [...seg.topPts, ...seg.basePts];
      return `M ${allPts[0]} L ${allPts.join(" L ")} Z`;
    }).join(" ");
  }, [a, b, c, ineqType, solution, bounds]);

  // Grid lines
  const gridData = useMemo(() => {
    const lines = [];
    const labels = [];

    // Determine step size
    const xRange = bounds.xMax - bounds.xMin;
    const yRange = bounds.yMax - bounds.yMin;
    const xStep = xRange > 30 ? 5 : 1;
    const yStep = yRange > 30 ? 5 : 1;
    const xMajor = xStep === 1 ? 5 : 5;
    const yMajor = yStep === 1 ? 5 : 5;

    const xStart = Math.ceil(bounds.xMin / xStep) * xStep;
    const xEnd = Math.floor(bounds.xMax / xStep) * xStep;
    const yStart = Math.ceil(bounds.yMin / yStep) * yStep;
    const yEnd = Math.floor(bounds.yMax / yStep) * yStep;

    for (let x = xStart; x <= xEnd; x += xStep) {
      const isMajor = x % xMajor === 0;
      const p1 = toSvg(x, bounds.yMin, bounds);
      const p2 = toSvg(x, bounds.yMax, bounds);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, major: isMajor, axis: Math.abs(x) < 0.001 });
    }
    for (let y = yStart; y <= yEnd; y += yStep) {
      const isMajor = y % yMajor === 0;
      const p1 = toSvg(bounds.xMin, y, bounds);
      const p2 = toSvg(bounds.xMax, y, bounds);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, major: isMajor, axis: Math.abs(y) < 0.001 });
    }

    const zero = toSvg(0, 0, bounds);
    for (let x = xStart; x <= xEnd; x += xStep) {
      if (x === 0 || !Number.isInteger(x) || !(x % xMajor === 0)) continue;
      const p = toSvg(x, 0, bounds);
      labels.push({ x: p.x, y: zero.y + 18, text: String(x), anchor: "middle" });
    }
    for (let y = yStart; y <= yEnd; y += yStep) {
      if (y === 0 || !Number.isInteger(y) || !(y % yMajor === 0)) continue;
      const p = toSvg(0, y, bounds);
      labels.push({ x: zero.x - 8, y: p.y + 4, text: String(y), anchor: "end" });
    }

    return { lines, labels };
  }, [bounds]);

  // Format inequality and solution text
  const inequalityText = formatInequality(a, b, c, ineqType);
  const solutionText = solution.notation || "";

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${GRAPH_VP.w} ${GRAPH_VP.h}`} role="img" aria-label="Parabola graph">
      <defs>
        <clipPath id="plot-area">
          <rect x={PAD} y={PAD - 10} width={GRAPH_VP.w - PAD * 2} height={GRAPH_VP.h - PAD * 2 + 20} />
        </clipPath>
      </defs>

      {/* Header with inequality and solution */}
      <g>
        <text x={GRAPH_VP.w / 2} y={25} textAnchor="middle" fontSize="16"
          fontFamily={SVG_FONT} fontWeight="600" fill="#0b0d17">
          {inequalityText}
        </text>
        <text x={GRAPH_VP.w / 2} y={45} textAnchor="middle" fontSize="14"
          fontFamily={SVG_FONT} fontWeight="500" fill="#ff6b3d">
          Solution: {solutionText}
        </text>
      </g>

      {/* Grid */}
      <g style={fade(showAxes)}>
        {gridData.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.axis ? "rgba(15,23,42,0.6)" : l.major ? "rgba(15,23,42,0.18)" : "rgba(15,23,42,0.07)"}
            strokeWidth={l.axis ? 2 : l.major ? 0.8 : 0.5}
          />
        ))}
        {gridData.labels.map((lb, i) => (
          <text key={i} x={lb.x} y={lb.y} textAnchor={lb.anchor}
            fontSize="11" fontFamily={SVG_MONO} fill="rgba(15,23,42,0.5)">
            {lb.text}
          </text>
        ))}
      </g>

      {/* Shaded solution region */}
      <g style={fade(showShading)} clipPath="url(#plot-area)">
        {shadePath && (
          <path d={shadePath} fill="rgba(255,107,61,0.15)" stroke="rgba(255,107,61,0.3)" strokeWidth="0.5" />
        )}
      </g>

      {/* Parabola curve */}
      <g style={fade(showCurve)} clipPath="url(#plot-area)">
        <polyline points={curvePoints} fill="none" stroke="#ff6b3d" strokeWidth="3" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 2px 4px rgba(255,107,61,0.25))" }} />
      </g>

      {/* Root markers */}
      <g style={fade(showRoots)}>
        {roots.map((r, i) => {
          const p = toSvg(r, 0, bounds);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="6" fill="#10b981" stroke="#fff" strokeWidth="2.5" />
              <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize="11"
                fontFamily={SVG_MONO} fontWeight="700" fill="#10b981">
                {fmtNumber(r)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Vertex marker */}
      <g style={fade(showVertex)}>
        {Number.isFinite(vertex.x) && (() => {
          const p = toSvg(vertex.x, vertex.y, bounds);
          const labelY = a > 0 ? p.y - 16 : p.y + 22;
          return (
            <>
              <circle cx={p.x} cy={p.y} r="6" fill="#3b82f6" stroke="#fff" strokeWidth="2.5" />
              <text x={p.x} y={labelY} textAnchor="middle" fontSize="11"
                fontFamily={SVG_MONO} fontWeight="700" fill="#3b82f6">
                ({fmtNumber(vertex.x)}, {fmtNumber(vertex.y)})
              </text>
            </>
          );
        })()}
      </g>

      {/* Region sign labels */}
      <g style={fade(showTestPoints)}>
        {testPoints.map((tp, i) => {
          const val = evaluateQuadratic(a, b, c, tp);
          if (!Number.isFinite(val)) return null;
          const sign = val > 0 ? "+" : "\u2212";
          const color = val > 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.22)";
          const textColor = val > 0 ? "#10b981" : "#ef4444";
          // Position halfway between curve and x-axis
          const axisY = toSvg(tp, 0, bounds).y;
          const curveY = toSvg(tp, val, bounds).y;
          const midY = (axisY + curveY) / 2;
          const clampedMidY = Math.max(PAD + 20, Math.min(GRAPH_VP.h - PAD - 20, midY));
          const px = toSvg(tp, 0, bounds).x;
          return (
            <g key={`sign-${i}`}>
              <circle cx={px} cy={clampedMidY} r="22" fill={color} />
              <text x={px} y={clampedMidY + 1} textAnchor="middle" dominantBaseline="central"
                fontSize="26" fontFamily={SVG_MONO} fontWeight="700" fill={textColor}>
                {sign}
              </text>
            </g>
          );
        })}
      </g>

      {/* Test points */}
      <g style={fade(showTestPoints)}>
        {testPoints.map((tp, i) => {
          const val = evaluateQuadratic(a, b, c, tp);
          if (!Number.isFinite(val)) return null;
          const color = val > 0 ? "#10b981" : val < 0 ? "#ef4444" : "#64748b";
          const p = toSvg(tp, val, bounds);
          const clampedY = Math.max(PAD, Math.min(GRAPH_VP.h - PAD, p.y));

          // Position label to avoid overlap with +/- indicators
          // For positive values (upper region), place label near top of graph
          // For negative values (lower region), place label near bottom of graph
          const labelY = val > 0 ? PAD + 15 : GRAPH_VP.h - PAD - 5;

          return (
            <g key={i}>
              <circle cx={p.x} cy={clampedY} r="5" fill={color} stroke="#fff" strokeWidth="2"
                clipPath="url(#plot-area)" />
              <text x={p.x} y={labelY} textAnchor="middle" fontSize="13"
                fontFamily={SVG_MONO} fontWeight="700" fill={color}>
                f({fmtNumber(tp)}) = {fmtNumber(val)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ─── Number Line SVG ─── */

function NumberLine({ roots, a, b, c, ineqType, solution, step }) {
  const showBase = step >= 4;
  const showSigns = step >= 4;
  const showSolution = step >= 5;

  const fade = (on) => ({
    opacity: on ? 1 : 0,
    transition: "opacity 420ms ease",
  });

  const testPoints = useMemo(() => getTestPoints(roots), [roots]);

  const range = useMemo(() => {
    if (roots.length === 0) return { min: -5, max: 5 };
    const rMin = Math.min(...roots);
    const rMax = Math.max(...roots);
    const span = roots.length === 1 ? 4 : (rMax - rMin);
    const pad = Math.max(2, span * 0.5);
    return { min: Math.floor(rMin - pad), max: Math.ceil(rMax + pad) };
  }, [roots]);

  const toNL = (val) => {
    const plotW = NUMLINE_VP.w - PAD * 2;
    const ratio = (val - range.min) / (range.max - range.min);
    return PAD + ratio * plotW;
  };

  const lineY = 55;
  const strict = isStrictInequality(ineqType);

  return (
    <svg width="100%" viewBox={`0 0 ${NUMLINE_VP.w} ${NUMLINE_VP.h}`} role="img" aria-label="Number line">
      {/* Base line with arrows */}
      <g style={fade(showBase)}>
        <line x1={PAD - 15} y1={lineY} x2={NUMLINE_VP.w - PAD + 15} y2={lineY}
          stroke="rgba(15,23,42,0.3)" strokeWidth="2" />
        {/* Left arrow */}
        <polygon points={`${PAD - 15},${lineY} ${PAD - 7},${lineY - 5} ${PAD - 7},${lineY + 5}`}
          fill="rgba(15,23,42,0.3)" />
        {/* Right arrow */}
        <polygon points={`${NUMLINE_VP.w - PAD + 15},${lineY} ${NUMLINE_VP.w - PAD + 7},${lineY - 5} ${NUMLINE_VP.w - PAD + 7},${lineY + 5}`}
          fill="rgba(15,23,42,0.3)" />

        {/* Root tick marks */}
        {roots.map((r, i) => {
          const x = toNL(r);
          return (
            <g key={i}>
              <line x1={x} y1={lineY - 10} x2={x} y2={lineY + 10}
                stroke="rgba(15,23,42,0.6)" strokeWidth="2" />
              <text x={x} y={lineY + 28} textAnchor="middle" fontSize="13"
                fontFamily={SVG_MONO} fontWeight="700" fill="rgba(15,23,42,0.8)">
                {fmtNumber(r)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Sign labels */}
      <g style={fade(showSigns)}>
        {testPoints.map((tp, i) => {
          const val = evaluateQuadratic(a, b, c, tp);
          const sign = val > 0 ? "+" : "\u2212";
          const color = val > 0 ? "#10b981" : "#ef4444";
          const x = toNL(tp);
          return (
            <text key={i} x={x} y={lineY - 18} textAnchor="middle" fontSize="20"
              fontFamily={SVG_MONO} fontWeight="700" fill={color}>
              {sign}
            </text>
          );
        })}
      </g>

      {/* Solution highlighted segments */}
      <g style={fade(showSolution)}>
        {solution.intervals && solution.intervals.map((iv, i) => {
          if (iv.from === iv.to) {
            // Single point
            const x = toNL(iv.from);
            return (
              <circle key={i} cx={x} cy={lineY} r="6"
                fill="#ff6b3d" stroke="#fff" strokeWidth="2" />
            );
          }
          const x1 = iv.from === -Infinity ? PAD - 15 : toNL(iv.from);
          const x2 = iv.to === Infinity ? NUMLINE_VP.w - PAD + 15 : toNL(iv.to);
          return (
            <g key={i}>
              <line x1={x1} y1={lineY} x2={x2} y2={lineY}
                stroke="#ff6b3d" strokeWidth="5" strokeLinecap="round" />
              {iv.from !== -Infinity && (
                <circle cx={toNL(iv.from)} cy={lineY} r="5.5"
                  fill={iv.fromOpen ? "#fff" : "#ff6b3d"}
                  stroke="#ff6b3d" strokeWidth="2.5" />
              )}
              {iv.to !== Infinity && (
                <circle cx={toNL(iv.to)} cy={lineY} r="5.5"
                  fill={iv.toOpen ? "#fff" : "#ff6b3d"}
                  stroke="#ff6b3d" strokeWidth="2.5" />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ─── Explanation Panel ─── */

function ExplanationPanel({ content, a, b, c, ineqType, roots }) {
  if (!content) return null;
  const testPoints = getTestPoints(roots);

  return (
    <div className="explanation-card">
      <div className="step-label">{content.label}</div>
      <h3>{content.heading}</h3>
      <p>{content.body}</p>
      {content.detail && <p>{content.detail}</p>}
      {content.math && <div className="math-display">{content.math}</div>}
      {content.showSignTable && (
        <table className="sign-table">
          <thead>
            <tr>
              <th>Interval</th>
              <th>Test Point</th>
              <th>f(x)</th>
              <th>Sign</th>
            </tr>
          </thead>
          <tbody>
            {testPoints.map((tp, i) => {
              const val = evaluateQuadratic(a, b, c, tp);
              const isPos = val > 0;
              let interval = "";
              if (roots.length === 1) {
                interval = i === 0
                  ? `(\u2212\u221e, ${fmtNumber(roots[0])})`
                  : `(${fmtNumber(roots[0])}, +\u221e)`;
              } else if (roots.length === 2) {
                if (i === 0) interval = `(\u2212\u221e, ${fmtNumber(roots[0])})`;
                else if (i === 1) interval = `(${fmtNumber(roots[0])}, ${fmtNumber(roots[1])})`;
                else interval = `(${fmtNumber(roots[1])}, +\u221e)`;
              }
              return (
                <tr key={i}>
                  <td>{interval}</td>
                  <td>x = {fmtNumber(tp)}</td>
                  <td>{fmtNumber(val)}</td>
                  <td className={isPos ? "sign-positive" : "sign-negative"}>
                    {isPos ? "+" : "\u2212"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── Result Card ─── */

function ResultCard({ solution, ineqStr }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = `${ineqStr}\nSolution: ${solution.notation}\nSet-builder: ${solution.setBuilder}\n${solution.english}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="result-card">
      <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", color: "var(--muted)", marginBottom: 4 }}>
        {ineqStr}
      </div>
      <h3>Solution</h3>
      <div className="result-notation">{solution.notation}</div>
      {solution.setBuilder && (
        <div className="result-alt">{solution.setBuilder}</div>
      )}
      <div className="result-english">{solution.english}</div>
      <button className="copy-btn" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy solution"}
      </button>
    </div>
  );
}

/* ─── Export Footer ─── */

function ExportFooter({ svgRef, a, b, c, ineqType }) {
  const safeStr = (s) => s.replace(/[^\w\-\.]+/g, "_");

  async function onExportSvg() {
    if (!svgRef.current) return;
    const name = safeStr(`inequality_${a}x2_${b}x_${c}_${ineqType === "\u2265" ? "gte" : ineqType === "\u2264" ? "lte" : ineqType === ">" ? "gt" : "lt"}.svg`);
    await exportSvg(svgRef.current, name, GRAPH_VP);
  }

  async function onExportPng() {
    if (!svgRef.current) return;
    const name = safeStr(`inequality_${a}x2_${b}x_${c}.png`);
    await exportPng(svgRef.current, name, GRAPH_VP, 2);
  }

  return (
    <div className="export-footer">
      <button onClick={onExportSvg}>Export SVG</button>
      <button onClick={onExportPng}>Export PNG</button>
    </div>
  );
}

/* ─── App Root ─── */

function App() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(-5);
  const [c, setC] = useState(6);
  const [ineqType, setIneqType] = useState(">");
  const [step, setStep] = useState(0);
  const svgRef = useRef(null);

  const numA = typeof a === "number" ? a : 0;
  const numB = typeof b === "number" ? b : 0;
  const numC = typeof c === "number" ? c : 0;

  const disc = useMemo(() => getDiscriminant(numA, numB, numC), [numA, numB, numC]);
  const roots = useMemo(() => getRoots(numA, numB, numC), [numA, numB, numC]);
  const vertex = useMemo(() => getVertex(numA, numB, numC), [numA, numB, numC]);
  const solution = useMemo(() => getSolution(numA, numB, numC, ineqType, roots), [numA, numB, numC, ineqType, roots]);
  const ineqStr = useMemo(() => formatInequality(numA, numB, numC, ineqType), [numA, numB, numC, ineqType]);

  const error = useMemo(() => {
    if (numA === 0) return "Coefficient a must be non-zero for a quadratic inequality.";
    return null;
  }, [numA]);

  function safeSetStep(next) {
    setStep(Math.max(0, Math.min(MAX_STEP, next)));
  }

  function handlePreset(preset) {
    setA(preset.a);
    setB(preset.b);
    setC(preset.c);
    setIneqType(preset.ineq);
    setStep(0);
  }

  function makeCoefHandler(setter) {
    return (val) => { setter(val); setStep(0); };
  }

  function handleIneqChange(type) {
    setIneqType(type);
    setStep(0);
  }

  const stepContent = !error
    ? getStepContent(step, numA, numB, numC, ineqType, roots, disc, vertex, solution)
    : null;

  return (
    <>
      <HamburgerMenu />
      <div className="page">
        <Breadcrumb />
        <HeroSection />

        <InputPanel
          a={a} b={b} c={c} ineqType={ineqType}
          onAChange={makeCoefHandler(setA)}
          onBChange={makeCoefHandler(setB)}
          onCChange={makeCoefHandler(setC)}
          onIneqChange={handleIneqChange}
          onPreset={handlePreset}
        />

        {error && <div className="error-banner">{error}</div>}

        {!error ? (
          <>
            <div className="main-grid">
              <div className="graph-card">
                <div className="svg-container">
                  <ParabolaSvg
                    a={numA} b={numB} c={numC} ineqType={ineqType}
                    roots={roots} step={step} svgRef={svgRef}
                    solution={solution}
                  />
                </div>
                <div className="graph-toolbar">
                  <button
                    className="magnify-btn"
                    onClick={() => openMagnifiedGraph(svgRef.current, ineqStr)}
                    aria-label="Open graph in new window"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="6.5" cy="6.5" r="4.5" />
                      <line x1="10" y1="10" x2="14.5" y2="14.5" />
                      <line x1="4.5" y1="6.5" x2="8.5" y2="6.5" />
                      <line x1="6.5" y1="4.5" x2="6.5" y2="8.5" />
                    </svg>
                    Magnify
                  </button>
                </div>
              </div>

              <div className="sidebar">
                <ExplanationPanel
                  key={step}
                  content={stepContent}
                  a={numA} b={numB} c={numC}
                  ineqType={ineqType}
                  roots={roots}
                />

                {step >= 4 && (
                  <div className="numberline-card">
                    <div className="svg-container">
                      <NumberLine
                        roots={roots} a={numA} b={numB} c={numC}
                        ineqType={ineqType} solution={solution} step={step}
                      />
                    </div>
                  </div>
                )}

                {step >= MAX_STEP && (
                  <ResultCard solution={solution} ineqStr={ineqStr} />
                )}
              </div>
            </div>

            <StepNav step={step} onStep={safeSetStep} />

            <ExportFooter svgRef={svgRef} a={numA} b={numB} c={numC} ineqType={ineqType} />
            <RelatedTools />
          </>
        ) : (
          <div className="graph-card">
            <div className="no-graph">
              Set a non-zero value for a to begin.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
