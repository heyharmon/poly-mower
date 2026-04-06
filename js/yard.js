/**
 * Yard - generates the 3D scene for a level including grass grid,
 * fences, obstacles, and decorations. Tracks mowing progress.
 */
import * as THREE from 'three';

export class Yard {
    constructor(levelDef) {
        this.def = levelDef;
        this.group = new THREE.Group();

        this.grassCells = [];
        this.totalCells = 0;
        this.mowedCount = 0;

        // Collision shapes for the mower
        this.colliders = [];

        this._buildGround();
        this._buildFence();
        this._buildGrass();
        this._buildObstacles();
        this._buildDecorations();
    }

    getBounds() {
        const hw = this.def.yardWidth / 2;
        const hh = this.def.yardHeight / 2;
        return { minX: -hw, maxX: hw, minZ: -hh, maxZ: hh };
    }

    getProgress() {
        return this.totalCells > 0 ? this.mowedCount / this.totalCells : 0;
    }

    mowAt(x, z, cutWidth) {
        const halfCut = cutWidth / 2;
        let newlyMowed = 0;
        const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

        for (const cell of this.grassCells) {
            if (cell.mowed) continue;
            const dx = Math.abs(cell.x - x);
            const dz = Math.abs(cell.z - z);
            if (dx < halfCut && dz < halfCut) {
                cell.mowed = true;
                // Hide all blade instances for this cell
                for (const idx of cell.bladeIndices) {
                    this._grassMesh.setMatrixAt(idx, _zero);
                }
                this._grassMesh.instanceMatrix.needsUpdate = true;
                this.mowedCount++;
                newlyMowed++;
            }
        }
        return newlyMowed;
    }

    _buildGround() {
        // Base ground plane - dirt outside the yard
        const outerGeo = new THREE.PlaneGeometry(this.def.yardWidth + 4, this.def.yardHeight + 4);
        const outerMat = new THREE.MeshLambertMaterial({
            color: 0xD2B48C,
            flatShading: true,
        });
        const outerGround = new THREE.Mesh(outerGeo, outerMat);
        outerGround.rotation.x = -Math.PI / 2;
        outerGround.position.y = -0.06;
        outerGround.receiveShadow = true;
        this.group.add(outerGround);

        // Mowed lawn base - the fresh-cut color visible when grass blades are removed
        const lawnGeo = new THREE.PlaneGeometry(this.def.yardWidth, this.def.yardHeight);
        const lawnMat = new THREE.MeshLambertMaterial({
            color: this.def.mowedColor,
            flatShading: true,
        });
        const lawn = new THREE.Mesh(lawnGeo, lawnMat);
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.y = -0.03;
        lawn.receiveShadow = true;
        this.group.add(lawn);
    }

    _buildGrass() {
        const { yardWidth, yardHeight, grassResolution, groundColor } = this.def;
        const res = grassResolution;
        const hw = yardWidth / 2;
        const hh = yardHeight / 2;

        // Grass blade geometry - tall, slightly curved quad (2 triangles)
        // Taller than the mower (~0.3 high), like thick overgrown weeds
        const bladeGeo = new THREE.BufferGeometry();
        const bladeW = 0.06;   // wider blades
        const bladeH = 0.55;   // tall - well above the mower
        const bladeMid = bladeH * 0.55;
        const bladeBend = 0.03; // slight forward bend at midpoint
        const vertices = new Float32Array([
            // Lower triangle
            -bladeW, 0, 0,
             bladeW, 0, 0,
             bladeW * 0.7, bladeMid, bladeBend,
            // Upper triangle (tapers to tip)
            -bladeW, 0, 0,
             bladeW * 0.7, bladeMid, bladeBend,
            -bladeW * 0.7, bladeMid, bladeBend,
            // Mid-to-tip triangle (front face)
            -bladeW * 0.7, bladeMid, bladeBend,
             bladeW * 0.7, bladeMid, bladeBend,
             0, bladeH, bladeBend * 2.5,
        ]);
        bladeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        bladeGeo.computeVertexNormals();

        const BLADES_PER_CELL = 14;  // thick dense grass

        // First pass: count valid cells
        const cells = [];
        for (let x = -hw + res / 2; x < hw; x += res) {
            for (let z = -hh + res / 2; z < hh; z += res) {
                if (!this._isObstacleAt(x, z)) {
                    cells.push({ x, z });
                }
            }
        }

        const totalInstances = cells.length * BLADES_PER_CELL;

        // Grass color variations - wide range for natural thick grass look
        const baseColor = new THREE.Color(groundColor);
        const grassColors = [];
        for (let i = 0; i < 12; i++) {
            const c = baseColor.clone();
            c.offsetHSL(
                (Math.random() - 0.5) * 0.08,   // hue shift
                (Math.random() - 0.5) * 0.15,    // saturation
                (Math.random() - 0.5) * 0.12     // lightness - some dark, some bright
            );
            grassColors.push(c);
        }

        const grassMat = new THREE.MeshLambertMaterial({
            color: groundColor,
            flatShading: true,
            side: THREE.DoubleSide,
        });

        // Create InstancedMesh
        const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, totalInstances);
        grassMesh.receiveShadow = true;
        grassMesh.castShadow = true;

        // Set up per-instance colors
        const colorArray = new Float32Array(totalInstances * 3);

        const _matrix = new THREE.Matrix4();
        const _position = new THREE.Vector3();
        const _rotation = new THREE.Euler();
        const _quaternion = new THREE.Quaternion();
        const _scale = new THREE.Vector3();

        let instanceIdx = 0;

        for (const cell of cells) {
            const bladeIndices = [];

            for (let b = 0; b < BLADES_PER_CELL; b++) {
                // Spread blades across the full cell with some overlap
                const ox = (Math.random() - 0.5) * res * 1.0;
                const oz = (Math.random() - 0.5) * res * 1.0;

                _position.set(cell.x + ox, 0, cell.z + oz);

                // Random rotation + lean for wild overgrown look
                _rotation.set(
                    (Math.random() - 0.5) * 0.4,   // lean forward/back
                    Math.random() * Math.PI * 2,     // full Y rotation
                    (Math.random() - 0.5) * 0.3      // lean side to side
                );
                _quaternion.setFromEuler(_rotation);

                // Height variation - most are tall, some shorter
                const heightVar = 0.7 + Math.random() * 0.6;
                // Width variation too
                const widthVar = 0.8 + Math.random() * 0.5;
                _scale.set(widthVar, heightVar, widthVar);

                _matrix.compose(_position, _quaternion, _scale);
                grassMesh.setMatrixAt(instanceIdx, _matrix);

                // Per-instance color
                const col = grassColors[Math.floor(Math.random() * grassColors.length)];
                colorArray[instanceIdx * 3] = col.r;
                colorArray[instanceIdx * 3 + 1] = col.g;
                colorArray[instanceIdx * 3 + 2] = col.b;

                bladeIndices.push(instanceIdx);
                instanceIdx++;
            }

            this.grassCells.push({
                x: cell.x,
                z: cell.z,
                mowed: false,
                bladeIndices,
            });
            this.totalCells++;
        }

        // Apply instance colors
        grassMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
        grassMesh.instanceMatrix.needsUpdate = true;

        this._grassMesh = grassMesh;
        this.group.add(grassMesh);
    }

    _isObstacleAt(x, z) {
        for (const obs of this.def.obstacles) {
            if (obs.type === 'tree' || obs.type === 'rock' || obs.type === 'sandbox') {
                const r = (obs.scale || 1) * 0.8;
                if (Math.abs(x - obs.x) < r && Math.abs(z - obs.z) < r) return true;
            } else if (obs.type === 'flowerbed' || obs.type === 'pool' || obs.type === 'hedge') {
                const hw = (obs.w || 1) / 2 + 0.2;
                const hh = (obs.h || 1) / 2 + 0.2;
                if (Math.abs(x - obs.x) < hw && Math.abs(z - obs.z) < hh) return true;
            }
        }
        // Also check decorations
        for (const dec of (this.def.decorations || [])) {
            if (dec.type === 'house') {
                const s = (dec.scale || 1);
                if (Math.abs(x - dec.x) < 3 * s && Math.abs(z - dec.z) < 2 * s) return true;
            }
        }
        return false;
    }

    _buildFence() {
        const { yardWidth, yardHeight, fenceColor } = this.def;
        const hw = yardWidth / 2;
        const hh = yardHeight / 2;
        const postH = 0.6;
        const railH = 0.08;

        const postGeo = new THREE.BoxGeometry(0.12, postH, 0.12);
        const railGeo = new THREE.BoxGeometry(0.06, railH, 0.06);
        const mat = new THREE.MeshLambertMaterial({ color: fenceColor, flatShading: true });

        const spacing = 1.5;

        // Build fence along all 4 sides
        const sides = [
            { start: [-hw, -hh], end: [hw, -hh], axis: 'x' },
            { start: [-hw, hh], end: [hw, hh], axis: 'x' },
            { start: [-hw, -hh], end: [-hw, hh], axis: 'z' },
            { start: [hw, -hh], end: [hw, hh], axis: 'z' },
        ];

        for (const side of sides) {
            const isX = side.axis === 'x';
            const len = isX ? yardWidth : yardHeight;
            const numPosts = Math.floor(len / spacing) + 1;

            for (let i = 0; i < numPosts; i++) {
                const t = i / (numPosts - 1);
                const x = side.start[0] + (side.end[0] - side.start[0]) * t;
                const z = side.start[1] + (side.end[1] - side.start[1]) * t;

                const post = new THREE.Mesh(postGeo, mat);
                post.position.set(x, postH / 2, z);
                post.castShadow = true;
                this.group.add(post);
            }

            // Horizontal rails
            for (const railY of [postH * 0.35, postH * 0.7]) {
                const railLen = len;
                const rGeo = isX
                    ? new THREE.BoxGeometry(railLen, railH, 0.04)
                    : new THREE.BoxGeometry(0.04, railH, railLen);
                const rail = new THREE.Mesh(rGeo, mat);
                const mx = (side.start[0] + side.end[0]) / 2;
                const mz = (side.start[1] + side.end[1]) / 2;
                rail.position.set(mx, railY, mz);
                this.group.add(rail);
            }
        }
    }

    _buildObstacles() {
        for (const obs of this.def.obstacles) {
            switch (obs.type) {
                case 'tree': this._buildTree(obs); break;
                case 'rock': this._buildRock(obs); break;
                case 'flowerbed': this._buildFlowerbed(obs); break;
                case 'sandbox': this._buildSandbox(obs); break;
                case 'pool': this._buildPool(obs); break;
                case 'hedge': this._buildHedge(obs); break;
            }
        }
    }

    _buildTree(obs) {
        const s = obs.scale || 1;
        const g = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.2 * s, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.6 * s;
        trunk.castShadow = true;
        g.add(trunk);

        // Canopy - stacked cones for low-poly look
        const colors = [0x66BB6A, 0x43A047, 0x2E7D32];
        for (let i = 0; i < 3; i++) {
            const r = (0.8 - i * 0.18) * s;
            const h = (0.7 - i * 0.1) * s;
            const y = (1.0 + i * 0.45) * s;
            const coneGeo = new THREE.ConeGeometry(r, h, 6);
            const coneMat = new THREE.MeshLambertMaterial({ color: colors[i], flatShading: true });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.y = y;
            cone.castShadow = true;
            g.add(cone);
        }

        g.position.set(obs.x, 0, obs.z);
        this.group.add(g);

        this.colliders.push({ type: 'circle', x: obs.x, z: obs.z, r: 0.4 * s });
    }

    _buildRock(obs) {
        const s = obs.scale || 1;
        const geo = new THREE.DodecahedronGeometry(0.35 * s, 0);
        const mat = new THREE.MeshLambertMaterial({ color: 0xBDBDBD, flatShading: true });
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(obs.x, 0.2 * s, obs.z);
        rock.rotation.set(0.3, 0.7, 0.2);
        rock.scale.y = 0.6;
        rock.castShadow = true;
        this.group.add(rock);

        this.colliders.push({ type: 'circle', x: obs.x, z: obs.z, r: 0.35 * s });
    }

    _buildFlowerbed(obs) {
        const w = obs.w || 2;
        const h = obs.h || 1;

        // Border
        const borderGeo = new THREE.BoxGeometry(w + 0.2, 0.15, h + 0.2);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0x795548, flatShading: true });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(obs.x, 0.07, obs.z);
        this.group.add(border);

        // Soil
        const soilGeo = new THREE.BoxGeometry(w, 0.1, h);
        const soilMat = new THREE.MeshLambertMaterial({ color: 0x5D4037, flatShading: true });
        const soil = new THREE.Mesh(soilGeo, soilMat);
        soil.position.set(obs.x, 0.1, obs.z);
        this.group.add(soil);

        // Flowers - scattered small spheres
        const flowerColors = [0xEF5350, 0xFFCA28, 0xAB47BC, 0xFF7043, 0xEC407A];
        const numFlowers = Math.floor(w * h * 3);
        for (let i = 0; i < numFlowers; i++) {
            const fx = obs.x + (Math.random() - 0.5) * (w * 0.8);
            const fz = obs.z + (Math.random() - 0.5) * (h * 0.8);
            const fGeo = new THREE.SphereGeometry(0.06, 5, 3);
            const fMat = new THREE.MeshLambertMaterial({
                color: flowerColors[i % flowerColors.length],
                flatShading: true,
            });
            const flower = new THREE.Mesh(fGeo, fMat);
            flower.position.set(fx, 0.2 + Math.random() * 0.08, fz);
            this.group.add(flower);
        }

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w: w + 0.2, h: h + 0.2 });
    }

    _buildSandbox(obs) {
        const s = obs.scale || 1;
        const size = 1.5 * s;

        const boxGeo = new THREE.BoxGeometry(size, 0.2, size);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0xFFE082, flatShading: true });
        const sandbox = new THREE.Mesh(boxGeo, boxMat);
        sandbox.position.set(obs.x, 0.1, obs.z);
        this.group.add(sandbox);

        // Border
        const borderGeo = new THREE.BoxGeometry(size + 0.2, 0.3, size + 0.2);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63, flatShading: true });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(obs.x, 0.05, obs.z);
        this.group.add(border);

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w: size + 0.2, h: size + 0.2 });
    }

    _buildPool(obs) {
        const w = obs.w || 3;
        const h = obs.h || 2;

        // Pool edge
        const edgeGeo = new THREE.BoxGeometry(w + 0.3, 0.15, h + 0.3);
        const edgeMat = new THREE.MeshLambertMaterial({ color: 0xE0E0E0, flatShading: true });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(obs.x, 0.07, obs.z);
        this.group.add(edge);

        // Water
        const waterGeo = new THREE.BoxGeometry(w, 0.08, h);
        const waterMat = new THREE.MeshLambertMaterial({
            color: 0x4FC3F7,
            flatShading: true,
            transparent: true,
            opacity: 0.8,
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(obs.x, 0.02, obs.z);
        this.group.add(water);
        this._water = water;

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w: w + 0.3, h: h + 0.3 });
    }

    _buildHedge(obs) {
        const w = obs.w || 1;
        const h = obs.h || 1;
        const geo = new THREE.BoxGeometry(w, 0.7, h);
        const mat = new THREE.MeshLambertMaterial({ color: 0x2E7D32, flatShading: true });
        const hedge = new THREE.Mesh(geo, mat);
        hedge.position.set(obs.x, 0.35, obs.z);
        hedge.castShadow = true;
        this.group.add(hedge);

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w, h });
    }

    _buildDecorations() {
        for (const dec of (this.def.decorations || [])) {
            if (dec.type === 'house') {
                this._buildHouse(dec);
            }
        }
    }

    _buildHouse(dec) {
        const s = dec.scale || 1;
        const g = new THREE.Group();

        // Main body
        const bodyGeo = new THREE.BoxGeometry(4 * s, 2.5 * s, 3 * s);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xFFCC80, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.25 * s;
        body.castShadow = true;
        g.add(body);

        // Roof
        const roofGeo = new THREE.ConeGeometry(3.2 * s, 1.5 * s, 4);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0xE57373, flatShading: true });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 3.1 * s;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        g.add(roof);

        // Door
        const doorGeo = new THREE.BoxGeometry(0.6 * s, 1.2 * s, 0.1);
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x5D4037 });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 0.6 * s, 1.51 * s);
        g.add(door);

        // Windows
        const winGeo = new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.1);
        const winMat = new THREE.MeshLambertMaterial({ color: 0x81D4FA });
        for (const wx of [-1.2, 1.2]) {
            const win = new THREE.Mesh(winGeo, winMat);
            win.position.set(wx * s, 1.5 * s, 1.51 * s);
            g.add(win);
        }

        g.position.set(dec.x, 0, dec.z);
        this.group.add(g);
    }

    dispose() {
        this.group.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}
