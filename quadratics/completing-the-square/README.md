# Completing the Square

An interactive web application that converts quadratic expressions (`ax² + bx + c`) into vertex form (`a(x − h)² + k`) through a geometric area model and step-by-step algebraic walkthrough. Fractions are displayed with proper horizontal-bar notation throughout.

## Features

### Interactive Input
- **Coefficient entry**: Three numeric inputs for `a`, `b`, `c` with inline formula preview (`ax² + bx + c`)
- **Preset examples**: Five built-in problems covering common and edge cases
- **Validation**: Clear error message when `a = 0` (not a quadratic)
- **Decimal support**: Non-integer coefficients are accepted; irrational results fall back to decimal display

### Geometric Area Model
- **SVG-based rendering**: Scalable vector graphics with automatic scaling to fit
- **Progressive reveal**: The diagram evolves across six visual stages:
  - **Separated pieces** (steps 1–2): x² square, px rectangle, and constant square shown side by side
  - **Split** (step 3): The px rectangle splits into two halves with a dashed cut line
  - **Rearrange** (step 4): Half-rectangles move to form an L-shape around the x² square, revealing a missing corner gap
  - **Complete** (step 5): The gap fills with an accent-colored piece — the "completing" piece
  - **Label** (step 6): The completed square is labeled with vertex form; constant remainder shown separately
- **Color-coded regions**: Blue for x², amber for bx halves, orange for the completing piece, gray for constants
- **Bracket annotation**: When `a ≠ 1`, a bracket with the factor appears alongside the geometry
- **Negative coefficient note**: When p < 0, a note explains that geometry uses absolute lengths while algebra preserves signs

### Mini Parabola Graph (Step 7)
- **Auto-zoom**: View range adapts to roots, vertex, and curve extents
- **Vertex marker**: Dot and coordinate label at the vertex position
- **Grid and axes**: Light gridlines with numeric labels

### Step-by-Step Walkthrough

Seven progressive steps with educational explanations:

1. **State the Quadratic** — Identify the expression and target vertex form
2. **Factor Out the Leading Coefficient** — Factor `a` from all terms (skipped when `a = 1`)
3. **Identify the Linear Coefficient** — Find p and compute p/2
4. **Find the "Magic Number"** — Square the half-coefficient: (p/2)²
5. **Complete the Square** — Add and subtract (p/2)² to create a perfect square trinomial
6. **Rewrite in Vertex Form** — Factor the trinomial and simplify to `a(x − h)² + k`
7. **Verify with the Graph** — Confirm the vertex position on the parabola

### Fraction Display
- **Exact fractions**: All intermediate values (p, p/2, (p/2)², h, k) computed as exact rational fractions using integer arithmetic
- **Horizontal-bar notation**: Fractions render with a stacked numerator/denominator and horizontal bar in both HTML and SVG contexts
- **Irrational fallback**: Non-integer inputs gracefully fall back to decimal display
- **String copy**: Clipboard copy uses slash notation for plain-text compatibility

### Result & Export
- **Vertex form**: Displayed with proper fraction notation
- **Vertex coordinates**: (h, k) shown as fractions
- **Axis of symmetry**: x = h
- **Copy to clipboard**: One-click copy of the vertex form equation
- **SVG export**: Standalone SVG file of the area model or parabola
- **PNG export**: 2× resolution raster image with background
- **Magnify button**: Opens the diagram in a resizable popup window

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

| Expression | a | b | c | Tests |
|---|---|---|---|---|
| x² + 6x + 5 | 1 | 6 | 5 | a = 1, positive b |
| x² − 4x + 1 | 1 | −4 | 1 | a = 1, negative b |
| 2x² + 12x + 7 | 2 | 12 | 7 | a ≠ 1 |
| −x² + 8x − 3 | −1 | 8 | −3 | a < 0 |
| x² + 2x + 1 | 1 | 2 | 1 | Perfect square, k = 0 |

## Technical Details

### Architecture
- **React 18**: UI components via CDN (UMD build)
- **Babel standalone**: In-browser JSX transpilation
- **SVG**: Area model and parabola graph via React SVG elements
- **CSS custom properties**: Theming and color tokens
- **Google Fonts**: Fraunces (serif headings), Manrope (sans body), Space Mono (monospace math)

### File Structure

```
completing-the-square/
├── index.html    # HTML shell, CDN script tags, Google Fonts
├── styles.css    # Design system (warm light theme, two-column layout, responsive)
├── app.jsx       # React components and application logic
└── README.md     # This file
```

### Layout
- **Two-column grid**: Graph panel on the left (maximized), explanation sidebar on the right (380px)
- **Responsive collapse**: Stacks to single column at ≤960px
- **Scrollable sidebar**: Explanation and result panels scroll independently

### Components

| Component | Purpose |
| --- | --- |
| `HeroSection` | Title, eyebrow label, subtitle |
| `CoefInput` | Labeled numeric input for a single coefficient |
| `InputPanel` | Three coefficient inputs with formula preview and presets |
| `StepNav` | Back/Next buttons + clickable 7-dot stepper |
| `AreaModelSvg` | SVG area model with 6 stages of progressive geometric reveal |
| `MiniParabola` | SVG parabola graph for the final verification step |
| `SvgFracLabel` | Composite SVG label that renders stacked fractions inline with text |
| `Frac` | HTML inline fraction with horizontal bar |
| `ExplanationPanel` | Step-specific heading, description, and math display |
| `ResultCard` | Vertex form, vertex coordinates, axis of symmetry, copy button |
| `ExportFooter` | SVG and PNG export buttons |

### Key Functions

**Math**
- `evaluateQuadratic(a, b, c, x)` — Computes ax² + bx + c
- `getDiscriminant(a, b, c)` — Returns b² − 4ac
- `getRoots(a, b, c)` — Finds real roots sorted ascending
- `getVertex(a, b, c)` — Returns vertex coordinates {x, y}
- `getCompletingSteps(a, b, c)` — Core function returning numeric values and exact fractions for all intermediate steps

**Fraction Arithmetic**
- `gcd(a, b)` — Greatest common divisor via Euclidean algorithm
- `Q(num, den)` — Creates a reduced fraction {n, d}; marks irrational if inputs are non-integer
- `fmtQ(q)` / `fmtQAbs(q)` / `fmtQSigned(q)` — JSX formatters returning stacked fractions for d > 1
- `fmtQStr(q)` / `fmtQAbsStr(q)` / `fmtQSignedStr(q)` — String formatters for clipboard

**Formatting**
- `fmtNumber(n)` — Integer or 4-decimal display
- `formatQuadratic(a, b, c)` — Builds display string like "x² + 6x + 5"
- `formatVertexForm(a, hF, kF)` — JSX vertex form with fraction support
- `formatVertexFormStr(a, hF, kF)` — String vertex form for clipboard copy

**SVG**
- `getAutoViewRange(a, b, c)` — Computes coordinate bounds for the mini parabola
- `toSvg(mathX, mathY, bounds, vp)` — Math-to-SVG coordinate transform
- `SvgFracLabel` — Renders mixed text/fraction sequences in SVG with approximate character-width positioning

**Export**
- `svgToString(svgEl, vp)` — Serializes SVG DOM to standalone XML string
- `exportSvg` / `exportPng` — Downloads graph as SVG or PNG (2× scale)
- `openMagnifiedGraph(svgEl, title)` — Opens diagram in a popup window with full CSS variables

### Browser Compatibility
- Modern browsers: Chrome, Firefox, Safari, Edge (latest versions)
- Requires: ES6+, SVG, Canvas 2D, Blob/URL, Clipboard APIs

## License

This project is free to use for educational purposes.
