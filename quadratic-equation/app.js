const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");
const equationDisplay = document.getElementById("equation-display");
const tableBody = document.getElementById("values-table");
const autoZoomToggle = document.getElementById("auto-zoom");

const inputs = {
  a: document.getElementById("coef-a"),
  b: document.getElementById("coef-b"),
  c: document.getElementById("coef-c"),
  xMin: document.getElementById("x-min"),
  xMax: document.getElementById("x-max"),
};

const sliders = {
  a: document.getElementById("slider-a"),
  b: document.getElementById("slider-b"),
  c: document.getElementById("slider-c"),
};

const resetButton = document.getElementById("reset");
const exportPngButton = document.getElementById("export-png");
const exportSvgButton = document.getElementById("export-svg");
const copyEquationButton = document.getElementById("copy-equation");
const fullscreenGraphButton = document.getElementById("fullscreen-graph");
const vertexLabel = document.getElementById("vertex");
const discriminantLabel = document.getElementById("discriminant");
const rootsLabel = document.getElementById("roots");
const badgeA = document.getElementById("badge-a");
const badgeB = document.getElementById("badge-b");
const badgeC = document.getElementById("badge-c");
const discriminantCard = document.getElementById("discriminant-card");

// Validate required DOM elements
if (!canvas || !ctx) {
  console.error("Canvas element not found or context not available");
  throw new Error("Required canvas element is missing");
}

const defaultState = {
  a: 1,
  b: 0,
  c: 0,
  xMin: -10,
  xMax: 10,
};

const presets = {
  simple: { a: 1, b: 0, c: 0 },
  inverted: { a: -1, b: 0, c: 0 },
  shifted: { a: 1, b: 0, c: -4 },
  "no-roots": { a: 1, b: 0, c: 5 }
};

const padding = 50;
const axisColor = "#1f2433";
const gridMinor = "rgba(15, 23, 42, 0.08)";
const gridMajor = "rgba(15, 23, 42, 0.35)";
const tickColor = "rgba(15, 23, 42, 0.65)";
const curveColor = "#ff6b3d";
const curveShadow = "rgba(255, 107, 61, 0.25)";
const CURVE_STEPS = 180;
const vertexColor = "#3b82f6";
const rootColor = "#10b981";
const symmetryLineColor = "rgba(59, 130, 246, 0.3)";

let hoverState = {
  isHovering: false,
  canvasX: 0,
  canvasY: 0,
  mathX: 0,
  mathY: 0,
  bounds: null,
  coefficients: { a: 1, b: 0, c: 0 }
};

let animationState = {
  isAnimating: false,
  startTime: 0,
  duration: 300,
  startCoeffs: { a: 1, b: 0, c: 0 },
  targetCoeffs: { a: 1, b: 0, c: 0 },
  animationFrame: null
};

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

// Parse decimal or fractional input like "3/4".
function parseFraction(raw) {
  const value = raw.trim();
  if (value === "") {
    return NaN;
  }
  if (!value.includes("/")) {
    return Number.parseFloat(value);
  }
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

function parseValue(input, fallback) {
  const value = parseFraction(String(input.value));
  const isValid = Number.isFinite(value);

  if (input.type === "text" || input.type === "number") {
    if (isValid) {
      input.classList.remove("invalid");
    } else if (input.value.trim() !== "") {
      input.classList.add("invalid");
    }
  }

  return isValid ? value : fallback;
}

function clampRange(min, max) {
  if (min === max) {
    return [min - 1, max + 1];
  }
  if (min > max) {
    return [max, min];
  }
  return [min, max];
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function evaluateQuadratic(a, b, c, x) {
  return a * x * x + b * x + c;
}

function getVertex(a, b, c) {
  if (a === 0) {
    return { x: NaN, y: NaN };
  }
  const x = -b / (2 * a);
  const y = evaluateQuadratic(a, b, c, x);
  return { x, y };
}

function getRoots(a, b, c) {
  if (a === 0) {
    if (b === 0) {
      return [];
    }
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    return [];
  }
  if (disc === 0) {
    return [-b / (2 * a)];
  }
  const sqrtDisc = Math.sqrt(disc);
  return [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
}

function toScreen(x, y, bounds) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;
  const xRatio = (x - xMin) / (xMax - xMin);
  const yRatio = (y - yMin) / (yMax - yMin);
  return {
    x: padding + xRatio * width,
    y: canvas.height - padding - yRatio * height,
  };
}

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

function formatTick(value) {
  if (Math.abs(value) < 1e-6) {
    return "0";
  }
  return value.toFixed(0);
}

// Draw minor/major grid lines and axis labels on the axes.
function drawGrid(bounds) {
  const xStart = Math.ceil(bounds.xMin);
  const xEnd = Math.floor(bounds.xMax);
  const yStart = Math.ceil(bounds.yMin);
  const yEnd = Math.floor(bounds.yMax);

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

  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 2.5;
  const zero = toScreen(0, 0, bounds);
  if (zero.x >= padding && zero.x <= canvas.width - padding) {
    ctx.beginPath();
    ctx.moveTo(zero.x, padding);
    ctx.lineTo(zero.x, canvas.height - padding);
    ctx.stroke();

    const arrowSize = 8;
    ctx.fillStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(zero.x, padding);
    ctx.lineTo(zero.x - arrowSize / 2, padding + arrowSize);
    ctx.lineTo(zero.x + arrowSize / 2, padding + arrowSize);
    ctx.closePath();
    ctx.fill();
  }
  if (zero.y >= padding && zero.y <= canvas.height - padding) {
    ctx.beginPath();
    ctx.moveTo(padding, zero.y);
    ctx.lineTo(canvas.width - padding, zero.y);
    ctx.stroke();

    const arrowSize = 8;
    ctx.fillStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(canvas.width - padding, zero.y);
    ctx.lineTo(canvas.width - padding - arrowSize, zero.y - arrowSize / 2);
    ctx.lineTo(canvas.width - padding - arrowSize, zero.y + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
  }

  const axisY = zero.y >= padding && zero.y <= canvas.height - padding
    ? zero.y
    : canvas.height - padding;
  const axisX = zero.x >= padding && zero.x <= canvas.width - padding
    ? zero.x
    : padding;

  ctx.fillStyle = tickColor;
  ctx.font = "12px Space Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let x = xStart; x <= xEnd; x += 1) {
    if (x % 5 !== 0) {
      continue;
    }
    const xPos = toScreen(x, bounds.yMin, bounds).x;
    ctx.fillText(formatTick(x), xPos, axisY + 6);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = yStart; y <= yEnd; y += 1) {
    if (y % 5 !== 0) {
      continue;
    }
    const yPos = toScreen(bounds.xMin, y, bounds).y;
    ctx.fillText(formatTick(y), axisX - 6, yPos);
  }
}

function drawCurve(a, b, c, bounds) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = curveColor;
  ctx.shadowColor = curveShadow;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  const steps = CURVE_STEPS;
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
  ctx.shadowBlur = 0;
}

function drawAxisOfSymmetry(a, b, c, bounds) {
  if (a === 0) {
    return;
  }
  const vertex = getVertex(a, b, c);
  if (!Number.isFinite(vertex.x)) {
    return;
  }

  const point = toScreen(vertex.x, bounds.yMin, bounds);
  if (point.x < padding || point.x > canvas.width - padding) {
    return;
  }

  ctx.strokeStyle = symmetryLineColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(point.x, padding);
  ctx.lineTo(point.x, canvas.height - padding);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVertexMarker(a, b, c, bounds) {
  if (a === 0) {
    return;
  }
  const vertex = getVertex(a, b, c);
  if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
    return;
  }

  const point = toScreen(vertex.x, vertex.y, bounds);
  if (point.x < padding || point.x > canvas.width - padding ||
      point.y < padding || point.y > canvas.height - padding) {
    return;
  }

  ctx.fillStyle = vertexColor;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = vertexColor;
  ctx.font = "bold 12px Space Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const label = `(${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)})`;
  const labelY = point.y > canvas.height / 2 ? point.y - 15 : point.y + 25;

  const metrics = ctx.measureText(label);
  const labelPadding = 6;
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillRect(
    point.x - metrics.width / 2 - labelPadding,
    labelY - 14,
    metrics.width + labelPadding * 2,
    18
  );

  ctx.fillStyle = vertexColor;
  ctx.fillText(label, point.x, labelY);
}

function drawRootMarkers(a, b, c, bounds) {
  const roots = getRoots(a, b, c);
  if (roots.length === 0) {
    return;
  }

  roots.forEach((root) => {
    const point = toScreen(root, 0, bounds);
    if (point.x < padding || point.x > canvas.width - padding ||
        point.y < padding || point.y > canvas.height - padding) {
      return;
    }

    ctx.fillStyle = rootColor;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rootColor;
    ctx.font = "bold 11px Space Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = `x=${root.toFixed(2)}`;

    const metrics = ctx.measureText(label);
    const labelPadding = 5;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(
      point.x - metrics.width / 2 - labelPadding,
      point.y + 12,
      metrics.width + labelPadding * 2,
      16
    );

    ctx.fillStyle = rootColor;
    ctx.fillText(label, point.x, point.y + 14);
  });
}

function drawCrosshair() {
  if (!hoverState.isHovering) {
    return;
  }

  const x = hoverState.canvasX;
  const y = hoverState.canvasY;

  if (x < padding || x > canvas.width - padding ||
      y < padding || y > canvas.height - padding) {
    return;
  }

  ctx.strokeStyle = "rgba(11, 13, 23, 0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(x, padding);
  ctx.lineTo(x, canvas.height - padding);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(canvas.width - padding, y);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.fillStyle = "#0b0d17";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

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

  const label = `x: ${hoverState.mathX.toFixed(2)}, y: ${curveY.toFixed(2)}`;
  ctx.font = "bold 12px Space Mono, monospace";
  const metrics = ctx.measureText(label);
  const tooltipPadding = 8;
  const tooltipWidth = metrics.width + tooltipPadding * 2;
  const tooltipHeight = 24;

  let tooltipX = x + 15;
  let tooltipY = y - tooltipHeight - 10;

  if (tooltipX + tooltipWidth > canvas.width - padding) {
    tooltipX = x - tooltipWidth - 15;
  }
  if (tooltipY < padding) {
    tooltipY = y + 15;
  }

  ctx.fillStyle = "rgba(11, 13, 23, 0.95)";
  ctx.beginRadius = 8;
  ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, tooltipX + tooltipPadding, tooltipY + tooltipHeight / 2);
}

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

function updateStats(a, b, c) {
  const vertex = getVertex(a, b, c);
  if (Number.isFinite(vertex.x)) {
    vertexLabel.textContent = `(${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)})`;
  } else {
    vertexLabel.textContent = "—";
  }

  const disc = b * b - 4 * a * c;
  discriminantLabel.textContent = disc.toFixed(2);

  const roots = getRoots(a, b, c);
  discriminantCard.className = "stat-card";
  if (roots.length === 0) {
    rootsLabel.textContent = "No real roots";
    discriminantCard.classList.add("no-roots");
  } else if (roots.length === 1) {
    rootsLabel.textContent = roots.map((root) => root.toFixed(2)).join(", ");
    discriminantCard.classList.add("one-root");
  } else {
    rootsLabel.textContent = roots.map((root) => root.toFixed(2)).join(", ");
    discriminantCard.classList.add("two-roots");
  }

  updateBadge(badgeA, a);
  updateBadge(badgeB, b);
  updateBadge(badgeC, c);
}

function getDisplayText(value, fallback) {
  const raw = normalizeFractionString(String(value));
  if (raw === "") {
    return fallback;
  }
  return raw;
}

function buildFractionHtml(raw) {
  const parts = raw.split("/").map((part) => part.trim());
  if (parts.length !== 2) {
    return raw;
  }
  return `<span class="fraction"><span class="top">${parts[0]}</span><span class="bottom">${parts[1]}</span></span>`;
}

function formatAbsCoeffHtml(raw) {
  const clean = raw.replace(/^[-+]/, "").trim();
  if (clean.includes("/")) {
    return buildFractionHtml(clean);
  }
  return clean;
}

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

// Render the equation using the original fraction strings.
function updateEquation() {
  const aRaw = getDisplayText(inputs.a.value, "0");
  const bRaw = getDisplayText(inputs.b.value, "0");
  const cRaw = getDisplayText(inputs.c.value, "0");

  const aParsed = parseFraction(aRaw);
  const aValue = Number.isFinite(aParsed) ? aParsed : 0;
  const aSign = aValue < 0 ? "-" : "";
  const aAbs = formatAbsCoeffHtml(aRaw);
  const aCoef = aAbs === "1" ? "" : aAbs;
  const aTerm = `${aSign}${aCoef}x<sup>2</sup>`;

  const bTerm = formatTermHtml(bRaw, "x");
  const cTerm = formatTermHtml(cRaw, "");

  const equationHtml = `y = ${aTerm}${bTerm ? ` ${bTerm}` : ""}${cTerm ? ` ${cTerm}` : ""}`
    .replace(/\s\+/g, " +")
    .replace(/\s\-/g, " -")
    .replace(/\s+/g, " ")
    .trim();

  equationDisplay.innerHTML = equationHtml;
}

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

function getAutoXRange(a, b, c) {
  const roots = getRoots(a, b, c);
  const vertex = getVertex(a, b, c);
  let center = Number.isFinite(vertex.x) ? vertex.x : 0;
  let halfWidth = 8;

  if (roots.length >= 2) {
    const minRoot = Math.min(...roots);
    const maxRoot = Math.max(...roots);
    center = (minRoot + maxRoot) / 2;
    halfWidth = Math.max(4, (maxRoot - minRoot) * 0.75);
  } else if (roots.length === 1) {
    center = roots[0];
    halfWidth = 8;
  } else if (a !== 0 && Math.abs(a) >= 0.01) {
    halfWidth = 6 / Math.sqrt(Math.abs(a));
  } else if (b !== 0) {
    center = -c / b;
    halfWidth = 10;
  }

  const minHalfWidth = 4;
  const maxHalfWidth = 20;
  halfWidth = Math.min(Math.max(halfWidth, minHalfWidth), maxHalfWidth);
  return [center - halfWidth, center + halfWidth];
}

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

// Auto-zoom bounds while keeping equal x/y scale and visible x-axis.
function getAutoBounds(a, b, c, baseXMin, baseXMax) {
  const plotWidth = canvas.width - padding * 2;
  const plotHeight = canvas.height - padding * 2;
  const aspect = plotHeight / plotWidth;

  const center = (baseXMin + baseXMax) / 2;
  const maxRange = baseXMax - baseXMin;
  const minRange = Math.min(4, maxRange);

  let xRange = maxRange;

  for (let pass = 0; pass < 2; pass += 1) {
    const xMin = center - xRange / 2;
    const xMax = center + xRange / 2;
    const sample = sampleYRange(a, b, c, xMin, xMax);
    const paddingY = Math.max(0.5, (sample.max - sample.min) * 0.12);
    let yMin = sample.min - paddingY;
    let yMax = sample.max + paddingY;

    const yRange = Math.max(1e-6, yMax - yMin);
    xRange = Math.min(Math.max(yRange / aspect, minRange), maxRange);

    const axisMargin = yRange * 0.18;
    if (0 < yMin - axisMargin) {
      yMin = 0 - axisMargin;
      yMax = yMin + yRange;
    } else if (0 > yMax + axisMargin) {
      yMax = 0 + axisMargin;
      yMin = yMax - yRange;
    }
  }

  const finalXMin = center - xRange / 2;
  const finalXMax = center + xRange / 2;
  const finalSample = sampleYRange(a, b, c, finalXMin, finalXMax);
  const finalPadding = Math.max(0.5, (finalSample.max - finalSample.min) * 0.12);
  let finalYMin = finalSample.min - finalPadding;
  let finalYMax = finalSample.max + finalPadding;

  const finalRange = Math.max(1e-6, finalYMax - finalYMin);
  const axisMargin = finalRange * 0.18;
  if (0 < finalYMin - axisMargin) {
    finalYMin = 0 - axisMargin;
    finalYMax = finalYMin + finalRange;
  } else if (0 > finalYMax + axisMargin) {
    finalYMax = 0 + axisMargin;
    finalYMin = finalYMax - finalRange;
  }

  const yMid = (finalYMin + finalYMax) / 2;
  const yRange = xRange * aspect;

  return {
    xMin: finalXMin,
    xMax: finalXMax,
    yMin: yMid - yRange / 2,
    yMax: yMid + yRange / 2,
  };
}

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

// Main render loop: compute bounds, draw grid/curve, update stats + table.
function renderWithCoeffs(a, b, c, updateUI = true) {
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

  if (isAuto && updateUI) {
    inputs.xMin.value = bounds.xMin.toFixed(2);
    inputs.xMax.value = bounds.xMax.toFixed(2);
  }

  hoverState.bounds = bounds;
  hoverState.coefficients = { a, b, c };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(bounds);
  drawAxisOfSymmetry(a, b, c, bounds);
  drawCurve(a, b, c, bounds);
  drawVertexMarker(a, b, c, bounds);
  drawRootMarkers(a, b, c, bounds);
  drawCrosshair();

  if (updateUI) {
    updateStats(a, b, c);
    updateEquation();
    updateTable(a, b, c);
  }
}

function animate(timestamp) {
  if (!animationState.startTime) {
    animationState.startTime = timestamp;
  }

  const elapsed = timestamp - animationState.startTime;
  const progress = Math.min(elapsed / animationState.duration, 1);
  const easedProgress = easeOutCubic(progress);

  const a = lerp(animationState.startCoeffs.a, animationState.targetCoeffs.a, easedProgress);
  const b = lerp(animationState.startCoeffs.b, animationState.targetCoeffs.b, easedProgress);
  const c = lerp(animationState.startCoeffs.c, animationState.targetCoeffs.c, easedProgress);

  renderWithCoeffs(a, b, c, progress === 1);

  if (progress < 1) {
    animationState.animationFrame = requestAnimationFrame(animate);
  } else {
    animationState.isAnimating = false;
    animationState.startTime = 0;
  }
}

function render() {
  const a = parseValue(inputs.a, defaultState.a);
  const b = parseValue(inputs.b, defaultState.b);
  const c = parseValue(inputs.c, defaultState.c);

  if (animationState.isAnimating) {
    if (animationState.animationFrame) {
      cancelAnimationFrame(animationState.animationFrame);
    }
  }

  const prevA = animationState.targetCoeffs.a;
  const prevB = animationState.targetCoeffs.b;
  const prevC = animationState.targetCoeffs.c;

  const hasChanged = (prevA !== a || prevB !== b || prevC !== c);

  if (hasChanged && !hoverState.isHovering) {
    animationState.startCoeffs = { a: prevA, b: prevB, c: prevC };
    animationState.targetCoeffs = { a, b, c };
    animationState.isAnimating = true;
    animationState.startTime = 0;
    animationState.animationFrame = requestAnimationFrame(animate);
  } else {
    animationState.targetCoeffs = { a, b, c };
    renderWithCoeffs(a, b, c, true);
  }
}

function syncCoefficient(source, target) {
  target.value = source.value;
  render();
}

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

function downloadFile(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportPng() {
  const dataUrl = canvas.toDataURL("image/png");
  downloadFile(dataUrl, "quadratic-graph.png");
}

function copyEquation() {
  const a = parseValue(inputs.a, defaultState.a);
  const b = parseValue(inputs.b, defaultState.b);
  const c = parseValue(inputs.c, defaultState.c);

  const aStr = a === 1 ? "" : a === -1 ? "-" : a.toString();
  const bStr = b === 0 ? "" : b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`;
  const cStr = c === 0 ? "" : c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;

  let equation = `y = ${aStr}x²${bStr}${cStr}`;
  equation = equation.replace(/\s+/g, " ").trim();

  navigator.clipboard.writeText(equation).then(() => {
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

function openFullscreenGraph() {
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

  const vertex = getVertex(a, b, c);
  const disc = b * b - 4 * a * c;
  const roots = getRoots(a, b, c);
  const vertexText = Number.isFinite(vertex.x) ? "(" + vertex.x.toFixed(2) + ", " + vertex.y.toFixed(2) + ")" : "—";
  const rootsText = roots.length === 0 ? "No real roots" : roots.map(r => r.toFixed(2)).join(", ");

  const newWindow = window.open("", "Graph", "width=1400,height=900");

  if (!newWindow) {
    alert("Please allow popups to open the graph in a larger window");
    return;
  }

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

  setTimeout(function() {
    const fsCanvas = newWindow.document.getElementById("fullscreen-canvas");
    if (!fsCanvas) return;

    const fsCtx = fsCanvas.getContext("2d");
    const fsPadding = 60;

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

function exportSvg() {
  const width = canvas.width;
  const height = canvas.height;
  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  const gridLines = 10;
  for (let i = 0; i <= gridLines; i += 1) {
    const x = padding + (i / gridLines) * (width - padding * 2);
    svgParts.push(`<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="${gridMinor}" stroke-width="1"/>`);
  }
  for (let i = 0; i <= gridLines; i += 1) {
    const y = padding + (i / gridLines) * (height - padding * 2);
    svgParts.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="${gridMinor}" stroke-width="1"/>`);
  }

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

  const zero = toScreen(0, 0, bounds);
  if (zero.x >= padding && zero.x <= width - padding) {
    svgParts.push(`<line x1="${zero.x}" y1="${padding}" x2="${zero.x}" y2="${height - padding}" stroke="${axisColor}" stroke-width="2"/>`);
  }
  if (zero.y >= padding && zero.y <= height - padding) {
    svgParts.push(`<line x1="${padding}" y1="${zero.y}" x2="${width - padding}" y2="${zero.y}" stroke="${axisColor}" stroke-width="2"/>`);
  }

  if (a !== 0) {
    const vertex = getVertex(a, b, c);
    if (Number.isFinite(vertex.x)) {
      const vPoint = toScreen(vertex.x, bounds.yMin, bounds);
      if (vPoint.x >= padding && vPoint.x <= width - padding) {
        svgParts.push(`<line x1="${vPoint.x}" y1="${padding}" x2="${vPoint.x}" y2="${height - padding}" stroke="${symmetryLineColor}" stroke-width="2" stroke-dasharray="8,6"/>`);
      }
    }
  }

  const curvePoints = [];
  const curveSteps = CURVE_STEPS;
  for (let i = 0; i <= curveSteps; i += 1) {
    const x = bounds.xMin + (i / curveSteps) * (bounds.xMax - bounds.xMin);
    const y = evaluateQuadratic(a, b, c, x);
    const point = toScreen(x, y, bounds);
    curvePoints.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
  }
  svgParts.push(`<polyline fill="none" stroke="${curveColor}" stroke-width="3" points="${curvePoints.join(" ")}"/>`);

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

  const svgContent = svgParts.join("");
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  downloadFile(url, "quadratic-graph.svg");
  URL.revokeObjectURL(url);
}

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", render);
});

sliders.a.addEventListener("input", () => syncCoefficient(sliders.a, inputs.a));
sliders.b.addEventListener("input", () => syncCoefficient(sliders.b, inputs.b));
sliders.c.addEventListener("input", () => syncCoefficient(sliders.c, inputs.c));

inputs.a.addEventListener("input", () => syncCoefficient(inputs.a, sliders.a));
inputs.b.addEventListener("input", () => syncCoefficient(inputs.b, sliders.b));
inputs.c.addEventListener("input", () => syncCoefficient(inputs.c, sliders.c));

autoZoomToggle.addEventListener("change", render);

resetButton.addEventListener("click", resetForm);
exportPngButton.addEventListener("click", exportPng);
exportSvgButton.addEventListener("click", exportSvg);
copyEquationButton.addEventListener("click", copyEquation);
fullscreenGraphButton.addEventListener("click", openFullscreenGraph);

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

canvas.addEventListener("mouseleave", () => {
  hoverState.isHovering = false;
  render();
});

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

render();
