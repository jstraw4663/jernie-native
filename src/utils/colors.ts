export function hexWithAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Derives a two-stop hero gradient from a stop's color.
// Blends toward Brand.navy (0D2B3E) to keep white text readable.
export function stopHeroGradient(hex: string): [string, string] {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return ['#0D2B3E', '#1E4566'];
  const sr = parseInt(hex.slice(1, 3), 16);
  const sg = parseInt(hex.slice(3, 5), 16);
  const sb = parseInt(hex.slice(5, 7), 16);
  // Brand.navy = #0D2B3E = (13, 43, 62)
  const nr = 13, ng = 43, nb = 62;
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  // Top: 65% navy — dark enough for white display text
  const top = `#${toHex(sr * 0.35 + nr * 0.65)}${toHex(sg * 0.35 + ng * 0.65)}${toHex(sb * 0.35 + nb * 0.65)}`;
  // Bottom: 30% navy — stop color comes through
  const btm = `#${toHex(sr * 0.70 + nr * 0.30)}${toHex(sg * 0.70 + ng * 0.30)}${toHex(sb * 0.70 + nb * 0.30)}`;
  return [top, btm];
}
