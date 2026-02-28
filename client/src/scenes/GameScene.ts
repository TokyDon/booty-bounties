import type { GameState, MapCell, HexCoord } from '@booty-bounties/shared';
import { CellType, ActionType } from '@booty-bounties/shared';
import { SocketService } from '../services/SocketService';
import { hexToPixel, hexKey, hexesInRange } from '../utils/HexUtils';

const HEX_SIZE = 40;
const MAP_OFFSET_X = 640;
const MAP_OFFSET_Y = 360;

export class GameScene extends Phaser.Scene {
  private socketService!: SocketService;
  private gameState?: GameState;
  private playerId?: string;

  // Layers
  private mapLayer!: Phaser.GameObjects.Container;
  private fogLayer!: Phaser.GameObjects.Container;
  private entityLayer!: Phaser.GameObjects.Container;

  // Ship sprites: playerId/npcId → sprite
  private shipSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  // Hex highlight overlay
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private selectedCoord?: HexCoord;

  // Camera drag
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { playerId: string; pirateName: string }): void {
    this.playerId = data.playerId;
  }

  create(): void {
    this.socketService = SocketService.getInstance();

    this.mapLayer = this.add.container(MAP_OFFSET_X, MAP_OFFSET_Y);
    this.fogLayer = this.add.container(MAP_OFFSET_X, MAP_OFFSET_Y);
    this.entityLayer = this.add.container(MAP_OFFSET_X, MAP_OFFSET_Y);
    this.highlightGfx = this.add.graphics();

    this.setupCamera();
    this.setupInput();
    this.setupSocketListeners();

    // Request current game state
    this.socketService.requestState((state) => {
      this.gameState = state;
      this.renderFullState(state);
    });
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  private renderFullState(state: GameState): void {
    this.renderMap(state);
    this.renderEntities(state);
    this.renderFog(state);
  }

  private renderMap(state: GameState): void {
    this.mapLayer.removeAll(true);

    Object.values(state.map).forEach((cell) => {
      const { x, y } = hexToPixel(cell.coord.q, cell.coord.r);
      const textureKey = cell.type === CellType.Port
        ? 'hex-port'
        : cell.type === CellType.Island
          ? 'hex-island'
          : 'hex-ocean';

      const img = this.add.image(x, y, textureKey).setInteractive();
      img.setData('coord', cell.coord);

      img.on('pointerdown', () => this.onHexClick(cell.coord, cell));
      img.on('pointerover', () => this.onHexHover(cell.coord));
      img.on('pointerout', () => this.onHexHoverEnd());

      this.mapLayer.add(img);

      // Loot marker
      if (cell.loot && (cell.loot.doubloons > 0 || cell.loot.upgrades.length > 0 || cell.loot.ammo > 0)) {
        const loot = this.add.image(x, y, 'loot-marker').setScale(0.6);
        this.mapLayer.add(loot);
        this.tweens.add({ targets: loot, y: y - 6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });
  }

  private renderEntities(state: GameState): void {
    this.entityLayer.removeAll(true);
    this.shipSprites.clear();

    // Players
    Object.values(state.players).forEach((player) => {
      if (!player.ship.isDestroyed) {
        this.createShipSprite(player.ship.position, player.id, player.pirateName, false);
      }
    });

    // NPCs
    Object.values(state.npcs).forEach((npc) => {
      if (!npc.ship.isDestroyed) {
        this.createShipSprite(npc.ship.position, npc.id, `NPC`, true);
      }
    });
  }

  private createShipSprite(pos: HexCoord, id: string, label: string, isNpc: boolean): void {
    const { x, y } = hexToPixel(pos.q, pos.r);
    const isOwn = id === this.playerId;

    const sprite = this.add.image(0, 0, isNpc ? 'ship-npc' : 'ship-player').setScale(0.8);
    if (isOwn) {
      sprite.setTint(0x00ff88);
    }

    const nameTag = this.add.text(0, -28, label, {
      fontSize: '11px',
      color: isOwn ? '#00ff88' : isNpc ? '#ff6666' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [sprite, nameTag]);
    this.entityLayer.add(container);
    this.shipSprites.set(id, container);
  }

  private renderFog(state: GameState): void {
    this.fogLayer.removeAll(true);

    if (!this.playerId) return;
    const player = state.players[this.playerId];
    if (!player) return;

    const visibleHexes = new Set<string>();
    const visRange = player.ship.visibilityRange;
    hexesInRange(player.ship.position, visRange).forEach((h) => visibleHexes.add(hexKey(h)));

    Object.values(state.map).forEach((cell) => {
      if (!visibleHexes.has(hexKey(cell.coord))) {
        const { x, y } = hexToPixel(cell.coord.q, cell.coord.r);
        const fog = this.add.image(x, y, 'hex-fog').setAlpha(0.85);
        this.fogLayer.add(fog);
      }
    });
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private setupCamera(): void {
    this.cameras.main.setBounds(-2000, -2000, 5280, 4720);
  }

  private setupInput(): void {
    // Middle mouse / right click drag to pan
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown() || ptr.middleButtonDown()) {
        this.isDragging = true;
        this.dragStart = { x: ptr.x, y: ptr.y };
      }
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = ptr.x - this.dragStart.x;
        const dy = ptr.y - this.dragStart.y;
        this.cameras.main.scrollX -= dx;
        this.cameras.main.scrollY -= dy;
        this.dragStart = { x: ptr.x, y: ptr.y };
      }
    });

    this.input.on('pointerup', () => { this.isDragging = false; });

    // Scroll to zoom
    this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _objs: unknown, _dx: number, _dy: number, dy: number) => {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom - dy * 0.001, 0.4, 2));
    });
  }

  private onHexClick(coord: HexCoord, cell: MapCell): void {
    if (!this.gameState || !this.playerId) return;
    const player = this.gameState.players[this.playerId];
    if (!player || player.hasActed) return;

    if (!this.selectedCoord) {
      // Select own ship's hex
      const ownPos = player.ship.position;
      if (ownPos.q === coord.q && ownPos.r === coord.r) {
        this.selectedCoord = coord;
        this.drawHighlight(coord, 0x00ff88);
      }
    } else {
      // Try to move
      this.socketService.sendAction(
        { type: ActionType.Move, playerId: this.playerId, targetCoord: coord },
        (res) => {
          if (!res.success) {
            console.warn('Move failed:', res.error);
          }
          this.selectedCoord = undefined;
          this.highlightGfx.clear();
        },
      );
    }

    // If clicking on a port while docked - handled by UI overlay
    void cell;
  }

  private onHexHover(coord: HexCoord): void {
    if (this.selectedCoord) {
      this.drawHighlight(coord, 0xffffff, 0.3);
    }
  }

  private onHexHoverEnd(): void {
    if (this.selectedCoord) {
      this.drawHighlight(this.selectedCoord, 0x00ff88);
    }
  }

  private drawHighlight(coord: HexCoord, color: number, alpha = 0.5): void {
    this.highlightGfx.clear();
    const { x, y } = hexToPixel(coord.q, coord.r);
    const cx = x + MAP_OFFSET_X - this.cameras.main.scrollX;
    const cy = y + MAP_OFFSET_Y - this.cameras.main.scrollY;
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(new Phaser.Geom.Point(cx + HEX_SIZE * Math.cos(angle), cy + HEX_SIZE * Math.sin(angle)));
    }
    this.highlightGfx.fillStyle(color, alpha);
    this.highlightGfx.fillPoints(points, true);
    this.highlightGfx.lineStyle(2, color, 0.9);
    this.highlightGfx.strokePoints(points, true);
  }

  // ─── Socket Listeners ─────────────────────────────────────────────────────────

  private setupSocketListeners(): void {
    this.socketService.on('game:stateSync', (state) => {
      this.gameState = state;
      this.renderFullState(state);
    });

    this.socketService.on('game:statePatch', (patch) => {
      if (!this.gameState) return;
      this.gameState = { ...this.gameState, ...patch };
      this.renderFullState(this.gameState);
    });

    this.socketService.on('game:turnAdvanced', (turn) => {
      if (this.gameState) {
        this.gameState.turn = turn;
        this.events.emit('turnAdvanced', turn);
      }
    });

    this.socketService.on('game:over', (winnerId, finalState) => {
      this.gameState = finalState;
      this.events.emit('gameOver', winnerId);
    });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  getGameState(): GameState | undefined {
    return this.gameState;
  }

  getPlayerId(): string | undefined {
    return this.playerId;
  }

  // Called from UIScene to animate a ship move
  animateShipMove(shipId: string, newPos: HexCoord): void {
    const sprite = this.shipSprites.get(shipId);
    if (!sprite) return;
    const { x, y } = hexToPixel(newPos.q, newPos.r);
    this.tweens.add({ targets: sprite, x, y, duration: 300, ease: 'Sine.easeOut' });
  }
}
