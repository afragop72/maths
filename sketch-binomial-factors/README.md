# Binomial Multiplication Visualizer

An interactive web application that visualizes the multiplication of two linear binomials using the FOIL method and an area model diagram, with step-by-step animation.

## Features

### Interactive Input
- **Symbolic parsing**: Enter binomials in natural notation like `(x+3)`, `(2x-5)`, `(-x+3)`
- **Flexible syntax**: Supports optional parentheses, negative coefficients, implicit `1` (e.g. `x` = `1x`)
- **Single-variable**: Works with any letter variable (`x`, `y`, `t`, etc.)
- **Constant-only terms**: Handles inputs like `(3)` or `(0x+5)`
- **Validation**: Clear error messages for malformed input or mismatched variables

### Area Model Diagram
- **SVG-based visualization**: Scalable rectangle diagram split into four FOIL quadrants
- **Color-coded regions**:
  - Blue: `ac` (variable squared term)
  - Yellow: `bc` (variable term)
  - Green: `ad` (variable term)
  - Pink: `bd` (constant term)
- **Symbolic labels**: Each sub-rectangle shows the factor terms being multiplied and their numeric product
- **Edge labels**: Side lengths display the individual binomial terms
- **Automatic scaling**: Diagram proportions adjust to coefficient magnitudes
- **Negative coefficient support**: Uses absolute values for geometry with algebraic signs preserved in labels
- **Zero coefficient handling**: Shows a note when a term collapses a dimension

### Step-by-Step Animation
Six progressive steps reveal the area model:
1. Draw the outer rectangle (total product)
2. Add partitions (split into 4 products)
3. Label side lengths (terms of each binomial)
4. Fill the 4 sub-rectangles (FOIL areas)
5. Label each area with its product
6. Combine like terms into the final polynomial

### Playback Controls
- **Play/Pause**: Auto-advance through steps at configurable speed
- **Back/Next**: Manual step-by-step navigation
- **Speed slider**: 250ms to 2000ms per step
- **Reset animation**: Return to step 1 with current binomials
- **Reset all**: Restore default binomials and settings

### Mathematical Output
- **Parsed display**: Shows the decomposed coefficients for both binomials
- **FOIL breakdown**: Individual `ac`, `ad`, `bc`, `bd` products
- **Simplified result**: Combined polynomial with proper superscript rendering

### Export
- **SVG export**: Standalone SVG file with embedded font-family for consistent rendering
- **PNG export**: 2x resolution raster image with dark background

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

### Example Inputs

| Left | Right | Result |
|------|-------|--------|
| `(x+3)` | `(2x-5)` | `2x² + x - 15` |
| `(x-7)` | `(x+2)` | `x² - 5x - 14` |
| `(-x+3)` | `(4x-1)` | `-4x² + 13x - 3` |
| `(2x)` | `(x-5)` | `2x² - 10x` |
| `(3)` | `(x+9)` | `3x + 27` |

## Technical Details

### Architecture
- **React 18**: UI components via CDN (UMD build)
- **Babel standalone**: In-browser JSX transpilation
- **SVG**: All diagram rendering via React SVG elements
- **CSS custom properties**: Theming and color tokens

### File Structure

```
sketch-binomial-factors/
├── index.html    # HTML shell, CDN script tags
├── styles.css    # All styling (layout, components, theming)
├── app.jsx       # React components and application logic
└── README.md     # This file
```

### Key Functions

**Parsing**
- `parseLinearBinomial(raw)` — Parses a string into `{ varName, a, b }` (coefficient of variable + constant)
- `trimOuterParens(s)` — Strips balanced outer parentheses

**Math**
- `computeFoil(p, q)` — Computes all four FOIL products and the simplified polynomial

**Formatting**
- `fmtLinearTerm(coef, varName)` — Formats a coefficient-variable pair (e.g. `2x`, `-x`, `0`)
- `polyToString(A, B, C, varName)` — Plain-text polynomial representation
- `PolyDisplay` — React component rendering polynomial with superscript

**Export**
- `svgToString(svgEl)` — Serializes SVG DOM to standalone XML string
- `exportPng(svgEl, filename, scale)` — Renders SVG to canvas and exports as PNG
- `downloadBlob(blob, filename)` — Triggers browser download via object URL

### Browser Compatibility
- Modern browsers: Chrome, Firefox, Safari, Edge (latest versions)
- Requires: ES6+, SVG, Canvas 2D, Blob/URL APIs

## License

This project is free to use for educational purposes.
