/**
 * ============================================================================
 * QUADRATIC GRAPH STUDIO
 * ============================================================================
 * Interactive visualization tool for exploring quadratic equations.
 * Supports real-time graphing, animations, and mathematical analysis.
 *
 * Mathematical Foundation:
 * - Standard form: y = ax² + bx + c
 * - Vertex form: y = a(x - h)² + k where (h, k) is the vertex
 * - Vertex coordinates: h = -b/(2a), k = f(h)
 * - Discriminant: Δ = b² - 4ac
 * - Roots (when Δ ≥ 0): x = (-b ± √Δ) / (2a)
 * ============================================================================
 */

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

// Canvas and rendering context
const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");

// UI Display elements
const equationDisplay = document.getElementById("equation-display");
const vertexFormDisplay = document.getElementById("vertex-form");
const factoredFormDisplay = document.getElementById("factored-form");
const tableBody = document.getElementById("values-table");
const autoZoomToggle = document.getElementById("auto-zoom");

// Input fields for coefficients and range
const inputs = {
  a: document.getElementById("coef-a"),
  b: document.getElementById("coef-b"),
  c: document.getElementById("coef-c"),
  xMin: document.getElementById("x-min"),
  xMax: document.getElementById("x-max"),
};

// Slider controls for visual coefficient adjustment
const sliders = {
  a: document.getElementById("slider-a"),
  b: document.getElementById("slider-b"),
  c: document.getElementById("slider-c"),
};

// Button elements
const resetButton = document.getElementById("reset");
const exportPngButton = document.getElementById("export-png");
const exportSvgButton = document.getElementById("export-svg");
const copyEquationButton = document.getElementById("copy-equation");
const fullscreenGraphButton = document.getElementById("fullscreen-graph");

// Statistics display elements
const vertexLabel = document.getElementById("vertex");
const discriminantLabel = document.getElementById("discriminant");
const rootsLabel = document.getElementById("roots");

// Coefficient badge elements
const badgeA = document.getElementById("badge-a");
const badgeB = document.getElementById("badge-b");
const badgeC = document.getElementById("badge-c");
const discriminantCard = document.getElementById("discriminant-card");

// Validate that required DOM elements exist
if (!canvas || !ctx) {
  console.error("Canvas element not found or context not available");
  throw new Error("Required canvas element is missing");
}

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

/**
 * Default initial state for the application
 */
const defaultState = {
  a: 1,      // Coefficient a (controls parabola width and direction)
  b: 0,      // Coefficient b (controls axis of symmetry position)
  c: 0,      // Coefficient c (y-intercept)
  xMin: -10, // Default minimum X value
  xMax: 10,  // Default maximum X value
};

/**
 * Preset equations for quick exploration
 */
const presets = {
  simple: { a: 1, b: 0, c: 0 },        // Basic parabola y = x²
  inverted: { a: -1, b: 0, c: 0 },     // Inverted parabola y = -x²
  shifted: { a: 1, b: 0, c: -4 },      // Shifted down, two roots: y = x² - 4
  "no-roots": { a: 1, b: 0, c: 5 }     // No real roots: y = x² + 5
};

/**
 * Visual styling constants
 */
const padding = 50;                                    // Canvas padding in pixels
const axisColor = "#1f2433";                          // Color of X and Y axes
const gridMinor = "rgba(15, 23, 42, 0.08)";           // Minor grid lines color
const gridMajor = "rgba(15, 23, 42, 0.35)";           // Major grid lines color (every 5 units)
const tickColor = "rgba(15, 23, 42, 0.65)";           // Axis tick labels color
const curveColor = "#ff6b3d";                         // Main parabola curve color
const curveShadow = "rgba(255, 107, 61, 0.25)";       // Curve shadow for depth
const CURVE_STEPS = 180;                               // Number of points to draw curve (higher = smoother)
const vertexColor = "#3b82f6";                        // Blue color for vertex marker
const rootColor = "#10b981";                          // Green color for root markers
const symmetryLineColor = "rgba(59, 130, 246, 0.3)";  // Semi-transparent blue for axis of symmetry

// ============================================================================
// APPLICATION STATE
// ============================================================================

/**
 * State for managing mouse hover interactions
 * Tracks cursor position and displays coordinates on hover
 */
let hoverState = {
  isHovering: false,          // Whether mouse is currently over canvas
  canvasX: 0,                 // Mouse X position in canvas pixels
  canvasY: 0,                 // Mouse Y position in canvas pixels
  mathX: 0,                   // Corresponding mathematical X coordinate
  mathY: 0,                   // Corresponding mathematical Y coordinate
  bounds: null,               // Current graph bounds for coordinate conversion
  coefficients: { a: 1, b: 0, c: 0 }  // Current equation coefficients
};

/**
 * State for managing smooth curve animations
 * When coefficients change, animates transition between old and new curve
 * Uses cubic easing for smooth, professional-looking transitions
 */
let animationState = {
  isAnimating: false,                     // Whether animation is currently running
  startTime: 0,                           // Animation start timestamp
  duration: 300,                          // Animation duration in milliseconds
  startCoeffs: { a: 1, b: 0, c: 0 },     // Starting coefficients
  targetCoeffs: { a: 1, b: 0, c: 0 },    // Target coefficients to animate towards
  animationFrame: null                    // RequestAnimationFrame ID for cancellation
};

// ============================================================================
// INPUT PARSING AND VALIDATION
// ============================================================================

/**
 * Normalizes a fraction string for consistent formatting
 * @param {string} raw - Raw input string (e.g., "3 / 4" or "3/4")
 * @returns {string} - Normalized fraction string "3/4" or original if invalid
 */
function normalizeFractionString(raw) {
  const value = raw.trim();
  if (value === "") {
    return "";
  }
  if (!value.includes("/")) {
    return value;
  }
  const parts = value.split("/").map((part) => part.trim());
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    return value;
  }
  return `${parts[0]}/${parts[1]}`;
}

/**
 * Greatest common divisor using Euclidean algorithm
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} - GCD of a and b
 */
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Converts a decimal to a fraction string
 * @param {number} decimal - Decimal number to convert
 * @param {number} tolerance - Tolerance for fraction detection (default 0.001)
 * @returns {string} - Fraction string or decimal string if no simple fraction found
 *
 * Attempts to find a simple fraction representation for common values
 */
function decimalToFraction(decimal, tolerance = 0.001) {
  // Handle special cases
  if (Math.abs(decimal) < 1e-6) {
    return "0";
  }

  // If it's close to an integer, return the integer
  const rounded = Math.round(decimal);
  if (Math.abs(decimal - rounded) < tolerance) {
    return rounded.toString();
  }

  // Try to find a simple fraction (denominator up to 20)
  const sign = decimal < 0 ? "-" : "";
  const absDecimal = Math.abs(decimal);

  for (let denominator = 2; denominator <= 20; denominator++) {
    const numerator = Math.round(absDecimal * denominator);
    const fractionValue = numerator / denominator;

    if (Math.abs(fractionValue - absDecimal) < tolerance) {
      const divisor = gcd(numerator, denominator);
      const simplifiedNum = numerator / divisor;
      const simplifiedDen = denominator / divisor;

      if (simplifiedDen === 1) {
        return sign + simplifiedNum.toString();
      }
      return sign + simplifiedNum + "/" + simplifiedDen;
    }
  }

  // No simple fraction found, return decimal with 2 decimal places
  return decimal.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Parses user input that can be decimal (e.g., "1.5") or fractional (e.g., "3/4")
 * @param {string} raw - Raw input string
 * @returns {number} - Parsed numeric value, or NaN if invalid
 *
 * Examples:
 * - parseFraction("1.5") → 1.5
 * - parseFraction("3/4") → 0.75
 * - parseFraction("invalid") → NaN
 */
function parseFraction(raw) {
  const value = raw.trim();
  if (value === "") {
    return NaN;
  }
  // Handle decimal numbers
  if (!value.includes("/")) {
    return Number.parseFloat(value);
  }
  // Handle fractions
  const parts = value.split("/").map((part) => part.trim());
  if (parts.length !== 2) {
    return NaN;
  }
  const numerator = Number.parseFloat(parts[0]);
  const denominator = Number.parseFloat(parts[1]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return NaN;
  }
  return numerator / denominator;
}

/**
 * Parses and validates input field value with visual feedback
 * @param {HTMLInputElement} input - The input element to parse
 * @param {number} fallback - Fallback value if parsing fails
 * @returns {number} - Parsed value or fallback
 *
 * Side effects:
 * - Adds 'invalid' class to input if parsing fails (triggers shake animation)
 * - Removes 'invalid' class if parsing succeeds
 */
function parseValue(input, fallback) {
  const value = parseFraction(String(input.value));
  const isValid = Number.isFinite(value);

  // Visual feedback for validation
  if (input.type === "text" || input.type === "number") {
    if (isValid) {
      input.classList.remove("invalid");
    } else if (input.value.trim() !== "") {
      input.classList.add("invalid");
    }
  }

  return isValid ? value : fallback;
}

/**
 * Ensures min and max form a valid range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {[number, number]} - [min, max] with corrections applied
 *
 * Corrections:
 * - If min === max: Expands range to [min-1, max+1]
 * - If min > max: Swaps values to [max, min]
 */
function clampRange(min, max) {
  if (min === max) {
    return [min - 1, max + 1];
  }
  if (min > max) {
    return [max, min];
  }
  return [min, max];
}

// ============================================================================
// ANIMATION UTILITIES
// ============================================================================

/**
 * Cubic easing function for smooth deceleration
 * Creates a "ease-out" effect where animation starts fast and slows down
 * @param {number} t - Progress value from 0 to 1
 * @returns {number} - Eased value from 0 to 1
 *
 * Formula: 1 - (1 - t)³
 * Used for smooth curve transitions when coefficients change
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Linear interpolation between two values
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} t - Progress from 0 to 1
 * @returns {number} - Interpolated value
 *
 * Example: lerp(0, 10, 0.5) → 5
 */
function lerp(start, end, t) {
  return start + (end - start) * t;
}

// ============================================================================
// MATHEMATICAL FUNCTIONS
// ============================================================================

/**
 * Evaluates quadratic function at a given x
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {number} x - Input x value
 * @returns {number} - y = ax² + bx + c
 */
function evaluateQuadratic(a, b, c, x) {
  return a * x * x + b * x + c;
}

/**
 * Calculates the vertex (turning point) of the parabola
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @returns {{x: number, y: number}} - Vertex coordinates
 *
 * Formula:
 * - Vertex X: h = -b / (2a)
 * - Vertex Y: k = a·h² + b·h + c
 *
 * Special case: If a = 0, equation is linear, returns NaN
 */
function getVertex(a, b, c) {
  if (a === 0) {
    return { x: NaN, y: NaN };
  }
  const x = -b / (2 * a);
  const y = evaluateQuadratic(a, b, c, x);
  return { x, y };
}

/**
 * Finds all real roots (x-intercepts) of the quadratic equation
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @returns {number[]} - Array of root values (0, 1, or 2 roots)
 *
 * Uses the quadratic formula: x = (-b ± √Δ) / (2a)
 * where Δ = b² - 4ac is the discriminant
 *
 * Cases:
 * - Δ < 0: No real roots (parabola doesn't cross x-axis)
 * - Δ = 0: One root (parabola touches x-axis at vertex)
 * - Δ > 0: Two roots (parabola crosses x-axis twice)
 *
 * Special case: If a = 0, treats as linear equation bx + c = 0
 */
function getRoots(a, b, c) {
  // Linear case: bx + c = 0
  if (a === 0) {
    if (b === 0) {
      return [];  // No solution or infinite solutions
    }
    return [-c / b];
  }

  // Quadratic case: use discriminant
  const disc = b * b - 4 * a * c;

  if (disc < 0) {
    return [];  // No real roots
  }
  if (disc === 0) {
    return [-b / (2 * a)];  // One root (double root)
  }

  // Two distinct roots
  const sqrtDisc = Math.sqrt(disc);
  return [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
}

// ============================================================================
// COORDINATE TRANSFORMATION
// ============================================================================

/**
 * Converts mathematical coordinates to canvas pixel coordinates
 * @param {number} x - Mathematical x coordinate
 * @param {number} y - Mathematical y coordinate
 * @param {Object} bounds - Current graph bounds {xMin, xMax, yMin, yMax}
 * @returns {{x: number, y: number}} - Canvas pixel coordinates
 *
 * Handles coordinate system transformation:
 * - Math coords: Origin at center, Y increases upward
 * - Canvas coords: Origin at top-left, Y increases downward
 */
function toScreen(x, y, bounds) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;

  // Calculate position ratios (0 to 1)
  const xRatio = (x - xMin) / (xMax - xMin);
  const yRatio = (y - yMin) / (yMax - yMin);

  return {
    x: padding + xRatio * width,
    y: canvas.height - padding - yRatio * height,  // Flip Y axis
  };
}

/**
 * Converts canvas pixel coordinates to mathematical coordinates
 * Inverse of toScreen() - used for hover functionality
 * @param {number} screenX - Canvas pixel x
 * @param {number} screenY - Canvas pixel y
 * @param {Object} bounds - Current graph bounds
 * @returns {{x: number, y: number}} - Mathematical coordinates
 */
function toMath(screenX, screenY, bounds) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;

  const xRatio = (screenX - padding) / width;
  const yRatio = (canvas.height - padding - screenY) / height;

  return {
    x: xMin + xRatio * (xMax - xMin),
    y: yMin + yRatio * (yMax - yMin),
  };
}

/**
 * Formats axis tick labels (removes near-zero values, shows integers)
 * @param {number} value - Raw value
 * @returns {string} - Formatted string for display
 */
function formatTick(value) {
  if (Math.abs(value) < 1e-6) {
    return "0";
  }
  return value.toFixed(0);
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Draws the coordinate grid with axes, arrows, and labels
 * @param {Object} bounds - Graph bounds {xMin, xMax, yMin, yMax}
 *
 * Renders:
 * - Vertical grid lines (minor every 1 unit, major every 5 units)
 * - Horizontal grid lines (minor every 1 unit, major every 5 units)
 * - X and Y axes with arrows pointing in positive direction
 * - Tick labels on major grid lines
 */
function drawGrid(bounds) {
  const xStart = Math.ceil(bounds.xMin);
  const xEnd = Math.floor(bounds.xMax);
  const yStart = Math.ceil(bounds.yMin);
  const yEnd = Math.floor(bounds.yMax);

  // Draw vertical grid lines
  for (let x = xStart; x <= xEnd; x += 1) {
    const isMajor = x % 5 === 0;
    const color = isMajor ? gridMajor : gridMinor;
    const point = toScreen(x, bounds.yMin, bounds);
    ctx.strokeStyle = color;
    ctx.lineWidth = isMajor ? 1.2 : 1;
    ctx.beginPath();
    ctx.moveTo(point.x, padding);
    ctx.lineTo(point.x, canvas.height - padding);
    ctx.stroke();
  }

  // Draw horizontal grid lines
  for (let y = yStart; y <= yEnd; y += 1) {
    const isMajor = y % 5 === 0;
    const color = isMajor ? gridMajor : gridMinor;
    const point = toScreen(bounds.xMin, y, bounds);
    ctx.strokeStyle = color;
    ctx.lineWidth = isMajor ? 1.2 : 1;
    ctx.beginPath();
    ctx.moveTo(padding, point.y);
    ctx.lineTo(canvas.width - padding, point.y);
    ctx.stroke();
  }

  // Draw main axes (X and Y at origin)
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 2.5;
  const zero = toScreen(0, 0, bounds);

  // Draw Y-axis (vertical) if visible
  if (zero.x >= padding && zero.x <= canvas.width - padding) {
    ctx.beginPath();
    ctx.moveTo(zero.x, padding);
    ctx.lineTo(zero.x, canvas.height - padding);
    ctx.stroke();

    // Draw upward arrow at top of Y-axis
    const arrowSize = 8;
    ctx.fillStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(zero.x, padding);
    ctx.lineTo(zero.x - arrowSize / 2, padding + arrowSize);
    ctx.lineTo(zero.x + arrowSize / 2, padding + arrowSize);
    ctx.closePath();
    ctx.fill();
  }

  // Draw X-axis (horizontal) if visible
  if (zero.y >= padding && zero.y <= canvas.height - padding) {
    ctx.beginPath();
    ctx.moveTo(padding, zero.y);
    ctx.lineTo(canvas.width - padding, zero.y);
    ctx.stroke();

    // Draw rightward arrow at end of X-axis
    const arrowSize = 8;
    ctx.fillStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(canvas.width - padding, zero.y);
    ctx.lineTo(canvas.width - padding - arrowSize, zero.y - arrowSize / 2);
    ctx.lineTo(canvas.width - padding - arrowSize, zero.y + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
  }

  // Determine where to place axis labels
  const axisY = zero.y >= padding && zero.y <= canvas.height - padding
    ? zero.y
    : canvas.height - padding;
  const axisX = zero.x >= padding && zero.x <= canvas.width - padding
    ? zero.x
    : padding;

  // Draw X-axis labels (below horizontal axis)
  ctx.fillStyle = tickColor;
  ctx.font = "12px Space Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let x = xStart; x <= xEnd; x += 1) {
    if (x % 5 !== 0) {
      continue;  // Only label major grid lines
    }
    const xPos = toScreen(x, bounds.yMin, bounds).x;
    ctx.fillText(formatTick(x), xPos, axisY + 6);
  }

  // Draw Y-axis labels (left of vertical axis)
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = yStart; y <= yEnd; y += 1) {
    if (y % 5 !== 0) {
      continue;  // Only label major grid lines
    }
    const yPos = toScreen(bounds.xMin, y, bounds).y;
    ctx.fillText(formatTick(y), axisX - 6, yPos);
  }
}

/**
 * Draws the quadratic curve (parabola)
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {Object} bounds - Graph bounds
 *
 * Draws smooth curve by sampling CURVE_STEPS points across X range
 * Applies shadow effect for visual depth
 */
function drawCurve(a, b, c, bounds) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = curveColor;
  ctx.shadowColor = curveShadow;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  const steps = CURVE_STEPS;

  // Sample points across X range
  for (let i = 0; i <= steps; i += 1) {
    const x = bounds.xMin + (i / steps) * (bounds.xMax - bounds.xMin);
    const y = evaluateQuadratic(a, b, c, x);
    const point = toScreen(x, y, bounds);

    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }

  ctx.stroke();
  ctx.shadowBlur = 0;  // Reset shadow
}

/**
 * Draws the axis of symmetry (vertical dashed line through vertex)
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {Object} bounds - Graph bounds
 *
 * The axis of symmetry is at x = -b/(2a) and divides the parabola into
 * two mirror-image halves
 */
function drawAxisOfSymmetry(a, b, c, bounds) {
  if (a === 0) {
    return;  // No parabola = no axis of symmetry
  }

  const vertex = getVertex(a, b, c);
  if (!Number.isFinite(vertex.x)) {
    return;
  }

  const point = toScreen(vertex.x, bounds.yMin, bounds);

  // Only draw if within visible bounds
  if (point.x < padding || point.x > canvas.width - padding) {
    return;
  }

  ctx.strokeStyle = symmetryLineColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);  // Dashed line pattern: 8px dash, 6px gap
  ctx.beginPath();
  ctx.moveTo(point.x, padding);
  ctx.lineTo(point.x, canvas.height - padding);
  ctx.stroke();
  ctx.setLineDash([]);  // Reset to solid line
}

/**
 * Draws a marker (blue circle) at the vertex with coordinate label
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {Object} bounds - Graph bounds
 *
 * The vertex is the highest or lowest point on the parabola
 * Labels show position above or below marker depending on space
 */
function drawVertexMarker(a, b, c, bounds) {
  if (a === 0) {
    return;
  }

  const vertex = getVertex(a, b, c);
  if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
    return;
  }

  const point = toScreen(vertex.x, vertex.y, bounds);

  // Only draw if within visible bounds
  if (point.x < padding || point.x > canvas.width - padding ||
      point.y < padding || point.y > canvas.height - padding) {
    return;
  }

  // Draw circle marker
  ctx.fillStyle = vertexColor;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw label with background
  ctx.fillStyle = vertexColor;
  ctx.font = "bold 12px Space Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const label = `(${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)})`;

  // Position label above or below marker to avoid overlap
  const labelY = point.y > canvas.height / 2 ? point.y - 15 : point.y + 25;

  // Draw white background for label
  const metrics = ctx.measureText(label);
  const labelPadding = 6;
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillRect(
    point.x - metrics.width / 2 - labelPadding,
    labelY - 14,
    metrics.width + labelPadding * 2,
    18
  );

  // Draw label text
  ctx.fillStyle = vertexColor;
  ctx.fillText(label, point.x, labelY);
}

/**
 * Draws markers (green circles) at each real root with labels
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {Object} bounds - Graph bounds
 *
 * Roots are x-intercepts where y = 0 (parabola crosses x-axis)
 * May draw 0, 1, or 2 markers depending on discriminant
 */
function drawRootMarkers(a, b, c, bounds) {
  const roots = getRoots(a, b, c);

  if (roots.length === 0) {
    return;  // No real roots
  }

  roots.forEach((root) => {
    const point = toScreen(root, 0, bounds);

    // Only draw if within visible bounds
    if (point.x < padding || point.x > canvas.width - padding ||
        point.y < padding || point.y > canvas.height - padding) {
      return;
    }

    // Draw circle marker
    ctx.fillStyle = rootColor;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw label with background
    ctx.fillStyle = rootColor;
    ctx.font = "bold 11px Space Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = `x=${root.toFixed(2)}`;

    // Draw white background for label
    const metrics = ctx.measureText(label);
    const labelPadding = 5;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(
      point.x - metrics.width / 2 - labelPadding,
      point.y + 12,
      metrics.width + labelPadding * 2,
      16
    );

    // Draw label text
    ctx.fillStyle = rootColor;
    ctx.fillText(label, point.x, point.y + 14);
  });
}

/**
 * Draws interactive crosshair and tooltip when hovering over canvas
 * Shows exact coordinates and highlights point on curve
 *
 * Uses hoverState which is updated by mousemove event listener
 */
function drawCrosshair() {
  if (!hoverState.isHovering) {
    return;
  }

  const x = hoverState.canvasX;
  const y = hoverState.canvasY;

  // Only draw if within plot area
  if (x < padding || x > canvas.width - padding ||
      y < padding || y > canvas.height - padding) {
    return;
  }

  // Draw dashed crosshair lines
  ctx.strokeStyle = "rgba(11, 13, 23, 0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(x, padding);
  ctx.lineTo(x, canvas.height - padding);
  ctx.stroke();

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(canvas.width - padding, y);
  ctx.stroke();

  ctx.setLineDash([]);

  // Draw cursor position marker
  ctx.fillStyle = "#0b0d17";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Calculate and draw point on curve
  const curveY = evaluateQuadratic(
    hoverState.coefficients.a,
    hoverState.coefficients.b,
    hoverState.coefficients.c,
    hoverState.mathX
  );
  const curvePoint = toScreen(hoverState.mathX, curveY, hoverState.bounds);

  if (curvePoint.y >= padding && curvePoint.y <= canvas.height - padding) {
    ctx.fillStyle = curveColor;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(curvePoint.x, curvePoint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw tooltip with coordinates
  const label = `x: ${hoverState.mathX.toFixed(2)}, y: ${curveY.toFixed(2)}`;
  ctx.font = "bold 12px Space Mono, monospace";
  const metrics = ctx.measureText(label);
  const tooltipPadding = 8;
  const tooltipWidth = metrics.width + tooltipPadding * 2;
  const tooltipHeight = 24;

  // Position tooltip to avoid going off-screen
  let tooltipX = x + 15;
  let tooltipY = y - tooltipHeight - 10;

  if (tooltipX + tooltipWidth > canvas.width - padding) {
    tooltipX = x - tooltipWidth - 15;
  }
  if (tooltipY < padding) {
    tooltipY = y + 15;
  }

  // Draw tooltip background
  ctx.fillStyle = "rgba(11, 13, 23, 0.95)";
  ctx.beginRadius = 8;
  ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

  // Draw tooltip text
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, tooltipX + tooltipPadding, tooltipY + tooltipHeight / 2);
}

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

/**
 * Updates coefficient badge display (shows +, -, or 0 with colors)
 * @param {HTMLElement} badge - Badge element to update
 * @param {number} value - Coefficient value
 *
 * Visual feedback:
 * - Positive: Green badge with "+"
 * - Negative: Red badge with "−"
 * - Zero: Gray badge with "0"
 */
function updateBadge(badge, value) {
  if (Math.abs(value) < 1e-6) {
    badge.textContent = "0";
    badge.className = "coef-badge zero";
  } else if (value > 0) {
    badge.textContent = "+";
    badge.className = "coef-badge positive";
  } else {
    badge.textContent = "−";
    badge.className = "coef-badge negative";
  }
}

/**
 * Updates statistics display (vertex, discriminant, roots)
 * Also applies color coding to discriminant card based on number of roots
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 */
function updateStats(a, b, c) {
  // Update vertex display
  const vertex = getVertex(a, b, c);
  if (Number.isFinite(vertex.x)) {
    vertexLabel.textContent = `(${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)})`;
  } else {
    vertexLabel.textContent = "—";
  }

  // Update discriminant display
  const disc = b * b - 4 * a * c;
  discriminantLabel.textContent = disc.toFixed(2);

  // Update roots display with color coding
  const roots = getRoots(a, b, c);
  discriminantCard.className = "stat-card";

  if (roots.length === 0) {
    rootsLabel.textContent = "No real roots";
    discriminantCard.classList.add("no-roots");     // Red background
  } else if (roots.length === 1) {
    rootsLabel.textContent = roots.map((root) => root.toFixed(2)).join(", ");
    discriminantCard.classList.add("one-root");     // Yellow background
  } else {
    rootsLabel.textContent = roots.map((root) => root.toFixed(2)).join(", ");
    discriminantCard.classList.add("two-roots");    // Green background
  }

  // Update coefficient badges
  updateBadge(badgeA, a);
  updateBadge(badgeB, b);
  updateBadge(badgeC, c);
}

/**
 * Gets display text from input value, handling empty inputs
 * @param {string} value - Input value
 * @param {string} fallback - Fallback string if empty
 * @returns {string} - Display text
 */
function getDisplayText(value, fallback) {
  const raw = normalizeFractionString(String(value));
  if (raw === "") {
    return fallback;
  }
  return raw;
}

/**
 * Builds HTML for displaying fractions vertically
 * @param {string} raw - Fraction string like "3/4"
 * @returns {string} - HTML with fraction styling
 *
 * Converts "3/4" to visual fraction with numerator over denominator
 */
function buildFractionHtml(raw) {
  const parts = raw.split("/").map((part) => part.trim());
  if (parts.length !== 2) {
    return raw;
  }
  return `<span class="fraction"><span class="top">${parts[0]}</span><span class="bottom">${parts[1]}</span></span>`;
}

/**
 * Formats coefficient for display, handling fractions and removing signs
 * @param {string} raw - Raw coefficient string
 * @returns {string} - Formatted HTML string
 */
function formatAbsCoeffHtml(raw) {
  const clean = raw.replace(/^[-+]/, "").trim();
  if (clean.includes("/")) {
    return buildFractionHtml(clean);
  }
  return clean;
}

/**
 * Formats a single term in the equation (handles sign, coefficient, symbol)
 * @param {string} raw - Raw coefficient value
 * @param {string} symbol - Variable symbol (e.g., "x²", "x", "")
 * @returns {string} - Formatted term HTML
 */
function formatTermHtml(raw, symbol) {
  const parsed = parseFraction(raw);
  if (!Number.isFinite(parsed) || parsed === 0) {
    return "";
  }
  const sign = parsed > 0 ? "+" : "-";
  const absHtml = formatAbsCoeffHtml(raw);
  const coefHtml = absHtml === "1" && symbol ? "" : absHtml;
  return ` ${sign} ${coefHtml}${symbol}`.trim();
}

/**
 * Updates the equation display with proper formatting and fractions
 * Builds equation string like "y = x² + 2x - 3" with visual fractions
 */
function updateEquation() {
  const aRaw = getDisplayText(inputs.a.value, "0");
  const bRaw = getDisplayText(inputs.b.value, "0");
  const cRaw = getDisplayText(inputs.c.value, "0");

  // Parse and convert to fractions for display
  const aParsed = parseFraction(aRaw);
  const aValue = Number.isFinite(aParsed) ? aParsed : 0;
  const aFractionStr = decimalToFraction(aValue);
  const aSign = aValue < 0 ? "-" : "";

  // Format coefficient with fraction HTML
  const aAbsStr = aFractionStr.replace(/^[-+]/, "");
  let aAbs = aAbsStr;
  if (aAbsStr.includes("/")) {
    aAbs = buildFractionHtml(aAbsStr);
  }
  const aCoef = aAbsStr === "1" ? "" : aAbs;
  const aTerm = `${aSign}${aCoef}x<sup>2</sup>`;

  // Parse b and c, convert to fractions
  const bParsed = parseFraction(bRaw);
  const bValue = Number.isFinite(bParsed) ? bParsed : 0;
  const bFractionStr = decimalToFraction(bValue);

  const cParsed = parseFraction(cRaw);
  const cValue = Number.isFinite(cParsed) ? cParsed : 0;
  const cFractionStr = decimalToFraction(cValue);

  const bTerm = formatTermHtml(bFractionStr, "x");
  const cTerm = formatTermHtml(cFractionStr, "");

  const equationHtml = `y = ${aTerm}${bTerm ? ` ${bTerm}` : ""}${cTerm ? ` ${cTerm}` : ""}`
    .replace(/\s\+/g, " +")
    .replace(/\s\-/g, " -")
    .replace(/\s+/g, " ")
    .trim();

  equationDisplay.innerHTML = equationHtml;
}

/**
 * Updates the vertex form display: y = a(x - h)² + k
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 */
function updateVertexForm(a, b, c) {
  if (Math.abs(a) < 1e-6) {
    vertexFormDisplay.innerHTML = "Not applicable (linear equation)";
    return;
  }

  const vertex = getVertex(a, b, c);
  const h = vertex.x;
  const k = vertex.y;

  // Format a coefficient - use fractions
  let aStr = "";
  if (Math.abs(a - 1) > 1e-6 && Math.abs(a + 1) > 1e-6) {
    const aFraction = decimalToFraction(a);
    // Check if it's negative and has a fraction
    if (a < 0 && aFraction.startsWith("-") && aFraction.substring(1).includes("/")) {
      aStr = "-" + buildFractionHtml(aFraction.substring(1));
    } else if (aFraction.includes("/")) {
      aStr = buildFractionHtml(aFraction);
    } else {
      aStr = aFraction;
    }
  } else if (Math.abs(a + 1) < 1e-6) {
    aStr = "-";
  }

  // Format h (note the sign flip) - use fractions
  const hSign = h >= 0 ? "-" : "+";
  const hFraction = decimalToFraction(Math.abs(h));
  const hDisplay = hFraction.includes("/")
    ? buildFractionHtml(hFraction)
    : hFraction;

  // Format k - use fractions
  const kSign = k >= 0 ? "+" : "-";
  const kFraction = decimalToFraction(Math.abs(k));
  const kDisplay = kFraction.includes("/")
    ? buildFractionHtml(kFraction)
    : kFraction;

  const formHtml = `y = ${aStr}(x ${hSign} ${hDisplay})<sup>2</sup> ${kSign} ${kDisplay}`;
  vertexFormDisplay.innerHTML = formHtml;
}

/**
 * Updates the factored form display: y = a(x - r₁)(x - r₂)
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 */
function updateFactoredForm(a, b, c) {
  if (Math.abs(a) < 1e-6) {
    factoredFormDisplay.innerHTML = "Not applicable (linear equation)";
    return;
  }

  const roots = getRoots(a, b, c);

  if (roots.length === 0) {
    factoredFormDisplay.innerHTML = "No real roots (cannot factor)";
    return;
  }

  // Format a coefficient - use fractions
  let aStr = "";
  if (Math.abs(a - 1) > 1e-6 && Math.abs(a + 1) > 1e-6) {
    const aFraction = decimalToFraction(a);
    // Check if it's negative and has a fraction
    if (a < 0 && aFraction.startsWith("-") && aFraction.substring(1).includes("/")) {
      aStr = "-" + buildFractionHtml(aFraction.substring(1));
    } else if (aFraction.includes("/")) {
      aStr = buildFractionHtml(aFraction);
    } else {
      aStr = aFraction;
    }
  } else if (Math.abs(a + 1) < 1e-6) {
    aStr = "-";
  }

  if (roots.length === 1) {
    // One root (double root)
    const r = roots[0];
    const rSign = r >= 0 ? "-" : "+";
    const rFraction = decimalToFraction(Math.abs(r));
    const rDisplay = rFraction.includes("/")
      ? buildFractionHtml(rFraction)
      : rFraction;
    const formHtml = `y = ${aStr}(x ${rSign} ${rDisplay})<sup>2</sup>`;
    factoredFormDisplay.innerHTML = formHtml;
  } else {
    // Two roots
    const r1 = roots[0];
    const r2 = roots[1];
    const r1Sign = r1 >= 0 ? "-" : "+";
    const r1Fraction = decimalToFraction(Math.abs(r1));
    const r1Display = r1Fraction.includes("/")
      ? buildFractionHtml(r1Fraction)
      : r1Fraction;

    const r2Sign = r2 >= 0 ? "-" : "+";
    const r2Fraction = decimalToFraction(Math.abs(r2));
    const r2Display = r2Fraction.includes("/")
      ? buildFractionHtml(r2Fraction)
      : r2Fraction;

    const formHtml = `y = ${aStr}(x ${r1Sign} ${r1Display})(x ${r2Sign} ${r2Display})`;
    factoredFormDisplay.innerHTML = formHtml;
  }
}

/**
 * Updates the table of values with 5 sample points centered on vertex
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 */
function updateTable(a, b, c) {
  tableBody.innerHTML = "";
  const vertex = getVertex(a, b, c);
  const centerX = Number.isFinite(vertex.x) ? vertex.x : 0;
  const xValues = [centerX - 2, centerX - 1, centerX, centerX + 1, centerX + 2];

  xValues.forEach((x) => {
    const y = evaluateQuadratic(a, b, c, x);
    const tr = document.createElement("tr");
    const tdX = document.createElement("td");
    const tdY = document.createElement("td");
    tdX.textContent = x.toFixed(2);
    tdY.textContent = y.toFixed(2);
    tr.append(tdX, tdY);
    tableBody.appendChild(tr);
  });
}

// ============================================================================
// BOUNDS CALCULATION
// ============================================================================

/**
 * Calculates optimal X range to show important features of the parabola
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @returns {[number, number]} - [xMin, xMax] range
 *
 * Strategy:
 * - If 2 roots: Center on roots with padding
 * - If 1 root: Center on root
 * - If 0 roots: Center on vertex
 * - Scale width based on coefficient 'a' (narrower for larger |a|)
 */
function getAutoXRange(a, b, c) {
  const roots = getRoots(a, b, c);
  const vertex = getVertex(a, b, c);
  let center = Number.isFinite(vertex.x) ? vertex.x : 0;
  let halfWidth = 8;

  if (roots.length >= 2) {
    // Two roots: show both with padding
    const minRoot = Math.min(...roots);
    const maxRoot = Math.max(...roots);
    center = (minRoot + maxRoot) / 2;
    halfWidth = Math.max(4, (maxRoot - minRoot) * 0.75);
  } else if (roots.length === 1) {
    // One root: center on it
    center = roots[0];
    halfWidth = 8;
  } else if (a !== 0 && Math.abs(a) >= 0.01) {
    // No roots: scale based on 'a' (wider for smaller |a|)
    halfWidth = 6 / Math.sqrt(Math.abs(a));
  } else if (b !== 0) {
    // Linear case
    center = -c / b;
    halfWidth = 10;
  }

  // Apply min/max constraints
  const minHalfWidth = 4;
  const maxHalfWidth = 20;
  halfWidth = Math.min(Math.max(halfWidth, minHalfWidth), maxHalfWidth);

  return [center - halfWidth, center + halfWidth];
}

/**
 * Samples Y values across X range to find min and max
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {number} xMin - Minimum X value
 * @param {number} xMax - Maximum X value
 * @returns {{min: number, max: number}} - Y range
 *
 * Samples at CURVE_STEPS points to ensure we capture vertex and extrema
 */
function sampleYRange(a, b, c, xMin, xMax) {
  const steps = CURVE_STEPS;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i <= steps; i += 1) {
    const x = xMin + (i / steps) * (xMax - xMin);
    const y = evaluateQuadratic(a, b, c, x);
    min = Math.min(min, y);
    max = Math.max(max, y);
  }

  return { min, max };
}

/**
 * Calculates optimal graph bounds when auto-zoom is enabled
 * Ensures entire parabola is visible with appropriate padding
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {number} baseXMin - Starting X minimum
 * @param {number} baseXMax - Starting X maximum
 * @returns {Object} - Bounds {xMin, xMax, yMin, yMax}
 *
 * Algorithm:
 * 1. Use provided X range
 * 2. Sample Y values across that range
 * 3. Add 15% padding on top/bottom
 * 4. Adjust to include X-axis if close to data
 */
function getAutoBounds(a, b, c, baseXMin, baseXMax) {
  const xMin = baseXMin;
  const xMax = baseXMax;

  // Sample all Y values in the X range
  const sample = sampleYRange(a, b, c, xMin, xMax);
  const yDataRange = sample.max - sample.min;

  // Add 15% padding for visibility
  const paddingY = Math.max(1, yDataRange * 0.15);

  let yMin = sample.min - paddingY;
  let yMax = sample.max + paddingY;

  // Ensure X-axis is visible if data is close to it
  const axisMargin = (yMax - yMin) * 0.15;
  if (yMin > 0 && yMin < axisMargin * 2) {
    yMin = -axisMargin;
  } else if (yMax < 0 && yMax > -axisMargin * 2) {
    yMax = axisMargin;
  }

  return {
    xMin: xMin,
    xMax: xMax,
    yMin: yMin,
    yMax: yMax,
  };
}

/**
 * Calculates graph bounds for manual mode (respects user X range)
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {number} xMin - User-specified X minimum
 * @param {number} xMax - User-specified X maximum
 * @returns {Object} - Bounds {xMin, xMax, yMin, yMax}
 *
 * Centers Y range on vertex to keep important features visible
 * Maintains canvas aspect ratio
 */
function getManualBounds(a, b, c, xMin, xMax) {
  const plotWidth = canvas.width - padding * 2;
  const plotHeight = canvas.height - padding * 2;
  const aspect = plotHeight / plotWidth;

  const xRange = xMax - xMin;
  const yRange = xRange * aspect;

  const vertex = getVertex(a, b, c);
  const yCenter = Number.isFinite(vertex.y)
    ? vertex.y
    : evaluateQuadratic(a, b, c, (xMin + xMax) / 2);

  return {
    xMin,
    xMax,
    yMin: yCenter - yRange / 2,
    yMax: yCenter + yRange / 2,
  };
}

// ============================================================================
// RENDERING ORCHESTRATION
// ============================================================================

/**
 * Renders the complete graph with given coefficients
 * Main rendering function that coordinates all drawing operations
 * @param {number} a - Coefficient a
 * @param {number} b - Coefficient b
 * @param {number} c - Coefficient c
 * @param {boolean} updateUI - Whether to update UI elements (text, stats, table)
 */
function renderWithCoeffs(a, b, c, updateUI = true) {
  const isAuto = autoZoomToggle.checked;

  // Parse X range from inputs
  let xMin = parseValue(inputs.xMin, defaultState.xMin);
  let xMax = parseValue(inputs.xMax, defaultState.xMax);

  // Calculate appropriate bounds
  if (isAuto) {
    const [autoXMin, autoXMax] = getAutoXRange(a, b, c);
    [xMin, xMax] = clampRange(autoXMin, autoXMax);
  } else {
    [xMin, xMax] = clampRange(xMin, xMax);
  }

  const bounds = isAuto
    ? getAutoBounds(a, b, c, xMin, xMax)
    : getManualBounds(a, b, c, xMin, xMax);

  // Update X range inputs in auto mode
  if (isAuto && updateUI) {
    inputs.xMin.value = bounds.xMin.toFixed(2);
    inputs.xMax.value = bounds.xMax.toFixed(2);
  }

  // Store bounds for hover functionality
  hoverState.bounds = bounds;
  hoverState.coefficients = { a, b, c };

  // Clear canvas and draw all elements in correct order
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(bounds);                    // Grid first (background)
  drawAxisOfSymmetry(a, b, c, bounds); // Symmetry line
  drawCurve(a, b, c, bounds);          // Main curve
  drawVertexMarker(a, b, c, bounds);   // Vertex marker
  drawRootMarkers(a, b, c, bounds);    // Root markers
  drawCrosshair();                     // Crosshair last (foreground)

  // Update UI elements if requested
  if (updateUI) {
    updateStats(a, b, c);
    updateEquation();
    updateVertexForm(a, b, c);
    updateFactoredForm(a, b, c);
    updateTable(a, b, c);
  }
}

/**
 * Animation loop function called by requestAnimationFrame
 * Interpolates between start and target coefficients for smooth transitions
 * @param {number} timestamp - Current timestamp from requestAnimationFrame
 */
function animate(timestamp) {
  if (!animationState.startTime) {
    animationState.startTime = timestamp;
  }

  const elapsed = timestamp - animationState.startTime;
  const progress = Math.min(elapsed / animationState.duration, 1);
  const easedProgress = easeOutCubic(progress);

  // Interpolate coefficients
  const a = lerp(animationState.startCoeffs.a, animationState.targetCoeffs.a, easedProgress);
  const b = lerp(animationState.startCoeffs.b, animationState.targetCoeffs.b, easedProgress);
  const c = lerp(animationState.startCoeffs.c, animationState.targetCoeffs.c, easedProgress);

  // Render with interpolated values
  // Only update UI on final frame for performance
  renderWithCoeffs(a, b, c, progress === 1);

  // Continue animation or finish
  if (progress < 1) {
    animationState.animationFrame = requestAnimationFrame(animate);
  } else {
    animationState.isAnimating = false;
    animationState.startTime = 0;
  }
}

/**
 * Main render function triggered by user input
 * Starts animation if coefficients changed, or renders immediately if hovering
 */
function render() {
  const a = parseValue(inputs.a, defaultState.a);
  const b = parseValue(inputs.b, defaultState.b);
  const c = parseValue(inputs.c, defaultState.c);

  // Cancel any ongoing animation
  if (animationState.isAnimating) {
    if (animationState.animationFrame) {
      cancelAnimationFrame(animationState.animationFrame);
    }
  }

  const prevA = animationState.targetCoeffs.a;
  const prevB = animationState.targetCoeffs.b;
  const prevC = animationState.targetCoeffs.c;

  const hasChanged = (prevA !== a || prevB !== b || prevC !== c);

  // Animate only if coefficients changed and not hovering
  if (hasChanged && !hoverState.isHovering) {
    animationState.startCoeffs = { a: prevA, b: prevB, c: prevC };
    animationState.targetCoeffs = { a, b, c };
    animationState.isAnimating = true;
    animationState.startTime = 0;
    animationState.animationFrame = requestAnimationFrame(animate);
  } else {
    // Immediate render (no animation)
    animationState.targetCoeffs = { a, b, c };
    renderWithCoeffs(a, b, c, true);
  }
}

// ============================================================================
// USER INTERACTION HANDLERS
// ============================================================================

/**
 * Synchronizes values between slider and text input
 * @param {HTMLInputElement} source - Element that was changed
 * @param {HTMLInputElement} target - Element to update
 */
function syncCoefficient(source, target) {
  target.value = source.value;
  render();
}

/**
 * Resets all inputs to default values
 */
function resetForm() {
  inputs.a.value = defaultState.a;
  inputs.b.value = defaultState.b;
  inputs.c.value = defaultState.c;
  inputs.xMin.value = defaultState.xMin;
  inputs.xMax.value = defaultState.xMax;
  sliders.a.value = defaultState.a;
  sliders.b.value = defaultState.b;
  sliders.c.value = defaultState.c;
  autoZoomToggle.checked = true;
  render();
}

/**
 * Downloads a file by creating temporary link and clicking it
 * @param {string} dataUrl - Data URL or blob URL
 * @param {string} filename - Desired filename
 */
function downloadFile(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports current canvas as PNG image
 */
function exportPng() {
  const dataUrl = canvas.toDataURL("image/png");
  downloadFile(dataUrl, "quadratic-graph.png");
}

/**
 * Copies equation text to clipboard
 * Shows visual confirmation by changing button icon temporarily
 */
function copyEquation() {
  const a = parseValue(inputs.a, defaultState.a);
  const b = parseValue(inputs.b, defaultState.b);
  const c = parseValue(inputs.c, defaultState.c);

  // Build equation string
  const aStr = a === 1 ? "" : a === -1 ? "-" : a.toString();
  const bStr = b === 0 ? "" : b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`;
  const cStr = c === 0 ? "" : c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;

  let equation = `y = ${aStr}x²${bStr}${cStr}`;
  equation = equation.replace(/\s+/g, " ").trim();

  // Copy to clipboard
  navigator.clipboard.writeText(equation).then(() => {
    // Show confirmation
    copyEquationButton.textContent = "✓";
    copyEquationButton.classList.add("copied");
    setTimeout(() => {
      copyEquationButton.textContent = "📋";
      copyEquationButton.classList.remove("copied");
    }, 2000);
  }).catch((err) => {
    console.error("Failed to copy equation:", err);
  });
}

/**
 * Opens a larger graph in a popup window for better visualization
 * Creates complete standalone HTML page with larger canvas
 */
function openFullscreenGraph() {
  const a = parseValue(inputs.a, defaultState.a);
  const b = parseValue(inputs.b, defaultState.b);
  const c = parseValue(inputs.c, defaultState.c);
  const isAuto = autoZoomToggle.checked;

  // Calculate bounds using same logic as main graph
  let xMin = parseValue(inputs.xMin, defaultState.xMin);
  let xMax = parseValue(inputs.xMax, defaultState.xMax);

  if (isAuto) {
    const [autoXMin, autoXMax] = getAutoXRange(a, b, c);
    [xMin, xMax] = clampRange(autoXMin, autoXMax);
  } else {
    [xMin, xMax] = clampRange(xMin, xMax);
  }

  const bounds = isAuto
    ? getAutoBounds(a, b, c, xMin, xMax)
    : getManualBounds(a, b, c, xMin, xMax);

  // Calculate statistics for display
  const vertex = getVertex(a, b, c);
  const disc = b * b - 4 * a * c;
  const roots = getRoots(a, b, c);
  const vertexText = Number.isFinite(vertex.x) ? "(" + vertex.x.toFixed(2) + ", " + vertex.y.toFixed(2) + ")" : "—";
  const rootsText = roots.length === 0 ? "No real roots" : roots.map(r => r.toFixed(2)).join(", ");

  // Open popup window
  const newWindow = window.open("", "Graph", "width=1400,height=900");

  if (!newWindow) {
    alert("Please allow popups to open the graph in a larger window");
    return;
  }

  // Build complete HTML page with inline styles and scripts
  const html = '<!DOCTYPE html><html><head><title>Quadratic Graph - y = ' + a + 'x² + ' + b + 'x + ' + c + '</title>' +
    '<style>' +
    'body { margin: 0; padding: 20px; background: linear-gradient(135deg, #f7f3ea 0%, #f5f8ff 100%); ' +
    'font-family: "Space Mono", monospace; display: flex; flex-direction: column; align-items: center; gap: 20px; }' +
    'h1 { margin: 0; color: #0b0d17; font-size: 1.5rem; }' +
    'canvas { background: linear-gradient(145deg, #ffffff 0%, #f5f7ff 100%); border-radius: 12px; ' +
    'box-shadow: 0 20px 60px rgba(10, 14, 30, 0.12); cursor: crosshair; }' +
    '.info { display: flex; gap: 24px; color: #0b0d17; font-size: 0.9rem; }' +
    '.info-item { background: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(10, 14, 30, 0.08); }' +
    '.info-label { color: rgba(11, 13, 23, 0.55); font-weight: 600; }' +
    '</style></head><body>' +
    '<h1>y = ' + a + 'x² + ' + b + 'x + ' + c + '</h1>' +
    '<canvas id="fullscreen-canvas" width="1300" height="800"></canvas>' +
    '<div class="info">' +
    '<div class="info-item"><span class="info-label">Vertex:</span> ' + vertexText + '</div>' +
    '<div class="info-item"><span class="info-label">Discriminant:</span> ' + disc.toFixed(2) + '</div>' +
    '<div class="info-item"><span class="info-label">Roots:</span> ' + rootsText + '</div>' +
    '</div></body></html>';

  newWindow.document.write(html);
  newWindow.document.close();

  // Wait for window to load, then render graph
  setTimeout(function() {
    const fsCanvas = newWindow.document.getElementById("fullscreen-canvas");
    if (!fsCanvas) return;

    const fsCtx = fsCanvas.getContext("2d");
    const fsPadding = 60;

    // Coordinate transformation for fullscreen canvas
    function toScreenFS(x, y) {
      const xMin = bounds.xMin;
      const xMax = bounds.xMax;
      const yMin = bounds.yMin;
      const yMax = bounds.yMax;
      const width = fsCanvas.width - fsPadding * 2;
      const height = fsCanvas.height - fsPadding * 2;
      const xRatio = (x - xMin) / (xMax - xMin);
      const yRatio = (y - yMin) / (yMax - yMin);
      return {
        x: fsPadding + xRatio * width,
        y: fsCanvas.height - fsPadding - yRatio * height,
      };
    }

    fsCtx.clearRect(0, 0, fsCanvas.width, fsCanvas.height);

    // Draw grid
    const xStart = Math.ceil(bounds.xMin);
    const xEnd = Math.floor(bounds.xMax);
    const yStart = Math.ceil(bounds.yMin);
    const yEnd = Math.floor(bounds.yMax);

    for (let x = xStart; x <= xEnd; x += 1) {
      const isMajor = x % 5 === 0;
      const color = isMajor ? gridMajor : gridMinor;
      const point = toScreenFS(x, bounds.yMin);
      fsCtx.strokeStyle = color;
      fsCtx.lineWidth = isMajor ? 1.5 : 1;
      fsCtx.beginPath();
      fsCtx.moveTo(point.x, fsPadding);
      fsCtx.lineTo(point.x, fsCanvas.height - fsPadding);
      fsCtx.stroke();
    }

    for (let y = yStart; y <= yEnd; y += 1) {
      const isMajor = y % 5 === 0;
      const color = isMajor ? gridMajor : gridMinor;
      const point = toScreenFS(bounds.xMin, y);
      fsCtx.strokeStyle = color;
      fsCtx.lineWidth = isMajor ? 1.5 : 1;
      fsCtx.beginPath();
      fsCtx.moveTo(fsPadding, point.y);
      fsCtx.lineTo(fsCanvas.width - fsPadding, point.y);
      fsCtx.stroke();
    }

    // Draw axes with arrows
    fsCtx.strokeStyle = axisColor;
    fsCtx.lineWidth = 3;
    const zero = toScreenFS(0, 0);
    if (zero.x >= fsPadding && zero.x <= fsCanvas.width - fsPadding) {
      fsCtx.beginPath();
      fsCtx.moveTo(zero.x, fsPadding);
      fsCtx.lineTo(zero.x, fsCanvas.height - fsPadding);
      fsCtx.stroke();

      const arrowSize = 10;
      fsCtx.fillStyle = axisColor;
      fsCtx.beginPath();
      fsCtx.moveTo(zero.x, fsPadding);
      fsCtx.lineTo(zero.x - arrowSize / 2, fsPadding + arrowSize);
      fsCtx.lineTo(zero.x + arrowSize / 2, fsPadding + arrowSize);
      fsCtx.closePath();
      fsCtx.fill();
    }
    if (zero.y >= fsPadding && zero.y <= fsCanvas.height - fsPadding) {
      fsCtx.beginPath();
      fsCtx.moveTo(fsPadding, zero.y);
      fsCtx.lineTo(fsCanvas.width - fsPadding, zero.y);
      fsCtx.stroke();

      const arrowSize = 10;
      fsCtx.fillStyle = axisColor;
      fsCtx.beginPath();
      fsCtx.moveTo(fsCanvas.width - fsPadding, zero.y);
      fsCtx.lineTo(fsCanvas.width - fsPadding - arrowSize, zero.y - arrowSize / 2);
      fsCtx.lineTo(fsCanvas.width - fsPadding - arrowSize, zero.y + arrowSize / 2);
      fsCtx.closePath();
      fsCtx.fill();
    }

    // Draw axis labels
    const axisY = zero.y >= fsPadding && zero.y <= fsCanvas.height - fsPadding
      ? zero.y
      : fsCanvas.height - fsPadding;
    const axisX = zero.x >= fsPadding && zero.x <= fsCanvas.width - fsPadding
      ? zero.x
      : fsPadding;

    fsCtx.fillStyle = tickColor;
    fsCtx.font = "14px Space Mono, monospace";
    fsCtx.textAlign = "center";
    fsCtx.textBaseline = "top";

    for (let x = xStart; x <= xEnd; x += 1) {
      if (x % 5 !== 0) continue;
      const xPos = toScreenFS(x, bounds.yMin).x;
      fsCtx.fillText(formatTick(x), xPos, axisY + 8);
    }

    fsCtx.textAlign = "right";
    fsCtx.textBaseline = "middle";
    for (let y = yStart; y <= yEnd; y += 1) {
      if (y % 5 !== 0) continue;
      const yPos = toScreenFS(bounds.xMin, y).y;
      fsCtx.fillText(formatTick(y), axisX - 8, yPos);
    }

    // Draw axis of symmetry
    if (a !== 0 && Number.isFinite(vertex.x)) {
      const point = toScreenFS(vertex.x, bounds.yMin);
      if (point.x >= fsPadding && point.x <= fsCanvas.width - fsPadding) {
        fsCtx.strokeStyle = symmetryLineColor;
        fsCtx.lineWidth = 2;
        fsCtx.setLineDash([10, 8]);
        fsCtx.beginPath();
        fsCtx.moveTo(point.x, fsPadding);
        fsCtx.lineTo(point.x, fsCanvas.height - fsPadding);
        fsCtx.stroke();
        fsCtx.setLineDash([]);
      }
    }

    // Draw curve
    fsCtx.lineWidth = 4;
    fsCtx.strokeStyle = curveColor;
    fsCtx.shadowColor = curveShadow;
    fsCtx.shadowBlur = 15;
    fsCtx.beginPath();
    for (let i = 0; i <= CURVE_STEPS; i += 1) {
      const x = bounds.xMin + (i / CURVE_STEPS) * (bounds.xMax - bounds.xMin);
      const y = evaluateQuadratic(a, b, c, x);
      const point = toScreenFS(x, y);
      if (i === 0) {
        fsCtx.moveTo(point.x, point.y);
      } else {
        fsCtx.lineTo(point.x, point.y);
      }
    }
    fsCtx.stroke();
    fsCtx.shadowBlur = 0;

    // Draw vertex marker
    if (a !== 0 && Number.isFinite(vertex.x) && Number.isFinite(vertex.y)) {
      const point = toScreenFS(vertex.x, vertex.y);
      if (point.x >= fsPadding && point.x <= fsCanvas.width - fsPadding &&
          point.y >= fsPadding && point.y <= fsCanvas.height - fsPadding) {
        fsCtx.fillStyle = vertexColor;
        fsCtx.strokeStyle = "#fff";
        fsCtx.lineWidth = 4;
        fsCtx.beginPath();
        fsCtx.arc(point.x, point.y, 10, 0, Math.PI * 2);
        fsCtx.fill();
        fsCtx.stroke();

        fsCtx.fillStyle = vertexColor;
        fsCtx.font = "bold 14px Space Mono, monospace";
        fsCtx.textAlign = "center";
        fsCtx.textBaseline = "bottom";
        const label = "(" + vertex.x.toFixed(1) + ", " + vertex.y.toFixed(1) + ")";
        const labelY = point.y > fsCanvas.height / 2 ? point.y - 18 : point.y + 30;

        const metrics = fsCtx.measureText(label);
        const labelPadding = 8;
        fsCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
        fsCtx.fillRect(
          point.x - metrics.width / 2 - labelPadding,
          labelY - 16,
          metrics.width + labelPadding * 2,
          20
        );

        fsCtx.fillStyle = vertexColor;
        fsCtx.fillText(label, point.x, labelY);
      }
    }

    // Draw root markers
    roots.forEach(function(root) {
      const point = toScreenFS(root, 0);
      if (point.x >= fsPadding && point.x <= fsCanvas.width - fsPadding &&
          point.y >= fsPadding && point.y <= fsCanvas.height - fsPadding) {
        fsCtx.fillStyle = rootColor;
        fsCtx.strokeStyle = "#fff";
        fsCtx.lineWidth = 4;
        fsCtx.beginPath();
        fsCtx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        fsCtx.fill();
        fsCtx.stroke();

        fsCtx.fillStyle = rootColor;
        fsCtx.font = "bold 13px Space Mono, monospace";
        fsCtx.textAlign = "center";
        fsCtx.textBaseline = "top";
        const label = "x=" + root.toFixed(2);

        const metrics = fsCtx.measureText(label);
        const labelPadding = 6;
        fsCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
        fsCtx.fillRect(
          point.x - metrics.width / 2 - labelPadding,
          point.y + 14,
          metrics.width + labelPadding * 2,
          18
        );

        fsCtx.fillStyle = rootColor;
        fsCtx.fillText(label, point.x, point.y + 16);
      }
    });
  }, 100);
}

/**
 * Exports graph as SVG (scalable vector format)
 * Generates SVG markup representing all visual elements
 */
function exportSvg() {
  const width = canvas.width;
  const height = canvas.height;
  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  // Simple grid for SVG export
  const gridLines = 10;
  for (let i = 0; i <= gridLines; i += 1) {
    const x = padding + (i / gridLines) * (width - padding * 2);
    svgParts.push(`<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="${gridMinor}" stroke-width="1"/>`);
  }
  for (let i = 0; i <= gridLines; i += 1) {
    const y = padding + (i / gridLines) * (height - padding * 2);
    svgParts.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="${gridMinor}" stroke-width="1"/>`);
  }

  // Get current coefficients and bounds
  const a = parseValue(inputs.a, defaultState.a);
  const b = parseValue(inputs.b, defaultState.b);
  const c = parseValue(inputs.c, defaultState.c);
  const isAuto = autoZoomToggle.checked;

  let xMin = parseValue(inputs.xMin, defaultState.xMin);
  let xMax = parseValue(inputs.xMax, defaultState.xMax);

  if (isAuto) {
    const [autoXMin, autoXMax] = getAutoXRange(a, b, c);
    [xMin, xMax] = clampRange(autoXMin, autoXMax);
  } else {
    [xMin, xMax] = clampRange(xMin, xMax);
  }

  const bounds = isAuto
    ? getAutoBounds(a, b, c, xMin, xMax)
    : getManualBounds(a, b, c, xMin, xMax);

  // Draw axes
  const zero = toScreen(0, 0, bounds);
  if (zero.x >= padding && zero.x <= width - padding) {
    svgParts.push(`<line x1="${zero.x}" y1="${padding}" x2="${zero.x}" y2="${height - padding}" stroke="${axisColor}" stroke-width="2"/>`);
  }
  if (zero.y >= padding && zero.y <= height - padding) {
    svgParts.push(`<line x1="${padding}" y1="${zero.y}" x2="${width - padding}" y2="${zero.y}" stroke="${axisColor}" stroke-width="2"/>`);
  }

  // Draw axis of symmetry
  if (a !== 0) {
    const vertex = getVertex(a, b, c);
    if (Number.isFinite(vertex.x)) {
      const vPoint = toScreen(vertex.x, bounds.yMin, bounds);
      if (vPoint.x >= padding && vPoint.x <= width - padding) {
        svgParts.push(`<line x1="${vPoint.x}" y1="${padding}" x2="${vPoint.x}" y2="${height - padding}" stroke="${symmetryLineColor}" stroke-width="2" stroke-dasharray="8,6"/>`);
      }
    }
  }

  // Draw curve as polyline
  const curvePoints = [];
  const curveSteps = CURVE_STEPS;
  for (let i = 0; i <= curveSteps; i += 1) {
    const x = bounds.xMin + (i / curveSteps) * (bounds.xMax - bounds.xMin);
    const y = evaluateQuadratic(a, b, c, x);
    const point = toScreen(x, y, bounds);
    curvePoints.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
  }
  svgParts.push(`<polyline fill="none" stroke="${curveColor}" stroke-width="3" points="${curvePoints.join(" ")}"/>`);

  // Draw vertex marker
  if (a !== 0) {
    const vertex = getVertex(a, b, c);
    if (Number.isFinite(vertex.x) && Number.isFinite(vertex.y)) {
      const vPoint = toScreen(vertex.x, vertex.y, bounds);
      if (vPoint.x >= padding && vPoint.x <= width - padding &&
          vPoint.y >= padding && vPoint.y <= height - padding) {
        svgParts.push(`<circle cx="${vPoint.x}" cy="${vPoint.y}" r="8" fill="${vertexColor}" stroke="#fff" stroke-width="3"/>`);
        const label = `(${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)})`;
        const labelY = vPoint.y > height / 2 ? vPoint.y - 15 : vPoint.y + 25;
        svgParts.push(`<text x="${vPoint.x}" y="${labelY}" fill="${vertexColor}" font-family="Space Mono, monospace" font-size="12" font-weight="bold" text-anchor="middle">${label}</text>`);
      }
    }
  }

  // Draw root markers
  const roots = getRoots(a, b, c);
  roots.forEach((root) => {
    const rPoint = toScreen(root, 0, bounds);
    if (rPoint.x >= padding && rPoint.x <= width - padding &&
        rPoint.y >= padding && rPoint.y <= height - padding) {
      svgParts.push(`<circle cx="${rPoint.x}" cy="${rPoint.y}" r="6" fill="${rootColor}" stroke="#fff" stroke-width="3"/>`);
      const label = `x=${root.toFixed(2)}`;
      svgParts.push(`<text x="${rPoint.x}" y="${rPoint.y + 26}" fill="${rootColor}" font-family="Space Mono, monospace" font-size="11" font-weight="bold" text-anchor="middle">${label}</text>`);
    }
  });

  svgParts.push("</svg>");

  // Download SVG
  const svgContent = svgParts.join("");
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  downloadFile(url, "quadratic-graph.svg");
  URL.revokeObjectURL(url);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Input field changes trigger render
Object.values(inputs).forEach((input) => {
  input.addEventListener("input", render);
});

// Slider changes sync with text inputs
sliders.a.addEventListener("input", () => syncCoefficient(sliders.a, inputs.a));
sliders.b.addEventListener("input", () => syncCoefficient(sliders.b, inputs.b));
sliders.c.addEventListener("input", () => syncCoefficient(sliders.c, inputs.c));

// Text input changes sync with sliders
inputs.a.addEventListener("input", () => syncCoefficient(inputs.a, sliders.a));
inputs.b.addEventListener("input", () => syncCoefficient(inputs.b, sliders.b));
inputs.c.addEventListener("input", () => syncCoefficient(inputs.c, sliders.c));

// Auto-zoom toggle
autoZoomToggle.addEventListener("change", render);

// Button clicks
resetButton.addEventListener("click", resetForm);
exportPngButton.addEventListener("click", exportPng);
exportSvgButton.addEventListener("click", exportSvg);
copyEquationButton.addEventListener("click", copyEquation);
fullscreenGraphButton.addEventListener("click", openFullscreenGraph);

// Mouse hover for crosshair
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  hoverState.isHovering = true;
  hoverState.canvasX = canvasX;
  hoverState.canvasY = canvasY;

  if (hoverState.bounds) {
    const mathCoords = toMath(canvasX, canvasY, hoverState.bounds);
    hoverState.mathX = mathCoords.x;
    hoverState.mathY = mathCoords.y;
  }

  render();
});

// Mouse leave clears crosshair
canvas.addEventListener("mouseleave", () => {
  hoverState.isHovering = false;
  render();
});

// Preset buttons
document.querySelectorAll(".preset-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const presetName = button.dataset.preset;
    const preset = presets[presetName];
    if (preset) {
      inputs.a.value = preset.a;
      inputs.b.value = preset.b;
      inputs.c.value = preset.c;
      sliders.a.value = preset.a;
      sliders.b.value = preset.b;
      sliders.c.value = preset.c;
      render();
    }
  });
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Render initial graph with default values
render();
