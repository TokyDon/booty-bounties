import type { MapCell, Port, Island, HexCoord } from '@booty-bounties/shared';
import { CellType } from '@booty-bounties/shared';
import { v4 as uuid } from 'uuid';

function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function hexesInRange(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export interface GeneratedMap {
  cells: Record<string, MapCell>;
  ports: Record<string, Port>;
  islands: Record<string, Island>;
}

export class HexMapGenerator {
  generate(playerCount: number): GeneratedMap {
    const radius = Math.max(8, 5 + playerCount * 2);
    const cells: Record<string, MapCell> = {};
    const ports: Record<string, Port> = {};
    const islands: Record<string, Island> = {};

    // 1. Fill ocean
    hexesInRange({ q: 0, r: 0 }, radius).forEach((coord) => {
      const key = hexKey(coord);
      cells[key] = { coord, type: CellType.Ocean, loot: null };
    });

    // 2. Place islands (blobs)
    const islandCount = Math.floor(radius * 1.2);
    for (let i = 0; i < islandCount; i++) {
      const center = this.randomHex(radius - 2);
      const size = 1 + Math.floor(Math.random() * 3);
      const id = uuid();
      hexesInRange(center, size).forEach((coord) => {
        const key = hexKey(coord);
        if (cells[key] && hexDistance({ q: 0, r: 0 }, coord) < radius) {
          cells[key].type = CellType.Island;
          cells[key].islandId = id;
        }
      });
      islands[id] = { id, centreCoord: center };
    }

    // 3. Place ports
    const portCount = Math.max(2, playerCount);
    const portAngles: number[] = [];
    for (let i = 0; i < portCount; i++) {
      portAngles.push((2 * Math.PI * i) / portCount);
    }

    portAngles.forEach((angle) => {
      const dist = radius - 3;
      const q = Math.round(dist * Math.cos(angle));
      const r = Math.round(dist * Math.sin(angle) / Math.sqrt(3) * 2);
      const portCoord: HexCoord = { q, r };
      // Ensure port is ocean, clear nearby cells
      hexesInRange(portCoord, 1).forEach((coord) => {
        const key = hexKey(coord);
        if (cells[key]) {
          cells[key].type = CellType.Ocean;
          delete cells[key].islandId;
        }
      });

      const key = hexKey(portCoord);
      if (cells[key]) {
        cells[key].type = CellType.Port;
        const portId = uuid();
        cells[key].portId = portId;
        ports[portId] = {
          id: portId,
          coord: portCoord,
          name: `Port ${Object.keys(ports).length + 1}`,
          dockedPlayerIds: [],
          maxDocked: 2,
        };
      }
    });

    // 4. Seed initial loot drops
    const lootCount = Math.floor(playerCount * 3);
    const oceanCells = Object.values(cells).filter((c) => c.type === CellType.Ocean);
    for (let i = 0; i < lootCount; i++) {
      const cell = oceanCells[Math.floor(Math.random() * oceanCells.length)];
      if (cell) {
        cell.loot = {
          doubloons: Math.floor(Math.random() * 5) + 1,
          ammo: Math.random() > 0.5 ? 5 : 0,
          upgrades: [],
        };
      }
    }

    return { cells, ports, islands };
  }

  private randomHex(maxRadius: number): HexCoord {
    const q = Math.floor(Math.random() * (maxRadius * 2 + 1)) - maxRadius;
    const rMin = Math.max(-maxRadius, -q - maxRadius);
    const rMax = Math.min(maxRadius, -q + maxRadius);
    const r = rMin + Math.floor(Math.random() * (rMax - rMin + 1));
    return { q, r };
  }
}
