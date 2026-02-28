import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show a minimal loading bar while assets load
    const { width, height } = this.scale;
    const barBg = this.add.rectangle(width / 2, height / 2, 400, 20, 0x1a2a4a);
    const bar = this.add.rectangle(width / 2 - 200, height / 2, 0, 16, 0xf0a000);
    bar.setOrigin(0, 0.5);

    const title = this.add.text(width / 2, height / 2 - 60, '⚓ BOOTY & BOUNTIES', {
      fontSize: '36px',
      color: '#f0a000',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.width = 400 * value;
    });

    this.load.on('complete', () => {
      title.destroy();
      barBg.destroy();
      bar.destroy();
    });

    // Generate placeholder assets programmatically (no external files needed to start)
    this.generatePlaceholderTextures();
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }

  private generatePlaceholderTextures(): void {
    // Ocean hex tile
    const oceanGfx = this.add.graphics();
    this.drawHex(oceanGfx, 40, 0x0a3060, 0x0d4a8a);
    oceanGfx.generateTexture('hex-ocean', 80, 80);
    oceanGfx.destroy();

    // Island hex tile
    const islandGfx = this.add.graphics();
    this.drawHex(islandGfx, 40, 0x2d5a1b, 0x4a8a30);
    islandGfx.generateTexture('hex-island', 80, 80);
    islandGfx.destroy();

    // Port hex tile
    const portGfx = this.add.graphics();
    this.drawHex(portGfx, 40, 0x5a3a10, 0x8a6020);
    portGfx.generateTexture('hex-port', 80, 80);
    portGfx.destroy();

    // Ship sprite (simple placeholder)
    const shipGfx = this.add.graphics();
    shipGfx.fillStyle(0xffffff);
    shipGfx.fillTriangle(20, 0, 0, 40, 40, 40);
    shipGfx.fillStyle(0xc8a000);
    shipGfx.fillRect(16, 8, 8, 24);
    shipGfx.generateTexture('ship-player', 40, 40);
    shipGfx.destroy();

    // NPC ship
    const npcGfx = this.add.graphics();
    npcGfx.fillStyle(0xff4444);
    npcGfx.fillTriangle(20, 0, 0, 40, 40, 40);
    npcGfx.generateTexture('ship-npc', 40, 40);
    npcGfx.destroy();

    // Fog of war tile
    const fogGfx = this.add.graphics();
    this.drawHex(fogGfx, 40, 0x050a14, 0x050a14);
    fogGfx.generateTexture('hex-fog', 80, 80);
    fogGfx.destroy();

    // Loot drop marker
    const lootGfx = this.add.graphics();
    lootGfx.fillStyle(0xf0d000);
    lootGfx.fillCircle(16, 16, 12);
    lootGfx.lineStyle(2, 0xffffff);
    lootGfx.strokeCircle(16, 16, 12);
    lootGfx.generateTexture('loot-marker', 32, 32);
    lootGfx.destroy();
  }

  private drawHex(gfx: Phaser.GameObjects.Graphics, size: number, fillColor: number, strokeColor: number): void {
    const cx = size, cy = size;
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(cx + size * Math.cos(angle), cy + size * Math.sin(angle));
    }
    gfx.fillStyle(fillColor, 1);
    gfx.fillPoints(
      points.reduce<Phaser.Geom.Point[]>((acc, _, idx) => {
        if (idx % 2 === 0) acc.push(new Phaser.Geom.Point(points[idx], points[idx + 1]));
        return acc;
      }, []),
      true,
    );
    gfx.lineStyle(2, strokeColor, 1);
    gfx.strokePoints(
      points.reduce<Phaser.Geom.Point[]>((acc, _, idx) => {
        if (idx % 2 === 0) acc.push(new Phaser.Geom.Point(points[idx], points[idx + 1]));
        return acc;
      }, []),
      true,
    );
  }
}

