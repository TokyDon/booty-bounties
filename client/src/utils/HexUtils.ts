import type { HexCoord } from '@booty-bounties/shared';

// Hex size (flat-top orientation)
export const HEX_SIZE = 40;

// Convert axial hex coords to pixel position (flat-top)
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2) * q;
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

// Convert pixel position to axial hex coords
export function pixelToHex(px: number, py: number): HexCoord {
  const q = ((2 / 3) * px) / HEX_SIZE;
  const r = ((-1 / 3) * px + (Math.sqrt(3) / 3) * py) / HEX_SIZE;
  return hexRound(q, r);
}

// Round fractional axial coords to nearest hex
export function hexRound(q: number, r: number): HexCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

// Get all 6 neighbours of a hex
export function hexNeighbors(coord: HexCoord): HexCoord[] {
  const dirs = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  return dirs.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

// Hex distance
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// All hexes within a given radius
export function hexesInRange(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

// Hex key for use in maps
export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

// Parse hex key back to coord
export function keyToHex(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

// Line of sight: get all hexes on a line between two hexes
export function hexLine(a: HexCoord, b: HexCoord): HexCoord[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const results: HexCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    results.push(hexRound(
      a.q + (b.q - a.q) * t,
      a.r + (b.r - a.r) * t,
    ));
  }
  return results;
}

// Draw a flat-top hexagon on a graphics object, centered at (cx, cy)
export function drawFlatHex(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  fillColor: number,
  fillAlpha = 1,
  strokeColor?: number,
  strokeWidth = 1,
): void {
  const points: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(new Phaser.Geom.Point(
      cx + size * Math.cos(angle),
      cy + size * Math.sin(angle),
    ));
  }
  gfx.fillStyle(fillColor, fillAlpha);
  gfx.fillPoints(points, true);
  if (strokeColor !== undefined) {
    gfx.lineStyle(strokeWidth, strokeColor, fillAlpha);
    gfx.strokePoints(points, true);
  }
}
