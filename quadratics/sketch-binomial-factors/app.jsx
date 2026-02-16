const { useMemo, useRef, useState } = React;

/* ─── Constants ─── */

const MAX_STEP = 5;
const VIEWPORT = { w: 820, h: 560 };
const PAD = 80;
const MAX_INNER_W = VIEWPORT.w - PAD * 2;
const MAX_INNER_H = VIEWPORT.h - PAD * 2;
const SVG_FONT = '"Manrope", "Segoe UI", system-ui, sans-serif';
const SVG_MONO = '"Space Mono", "SFMono-Regular", Consolas, monospace';

const PRESETS = [
  { label: "(x + 3)(x + 2)",   bin1: "(x+3)",  bin2: "(x+2)"  },
  { label: "(x \u2212 7)(x + 2)",  bin1: "(x-7)",  bin2: "(x+2)"  },
  { label: "(2x \u2212 5)(x + 3)", bin1: "(2x-5)", bin2: "(x+3)"  },
  { label: "(\u2212x + 3)(4x \u2212 1)", bin1: "(-x+3)", bin2: "(4x-1)" },
  { label: "(2x)(x \u2212 5)",     bin1: "(2x)",   bin2: "(x-5)"  },
];

/* ─── Math Utilities (unchanged) ─── */

function absNonNeg(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.abs(n));
}

function isValidVarChar(ch) {
  return /^[a-zA-Z]$/.test(ch);
}

function trimOuterParens(s) {
  let t = s.trim();
  if (t.startsWith("(") && t.endsWith(")")) {
    let depth = 0;
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === "(") depth++;
      else if (t[i] === ")") depth--;
      if (depth === 0) return t;
    }
    t = t.slice(1, -1).trim();
  }
  return t;
}

function parseLinearBinomial(raw) {
  const input = trimOuterParens(String(raw ?? "")).replace(/\s+/g, "");
  if (!input) return { ok: false, error: "Empty input." };

  let varName = null;
  for (const ch of input) {
    if (isValidVarChar(ch)) { varName = ch; break; }
  }

  if (!varName) {
    const b = Number(input);
    if (!Number.isFinite(b)) return { ok: false, error: `Invalid constant: "${raw}"` };
    return { ok: true, varName: "x", a: 0, b };
  }

  const vars = new Set([...input].filter(isValidVarChar));
  if (vars.size > 1) return { ok: false, error: `Only one variable allowed. Found: ${[...vars].join(", ")}` };

  const idx = input.indexOf(varName);
  const coefStrRaw = input.slice(0, idx);
  const tail = input.slice(idx + 1);

  let b = 0;
  if (tail.length > 0) {
    if (!(tail.startsWith("+") || tail.startsWith("-"))) {
      return { ok: false, error: `Expected + or \u2212 after ${varName}. Got "${tail}"` };
    }
    const bNum = Number(tail);
    if (!Number.isFinite(bNum)) return { ok: false, error: `Invalid constant part: "${tail}"` };
    b = bNum;
  }

  let a;
  const coefStr = coefStrRaw;
  if (coefStr === "" || coefStr === "+") a = 1;
  else if (coefStr === "-") a = -1;
  else {
    const aNum = Number(coefStr);
    if (!Number.isFinite(aNum)) return { ok: false, error: `Invalid coefficient: "${coefStr}"` };
    a = aNum;
  }

  return { ok: true, varName, a, b };
}

function fmtNumber(n) {
  if (!Number.isFinite(n)) return "\u2014";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 10) return n.toFixed(2);
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function fmtSigned(n) {
  const s = fmtNumber(n);
  if (s === "0") return "+ 0";
  return n >= 0 ? `+ ${s}` : `\u2212 ${fmtNumber(Math.abs(n))}`;
}

function fmtLinearTerm(coef, varName) {
  if (coef === 0) return "0";
  if (coef === 1) return varName;
  if (coef === -1) return `\u2212${varName}`;
  return `${fmtNumber(coef)}${varName}`;
}

function polyToString(A, B, C, varName) {
  const parts = [];
  const pushTerm = (coeff, pow) => {
    if (!Number.isFinite(coeff) || coeff === 0) return;
    const abs = Math.abs(coeff);
    const sign = coeff < 0 ? "\u2212" : "+";
    const coefPart = (abs === 1 && pow > 0) ? "" : fmtNumber(abs);
    const varPart = pow === 0 ? "" : (pow === 1 ? varName : `${varName}\u00b2`);
    const txt = `${coefPart}${varPart}` || "0";
    if (parts.length === 0) parts.push((sign === "\u2212" ? "\u2212" : "") + txt);
    else parts.push(` ${sign} ${txt}`);
  };
  pushTerm(A, 2);
  pushTerm(B, 1);
  pushTerm(C, 0);
  return parts.length ? parts.join("") : "0";
}

function computeFoil(p, q) {
  const { a, b, varName } = p;
  const { a: c, b: d } = q;
  const ac = a * c;
  const ad = a * d;
  const bc = b * c;
  const bd = b * d;
  return {
    varName, a, b, c, d,
    ac, ad, bc, bd,
    A: ac, B: ad + bc, C: bd,
    expanded: polyToString(ac, ad + bc, bd, varName),
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

function svgToString(svgEl) {
  const clone = svgEl.cloneNode(true);
  const vb = clone.getAttribute("viewBox") || `0 0 ${VIEWPORT.w} ${VIEWPORT.h}`;
  const [, , w, h] = vb.split(/\s+/).map(Number);
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(w || VIEWPORT.w));
  bg.setAttribute("height", String(h || VIEWPORT.h));
  bg.setAttribute("fill", "rgba(0,0,0,0)");
  clone.insertBefore(bg, clone.firstChild);
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("xmlns:xlink")) clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const serializer = new XMLSerializer();
  const str = serializer.serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${str}`;
}

async function exportSvg(svgEl, filename) {
  const svgStr = svgToString(svgEl);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

async function exportPng(svgEl, filename, scale = 2) {
  const svgStr = svgToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = "async";
    const vb = svgEl.getAttribute("viewBox") || `0 0 ${VIEWPORT.w} ${VIEWPORT.h}`;
    const [, , w, h] = vb.split(/\s+/).map(Number);
    const width = (w || VIEWPORT.w) * scale;
    const height = (h || VIEWPORT.h) * scale;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ─── Educational Step Content ─── */

function getStepContent(step, model) {
  if (!model) return null;
  const v = model.varName;

  const bin1Str = `${fmtLinearTerm(model.a, v)} ${fmtSigned(model.b)}`;
  const bin2Str = `${fmtLinearTerm(model.c, v)} ${fmtSigned(model.d)}`;

  return [
    {
      label: "Step 1 of 6",
      heading: "The Whole Product",
      body: `We want to multiply (${bin1Str}) by (${bin2Str}). Think of the answer as the area of a rectangle whose sides are the two binomials.`,
    },
    {
      label: "Step 2 of 6",
      heading: "Split into Four Parts",
      body: `Each binomial has two terms. Splitting both sides gives us four smaller rectangles inside the big one \u2014 this is the heart of the FOIL method: First, Outer, Inner, Last.`,
    },
    {
      label: "Step 3 of 6",
      heading: "Label the Sides",
      body: `The top edge is split into \u201c${fmtLinearTerm(model.a, v)}\u201d and \u201c${fmtNumber(model.b)}\u201d (terms of the first binomial). The left edge is split into \u201c${fmtLinearTerm(model.c, v)}\u201d and \u201c${fmtNumber(model.d)}\u201d (terms of the second).`,
    },
    {
      label: "Step 4 of 6",
      heading: "Fill the Four Areas (FOIL)",
      body: `Each small rectangle\u2019s area equals its width \u00d7 height:`,
      math: (
        <>
          <div className="foil-line" style={{ color: "var(--q1-solid)" }}>
            <strong>First:</strong>{`  ${fmtLinearTerm(model.a, v)} \u00d7 ${fmtLinearTerm(model.c, v)}  =  ${fmtNumber(model.ac)}${v}\u00b2`}
          </div>
          <div className="foil-line" style={{ color: "var(--q2-solid)" }}>
            <strong>Outer:</strong>{`  ${fmtLinearTerm(model.a, v)} \u00d7 ${fmtNumber(model.d)}  =  ${fmtNumber(model.ad)}${v}`}
          </div>
          <div className="foil-line" style={{ color: "var(--q3-solid)" }}>
            <strong>Inner:</strong>{`  ${fmtNumber(model.b)} \u00d7 ${fmtLinearTerm(model.c, v)}  =  ${fmtNumber(model.bc)}${v}`}
          </div>
          <div className="foil-line" style={{ color: "var(--q4-solid)" }}>
            <strong>Last:</strong>{`  ${fmtNumber(model.b)} \u00d7 ${fmtNumber(model.d)}  =  ${fmtNumber(model.bd)}`}
          </div>
        </>
      ),
      foilLegend: true,
    },
    {
      label: "Step 5 of 6",
      heading: "Read the Products",
      body: `Each sub-rectangle is now labeled with its value. Notice that the Outer (${fmtNumber(model.ad)}${v}) and Inner (${fmtNumber(model.bc)}${v}) terms are \u201clike terms\u201d \u2014 they both contain ${v} to the first power.`,
      math: (
        <>
          <span style={{ color: "var(--q1-solid)", fontWeight: 700 }}>{fmtNumber(model.ac)}{v}\u00b2</span>
          {"  +  "}
          <span style={{ color: "var(--q2-solid)", fontWeight: 700 }}>{fmtNumber(model.ad)}{v}</span>
          {"  +  "}
          <span style={{ color: "var(--q3-solid)", fontWeight: 700 }}>{fmtNumber(model.bc)}{v}</span>
          {"  +  "}
          <span style={{ color: "var(--q4-solid)", fontWeight: 700 }}>{fmtNumber(model.bd)}</span>
        </>
      ),
      foilLegend: true,
    },
    {
      label: "Step 6 of 6",
      heading: "Combine Like Terms",
      body: `Add the Outer and Inner terms: ${fmtNumber(model.ad)}${v} + ${fmtNumber(model.bc)}${v} = ${fmtNumber(model.B)}${v}. This gives us the final answer!`,
      math: (
        <>
          <span style={{ color: "var(--q2-solid)" }}>{fmtNumber(model.ad)}{v}</span>
          {" + "}
          <span style={{ color: "var(--q3-solid)" }}>{fmtNumber(model.bc)}{v}</span>
          {" = "}
          <strong>{fmtNumber(model.B)}{v}</strong>
        </>
      ),
      isFinal: true,
    },
  ][step] || null;
}

/* ─── React Components ─── */

function PolyDisplay({ A, B, C, varName }) {
  const terms = [];
  const addTerm = (coeff, pow) => {
    if (!Number.isFinite(coeff) || coeff === 0) return;
    const abs = Math.abs(coeff);
    const sign = coeff < 0 ? "\u2212" : "+";
    const coefPart = (abs === 1 && pow > 0) ? "" : fmtNumber(abs);
    const varPart = pow === 0
      ? null
      : pow === 1
        ? varName
        : <>{varName}<sup>2</sup></>;
    terms.push(
      <span key={pow}>
        {terms.length === 0 ? (coeff < 0 ? "\u2212" : "") : ` ${sign} `}
        {coefPart}{varPart}
      </span>
    );
  };
  addTerm(A, 2);
  addTerm(B, 1);
  addTerm(C, 0);
  return terms.length ? <>{terms}</> : <>0</>;
}

function HeroSection() {
  return (
    <header className="hero">
      <p className="eyebrow">Math Lab</p>
      <h1>FOIL Binomial Multiplication</h1>
      <p className="subhead">
        Multiply two binomials step by step using the area model.
        Watch each FOIL product appear as a colored rectangle.
      </p>
    </header>
  );
}

function InputBar({ bin1, bin2, onBin1Change, onBin2Change, onPreset }) {
  return (
    <div className="input-bar">
      <div className="input-row">
        <input
          type="text"
          value={bin1}
          onChange={(e) => onBin1Change(e.target.value)}
          placeholder="(x + 3)"
          aria-label="First binomial"
        />
        <span className="times">&times;</span>
        <input
          type="text"
          value={bin2}
          onChange={(e) => onBin2Change(e.target.value)}
          placeholder="(2x - 5)"
          aria-label="Second binomial"
        />
      </div>
      <div className="presets">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            className="preset-btn"
            onClick={() => onPreset(p.bin1, p.bin2)}
          >
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

function ExplanationPanel({ content }) {
  if (!content) return null;
  return (
    <div className="explanation-card">
      <div className="step-label">{content.label}</div>
      <h3>{content.heading}</h3>
      <p>{content.body}</p>
      {content.math && (
        <div className="math-display">{content.math}</div>
      )}
      {content.foilLegend && (
        <div className="foil-legend">
          <span><span className="legend-swatch" style={{ background: "var(--q1-solid)" }} /> First</span>
          <span><span className="legend-swatch" style={{ background: "var(--q2-solid)" }} /> Outer</span>
          <span><span className="legend-swatch" style={{ background: "var(--q3-solid)" }} /> Inner</span>
          <span><span className="legend-swatch" style={{ background: "var(--q4-solid)" }} /> Last</span>
        </div>
      )}
    </div>
  );
}

function ResultCard({ model, bin1, bin2 }) {
  const [copied, setCopied] = useState(false);
  const equationText = polyToString(model.A, model.B, model.C, model.varName);

  function handleCopy() {
    navigator.clipboard.writeText(`${bin1} \u00d7 ${bin2} = ${equationText}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="result-card">
      <div className="result-input">{bin1} &times; {bin2}</div>
      <h3>Final Answer</h3>
      <div className="result-equation">
        <PolyDisplay A={model.A} B={model.B} C={model.C} varName={model.varName} />
      </div>
      <button className="copy-btn" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy equation"}
      </button>
    </div>
  );
}

function ExportFooter({ svgRef, model, bin1, bin2 }) {
  async function onExportSvg() {
    if (!svgRef.current || !model) return;
    const name = `foil_${bin1.replace(/\s+/g, "")}_x_${bin2.replace(/\s+/g, "")}.svg`
      .replace(/[^\w\-\.\(\)\+]+/g, "_");
    await exportSvg(svgRef.current, name);
  }
  async function onExportPng() {
    if (!svgRef.current || !model) return;
    const name = `foil_${bin1.replace(/\s+/g, "")}_x_${bin2.replace(/\s+/g, "")}.png`
      .replace(/[^\w\-\.\(\)\+]+/g, "_");
    await exportPng(svgRef.current, name, 2);
  }
  return (
    <div className="export-footer">
      <button onClick={onExportSvg} disabled={!model}>Export SVG</button>
      <button onClick={onExportPng} disabled={!model}>Export PNG</button>
    </div>
  );
}

/* ─── Area Model SVG ─── */

function AreaModelSvg({ model, step, svgRef }) {
  const wA = absNonNeg(model.a);
  const wB = absNonNeg(model.b);
  const hC = absNonNeg(model.c);
  const hD = absNonNeg(model.d);

  const totalW = wA + wB;
  const totalH = hC + hD;

  const scale = useMemo(() => {
    const safeW = totalW > 0 ? MAX_INNER_W / totalW : 1;
    const safeH = totalH > 0 ? MAX_INNER_H / totalH : 1;
    const s = Math.min(safeW, safeH);
    return Number.isFinite(s) && s > 0 ? s : 1;
  }, [totalW, totalH]);

  const x0 = PAD;
  const y0 = PAD;

  const pxA = wA * scale;
  const pxB = wB * scale;
  const pxC = hC * scale;
  const pxD = hD * scale;

  const W = totalW * scale;
  const H = totalH * scale;

  const showOutline = step >= 0;
  const showPartitions = step >= 1;
  const showEdgeLabels = step >= 2;
  const showFills = step >= 3;
  const showBlockLabels = step >= 4;
  const showCombineHint = step >= 5;

  const fade = (on) => ({
    opacity: on ? 1 : 0,
    transition: "opacity 420ms ease",
  });

  const v = model.varName;

  // FOIL order: First (ac)=q1, Outer (ad)=q2, Inner (bc)=q3, Last (bd)=q4
  const rects = [
    { key: "ac", x: x0,       y: y0,       w: pxA, h: pxC, cls: "q1", label: `(${fmtLinearTerm(model.a, v)})(${fmtLinearTerm(model.c, v)})`, value: model.ac, show: showFills },
    { key: "bc", x: x0 + pxA, y: y0,       w: pxB, h: pxC, cls: "q3", label: `(${fmtNumber(model.b)})(${fmtLinearTerm(model.c, v)})`,       value: model.bc, show: showFills },
    { key: "ad", x: x0,       y: y0 + pxC, w: pxA, h: pxD, cls: "q2", label: `(${fmtLinearTerm(model.a, v)})(${fmtNumber(model.d)})`,       value: model.ad, show: showFills },
    { key: "bd", x: x0 + pxA, y: y0 + pxC, w: pxB, h: pxD, cls: "q4", label: `(${fmtNumber(model.b)})(${fmtNumber(model.d)})`,             value: model.bd, show: showFills },
  ];

  function centerLabel(r) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const fontSize = Math.max(14, Math.min(22, Math.min(r.w, r.h) / 5));
    const val = fmtNumber(r.value);

    if (r.w < 10 || r.h < 10) return null;

    return (
      <g style={fade(showBlockLabels)}>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={fontSize} fontFamily={SVG_MONO} fontWeight="700" fill="rgba(11, 13, 23, 0.85)">
          {val}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={Math.max(12, fontSize - 4)} fontFamily={SVG_FONT} fill="rgba(11, 13, 23, 0.50)">
          {r.label}
        </text>
      </g>
    );
  }

  const topY = y0 - 20;
  const leftX = x0 - 20;
  const hasNeg = model.a < 0 || model.b < 0 || model.c < 0 || model.d < 0;
  const hasZero = wA === 0 || wB === 0 || hC === 0 || hD === 0;

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${VIEWPORT.w} ${VIEWPORT.h}`} role="img" aria-label="Area model diagram">
      <style>{`text { font-family: ${SVG_FONT}; }`}</style>

      <g style={fade(showOutline)}>
        <rect
          x={x0} y={y0} width={W} height={H}
          fill="rgba(15, 23, 42, 0.02)"
          stroke="rgba(15, 23, 42, 0.20)"
          strokeWidth="2"
          rx="12"
        />
      </g>

      {rects.map(r => (
        <g key={r.key} style={fade(r.show)}>
          <rect
            x={r.x} y={r.y}
            width={Math.max(0, r.w)} height={Math.max(0, r.h)}
            fill={`var(--${r.cls})`}
            stroke="rgba(15, 23, 42, 0.12)"
            strokeWidth="1"
          />
        </g>
      ))}

      <g style={fade(showPartitions)}>
        <line x1={x0 + pxA} y1={y0} x2={x0 + pxA} y2={y0 + H} stroke="rgba(15, 23, 42, 0.25)" strokeWidth="2" />
        <line x1={x0} y1={y0 + pxC} x2={x0 + W} y2={y0 + pxC} stroke="rgba(15, 23, 42, 0.25)" strokeWidth="2" />
      </g>

      <g style={fade(showEdgeLabels)}>
        <text x={x0 + pxA / 2} y={topY} textAnchor="middle" fontSize="16" fontWeight="600" fill="rgba(11, 13, 23, 0.75)">
          {fmtLinearTerm(model.a, v)}
        </text>
        <text x={x0 + pxA + pxB / 2} y={topY} textAnchor="middle" fontSize="16" fontWeight="600" fill="rgba(11, 13, 23, 0.75)">
          {fmtNumber(model.b)}
        </text>
        <text x={leftX} y={y0 + pxC / 2} textAnchor="end" dominantBaseline="middle" fontSize="16" fontWeight="600" fill="rgba(11, 13, 23, 0.75)">
          {fmtLinearTerm(model.c, v)}
        </text>
        <text x={leftX} y={y0 + pxC + pxD / 2} textAnchor="end" dominantBaseline="middle" fontSize="16" fontWeight="600" fill="rgba(11, 13, 23, 0.75)">
          {fmtNumber(model.d)}
        </text>
      </g>

      {rects.map(r => (
        <g key={r.key + "-label"}>{centerLabel(r)}</g>
      ))}

      <g style={fade(showCombineHint)}>
        <text x={x0 + W / 2} y={y0 + H + 40} textAnchor="middle" fontSize="15" fontFamily={SVG_MONO} fill="rgba(11, 13, 23, 0.70)">
          Combine: ({fmtNumber(model.ad)} + {fmtNumber(model.bc)}){v} = {fmtNumber(model.B)}{v}
        </text>
      </g>

      {hasNeg && (
        <text x={x0} y={y0 + H + 68} textAnchor="start" fontSize="12" fill="rgba(210, 71, 32, 0.8)">
          Note: geometry uses |coefficients| for drawing; signs are shown in the algebra.
        </text>
      )}
      {hasZero && (
        <text x={x0} y={y0 + H + (hasNeg ? 86 : 68)} textAnchor="start" fontSize="12" fill="rgba(210, 71, 32, 0.8)">
          Note: a zero coefficient collapses one dimension of the area model.
        </text>
      )}
    </svg>
  );
}

/* ─── App Root ─── */

function App() {
  const [bin1, setBin1] = useState("(x+3)");
  const [bin2, setBin2] = useState("(2x-5)");
  const [step, setStep] = useState(0);
  const svgRef = useRef(null);

  const parsed1 = useMemo(() => parseLinearBinomial(bin1), [bin1]);
  const parsed2 = useMemo(() => parseLinearBinomial(bin2), [bin2]);

  const parseError = useMemo(() => {
    if (!parsed1.ok) return `First binomial: ${parsed1.error}`;
    if (!parsed2.ok) return `Second binomial: ${parsed2.error}`;
    if (parsed1.ok && parsed2.ok && parsed1.varName !== parsed2.varName) {
      return `Variables must match. First uses \u201c${parsed1.varName}\u201d, second uses \u201c${parsed2.varName}\u201d.`;
    }
    return null;
  }, [parsed1, parsed2]);

  const model = useMemo(() => {
    if (parseError) return null;
    return computeFoil(parsed1, parsed2);
  }, [parsed1, parsed2, parseError]);

  function safeSetStep(next) {
    setStep(Math.max(0, Math.min(MAX_STEP, next)));
  }

  function handlePreset(b1, b2) {
    setBin1(b1);
    setBin2(b2);
    setStep(0);
  }

  const stepContent = model ? getStepContent(step, model) : null;

  return (
    <div className="page">
      <HeroSection />

      <InputBar
        bin1={bin1}
        bin2={bin2}
        onBin1Change={(v) => { setBin1(v); setStep(0); }}
        onBin2Change={(v) => { setBin2(v); setStep(0); }}
        onPreset={handlePreset}
      />

      {parseError && <div className="error-banner">{parseError}</div>}

      {model ? (
        <>
          <div className="diagram-card">
            <div className="svg-container">
              <AreaModelSvg model={model} step={step} svgRef={svgRef} />
            </div>
          </div>

          <StepNav step={step} onStep={safeSetStep} />

          <ExplanationPanel key={step} content={stepContent} />

          {step >= MAX_STEP && <ResultCard model={model} bin1={bin1} bin2={bin2} />}

          <ExportFooter svgRef={svgRef} model={model} bin1={bin1} bin2={bin2} />
        </>
      ) : (
        !parseError && (
          <div className="diagram-card">
            <div className="no-diagram">
              Enter two binomials above to see the area model.
            </div>
          </div>
        )
      )}
      </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
