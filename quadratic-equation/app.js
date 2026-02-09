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
const vertexLabel = document.getElementById("vertex");
const discriminantLabel = document.getElementById("discriminant");
const rootsLabel = document.getElementById("roots");

const defaultState = {
  a: 1,
  b: 0,
  c: 0,
  xMin: -10,
  xMax: 10,
};

const padding = 50;
const axisColor = "#1f2433";
const gridMinor = "rgba(15, 23, 42, 0.08)";
const gridMajor = "rgba(15, 23, 42, 0.35)";
const tickColor = "rgba(15, 23, 42, 0.65)";
const curveColor = "#ff6b3d";
const curveShadow = "rgba(255, 107, 61, 0.25)";

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
  return Number.isFinite(value) ? value : fallback;
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

function formatTick(value) {
  if (Math.abs(value) < 1e-6) {
    return "0";
  }
  const rounded = value.toFixed(0);
  return rounded;
}

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
  ctx.lineWidth = 2;
  const zero = toScreen(0, 0, bounds);
  if (zero.x >= padding && zero.x <= canvas.width - padding) {
    ctx.beginPath();
    ctx.moveTo(zero.x, padding);
    ctx.lineTo(zero.x, canvas.height - padding);
    ctx.stroke();
  }
  if (zero.y >= padding && zero.y <= canvas.height - padding) {
    ctx.beginPath();
    ctx.moveTo(padding, zero.y);
    ctx.lineTo(canvas.width - padding, zero.y);
    ctx.stroke();
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
  const steps = 180;
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
  if (roots.length === 0) {
    rootsLabel.textContent = "No real roots";
  } else {
    rootsLabel.textContent = roots.map((root) => root.toFixed(2)).join(", ");
  }
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
  } else if (a !== 0) {
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
  const steps = 180;
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

function render() {
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

  if (isAuto) {
    inputs.xMin.value = bounds.xMin.toFixed(2);
    inputs.xMax.value = bounds.xMax.toFixed(2);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(bounds);
  drawCurve(a, b, c, bounds);
  updateStats(a, b, c);
  updateEquation();
  updateTable(a, b, c);
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
  link.click();
}

function exportPng() {
  const dataUrl = canvas.toDataURL("image/png");
  downloadFile(dataUrl, "quadratic-graph.png");
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

  const curvePoints = [];
  const curveSteps = 180;
  for (let i = 0; i <= curveSteps; i += 1) {
    const x = bounds.xMin + (i / curveSteps) * (bounds.xMax - bounds.xMin);
    const y = evaluateQuadratic(a, b, c, x);
    const point = toScreen(x, y, bounds);
    curvePoints.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
  }
  svgParts.push(`<polyline fill="none" stroke="${curveColor}" stroke-width="3" points="${curvePoints.join(" ")}"/>`);
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

render();
