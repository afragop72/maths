# Maths

A collection of interactive web-based math visualization tools for exploring algebraic concepts.

## Projects

### [Quadratic Graph Studio](quadratic-equation/)

Interactive graphing of quadratic equations (`y = ax² + bx + c`) with real-time visualization, animation, and analysis.

- Adjust coefficients via sliders or text input (supports fractions)
- Real-time parabola rendering on HTML5 Canvas
- Vertex, discriminant, and root calculations
- Auto-zoom, hover crosshair, and axis of symmetry
- Export to PNG, SVG, or copy equation to clipboard
- Quick presets for common equations

**Stack:** Vanilla JavaScript, HTML5 Canvas, CSS3

### [Binomial Multiplication Visualizer](sketch-binomial-factors/)

Step-by-step visualization of binomial multiplication using the FOIL method and an area model diagram.

- Enter any two linear binomials in symbolic notation
- Animated 6-step walkthrough of the area model construction
- Color-coded quadrants showing each FOIL product
- Symbolic labels showing factor terms and numeric results
- Combine like terms into the final polynomial
- Export diagram as SVG or PNG

**Stack:** React 18, Babel standalone, SVG

## Running

Each project is a self-contained web app. Serve the repo with any local HTTP server:

```bash
npx serve .
# or
python3 -m http.server
```

Then navigate to the project directory in the browser (e.g. `http://localhost:3000/quadratic-equation/`).

## License

These projects are free to use for educational purposes.
