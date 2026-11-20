// Panel layouts for Vice Panels.
//
// Every layout is a list of panels in normalised canvas coordinates (0..1 on
// both axes), so one layout works at 1080x1080, 1080x1350 and 1920x1080 alike.
// A panel is a polygon: the classic poster collage is a grid of rectangles cut
// by a few diagonals, so most panels are quads whose left or right edge slants.
// The renderer clips each photo to its panel's polygon and frames it with a
// cream keyline, which is what makes the collage read as one poster.
//
// Points are [x, y] pairs, clockwise from the top-left corner of the panel.

function quad(x0, y0, x1, y1, slantTop = 0, slantBottom = 0) {
  // A rectangle whose top edge starts slantTop to the right of x0 and whose
  // bottom edge starts slantBottom to the right of x0. Positive slants lean
  // the panel like the diagonal cuts on a game cover.
  return [
    [x0 + slantTop, y0],
    [x1, y0],
    [x1, y1],
    [x0 + slantBottom, y1],
  ];
}

export const LAYOUTS = [
  {
    id: 'showcase',
    name: 'Showcase',
    blurb: 'One hero panel, two stacked at its side, three along the foot.',
    panels: [
      // Hero, top-left, with a diagonal right edge.
      [[0.015, 0.015], [0.575, 0.015], [0.545, 0.615], [0.015, 0.615]],
      // Top-right and mid-right stack.
      quad(0.565, 0.015, 0.985, 0.30, 0.012, 0.03),
      quad(0.565, 0.315, 0.985, 0.615, 0.03, 0.0),
      // Foot row of three.
      quad(0.015, 0.63, 0.335, 0.985, 0.0, 0.018),
      quad(0.35, 0.63, 0.665, 0.985, 0.018, 0.018),
      quad(0.68, 0.63, 0.985, 0.985, 0.018, 0.0),
    ],
  },
  {
    id: 'grid-six',
    name: 'Grid Six',
    blurb: 'Three over three, every divider leaning the same way.',
    panels: [
      quad(0.015, 0.015, 0.328, 0.492, 0.0, 0.02),
      quad(0.343, 0.015, 0.656, 0.492, 0.02, 0.02),
      quad(0.671, 0.015, 0.985, 0.492, 0.02, 0.0),
      quad(0.015, 0.508, 0.328, 0.985, 0.02, 0.0),
      quad(0.343, 0.508, 0.656, 0.985, 0.02, 0.0),
      quad(0.671, 0.508, 0.985, 0.985, 0.02, 0.0),
    ],
  },
  {
    id: 'skyline',
    name: 'Skyline',
    blurb: 'Four tall strips under one wide banner panel.',
    panels: [
      quad(0.015, 0.015, 0.985, 0.36, 0.0, 0.0),
      quad(0.015, 0.375, 0.252, 0.985, 0.0, 0.016),
      quad(0.267, 0.375, 0.504, 0.985, 0.016, 0.016),
      quad(0.519, 0.375, 0.756, 0.985, 0.016, 0.016),
      quad(0.771, 0.375, 0.985, 0.985, 0.016, 0.0),
    ],
  },
  {
    id: 'split-diptych',
    name: 'Split Diptych',
    blurb: 'Two big halves on a diagonal, one strip across the foot.',
    panels: [
      [[0.015, 0.015], [0.56, 0.015], [0.47, 0.70], [0.015, 0.70]],
      [[0.575, 0.015], [0.985, 0.015], [0.985, 0.70], [0.485, 0.70]],
      quad(0.015, 0.715, 0.985, 0.985, 0.0, 0.0),
    ],
  },
];

// The axis-aligned box a polygon sits in; photo fitting is done against it.
export function panelBox(panel) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of panel) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Hit test in normalised coordinates, for clicking a panel in the preview.
export function panelAt(panel, nx, ny) {
  let inside = false;
  for (let i = 0, j = panel.length - 1; i < panel.length; j = i++) {
    const [xi, yi] = panel[i];
    const [xj, yj] = panel[j];
    if ((yi > ny) !== (yj > ny) && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
