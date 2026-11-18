// The app icon's source: the owner's first drawing, with the values he
// chose for it afterwards (D198, D203).
//
// `docs/wp3/prompts/aufraeumen-icon/icon-full.svg` is his drawing as he
// sent it, byte for byte, and stays what it is. After the release he asked
// for the icon "a little better by its data — a top impression, the same
// fingerprint", with a picture as the target, and chose the second of two
// proposals (D203): the star larger and sharper, its line a little
// stronger, the sheen clearer, the colours deeper. Nothing is redrawn:
// every change is a number of his own SVG, named below, and
// `tuneIcon()` applies them — each to exactly one place, or it throws, so a
// drawing that has changed under it is noticed and not half tuned.
//
// `tools/render-icons.mjs` writes the result as `public/icon-full.svg` and
// makes every other icon file from that. `tools/render-icons.test.mjs`
// holds that the file is what this module makes of the first drawing.

/** The star as the first drawing has it. */
export const FIRST_STAR =
  'M512 300C524.7 408.1 615.9 499.3 724 512C615.9 524.7 524.7 615.9 512 724C499.3 615.9 408.1 524.7 300 512C408.1 499.3 499.3 408.1 512 300Z';

/** Coordinates as the drawing writes them: one decimal, no trailing nought. */
const number = (value) => {
  const text = value.toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
};

/**
 * A four-pointed star round the middle of the 1024 square: its tips `reach`
 * from the centre, each side one curve whose two control points lie
 * `reach × along` beside the axis and `reach × inward` along it. A smaller
 * `inward` draws the sides deeper and the tips sharper.
 */
export function starPath({ reach, along, inward }) {
  const centre = 512;
  const point = (x, y) => `${number(centre + x)} ${number(centre + y)}`;
  const a = reach * along;
  const b = reach * inward;
  return (
    `M${point(0, -reach)}` +
    `C${point(a, -b)} ${point(b, -a)} ${point(reach, 0)}` +
    `C${point(b, a)} ${point(a, b)} ${point(0, reach)}` +
    `C${point(-a, b)} ${point(-b, a)} ${point(-reach, 0)}` +
    `C${point(-b, -a)} ${point(-a, -b)} ${point(0, -reach)}Z`
  );
}

/** The first drawing's star in those terms: `starPath(FIRST)` is `FIRST_STAR`, to the character. */
export const FIRST = { reach: 212, along: 12.7 / 212, inward: 103.9 / 212 };

/**
 * The values of D203, beside the first drawing's:
 *
 *   the star's reach            212  → 264   a quarter larger
 *   its sides                   0.49 → 0.44  deeper, so the tips are sharper
 *   its line                    30   → 38
 *   the two glows behind it     56, 36 → 71, 46 (with the line); a little fainter
 *   the sheen, top left         0.16 … 0.03 → 0.25 … 0.06
 *   the sheen's edge            0.2  → 0.4
 *   the light, top left         0.5  → 0.58
 *   the light, bottom left      0.42 → 0.5
 *   the depth, bottom right     0.4  → 0.47
 */
export const TUNED = {
  star: { reach: 264, along: 0.05, inward: 0.44 },
  line: 38,
  glowWide: { width: 71, opacity: 0.42 },
  glow: { width: 46, opacity: 0.62 },
  sheen: [0.25, 0.06],
  edge: 0.4,
  lightTopLeft: 0.58,
  lightBottomLeft: 0.5,
  depth: 0.47,
};

/** Replaces exactly `count` occurrences, or says what the drawing no longer holds. */
function replace(text, find, put, count = 1) {
  const parts = text.split(find);
  if (parts.length - 1 !== count) {
    throw new Error(`icon-source: expected ${count} × «${find.slice(0, 56)}…» in the drawing, found ${parts.length - 1}`);
  }
  return parts.join(put);
}

/** The icon's source, made of the owner's first drawing and the values of D203. */
export function tuneIcon(drawing, tuned = TUNED) {
  let svg = drawing;
  // The star stands three times: the wide glow, the glow, the line.
  svg = replace(svg, FIRST_STAR, starPath(tuned.star), 3);
  svg = replace(svg, '<g filter="url(#glowWide)" opacity="0.55">', `<g filter="url(#glowWide)" opacity="${tuned.glowWide.opacity}">`);
  svg = replace(svg, 'stroke="#f1e6ff" stroke-width="56"', `stroke="#f1e6ff" stroke-width="${tuned.glowWide.width}"`);
  svg = replace(svg, '<g filter="url(#glow)" opacity="0.75">', `<g filter="url(#glow)" opacity="${tuned.glow.opacity}">`);
  svg = replace(svg, 'stroke="#ffffff" stroke-width="36"', `stroke="#ffffff" stroke-width="${tuned.glow.width}"`);
  svg = replace(svg, 'stroke="url(#line)" stroke-width="30"', `stroke="url(#line)" stroke-width="${tuned.line}"`);
  svg = replace(
    svg,
    '<stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/>',
    `<stop offset="0" stop-color="#fff" stop-opacity="${tuned.sheen[0]}"/><stop offset="1" stop-color="#fff" stop-opacity="${tuned.sheen[1]}"/>`,
  );
  svg = replace(svg, '<stop offset="0.45" stop-color="#fff" stop-opacity="0.2"/>', `<stop offset="0.45" stop-color="#fff" stop-opacity="${tuned.edge}"/>`);
  svg = replace(svg, '<stop offset="0" stop-color="#f7dcff" stop-opacity="0.5"/>', `<stop offset="0" stop-color="#f7dcff" stop-opacity="${tuned.lightTopLeft}"/>`);
  svg = replace(svg, '<stop offset="0" stop-color="#9fbcfb" stop-opacity="0.42"/>', `<stop offset="0" stop-color="#9fbcfb" stop-opacity="${tuned.lightBottomLeft}"/>`);
  svg = replace(svg, '<stop offset="0" stop-color="#26208a" stop-opacity="0.4"/>', `<stop offset="0" stop-color="#26208a" stop-opacity="${tuned.depth}"/>`);
  return svg;
}
