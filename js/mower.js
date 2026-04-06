/**
 * Mower - procedural low-poly robot mower with movement physics.
 */
import * as THREE from 'three';

export class Mower {
    constructor(mowerDef) {
        this.def = mowerDef;
        this.speed = mowerDef.speed;
        this.turnSpeed = mowerDef.turnSpeed;
        this.cutWidth = mowerDef.cutWidth;
        this.running = false;
        this.angle = 0; // radians, 0 = facing +Z

        this.group = new THREE.Group();
        this._buildModel();
        this._bladeAngle = 0;
    }

    _buildModel() {
        const { color, accentColor } = this.def;

        // Body - rounded cylinder (roomba shape)
        const bodyGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.22, 16);
        const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.18;
        body.castShadow = true;
        this.group.add(body);

        // Top dome
        const domeGeo = new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshLambertMaterial({ color: accentColor, flatShading: true });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 0.29;
        dome.castShadow = true;
        this.group.add(dome);

        // "Eyes" - two small lights on front
        const eyeGeo = new THREE.SphereGeometry(0.05, 6, 4);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, emissive: 0xCCCCCC });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, 0.25, 0.38);
        this.group.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.set(0.15, 0.25, 0.38);
        this.group.add(eyeR);
        this._eyes = [eyeL, eyeR];

        // Wheels (4 small cylinders)
        const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x424242 });
        const wheelPositions = [
            [-0.35, 0.08, 0.25],
            [0.35, 0.08, 0.25],
            [-0.35, 0.08, -0.25],
            [0.35, 0.08, -0.25],
        ];
        this._wheels = [];
        for (const [x, y, z] of wheelPositions) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(x, y, z);
            wheel.rotation.z = Math.PI / 2;
            this.group.add(wheel);
            this._wheels.push(wheel);
        }

        // Blade disc (underneath, visible when running)
        const bladeGeo = new THREE.CircleGeometry(this.cutWidth / 2, 3);
        const bladeMat = new THREE.MeshLambertMaterial({
            color: 0x9E9E9E,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0
        });
        this._blade = new THREE.Mesh(bladeGeo, bladeMat);
        this._blade.rotation.x = -Math.PI / 2;
        this._blade.position.y = 0.04;
        this.group.add(this._blade);
        this._bladeMat = bladeMat;

        // Shadow disc
        const shadowGeo = new THREE.CircleGeometry(0.5, 16);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        this.group.add(shadow);
    }

    /** Set the terrain query functions (called by Game after yard is created) */
    setTerrain(getHeightAt, getNormalAt) {
        this._getHeightAt = getHeightAt;
        this._getNormalAt = getNormalAt;
    }

    setPosition(x, z) {
        this.group.position.x = x;
        this.group.position.z = z;
        if (this._getHeightAt) {
            this.group.position.y = this._getHeightAt(x, z);
        }
    }

    getPosition() {
        return { x: this.group.position.x, z: this.group.position.z };
    }

    update(dt, targetAngle, hasTarget, bounds, obstacles) {
        // Animate blade
        if (this.running) {
            this._bladeAngle += dt * 15;
            this._blade.rotation.z = this._bladeAngle;
            this._bladeMat.opacity = 0.4;

            // Eye glow when running
            this._eyes.forEach(e => {
                e.material.emissive.setHex(0x66FF66);
            });
        } else {
            this._bladeMat.opacity = 0.0;
            this._eyes.forEach(e => {
                e.material.emissive.setHex(0xCCCCCC);
            });
        }

        // Wheel rotation
        if (this.running) {
            this._wheels.forEach(w => {
                w.rotation.x += dt * this.speed * 5;
            });
        }

        if (!this.running) return;

        // Steering - smooth rotation toward the target angle from controls
        if (hasTarget) {
            let diff = targetAngle - this.angle;
            // Normalize to -PI..PI
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const maxTurn = this.turnSpeed * dt;
            this.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
        }

        {
            // Always move forward when running (self-propelled robot)
            const moveSpeed = this.speed * dt;
            const newX = this.group.position.x + Math.sin(this.angle) * moveSpeed;
            const newZ = this.group.position.z + Math.cos(this.angle) * moveSpeed;

            // Collision with bounds
            const margin = 0.5;
            const clampedX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, newX));
            const clampedZ = Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, newZ));

            // Collision with obstacles
            let blocked = false;
            for (const obs of obstacles) {
                if (this._collidesWithObstacle(clampedX, clampedZ, obs)) {
                    blocked = true;
                    break;
                }
            }

            if (!blocked) {
                this.group.position.x = clampedX;
                this.group.position.z = clampedZ;
            } else {
                // Try sliding along axes
                let slideX = this.group.position.x;
                let slideZ = this.group.position.z;

                let blockedX = false;
                for (const obs of obstacles) {
                    if (this._collidesWithObstacle(clampedX, this.group.position.z, obs)) {
                        blockedX = true;
                        break;
                    }
                }
                if (!blockedX) slideX = clampedX;

                let blockedZ = false;
                for (const obs of obstacles) {
                    if (this._collidesWithObstacle(this.group.position.x, clampedZ, obs)) {
                        blockedZ = true;
                        break;
                    }
                }
                if (!blockedZ) slideZ = clampedZ;

                this.group.position.x = slideX;
                this.group.position.z = slideZ;
            }
        }

        // Apply rotation
        this.group.rotation.y = this.angle;

        // Terrain following: set Y position and tilt to match surface
        if (this._getHeightAt) {
            const tx = this.group.position.x;
            const tz = this.group.position.z;
            const terrainY = this._getHeightAt(tx, tz);
            // Small bob on top of terrain height
            this.group.position.y = terrainY + Math.sin(Date.now() * 0.006) * 0.01;

            // Tilt mower to match terrain normal
            if (this._getNormalAt) {
                const normal = this._getNormalAt(tx, tz);
                // Create a rotation that aligns the mower's up vector with the terrain normal
                // while preserving the heading (rotation.y)
                const up = new THREE.Vector3(0, 1, 0);
                const qTilt = new THREE.Quaternion().setFromUnitVectors(up, normal);
                const qHeading = new THREE.Quaternion().setFromAxisAngle(up, this.angle);
                // Apply heading first, then tilt
                const qFinal = qTilt.multiply(qHeading);
                this.group.quaternion.copy(qFinal);
            }
        } else {
            this.group.position.y = Math.sin(Date.now() * 0.006) * 0.015;
        }
    }

    _collidesWithObstacle(x, z, obs) {
        const r = 0.5; // mower radius
        const dx = x - obs.x;
        const dz = z - obs.z;

        if (obs.type === 'circle') {
            return (dx * dx + dz * dz) < (r + obs.r) * (r + obs.r);
        } else if (obs.type === 'rect') {
            const hw = obs.w / 2 + r;
            const hh = obs.h / 2 + r;
            return Math.abs(dx) < hw && Math.abs(dz) < hh;
        }
        return false;
    }
}
