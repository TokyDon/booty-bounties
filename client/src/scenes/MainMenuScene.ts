import Phaser from 'phaser';
import { SocketService } from '../services/SocketService';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  gold:       0xf0a000,
  goldDim:    0xa86f00,
  parchment:  0xf5e0b8,
  seaDeep:    0x0d2a4a,
  seaMid:     0x0d4a6a,
  seaLight:   0x1a6e8a,
  starWhite:  0xe8f0f8,
  textGold:   '#f0a000',
  textParch:  '#f5e0b8',
  textDark:   '#1a1008',
  textError:  '#ff6b6b',
  fontSerif:  '"Georgia", "Book Antiqua", serif',
};

export class MainMenuScene extends Phaser.Scene {
  private socketService!: SocketService;
  private waveGfx!: Phaser.GameObjects.Graphics;
  private waveTime = 0;
  private mode: 'login' | 'register' = 'login';
  private nameInput!: Phaser.GameObjects.DOMElement;
  private passInput!: Phaser.GameObjects.DOMElement;
  private errorText!: Phaser.GameObjects.Text;
  private modeToggle!: Phaser.GameObjects.Text;
  private submitBtn!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'MainMenuScene' }); }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.socketService = SocketService.getInstance();
    this.buildBackground(w, h);
    this.buildStars(w, h);
    this.buildShipSilhouette(w, h);
    this.waveGfx = this.add.graphics();
    this.drawWaves(w, h);
    this.buildFogBand(w, h);
    this.buildForm(w, h);
  }

  // ─── Environment ────────────────────────────────────────────────────────────

  private buildBackground(w: number, h: number): void {
    const g = this.add.graphics();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const r = Math.round(7 + t * 10);   const gg = Math.round(15 + t * 22);
      const b = Math.round(30 + t * 50);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gg, b));
      g.fillRect(0, Math.floor((i / 60) * h * 0.55), w, Math.ceil(h * 0.55 / 60) + 1);
    }
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const r = Math.round(10 + t * 5);   const gg = Math.round(30 + t * 20);
      const b = Math.round(60 + t * 30);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gg, b));
      g.fillRect(0, Math.floor(h * 0.55 + (i / 40) * h * 0.45), w, Math.ceil(h * 0.45 / 40) + 1);
    }
  }

  private buildStars(w: number, h: number): void {
    const g = this.add.graphics();
    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, Math.floor(h * 0.5));
      const size = Math.random() < 0.15 ? 1.5 : 0.8;
      g.fillStyle(C.starWhite, 0.3 + Math.random() * 0.7);
      g.fillCircle(x, y, size);
    }
    g.fillStyle(0xf0e8c0, 0.9);
    g.fillCircle(w * 0.82, h * 0.1, 28);
    g.fillStyle(0x0a1628, 0.88);
    g.fillCircle(w * 0.84, h * 0.09, 24);
  }

  private buildShipSilhouette(w: number, h: number): void {
    const g = this.add.graphics();
    this.drawShip(g, w * 0.15, h * 0.46, 0.65);
    this.drawShip(g, w * 0.78, h * 0.48, 0.45);
  }

  private drawShip(g: Phaser.GameObjects.Graphics, cx: number, wl: number, sc: number): void {
    g.fillStyle(0x050c18, 1);
    g.beginPath();
    g.moveTo(cx - 70 * sc, wl);      g.lineTo(cx - 80 * sc, wl + 8 * sc);
    g.lineTo(cx - 50 * sc, wl + 18 * sc); g.lineTo(cx + 50 * sc, wl + 18 * sc);
    g.lineTo(cx + 80 * sc, wl + 8 * sc);  g.lineTo(cx + 65 * sc, wl);
    g.closePath(); g.fillPath();
    g.fillRect(cx - 10 * sc, wl - 90 * sc, 3 * sc, 90 * sc);
    g.fillStyle(0x0d1e36, 1);
    g.beginPath();
    g.moveTo(cx - 8 * sc, wl - 85 * sc); g.lineTo(cx + 40 * sc, wl - 60 * sc);
    g.lineTo(cx + 36 * sc, wl - 15 * sc); g.lineTo(cx - 8 * sc, wl - 5 * sc);
    g.closePath(); g.fillPath();
    g.fillStyle(0x050c18, 1);
    g.fillRect(cx + 30 * sc, wl - 70 * sc, 3 * sc, 70 * sc);
    g.fillStyle(0x0d1e36, 1);
    g.beginPath();
    g.moveTo(cx + 32 * sc, wl - 66 * sc); g.lineTo(cx + 66 * sc, wl - 50 * sc);
    g.lineTo(cx + 62 * sc, wl - 18 * sc); g.lineTo(cx + 32 * sc, wl - 6 * sc);
    g.closePath(); g.fillPath();
  }

  private drawWaves(w: number, h: number): void {
    const g = this.waveGfx;
    g.clear();
    const t = this.waveTime;
    g.fillStyle(C.seaDeep, 1);
    g.fillRect(0, h * 0.5, w, h * 0.5);
    const rows = [
      { y: h * 0.50, sp: 0.3, amp: 4,  al: 0.4, col: C.seaMid  },
      { y: h * 0.56, sp: 0.5, amp: 6,  al: 0.5, col: C.seaMid  },
      { y: h * 0.64, sp: 0.7, amp: 8,  al: 0.6, col: C.seaLight },
      { y: h * 0.74, sp: 0.9, amp: 10, al: 0.5, col: C.seaLight },
      { y: h * 0.85, sp: 1.1, amp: 12, al: 0.4, col: 0x2a8eaa  },
    ];
    for (const r of rows) {
      g.lineStyle(2, r.col, r.al);
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const yo = Math.sin(x * 0.02 * r.sp + t * r.sp) * r.amp;
        x === 0 ? g.moveTo(x, r.y + yo) : g.lineTo(x, r.y + yo);
      }
      g.strokePath();
      g.fillStyle(0xe8f4fc, 0.12);
      for (let x = 0; x <= w; x += 80) {
        const yo = Math.sin(x * 0.02 * r.sp + t * r.sp) * r.amp;
        g.fillCircle((x + t * 30 * r.sp) % w, r.y + yo, 2);
      }
    }
  }

  private buildFogBand(w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x0a1e38, 0.35);
    g.fillRect(0, h * 0.42, w, h * 0.18);
  }

  // ─── Form ────────────────────────────────────────────────────────────────────

  private buildForm(w: number, h: number): void {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const cW = 420, cH = 360;

    // Outer ambient glow
    const glow = this.add.graphics();
    glow.fillStyle(C.gold, 0.05);
    glow.fillRoundedRect(cx - cW / 2 - 14, cy - cH / 2 - 14, cW + 28, cH + 28, 18);

    // Card body — parchment
    const card = this.add.graphics();
    card.fillStyle(C.parchment, 1);
    card.fillRoundedRect(cx - cW / 2, cy - cH / 2, cW, cH, 10);
    card.lineStyle(2, C.goldDim, 0.7);
    card.strokeRoundedRect(cx - cW / 2, cy - cH / 2, cW, cH, 10);
    // Rope stitch marks
    card.lineStyle(1, C.goldDim, 0.35);
    for (let x = cx - cW / 2 + 20; x < cx + cW / 2 - 10; x += 18) {
      card.strokeRect(x, cy - cH / 2 + 7, 7, 9);
    }

    // Supra-title
    this.add.text(cx, cy - cH / 2 - 50, '☠  AHOY, PIRATE  ☠', {
      fontSize: '13px', fontFamily: C.fontSerif,
      color: '#f0c040', letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0.8);

    // Main title
    this.add.text(cx, cy - cH / 2 + 48, 'BOOTY & BOUNTIES', {
      fontSize: '28px', fontFamily: C.fontSerif,
      color: C.textDark, fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5);

    // Gold divider
    const div = this.add.graphics();
    const dy = cy - cH / 2 + 70;
    div.lineStyle(1.5, C.gold, 0.8);
    div.lineBetween(cx - 130, dy, cx + 130, dy);
    div.fillStyle(C.gold, 1);
    for (const px of [cx - 130, cx, cx + 130]) div.fillCircle(px, dy, px === cx ? 5 : 3.5);

    // Subtitle
    this.add.text(cx, cy - cH / 2 + 88, 'Enter yer name and password, brave Pirate', {
      fontSize: '12px', fontFamily: C.fontSerif, color: '#5a4a30', fontStyle: 'italic',
    }).setOrigin(0.5);

    // Name label
    this.add.text(cx - cW / 2 + 22, cy - cH / 2 + 112, 'PIRATE NAME', {
      fontSize: '10px', fontFamily: C.fontSerif, color: '#5a4a30', fontStyle: 'bold', letterSpacing: 2,
    });

    // Name input
    this.nameInput = this.add.dom(cx, cy - cH / 2 + 148, 'input', this.inputCSS()).setOrigin(0.5);
    const nameEl = this.nameInput.node as HTMLInputElement;
    nameEl.placeholder = "Cap'n Blackbeard";
    nameEl.maxLength = 30;
    nameEl.setAttribute('autocomplete', 'username');

    // Password label
    this.add.text(cx - cW / 2 + 22, cy - cH / 2 + 175, 'SECRET PHRASE', {
      fontSize: '10px', fontFamily: C.fontSerif, color: '#5a4a30', fontStyle: 'bold', letterSpacing: 2,
    });

    // Password input
    this.passInput = this.add.dom(cx, cy - cH / 2 + 211, 'input', this.inputCSS()).setOrigin(0.5);
    const passEl = this.passInput.node as HTMLInputElement;
    passEl.type = 'password';
    passEl.placeholder = '••••••••';
    passEl.maxLength = 64;
    passEl.setAttribute('autocomplete', 'current-password');

    nameEl.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') passEl.focus(); });
    passEl.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') this.submit(); });

    // Error text
    this.errorText = this.add.text(cx, cy - cH / 2 + 240, '', {
      fontSize: '12px', fontFamily: C.fontSerif, color: C.textError, fontStyle: 'italic',
    }).setOrigin(0.5);

    // Submit
    this.submitBtn = this.buildGoldButton(cx, cy - cH / 2 + 276, 200, 40,
      'SET SAIL  ⚓', () => this.submit());

    // Mode toggle
    this.modeToggle = this.add.text(cx, cy - cH / 2 + 326,
      'New pirate? Join the crew →',
      { fontSize: '12px', fontFamily: C.fontSerif, color: C.textGold })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.modeToggle.on('pointerover', () => this.modeToggle.setAlpha(0.7));
    this.modeToggle.on('pointerout',  () => this.modeToggle.setAlpha(1));
    this.modeToggle.on('pointerdown', () => this.toggleMode());
  }

  private inputCSS(): string {
    return [
      'width: 340px', 'height: 36px',
      'background: rgba(26,16,8,0.82)',
      'border: 1px solid #a07828', 'border-radius: 4px',
      'color: #f5e0b8', 'font-size: 14px', 'font-family: Georgia,serif',
      'padding: 0 12px', 'outline: none', 'caret-color: #f0a000',
      'box-sizing: border-box',
    ].join('; ');
  }

  private buildGoldButton(x: number, y: number, bw: number, bh: number,
    label: string, cb: () => void): Phaser.GameObjects.Container {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-bw / 2 + 2, -bh / 2 + 2, bw, bh, 6);

    const bg = this.add.graphics();
    const drawBg = (col: number) => {
      bg.clear();
      bg.fillStyle(col, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      bg.lineStyle(1.5, 0xffffff, 0.18);
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

  // ─── Interactivity ───────────────────────────────────────────────────────────

  private toggleMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.errorText.setText('');
    const isLogin = this.mode === 'login';
    this.modeToggle.setText(isLogin ? 'New pirate? Join the crew →' : '← Already a sea dog? Login');
    const lbl = this.submitBtn.getAt(2) as Phaser.GameObjects.Text;
    lbl.setText(isLogin ? 'SET SAIL  ⚓' : 'JOIN THE CREW  ⚓');
  }

  private submit(): void {
    const nameEl = this.nameInput.node as HTMLInputElement;
    const passEl = this.passInput.node as HTMLInputElement;
    const name = nameEl.value.trim();
    const pass = passEl.value;

    if (name.length < 2) { this.errorText.setText('Pirate name must be at least 2 characters!'); return; }
    if (name.length > 30) { this.errorText.setText('Name too long, scoundrel (max 30)!'); return; }
    if (!/^[a-zA-Z0-9 _\-'!.]+$/.test(name)) { this.errorText.setText('Name contains illegal characters!'); return; }
    if (pass.length < 4) { this.errorText.setText('Password must be at least 4 characters!'); return; }
    if (pass.length > 64) { this.errorText.setText('Password too long (max 64)!'); return; }

    this.errorText.setText('');
    const lbl = this.submitBtn.getAt(2) as Phaser.GameObjects.Text;
    lbl.setText('⏳ Sailing...');

    const handleRes = (res: { success: boolean; playerId?: string; pirateName?: string; error?: string }) => {
      if (res.success) {
        this.scene.start('LobbyScene', { playerId: res.playerId, pirateName: res.pirateName });
      } else {
        this.errorText.setText(res.error ?? 'Something went wrong. Try again.');
        lbl.setText(this.mode === 'login' ? 'SET SAIL  ⚓' : 'JOIN THE CREW  ⚓');
      }
    };

    if (this.mode === 'login') {
      this.socketService.auth(name, pass, handleRes);
    } else {
      this.socketService.register(name, pass, handleRes);
    }
  }

  // ─── Loop ────────────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.waveTime += delta * 0.001;
    const { width: w, height: h } = this.scale;
    this.drawWaves(w, h);
  }
}
