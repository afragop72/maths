# Quadratic Inequality Solver & Grapher

An interactive web application that solves and graphs quadratic inequalities (`ax² + bx + c ⋚ 0`) with a step-by-step educational walkthrough, parabola visualization, number line analysis, and multiple solution formats.

## Features

### Interactive Input
- **Coefficient entry**: Three numeric inputs for `a`, `b`, `c` with inline formula preview (`ax² + bx + c ⋚ 0`)
- **Inequality selector**: Toggle between `>`, `≥`, `<`, `≤` with instant recalculation
- **Preset examples**: Five built-in problems covering common and edge cases
- **Validation**: Clear error message when `a = 0` (not a quadratic)

### Parabola Graph
- **SVG-based rendering**: Scalable vector graphics with automatic coordinate range
- **Progressive reveal**: Elements appear as you advance through the steps
  - Grid and axes (always visible)
  - Root markers on x-axis (step 2+)
  - Curve and vertex label (step 3+)
  - Region sign labels (+/−) and test points with f(x) values (step 4+)
  - Shaded solution region between the curve and x-axis (step 5+)
- **Auto-zoom**: View range adapts to roots, vertex, and curve extents
- **Magnify button**: Opens the graph in a resizable popup window for closer inspection

### Number Line
- **Appears at step 4** alongside the sign analysis
- **Root positions** with tick marks and labels
- **Interval signs**: +/− indicators above each interval
- **Solution segments**: Highlighted regions with open (○) or closed (●) endpoints
- **Unbounded arrows**: Extend to ±∞ when the solution includes infinite intervals

### Step-by-Step Walkthrough

Seven progressive steps with educational explanations:

1. **State the Inequality** — Identify the quadratic expression and inequality type
2. **Find the Discriminant** — Compute Δ = b² − 4ac and interpret its meaning
3. **Solve the Equation** — Find roots using the quadratic formula (or note no real roots)
4. **Plot the Parabola** — Draw the curve and mark vertex and roots
5. **Sign Analysis** — Test points in each interval, determine where f(x) is positive/negative
6. **Shade the Solution** — Highlight the regions satisfying the inequality on graph and number line
7. **Write the Solution** — Present the answer in interval, set-builder, and plain English notation

### Result & Export
- **Interval notation**: e.g. `(−∞, 2) ∪ (3, ∞)`
- **Set-builder notation**: e.g. `{ x ∈ ℝ | x < 2 or x > 3 }`
- **Plain English**: e.g. "x is less than 2 or greater than 3"
- **Copy to clipboard**: One-click copy of the interval notation
- **SVG export**: Standalone SVG file of the parabola graph
- **PNG export**: 2× resolution raster image with background

## Usage

### Getting Started

This app uses React 18 and Babel standalone loaded from CDN. Babel fetches `app.jsx` via XHR at runtime, which requires HTTP serving:

```bash
# Any local server works:
npx serve .
# or
python3 -m http.server
# or use VS Code Live Server extension
```

Then open `http://localhost:...` in a browser.

### Preset Examples

| Inequality | a | b | c | Type | Tests |
|---|---|---|---|---|---|
| x² − 5x + 6 > 0 | 1 | −5 | 6 | > | Two roots, outer intervals |
| −x² + 4 ≥ 0 | −1 | 0 | 4 | ≥ | Opens down, bounded solution |
| x² + 1 < 0 | 1 | 0 | 1 | < | No real roots, empty set |
| x² − 6x + 9 ≤ 0 | 1 | −6 | 9 | ≤ | Repeated root, single point |
| 2x² + 3x − 2 ≥ 0 | 2 | 3 | −2 | ≥ | Non-unit leading coefficient |

## Technical Details

### Architecture
- **React 18**: UI components via CDN (UMD build)
- **Babel standalone**: In-browser JSX transpilation
- **SVG**: Parabola graph and number line via React SVG elements
- **CSS custom properties**: Theming and color tokens
- **Google Fonts**: Fraunces (serif headings), Manrope (sans body), Space Mono (monospace math)

### File Structure

```
quadratic-inequality/
├── index.html    # HTML shell, CDN script tags, Google Fonts
├── styles.css    # Design system (warm light theme, two-column layout, responsive)
├── app.jsx       # React components and application logic
└── README.md     # This file
```

### Layout
- **Two-column grid**: Graph panel on the left (maximized), explanation sidebar on the right (380px)
- **Responsive collapse**: Stacks to single column at ≤960px
- **Scrollable sidebar**: Explanation, number line, and result panels scroll independently

### Components

| Component | Purpose |
| --- | --- |
| `HeroSection` | Title, eyebrow label, subtitle |
| `CoefInput` | Labeled numeric input for a single coefficient |
| `InputPanel` | Three coefficient inputs with formula preview, inequality selector, presets |
| `StepNav` | Back/Next buttons + clickable 7-dot stepper |
| `ParabolaSvg` | SVG parabola graph with progressive reveal and region sign labels |
| `NumberLine` | SVG number line with intervals, signs, and solution segments |
| `ExplanationPanel` | Step-specific heading, description, math display, sign analysis table |
| `ResultCard` | Solution in interval/set-builder/English notation + copy button |
| `ExportFooter` | SVG and PNG export buttons + magnify popup |

### Key Functions

**Math**
- `evaluateQuadratic(a, b, c, x)` — Computes ax² + bx + c
- `getDiscriminant(a, b, c)` — Returns b² − 4ac
- `getRoots(a, b, c)` — Finds real roots sorted ascending (handles 0, 1, or 2 roots)
- `getVertex(a, b, c)` — Returns vertex coordinates {x, y}
- `matchesInequality(value, ineqType)` — Tests if a value satisfies the inequality vs zero
- `getTestPoints(roots)` — Picks representative test points for each interval
- `getSolution(a, b, c, ineqType, roots)` — Core solver returning intervals, notation, set-builder, English, and edge-case flags

**Formatting**
- `fmtNumber(n)` — Integer or 2-decimal display
- `fmtSigned(n)` — Signed number with explicit `+`/`−`
- `formatInequality(a, b, c, ineqType)` — Builds display string like "x² − 5x + 6 > 0"
- `formatQuadratic(a, b, c)` — Builds "ax² + bx + c" without inequality

**SVG**
- `getAutoViewRange(a, b, c)` — Computes coordinate bounds that fit roots, vertex, and padding
- `toSvg(mathX, mathY, bounds)` — Math-to-SVG coordinate transform
- `openMagnifiedGraph(svgEl, ineqStr)` — Opens the graph in a 1400×1000 popup window

**Export**
- `svgToString(svgEl, vp)` — Serializes SVG DOM to standalone XML string
- `exportSvg(svgEl, filename, vp)` / `exportPng(svgEl, filename, vp)` — Downloads graph as SVG or PNG
- `downloadBlob(blob, filename)` — Triggers browser download via object URL

### Browser Compatibility
- Modern browsers: Chrome, Firefox, Safari, Edge (latest versions)
- Requires: ES6+, SVG, Canvas 2D, Blob/URL, Clipboard APIs

## License

This project is free to use for educational purposes.
