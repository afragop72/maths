const { useEffect, useMemo, useRef, useState } = React;

const MAX_STEP = 5;
const VIEWPORT = { w: 820, h: 560 };
const PAD = 80;
const MAX_INNER_W = VIEWPORT.w - PAD * 2;
const MAX_INNER_H = VIEWPORT.h - PAD * 2;
const SVG_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

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
  if (vars.size > 1) return { ok: false, error: `Only one variable supported. Found: ${[...vars].join(", ")}` };

  const idx = input.indexOf(varName);
  const coefStrRaw = input.slice(0, idx);
  const tail = input.slice(idx + 1);

  let b = 0;
  if (tail.length > 0) {
    if (!(tail.startsWith("+") || tail.startsWith("-"))) {
      return { ok: false, error: `Expected + or - after ${varName}. Got "${tail}"` };
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
  if (s === "0") return "+0";
  return n >= 0 ? `+${s}` : s;
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
    const sign = coeff < 0 ? "-" : "+";
    const coefPart = (abs === 1 && pow > 0) ? "" : fmtNumber(abs);
    const varPart = pow === 0 ? "" : (pow === 1 ? varName : `${varName}^${pow}`);
    const txt = `${coefPart}${varPart}` || "0";

    if (parts.length === 0) parts.push((sign === "-" ? "-" : "") + txt);
    else parts.push(` ${sign} ${txt}`);
  };

  pushTerm(A, 2);
  pushTerm(B, 1);
  pushTerm(C, 0);

  return parts.length ? parts.join("") : "0";
}

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

function computeFoil(p, q) {
  const { a, b, varName } = p;
  const { a: c, b: d } = q;

  const ac = a * c;
  const ad = a * d;
  const bc = b * c;
  const bd = b * d;

  return {
    varName,
    a, b, c, d,
    ac, ad, bc, bd,
    A: ac,
    B: ad + bc,
    C: bd,
    expanded: polyToString(ac, ad + bc, bd, varName),
  };
}

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

    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  const rects = [
    { key: "ac", x: x0,        y: y0,        w: pxA, h: pxC, className: "q1", label: `(${fmtLinearTerm(model.a, v)})(${fmtLinearTerm(model.c, v)})`, value: model.ac, show: showFills },
    { key: "bc", x: x0 + pxA,  y: y0,        w: pxB, h: pxC, className: "q2", label: `(${fmtNumber(model.b)})(${fmtLinearTerm(model.c, v)})`,       value: model.bc, show: showFills },
    { key: "ad", x: x0,        y: y0 + pxC,  w: pxA, h: pxD, className: "q3", label: `(${fmtLinearTerm(model.a, v)})(${fmtNumber(model.d)})`,       value: model.ad, show: showFills },
    { key: "bd", x: x0 + pxA,  y: y0 + pxC,  w: pxB, h: pxD, className: "q4", label: `(${fmtNumber(model.b)})(${fmtNumber(model.d)})`,             value: model.bd, show: showFills },
  ];

  function centerLabel(r) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const fontSize = Math.max(12, Math.min(18, Math.min(r.w, r.h) / 6));
    const val = fmtNumber(r.value);

    if (r.w < 8 || r.h < 8) return null;

    return (
      <g style={fade(showBlockLabels)}>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={fontSize} fill="rgba(232,236,255,0.95)">
          {val}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={Math.max(11, fontSize - 4)} fill="rgba(170,179,218,0.95)">
          {r.label}
        </text>
      </g>
    );
  }

  const topY = y0 - 18;
  const leftX = x0 - 18;
  const hasNeg = model.a < 0 || model.b < 0 || model.c < 0 || model.d < 0;
  const hasZero = wA === 0 || wB === 0 || hC === 0 || hD === 0;

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${VIEWPORT.w} ${VIEWPORT.h}`} role="img" aria-label="Area model diagram">
      <style>{`text { font-family: ${SVG_FONT}; }`}</style>

      <g style={fade(showOutline)}>
        <rect
          x={x0} y={y0} width={W} height={H}
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth="2"
          rx="12"
        />
      </g>

      {rects.map(r => (
        <g key={r.key} style={fade(r.show)}>
          <rect
            x={r.x} y={r.y}
            width={Math.max(0, r.w)} height={Math.max(0, r.h)}
            fill={`var(--${r.className})`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
        </g>
      ))}

      <g style={fade(showPartitions)}>
        <line x1={x0 + pxA} y1={y0} x2={x0 + pxA} y2={y0 + H} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <line x1={x0} y1={y0 + pxC} x2={x0 + W} y2={y0 + pxC} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      </g>

      <g style={fade(showEdgeLabels)}>
        <text x={x0 + pxA / 2} y={topY} textAnchor="middle" fontSize="14" fill="rgba(170,179,218,0.95)">
          {fmtLinearTerm(model.a, v)}
        </text>
        <text x={x0 + pxA + pxB / 2} y={topY} textAnchor="middle" fontSize="14" fill="rgba(170,179,218,0.95)">
          {fmtNumber(model.b)}
        </text>

        <text x={leftX} y={y0 + pxC / 2} textAnchor="end" dominantBaseline="middle" fontSize="14" fill="rgba(170,179,218,0.95)">
          {fmtLinearTerm(model.c, v)}
        </text>
        <text x={leftX} y={y0 + pxC + pxD / 2} textAnchor="end" dominantBaseline="middle" fontSize="14" fill="rgba(170,179,218,0.95)">
          {fmtNumber(model.d)}
        </text>
      </g>

      {rects.map(r => (
        <g key={r.key + "-label"}>{centerLabel(r)}</g>
      ))}

      <g style={fade(showCombineHint)}>
        <text x={x0 + W / 2} y={y0 + H + 36} textAnchor="middle" fontSize="14" fill="rgba(232,236,255,0.92)">
          Combine like terms: ({fmtNumber(model.ad)} + {fmtNumber(model.bc)}){v} = {fmtNumber(model.B)}{v}
        </text>
      </g>

      {hasNeg && (
        <text x={x0} y={y0 + H + 62} textAnchor="start" fontSize="12" fill="rgba(255,199,0,0.9)">
          Note: geometry uses |coefficients| for drawing (signs still shown in algebra).
        </text>
      )}
      {hasZero && (
        <text x={x0} y={y0 + H + (hasNeg ? 80 : 62)} textAnchor="start" fontSize="12" fill="rgba(255,199,0,0.9)">
          Note: a zero coefficient collapses one dimension of the area model.
        </text>
      )}
    </svg>
  );
}

function App() {
  const [bin1, setBin1] = useState("(x+3)");
  const [bin2, setBin2] = useState("(2x-5)");

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(900);

  const timerRef = useRef(null);
  const svgRef = useRef(null);

  const parsed1 = useMemo(() => parseLinearBinomial(bin1), [bin1]);
  const parsed2 = useMemo(() => parseLinearBinomial(bin2), [bin2]);

  const parseError = useMemo(() => {
    if (!parsed1.ok) return `Left binomial: ${parsed1.error}`;
    if (!parsed2.ok) return `Right binomial: ${parsed2.error}`;
    if (parsed1.ok && parsed2.ok && parsed1.varName !== parsed2.varName) {
      return `Variables must match. Left uses "${parsed1.varName}", right uses "${parsed2.varName}".`;
    }
    return null;
  }, [parsed1, parsed2]);

  const model = useMemo(() => {
    if (parseError) return null;
    return computeFoil(parsed1, parsed2);
  }, [parsed1, parsed2, parseError]);

  useEffect(() => {
    if (!playing) return;
    if (parseError) return;

    timerRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= MAX_STEP) return MAX_STEP;
        const next = s + 1;
        if (next >= MAX_STEP) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setPlaying(false);
        }
        return next;
      });
    }, speedMs);

    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, speedMs, parseError]);

  function resetAll() {
    setBin1("(x+3)");
    setBin2("(2x-5)");
    setStep(0);
    setPlaying(false);
    setSpeedMs(900);
  }

  function safeSetStep(next) {
    setStep(Math.max(0, Math.min(MAX_STEP, next)));
  }

  const stepsText = [
    "1) Draw the outer rectangle (total product).",
    "2) Add partitions (split into 4 products).",
    "3) Label side lengths (terms of each binomial).",
    "4) Fill the 4 sub-rectangles (FOIL areas).",
    "5) Label each area with its product.",
    "6) Combine like terms into the final polynomial.",
  ];

  const exportDisabled = !model;

  async function onExportSvg() {
    if (!svgRef.current || !model) return;
    const name = `area-model_${bin1.replace(/\s+/g, "")}__${bin2.replace(/\s+/g, "")}.svg`
      .replace(/[^\w\-\.\(\)\+]+/g, "_");
    await exportSvg(svgRef.current, name);
  }

  async function onExportPng() {
    if (!svgRef.current || !model) return;
    const name = `area-model_${bin1.replace(/\s+/g, "")}__${bin2.replace(/\s+/g, "")}.png`
      .replace(/[^\w\-\.\(\)\+]+/g, "_");
    await exportPng(svgRef.current, name, 2);
  }

  return (
    <div className="wrap">
      <div className="card">
        <h1>Symbolic binomials</h1>

        <label>
          Left binomial (linear)
          <input
            type="text"
            value={bin1}
            onChange={(e) => { setBin1(e.target.value); setStep(0); setPlaying(false); }}
            placeholder="(x+3)"
          />
        </label>

        <label>
          Right binomial (linear)
          <input
            type="text"
            value={bin2}
            onChange={(e) => { setBin2(e.target.value); setStep(0); setPlaying(false); }}
            placeholder="(2x-5)"
          />
        </label>

        <div className="row2">
          <span className="pill">Step: {step + 1} / {MAX_STEP + 1}</span>
          <span className="pill">Speed: {speedMs}ms</span>
        </div>

        <div className="sliderRow">
          <input
            type="range"
            min="250"
            max="2000"
            step="50"
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
            aria-label="Animation speed"
          />
          <span className="pill">{speedMs}ms</span>
        </div>

        <div className="btnRow">
          <button disabled={!!parseError} onClick={() => setPlaying(p => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <button disabled={step <= 0} onClick={() => { setPlaying(false); safeSetStep(step - 1); }}>
            Back
          </button>
          <button disabled={step >= MAX_STEP || !!parseError} onClick={() => { setPlaying(false); safeSetStep(step + 1); }}>
            Next
          </button>
          <button onClick={() => { setPlaying(false); safeSetStep(0); }}>
            Reset animation
          </button>
          <button onClick={resetAll}>Reset all</button>
        </div>

        {parseError ? (
          <div className="danger">{parseError}</div>
        ) : (
          <div className="math">
            <div><strong>Parsed:</strong></div>
            <div>Left: {fmtNumber(model.a)}{model.varName} {fmtSigned(model.b)}</div>
            <div>Right: {fmtNumber(model.c)}{model.varName} {fmtSigned(model.d)}</div>

            <div style={{ marginTop: 10 }}><strong>FOIL areas:</strong></div>
            <div>ac: {fmtNumber(model.ac)}{model.varName}²</div>
            <div>ad: {fmtNumber(model.ad)}{model.varName}</div>
            <div>bc: {fmtNumber(model.bc)}{model.varName}</div>
            <div>bd: {fmtNumber(model.bd)}</div>

            <div style={{ marginTop: 10 }}><strong>Simplified:</strong></div>
            <PolyDisplay A={model.A} B={model.B} C={model.C} varName={model.varName} />
          </div>
        )}

        <div className="small">
          Animation script:
          <div style={{ marginTop: 6 }}>
            {stepsText.map((t, i) => (
              <div key={i} style={{ opacity: i <= step ? 1 : 0.45 }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h1>Graphical (Area Model + Animation)</h1>

        <div className="btnRow" style={{ marginTop: 0, marginBottom: 10 }}>
          <button disabled={exportDisabled} onClick={onExportSvg}>Export SVG</button>
          <button disabled={exportDisabled} onClick={onExportPng}>Export PNG</button>
        </div>

        <div className="svgWrap">
          {model ? <AreaModelSvg model={model} step={step} svgRef={svgRef} /> : (
            <div style={{ color: "var(--muted)", padding: 16 }}>
              Enter valid linear binomials to see the diagram.
            </div>
          )}
        </div>

        <div className="legend">
          <span className="pill"><span className="dot q1"></span> ac ({model ? model.varName : "x"}²)</span>
          <span className="pill"><span className="dot q2"></span> bc ({model ? model.varName : "x"})</span>
          <span className="pill"><span className="dot q3"></span> ad ({model ? model.varName : "x"})</span>
          <span className="pill"><span className="dot q4"></span> bd (const)</span>
        </div>

        <div className="small">
          Try: <code>(x-7)(x+2)</code>, <code>(-x+3)(4x-1)</code>, <code>(2x)(x-5)</code>, <code>(3)(x+9)</code>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
