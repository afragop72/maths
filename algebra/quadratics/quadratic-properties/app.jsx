const { useState, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PRESETS = [
  { a: 1, b: -6, c: 3, label: 'x² − 6x + 3' },
  { a: 1, b: 4, c: -5, label: 'x² + 4x − 5' },
  { a: 2, b: -8, c: 6, label: '2x² − 8x + 6' },
  { a: -1, b: 6, c: -8, label: '−x² + 6x − 8' },
  { a: 1, b: 0, c: -4, label: 'x² − 4' }
];

const VP = { w: 500, h: 400 };
const PAD = 50;

// ─────────────────────────────────────────────────────────────
// Math Utilities
// ─────────────────────────────────────────────────────────────

function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function toFraction(decimal, maxDenominator = 100) {
  const sign = decimal < 0 ? -1 : 1;
  decimal = Math.abs(decimal);

  if (Math.abs(decimal - Math.round(decimal)) < 1e-10) {
    return { n: sign * Math.round(decimal), d: 1, isDecimal: false };
  }

  for (let d = 2; d <= 20; d++) {
    const n = Math.round(decimal * d);
    if (Math.abs(decimal - n / d) < 1e-10) {
      const g = gcd(n, d);
      return { n: sign * (n / g), d: d / g, isDecimal: false };
    }
  }

  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let x = decimal;

  for (let i = 0; i < 100; i++) {
    const a = Math.floor(x);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;

    if (k1 > maxDenominator) break;
    if (Math.abs(decimal - h1 / k1) < 1e-9) {
      const g = gcd(h1, k1);
      return { n: sign * (h1 / g), d: k1 / g, isDecimal: false };
    }

    x = 1 / (x - a);
    if (!isFinite(x)) break;
  }

  return { n: sign * decimal, d: 1, isDecimal: true };
}

function Frac({ n, d }) {
  if (d === 1) return <>{n}</>;
  return (
    <span className="frac">
      <span className="frac-num">{n}</span>
      <span className="frac-den">{d}</span>
    </span>
  );
}

function fmtFrac(num) {
  if (!isFinite(num)) return String(num);
  const frac = toFraction(num);
  if (frac.isDecimal) return num.toFixed(3);
  if (frac.d === 1) return String(frac.n);
  return <Frac n={frac.n} d={frac.d} />;
}

function fmtNumber(num) {
  if (!isFinite(num)) return String(num);
  if (Math.abs(num - Math.round(num)) < 1e-10) {
    return String(Math.round(num));
  }
  return num.toFixed(2);
}

function formatQuadratic(a, b, c) {
  const parts = [];

  if (a === 0) return fmtFrac(c);

  if (a === 1) parts.push('x²');
  else if (a === -1) parts.push('−x²');
  else parts.push(<>{fmtFrac(a)}x²</>);

  if (b !== 0) {
    if (b > 0) parts.push(' + ');
    else parts.push(' − ');

    const absB = Math.abs(b);
    if (absB === 1) parts.push('x');
    else parts.push(<>{fmtFrac(absB)}x</>);
  }

  if (c !== 0) {
    if (c > 0) parts.push(' + ');
    else parts.push(' − ');
    parts.push(fmtFrac(Math.abs(c)));
  }

  return <>{parts}</>;
}

// ─────────────────────────────────────────────────────────────
// Property Calculations
// ─────────────────────────────────────────────────────────────

function calculateProperties(a, b, c) {
  // Direction of opening
  const direction = a > 0 ? 'Upward' : 'Downward';

  // Axis of symmetry (x = -b/(2a))
  const axisX = -b / (2 * a);

  // Vertex (h, k)
  const h = axisX;
  const k = a * h * h + b * h + c;

  // Min or Max
  const extremumType = a > 0 ? 'Minimum' : 'Maximum';
  const extremumValue = k;

  // Domain (always all real numbers)
  const domain = '(−∞, ∞)';

  // Range
  let range;
  if (a > 0) {
    range = `[${fmtNumber(k)}, ∞)`;
  } else {
    range = `(−∞, ${fmtNumber(k)}]`;
  }

  // y-intercept (value when x = 0, which is c)
  const yIntercept = c;

  return {
    direction,
    axisX,
    vertex: { h, k },
    extremumType,
    extremumValue,
    domain,
    range,
    yIntercept
  };
}

// ─────────────────────────────────────────────────────────────
// Property Definitions with Hints
// ─────────────────────────────────────────────────────────────

function getPropertyDefinitions(a, b, c, props) {
  return [
    {
      id: 'direction',
      name: 'Direction of Opening',
      hint: 'Look at the coefficient a (the number in front of x²). If a > 0, the parabola opens upward (like a smile). If a < 0, it opens downward (like a frown).',
      value: props.direction,
      displayValue: props.direction
    },
    {
      id: 'axis',
      name: 'Axis of Symmetry',
      hint: <>The axis of symmetry passes through the vertex. Use the formula: <code>x = −b/(2a)</code>. Here, a = {fmtFrac(a)} and b = {fmtFrac(b)}.</>,
      value: `x = ${fmtNumber(props.axisX)}`,
      displayValue: <>x = {fmtFrac(props.axisX)}</>
    },
    {
      id: 'vertex',
      name: 'Vertex',
      hint: <>First find h = −b/(2a) = {fmtFrac(props.vertex.h)}. Then substitute into the function to find k = f(h) = {fmtFrac(props.vertex.k)}. The vertex is (h, k).</>,
      value: `(${fmtNumber(props.vertex.h)}, ${fmtNumber(props.vertex.k)})`,
      displayValue: <>({fmtFrac(props.vertex.h)}, {fmtFrac(props.vertex.k)})</>
    },
    {
      id: 'extremum',
      name: 'Minimum or Maximum',
      hint: <>If the parabola opens upward (a &gt; 0), it has a minimum at the vertex. If it opens downward (a &lt; 0), it has a maximum. The value is the y-coordinate of the vertex (k).</>,
      value: `${props.extremumType}: ${fmtNumber(props.extremumValue)}`,
      displayValue: <>{props.extremumType}: {fmtFrac(props.extremumValue)}</>
    },
    {
      id: 'domain',
      name: 'Domain',
      hint: 'The domain of any quadratic function is all real numbers, because you can substitute any x-value into the function.',
      value: props.domain,
      displayValue: props.domain
    },
    {
      id: 'range',
      name: 'Range',
      hint: <>If the parabola opens upward, the range starts at the minimum value (k) and goes to infinity: [k, ∞). If it opens downward, the range goes from negative infinity to the maximum value: (−∞, k].</>,
      value: props.range,
      displayValue: props.range
    },
    {
      id: 'yIntercept',
      name: 'y-intercept',
      hint: 'The y-intercept is the value of the function when x = 0. Substitute x = 0 into f(x) = ax² + bx + c, which gives f(0) = c.',
      value: fmtNumber(props.yIntercept),
      displayValue: fmtFrac(props.yIntercept)
    }
  ];
}

// ─────────────────────────────────────────────────────────────
// Graph Utilities
// ─────────────────────────────────────────────────────────────

function getViewBounds(a, b, c) {
  const h = -b / (2 * a);
  const k = a * h * h + b * h + c;

  const xSpan = 8;
  const xMin = h - xSpan / 2;
  const xMax = h + xSpan / 2;

  let yMin = Infinity;
  let yMax = -Infinity;

  for (let i = 0; i <= 50; i++) {
    const x = xMin + (i / 50) * (xMax - xMin);
    const y = a * x * x + b * x + c;
    if (isFinite(y)) {
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }

  yMin = Math.min(yMin, 0);
  yMax = Math.max(yMax, 0);

  const yPad = (yMax - yMin) * 0.15;
  return { xMin, xMax, yMin: yMin - yPad, yMax: yMax + yPad };
}

function toSvg(x, y, bounds) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const sx = PAD + ((x - xMin) / (xMax - xMin)) * (VP.w - 2 * PAD);
  const sy = VP.h - PAD - ((y - yMin) / (yMax - yMin)) * (VP.h - 2 * PAD);
  return { sx, sy };
}

// ─────────────────────────────────────────────────────────────
// React Components
// ─────────────────────────────────────────────────────────────

function Breadcrumb() {
  return (
    <nav className="breadcrumb">
      <a href="../../../../"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../../">Algebra</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <a href="../../">Quadratics</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      <span className="breadcrumb-current">Properties</span>
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

function HeroSection() {
  return (
    <div className="hero">
      <div className="eyebrow">Math Lab</div>
      <h1>Quadratic Properties</h1>
      <p className="subtitle">
        Explore the key characteristics of quadratic functions with progressive hints and visual feedback
      </p>
    </div>
  );
}

function CoefInput({ label, value, onChange, id }) {
  return (
    <div className="coef-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function InputPanel({ a, b, c, onAChange, onBChange, onCChange, onPreset }) {
  const error = a === 0 ? 'Coefficient a cannot be 0 (not a quadratic)' : null;

  return (
    <div className="input-panel">
      <div className="input-row">
        <CoefInput label="a (x² coefficient)" value={a} onChange={onAChange} id="coef-a" />
        <CoefInput label="b (x coefficient)" value={b} onChange={onBChange} id="coef-b" />
        <CoefInput label="c (constant)" value={c} onChange={onCChange} id="coef-c" />
      </div>

      {error && <div className="error-message">{error}</div>}

      {!error && (
        <div className="function-display">
          f(x) = {formatQuadratic(a, b, c)}
        </div>
      )}

      <div className="presets">
        <div className="presets-label">Quick Examples</div>
        <div className="preset-grid">
          {PRESETS.map((preset, i) => (
            <button
              key={i}
              className="preset-btn"
              onClick={() => onPreset(preset.a, preset.b, preset.c)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertiesTable({ properties, revealed, hints, onReveal, onToggleHint, onRevealAll }) {
  const revealedCount = Object.values(revealed).filter(Boolean).length;
  const totalCount = properties.length;

  return (
    <div className="properties-card">
      <h2>Properties Table</h2>

      <table className="properties-table">
        <thead>
          <tr>
            <th>Property</th>
            <th>Actions</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((prop) => (
            <React.Fragment key={prop.id}>
              <tr>
                <td className="property-name">{prop.name}</td>
                <td>
                  <div className="property-actions">
                    <button
                      className="hint-btn"
                      onClick={() => onToggleHint(prop.id)}
                    >
                      {hints[prop.id] ? 'Hide Hint' : 'Show Hint'}
                    </button>
                    <button
                      className={`reveal-btn ${revealed[prop.id] ? 'revealed' : ''}`}
                      onClick={() => onReveal(prop.id)}
                      disabled={revealed[prop.id]}
                    >
                      {revealed[prop.id] ? '✓ Revealed' : 'Reveal'}
                    </button>
                  </div>
                </td>
                <td>
                  <div className={`property-value ${!revealed[prop.id] ? 'hidden' : ''}`}>
                    {revealed[prop.id] ? prop.displayValue : '???'}
                  </div>
                </td>
              </tr>
              {hints[prop.id] && (
                <tr>
                  <td colSpan="3">
                    <div className="hint-content">{prop.hint}</div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="reveal-all-footer">
        <div className="progress-text">
          Progress: <strong>{revealedCount} / {totalCount}</strong> revealed
        </div>
        <button
          className="reveal-all-btn"
          onClick={onRevealAll}
          disabled={revealedCount === totalCount}
        >
          Reveal All
        </button>
      </div>
    </div>
  );
}

function GraphCard({ a, b, c }) {
  const bounds = useMemo(() => getViewBounds(a, b, c), [a, b, c]);
  const { xMin, xMax, yMin, yMax } = bounds;

  // Generate parabola path
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const x = xMin + (i / 100) * (xMax - xMin);
    const y = a * x * x + b * x + c;
    if (isFinite(y)) {
      const { sx, sy } = toSvg(x, y, bounds);
      points.push(`${sx},${sy}`);
    }
  }
  const pathData = `M ${points.join(' L ')}`;

  // Key features
  const h = -b / (2 * a);
  const k = a * h * h + b * h + c;
  const vertex = toSvg(h, k, bounds);
  const axisTop = toSvg(h, yMax, bounds);
  const axisBottom = toSvg(h, yMin, bounds);
  const yInterceptPt = toSvg(0, c, bounds);

  // Axes
  const origin = toSvg(0, 0, bounds);
  const xAxisLeft = toSvg(xMin, 0, bounds);
  const xAxisRight = toSvg(xMax, 0, bounds);
  const yAxisTop = toSvg(0, yMax, bounds);
  const yAxisBottom = toSvg(0, yMin, bounds);

  return (
    <div className="graph-card">
      <h2>Visual Representation</h2>

      <div className="graph-container">
        <svg viewBox={`0 0 ${VP.w} ${VP.h}`}>
          <defs>
            <marker id="arrowX" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="rgba(15, 23, 42, 0.3)" />
            </marker>
            <marker id="arrowY" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="rgba(15, 23, 42, 0.3)" />
            </marker>
          </defs>

          {/* Grid */}
          {Array.from({ length: 9 }, (_, i) => {
            const x = xMin + ((i + 1) / 10) * (xMax - xMin);
            const { sx } = toSvg(x, 0, bounds);
            return (
              <line
                key={`vgrid-${i}`}
                x1={sx}
                y1={PAD}
                x2={sx}
                y2={VP.h - PAD}
                stroke="rgba(15, 23, 42, 0.06)"
                strokeWidth="1"
              />
            );
          })}
          {Array.from({ length: 9 }, (_, i) => {
            const y = yMin + ((i + 1) / 10) * (yMax - yMin);
            const { sy } = toSvg(0, y, bounds);
            return (
              <line
                key={`hgrid-${i}`}
                x1={PAD}
                y1={sy}
                x2={VP.w - PAD}
                y2={sy}
                stroke="rgba(15, 23, 42, 0.06)"
                strokeWidth="1"
              />
            );
          })}

          {/* Axes */}
          {xMin <= 0 && xMax >= 0 && (
            <line
              x1={origin.sx}
              y1={yAxisBottom.sy}
              x2={origin.sx}
              y2={yAxisTop.sy}
              stroke="rgba(15, 23, 42, 0.25)"
              strokeWidth="1.5"
              markerEnd="url(#arrowY)"
            />
          )}
          {yMin <= 0 && yMax >= 0 && (
            <line
              x1={xAxisLeft.sx}
              y1={origin.sy}
              x2={xAxisRight.sx}
              y2={origin.sy}
              stroke="rgba(15, 23, 42, 0.25)"
              strokeWidth="1.5"
              markerEnd="url(#arrowX)"
            />
          )}

          {/* Axis of symmetry */}
          <line
            x1={axisTop.sx}
            y1={axisTop.sy}
            x2={axisBottom.sx}
            y2={axisBottom.sy}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.6"
          />

          {/* Parabola */}
          <path
            d={pathData}
            fill="none"
            stroke="#ff6b3d"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Vertex */}
          <circle cx={vertex.sx} cy={vertex.sy} r="6" fill="#10b981" stroke="#fff" strokeWidth="2" />
          <text
            x={vertex.sx + 12}
            y={vertex.sy - 8}
            fontSize="13"
            fontWeight="600"
            fill="#10b981"
          >
            Vertex
          </text>

          {/* y-intercept */}
          {Math.abs(c) > 0.1 && yInterceptPt.sy >= PAD && yInterceptPt.sy <= VP.h - PAD && (
            <>
              <circle cx={yInterceptPt.sx} cy={yInterceptPt.sy} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
              <text
                x={yInterceptPt.sx + 10}
                y={yInterceptPt.sy + 15}
                fontSize="12"
                fontWeight="600"
                fill="#f59e0b"
              >
                y-int
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="feature-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#ff6b3d' }}></div>
          <span>Parabola</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#10b981' }}></div>
          <span>Vertex</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#3b82f6' }}></div>
          <span>Axis of Symmetry</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#f59e0b' }}></div>
          <span>y-intercept</span>
        </div>
      </div>
    </div>
  );
}

function RelatedTools() {
  return (
    <div className="related-tools">
      <h3>Related Tools</h3>
      <div className="related-grid">
        <a href="../quadratic-form-converter/" className="related-link">Form Converter</a>
        <a href="../discriminant-visualizer/" className="related-link">Discriminant</a>
        <a href="../quadratic-equation/" className="related-link">Equation Grapher</a>
        <a href="../quadratic-inequality/" className="related-link">Inequality Solver</a>
        <a href="../parabola-transformations/" className="related-link">Transformations</a>
      </div>
    </div>
  );
}

function App() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(-6);
  const [c, setC] = useState(3);

  const [revealed, setRevealed] = useState({});
  const [hints, setHints] = useState({});

  const handlePreset = (newA, newB, newC) => {
    setA(newA);
    setB(newB);
    setC(newC);
    setRevealed({});
    setHints({});
  };

  const props = useMemo(() => {
    if (a === 0) return null;
    return calculateProperties(a, b, c);
  }, [a, b, c]);

  const properties = useMemo(() => {
    if (!props) return [];
    return getPropertyDefinitions(a, b, c, props);
  }, [a, b, c, props]);

  const handleReveal = (id) => {
    setRevealed(prev => ({ ...prev, [id]: true }));
  };

  const handleToggleHint = (id) => {
    setHints(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRevealAll = () => {
    const allRevealed = {};
    properties.forEach(prop => {
      allRevealed[prop.id] = true;
    });
    setRevealed(allRevealed);
  };

  return (
    <div className="page">
      <Breadcrumb />
      <HamburgerMenu />
      <HeroSection />

      <InputPanel
        a={a}
        b={b}
        c={c}
        onAChange={setA}
        onBChange={setB}
        onCChange={setC}
        onPreset={handlePreset}
      />

      {a !== 0 && (
        <>
          <div className="main-grid">
            <PropertiesTable
              properties={properties}
              revealed={revealed}
              hints={hints}
              onReveal={handleReveal}
              onToggleHint={handleToggleHint}
              onRevealAll={handleRevealAll}
            />

            <GraphCard a={a} b={b} c={c} />
          </div>

          <RelatedTools />
        </>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
