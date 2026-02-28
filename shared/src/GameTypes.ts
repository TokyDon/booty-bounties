// ─── Hex Coordinates ─────────────────────────────────────────────────────────
export interface HexCoord {
  q: number;
  r: number;
}

// ─── Upgrade System ──────────────────────────────────────────────────────────
export enum UpgradeRarity {
  Wood = 'wood',
  Steel = 'steel',
  Iron = 'iron',
  Bronze = 'bronze',
  Gold = 'gold',
}

export enum UpgradeType {
  Hull = 'hull',       // Max health
  Cannons = 'cannons', // Damage & range
  Sails = 'sails',     // Movement & AP
  Binoculars = 'binoculars', // Visibility / fog of war range
}

export interface ShipUpgrade {
  id: string;
  type: UpgradeType;
  rarity: UpgradeRarity;
}

// Rarity order for comparisons
export const RARITY_ORDER: UpgradeRarity[] = [
  UpgradeRarity.Wood,
  UpgradeRarity.Steel,
  UpgradeRarity.Iron,
  UpgradeRarity.Bronze,
  UpgradeRarity.Gold,
];

// ─── Ship ─────────────────────────────────────────────────────────────────────
export interface Ship {
  position: HexCoord;
  health: number;
  maxHealth: number;
  ammo: number;
  /** Active upgrades — each type may appear at most once */
  upgrades: ShipUpgrade[];
  visibilityRange: number;
  /** AP budget per turn (affected by Sails upgrade) */
  actionsPerTurn: number;
  isDestroyed: boolean;
  isDocked: boolean;
  portId: string | null;
  hasInsurance?: boolean;
}

// ─── Player ───────────────────────────────────────────────────────────────────
export interface Player {
  id: string;
  pirateName: string;
  doubloons: number;
  ship: Ship;
  deaths: number;
  kills: number;
  /** Respawn number — 1 = original, 2 = "Name II", etc. */
  incarnation: number;
  /** IDs of bounties this player is currently carrying */
  bountyIds: string[];
  hasActed: boolean;
  actionsThisTurn: number;
  isReady: boolean;
}

// ─── NPC ─────────────────────────────────────────────────────────────────────
export interface NPC {
  id: string;
  ship: Ship;
  tier: number; // respawn tier (higher = better upgrades)
}

// ─── Loot ────────────────────────────────────────────────────────────────────
export interface LootDrop {
  doubloons: number;
  upgrades: ShipUpgrade[];
  ammo: number;
}

// ─── Map Cells ───────────────────────────────────────────────────────────────
export enum CellType {
  Ocean = 'ocean',
  Island = 'island',
  Port = 'port',
}

export interface Port {
  id: string;
  name: string;
  coord: HexCoord;
  dockedPlayerIds: string[];
  maxDocked: number;
}

export interface Island {
  id: string;
  centreCoord: HexCoord;
}

export interface MapCell {
  coord: HexCoord;
  type: CellType;
  islandId?: string;
  portId?: string;
  loot: LootDrop | null;
}

// ─── Game State ───────────────────────────────────────────────────────────────
export enum GamePhase {
  Lobby = 'lobby',
  Active = 'active',
  GameOver = 'gameover',
}

export interface GameState {
  id: string;
  phase: GamePhase;
  turn: number;
  players: Record<string, Player>;
  npcs: Record<string, NPC>;
  /** Keyed by `${q},${r}` */
  map: Record<string, MapCell>;
  islands: Record<string, Island>;
  ports: Record<string, Port>;
  bounties: Bounty[];
  winnerId?: string;
}

// ─── Bounties ─────────────────────────────────────────────────────────────────
export interface Bounty {
  id: string;
  targetPlayerId: string;
  reward: number;
  /** Port where the token must be handed in */
  deliveryPortId: string;
  isComplete: boolean;
  claimedByPlayerId: string | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────
export enum ActionType {
  Move = 'move',
  Attack = 'attack',
  Dock = 'dock',
  Undock = 'undock',
  Salvage = 'salvage',
  EndTurn = 'endTurn',
  // Port actions
  BuyAmmo = 'buyAmmo',
  BuyUpgrade = 'buyUpgrade',
  SellUpgrade = 'sellUpgrade',
  BuyInsurance = 'buyInsurance',
  TakeBounty = 'takeBounty',
  HandInBounty = 'handInBounty',
  Repair = 'repair',
}

export interface GameAction {
  type: ActionType;
  playerId: string;
  targetCoord?: HexCoord;
  targetId?: string;
  upgradeType?: UpgradeType;
  bountyId?: string;
}

// ─── Derived Stats from Upgrades ─────────────────────────────────────────────
export const UPGRADE_STATS: Record<UpgradeType, Record<UpgradeRarity, number>> = {
  [UpgradeType.Hull]: {
    [UpgradeRarity.Wood]: 3,
    [UpgradeRarity.Steel]: 4,
    [UpgradeRarity.Iron]: 5,
    [UpgradeRarity.Bronze]: 6,
    [UpgradeRarity.Gold]: 8,
  },
  [UpgradeType.Cannons]: {
    [UpgradeRarity.Wood]: 1,
    [UpgradeRarity.Steel]: 1,
    [UpgradeRarity.Iron]: 2,
    [UpgradeRarity.Bronze]: 2,
    [UpgradeRarity.Gold]: 3,
  },
  [UpgradeType.Sails]: {
    [UpgradeRarity.Wood]: 1,
    [UpgradeRarity.Steel]: 1,
    [UpgradeRarity.Iron]: 2,
    [UpgradeRarity.Bronze]: 2,
    [UpgradeRarity.Gold]: 3,
  },
  [UpgradeType.Binoculars]: {
    [UpgradeRarity.Wood]: 2,
    [UpgradeRarity.Steel]: 3,
    [UpgradeRarity.Iron]: 3,
    [UpgradeRarity.Bronze]: 4,
    [UpgradeRarity.Gold]: 5,
  },
};

export const ACTION_POINTS_PER_TURN = 3;
export const STARTING_DOUBLOONS = 10;
export const STARTING_AMMO = 20;
export const NPC_MULTIPLIER = 2;
export const MAX_DOCKED_SHIPS_PER_PORT = 2;
export const AMMO_BUY_AMOUNT = 5;
export const AMMO_BUY_COST = 2;
