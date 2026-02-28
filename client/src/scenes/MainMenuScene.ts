import Phaser from 'phaser';
import { SocketService } from '../services/SocketService';

export class MainMenuScene extends Phaser.Scene {
  private socketService!: SocketService;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.socketService = SocketService.getInstance();
    this.buildUI();
  }

  private buildUI(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Background
    this.add.rectangle(0, 0, width, height, 0x0a1628).setOrigin(0);

    // Ocean wave effect (simple animated lines)
    this.createWaveEffect();

    // Title
    this.add.text(cx, 100, '⚓ BOOTY & BOUNTIES', {
      fontSize: '52px',
      color: '#f0a000',
      fontFamily: 'Georgia, serif',
      stroke: '#4a2000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, 160, 'Rule the High Seas', {
      fontSize: '22px',
      color: '#a0c8f0',
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Login / Register form container
    const formBg = this.add.rectangle(cx, height / 2 + 20, 440, 320, 0x0d1e36, 0.95);
    formBg.setStrokeStyle(2, 0x2a4a7a);

    this.add.text(cx, height / 2 - 120, 'Enter Pirate Quarters', {
      fontSize: '22px',
      color: '#f0d080',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    // Pirate name input
    this.add.text(cx - 180, height / 2 - 80, 'Pirate Name:', {
      fontSize: '16px',
      color: '#a0c8f0',
    });

    const nameInput = this.createInputField(cx, height / 2 - 56, 'e.g. Long John Silver');

    // Password input
    this.add.text(cx - 180, height / 2 - 18, 'Password:', {
      fontSize: '16px',
      color: '#a0c8f0',
    });

    const passInput = this.createInputField(cx, height / 2 + 6, '••••••••', true);

    // Error text
    const errorText = this.add.text(cx, height / 2 + 52, '', {
      fontSize: '14px',
      color: '#ff6060',
    }).setOrigin(0.5);

    // Login button
    this.createButton(cx - 80, height / 2 + 96, 'SET SAIL', 0x1a4a8a, () => {
      const name = nameInput.getData('value') as string;
      const pass = passInput.getData('value') as string;
      if (!name || !pass) {
        errorText.setText('Enter a pirate name and password!');
        return;
      }
      this.doLogin(name, pass, errorText);
    });

    // Register button
    this.createButton(cx + 80, height / 2 + 96, 'NEW PIRATE', 0x1a5a2a, () => {
      const name = nameInput.getData('value') as string;
      const pass = passInput.getData('value') as string;
      if (!name || !pass) {
        errorText.setText('Enter a pirate name and password!');
        return;
      }
      this.doRegister(name, pass, errorText);
    });
  }

  private createInputField(x: number, y: number, placeholder: string, _isPassword = false): Phaser.GameObjects.Text {
    const bg = this.add.rectangle(x, y, 360, 34, 0x0a2040).setOrigin(0.5);
    bg.setStrokeStyle(1, 0x2a5a8a);

    const text = this.add.text(x - 170, y, placeholder, {
      fontSize: '15px',
      color: '#506070',
      fixedWidth: 340,
      fixedHeight: 30,
    }).setOrigin(0, 0.5);
    text.setData('value', '');
    text.setData('placeholder', placeholder);
    text.setData('isPassword', _isPassword);

    // Use DOM input for real text input
    const domInput = document.createElement('input');
    domInput.type = _isPassword ? 'password' : 'text';
    domInput.placeholder = placeholder;
    domInput.style.cssText = `
      position: absolute;
      background: transparent;
      border: none;
      outline: none;
      color: #e0f0ff;
      font-size: 15px;
      font-family: Georgia, serif;
      width: 340px;
      height: 30px;
      padding: 0 8px;
      caret-color: #f0a000;
    `;
    this.game.canvas.parentElement?.appendChild(domInput);

    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.width;
    const scaleY = rect.height / this.scale.height;

    this.scale.on('resize', () => {
      const r = this.game.canvas.getBoundingClientRect();
      const sx = r.width / this.scale.width;
      const sy = r.height / this.scale.height;
      domInput.style.left = `${r.left + (x - 180) * sx}px`;
      domInput.style.top = `${r.top + (y - 15) * sy}px`;
      domInput.style.width = `${340 * sx}px`;
      domInput.style.height = `${30 * sy}px`;
    });

    domInput.style.left = `${rect.left + (x - 180) * scaleX}px`;
    domInput.style.top = `${rect.top + (y - 15) * scaleY}px`;

    domInput.addEventListener('input', () => {
      text.setData('value', domInput.value);
      text.setText(domInput.value.length > 0 ? (_isPassword ? '•'.repeat(domInput.value.length) : domInput.value) : placeholder);
      text.setColor(domInput.value.length > 0 ? '#e0f0ff' : '#506070');
    });

    this.events.once('shutdown', () => domInput.remove());
    this.events.once('destroy', () => domInput.remove());

    return text;
  }

  private createButton(x: number, y: number, label: string, color: number, callback: () => void): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 150, 44, color).setStrokeStyle(2, 0xffffff, 0.4);
    const txt = this.add.text(0, 0, label, {
      fontSize: '15px',
      color: '#ffffff',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, txt]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.ValueToColor(color).lighten(20).color));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', callback);
    return container;
  }

  private doLogin(name: string, pass: string, errorText: Phaser.GameObjects.Text): void {
    this.socketService.auth(name, pass, (res) => {
      if (res.success) {
        this.scene.start('GameScene', { playerId: res.playerId, pirateName: res.pirateName });
        this.scene.start('UIScene', { playerId: res.playerId, pirateName: res.pirateName });
        this.scene.stop();
      } else {
        errorText.setText(res.error ?? 'Login failed');
      }
    });
  }

  private doRegister(name: string, pass: string, errorText: Phaser.GameObjects.Text): void {
    this.socketService.register(name, pass, (res) => {
      if (res.success) {
        this.scene.start('GameScene', { playerId: res.playerId, pirateName: res.pirateName });
        this.scene.start('UIScene', { playerId: res.playerId, pirateName: res.pirateName });
        this.scene.stop();
      } else {
        errorText.setText(res.error ?? 'Registration failed');
      }
    });
  }

  private createWaveEffect(): void {
    const gfx = this.add.graphics();
    let t = 0;
    this.events.on('update', () => {
      t += 0.02;
      gfx.clear();
      gfx.lineStyle(1, 0x0d3a6a, 0.3);
      for (let y = 600; y < 720; y += 20) {
        gfx.beginPath();
        for (let x = 0; x <= 1280; x += 8) {
          const yOff = Math.sin(x * 0.02 + t + y * 0.01) * 5;
          if (x === 0) gfx.moveTo(x, y + yOff);
          else gfx.lineTo(x, y + yOff);
        }
        gfx.strokePath();
      }
    });
  }
}
