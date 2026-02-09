# Quadratic Graph Studio

An interactive web application for visualizing and exploring quadratic equations with real-time graphing, animations, and comprehensive mathematical analysis.

![Quadratic Graph Studio](preview.png)

## Features

### 🎨 Interactive Visualization
- **Real-time graphing**: Instantly see parabola changes as you adjust coefficients
- **Smooth animations**: Curve transitions use cubic easing for smooth visual feedback (300ms)
- **Interactive hover**: Crosshair with tooltip shows exact coordinates on hover
- **Axis of symmetry**: Dashed vertical line through the vertex
- **Visual markers**:
  - Blue circle marks the vertex
  - Green circles mark real roots
  - Arrows on coordinate axes

### 📊 Mathematical Analysis
- **Vertex calculation**: Displays precise vertex coordinates (h, k)
- **Discriminant display**: Shows Δ = b² - 4ac with color coding:
  - 🟢 Green: Two real roots (Δ > 0)
  - 🟡 Yellow: One real root (Δ = 0)
  - 🔴 Red: No real roots (Δ < 0)
- **Root finding**: Calculates and displays all real roots
- **Table of values**: Shows 5 key points centered around the vertex

### 🎛️ Controls & Input
- **Dual input methods**:
  - Sliders for quick exploration (a: ±5, b/c: ±10)
  - Text fields for precise values (supports fractions like "3/4")
- **Coefficient badges**: Color-coded indicators show sign of each coefficient:
  - 🟢 Green for positive
  - 🔴 Red for negative
  - ⚪ Gray for zero
- **Input validation**: Invalid entries shake and highlight in orange
- **Auto-zoom toggle**: Automatically adjusts view to show complete parabola
- **Manual range**: Set custom X min/max when auto-zoom is disabled

### 🚀 Quick Presets
Load common quadratic equations instantly:
- **Simple**: y = x² (basic parabola)
- **Inverted**: y = -x² (opens downward)
- **Shifted**: y = x² - 4 (two real roots)
- **No Roots**: y = x² + 5 (no real roots)

### 💾 Export Options
- **PNG Export**: Save graph as raster image
- **SVG Export**: Save as scalable vector graphic with all markers
- **Copy Equation**: One-click copy to clipboard (shows ✓ confirmation)
- **Fullscreen View**: Open graph in larger 1300×800 popup window

### 🎨 Design Features
- **Beautiful gradient background**: Warm radial gradient (peach → cream → blue)
- **Modern UI**: Clean design with rounded corners and soft shadows
- **Responsive layout**: Adapts to different screen sizes
- **Professional typography**:
  - Space Mono for code/numbers
  - Fraunces for headings
  - Manrope for body text
- **Accessible colors**: High contrast ratios for readability

## Usage

### Getting Started
1. Open [index.html](index.html) in a modern web browser
2. The default equation y = x² loads automatically

### Adjusting the Equation
**Method 1: Using Sliders**
- Drag the sliders to adjust a, b, and c coefficients
- Changes apply instantly with smooth animation

**Method 2: Text Input**
- Click in the text fields and enter values
- Supports decimals (e.g., "1.5") and fractions (e.g., "3/4")
- Press Enter or click elsewhere to apply

**Coefficient Badges**: Watch the colored badges next to each label update to show the sign

### Viewing Options

**Auto Zoom (Default: ON)**
- Automatically calculates optimal viewing range
- Ensures entire parabola is visible
- Centers view on vertex and roots
- X min/max fields update to show current range

**Manual Range (Auto Zoom OFF)**
- Set your own X min and X max values
- Useful for comparing multiple equations
- Y range adjusts to maintain aspect ratio

### Exploring the Graph
- **Hover** over the canvas to see coordinates
- Watch the **crosshair** follow your cursor
- See the **exact y-value** on the curve at each x-position
- Observe **vertex marker** (blue) and **root markers** (green)
- Notice the **dashed symmetry line** through the vertex

### Using Presets
Click any preset button to instantly load a common equation:
- Explore different parabola shapes
- See how discriminant affects roots
- Compare upward vs downward opening

### Exporting Your Work

**PNG Image**
1. Click "Export PNG"
2. File downloads as `quadratic-graph.png`
3. Includes all visual elements

**SVG Vector**
1. Click "Export SVG"
2. File downloads as `quadratic-graph.svg`
3. Scalable and editable in vector software

**Copy Equation**
1. Click the 📋 button next to "Equation"
2. Equation copies to clipboard in format: `y = x² + 2x - 3`
3. Button briefly shows ✓ to confirm

**Fullscreen View**
1. Click the ⛶ button in the Graph header
2. Opens 1400×900 popup window
3. Shows larger 1300×800 graph
4. Displays vertex, discriminant, and roots below

## Technical Details

### Architecture
- **Pure vanilla JavaScript**: No frameworks or dependencies
- **HTML5 Canvas**: Hardware-accelerated 2D graphics
- **Modern CSS**: Custom properties, grid, flexbox
- **Responsive design**: Works on desktop and tablet

### Key Algorithms

**Vertex Calculation**
```
h = -b / (2a)
k = f(h) = ah² + bh + c
```

**Discriminant & Roots**
```
Δ = b² - 4ac

If Δ > 0: Two real roots
  x = (-b ± √Δ) / (2a)
If Δ = 0: One real root
  x = -b / (2a)
If Δ < 0: No real roots
```

**Auto-Zoom Logic**
1. Calculate X range based on roots and vertex
2. Sample Y values across X range (180 steps)
3. Add 15% padding to Y range
4. Ensure x-axis visible if close to data

**Animation System**
- Uses `requestAnimationFrame` for smooth 60fps
- Cubic easing function: `1 - (1 - t)³`
- Linear interpolation between coefficient states
- 300ms duration for each transition

### Browser Compatibility
- **Modern browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Required features**:
  - HTML5 Canvas with 2D context
  - CSS Grid and Flexbox
  - ES6+ JavaScript (const, let, arrow functions, template literals)
  - Clipboard API for copy functionality
  - Window.open for fullscreen feature

### Performance
- **Canvas size**: 980×620 (main), 1300×800 (fullscreen)
- **Curve resolution**: 180 steps for smooth rendering
- **Efficient rendering**: Only redraws on change or hover
- **No external resources**: Everything loads instantly

## File Structure

```
quadratic-equation/
├── index.html          # Main HTML structure
├── styles.css          # Complete styling and responsive design
├── app.js              # All JavaScript logic and math
└── README.md          # This file
```

## Code Architecture

### Constants and Configuration
- **Visual constants**: Colors, padding, curve resolution
- **Default state**: Initial coefficient values
- **Presets**: Predefined equation configurations

### Core Functions

**Mathematical Functions**
- `evaluateQuadratic(a, b, c, x)` - Compute y for given x
- `getVertex(a, b, c)` - Calculate vertex coordinates
- `getRoots(a, b, c)` - Find all real roots
- `parseFraction(raw)` - Parse decimal or fractional input

**Coordinate Transformation**
- `toScreen(x, y, bounds)` - Math coords → Canvas pixels
- `toMath(screenX, screenY, bounds)` - Canvas pixels → Math coords

**Bounds Calculation**
- `getAutoXRange(a, b, c)` - Calculate optimal X range
- `sampleYRange(a, b, c, xMin, xMax)` - Find Y min/max
- `getAutoBounds(a, b, c, xMin, xMax)` - Full auto-zoom bounds
- `getManualBounds(a, b, c, xMin, xMax)` - Manual mode bounds

**Rendering Functions**
- `drawGrid(bounds)` - Grid lines, axes, arrows, labels
- `drawAxisOfSymmetry(a, b, c, bounds)` - Dashed vertical line
- `drawCurve(a, b, c, bounds)` - Main parabola with shadow
- `drawVertexMarker(a, b, c, bounds)` - Blue vertex dot + label
- `drawRootMarkers(a, b, c, bounds)` - Green root dots + labels
- `drawCrosshair()` - Interactive hover crosshair + tooltip

**Animation System**
- `easeOutCubic(t)` - Easing function for smooth motion
- `lerp(start, end, t)` - Linear interpolation
- `animate(timestamp)` - Main animation loop
- `render()` - Orchestrates full render with animation

**UI Updates**
- `updateEquation()` - Format and display equation with fractions
- `updateStats(a, b, c)` - Update vertex, discriminant, roots
- `updateTable(a, b, c)` - Populate table of values
- `updateBadge(badge, value)` - Set coefficient badge color/sign

**Export Functions**
- `exportPng()` - Convert canvas to PNG dataURL
- `exportSvg()` - Generate SVG markup with all elements
- `copyEquation()` - Copy equation text to clipboard
- `openFullscreenGraph()` - Create popup with larger graph

### State Management

**Animation State**
```javascript
{
  isAnimating: boolean,
  startTime: timestamp,
  duration: 300ms,
  startCoeffs: {a, b, c},
  targetCoeffs: {a, b, c},
  animationFrame: requestID
}
```

**Hover State**
```javascript
{
  isHovering: boolean,
  canvasX: pixel x,
  canvasY: pixel y,
  mathX: math x coordinate,
  mathY: math y coordinate,
  bounds: current bounds object,
  coefficients: {a, b, c}
}
```

## Customization

### Changing Colors
Edit the CSS custom properties in [styles.css](styles.css:2):
```css
:root {
  --ink: #0b0d17;           /* Text color */
  --sky: #f7f3ea;           /* Light background */
  --accent: #ff6b3d;        /* Primary accent (curve, buttons) */
  --accent-dark: #d24720;   /* Darker accent */
  --slate: #202532;         /* Dark elements */
  --panel: #ffffff;         /* Panel background */
}
```

Edit the JavaScript constants in [app.js](app.js:56):
```javascript
const axisColor = "#1f2433";        // Axes color
const curveColor = "#ff6b3d";       // Main curve
const vertexColor = "#3b82f6";      // Vertex marker
const rootColor = "#10b981";        // Root markers
const symmetryLineColor = "rgba(59, 130, 246, 0.3)";  // Symmetry line
```

### Adjusting Canvas Size
Change canvas dimensions in [index.html](index.html:117):
```html
<canvas id="graph" width="980" height="620"></canvas>
```
Note: Update padding constant in app.js if changing size significantly.

### Modifying Slider Ranges
Edit input ranges in [index.html](index.html:36):
```html
<input type="range" min="-5" max="5" step="0.1" id="slider-a" value="1" />
```

### Adding New Presets
Add to presets object in [app.js](app.js:48):
```javascript
const presets = {
  simple: { a: 1, b: 0, c: 0 },
  myPreset: { a: 2, b: -3, c: 1 },
  // ... add more
};
```

Add button in [index.html](index.html:67):
```html
<button type="button" class="preset-btn" data-preset="myPreset">My Preset</button>
```

## Known Limitations

- **Small 'a' values**: When |a| < 0.01, parabola may appear nearly linear
- **Large coefficient values**: Extreme values may cause visual clipping
- **Irrational roots**: Displayed with 2 decimal precision (e.g., √2 ≈ 1.41)
- **Browser popup blockers**: Fullscreen feature requires popup permission
- **Clipboard API**: Copy feature requires HTTPS or localhost in some browsers

## Future Enhancements

- [ ] Multiple curve comparison mode
- [ ] Show factored form: y = a(x - r₁)(x - r₂)
- [ ] Show vertex form: y = a(x - h)² + k
- [ ] Touch gestures for mobile (pinch zoom, pan)
- [ ] CSV export for table data
- [ ] History/undo for coefficient changes
- [ ] URL sharing with equation parameters
- [ ] Derivative curve overlay (dy/dx = 2ax + b)
- [ ] Area calculation between curve and x-axis
- [ ] Animation presets (morph between equations)
- [ ] Dark mode toggle

## Contributing

This is a personal educational project. Feel free to fork and modify for your own use.

## License

This project is free to use for educational purposes.

## Credits

Developed as a learning tool for exploring quadratic functions and parabola properties.

**Technologies Used:**
- HTML5 Canvas API
- Vanilla JavaScript (ES6+)
- CSS3 with Grid and Flexbox
- Google Fonts: Space Mono, Fraunces, Manrope

**Mathematical References:**
- Quadratic formula and discriminant
- Vertex form derivation
- Parabola properties and symmetry

---

**Enjoy exploring quadratic equations! 📊**
