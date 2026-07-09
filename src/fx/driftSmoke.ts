import * as THREE from 'three';

// Pooled sprite puffs emitted at the rear wheels while drifting: they rise, expand,
// and fade. Tint follows the drift charge tier so the smoke doubles as feedback.
const POOL_SIZE = 60;
const PARTICLE_LIFE_S = 0.7;
const EMIT_INTERVAL_S = 0.03;

interface Puff {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  alive: boolean;
}

const TIER_TINTS = [0xdddddd, 0x7dd3fc, 0xfdba74, 0xd8b4fe];

export class DriftSmoke {
  private pool: Puff[] = [];
  private emitAccumulator = 0;

  constructor(scene: THREE.Scene) {
    const texture = makePuffTexture();
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, velocity: new THREE.Vector3(), age: 0, alive: false });
    }
  }

  update(dt: number, emitting: boolean, emitPositions: THREE.Vector3[], tier: number): void {
    if (emitting) {
      this.emitAccumulator += dt;
      while (this.emitAccumulator >= EMIT_INTERVAL_S) {
        this.emitAccumulator -= EMIT_INTERVAL_S;
        for (const pos of emitPositions) {
          this.spawn(pos, tier);
        }
      }
    } else {
      this.emitAccumulator = 0;
    }

    for (const puff of this.pool) {
      if (!puff.alive) continue;
      puff.age += dt;
      if (puff.age >= PARTICLE_LIFE_S) {
        puff.alive = false;
        puff.sprite.visible = false;
        continue;
      }
      const lifeFrac = puff.age / PARTICLE_LIFE_S;
      puff.sprite.position.addScaledVector(puff.velocity, dt);
      const scale = 0.5 + lifeFrac * 1.6;
      puff.sprite.scale.set(scale, scale, 1);
      (puff.sprite.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - lifeFrac);
    }
  }

  private spawn(position: THREE.Vector3, tier: number): void {
    const puff = this.pool.find((p) => !p.alive);
    if (!puff) return;
    puff.alive = true;
    puff.age = 0;
    puff.sprite.visible = true;
    puff.sprite.position.copy(position).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3)
    );
    puff.velocity.set((Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
    (puff.sprite.material as THREE.SpriteMaterial).color.setHex(TIER_TINTS[tier] ?? TIER_TINTS[0]);
  }
}

function makePuffTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
