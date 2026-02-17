const { useMemo, useRef, useState, useEffect } = React;

/* ─── Constants ─── */

const GRAPH_VP = { w: 820, h: 560 };
const PAD = 60;
const CURVE_SAMPLES = 200;
const SVG_FONT = '"Manrope", "Segoe UI", system-ui, sans-serif';
const SVG_MONO = '"Space Mono", "SFMono-Regular", Consolas, monospace';

const PRESETS = [
  { label: "Two Roots: x² − 5x + 6", a: 1, b: -5, c: 6 },
  { label: "One Root: x² − 6x + 9", a: 1, b: -6, c: 9 },
  { label: "No Real Roots: x² + 1", a: 1, b: 0, c: 1 },
  { label: "Two Roots: −x² + 4", a: -1, b: 0, c: 4 },
  { label: "Boundary: 2x² − 4x + 2", a: 2, b: -4, c: 2 },
];

/* ─── Math Utilities ─── */

function evaluateQuadratic(a, b, c, x) {
  return a * x * x + b * x + c;
}

function getDiscriminant(a, b, c) {
  return b * b - 4 * a * c;
}

function getRoots(a, b, c) {
  if (a === 0) return [];
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

function formatQuadratic(a, b, c) {
  let str = "";
  if (a === 1) str += "x²";
  else if (a === -1) str += "−x²";
  else str += `${fmtNumber(a)}x²`;

  if (b !== 0) {
    if (b > 0) str += ` + ${b === 1 ? "" : fmtNumber(b)}x`;
    else str += ` − ${Math.abs(b) === 1 ? "" : fmtNumber(Math.abs(b))}x`;
  }

  if (c !== 0) {
    if (c > 0) str += ` + ${fmtNumber(c)}`;
    else str += ` − ${fmtNumber(Math.abs(c))}`;
  }

  return str;
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
        :root { --ink: #0b0d17; --accent: #ff6b3d; }
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
      <a href="../../../../"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../../">Algebra</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../">Quadratics</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <span className="breadcrumb-current">Discriminant</span>
    </nav>
  );
}

function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <span></span><span></span><span></span>
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
            <li><a href="../parabola-transformations/">Transformations</a></li>
            <li><a href="../discriminant-visualizer/">Discriminant</a></li>
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
        <a className="related-card" href="../parabola-transformations/">
          <div className="related-card-tag">Transformations</div>
          <h4>Parabola Transformations</h4>
          <p>Explore vertex form with interactive sliders</p>
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
      </div>
    </div>
  );
}

/* ─── React Components ─── */

function HeroSection() {
  return (
    <header className="hero">
      <p className="eyebrow">Math Lab</p>
      <h1>Discriminant Visualizer</h1>
      <p className="subhead">
        Explore how the discriminant (b² − 4ac) determines the number and type of roots for any quadratic equation.
      </p>
    </header>
  );
}

function GraphSvg({ a, b, c, svgRef }) {
  const bounds = useMemo(() => getAutoViewRange(a, b, c), [a, b, c]);
  const vertex = useMemo(() => getVertex(a, b, c), [a, b, c]);
  const roots = useMemo(() => getRoots(a, b, c), [a, b, c]);
  const disc = useMemo(() => getDiscriminant(a, b, c), [a, b, c]);

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

  const equation = `y = ${formatQuadratic(a, b, c)}`;
  const discText = `Δ = ${fmtNumber(disc)}`;

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${GRAPH_VP.w} ${GRAPH_VP.h}`} role="img">
      <defs>
        <clipPath id="plot-area">
          <rect x={PAD} y={PAD - 10} width={GRAPH_VP.w - PAD * 2} height={GRAPH_VP.h - PAD * 2 + 20} />
        </clipPath>
      </defs>

      <text x={GRAPH_VP.w / 2} y={22} textAnchor="middle" fontSize="15" fontFamily={SVG_FONT} fontWeight="600" fill="#0b0d17">{equation}</text>
      <text x={GRAPH_VP.w / 2} y={40} textAnchor="middle" fontSize="13" fontFamily={SVG_MONO} fontWeight="600" fill="#ff6b3d">{discText}</text>

      <g>
        {gridData.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.axis ? "rgba(15,23,42,0.6)" : l.major ? "rgba(15,23,42,0.18)" : "rgba(15,23,42,0.07)"}
            strokeWidth={l.axis ? 2 : l.major ? 0.8 : 0.5} />
        ))}
        {gridData.labels.map((lb, i) => (
          <text key={i} x={lb.x} y={lb.y} textAnchor={lb.anchor} fontSize="11" fontFamily={SVG_MONO} fill="rgba(15,23,42,0.5)">{lb.text}</text>
        ))}
      </g>

      <g clipPath="url(#plot-area)">
        <polyline points={curvePoints} fill="none" stroke="#ff6b3d" strokeWidth="3" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 4px rgba(255,107,61,0.25))" }} />
      </g>

      <g>
        {roots.map((r, i) => {
          const p = toSvg(r, 0, bounds);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="6" fill="#10b981" stroke="#fff" strokeWidth="2.5" />
              <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize="11" fontFamily={SVG_MONO} fontWeight="700" fill="#10b981">x = {fmtNumber(r)}</text>
            </g>
          );
        })}
      </g>

      <g>
        {Number.isFinite(vertex.x) && (() => {
          const p = toSvg(vertex.x, vertex.y, bounds);
          const labelY = a > 0 ? p.y - 14 : p.y + 20;
          return (
            <>
              <circle cx={p.x} cy={p.y} r="6" fill="#3b82f6" stroke="#fff" strokeWidth="2.5" />
              <text x={p.x} y={labelY} textAnchor="middle" fontSize="11" fontFamily={SVG_MONO} fontWeight="700" fill="#3b82f6">
                Vertex ({fmtNumber(vertex.x)}, {fmtNumber(vertex.y)})
              </text>
            </>
          );
        })()}
      </g>
    </svg>
  );
}

function ControlPanel({ a, b, c, onSetA, onSetB, onSetC, onLoadPreset }) {
  return (
    <div className="control-panel">
      <h3>Coefficients</h3>
      <div className="control-group">
        <label className="control-label">a = {fmtNumber(a)}</label>
        <div className="slider-container">
          <input type="range" min="-3" max="3" step="0.5" value={a} onChange={(e) => onSetA(parseFloat(e.target.value))} className="slider" />
          <input
            type="number"
            value={a}
            onChange={(e) => onSetA(parseFloat(e.target.value) || 0)}
            className="manual-input"
            step="any"
          />
        </div>
      </div>
      <div className="control-group">
        <label className="control-label">b = {fmtNumber(b)}</label>
        <div className="slider-container">
          <input type="range" min="-10" max="10" step="0.5" value={b} onChange={(e) => onSetB(parseFloat(e.target.value))} className="slider" />
          <input
            type="number"
            value={b}
            onChange={(e) => onSetB(parseFloat(e.target.value) || 0)}
            className="manual-input"
            step="any"
          />
        </div>
      </div>
      <div className="control-group">
        <label className="control-label">c = {fmtNumber(c)}</label>
        <div className="slider-container">
          <input type="range" min="-10" max="10" step="0.5" value={c} onChange={(e) => onSetC(parseFloat(e.target.value))} className="slider" />
          <input
            type="number"
            value={c}
            onChange={(e) => onSetC(parseFloat(e.target.value) || 0)}
            className="manual-input"
            step="any"
          />
        </div>
      </div>
      <div className="presets">
        {PRESETS.map((preset, i) => (
          <button key={i} className="preset-btn" onClick={() => onLoadPreset(preset)}>{preset.label}</button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ a, b, c }) {
  const disc = useMemo(() => getDiscriminant(a, b, c), [a, b, c]);
  const roots = useMemo(() => getRoots(a, b, c), [a, b, c]);

  const getStatus = () => {
    if (disc > 0.01) return "Two distinct real roots";
    if (disc < -0.01) return "No real roots (two complex)";
    return "One repeated real root";
  };

  const getExplanation = () => {
    if (disc > 0.01) return "The parabola crosses the x-axis at two points. The discriminant is positive, so the quadratic formula yields two different real values.";
    if (disc < -0.01) return "The parabola does not touch the x-axis. The discriminant is negative, so the square root in the quadratic formula involves an imaginary number.";
    return "The parabola touches the x-axis at exactly one point (the vertex). The discriminant is zero, so the quadratic formula has a repeated root.";
  };

  return (
    <div className="info-card">
      <h3>Discriminant Analysis</h3>
      <div className="disc-display">
        <div className="disc-formula">Δ = b² − 4ac</div>
        <div className="disc-value">{fmtNumber(disc)}</div>
        <div className="disc-status">{getStatus()}</div>
      </div>

      <div className="info-section">
        <div className="info-section-title">Interpretation</div>
        <p className="info-text">{getExplanation()}</p>
      </div>

      {roots.length > 0 && (
        <div className="info-section">
          <div className="info-section-title">Root{roots.length > 1 ? "s" : ""}</div>
          <ul className="root-list">
            {roots.map((r, i) => <li key={i}>x = {fmtNumber(r)}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExportFooter({ svgRef, a, b, c }) {
  const handleExportSvg = () => {
    if (svgRef.current) exportSvg(svgRef.current, `discriminant-${Date.now()}.svg`, GRAPH_VP);
  };

  const handleExportPng = () => {
    if (svgRef.current) exportPng(svgRef.current, `discriminant-${Date.now()}.png`, GRAPH_VP);
  };

  const handleMagnify = () => {
    if (svgRef.current) openMagnifiedGraph(svgRef.current, `y = ${formatQuadratic(a, b, c)}`);
  };

  return (
    <div className="export-footer">
      <button className="export-btn" onClick={handleExportSvg}>Export SVG</button>
      <button className="export-btn" onClick={handleExportPng}>Export PNG</button>
      <button className="magnify-btn" onClick={handleMagnify}>🔍 Magnify</button>
    </div>
  );
}

/* ─── Main App ─── */

function App() {
  // Initialize from URL parameters
  const getInitialValue = (param, defaultVal) => {
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(param);
    return value !== null ? parseFloat(value) : defaultVal;
  };

  const [a, setA] = useState(() => getInitialValue('a', 1));
  const [b, setB] = useState(() => getInitialValue('b', -5));
  const [c, setC] = useState(() => getInitialValue('c', 6));
  const svgRef = useRef(null);

  // Update URL when parameters change
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('a', a);
    url.searchParams.set('b', b);
    url.searchParams.set('c', c);
    window.history.replaceState({}, '', url);
  }, [a, b, c]);

  const handleLoadPreset = (preset) => {
    setA(preset.a);
    setB(preset.b);
    setC(preset.c);
  };

  if (a === 0) {
    return (
      <>
        <HamburgerMenu />
        <div className="page">
          <Breadcrumb />
          <HeroSection />
          <div className="control-panel">
            <p style={{ color: "var(--accent)", fontWeight: 600 }}>
              Error: Coefficient <strong>a</strong> cannot be zero. Please enter a non-zero value.
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
        <div className="main-grid">
          <div className="graph-card">
            <div className="svg-container">
              <GraphSvg a={a} b={b} c={c} svgRef={svgRef} />
            </div>
          </div>
          <div className="sidebar">
            <ControlPanel a={a} b={b} c={c} onSetA={setA} onSetB={setB} onSetC={setC} onLoadPreset={handleLoadPreset} />
            <InfoCard a={a} b={b} c={c} />
            <ExportFooter svgRef={svgRef} a={a} b={b} c={c} />
          </div>
        </div>
        <RelatedTools />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
