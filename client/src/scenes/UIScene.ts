import Phaser from 'phaser';
import type { GameState, Player } from '@booty-bounties/shared';
import { ActionType } from '@booty-bounties/shared';
import { SocketService } from '../services/SocketService';

export class UIScene extends Phaser.Scene {
  private socketService!: SocketService;
  private playerId?: string;
  private gameState?: GameState;

  // HUD elements
  private doubloonText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private apText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private portPanel?: Phaser.GameObjects.Container;
  private endTurnBtn!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { playerId: string }): void {
    this.playerId = data.playerId;
  }

  create(): void {
    this.socketService = SocketService.getInstance();
    this.buildHUD();
    this.setupListeners();
  }

  private buildHUD(): void {
    const { width, height } = this.scale;

    // Top bar background
    this.add.rectangle(0, 0, width, 56, 0x050f1f, 0.9).setOrigin(0);
    this.add.rectangle(0, 56, width, 2, 0x1a3a6a).setOrigin(0);

    // Title
    this.add.text(width / 2, 28, '⚓ BOOTY & BOUNTIES', {
      fontSize: '20px',
      color: '#f0a000',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    // Left HUD: doubloons, ammo
    this.add.text(16, 12, '🪙', { fontSize: '18px' });
    this.doubloonText = this.add.text(40, 12, '0', { fontSize: '18px', color: '#f0d000' });

    this.add.text(130, 12, '🔫', { fontSize: '18px' });
    this.ammoText = this.add.text(154, 12, '0', { fontSize: '18px', color: '#a0d0f0' });

    // Right HUD: AP, turn
    this.apText = this.add.text(width - 200, 12, 'AP: 3', { fontSize: '18px', color: '#80ff80' });
    this.turnText = this.add.text(width - 100, 12, 'Turn 1', { fontSize: '18px', color: '#c0c0c0' });

    // Bottom bar: HP bar + status
    this.add.rectangle(0, height - 60, width, 60, 0x050f1f, 0.9).setOrigin(0);

    this.add.text(16, height - 50, 'HULL', { fontSize: '13px', color: '#80a0c0' });
    this.add.rectangle(16, height - 32, 200, 16, 0x1a0000).setOrigin(0);
    this.hpBar = this.add.rectangle(16, height - 32, 200, 16, 0x44cc44).setOrigin(0);

    this.statusText = this.add.text(width / 2, height - 35, '', {
      fontSize: '14px',
      color: '#f0d080',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    // End Turn button (bottom-right)
    this.endTurnBtn = this.add.rectangle(width - 90, height - 30, 160, 40, 0x1a4a1a)
      .setStrokeStyle(2, 0x44cc44)
      .setInteractive({ useHandCursor: true });
    this.add.text(width - 90, height - 30, 'END TURN ▶', {
      fontSize: '15px',
      color: '#80ff80',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.endTurnBtn.on('pointerdown', () => this.onEndTurn());
    this.endTurnBtn.on('pointerover', () => this.endTurnBtn.setFillStyle(0x2a8a2a));
    this.endTurnBtn.on('pointerout', () => this.endTurnBtn.setFillStyle(0x1a4a1a));
  }

  private setupListeners(): void {
    this.socketService.on('game:stateSync', (state) => {
      this.gameState = state;
      this.updateHUD(state);
    });

    this.socketService.on('game:statePatch', (patch) => {
      if (!this.gameState) return;
      this.gameState = { ...this.gameState, ...patch };
      this.updateHUD(this.gameState);
    });

    this.socketService.on('game:turnAdvanced', (turn) => {
      this.turnText.setText(`Turn ${turn}`);
      this.statusText.setText('New turn! Choose your actions.');
    });

    this.socketService.on('game:over', (winnerId) => {
      this.showGameOver(winnerId);
    });
  }

  private updateHUD(state: GameState): void {
    if (!this.playerId) return;
    const player: Player | undefined = state.players[this.playerId];
    if (!player) return;

    this.doubloonText.setText(String(player.doubloons));
    this.ammoText.setText(String(player.ship.ammo));
    this.apText.setText(`AP: ${3 - player.actionsThisTurn}`);
    this.turnText.setText(`Turn ${state.turn}`);

    const hpPct = player.ship.health / player.ship.maxHealth;
    this.hpBar.width = 200 * hpPct;
    this.hpBar.setFillStyle(hpPct > 0.5 ? 0x44cc44 : hpPct > 0.25 ? 0xf0a000 : 0xcc2222);

    // Show port panel if docked
    if (player.ship.isDocked && player.ship.portId) {
      this.showPortPanel(state, player);
    } else if (this.portPanel) {
      this.portPanel.destroy();
      this.portPanel = undefined;
    }
  }

  private showPortPanel(state: GameState, player: Player): void {
    if (this.portPanel) this.portPanel.destroy();
    const { width, height } = this.scale;
    const panel = this.add.container(width - 220, height / 2 - 180);

    const bg = this.add.rectangle(0, 0, 200, 360, 0x050f1f, 0.95)
      .setStrokeStyle(2, 0x8a6020)
      .setOrigin(0);
    panel.add(bg);

    panel.add(this.add.text(100, 12, '⚓ PORT', {
      fontSize: '16px', color: '#f0a000', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5));

    const actions = [
      { label: 'Buy Ammo (5g)', action: ActionType.BuyAmmo },
      { label: 'Buy Upgrade', action: ActionType.BuyUpgrade },
      { label: 'Sell Upgrade', action: ActionType.SellUpgrade },
      { label: 'Buy Insurance', action: ActionType.BuyInsurance },
      { label: 'Take Bounty', action: ActionType.TakeBounty },
      { label: 'Hand In Bounty', action: ActionType.HandInBounty },
      { label: 'Repair (3 AP)', action: ActionType.Repair },
    ];

    actions.forEach(({ label, action }, i) => {
      const btn = this.add.rectangle(100, 50 + i * 42, 170, 34, 0x0d1e36)
        .setStrokeStyle(1, 0x2a4a6a)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(100, 50 + i * 42, label, {
        fontSize: '13px', color: '#c0d8f0',
      }).setOrigin(0.5);

      btn.on('pointerdown', () => {
        this.socketService.sendAction(
          { type: action, playerId: player.id },
          (res) => {
            if (!res.success) {
              this.statusText.setText(res.error ?? 'Action failed');
            }
          },
        );
      });
      btn.on('pointerover', () => btn.setFillStyle(0x1a3a5a));
      btn.on('pointerout', () => btn.setFillStyle(0x0d1e36));

      panel.add([btn, txt]);
    });

    // Leave port button
    const leaveBtn = this.add.rectangle(100, 358, 170, 34, 0x3a1a0a)
      .setStrokeStyle(1, 0x8a3a0a)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    panel.add(leaveBtn);
    panel.add(this.add.text(100, 358, 'Leave Port', {
      fontSize: '13px', color: '#f08040',
    }).setOrigin(0.5));
    leaveBtn.on('pointerdown', () => {
      this.socketService.sendAction(
        { type: ActionType.Undock, playerId: player.id },
        (res) => { if (!res.success) this.statusText.setText(res.error ?? 'Failed'); },
      );
    });

    void state;
    this.portPanel = panel;
  }

  private onEndTurn(): void {
    if (!this.playerId) return;
    this.socketService.sendAction(
      { type: ActionType.EndTurn, playerId: this.playerId },
      (res) => {
        if (res.success) {
          this.statusText.setText('Waiting for other pirates...');
          this.endTurnBtn.setFillStyle(0x0a2a0a);
        } else {
          this.statusText.setText(res.error ?? 'Failed to end turn');
        }
      },
    );
  }

  private showGameOver(winnerId: string): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);

    const isWinner = winnerId === this.playerId;
    this.add.text(width / 2, height / 2 - 60, isWinner ? '🏆 VICTORY!' : '💀 DEFEATED!', {
      fontSize: '56px',
      color: isWinner ? '#f0d000' : '#ff4444',
      fontFamily: 'Georgia, serif',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 20,
      isWinner ? 'You are the greatest pirate on the seas!' : `${this.gameState?.players[winnerId]?.pirateName ?? 'Another pirate'} has taken the seas!`,
      { fontSize: '22px', color: '#ffffff', fontFamily: 'Georgia, serif' },
    ).setOrigin(0.5);

    const menuBtn = this.add.rectangle(width / 2, height / 2 + 100, 200, 50, 0x1a4a8a)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height / 2 + 100, 'MAIN MENU', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    menuBtn.on('pointerdown', () => {
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });

    void overlay;
  }
}
