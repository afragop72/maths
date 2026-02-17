# Binomial Multiplication Visualizer

An interactive web application that visualizes the multiplication of two linear binomials using the FOIL method and an area model diagram, with step-by-step educational walkthrough.

## Features

### Interactive Input
- **Symbolic parsing**: Enter binomials in natural notation like `(x+3)`, `(2x-5)`, `(-x+3)`
- **Flexible syntax**: Supports optional parentheses, negative coefficients, implicit `1` (e.g. `x` = `1x`)
- **Single-variable**: Works with any letter variable (`x`, `y`, `t`, etc.)
- **Constant-only terms**: Handles inputs like `(3)` or `(0x+5)`
- **Preset examples**: Five built-in examples for quick exploration
- **Validation**: Clear error messages for malformed input or mismatched variables

### Area Model Diagram
- **SVG-based visualization**: Scalable rectangle diagram split into four FOIL quadrants
- **Color-coded regions** (matching FOIL order):
  - Blue: First — `ac` (variable squared term)
  - Amber: Outer — `ad` (variable term)
  - Green: Inner — `bc` (variable term)
  - Purple: Last — `bd` (constant term)
- **Symbolic labels**: Each sub-rectangle shows the factor terms being multiplied and their numeric product
- **Edge labels**: Side lengths display the individual binomial terms
- **Automatic scaling**: Diagram proportions adjust to coefficient magnitudes
- **Negative coefficient support**: Uses absolute values for geometry with algebraic signs preserved in labels
- **Zero coefficient handling**: Shows a note when a term collapses a dimension

### Step-by-Step Walkthrough

Six progressive steps reveal the area model with educational explanations:

1. **The Whole Product** — Draw the outer rectangle representing the total product
2. **Split into Four Parts** — Add partitions to create the four FOIL sub-rectangles
3. **Label the Sides** — Show the individual binomial terms along each edge
4. **Fill the Four Areas (FOIL)** — Color-code each quadrant with its product
5. **Read the Products** — Label each area and identify like terms
6. **Combine Like Terms** — Simplify into the final polynomial

### Navigation

- **Back/Next buttons**: Manual step-by-step navigation
- **Clickable dot stepper**: Jump to any step directly
- **Fade transitions**: Smooth animation between explanation panels

### Educational Panel

- **Step-specific explanations**: Plain-language description of what each step shows
- **Color-coded FOIL math**: Each product line colored to match its diagram quadrant (steps 4–6)
- **FOIL legend**: Color key linking First/Outer/Inner/Last to diagram regions (steps 4–5)
- **Like-term highlighting**: Visual emphasis on Outer + Inner combination (steps 5–6)

### Result & Export

- **Full equation display**: Shows `(bin1) × (bin2) = result` at the final step
- **Copy to clipboard**: One-click copy of the equation for pasting into homework
- **SVG export**: Standalone SVG file with embedded font-family for consistent rendering
- **PNG export**: 2× resolution raster image with warm background

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

| Left | Right | Result |
|------|-------|--------|
| `(x+3)` | `(x+2)` | `x² + 5x + 6` |
| `(x-7)` | `(x+2)` | `x² - 5x - 14` |
| `(2x-5)` | `(x+3)` | `2x² + x - 15` |
| `(-x+3)` | `(4x-1)` | `-4x² + 13x - 3` |
| `(2x)` | `(x-5)` | `2x² - 10x` |

## Technical Details

### Architecture
- **React 18**: UI components via CDN (UMD build)
- **Babel standalone**: In-browser JSX transpilation
- **SVG**: All diagram rendering via React SVG elements
- **CSS custom properties**: Theming and color tokens
- **Google Fonts**: Fraunces (serif headings), Manrope (sans body), Space Mono (monospace math)

### File Structure

```
sketch-binomial-factors/
├── index.html    # HTML shell, CDN script tags, Google Fonts
├── styles.css    # Design system (warm light theme, responsive)
├── app.jsx       # React components and application logic
└── README.md     # This file
```

### Components

| Component | Purpose |
| --- | --- |
| `HeroSection` | Title, eyebrow label, subtitle |
| `InputBar` | Two text inputs with × separator + preset buttons |
| `StepNav` | Back/Next buttons + clickable dot stepper |
| `ExplanationPanel` | Step-specific heading, description, color-coded math, FOIL legend |
| `ResultCard` | Full equation display + copy button |
| `ExportFooter` | SVG and PNG export buttons |
| `AreaModelSvg` | SVG area model diagram with animated reveal |
| `PolyDisplay` | Polynomial rendering with superscript |

### Key Functions

**Parsing**
- `parseLinearBinomial(raw)` — Parses a string into `{ varName, a, b }` (coefficient of variable + constant)
- `trimOuterParens(s)` — Strips balanced outer parentheses

**Math**
- `computeFoil(p, q)` — Computes all four FOIL products and the simplified polynomial

**Formatting**
- `fmtLinearTerm(coef, varName)` — Formats a coefficient-variable pair (e.g. `2x`, `-x`, `0`)
- `polyToString(A, B, C, varName)` — Plain-text polynomial representation
- `getStepContent(step, model)` — Returns educational content for each step

**Export**
- `svgToString(svgEl)` — Serializes SVG DOM to standalone XML string
- `exportPng(svgEl, filename, scale)` — Renders SVG to canvas and exports as PNG
- `downloadBlob(blob, filename)` — Triggers browser download via object URL

### Browser Compatibility
- Modern browsers: Chrome, Firefox, Safari, Edge (latest versions)
- Requires: ES6+, SVG, Canvas 2D, Blob/URL, Clipboard APIs

## License

This project is free to use for educational purposes.
