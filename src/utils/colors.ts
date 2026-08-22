export function hexWithAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derives a two-stop hero gradient from a stop's colour.
//
// Blends toward #14201B — the opaque form of `--scrim-bottom` — so a coloured hero sits in
// the same dark family as the photo scrims that are replacing it. Session 4 makes the hero a
// photograph with `Scrim.top/mid/bottom`, at which point this function has no callers left.
const SCRIM_BASE = { r: 20, g: 32, b: 27 };

export function stopHeroGradient(hex: string): [string, string] {
  const { r: nr, g: ng, b: nb } = SCRIM_BASE;
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const blend = (sr: number, sg: number, sb: number, w: number) =>
    `#${toHex(sr * (1 - w) + nr * w)}${toHex(sg * (1 - w) + ng * w)}${toHex(sb * (1 - w) + nb * w)}`;

  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return [blend(nr, ng, nb, 0), blend(58, 82, 72, 0)];
  const sr = parseInt(hex.slice(1, 3), 16);
  const sg = parseInt(hex.slice(3, 5), 16);
  const sb = parseInt(hex.slice(5, 7), 16);
  // Top 65% scrim — dark enough for white display text; bottom 30% lets the stop colour through.
  return [blend(sr, sg, sb, 0.65), blend(sr, sg, sb, 0.30)];
}
