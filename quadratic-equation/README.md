# Quadratic Equation Graph Studio

A lightweight HTML/JS app to visualize quadratic equations, explore roots/vertex, and export graphs.

## Usage

1. Open `index.html` in a browser.
2. Adjust the sliders or numeric inputs for `a`, `b`, and `c`.
3. Set `X min` and `X max` to control the graph window.
4. Use **Export PNG** or **Export SVG** to save the graph.
5. Review the table-of-values for sampled points.

## Notes

- If `a = 0`, the equation becomes linear. The app still renders the line and updates roots.
- If `X min` > `X max`, the values are automatically swapped.

## Future Feature Ideas

- Add grid scaling controls and labeled axis ticks.
- Show factored/vertex form alongside standard form.
- Add multiple curves and color toggles for comparison.
- Allow table export as CSV.
- Add function presets and history.
