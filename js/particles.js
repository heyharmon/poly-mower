/**
 * Grass clipping particle system.
 * Small green quads spray from behind the mower when cutting.
 */
import * as THREE from 'three';

const MAX_PARTICLES = 200;
const PARTICLE_LIFE = 0.8; // seconds

export class GrassParticles {
    constructor() {
        this._particles = [];
        this._pool = [];

        // Shared geometry and material
        const geo = new THREE.PlaneGeometry(0.04, 0.06);
        this._materials = [];
        const greens = [0x7CB342, 0x689F38, 0x558B2F, 0x9CCC65, 0x8BC34A];
        for (const c of greens) {
            this._materials.push(new THREE.MeshBasicMaterial({
                color: c,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: false,
            }));
        }
        this._geo = geo;

        this.group = new THREE.Group();
    }

    /**
     * Emit a burst of grass clippings from a position.
     * @param {number} x - world x
     * @param {number} y - world y (terrain height)
     * @param {number} z - world z
     * @param {number} angle - mower heading (radians)
     */
    emit(x, y, z, angle, count) {
        for (let i = 0; i < count; i++) {
            let p;
            if (this._pool.length > 0) {
                p = this._pool.pop();
                p.mesh.visible = true;
            } else if (this._particles.length < MAX_PARTICLES) {
                const mat = this._materials[Math.floor(Math.random() * this._materials.length)].clone();
                const mesh = new THREE.Mesh(this._geo, mat);
                this.group.add(mesh);
                p = { mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0 };
            } else {
                // Recycle oldest
                p = this._particles.shift();
            }

            // Spray from behind/sides of the mower
            const spread = (Math.random() - 0.5) * 1.8;
            const backAngle = angle + Math.PI + spread;
            const speed = 1.5 + Math.random() * 2.5;

            p.mesh.position.set(x, y + 0.1, z);
            p.vx = Math.sin(backAngle) * speed;
            p.vy = 1.5 + Math.random() * 2.0;
            p.vz = Math.cos(backAngle) * speed;
            p.life = 0;
            p.maxLife = PARTICLE_LIFE * (0.6 + Math.random() * 0.4);

            // Random rotation for visual variety
            p.mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            p.spinX = (Math.random() - 0.5) * 10;
            p.spinY = (Math.random() - 0.5) * 10;

            // Random scale
            const s = 0.5 + Math.random() * 1.0;
            p.mesh.scale.set(s, s, s);

            this._particles.push(p);
        }
    }

    update(dt) {
        const gravity = -8;
        let i = this._particles.length;
        while (i--) {
            const p = this._particles[i];
            p.life += dt;

            if (p.life >= p.maxLife) {
                p.mesh.visible = false;
                this._particles.splice(i, 1);
                this._pool.push(p);
                continue;
            }

            // Physics
            p.vy += gravity * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;

            // Don't go below ground
            if (p.mesh.position.y < 0.02) {
                p.mesh.position.y = 0.02;
                p.vy = 0;
                p.vx *= 0.8;
                p.vz *= 0.8;
            }

            // Spin
            p.mesh.rotation.x += p.spinX * dt;
            p.mesh.rotation.y += p.spinY * dt;

            // Fade out
            const t = p.life / p.maxLife;
            p.mesh.material.opacity = 1 - t * t;

            // Air resistance
            p.vx *= (1 - 2 * dt);
            p.vz *= (1 - 2 * dt);
        }
    }

    dispose() {
        for (const p of this._particles) {
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        for (const p of this._pool) {
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
    }
}
