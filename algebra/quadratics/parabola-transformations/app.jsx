const { useMemo, useRef, useState, useEffect } = React;

/* ─── Constants ─── */

const GRAPH_VP = { w: 820, h: 560 };
const PAD = 60;
const CURVE_SAMPLES = 200;
const SVG_FONT = '"Manrope", "Segoe UI", system-ui, sans-serif';
const SVG_MONO = '"Space Mono", "SFMono-Regular", Consolas, monospace';

const PRESETS = [
  { label: "Parent Function: y = x²", a: 1, h: 0, k: 0 },
  { label: "Vertical Shift Up: y = x² + 3", a: 1, h: 0, k: 3 },
  { label: "Horizontal Shift Right: y = (x − 2)²", a: 1, h: 2, k: 0 },
  { label: "Vertical Stretch: y = 2x²", a: 2, h: 0, k: 0 },
  { label: "Reflection + Shift: y = −(x − 1)² + 4", a: -1, h: 1, k: 4 },
  { label: "Combined: y = 0.5(x + 2)² − 3", a: 0.5, h: -2, k: -3 },
];

/* ─── Math Utilities ─── */

function evaluateParabola(a, h, k, x) {
  return a * (x - h) * (x - h) + k;
}

function evaluateParent(x) {
  return x * x;
}

function getVertex(h, k) {
  return { x: h, y: k };
}

function toStandardForm(a, h, k) {
  // y = a(x - h)² + k
  // y = a(x² - 2hx + h²) + k
  // y = ax² - 2ahx + ah² + k
  const b = -2 * a * h;
  const c = a * h * h + k;
  return { a, b, c };
}

function getAutoViewRange(a, h, k) {
  const vertex = { x: h, y: k };

  // Include vertex and some range around it
  const xRange = Math.max(Math.abs(h) + 5, 5);
  const xMin = h - xRange;
  const xMax = h + xRange;

  // Calculate y values at bounds
  const yAtLeft = evaluateParabola(a, h, k, xMin);
  const yAtRight = evaluateParabola(a, h, k, xMax);

  let yMin, yMax;
  if (a > 0) {
    // Opens up: vertex is minimum
    yMin = Math.min(k, -3);
    yMax = Math.max(yAtLeft, yAtRight, 10);
  } else {
    // Opens down: vertex is maximum
    yMin = Math.min(yAtLeft, yAtRight, -3);
    yMax = Math.max(k, 10);
  }

  const yMargin = (yMax - yMin) * 0.1;

  return {
    xMin,
    xMax,
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

function formatVertexForm(a, h, k) {
  let str = "y = ";

  // Coefficient a
  if (a === 1) str += "(x";
  else if (a === -1) str += "−(x";
  else str += `${fmtNumber(a)}(x`;

  // Horizontal shift h
  if (h > 0) str += ` − ${fmtNumber(h)})²`;
  else if (h < 0) str += ` + ${fmtNumber(Math.abs(h))})²`;
  else str += ")²";

  // Vertical shift k
  if (k > 0) str += ` + ${fmtNumber(k)}`;
  else if (k < 0) str += ` − ${fmtNumber(Math.abs(k))}`;

  return str;
}

function formatStandardForm(a, b, c) {
  let str = "y = ";

  // ax² term
  if (a === 1) str += "x²";
  else if (a === -1) str += "−x²";
  else str += `${fmtNumber(a)}x²`;

  // bx term
  if (b !== 0) {
    if (b > 0) str += ` + ${fmtNumber(b)}x`;
    else str += ` − ${fmtNumber(Math.abs(b))}x`;
  }

  // c term
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
      <span className="breadcrumb-current">Transformations</span>
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
            <li><a href="../parabola-transformations/">Transformations</a></li>
            <li><a href="../discriminant-visualizer/">Discriminant</a></li>
            <li><a href="../quadratic-properties/">Properties</a></li>
            <li><a href="../completing-the-square/">Completing the Square</a></li>
            <li><a href="../sketch-binomial-factors/">Binomial Multiplication</a></li>
            <li><a href="../quadratic-form-converter/">Form Converter</a></li>
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
        <a className="related-card" href="../quadratic-inequality-region/">
          <div className="related-card-tag">Inequalities</div>
          <h4>Inequality Regions</h4>
          <p>Graph two-variable quadratic inequalities</p>
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
      <h1>Parabola Transformations</h1>
      <p className="subhead">
        Explore how the parameters a, h, and k transform the parent function y = x² into y = a(x − h)² + k.
      </p>
    </header>
  );
}

function GraphSvg({ a, h, k, svgRef }) {
  const bounds = useMemo(() => getAutoViewRange(a, h, k), [a, h, k]);
  const vertex = useMemo(() => getVertex(h, k), [h, k]);

  // Build parent curve (y = x²) polyline points
  const parentPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateParent(mx);
      if (Number.isFinite(my) && my >= bounds.yMin && my <= bounds.yMax) {
        const s = toSvg(mx, my, bounds);
        pts.push(`${s.x.toFixed(2)},${s.y.toFixed(2)}`);
      }
    }
    return pts.join(" ");
  }, [bounds]);

  // Build transformed curve polyline points
  const transformedPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const mx = bounds.xMin + (i / CURVE_SAMPLES) * (bounds.xMax - bounds.xMin);
      const my = evaluateParabola(a, h, k, mx);
      if (Number.isFinite(my)) {
        const s = toSvg(mx, my, bounds);
        const cy = Math.max(-50, Math.min(GRAPH_VP.h + 50, s.y));
        pts.push(`${s.x.toFixed(2)},${cy.toFixed(2)}`);
      }
    }
    return pts.join(" ");
  }, [a, h, k, bounds]);

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

  const vertexFormText = formatVertexForm(a, h, k);

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${GRAPH_VP.w} ${GRAPH_VP.h}`} role="img" aria-label="Parabola transformations graph">
      <defs>
        <clipPath id="plot-area">
          <rect x={PAD} y={PAD - 10} width={GRAPH_VP.w - PAD * 2} height={GRAPH_VP.h - PAD * 2 + 20} />
        </clipPath>
      </defs>

      {/* Header with equation */}
      <text x={GRAPH_VP.w / 2} y={28} textAnchor="middle" fontSize="16"
        fontFamily={SVG_FONT} fontWeight="600" fill="#0b0d17">
        {vertexFormText}
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

      {/* Parent function curve (y = x²) */}
      {parentPoints && (
        <g clipPath="url(#plot-area)">
          <polyline
            points={parentPoints}
            fill="none"
            stroke="rgba(100, 116, 139, 0.4)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeDasharray="4 4"
          />
        </g>
      )}

      {/* Transformed parabola curve */}
      <g clipPath="url(#plot-area)">
        <polyline
          points={transformedPoints}
          fill="none"
          stroke="#ff6b3d"
          strokeWidth="3"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 2px 4px rgba(255,107,61,0.25))" }}
        />
      </g>

      {/* Vertex marker */}
      <g>
        {Number.isFinite(vertex.x) && (() => {
          const p = toSvg(vertex.x, vertex.y, bounds);
          const labelY = a > 0 ? p.y - 14 : p.y + 20;
          return (
            <>
              <circle cx={p.x} cy={p.y} r="6" fill="#3b82f6" stroke="#fff" strokeWidth="2.5" />
              <text x={p.x} y={labelY} textAnchor="middle" fontSize="11"
                fontFamily={SVG_MONO} fontWeight="700" fill="#3b82f6">
                Vertex ({fmtNumber(vertex.x)}, {fmtNumber(vertex.y)})
              </text>
            </>
          );
        })()}
      </g>
    </svg>
  );
}

function ControlPanel({ a, h, k, onSetA, onSetH, onSetK, onReset, onLoadPreset }) {
  return (
    <div className="control-panel">
      <h3>Transform Parameters</h3>

      <div className="control-group">
        <label className="control-label">
          a = {fmtNumber(a)}
          <span className="control-label-desc">vertical stretch/compress</span>
        </label>
        <div className="slider-container">
          <input
            type="range"
            min="-3"
            max="3"
            step="0.1"
            value={a}
            onChange={(e) => onSetA(parseFloat(e.target.value))}
            className="slider"
          />
          <span className="value-display">{fmtNumber(a)}</span>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">
          h = {fmtNumber(h)}
          <span className="control-label-desc">horizontal shift</span>
        </label>
        <div className="slider-container">
          <input
            type="range"
            min="-5"
            max="5"
            step="0.5"
            value={h}
            onChange={(e) => onSetH(parseFloat(e.target.value))}
            className="slider"
          />
          <span className="value-display">{fmtNumber(h)}</span>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">
          k = {fmtNumber(k)}
          <span className="control-label-desc">vertical shift</span>
        </label>
        <div className="slider-container">
          <input
            type="range"
            min="-5"
            max="5"
            step="0.5"
            value={k}
            onChange={(e) => onSetK(parseFloat(e.target.value))}
            className="slider"
          />
          <span className="value-display">{fmtNumber(k)}</span>
        </div>
      </div>

      <button className="reset-btn" onClick={onReset}>
        Reset to Parent Function
      </button>

      <div className="presets">
        {PRESETS.map((preset, i) => (
          <button key={i} className="preset-btn" onClick={() => onLoadPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ a, h, k }) {
  const standardForm = useMemo(() => toStandardForm(a, h, k), [a, h, k]);
  const standardFormText = formatStandardForm(standardForm.a, standardForm.b, standardForm.c);

  const getADescription = () => {
    if (Math.abs(a) < 0.01) return "Nearly horizontal";
    if (Math.abs(a - 1) < 0.01) return "No vertical change (parent function width)";
    if (Math.abs(a) > 1) return `Vertical stretch by factor of ${fmtNumber(Math.abs(a))}`;
    if (Math.abs(a) < 1) return `Vertical compression by factor of ${fmtNumber(Math.abs(a))}`;
    return "";
  };

  const getADirection = () => {
    if (a > 0) return "Opens upward";
    if (a < 0) return "Opens downward (reflected over x-axis)";
    return "";
  };

  const getHDescription = () => {
    if (Math.abs(h) < 0.01) return "No horizontal shift";
    if (h > 0) return `Shifted right by ${fmtNumber(h)} units`;
    if (h < 0) return `Shifted left by ${fmtNumber(Math.abs(h))} units`;
    return "";
  };

  const getKDescription = () => {
    if (Math.abs(k) < 0.01) return "No vertical shift";
    if (k > 0) return `Shifted up by ${fmtNumber(k)} units`;
    if (k < 0) return `Shifted down by ${fmtNumber(Math.abs(k))} units`;
    return "";
  };

  return (
    <div className="info-card">
      <h3>Transformation Effects</h3>

      <div className="info-row">
        <span className="info-label">Parameter a = {fmtNumber(a)}</span>
        <span className="info-value">{getADirection()}</span>
        <span className="info-description">{getADescription()}</span>
      </div>

      <div className="info-row">
        <span className="info-label">Parameter h = {fmtNumber(h)}</span>
        <span className="info-description">{getHDescription()}</span>
      </div>

      <div className="info-row">
        <span className="info-label">Parameter k = {fmtNumber(k)}</span>
        <span className="info-description">{getKDescription()}</span>
      </div>

      <div className="info-row">
        <span className="info-label">Vertex</span>
        <span className="info-value">({fmtNumber(h)}, {fmtNumber(k)})</span>
      </div>

      <div className="info-row">
        <span className="info-label">Standard Form</span>
        <span className="info-value">{standardFormText}</span>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-line parent"></div>
          <span>Parent: y = x²</span>
        </div>
        <div className="legend-item">
          <div className="legend-line transformed"></div>
          <span>Transformed: {formatVertexForm(a, h, k)}</span>
        </div>
      </div>
    </div>
  );
}

function ExportFooter({ svgRef, a, h, k }) {
  const handleExportSvg = () => {
    if (svgRef.current) {
      const filename = `parabola-transformation-${Date.now()}.svg`;
      exportSvg(svgRef.current, filename, GRAPH_VP);
    }
  };

  const handleExportPng = () => {
    if (svgRef.current) {
      const filename = `parabola-transformation-${Date.now()}.png`;
      exportPng(svgRef.current, filename, GRAPH_VP);
    }
  };

  const handleMagnify = () => {
    if (svgRef.current) {
      const title = formatVertexForm(a, h, k);
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
  // Initialize from URL parameters
  const getInitialValue = (param, defaultVal) => {
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(param);
    return value !== null ? parseFloat(value) : defaultVal;
  };

  const [a, setA] = useState(() => getInitialValue('a', 1));
  const [h, setH] = useState(() => getInitialValue('h', 0));
  const [k, setK] = useState(() => getInitialValue('k', 0));
  const svgRef = useRef(null);

  // Update URL when parameters change
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('a', a);
    url.searchParams.set('h', h);
    url.searchParams.set('k', k);
    window.history.replaceState({}, '', url);
  }, [a, h, k]);

  const handleReset = () => {
    setA(1);
    setH(0);
    setK(0);
  };

  const handleLoadPreset = (preset) => {
    setA(preset.a);
    setH(preset.h);
    setK(preset.k);
  };

  return (
    <>
      <HamburgerMenu />
      <div className="page">
        <Breadcrumb />
        <HeroSection />
        <div className="main-grid">
          <div className="graph-card">
            <div className="svg-container">
              <GraphSvg a={a} h={h} k={k} svgRef={svgRef} />
            </div>
          </div>
          <div className="sidebar">
            <ControlPanel
              a={a} h={h} k={k}
              onSetA={setA} onSetH={setH} onSetK={setK}
              onReset={handleReset}
              onLoadPreset={handleLoadPreset}
            />
            <InfoCard a={a} h={h} k={k} />
            <ExportFooter svgRef={svgRef} a={a} h={h} k={k} />
          </div>
        </div>
        <RelatedTools />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
