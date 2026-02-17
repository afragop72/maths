const { useState, useEffect, useMemo } = React;

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const FORMS = {
  STANDARD: 'standard',
  VERTEX: 'vertex',
  FACTORED: 'factored'
};

const VP = { w: 900, h: 400 };
const PAD = 60;

const PRESETS = [
  { form: 'standard', a: 1, b: -2, c: -3, label: 'x² − 2x − 3' },
  { form: 'standard', a: 2, b: 8, c: 6, label: '2x² + 8x + 6' },
  { form: 'vertex', a: 1, h: 2, k: -4, label: '(x − 2)² − 4' },
  { form: 'vertex', a: -1, h: 3, k: 5, label: '−(x − 3)² + 5' },
  { form: 'factored', a: 1, r1: -1, r2: 3, label: '(x + 1)(x − 3)' }
];

// ─────────────────────────────────────────────────────────────
// Math Utilities
// ─────────────────────────────────────────────────────────────

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

// Create a fraction from numerator and denominator, reduced to lowest terms
function makeFraction(num, den = 1) {
  if (den === 0) return { n: 0, d: 1, isDecimal: false };

  // Handle sign
  if (den < 0) {
    num = -num;
    den = -den;
  }

  // Check if inputs are integers
  if (!Number.isInteger(num) || !Number.isInteger(den)) {
    // Fall back to decimal conversion
    return toFraction(num / den);
  }

  // Reduce to lowest terms
  const g = gcd(Math.abs(num), Math.abs(den));
  return { n: num / g, d: den / g, isDecimal: false };
}

function toFraction(decimal, maxDenominator = 1000) {
  if (!isFinite(decimal)) return { n: decimal, d: 1, isDecimal: true };

  // Handle integers
  if (Math.abs(decimal - Math.round(decimal)) < 1e-10) {
    return { n: Math.round(decimal), d: 1, isDecimal: false };
  }

  const sign = decimal < 0 ? -1 : 1;
  decimal = Math.abs(decimal);

  // Try simple denominators first (2-20) for common fractions
  for (let d = 2; d <= 20; d++) {
    const n = Math.round(decimal * d);
    if (Math.abs(decimal - n / d) < 1e-10) {
      const g = gcd(n, d);
      return { n: sign * (n / g), d: d / g, isDecimal: false };
    }
  }

  // Use continued fractions for more complex cases
  let a = 0, b = 1, c = 1, d = 0;
  let n = decimal;

  for (let i = 0; i < 100; i++) {
    const digit = Math.floor(n);
    const num = a + digit * c;
    const den = b + digit * d;

    if (den > maxDenominator) break;

    a = c; b = d; c = num; d = den;

    if (Math.abs(decimal - num / den) < 1e-10) {
      const g = gcd(num, den);
      return { n: sign * (num / g), d: den / g, isDecimal: false };
    }

    if (Math.abs(n - digit) < 1e-10) break;
    n = 1 / (n - digit);

    if (!isFinite(n)) break;
  }

  // Last resort: try rounding to nearest fraction with denominator up to maxDenominator
  let bestNum = Math.round(decimal);
  let bestDen = 1;
  let bestError = Math.abs(decimal - bestNum);

  for (let den = 2; den <= maxDenominator; den++) {
    const num = Math.round(decimal * den);
    const error = Math.abs(decimal - num / den);
    if (error < bestError && error < 0.001) {
      bestNum = num;
      bestDen = den;
      bestError = error;
    }
  }

  if (bestError < 0.001) {
    const g = gcd(bestNum, bestDen);
    return { n: sign * (bestNum / g), d: bestDen / g, isDecimal: false };
  }

  // If still no good fraction found, return decimal
  return { n: sign * decimal, d: 1, isDecimal: true };
}

// Fraction arithmetic operations
function fracAdd(f1, f2) {
  const num = f1.n * f2.d + f2.n * f1.d;
  const den = f1.d * f2.d;
  return makeFraction(num, den);
}

function fracSub(f1, f2) {
  const num = f1.n * f2.d - f2.n * f1.d;
  const den = f1.d * f2.d;
  return makeFraction(num, den);
}

function fracMul(f1, f2) {
  return makeFraction(f1.n * f2.n, f1.d * f2.d);
}

function fracDiv(f1, f2) {
  return makeFraction(f1.n * f2.d, f1.d * f2.n);
}

function fracToDecimal(f) {
  return f.n / f.d;
}

function fmtNumber(n) {
  if (!isFinite(n)) return '∞';
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toString();
}

// Simplify square root: √n → a√b where a² * b = n and b has no perfect square factors
function simplifySquareRoot(n) {
  if (n < 0) return { coef: 1, radical: n, isImaginary: true };
  if (n === 0) return { coef: 0, radical: 1, isImaginary: false };

  let coef = 1;
  let radical = n;

  // Factor out perfect squares
  let factor = 2;
  while (factor * factor <= radical) {
    while (radical % (factor * factor) === 0) {
      coef *= factor;
      radical /= (factor * factor);
    }
    factor++;
  }

  return { coef, radical, isImaginary: false };
}

// Check if a number is a perfect square
function isPerfectSquare(n) {
  if (n < 0) return false;
  const sqrt = Math.sqrt(n);
  return Math.abs(sqrt - Math.round(sqrt)) < 1e-10;
}

// Fraction component for JSX rendering
function Frac({ n, d }) {
  return (
    <span className="frac">
      <span className="frac-num">{n}</span>
      <span className="frac-den">{d}</span>
    </span>
  );
}

// Format number as fraction (returns JSX or string)
function fmtFrac(n) {
  const frac = toFraction(n);
  if (frac.isDecimal || frac.d === 1) {
    return fmtNumber(n);
  }
  const sign = frac.n < 0 ? '−' : '';
  return <>{sign}<Frac n={Math.abs(frac.n)} d={frac.d} /></>;
}

// Format number with sign for addition
function fmtFracSigned(n) {
  const frac = toFraction(n);
  const sign = n >= 0 ? ' + ' : ' − ';
  if (frac.isDecimal || frac.d === 1) {
    return `${sign}${fmtNumber(Math.abs(n))}`;
  }
  return <>{sign}<Frac n={Math.abs(frac.n)} d={frac.d} /></>;
}

function fmtSigned(n) {
  if (!isFinite(n)) return '∞';
  const rounded = Math.round(n * 1000) / 1000;
  return rounded >= 0 ? `+${rounded}` : rounded.toString();
}

function fmtTerm(coef, variable = '') {
  const absCoef = Math.abs(coef);
  const sign = coef >= 0 ? '+' : '−';

  if (variable === '') return `${sign} ${fmtNumber(absCoef)}`;

  if (absCoef === 1) return `${sign} ${variable}`;
  return `${sign} ${fmtNumber(absCoef)}${variable}`;
}

// Convert Standard (a, b, c) → Vertex (a, h, k)
function standardToVertex(a, b, c) {
  const h = -b / (2 * a);
  const k = c - (b * b) / (4 * a);
  return { a, h, k };
}

// Convert Standard (a, b, c) → Factored (a, r1, r2)
function standardToFactored(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null; // No real roots

  const sqrtDisc = Math.sqrt(disc);
  const r1 = (-b + sqrtDisc) / (2 * a);
  const r2 = (-b - sqrtDisc) / (2 * a);
  return { a, r1, r2 };
}

// Convert Vertex (a, h, k) → Standard (a, b, c)
function vertexToStandard(a, h, k) {
  const b = -2 * a * h;
  const c = a * h * h + k;
  return { a, b, c };
}

// Convert Vertex (a, h, k) → Factored (a, r1, r2)
function vertexToFactored(a, h, k) {
  // From vertex form: a(x - h)² + k = 0
  // (x - h)² = -k/a
  // x - h = ±√(-k/a)
  // x = h ± √(-k/a)

  const insideRoot = -k / a;
  if (insideRoot < 0) return null; // No real roots

  const delta = Math.sqrt(insideRoot);
  const r1 = h + delta;
  const r2 = h - delta;
  return { a, r1, r2 };
}

// Convert Factored (a, r1, r2) → Standard (a, b, c)
function factoredToStandard(a, r1, r2) {
  const b = -a * (r1 + r2);
  const c = a * r1 * r2;
  return { a, b, c };
}

// Convert Factored (a, r1, r2) → Vertex (a, h, k)
function factoredToVertex(a, r1, r2) {
  const h = (r1 + r2) / 2;
  const k = a * (h - r1) * (h - r2);
  return { a, h, k };
}

// Format each form (returns JSX for fractions)
function formatStandard(a, b, c) {
  const parts = [];

  // a term
  const aFrac = toFraction(a);
  if (a === 1) {
    parts.push('x²');
  } else if (a === -1) {
    parts.push('−x²');
  } else if (aFrac.d === 1 || aFrac.isDecimal) {
    parts.push(`${fmtNumber(a)}x²`);
  } else {
    parts.push(<>{fmtFrac(a)}x²</>);
  }

  // b term
  if (b !== 0) {
    const sign = b >= 0 ? ' + ' : ' − ';
    const absB = Math.abs(b);
    const bFrac = toFraction(absB);

    if (absB === 1) {
      parts.push(`${sign}x`);
    } else if (bFrac.d === 1 || bFrac.isDecimal) {
      parts.push(`${sign}${fmtNumber(absB)}x`);
    } else {
      parts.push(<>{sign}<Frac n={bFrac.n} d={bFrac.d} />x</>);
    }
  }

  // c term
  if (c !== 0) {
    const sign = c >= 0 ? ' + ' : ' − ';
    const absC = Math.abs(c);
    const cFrac = toFraction(absC);

    if (cFrac.d === 1 || cFrac.isDecimal) {
      parts.push(`${sign}${fmtNumber(absC)}`);
    } else {
      parts.push(<>{sign}<Frac n={cFrac.n} d={cFrac.d} /></>);
    }
  }

  return parts.length > 0 ? <>{parts}</> : '0';
}

function formatVertex(a, h, k) {
  const parts = [];

  // a coefficient
  const aFrac = toFraction(a);
  if (a === 1) {
    // no prefix
  } else if (a === -1) {
    parts.push('−');
  } else if (aFrac.d === 1 || aFrac.isDecimal) {
    parts.push(`${fmtNumber(a)}`);
  } else {
    parts.push(fmtFrac(a));
  }

  // (x - h)² term
  const hFrac = toFraction(Math.abs(h));
  if (h === 0) {
    parts.push('x²');
  } else if (h > 0) {
    if (hFrac.d === 1 || hFrac.isDecimal) {
      parts.push(`(x − ${fmtNumber(h)})²`);
    } else {
      parts.push(<>(x − <Frac n={hFrac.n} d={hFrac.d} />)²</>);
    }
  } else {
    if (hFrac.d === 1 || hFrac.isDecimal) {
      parts.push(`(x + ${fmtNumber(Math.abs(h))})²`);
    } else {
      parts.push(<>(x + <Frac n={hFrac.n} d={hFrac.d} />)²</>);
    }
  }

  // k term
  if (k !== 0) {
    const sign = k >= 0 ? ' + ' : ' − ';
    const absK = Math.abs(k);
    const kFrac = toFraction(absK);

    if (kFrac.d === 1 || kFrac.isDecimal) {
      parts.push(`${sign}${fmtNumber(absK)}`);
    } else {
      parts.push(<>{sign}<Frac n={kFrac.n} d={kFrac.d} /></>);
    }
  }

  return <>{parts}</>;
}

function formatFactored(a, r1, r2) {
  const parts = [];

  // a coefficient
  const aFrac = toFraction(a);
  if (a === 1) {
    // no prefix
  } else if (a === -1) {
    parts.push('−');
  } else if (aFrac.d === 1 || aFrac.isDecimal) {
    parts.push(`${fmtNumber(a)}`);
  } else {
    parts.push(fmtFrac(a));
  }

  // (x - r1) term
  const r1Frac = toFraction(Math.abs(r1));
  if (r1 === 0) {
    parts.push('x');
  } else if (r1 > 0) {
    if (r1Frac.d === 1 || r1Frac.isDecimal) {
      parts.push(`(x − ${fmtNumber(r1)})`);
    } else {
      parts.push(<>(x − <Frac n={r1Frac.n} d={r1Frac.d} />)</>);
    }
  } else {
    if (r1Frac.d === 1 || r1Frac.isDecimal) {
      parts.push(`(x + ${fmtNumber(Math.abs(r1))})`);
    } else {
      parts.push(<>(x + <Frac n={r1Frac.n} d={r1Frac.d} />)</>);
    }
  }

  // (x - r2) term
  const r2Frac = toFraction(Math.abs(r2));
  if (r2 === 0) {
    parts.push('(x)');
  } else if (r2 > 0) {
    if (r2Frac.d === 1 || r2Frac.isDecimal) {
      parts.push(`(x − ${fmtNumber(r2)})`);
    } else {
      parts.push(<>(x − <Frac n={r2Frac.n} d={r2Frac.d} />)</>);
    }
  } else {
    if (r2Frac.d === 1 || r2Frac.isDecimal) {
      parts.push(`(x + ${fmtNumber(Math.abs(r2))})`);
    } else {
      parts.push(<>(x + <Frac n={r2Frac.n} d={r2Frac.d} />)</>);
    }
  }

  return <>{parts}</>;
}

// Evaluate quadratic at x
function evaluateQuadratic(params, form, x) {
  if (form === FORMS.STANDARD) {
    const { a, b, c } = params;
    return a * x * x + b * x + c;
  } else if (form === FORMS.VERTEX) {
    const { a, h, k } = params;
    return a * (x - h) * (x - h) + k;
  } else if (form === FORMS.FACTORED) {
    const { a, r1, r2 } = params;
    return a * (x - r1) * (x - r2);
  }
  return 0;
}

// Get viewing range for graph
function getViewRange(params, form) {
  let vertex;

  if (form === FORMS.STANDARD) {
    const { a, b } = params;
    vertex = { x: -b / (2 * a) };
  } else if (form === FORMS.VERTEX) {
    vertex = { x: params.h };
  } else if (form === FORMS.FACTORED) {
    const { r1, r2 } = params;
    vertex = { x: (r1 + r2) / 2 };
  }

  const span = 8;
  const xMin = vertex.x - span / 2;
  const xMax = vertex.x + span / 2;

  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i <= 50; i++) {
    const x = xMin + (i / 50) * (xMax - xMin);
    const y = evaluateQuadratic(params, form, x);
    if (isFinite(y)) {
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }

  const yPad = (yMax - yMin) * 0.2;
  return { xMin, xMax, yMin: yMin - yPad, yMax: yMax + yPad };
}

// Convert math coords to SVG coords
function toSvg(mathX, mathY, bounds) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const sx = PAD + ((mathX - xMin) / (xMax - xMin)) * (VP.w - 2 * PAD);
  const sy = VP.h - PAD - ((mathY - yMin) / (yMax - yMin)) * (VP.h - 2 * PAD);
  return { sx, sy };
}

// ─────────────────────────────────────────────────────────────
// Conversion Logic & Step Generation
// ─────────────────────────────────────────────────────────────

function getConversionSteps(sourceForm, targetForm, params) {
  const key = `${sourceForm}-${targetForm}`;

  switch (key) {
    case 'standard-vertex':
      return standardToVertexSteps(params);
    case 'standard-factored':
      return standardToFactoredSteps(params);
    case 'vertex-standard':
      return vertexToStandardSteps(params);
    case 'vertex-factored':
      return vertexToFactoredSteps(params);
    case 'factored-standard':
      return factoredToStandardSteps(params);
    case 'factored-vertex':
      return factoredToVertexSteps(params);
    default:
      return { result: null, steps: [] };
  }
}

function standardToVertexSteps({ a, b, c }) {
  const h = -b / (2 * a);
  const k = c - (b * b) / (4 * a);

  const steps = [
    {
      number: 'Step 1',
      description: 'Start with standard form.',
      math: formatStandard(a, b, c)
    },
    {
      number: 'Step 2',
      description: `Find the x-coordinate of the vertex: h = −b/(2a) = −(${fmtNumber(b)})/(2·${fmtNumber(a)})`,
      math: <>h = {fmtFrac(h)}</>
    },
    {
      number: 'Step 3',
      description: `Find the y-coordinate: k = c − b²/(4a) = ${fmtNumber(c)} − (${fmtNumber(b)})²/(4·${fmtNumber(a)})`,
      math: <>k = {fmtFrac(k)}</>
    },
    {
      number: 'Step 4',
      description: 'Write in vertex form: a(x − h)² + k',
      math: formatVertex(a, h, k)
    }
  ];

  return { result: { a, h, k }, steps };
}

function standardToFactoredSteps({ a, b, c }) {
  const disc = b * b - 4 * a * c;

  if (disc < 0) {
    return {
      result: null,
      steps: [{
        number: 'Error',
        description: `The discriminant is negative (Δ = ${fmtNumber(disc)}), so there are no real roots. This quadratic cannot be factored over the real numbers.`,
        math: ''
      }]
    };
  }

  const sqrtDisc = Math.sqrt(disc);
  const r1 = (-b + sqrtDisc) / (2 * a);
  const r2 = (-b - sqrtDisc) / (2 * a);

  // Simplify the square root
  const { coef: sqrtCoef, radical: sqrtRadical } = simplifySquareRoot(disc);
  const isPerfect = sqrtRadical === 1;

  const steps = [
    {
      number: 'Step 1',
      description: 'Start with standard form.',
      math: formatStandard(a, b, c)
    },
    {
      number: 'Step 2',
      description: `Find the discriminant: Δ = b² − 4ac = (${fmtNumber(b)})² − 4(${fmtNumber(a)})(${fmtNumber(c)})`,
      math: <>Δ = {fmtFrac(disc)}</>
    },
    {
      number: 'Step 3',
      description: `Apply the quadratic formula: x = (−b ± √Δ) / (2a)`,
      math: isPerfect
        ? <>x = (−{fmtFrac(b)} ± {fmtFrac(sqrtCoef)}) / {fmtFrac(2 * a)}</>
        : sqrtCoef === 1
          ? <>x = (−{fmtFrac(b)} ± √{fmtFrac(sqrtRadical)}) / {fmtFrac(2 * a)}</>
          : <>x = (−{fmtFrac(b)} ± {fmtFrac(sqrtCoef)}√{fmtFrac(sqrtRadical)}) / {fmtFrac(2 * a)}</>
    },
    {
      number: 'Step 4',
      description: `Calculate the two roots:`,
      math: isPerfect
        ? <>r₁ = {fmtFrac(r1)}, r₂ = {fmtFrac(r2)}</>
        : (() => {
            // Express roots as fractions with radicals
            const twoA = 2 * a;
            const negB = -b;

            // Simplify the fraction by finding GCD
            const gcd1 = gcd(Math.abs(negB + sqrtCoef), Math.abs(twoA));
            const gcd2 = gcd(Math.abs(negB - sqrtCoef), Math.abs(twoA));

            if (negB === 0) {
              // Special case: b = 0, so roots are ±√ / (2a)
              if (sqrtCoef % twoA === 0) {
                const simplified = sqrtCoef / twoA;
                return sqrtRadical === 1
                  ? <>r₁ = {fmtFrac(simplified)}, r₂ = {fmtFrac(-simplified)}</>
                  : simplified === 1
                    ? <>r₁ = √{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}, r₂ = −√{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}</>
                    : <>r₁ = {fmtFrac(simplified)}√{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}, r₂ = −{fmtFrac(simplified)}√{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}</>;
              }
              return sqrtCoef === 1
                ? <>r₁ = √{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}, r₂ = −√{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}</>
                : <>r₁ = {fmtFrac(sqrtCoef)}√{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}, r₂ = −{fmtFrac(sqrtCoef)}√{fmtFrac(sqrtRadical)} / {fmtFrac(twoA)}</>;
            }

            // General case: (−b ± coef√radical) / (2a)
            return sqrtCoef === 1
              ? <>r₁ = ({fmtFrac(negB)} + √{fmtFrac(sqrtRadical)}) / {fmtFrac(twoA)}, r₂ = ({fmtFrac(negB)} − √{fmtFrac(sqrtRadical)}) / {fmtFrac(twoA)}</>
              : <>r₁ = ({fmtFrac(negB)} + {fmtFrac(sqrtCoef)}√{fmtFrac(sqrtRadical)}) / {fmtFrac(twoA)}, r₂ = ({fmtFrac(negB)} − {fmtFrac(sqrtCoef)}√{fmtFrac(sqrtRadical)}) / {fmtFrac(twoA)}</>;
          })()
    }
  ];

  // Only add factored form step if roots are rational (perfect square discriminant)
  if (isPerfect) {
    steps.push({
      number: 'Step 5',
      description: 'Write in factored form: a(x − r₁)(x − r₂)',
      math: formatFactored(a, r1, r2)
    });
  } else {
    steps.push({
      number: 'Note',
      description: 'This quadratic has irrational roots and cannot be factored using rational coefficients. The factored form would require the radical expressions above.',
      math: ''
    });
  }

  return { result: { a, r1, r2, hasIrrationalRoots: !isPerfect }, steps };
}

function vertexToStandardSteps({ a, h, k }) {
  const b = -2 * a * h;
  const c = a * h * h + k;

  const steps = [
    {
      number: 'Step 1',
      description: 'Start with vertex form.',
      math: formatVertex(a, h, k)
    },
    {
      number: 'Step 2',
      description: `Expand (x − h)²: (x − ${fmtNumber(h)})² = x² − ${fmtNumber(2 * h)}x + ${fmtNumber(h * h)}`,
      math: <>{a === 1 ? '' : fmtFrac(a)}(x² − {fmtFrac(2 * h)}x + {fmtFrac(h * h)}) + {fmtFrac(k)}</>
    },
    {
      number: 'Step 3',
      description: `Distribute the coefficient ${fmtNumber(a)}:`,
      math: <>{fmtFrac(a)}x² {fmtFracSigned(-2 * a * h)}x {fmtFracSigned(a * h * h)} {fmtFracSigned(k)}</>
    },
    {
      number: 'Step 4',
      description: 'Combine like terms to get standard form: ax² + bx + c',
      math: formatStandard(a, b, c)
    }
  ];

  return { result: { a, b, c }, steps };
}

function vertexToFactoredSteps({ a, h, k }) {
  const insideRoot = -k / a;

  if (insideRoot < 0) {
    return {
      result: null,
      steps: [{
        number: 'Error',
        description: `To find roots from vertex form, we need −k/a ≥ 0. Here −${fmtNumber(k)}/${fmtNumber(a)} = ${fmtNumber(insideRoot)} < 0, so there are no real roots.`,
        math: ''
      }]
    };
  }

  const delta = Math.sqrt(insideRoot);
  const r1 = h + delta;
  const r2 = h - delta;

  // Check if insideRoot involves a fraction
  const insideRootFrac = toFraction(insideRoot);
  const isPerfect = isPerfectSquare(insideRoot);

  // Simplify square root of the fraction
  let simplifiedRadical;
  if (insideRootFrac.d === 1) {
    // Integer under the root
    const { coef, radical } = simplifySquareRoot(insideRootFrac.n);
    simplifiedRadical = { coef, radical, den: 1, isPerfect: radical === 1 };
  } else {
    // Fraction under the root: √(n/d) = √n / √d
    const { coef: nCoef, radical: nRad } = simplifySquareRoot(insideRootFrac.n);
    const { coef: dCoef, radical: dRad } = simplifySquareRoot(insideRootFrac.d);
    simplifiedRadical = {
      coef: nCoef / dCoef,
      radical: nRad,
      den: dRad,
      isPerfect: nRad === 1 && dRad === 1
    };
  }

  const steps = [
    {
      number: 'Step 1',
      description: 'Start with vertex form.',
      math: formatVertex(a, h, k)
    },
    {
      number: 'Step 2',
      description: `Set equal to zero and solve: a(x − h)² + k = 0`,
      math: insideRootFrac.d === 1
        ? <>(x − {fmtFrac(h)})² = {fmtFrac(insideRoot)}</>
        : <>(x − {fmtFrac(h)})² = <Frac n={insideRootFrac.n} d={insideRootFrac.d} /></>
    },
    {
      number: 'Step 3',
      description: `Take the square root of both sides:`,
      math: simplifiedRadical.isPerfect
        ? <>x − {fmtFrac(h)} = ±{fmtFrac(delta)}</>
        : simplifiedRadical.den === 1
          ? simplifiedRadical.coef === 1
            ? <>x − {fmtFrac(h)} = ±√{fmtFrac(simplifiedRadical.radical)}</>
            : <>x − {fmtFrac(h)} = ±{fmtFrac(simplifiedRadical.coef)}√{fmtFrac(simplifiedRadical.radical)}</>
          : simplifiedRadical.coef === 1
            ? <>x − {fmtFrac(h)} = ±√{fmtFrac(simplifiedRadical.radical)} / √{fmtFrac(simplifiedRadical.den)}</>
            : <>x − {fmtFrac(h)} = ±{fmtFrac(simplifiedRadical.coef)}√{fmtFrac(simplifiedRadical.radical)} / √{fmtFrac(simplifiedRadical.den)}</>
    },
    {
      number: 'Step 4',
      description: `Solve for x:`,
      math: simplifiedRadical.isPerfect
        ? <>r₁ = {fmtFrac(r1)}, r₂ = {fmtFrac(r2)}</>
        : simplifiedRadical.den === 1
          ? simplifiedRadical.coef === 1
            ? <>r₁ = {fmtFrac(h)} + √{fmtFrac(simplifiedRadical.radical)}, r₂ = {fmtFrac(h)} − √{fmtFrac(simplifiedRadical.radical)}</>
            : <>r₁ = {fmtFrac(h)} + {fmtFrac(simplifiedRadical.coef)}√{fmtFrac(simplifiedRadical.radical)}, r₂ = {fmtFrac(h)} − {fmtFrac(simplifiedRadical.coef)}√{fmtFrac(simplifiedRadical.radical)}</>
          : <>r₁ ≈ {fmtNumber(r1)}, r₂ ≈ {fmtNumber(r2)}</>
    }
  ];

  // Only add factored form step if roots are rational
  if (simplifiedRadical.isPerfect) {
    steps.push({
      number: 'Step 5',
      description: 'Write in factored form: a(x − r₁)(x − r₂)',
      math: formatFactored(a, r1, r2)
    });
  } else {
    steps.push({
      number: 'Note',
      description: 'This quadratic has irrational roots and cannot be factored using rational coefficients. The factored form would require the radical expressions above.',
      math: ''
    });
  }

  return { result: { a, r1, r2, hasIrrationalRoots: !simplifiedRadical.isPerfect }, steps };
}

function factoredToStandardSteps({ a, r1, r2 }) {
  const b = -a * (r1 + r2);
  const c = a * r1 * r2;

  const sum = r1 + r2;
  const product = r1 * r2;

  const steps = [
    {
      number: 'Step 1',
      description: 'Start with factored form.',
      math: formatFactored(a, r1, r2)
    },
    {
      number: 'Step 2',
      description: `Expand (x − r₁)(x − r₂) using FOIL:`,
      math: <>(x − {fmtFrac(r1)})(x − {fmtFrac(r2)}) = x² − {fmtFrac(sum)}x + {fmtFrac(product)}</>
    },
    {
      number: 'Step 3',
      description: `Distribute the coefficient ${fmtNumber(a)}:`,
      math: <>{fmtFrac(a)}(x² − {fmtFrac(sum)}x + {fmtFrac(product)})</>
    },
    {
      number: 'Step 4',
      description: 'Simplify to get standard form: ax² + bx + c',
      math: formatStandard(a, b, c)
    }
  ];

  return { result: { a, b, c }, steps };
}

function factoredToVertexSteps({ a, r1, r2 }) {
  const h = (r1 + r2) / 2;
  const k = a * (h - r1) * (h - r2);

  const steps = [
    {
      number: 'Step 1',
      description: 'Start with factored form.',
      math: formatFactored(a, r1, r2)
    },
    {
      number: 'Step 2',
      description: `The vertex x-coordinate is the midpoint of the roots: h = (r₁ + r₂)/2`,
      math: <>h = ({fmtFrac(r1)} + {fmtFrac(r2)})/2 = {fmtFrac(h)}</>
    },
    {
      number: 'Step 3',
      description: `The vertex y-coordinate is found by evaluating at x = h:`,
      math: <>k = {fmtFrac(a)}({fmtFrac(h)} − {fmtFrac(r1)})({fmtFrac(h)} − {fmtFrac(r2)}) = {fmtFrac(k)}</>
    },
    {
      number: 'Step 4',
      description: 'Write in vertex form: a(x − h)² + k',
      math: formatVertex(a, h, k)
    }
  ];

  return { result: { a, h, k }, steps };
}

// ─────────────────────────────────────────────────────────────
// Export Utilities
// ─────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function svgToString(svgElement) {
  return new XMLSerializer().serializeToString(svgElement);
}

function exportSvg(svgElement, filename) {
  const svgString = svgToString(svgElement);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}

function exportPng(svgElement, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = VP.w;
  canvas.height = VP.h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, VP.w, VP.h);

  const svgString = svgToString(svgElement);
  const img = new Image();
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((pngBlob) => {
      downloadBlob(pngBlob, filename);
      URL.revokeObjectURL(url);
    });
  };

  img.src = url;
}

// ─────────────────────────────────────────────────────────────
// React Components
// ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <div className="hero">
      <div className="eyebrow">Math Lab</div>
      <h1>Quadratic Form Converter</h1>
      <p className="subhead">
        Convert between standard, vertex, and factored forms with step-by-step algebraic work.
      </p>
    </div>
  );
}

function Breadcrumb() {
  return (
    <div className="breadcrumb">
      <a href="../../../">Home</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
      <a href="../../">Algebra</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
      <a href="../">Quadratics</a>
      <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
      <span className="breadcrumb-current">Form Converter</span>
    </div>
  );
}

function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="hamburger-btn" onClick={() => setOpen(!open)} aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className={`menu-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className={`menu-panel ${open ? 'open' : ''}`}>
        <h2 className="menu-header">Math Lab</h2>

        <div className="menu-section">
          <div className="menu-section-title">Main</div>
          <ul className="menu-links">
            <li><a href="../../../">Home</a></li>
          </ul>
        </div>

        <div className="menu-section">
          <div className="menu-section-title">Algebra</div>
          <ul className="menu-links">
            <li><a href="../../">Quadratics</a></li>
            <li><a href="../quadratic-equation/">Graph Studio</a></li>
            <li><a href="../quadratic-inequality/">Inequality Solver</a></li>
            <li><a href="../quadratic-inequality-region/">Inequality Regions</a></li>
            <li><a href="../parabola-transformations/">Transformations</a></li>
            <li><a href="../discriminant-visualizer/">Discriminant</a></li>
            <li><a href="../completing-the-square/">Completing the Square</a></li>
            <li><a href="../sketch-binomial-factors/">Binomial Multiplication</a></li>
            <li><a href="./" className="active">Form Converter</a></li>
          </ul>
        </div>
      </div>
    </>
  );
}

function InputPanel({ sourceForm, setSourceForm, params, setParams, onLoadPreset }) {
  return (
    <div className="input-panel">
      <h3>Source Form</h3>

      <div className="form-selector">
        <button
          className={`form-btn ${sourceForm === FORMS.STANDARD ? 'active' : ''}`}
          onClick={() => setSourceForm(FORMS.STANDARD)}
        >
          Standard
        </button>
        <button
          className={`form-btn ${sourceForm === FORMS.VERTEX ? 'active' : ''}`}
          onClick={() => setSourceForm(FORMS.VERTEX)}
        >
          Vertex
        </button>
        <button
          className={`form-btn ${sourceForm === FORMS.FACTORED ? 'active' : ''}`}
          onClick={() => setSourceForm(FORMS.FACTORED)}
        >
          Factored
        </button>
      </div>

      {sourceForm === FORMS.STANDARD && (
        <StandardInput params={params} setParams={setParams} />
      )}

      {sourceForm === FORMS.VERTEX && (
        <VertexInput params={params} setParams={setParams} />
      )}

      {sourceForm === FORMS.FACTORED && (
        <FactoredInput params={params} setParams={setParams} />
      )}

      <div className="presets">
        {PRESETS.map((preset, idx) => (
          <button key={idx} className="preset-btn" onClick={() => onLoadPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StandardInput({ params, setParams }) {
  const { a, b, c } = params;

  return (
    <>
      <div className="input-group">
        <label className="input-label">Standard Form: ax² + bx + c</label>
        <div className="input-row">
          <input
            type="number"
            value={a}
            onChange={(e) => setParams({ ...params, a: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="a"
          />
          <span>x² +</span>
          <input
            type="number"
            value={b}
            onChange={(e) => setParams({ ...params, b: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="b"
          />
          <span>x +</span>
          <input
            type="number"
            value={c}
            onChange={(e) => setParams({ ...params, c: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="c"
          />
        </div>
      </div>

      <div className="equation-display">
        {formatStandard(a, b, c)}
      </div>
    </>
  );
}

function VertexInput({ params, setParams }) {
  const { a, h, k } = params;

  return (
    <>
      <div className="input-group">
        <label className="input-label">Vertex Form: a(x − h)² + k</label>
        <div className="input-row">
          <input
            type="number"
            value={a}
            onChange={(e) => setParams({ ...params, a: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="a"
          />
          <span>(x −</span>
          <input
            type="number"
            value={h}
            onChange={(e) => setParams({ ...params, h: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="h"
          />
          <span>)² +</span>
          <input
            type="number"
            value={k}
            onChange={(e) => setParams({ ...params, k: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="k"
          />
        </div>
      </div>

      <div className="equation-display">
        {formatVertex(a, h, k)}
      </div>
    </>
  );
}

function FactoredInput({ params, setParams }) {
  const { a, r1, r2 } = params;

  return (
    <>
      <div className="input-group">
        <label className="input-label">Factored Form: a(x − r₁)(x − r₂)</label>
        <div className="input-row">
          <input
            type="number"
            value={a}
            onChange={(e) => setParams({ ...params, a: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="a"
          />
          <span>(x −</span>
          <input
            type="number"
            value={r1}
            onChange={(e) => setParams({ ...params, r1: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="r₁"
          />
          <span>)(x −</span>
          <input
            type="number"
            value={r2}
            onChange={(e) => setParams({ ...params, r2: parseFloat(e.target.value) || 0 })}
            className="coef-input"
            placeholder="r₂"
          />
          <span>)</span>
        </div>
      </div>

      <div className="equation-display">
        {formatFactored(a, r1, r2)}
      </div>
    </>
  );
}

function ConversionPanel({ sourceForm, targetForm, setTargetForm, result, resultString }) {
  return (
    <div className="conversion-panel">
      <h3>Target Form</h3>

      <div className="target-selector">
        <button
          className={`target-btn ${targetForm === FORMS.STANDARD ? 'active' : ''}`}
          onClick={() => setTargetForm(FORMS.STANDARD)}
          disabled={sourceForm === FORMS.STANDARD}
        >
          Standard
        </button>
        <button
          className={`target-btn ${targetForm === FORMS.VERTEX ? 'active' : ''}`}
          onClick={() => setTargetForm(FORMS.VERTEX)}
          disabled={sourceForm === FORMS.VERTEX}
        >
          Vertex
        </button>
        <button
          className={`target-btn ${targetForm === FORMS.FACTORED ? 'active' : ''}`}
          onClick={() => setTargetForm(FORMS.FACTORED)}
          disabled={sourceForm === FORMS.FACTORED}
        >
          Factored
        </button>
      </div>

      {result ? (
        <div className="result-display">
          <div className="result-label">{targetForm} form</div>
          <div className="result-equation">{resultString}</div>
        </div>
      ) : (
        <div className="error-message">
          Cannot convert: No real roots exist for this quadratic.
        </div>
      )}
    </div>
  );
}

function StepsPanel({ steps }) {
  return (
    <div className="steps-panel">
      <h3>Step-by-Step Conversion</h3>
      {steps.map((step, idx) => (
        <div key={idx} className="step">
          <div className="step-number">{step.number}</div>
          <div className="step-description">{step.description}</div>
          {step.math && <div className="step-math">{step.math}</div>}
        </div>
      ))}
    </div>
  );
}

function VisualPanel({ sourceForm, targetForm, params, result }) {
  const svgRef = React.useRef(null);

  if (!result) return null;

  const bounds = getViewRange(params, sourceForm);
  const { xMin, xMax, yMin, yMax } = bounds;

  // Generate parabola path
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const x = xMin + (i / 100) * (xMax - xMin);
    const y = evaluateQuadratic(params, sourceForm, x);
    if (isFinite(y)) {
      const { sx, sy } = toSvg(x, y, bounds);
      points.push(`${sx},${sy}`);
    }
  }
  const pathData = `M ${points.join(' L ')}`;

  // Axis lines
  const zeroX = toSvg(0, 0, bounds);
  const leftEdge = toSvg(xMin, 0, bounds);
  const rightEdge = toSvg(xMax, 0, bounds);
  const bottomEdge = toSvg(0, yMin, bounds);
  const topEdge = toSvg(0, yMax, bounds);

  return (
    <div className="visual-panel">
      <h3>Visual Equivalence</h3>
      <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: '20px' }}>
        Both forms represent the same parabola
      </p>

      <div className="graph-container">
        <svg ref={svgRef} viewBox={`0 0 ${VP.w} ${VP.h}`} style={{ maxWidth: '900px', width: '100%' }}>
          <defs>
            <marker id="arrowX" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="rgba(15, 23, 42, 0.4)" />
            </marker>
            <marker id="arrowY" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="rgba(15, 23, 42, 0.4)" />
            </marker>
          </defs>

          {/* Axes */}
          {xMin <= 0 && xMax >= 0 && (
            <line x1={zeroX.sx} y1={bottomEdge.sy} x2={zeroX.sx} y2={topEdge.sy}
                  stroke="rgba(15, 23, 42, 0.25)" strokeWidth="1.5" markerEnd="url(#arrowY)" />
          )}
          {yMin <= 0 && yMax >= 0 && (
            <line x1={leftEdge.sx} y1={zeroX.sy} x2={rightEdge.sx} y2={zeroX.sy}
                  stroke="rgba(15, 23, 42, 0.25)" strokeWidth="1.5" markerEnd="url(#arrowX)" />
          )}

          {/* Grid */}
          {Array.from({ length: 9 }, (_, i) => {
            const x = xMin + ((i + 1) / 10) * (xMax - xMin);
            const { sx } = toSvg(x, 0, bounds);
            return (
              <line key={`vgrid-${i}`} x1={sx} y1={PAD} x2={sx} y2={VP.h - PAD}
                    stroke="rgba(15, 23, 42, 0.06)" strokeWidth="1" />
            );
          })}
          {Array.from({ length: 9 }, (_, i) => {
            const y = yMin + ((i + 1) / 10) * (yMax - yMin);
            const { sy } = toSvg(0, y, bounds);
            return (
              <line key={`hgrid-${i}`} x1={PAD} y1={sy} x2={VP.w - PAD} y2={sy}
                    stroke="rgba(15, 23, 42, 0.06)" strokeWidth="1" />
            );
          })}

          {/* Parabola */}
          <path d={pathData} fill="none" stroke="#ff6b3d" strokeWidth="3" strokeLinecap="round" />

          {/* Vertex marker */}
          {sourceForm === FORMS.VERTEX && (
            (() => {
              const { h, k } = params;
              const { sx, sy } = toSvg(h, k, bounds);
              return (
                <>
                  <circle cx={sx} cy={sy} r="5" fill="#3b82f6" />
                  <text x={sx + 10} y={sy - 10} fontSize="14" fill="var(--ink)" fontWeight="600">
                    Vertex ({fmtNumber(h)}, {fmtNumber(k)})
                  </text>
                </>
              );
            })()
          )}

          {/* Root markers */}
          {sourceForm === FORMS.FACTORED && (
            (() => {
              const { r1, r2 } = params;
              const p1 = toSvg(r1, 0, bounds);
              const p2 = toSvg(r2, 0, bounds);
              return (
                <>
                  <circle cx={p1.sx} cy={p1.sy} r="5" fill="#10b981" />
                  <text x={p1.sx} y={p1.sy + 20} fontSize="12" fill="var(--ink)" textAnchor="middle">
                    r₁ = {fmtNumber(r1)}
                  </text>
                  <circle cx={p2.sx} cy={p2.sy} r="5" fill="#10b981" />
                  <text x={p2.sx} y={p2.sy + 20} fontSize="12" fill="var(--ink)" textAnchor="middle">
                    r₂ = {fmtNumber(r2)}
                  </text>
                </>
              );
            })()
          )}
        </svg>
      </div>

      <div className="export-footer">
        <button className="export-btn" onClick={() => exportSvg(svgRef.current, 'quadratic-converter.svg')}>
          Export SVG
        </button>
        <button className="export-btn" onClick={() => exportPng(svgRef.current, 'quadratic-converter.png')}>
          Export PNG
        </button>
        <button className="copy-btn" onClick={() => {
          navigator.clipboard.writeText(result ?
            (targetForm === FORMS.STANDARD ? formatStandard(result.a, result.b, result.c) :
             targetForm === FORMS.VERTEX ? formatVertex(result.a, result.h, result.k) :
             formatFactored(result.a, result.r1, result.r2)) : '');
        }}>
          Copy Result
        </button>
      </div>
    </div>
  );
}

function RelatedTools() {
  return (
    <div className="related-tools">
      <h3>Related Tools</h3>
      <div className="related-grid">
        <a href="../quadratic-equation/" className="related-card">
          <div className="related-card-tag">Algebra</div>
          <h4>Graph Studio</h4>
          <p>Interactive parabola graphing with real-time coefficient control</p>
        </a>
        <a href="../completing-the-square/" className="related-card">
          <div className="related-card-tag">Algebra</div>
          <h4>Completing the Square</h4>
          <p>Visual area model showing the geometric meaning</p>
        </a>
        <a href="../discriminant-visualizer/" className="related-card">
          <div className="related-card-tag">Algebra</div>
          <h4>Discriminant</h4>
          <p>Explore how b² − 4ac determines root count</p>
        </a>
      </div>
    </div>
  );
}

function App() {
  const getInitialForm = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('form') || FORMS.STANDARD;
  };

  const getInitialParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const form = urlParams.get('form') || FORMS.STANDARD;

    if (form === FORMS.STANDARD) {
      return {
        a: parseFloat(urlParams.get('a')) || 1,
        b: parseFloat(urlParams.get('b')) || -2,
        c: parseFloat(urlParams.get('c')) || -3
      };
    } else if (form === FORMS.VERTEX) {
      return {
        a: parseFloat(urlParams.get('a')) || 1,
        h: parseFloat(urlParams.get('h')) || 2,
        k: parseFloat(urlParams.get('k')) || -4
      };
    } else {
      return {
        a: parseFloat(urlParams.get('a')) || 1,
        r1: parseFloat(urlParams.get('r1')) || -1,
        r2: parseFloat(urlParams.get('r2')) || 3
      };
    }
  };

  const [sourceForm, setSourceForm] = useState(getInitialForm);
  const [params, setParams] = useState(getInitialParams);
  const [targetForm, setTargetForm] = useState(() => {
    const form = getInitialForm();
    return form === FORMS.STANDARD ? FORMS.VERTEX : FORMS.STANDARD;
  });

  // Update URL when inputs change
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('form', sourceForm);

    Object.keys(params).forEach(key => {
      url.searchParams.set(key, params[key]);
    });

    window.history.replaceState({}, '', url);
  }, [sourceForm, params]);

  // Handle source form change
  useEffect(() => {
    // Set sensible defaults when switching forms
    if (sourceForm === FORMS.STANDARD) {
      setParams({ a: 1, b: -2, c: -3 });
      setTargetForm(FORMS.VERTEX);
    } else if (sourceForm === FORMS.VERTEX) {
      setParams({ a: 1, h: 2, k: -4 });
      setTargetForm(FORMS.STANDARD);
    } else if (sourceForm === FORMS.FACTORED) {
      setParams({ a: 1, r1: -1, r2: 3 });
      setTargetForm(FORMS.STANDARD);
    }
  }, [sourceForm]);

  const handleLoadPreset = (preset) => {
    setSourceForm(preset.form);
    const { form, label, ...presetParams } = preset;
    setParams(presetParams);
  };

  const conversion = useMemo(() => {
    if (sourceForm === targetForm) return { result: params, steps: [] };
    return getConversionSteps(sourceForm, targetForm, params);
  }, [sourceForm, targetForm, params]);

  const resultString = useMemo(() => {
    if (!conversion.result) return '';

    if (targetForm === FORMS.STANDARD) {
      return formatStandard(conversion.result.a, conversion.result.b, conversion.result.c);
    } else if (targetForm === FORMS.VERTEX) {
      return formatVertex(conversion.result.a, conversion.result.h, conversion.result.k);
    } else if (targetForm === FORMS.FACTORED) {
      // Check if roots are irrational
      if (conversion.result.hasIrrationalRoots) {
        return 'Cannot be factored with rational coefficients (see steps for exact roots)';
      }
      return formatFactored(conversion.result.a, conversion.result.r1, conversion.result.r2);
    }

    return '';
  }, [conversion.result, targetForm]);

  return (
    <div className="page">
      <Breadcrumb />
      <HamburgerMenu />
      <HeroSection />

      <div className="main-content">
        <InputPanel
          sourceForm={sourceForm}
          setSourceForm={setSourceForm}
          params={params}
          setParams={setParams}
          onLoadPreset={handleLoadPreset}
        />

        <ConversionPanel
          sourceForm={sourceForm}
          targetForm={targetForm}
          setTargetForm={setTargetForm}
          result={conversion.result}
          resultString={resultString}
        />
      </div>

      {conversion.steps.length > 0 && <StepsPanel steps={conversion.steps} />}

      {conversion.result && (
        <VisualPanel
          sourceForm={sourceForm}
          targetForm={targetForm}
          params={params}
          result={conversion.result}
        />
      )}

      <RelatedTools />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
