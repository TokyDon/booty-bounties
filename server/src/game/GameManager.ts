import {
  CellType,
  ACTION_POINTS_PER_TURN,
  STARTING_AMMO,
  STARTING_DOUBLOONS,
  NPC_MULTIPLIER,
  UpgradeRarity,
  UpgradeType,
  GamePhase,
} from '@booty-bounties/shared';
import type {
  GameState,
  Player,
  NPC,
  Ship,
  MapCell,
  HexCoord,
  Port,
  Island,
  Bounty,
} from '@booty-bounties/shared';
import { v4 as uuid } from 'uuid';
import { HexMapGenerator } from './HexMapGenerator.js';
import { TurnManager } from './TurnManager.js';

export class GameManager {
  private games: Map<string, GameState> = new Map();
  private turnManagers: Map<string, TurnManager> = new Map();
  // gameId → Set of playerId
  private playerSessions: Map<string, Set<string>> = new Map();

  // ─── Game Lifecycle ────────────────────────────────────────────────────────

  createGame(): GameState {
    const gameId = uuid();
    const state: GameState = {
      id: gameId,
      phase: GamePhase.Lobby,
      turn: 1,
      players: {},
      npcs: {},
      map: {},
      ports: {},
      islands: {},
      bounties: [],
    };
    this.games.set(gameId, state);
    this.playerSessions.set(gameId, new Set());
    return state;
  }

  addPlayer(gameId: string, playerId: string, pirateName: string): Player | null {
    const state = this.games.get(gameId);
    if (!state) return null;
    if (Object.keys(state.players).length >= 8) return null; // max 8 players

    const spawnPos = this.getSpawnPosition(state);
    const ship: Ship = this.createStartingShip(spawnPos);
    const player: Player = {
      id: playerId,
      pirateName,
      ship,
      doubloons: STARTING_DOUBLOONS,
      isReady: false,
      hasActed: false,
      actionsThisTurn: 0,
      kills: 0,
      deaths: 0,
      incarnation: 1,
      bountyIds: [],
    };

    state.players[playerId] = player;
    this.playerSessions.get(gameId)?.add(playerId);
    return player;
  }

  setReady(gameId: string, playerId: string): boolean {
    const state = this.games.get(gameId);
    if (!state) return false;
    const player = state.players[playerId];
    if (!player) return false;
    player.isReady = true;

    const players = Object.values(state.players);
    if (players.length >= 1 && players.every((p) => p.isReady)) {
      this.startGame(gameId);
    }
    return true;
  }

  private startGame(gameId: string): void {
    const state = this.games.get(gameId);
    if (!state) return;
    state.phase = GamePhase.Active;

    const playerCount = Object.keys(state.players).length;
    const gen = new HexMapGenerator();
    const { cells, ports, islands } = gen.generate(playerCount);
    state.map = cells;
    state.ports = ports;
    state.islands = islands;

    // Place players on spawn hexes
    const spawnHexes = Object.values(ports).map((p) => p.coord);
    Object.values(state.players).forEach((player, i) => {
      const pos = spawnHexes[i % spawnHexes.length];
      player.ship.position = pos;
    });

    // Spawn NPCs (2× players)
    const npcCount = playerCount * NPC_MULTIPLIER;
    for (let n = 0; n < npcCount; n++) {
      const pos = this.getRandomOceanHex(state);
      const npc: NPC = {
        id: `npc-${uuid()}`,
        ship: this.createStartingShip(pos),
        tier: 1,
      };
      state.npcs[npc.id] = npc;
    }

    // Generate bounties
    state.bounties = this.generateBounties(state);

    this.turnManagers.set(gameId, new TurnManager(state, this));
  }

  // ─── Turn Resolution ───────────────────────────────────────────────────────

  getTurnManager(gameId: string): TurnManager | undefined {
    return this.turnManagers.get(gameId);
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  getPlayerGame(playerId: string): string | undefined {
    for (const [gameId, players] of this.playerSessions) {
      if (players.has(playerId)) return gameId;
    }
    return undefined;
  }

  // ─── Win Condition ─────────────────────────────────────────────────────────

  checkWinner(state: GameState): string | null {
    for (const player of Object.values(state.players)) {
      const upgrades = player.ship.upgrades;
      const allGold = Object.values(UpgradeType).every((type) => {
        const upg = upgrades.find((u) => u.type === type);
        return upg?.rarity === UpgradeRarity.Gold;
      });
      if (allGold) return player.id;
    }
    return null;
  }

  // ─── Helper factories ──────────────────────────────────────────────────────

  private createStartingShip(position: HexCoord): Ship {
    return {
      health: 10,
      maxHealth: 10,
      ammo: STARTING_AMMO,
      position,
      upgrades: [],
      isDestroyed: false,
      isDocked: false,
      portId: null,
      visibilityRange: 2,
      actionsPerTurn: ACTION_POINTS_PER_TURN,
    };
  }

  private getSpawnPosition(state: GameState): HexCoord {
    // Before map is generated, return a placeholder; overridden in startGame
    return { q: 0, r: 0 };
  }

  private getRandomOceanHex(state: GameState): HexCoord {
    const oceanCells = Object.values(state.map).filter(
      (c) => c.type === CellType.Ocean && !Object.values(state.players).some((p) => p.ship.position.q === c.coord.q && p.ship.position.r === c.coord.r),
    );
    if (oceanCells.length === 0) return { q: 1, r: 0 };
    return oceanCells[Math.floor(Math.random() * oceanCells.length)].coord;
  }

  private generateBounties(state: GameState): Bounty[] {
    const bounties: Bounty[] = [];
    const playerIds = Object.keys(state.players);
    const portIds = Object.keys(state.ports);
    playerIds.forEach((targetId, i) => {
      const deliveryPort = portIds[i % portIds.length];
      bounties.push({
        id: uuid(),
        targetPlayerId: targetId,
        reward: 5 + Math.floor(Math.random() * 10),
        deliveryPortId: deliveryPort,
        isComplete: false,
        claimedByPlayerId: null,
      });
    });
    return bounties;
  }
}
