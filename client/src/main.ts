import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#070f1e',
  scene: [BootScene, MainMenuScene, GameScene, UIScene],
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

// ── HiDPI text sharpness patch ─────────────────────────────────────────────
// Phaser Text objects default to resolution 1, causing blurry text on HiDPI
// / Retina screens. Patch the factory globally so every this.add.text() call
// automatically renders at the device's physical pixel ratio.
const _dpr = window.devicePixelRatio || 1;
if (_dpr > 1) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _origText = (Phaser.GameObjects.GameObjectFactory.prototype as any).text as Function;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (
    x: number, y: number,
    text: string | string[],
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) {
    return _origText.call(this, x, y, text, { resolution: _dpr, ...style });
  };
}

new Phaser.Game(config);
