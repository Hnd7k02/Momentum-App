/**
 * The picture of the 3D body as numbers (contract §7, §8).
 *
 * `farbregeln.mjs` holds the colour rules on these numbers, and the pictures
 * of the block "Kurve" are measured the same way, so that a ΔE in a design
 * and the ΔE the suite asks for are one measure.
 *
 * A zone is the middle sixth of the picture's width — the trunk and the
 * legs, without the shoulders, arms and hands beside them — and a band of
 * its height. From the front the four bands are the chest, the quadriceps,
 * the calves and the feet; from the back the upper back, the hamstrings,
 * the calves and the heels. The feet are the inert zone (D166): no state
 * ever reaches them.
 */
export const ZONES = { upper: [0.26, 0.36], thigh: [0.5, 0.68], calf: [0.72, 0.84], foot: [0.86, 0.9] };
export const ZONE_X = [0.42, 0.58];
/**
 * The card behind the body, as a lightness. The Gym card reads L* 10; the
 * darkest tone of the body, an untrained muscle in its own shadow, stays
 * above 23 under the light of D165 — which has no tone mapping, so a held
 * muscle is no longer one flat white and an untrained one no longer one
 * flat grey. What a tone *is* is therefore read as the median of a zone,
 * never as a share of pixels above a fixed lightness.
 */
export const CARD = 20;

/**
 * Every pixel that is neither the dark card nor under the view buttons is
 * the body; over the whole figure it is counted as green or red by its a*.
 * Each zone reports its tone — the median L*, a* and b* of its lit pixels.
 * With a second picture from the same angle, each zone also reports how the
 * lit pixels of the two differ: the share that moved by more than 3 ΔE, and
 * the median — over **all** lit pixels of the zone, moved or not — of the
 * difference and of its three parts: lightness (dL), green–red (dA) and
 * blue–yellow (dB). Read from the PNG that was saved, so what is measured is
 * what is shown. `page` only decodes the pictures; `controls` is where the
 * view buttons stand, as shares of the frame, or `null`.
 */
export const readBody = (page, png, controls, against = null) =>
  page.evaluate(async ({ png, against, zones, zoneX, card, controls }) => {
    const load = async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height };
    };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const lab = (r, g, b) => {
      const R = lin(r), G = lin(g), B = lin(b);
      const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
      const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
      const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    };
    const median = (values) => { const s = [...values].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const round = (v) => (v === null ? null : Math.round(v * 10) / 10);

    const a = await load(png);
    // The view buttons stand over the top of the stage and are not the body.
    const under = (x, y) => controls !== null
      && x >= controls[0] * a.w && x <= controls[2] * a.w && y >= controls[1] * a.h && y <= controls[3] * a.h;
    const count = { body: 0, green: 0, red: 0 };
    let lightness = 0;
    for (let y = 0; y < a.h; y += 2) {
      for (let x = 0; x < a.w; x += 2) {
        if (under(x, y)) continue;
        const i = (y * a.w + x) * 4;
        const [L, A] = lab(a.data[i], a.data[i + 1], a.data[i + 2]);
        if (L < card) continue; // the card behind the body
        count.body += 1;
        lightness += L;
        if (A < -5) count.green += 1;
        else if (A > 5) count.red += 1;
      }
    }
    const share = (n, of) => Math.round((n / Math.max(1, of)) * 1000) / 1000;
    const b = against ? await load(against) : null;
    const sameFrame = b === null ? null : b.w === a.w && b.h === a.h;
    const result = {
      body: count.body, green: share(count.green, count.body), red: share(count.red, count.body),
      lightness: round(lightness / Math.max(1, count.body)),
      ...(sameFrame === null ? {} : { sameFrame }),
    };
    for (const [name, [from, to]] of Object.entries(zones)) {
      const L = [], A = [], B = [];
      const dE = [], dL = [], dA = [], dB = [];
      let moved = 0;
      for (let y = Math.round(a.h * from); y < Math.round(a.h * to); y += 2) {
        for (let x = Math.round(a.w * zoneX[0]); x < Math.round(a.w * zoneX[1]); x += 2) {
          const i = (y * a.w + x) * 4;
          const p = lab(a.data[i], a.data[i + 1], a.data[i + 2]);
          if (p[0] < card) continue;
          L.push(p[0]); A.push(p[1]); B.push(p[2]);
          if (!sameFrame) continue;
          const q = lab(b.data[i], b.data[i + 1], b.data[i + 2]);
          if (q[0] < card) continue; // lit body in both pictures
          const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          dE.push(d); dL.push(p[0] - q[0]); dA.push(p[1] - q[1]); dB.push(p[2] - q[2]);
          if (d > 3) moved += 1;
        }
      }
      result[name] = {
        lit: L.length, L: round(median(L)), a: round(median(A)), b: round(median(B)),
        ...(sameFrame ? { pixels: dE.length, moved: share(moved, dE.length), dE: round(median(dE)), dL: round(median(dL)), dA: round(median(dA)), dB: round(median(dB)) } : {}),
      };
    }
    return result;
  }, { png: png.toString('base64'), against: against ? against.toString('base64') : null, zones: ZONES, zoneX: ZONE_X, card: CARD, controls });

/**
 * A picture of `locator` once it stands still: the tints ease in and a turn
 * coasts, and the viewer has no "settled" signal, so the frame is taken
 * until two in a row are the same picture. Returns the frame and whether it
 * was still.
 */
export async function stillPicture(page, locator, { attempts = 20, gap = 350 } = {}) {
  const box = await locator.boundingBox();
  if (!box) return { frame: null, still: false, box: null };
  let previous = null;
  let frame = null;
  let still = false;
  for (let attempt = 0; attempt < attempts && !still; attempt += 1) {
    frame = await page.screenshot({ clip: box });
    still = previous !== null && frame.equals(previous);
    previous = frame;
    if (!still) await page.waitForTimeout(gap);
  }
  return { frame, still, box };
}
