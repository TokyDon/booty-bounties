import type { GameState, Player, NPC, GameAction, HexCoord } from '@booty-bounties/shared';
import {
  ActionType, CellType, UpgradeRarity, UpgradeType,
  STARTING_AMMO, STARTING_DOUBLOONS, ACTION_POINTS_PER_TURN,
} from '@booty-bounties/shared';
import { v4 as uuid } from 'uuid';
import type { GameManager } from './GameManager.js';

const RARITY_ORDER: UpgradeRarity[] = [
  UpgradeRarity.Wood,
  UpgradeRarity.Steel,
  UpgradeRarity.Iron,
  UpgradeRarity.Bronze,
  UpgradeRarity.Gold,
];

const UPGRADE_COSTS: Record<UpgradeRarity, number> = {
  [UpgradeRarity.Wood]: 3,
  [UpgradeRarity.Steel]: 6,
  [UpgradeRarity.Iron]: 10,
  [UpgradeRarity.Bronze]: 15,
  [UpgradeRarity.Gold]: 25,
};

function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

function hexKey(c: HexCoord): string { return `${c.q},${c.r}`; }

export class TurnManager {
  private state: GameState;
  private manager: GameManager;
  /** Callbacks to push state updates to connected sockets */
  onStateUpdate?: (gameId: string, state: GameState) => void;
  onGameOver?: (gameId: string, winnerId: string, state: GameState) => void;

  constructor(state: GameState, manager: GameManager) {
    this.state = state;
    this.manager = manager;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  processAction(playerId: string, action: GameAction): { success: boolean; error?: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, error: 'Player not found' };
    if (action.type === ActionType.EndTurn) {
      player.hasActed = true;
      this.tryAdvanceTurn();
      return { success: true };
    }
    if (player.hasActed) return { success: false, error: 'Already ended your turn' };
    if (player.actionsThisTurn >= ACTION_POINTS_PER_TURN) {
      return { success: false, error: 'No action points remaining' };
    }

    const result = this.applyAction(player, action);
    if (result.success) {
      player.actionsThisTurn++;
      // Check win
      const winner = this.manager.checkWinner(this.state);
      if (winner) {
        this.onGameOver?.(this.state.id, winner, this.state);
      }
    }
    return result;
  }

  // ─── Action handlers ────────────────────────────────────────────────────────

  private applyAction(player: Player, action: GameAction): { success: boolean; error?: string } {
    switch (action.type) {
      case ActionType.Move: return this.doMove(player, action.targetCoord!);
      case ActionType.Attack: return this.doAttack(player, action.targetCoord!);
      case ActionType.Salvage: return this.doSalvage(player);
      case ActionType.Dock: return this.doDock(player);
      case ActionType.Undock: return this.doUndock(player);
      case ActionType.BuyAmmo: return this.doBuyAmmo(player);
      case ActionType.BuyUpgrade: return this.doBuyUpgrade(player, action.upgradeType!);
      case ActionType.SellUpgrade: return this.doSellUpgrade(player, action.upgradeType!);
      case ActionType.Repair: return this.doRepair(player);
      case ActionType.TakeBounty: return this.doTakeBounty(player, action.bountyId!);
      case ActionType.HandInBounty: return this.doHandInBounty(player, action.bountyId!);
      case ActionType.BuyInsurance: return this.doBuyInsurance(player);
      default: return { success: false, error: 'Unknown action' };
    }
  }

  private doMove(player: Player, target: HexCoord): { success: boolean; error?: string } {
    // Must be adjacent
    const dist = hexDistance(player.ship.position, target);
    if (dist !== 1) return { success: false, error: 'Can only move to adjacent hex' };

    const cell = this.state.map[hexKey(target)];
    if (!cell) return { success: false, error: 'Invalid hex' };
    if (cell.type === CellType.Island) return { success: false, error: 'Cannot sail onto land' };

    player.ship.position = target;

    // Auto-salvage if loot present
    if (cell.loot) {
      player.doubloons += cell.loot.doubloons;
      player.ship.ammo += cell.loot.ammo;
      cell.loot.upgrades.forEach((u) => player.ship.upgrades.push(u));
      cell.loot = null;
    }
    return { success: true };
  }

  private doAttack(player: Player, target: HexCoord): { success: boolean; error?: string } {
    if (player.ship.ammo <= 0) return { success: false, error: 'No ammo!' };

    const range = this.getAttackRange(player);
    if (hexDistance(player.ship.position, target) > range) {
      return { success: false, error: `Out of range (max ${range})` };
    }

    player.ship.ammo--;

    // Check players
    for (const target_player of Object.values(this.state.players)) {
      if (target_player.id === player.id) continue;
      if (target_player.ship.position.q === target.q && target_player.ship.position.r === target.r) {
        const damage = this.getCannonDamage(player);
        // If docked at port, attacker takes 1 damage
        if (target_player.ship.isDocked) {
          player.ship.health -= 1;
        }
        target_player.ship.health -= damage;
        if (target_player.ship.health <= 0) {
          this.destroyPlayer(target_player, player.id);
        }
        return { success: true };
      }
    }

    // Check NPCs
    for (const npc of Object.values(this.state.npcs)) {
      if (npc.ship.position.q === target.q && npc.ship.position.r === target.r) {
        const damage = this.getCannonDamage(player);
        npc.ship.health -= damage;
        if (npc.ship.health <= 0) {
          this.destroyNpc(npc, player);
        }
        return { success: true };
      }
    }

    return { success: true }; // Miss
  }

  private doSalvage(player: Player): { success: boolean; error?: string } {
    const cell = this.state.map[hexKey(player.ship.position)];
    if (!cell?.loot) return { success: false, error: 'Nothing to salvage here' };
    player.doubloons += cell.loot.doubloons;
    player.ship.ammo += cell.loot.ammo;
    cell.loot.upgrades.forEach((u) => player.ship.upgrades.push(u));
    cell.loot = null;
    return { success: true };
  }

  private doDock(player: Player): { success: boolean; error?: string } {
    const cell = this.state.map[hexKey(player.ship.position)];
    if (cell?.type !== CellType.Port || !cell.portId) {
      return { success: false, error: 'Not at a port' };
    }
    const port = this.state.ports[cell.portId];
    if (!port) return { success: false, error: 'Port not found' };
    if (port.dockedPlayerIds.length >= port.maxDocked) {
      return { success: false, error: 'Port is full' };
    }
    port.dockedPlayerIds.push(player.id);
    player.ship.isDocked = true;
    player.ship.portId = port.id;
    return { success: true };
  }

  private doUndock(player: Player): { success: boolean; error?: string } {
    if (!player.ship.isDocked || !player.ship.portId) {
      return { success: false, error: 'Not docked' };
    }
    const port = this.state.ports[player.ship.portId];
    if (port) {
      port.dockedPlayerIds = port.dockedPlayerIds.filter((id) => id !== player.id);
    }
    player.ship.isDocked = false;
    player.ship.portId = null;
    return { success: true };
  }

  private doBuyAmmo(player: Player): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked at port' };
    const cost = 2;
    if (player.doubloons < cost) return { success: false, error: 'Not enough doubloons' };
    player.doubloons -= cost;
    player.ship.ammo += 5;
    return { success: true };
  }

  private doBuyUpgrade(player: Player, type: UpgradeType): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked' };
    const existing = player.ship.upgrades.find((u) => u.type === type);
    const currentRarityIdx = existing ? RARITY_ORDER.indexOf(existing.rarity) : -1;
    const nextRarity = RARITY_ORDER[currentRarityIdx + 1];
    if (!nextRarity) return { success: false, error: 'Already at max rarity' };
    const cost = UPGRADE_COSTS[nextRarity];
    if (player.doubloons < cost) return { success: false, error: `Need ${cost} doubloons` };
    player.doubloons -= cost;
    if (existing) {
      existing.rarity = nextRarity;
    } else {
      player.ship.upgrades.push({ id: uuid(), type, rarity: nextRarity });
    }
    this.applyUpgradeStats(player);
    return { success: true };
  }

  private doSellUpgrade(player: Player, type: UpgradeType): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked' };
    const idx = player.ship.upgrades.findIndex((u) => u.type === type);
    if (idx === -1) return { success: false, error: 'No such upgrade' };
    const upg = player.ship.upgrades[idx];
    const sellValue = Math.floor(UPGRADE_COSTS[upg.rarity] / 2);
    player.doubloons += sellValue;
    player.ship.upgrades.splice(idx, 1);
    this.applyUpgradeStats(player);
    return { success: true };
  }

  private doRepair(player: Player): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked' };
    // Repair costs 3 AP (i.e. entire action budget)
    if (player.actionsThisTurn > 0) return { success: false, error: 'Repair requires all AP (use as first action)' };
    const repairCost = Math.ceil((player.ship.maxHealth - player.ship.health) * 0.5);
    if (player.doubloons < repairCost) return { success: false, error: `Need ${repairCost} doubloons to repair` };
    player.doubloons -= repairCost;
    player.ship.health = player.ship.maxHealth;
    player.actionsThisTurn += 2; // extra cost: uses all AP
    return { success: true };
  }

  private doTakeBounty(player: Player, bountyId: string): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked' };
    const bounty = this.state.bounties.find((b) => b.id === bountyId);
    if (!bounty || bounty.claimedByPlayerId || bounty.isComplete) {
      return { success: false, error: 'Bounty unavailable' };
    }
    bounty.claimedByPlayerId = player.id;
    player.bountyIds.push(bountyId);
    return { success: true };
  }

  private doHandInBounty(player: Player, bountyId: string): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked' };
    const bounty = this.state.bounties.find((b) => b.id === bountyId);
    if (!bounty || bounty.claimedByPlayerId !== player.id) {
      return { success: false, error: 'Not your bounty' };
    }
    const target = this.state.players[bounty.targetPlayerId];
    if (!target || !target.ship.isDestroyed) {
      return { success: false, error: 'Target is still alive' };
    }
    // Check correct port
    const cell = this.state.map[`${player.ship.position.q},${player.ship.position.r}`];
    if (cell?.portId !== bounty.deliveryPortId) {
      return { success: false, error: 'Wrong port for this bounty' };
    }
    player.doubloons += bounty.reward;
    bounty.isComplete = true;
    player.bountyIds = player.bountyIds.filter((id) => id !== bountyId);
    return { success: true };
  }

  private doBuyInsurance(player: Player): { success: boolean; error?: string } {
    if (!player.ship.isDocked) return { success: false, error: 'Must be docked' };
    const cost = 5;
    if (player.doubloons < cost) return { success: false, error: `Need ${cost} doubloons` };
    player.doubloons -= cost;
    player.ship.hasInsurance = true;
    return { success: true };
  }

  // ─── Ship destruction & respawn ────────────────────────────────────────────

  private destroyPlayer(player: Player, killerPlayerId: string): void {
    player.ship.isDestroyed = true;
    player.ship.isDocked = false;
    player.ship.portId = null;
    player.deaths++;

    const killer = this.state.players[killerPlayerId];
    if (killer) killer.kills++;

    // Drop loot at death position
    const dropPos = player.ship.position;
    const key = hexKey(dropPos);
    const cell = this.state.map[key];
    if (cell) {
      const droppedDoubloons = player.ship.hasInsurance
        ? Math.floor(player.doubloons * 0.5)
        : player.doubloons;
      cell.loot = {
        doubloons: droppedDoubloons,
        ammo: Math.floor(player.ship.ammo / 2),
        upgrades: player.ship.hasInsurance ? [] : [...player.ship.upgrades],
      };
    }

    // Clear bounties
    player.bountyIds.forEach((bId) => {
      const b = this.state.bounties.find((x) => x.id === bId);
      if (b) { b.claimedByPlayerId = null; }
    });

    // Respawn after 1 turn (schedule)
    const incarnation = player.deaths + 1;
    setTimeout(() => this.respawnPlayer(player, incarnation), 0);
  }

  private respawnPlayer(player: Player, incarnation: number): void {
    const spawnHexes = Object.values(this.state.ports).map((p) => p.coord);
    const pos = spawnHexes[Math.floor(Math.random() * spawnHexes.length)] ?? { q: 0, r: 0 };
    player.ship = {
      health: 10,
      maxHealth: 10,
      ammo: STARTING_AMMO,
      position: pos,
      upgrades: [],
      isDestroyed: false,
      isDocked: false,
      portId: null,
      visibilityRange: 2,
      actionsPerTurn: ACTION_POINTS_PER_TURN,
    };
    player.doubloons = STARTING_DOUBLOONS;
    player.incarnation = incarnation;
    // Append suffix to name
    player.pirateName = player.pirateName.replace(/ (II|III|IV|V|VI|VII|VIII|IX|X)$/, '');
    const suffixes = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
    player.pirateName += suffixes[Math.min(incarnation - 1, suffixes.length - 1)];
  }

  private destroyNpc(npc: NPC, killer: Player): void {
    npc.ship.isDestroyed = true;
    killer.kills++;
    // Drop ammo loot
    const key = hexKey(npc.ship.position);
    const cell = this.state.map[key];
    if (cell) {
      cell.loot = {
        doubloons: npc.tier * 3,
        ammo: 5 * npc.tier,
        upgrades: [],
      };
    }
    // Respawn NPC at higher tier
    setTimeout(() => {
      const oceanCells = Object.values(this.state.map)
        .filter((c) => c.type === CellType.Ocean);
      const spawn = oceanCells[Math.floor(Math.random() * oceanCells.length)];
      npc.ship = {
        health: 10 + npc.tier * 5,
        maxHealth: 10 + npc.tier * 5,
        ammo: STARTING_AMMO,
        position: spawn?.coord ?? { q: 2, r: 0 },
        upgrades: [],
        isDestroyed: false,
        isDocked: false,
        portId: null,
        visibilityRange: 2,
        actionsPerTurn: ACTION_POINTS_PER_TURN,
      };
      npc.tier++;
    }, 0);
  }

  // ─── Turn advancement ──────────────────────────────────────────────────────

  private tryAdvanceTurn(): void {
    const allDone = Object.values(this.state.players).every((p) => p.hasActed);
    if (!allDone) return;

    this.state.turn++;
    Object.values(this.state.players).forEach((p) => {
      p.hasActed = false;
      p.actionsThisTurn = 0;
    });

    this.onStateUpdate?.(this.state.id, this.state);
  }

  // ─── Upgrade stat application ──────────────────────────────────────────────

  private applyUpgradeStats(player: Player): void {
    const upgrades = player.ship.upgrades;
    const get = (type: UpgradeType): number => {
      const u = upgrades.find((x) => x.type === type);
      return u ? RARITY_ORDER.indexOf(u.rarity) + 1 : 0; // 0 = none, 1-5 = rarity level
    };

    // Hull: max health 10 + 5 per level
    player.ship.maxHealth = 10 + get(UpgradeType.Hull) * 5;
    player.ship.health = Math.min(player.ship.health, player.ship.maxHealth);

    // Binoculars: visibility 2 + 1 per level
    player.ship.visibilityRange = 2 + get(UpgradeType.Binoculars);
  }

  private getAttackRange(player: Player): number {
    const cannon = player.ship.upgrades.find((u) => u.type === UpgradeType.Cannons);
    return 1 + (cannon ? RARITY_ORDER.indexOf(cannon.rarity) + 1 : 0);
  }

  private getCannonDamage(player: Player): number {
    const cannon = player.ship.upgrades.find((u) => u.type === UpgradeType.Cannons);
    return 2 + (cannon ? RARITY_ORDER.indexOf(cannon.rarity) + 1 : 0);
  }
}
