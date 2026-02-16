# Maths

A collection of interactive web-based math visualization tools for exploring algebraic concepts.

## Projects

### Quadratics — [`quadratics/`](quadratics/)

#### [Quadratic Graph Studio](quadratics/quadratic-equation/)

Interactive graphing of quadratic equations (`y = ax² + bx + c`) with real-time visualization, animation, and analysis.

- Adjust coefficients via sliders or text input (supports fractions)
- Real-time parabola rendering on HTML5 Canvas
- Vertex, discriminant, and root calculations
- Auto-zoom, hover crosshair, and axis of symmetry
- Export to PNG, SVG, or copy equation to clipboard
- Quick presets for common equations

**Stack:** Vanilla JavaScript, HTML5 Canvas, CSS3

#### [Quadratic Inequality Solver & Grapher](quadratics/quadratic-inequality/)

Solve and graph quadratic inequalities (`ax² + bx + c ⋚ 0`) with a guided visual walkthrough.

- Enter coefficients and choose inequality type, or pick from five presets
- 7-step walkthrough: discriminant, roots, parabola, sign analysis, solution
- SVG parabola graph with progressive reveal and region sign labels
- Number line with interval signs and highlighted solution segments
- Solution in interval notation, set-builder notation, and plain English
- Magnify graph in a popup window, export as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

#### [Completing the Square](quadratics/completing-the-square/)

Convert quadratics to vertex form through a geometric area model and algebraic walkthrough.

- Enter coefficients or pick from five presets
- 7-step walkthrough: factor, split, rearrange, complete, simplify, verify
- Geometric area model showing the "completing" process
- Exact fraction display with horizontal-bar notation (HTML and SVG)
- Mini parabola graph with vertex at the final step
- Copy vertex form, export diagram as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

#### [Binomial Multiplication Visualizer](quadratics/sketch-binomial-factors/)

Step-by-step visualization of binomial multiplication using the FOIL method and an area model diagram.

- Enter any two linear binomials or pick from five presets
- 6-step educational walkthrough with plain-language explanations
- Color-coded quadrants matching FOIL order (First/Outer/Inner/Last)
- Diagram labels showing factor terms and numeric products
- Combine like terms into the final polynomial
- Copy equation to clipboard, export diagram as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

## Running

Each project is a self-contained web app. Serve the repo with any local HTTP server:

```bash
npx serve .
# or
python3 -m http.server
```

Then navigate to the project directory in the browser (e.g. `http://localhost:3000/quadratics/quadratic-equation/`).

## License

These projects are free to use for educational purposes.
