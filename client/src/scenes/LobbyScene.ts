import Phaser from 'phaser';
import { SocketService } from '../services/SocketService';

// ─── Design tokens (shared with MainMenuScene) ────────────────────────────────
const C = {
  gold:      0xf0a000,
  goldDim:   0xa86f00,
  parchment: 0xf5e0b8,
  textGold:  '#f0a000',
  textParch: '#f5e0b8',
  textDark:  '#1a1008',
  textError: '#ff6b6b',
  fontSerif: '"Georgia", "Book Antiqua", serif',
};

export class LobbyScene extends Phaser.Scene {
  private socketService!: SocketService;
  private playerId!: string;
  private pirateName!: string;
  private gameId?: string;
  private gameStarted = false;

  // DOM input for game-code entry
  private joinInput!: Phaser.GameObjects.DOMElement;
  // Separate feedback texts for each panel
  private idleFeedback!: Phaser.GameObjects.Text;
  private waitingStatus!: Phaser.GameObjects.Text;
  private gameIdDisplay!: Phaser.GameObjects.Text;

  // Panels (containers that can be shown/hidden)
  private idlePanel!: Phaser.GameObjects.Container;
  private waitingPanel!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'LobbyScene' }); }

  init(data: { playerId: string; pirateName: string }): void {
    this.playerId   = data.playerId;
    this.pirateName = data.pirateName;
  }

  create(): void {
    this.gameStarted = false;
    this.socketService = SocketService.getInstance();
    const { width: w, height: h } = this.scale;

    this.buildBg(w, h);
    this.buildHeader(w, h);
    this.buildIdlePanel(w, h);
    this.buildWaitingPanel(w, h);
    this.showIdle();

    // When all players ready → server fires game:stateSync → enter game.
    // Guard prevents this firing again on subsequent state syncs.
    this.socketService.on('game:stateSync', () => {
      if (this.gameStarted) return;
      this.gameStarted = true;
      this.scene.start('GameScene', { playerId: this.playerId, pirateName: this.pirateName });
      this.scene.start('UIScene',   { playerId: this.playerId });
      this.scene.stop();
    });

    this.socketService.on('game:playerConnected', (player) => {
      if (this.waitingPanel.visible) {
        this.waitingStatus.setText(`⚓  ${player.pirateName} has joined the crew!`);
      }
    });
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private buildBg(w: number, h: number): void {
    const g = this.add.graphics();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      g.fillStyle(Phaser.Display.Color.GetColor(
        Math.round(7  + t * 10),
        Math.round(15 + t * 22),
        Math.round(30 + t * 50),
      ));
      g.fillRect(0, Math.floor((i / 60) * h), w, Math.ceil(h / 60) + 1);
    }
  }

  // ─── Fixed header (not inside any panel, always visible) ─────────────────────

  private buildHeader(w: number, h: number): void {
    this.add.text(w * 0.5, h * 0.09, '⚓  BOOTY & BOUNTIES', {
      fontSize: '32px', fontFamily: C.fontSerif, color: C.textGold, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(w * 0.5, h * 0.17,
      `Welcome back, ${this.pirateName}!  Choose yer fate below…`,
      { fontSize: '15px', fontFamily: C.fontSerif, color: C.textParch, fontStyle: 'italic' },
    ).setOrigin(0.5);

    const rule = this.add.graphics();
    rule.lineStyle(1, C.gold, 0.4);
    rule.lineBetween(w * 0.2, h * 0.23, w * 0.8, h * 0.23);
  }

  // ─── Idle panel (create / join) ───────────────────────────────────────────────
  // ALL objects are added to this.idlePanel so setVisible works correctly.

  private buildIdlePanel(w: number, h: number): void {
    this.idlePanel = this.add.container(0, 0);
    const $ = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.idlePanel.add(o); return o; };

    const cx = w * 0.5;
    const cy = h * 0.57;
    const cW = 460, cH = 310;
    const top = cy - cH / 2;

    // Card background
    const card = this.add.graphics();
    card.fillStyle(C.parchment, 1);
    card.fillRoundedRect(cx - cW / 2, top, cW, cH, 10);
    card.lineStyle(2, C.goldDim, 0.7);
    card.strokeRoundedRect(cx - cW / 2, top, cW, cH, 10);
    $(card);

    // "Create new game" button
    $(this.buildBtn(cx, top + 60, 280, 48, '+ CREATE NEW GAME', () => this.onCreateGame()));

    $(this.add.text(cx, top + 115, '— or join an existing game —', {
      fontSize: '12px', fontFamily: C.fontSerif, color: '#5a4a30', fontStyle: 'italic',
    }).setOrigin(0.5));

    $(this.add.text(cx - cW / 2 + 20, top + 136, 'GAME CODE', {
      fontSize: '10px', fontFamily: C.fontSerif, color: '#5a4a30',
      fontStyle: 'bold', letterSpacing: 2,
    }));

    // Text input for game code
    this.joinInput = this.add.dom(cx - 55, top + 176, 'input', [
      'width: 232px', 'height: 36px',
      'background: rgba(26,16,8,0.82)',
      'border: 1px solid #a07828', 'border-radius: 4px 0 0 4px',
      'color: #f5e0b8', 'font-size: 14px', 'font-family: Georgia,serif',
      'padding: 0 12px', 'outline: none', 'caret-color: #f0a000',
      'box-sizing: border-box',
    ].join('; ')).setOrigin(0.5);
    (this.joinInput.node as HTMLInputElement).placeholder = 'e.g. abc-123';
    (this.joinInput.node as HTMLInputElement).addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.onJoinGame();
    });
    $(this.joinInput);

    // Join button (right of input)
    $(this.buildBtn(cx + 135, top + 176, 74, 36, 'JOIN', () => this.onJoinGame()));

    // Idle feedback / error text
    this.idleFeedback = this.add.text(cx, top + 225, '', {
      fontSize: '12px', fontFamily: C.fontSerif, color: C.textError, fontStyle: 'italic',
    }).setOrigin(0.5);
    $(this.idleFeedback);

    // Back / logout link
    const back = this.add.text(cx, top + 272, '← Back to Login',
      { fontSize: '12px', fontFamily: C.fontSerif, color: C.textGold },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setAlpha(0.6));
    back.on('pointerout',  () => back.setAlpha(1));
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
    $(back);
  }

  // ─── Waiting room panel ───────────────────────────────────────────────────────
  // ALL objects are added to this.waitingPanel so setVisible works correctly.

  private buildWaitingPanel(w: number, h: number): void {
    this.waitingPanel = this.add.container(0, 0);
    const $ = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.waitingPanel.add(o); return o; };

    const cx = w * 0.5;
    const cy = h * 0.57;
    const cW = 460, cH = 310;
    const top = cy - cH / 2;

    // Card background
    const card = this.add.graphics();
    card.fillStyle(C.parchment, 1);
    card.fillRoundedRect(cx - cW / 2, top, cW, cH, 10);
    card.lineStyle(2, C.goldDim, 0.7);
    card.strokeRoundedRect(cx - cW / 2, top, cW, cH, 10);
    $(card);

    $(this.add.text(cx, top + 28, 'YOUR GAME CODE', {
      fontSize: '11px', fontFamily: C.fontSerif, color: '#5a4a30',
      fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5));

    // Large game-ID display
    this.gameIdDisplay = this.add.text(cx, top + 72, '', {
      fontSize: '28px', fontFamily: '"Courier New", Courier, monospace',
      color: C.textDark, fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);
    $(this.gameIdDisplay);

    $(this.add.text(cx, top + 104, 'Share this code with yer crew-mates', {
      fontSize: '11px', fontFamily: C.fontSerif, color: '#5a4a30', fontStyle: 'italic',
    }).setOrigin(0.5));

    const dg = this.add.graphics();
    dg.lineStyle(1, C.gold, 0.45);
    dg.lineBetween(cx - 170, top + 118, cx + 170, top + 118);
    $(dg);

    // Status / info text
    this.waitingStatus = this.add.text(cx, top + 148, 'Waiting for crew-mates to join…', {
      fontSize: '13px', fontFamily: C.fontSerif, color: '#5a4a30', fontStyle: 'italic',
    }).setOrigin(0.5);
    $(this.waitingStatus);

    // Ready button
    $(this.buildBtn(cx, top + 216, 240, 50, "⚓  I'M READY!", () => this.onReady()));

    $(this.add.text(cx, top + 264, 'Game begins when all pirates press Ready', {
      fontSize: '11px', fontFamily: C.fontSerif, color: '#7a6a50', fontStyle: 'italic',
    }).setOrigin(0.5));
  }

  // ─── Panel switches ───────────────────────────────────────────────────────────

  private showIdle(): void {
    this.idlePanel.setVisible(true);
    this.waitingPanel.setVisible(false);
  }

  private showWaiting(gameId: string): void {
    this.gameId = gameId;
    this.gameIdDisplay.setText(gameId.slice(0, 14).toUpperCase());
    this.waitingStatus.setText('Waiting for crew-mates to join…');
    this.idlePanel.setVisible(false);
    this.waitingPanel.setVisible(true);
  }

  // ─── Action handlers ─────────────────────────────────────────────────────────

  private onCreateGame(): void {
    this.idleFeedback.setText('Creating game…');
    this.socketService.createGame((res) => {
      if (res.success && res.gameId) {
        this.showWaiting(res.gameId);
      } else {
        this.idleFeedback.setText(res.error ?? 'Failed to create game');
      }
    });
  }

  private onJoinGame(): void {
    const code = (this.joinInput.node as HTMLInputElement).value.trim();
    if (!code) { this.idleFeedback.setText('Enter a game code first!'); return; }
    this.idleFeedback.setText('Joining…');
    this.socketService.joinGame(code, (res) => {
      if (res.success && res.gameId) {
        this.showWaiting(res.gameId);
        this.waitingStatus.setText('Joined! Press Ready when yer crew is assembled.');
      } else {
        this.idleFeedback.setText(res.error ?? 'Could not join — check the code');
      }
    });
  }

  private onReady(): void {
    if (!this.gameId) return;
    this.waitingStatus.setText('Ahoy! Waiting for all pirates to be ready…');
    this.socketService.ready();
    // Server fires game:stateSync when all players ready → handled in create()
  }

  // ─── Gold button helper ───────────────────────────────────────────────────────

  private buildBtn(x: number, y: number, bw: number, bh: number,
    label: string, cb: () => void): Phaser.GameObjects.Container {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillRoundedRect(-bw / 2 + 2, -bh / 2 + 2, bw, bh, 6);

    const bg = this.add.graphics();
    const drawBg = (col: number) => {
      bg.clear();
      bg.fillStyle(col, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      bg.lineStyle(1.5, 0xffffff, 0.15);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
    };
    drawBg(C.gold);

    const txt = this.add.text(0, 0, label, {
      fontSize: '14px', fontFamily: C.fontSerif, color: C.textDark, fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [shadow, bg, txt]);
    bg.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerover', () => drawBg(0xffd040));
    bg.on('pointerout',  () => drawBg(C.gold));
    bg.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.96, scaleY: 0.96, duration: 80, yoyo: true });
      cb();
    });
    return container;
  }
}
