# Math Lab

A collection of interactive web-based math visualization tools organized by subject.

## Structure

```text
maths/
├── index.html                          # Main hub page
├── algebra/
│   ├── index.html                     # Algebra hub
│   └── quadratics/                    # Quadratics topic (4 tools)
├── geometry/                           # Coming soon
└── calculus/                           # Coming soon
```

## Subjects

### [Algebra](algebra/) — Equations, expressions, and algebraic structures

#### Quadratics

##### [Quadratic Graph Studio](algebra/quadratics/quadratic-equation/)

Interactive graphing of quadratic equations (`y = ax² + bx + c`) with real-time visualization, animation, and analysis.

- Adjust coefficients via sliders or text input (supports fractions)
- Real-time parabola rendering on HTML5 Canvas
- Vertex, discriminant, and root calculations
- Auto-zoom, hover crosshair, and axis of symmetry
- Export to PNG, SVG, or copy equation to clipboard
- Quick presets for common equations

**Stack:** Vanilla JavaScript, HTML5 Canvas, CSS3

##### [Quadratic Inequality Solver & Grapher](algebra/quadratics/quadratic-inequality/)

Solve and graph quadratic inequalities (`ax² + bx + c ⋚ 0`) with a guided visual walkthrough.

- Enter coefficients and choose inequality type, or pick from five presets
- 7-step walkthrough: discriminant, roots, parabola, sign analysis, solution
- SVG parabola graph with progressive reveal and region sign labels
- Number line with interval signs and highlighted solution segments
- Solution in interval notation, set-builder notation, and plain English
- Magnify graph in a popup window, export as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

##### [Completing the Square](algebra/quadratics/completing-the-square/)

Convert quadratics to vertex form through a geometric area model and algebraic walkthrough.

- Enter coefficients or pick from five presets
- 7-step walkthrough: factor, split, rearrange, complete, simplify, verify
- Geometric area model showing the "completing" process
- Exact fraction display with horizontal-bar notation (HTML and SVG)
- Mini parabola graph with vertex at the final step
- Copy vertex form, export diagram as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

##### [Binomial Multiplication Visualizer](algebra/quadratics/sketch-binomial-factors/)

Step-by-step visualization of binomial multiplication using the FOIL method and an area model diagram.

- Enter any two linear binomials or pick from five presets
- 6-step educational walkthrough with plain-language explanations
- Color-coded quadrants matching FOIL order (First/Outer/Inner/Last)
- Diagram labels showing factor terms and numeric products
- Combine like terms into the final polynomial
- Copy equation to clipboard, export diagram as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

## Navigation

Each app includes:

- **Breadcrumb navigation** at the top showing: Home → Subject → Topic → App
- **Hamburger menu** (fixed top-left) with full site navigation tree
- **Related tools footer** linking to sibling apps in the same topic

## Running

Each project is a self-contained web app. Serve the repo with any local HTTP server:

```bash
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:3000/` in your browser and navigate via the hub pages.

## License

These projects are free to use for educational purposes.
