const { useMemo, useRef, useState } = React;

/* ─── Constants ─── */

const GRAPH_VP = { w: 820, h: 560 };
const PAD = 60;
const CURVE_SAMPLES = 200;
const SVG_FONT = '"Manrope", "Segoe UI", system-ui, sans-serif';
const SVG_MONO = '"Space Mono", "SFMono-Regular", Consolas, monospace';

const INEQ_TYPES = ["y <", "y \u2264", "y >", "y \u2265"];

const PRESETS = [
  { label: "y < x\u00b2 \u2212 4",         a: 1,  b: 0,  c: -4, ineq: "y <"      },
  { label: "y \u2265 x\u00b2 + 2x \u2212 3", a: 1,  b: 2,  c: -3, ineq: "y \u2265" },
  { label: "y > \u2212x\u00b2 + 4x",      a: -1, b: 4,  c: 0,  ineq: "y >"      },
  { label: "y \u2264 2x\u00b2 \u2212 8",  a: 2,  b: 0,  c: -8, ineq: "y \u2264"  },
  { label: "y < \u2212x\u00b2 + 6x \u2212 5", a: -1, b: 6,  c: -5, ineq: "y <"   },
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

function getAutoViewRange(a, b, c) {
  const roots = getRoots(a, b, c);
  const vertex = getVertex(a, b, c);

  let xVals = [vertex.x];
  if (roots.length > 0) xVals.push(...roots);

  const xMin = Math.min(...xVals, -5);
  const xMax = Math.max(...xVals, 5);
  const xMargin = (xMax - xMin) * 0.3;

  const yAtBounds = [
    evaluateQuadratic(a, b, c, xMin - xMargin),
    evaluateQuadratic(a, b, c, xMax + xMargin),
    vertex.y
  ];

  const yMin = Math.min(...yAtBounds, -5);
  const yMax = Math.max(...yAtBounds, 5);
  const yMargin = (yMax - yMin) * 0.2;

  return {
    xMin: xMin - xMargin,
    xMax: xMax + xMargin,
    yMin: yMin - yMargin,
    yMax: yMax + yMargin
  };
}

function toSvg(mathX, mathY, bounds) {
  const xRatio = (mathX - bounds.xMin) / (bounds.xMax - bounds.xMin);
  const yRatio = (mathY - bounds.yMin) / (bounds.yMax - bounds.yMin);
  return {
    x: PAD + xRatio * (GRAPH_VP.w - PAD * 2),
    y: GRAPH_VP.h - PAD - yRatio * (GRAPH_VP.h - PAD * 2)
  };
}

/* ─── Number Formatting ─── */

function fmtNumber(n) {
  if (!Number.isFinite(n)) return "—";
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
  return n >= 0 ? `+ ${s}` : `− ${fmtNumber(Math.abs(n))}`;
}

function formatQuadratic(a, b, c) {
  const parts = [];
  if (a === 1) parts.push("x²");
  else if (a === -1) parts.push("−x²");
  else if (a !== 0) parts.push(`${fmtNumber(a)}x²`);

  if (b !== 0) {
    if (parts.length === 0) {
      if (b === 1) parts.push("x");
      else if (b === -1) parts.push("−x");
      else parts.push(`${fmtNumber(b)}x`);
    } else {
      if (b === 1) parts.push(" + x");
      else if (b === -1) parts.push(" − x");
      else if (b > 0) parts.push(` + ${fmtNumber(b)}x`);
      else parts.push(` − ${fmtNumber(Math.abs(b))}x`);
    }
  }

  if (c !== 0) {
    if (parts.length === 0) {
      parts.push(fmtNumber(c));
    } else {
      if (c > 0) parts.push(` + ${fmtNumber(c)}`);
      else parts.push(` − ${fmtNumber(Math.abs(c))}`);
    }
  }

  if (parts.length === 0) parts.push("0");
  return parts.join("");
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
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = vp.w * scale;
    canvas.height = vp.h * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => downloadBlob(blob, filename), "image/png");
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

  popup.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        :root {
          --ink: #0b0d17;
          --accent: #ff6b3d;
        }
        body { margin: 0; padding: 24px; background: #f8f9ff; display: flex; flex-direction: column; align-items: center; font-family: "Manrope", system-ui, sans-serif; }
        h1 { margin: 0 0 20px; font-size: 1.5rem; color: var(--ink); }
        svg { max-width: 100%; height: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${svgMarkup}
    </body>
    </html>
  `);
  popup.document.close();
}

/* ─── Navigation Components ─── */

function Breadcrumb() {
  return (
    <nav className="breadcrumb">
      <a href="../../../../">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      </a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../../">Algebra</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../">Quadratics</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <span className="breadcrumb-current">Inequality Regions</span>
    </nav>
  );
}

function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className={`menu-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)}></div>
      <nav className={`menu-panel ${open ? "open" : ""}`}>
        <h2 className="menu-header">Math Lab</h2>
        <div className="menu-section">
          <div className="menu-section-title">Quadratics</div>
          <ul className="menu-links">
            <li><a href="../quadratic-equation/">Graph Studio</a></li>
            <li><a href="../quadratic-inequality/">Inequality Solver</a></li>
            <li><a href="../quadratic-inequality-region/">Inequality Regions</a></li>
            <li><a href="../completing-the-square/">Completing the Square</a></li>
            <li><a href="../sketch-binomial-factors/">Binomial Multiplication</a></li>
          </ul>
        </div>
        <div className="menu-section">
          <div className="menu-section-title">Navigation</div>
          <ul className="menu-links">
            <li><a href="../../../../">Home</a></li>
            <li><a href="../../../">Algebra</a></li>
          </ul>
        </div>
      </nav>
    </>
  );
}

function RelatedTools() {
  return (
    <div className="related-tools">
      <h3>Related Tools</h3>
      <div className="related-grid">
        <a className="related-card" href="../quadratic-equation/">
          <div className="related-card-tag">Graphing</div>
          <h4>Quadratic Graph Studio</h4>
          <p>Interactive graphing with sliders and real-time analysis</p>
        </a>
        <a className="related-card" href="../quadratic-inequality/">
          <div className="related-card-tag">Inequalities</div>
          <h4>Inequality Solver</h4>
          <p>Step-by-step solution for one-variable inequalities</p>
        </a>
        <a className="related-card" href="../completing-the-square/">
          <div className="related-card-tag">Algebra</div>
          <h4>Completing the Square</h4>
          <p>Visual area model and algebraic walkthrough</p>
        </a>
        <a className="related-card" href="../sketch-binomial-factors/">
          <div className="related-card-tag">Factoring</div>
          <h4>Binomial Multiplication</h4>
          <p>FOIL method with area model visualization</p>
        </a>
      </div>
    </div>
  );
}

/* ─── React Components ─── */

function HeroSection() {
  return (
    <header className="hero">
      <p className="eyebrow">Math Lab</p>
      <h1>Quadratic Inequality Regions</h1>
      <p className="subhead">
        Graph two-variable inequalities of the form y ⋚ ax² + bx + c and visualize the solution region.
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
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step="any"
      />
    </div>
  );
}

function InputPanel({ a, b, c, ineqType, onSetA, onSetB, onSetC, onSetIneqType }) {
  const quadStr = formatQuadratic(a, b, c);

  const loadPreset = (preset) => {
    onSetA(preset.a);
    onSetB(preset.b);
    onSetC(preset.c);
    onSetIneqType(preset.ineq);
  };

  return (
    <div className="input-panel">
      <div className="coef-row">
        <CoefInput label="a" value={a} onChange={onSetA} />
        <CoefInput label="b" value={b} onChange={onSetB} />
        <CoefInput label="c" value={c} onChange={onSetC} />
        <span className="coef-formula">{ineqType} {quadStr}</span>
      </div>

      <div className="ineq-selector">
        {INEQ_TYPES.map((type) => (
          <button
            key={type}
            className={`ineq-btn ${ineqType === type ? "active" : ""}`}
            onClick={() => onSetIneqType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="presets">
        {PRESETS.map((p, i) => (
          <button key={i} className="preset-btn" onClick={() => loadPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GraphSvg({ a, b, c, ineqType, svgRef }) {
  const bounds = useMemo(() => getAutoViewRange(a, b, c), [a, b, c]);
  const vertex = useMemo(() => getVertex(a, b, c), [a, b, c]);
  const roots = useMemo(() => getRoots(a, b, c), [a, b, c]);

  const isStrict = ineqType === "y <" || ineqType === "y >";
  const shadeAbove = ineqType === "y >" || ineqType === "y ≥";

  // Build curve polyline points
  const curvePoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateQuadratic(a, b, c, mx);
      if (Number.isFinite(my)) {
        const s = toSvg(mx, my, bounds);
        const cy = Math.max(-50, Math.min(GRAPH_VP.h + 50, s.y));
        pts.push(`${s.x.toFixed(2)},${cy.toFixed(2)}`);
      }
    }
    return pts.join(" ");
  }, [a, b, c, bounds]);

  // Build shaded region path
  const shadePath = useMemo(() => {
    const topBound = shadeAbove ? bounds.yMax : bounds.yMin;
    const pts = [];

    // Start from left edge at the bound
    const leftX = bounds.xMin;
    const leftY = topBound;
    const leftSvg = toSvg(leftX, leftY, bounds);
    pts.push(`${leftSvg.x},${leftSvg.y}`);

    // Follow the bound line to the right edge
    const rightX = bounds.xMax;
    const rightY = topBound;
    const rightSvg = toSvg(rightX, rightY, bounds);
    pts.push(`${rightSvg.x},${rightSvg.y}`);

    // Follow the curve back
    for (let i = CURVE_SAMPLES; i >= 0; i--) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateQuadratic(a, b, c, mx);
      if (Number.isFinite(my)) {
        const s = toSvg(mx, my, bounds);
        const cy = Math.max(-50, Math.min(GRAPH_VP.h + 50, s.y));
        pts.push(`${s.x.toFixed(2)},${cy.toFixed(2)}`);
      }
    }

    return `M ${pts[0]} L ${pts.join(" L ")} Z`;
  }, [a, b, c, ineqType, bounds, shadeAbove]);

  // Grid lines
  const gridData = useMemo(() => {
    const lines = [];
    const labels = [];

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

  const inequalityText = `${ineqType} ${formatQuadratic(a, b, c)}`;

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${GRAPH_VP.w} ${GRAPH_VP.h}`} role="img" aria-label="Quadratic inequality region graph">
      <defs>
        <clipPath id="plot-area">
          <rect x={PAD} y={PAD - 10} width={GRAPH_VP.w - PAD * 2} height={GRAPH_VP.h - PAD * 2 + 20} />
        </clipPath>
      </defs>

      {/* Header with inequality */}
      <text x={GRAPH_VP.w / 2} y={28} textAnchor="middle" fontSize="16"
        fontFamily={SVG_FONT} fontWeight="600" fill="#0b0d17">
        {inequalityText}
      </text>

      {/* Grid */}
      <g>
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
      <g clipPath="url(#plot-area)">
        <path d={shadePath} fill="rgba(255,107,61,0.15)" stroke="none" />
      </g>

      {/* Parabola curve */}
      <g clipPath="url(#plot-area)">
        <polyline
          points={curvePoints}
          fill="none"
          stroke="#ff6b3d"
          strokeWidth="3"
          strokeDasharray={isStrict ? "8 4" : "none"}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 2px 4px rgba(255,107,61,0.25))" }}
        />
      </g>

      {/* Root markers */}
      <g>
        {roots.map((r, i) => {
          const p = toSvg(r, 0, bounds);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />
              <text x={p.x} y={p.y + 20} textAnchor="middle" fontSize="11"
                fontFamily={SVG_MONO} fontWeight="700" fill="#10b981">
                {fmtNumber(r)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Vertex marker */}
      <g>
        {Number.isFinite(vertex.x) && (() => {
          const p = toSvg(vertex.x, vertex.y, bounds);
          const labelY = a > 0 ? p.y - 14 : p.y + 20;
          return (
            <>
              <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
              <text x={p.x} y={labelY} textAnchor="middle" fontSize="11"
                fontFamily={SVG_MONO} fontWeight="700" fill="#3b82f6">
                ({fmtNumber(vertex.x)}, {fmtNumber(vertex.y)})
              </text>
            </>
          );
        })()}
      </g>
    </svg>
  );
}

function InfoCard({ a, b, c, ineqType }) {
  const vertex = useMemo(() => getVertex(a, b, c), [a, b, c]);
  const roots = useMemo(() => getRoots(a, b, c), [a, b, c]);
  const disc = useMemo(() => getDiscriminant(a, b, c), [a, b, c]);

  const shadeDirection = (ineqType === "y >" || ineqType === "y ≥") ? "above" : "below";
  const boundaryType = (ineqType === "y <" || ineqType === "y >") ? "dashed (not included)" : "solid (included)";

  return (
    <div className="info-card">
      <h3>Graph Properties</h3>
      <div className="info-row">
        <span className="info-label">Vertex</span>
        <span className="info-value">({fmtNumber(vertex.x)}, {fmtNumber(vertex.y)})</span>
      </div>
      {roots.length > 0 && (
        <div className="info-row">
          <span className="info-label">X-intercepts</span>
          <span className="info-value">{roots.map(fmtNumber).join(", ")}</span>
        </div>
      )}
      {roots.length === 0 && (
        <div className="info-row">
          <span className="info-label">X-intercepts</span>
          <span className="info-value">None (discriminant = {fmtNumber(disc)})</span>
        </div>
      )}
      <div className="info-row">
        <span className="info-label">Shaded region</span>
        <span className="info-value">{shadeDirection} the parabola</span>
      </div>
      <div className="info-row">
        <span className="info-label">Boundary</span>
        <span className="info-value">{boundaryType}</span>
      </div>
    </div>
  );
}

function ExportFooter({ svgRef, a, b, c, ineqType }) {
  const handleExportSvg = () => {
    if (svgRef.current) {
      const filename = `quadratic-inequality-region-${Date.now()}.svg`;
      exportSvg(svgRef.current, filename, GRAPH_VP);
    }
  };

  const handleExportPng = () => {
    if (svgRef.current) {
      const filename = `quadratic-inequality-region-${Date.now()}.png`;
      exportPng(svgRef.current, filename, GRAPH_VP);
    }
  };

  const handleMagnify = () => {
    if (svgRef.current) {
      const title = `${ineqType} ${formatQuadratic(a, b, c)}`;
      openMagnifiedGraph(svgRef.current, title);
    }
  };

  return (
    <div className="export-footer">
      <button className="export-btn" onClick={handleExportSvg}>
        Export SVG
      </button>
      <button className="export-btn" onClick={handleExportPng}>
        Export PNG
      </button>
      <button className="magnify-btn" onClick={handleMagnify}>
        🔍 Magnify
      </button>
    </div>
  );
}

/* ─── Main App ─── */

function App() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(0);
  const [c, setC] = useState(-4);
  const [ineqType, setIneqType] = useState("y <");
  const svgRef = useRef(null);

  if (a === 0) {
    return (
      <>
        <HamburgerMenu />
        <div className="page">
          <Breadcrumb />
          <HeroSection />
          <div className="input-panel">
            <p style={{ color: "var(--accent)", fontWeight: 600 }}>
              Error: Coefficient <strong>a</strong> cannot be zero. Please enter a non-zero value for <strong>a</strong>.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HamburgerMenu />
      <div className="page">
        <Breadcrumb />
        <HeroSection />
        <InputPanel
          a={a} b={b} c={c} ineqType={ineqType}
          onSetA={setA} onSetB={setB} onSetC={setC} onSetIneqType={setIneqType}
        />
        <div className="main-grid">
          <div className="graph-card">
            <div className="svg-container">
              <GraphSvg a={a} b={b} c={c} ineqType={ineqType} svgRef={svgRef} />
            </div>
          </div>
          <div className="sidebar">
            <InfoCard a={a} b={b} c={c} ineqType={ineqType} />
            <ExportFooter svgRef={svgRef} a={a} b={b} c={c} ineqType={ineqType} />
          </div>
        </div>
        <RelatedTools />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
