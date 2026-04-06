/**
 * Yard - generates the 3D scene for a level including terrain,
 * grass grid, fences, obstacles, and decorations.
 * Tracks mowing progress. Terrain uses summed gaussian bumps.
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

        // Terrain bumps from level definition
        this._terrainBumps = levelDef.terrain || [];

        this._buildGround();
        this._buildGrass();
        this._buildObstacles();
        this._buildDecorations();
        this._buildBackground();
    }

    /**
     * Sample terrain height at any (x, z) world position.
     * Returns the y value. This is the public API used by mower, camera, etc.
     */
    getHeightAt(x, z) {
        let h = 0;
        for (const bump of this._terrainBumps) {
            const dx = x - bump.x;
            const dz = z - bump.z;
            const distSq = dx * dx + dz * dz;
            const rSq = bump.radius * bump.radius;
            h += bump.height * Math.exp(-distSq / (2 * rSq));
        }
        return h;
    }

    /**
     * Get terrain normal at (x, z) via finite differences.
     * Returns a normalized THREE.Vector3.
     */
    getNormalAt(x, z) {
        const eps = 0.15;
        const hL = this.getHeightAt(x - eps, z);
        const hR = this.getHeightAt(x + eps, z);
        const hD = this.getHeightAt(x, z - eps);
        const hU = this.getHeightAt(x, z + eps);
        const normal = new THREE.Vector3(hL - hR, 2 * eps, hD - hU);
        normal.normalize();
        return normal;
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
        const { yardWidth, yardHeight } = this.def;

        // --- Far ground plane (flat base, extends very far) ---
        const farGeo = new THREE.PlaneGeometry(300, 300);
        const farMat = new THREE.MeshLambertMaterial({
            color: 0x8BC34A,
            flatShading: true,
        });
        const farGround = new THREE.Mesh(farGeo, farMat);
        farGround.rotation.x = -Math.PI / 2;
        farGround.position.y = -0.2;
        farGround.receiveShadow = true;
        this.group.add(farGround);

        // --- Mowed lawn terrain mesh (subdivided, vertex-displaced) ---
        const segX = Math.ceil(yardWidth * 3);  // ~3 subdivisions per unit
        const segZ = Math.ceil(yardHeight * 3);
        const lawnGeo = new THREE.PlaneGeometry(yardWidth, yardHeight, segX, segZ);

        // Displace vertices by terrain height
        // PlaneGeometry is in XY plane. rotation.x = -PI/2 maps:
        //   local X → world X,  local Y → world -Z,  local Z → world Y
        // So world Z = -local_y, meaning we must query getHeightAt(lx, -ly)
        const posAttr = lawnGeo.getAttribute('position');
        for (let i = 0; i < posAttr.count; i++) {
            const lx = posAttr.getX(i);
            const ly = posAttr.getY(i);
            const h = this.getHeightAt(lx, -ly);
            posAttr.setZ(i, h);
        }
        lawnGeo.computeVertexNormals();

        const lawnMat = new THREE.MeshLambertMaterial({
            color: this.def.mowedColor,
            flatShading: true,
        });
        const lawn = new THREE.Mesh(lawnGeo, lawnMat);
        lawn.rotation.x = -Math.PI / 2;
        lawn.receiveShadow = true;
        this.group.add(lawn);
        this._lawnMesh = lawn;

        // --- Outer terrain mesh (extends well beyond play area, blends to flat) ---
        const outerSize = Math.max(yardWidth, yardHeight) + 40;
        const outerTerrainGeo = new THREE.PlaneGeometry(outerSize, outerSize,
            Math.ceil(outerSize * 1.5), Math.ceil(outerSize * 1.5));
        const otPosAttr = outerTerrainGeo.getAttribute('position');
        const hw = yardWidth / 2;
        const hh = yardHeight / 2;
        for (let i = 0; i < otPosAttr.count; i++) {
            const lx = otPosAttr.getX(i);
            const ly = otPosAttr.getY(i);
            // Fade terrain to zero outside the yard bounds
            const fadeX = Math.max(0, 1 - Math.max(0, Math.abs(lx) - hw) / 10);
            const fadeZ = Math.max(0, 1 - Math.max(0, Math.abs(-ly) - hh) / 10);
            const fade = fadeX * fadeZ;
            const h = this.getHeightAt(lx, -ly) * fade;
            otPosAttr.setZ(i, h);
        }
        outerTerrainGeo.computeVertexNormals();

        const outerTerrainMat = new THREE.MeshLambertMaterial({
            color: 0x8BC34A,
            flatShading: true,
        });
        const outerTerrain = new THREE.Mesh(outerTerrainGeo, outerTerrainMat);
        outerTerrain.rotation.x = -Math.PI / 2;
        outerTerrain.position.y = -0.04;
        outerTerrain.receiveShadow = true;
        this.group.add(outerTerrain);
    }

    _buildGrass() {
        const { yardWidth, yardHeight, grassResolution, groundColor } = this.def;
        const res = grassResolution;
        const hw = yardWidth / 2;
        const hh = yardHeight / 2;

        // Grass blade geometry - tall curved quad, taller than the mower
        const bladeGeo = new THREE.BufferGeometry();
        const bladeW = 0.06;
        const bladeH = 0.55;
        const bladeMid = bladeH * 0.55;
        const bladeBend = 0.03;
        const vertices = new Float32Array([
            -bladeW, 0, 0,
             bladeW, 0, 0,
             bladeW * 0.7, bladeMid, bladeBend,
            -bladeW, 0, 0,
             bladeW * 0.7, bladeMid, bladeBend,
            -bladeW * 0.7, bladeMid, bladeBend,
            -bladeW * 0.7, bladeMid, bladeBend,
             bladeW * 0.7, bladeMid, bladeBend,
             0, bladeH, bladeBend * 2.5,
        ]);
        bladeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        bladeGeo.computeVertexNormals();

        const BLADES_PER_CELL = 14;

        // Collect valid cells
        const cells = [];
        for (let x = -hw + res / 2; x < hw; x += res) {
            for (let z = -hh + res / 2; z < hh; z += res) {
                if (!this._isObstacleAt(x, z)) {
                    cells.push({ x, z });
                }
            }
        }

        const totalInstances = cells.length * BLADES_PER_CELL;

        // Color variations
        const baseColor = new THREE.Color(groundColor);
        const grassColors = [];
        for (let i = 0; i < 12; i++) {
            const c = baseColor.clone();
            c.offsetHSL(
                (Math.random() - 0.5) * 0.08,
                (Math.random() - 0.5) * 0.15,
                (Math.random() - 0.5) * 0.12
            );
            grassColors.push(c);
        }

        const grassMat = new THREE.MeshLambertMaterial({
            color: groundColor,
            flatShading: true,
            side: THREE.DoubleSide,
        });

        const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, totalInstances);
        grassMesh.receiveShadow = true;
        grassMesh.castShadow = true;

        const colorArray = new Float32Array(totalInstances * 3);
        const _matrix = new THREE.Matrix4();
        const _position = new THREE.Vector3();
        const _rotation = new THREE.Euler();
        const _quaternion = new THREE.Quaternion();
        const _scale = new THREE.Vector3();

        let instanceIdx = 0;

        for (const cell of cells) {
            const bladeIndices = [];
            const cellHeight = this.getHeightAt(cell.x, cell.z);

            for (let b = 0; b < BLADES_PER_CELL; b++) {
                const ox = (Math.random() - 0.5) * res * 1.0;
                const oz = (Math.random() - 0.5) * res * 1.0;

                const wx = cell.x + ox;
                const wz = cell.z + oz;
                const bladeY = this.getHeightAt(wx, wz);

                _position.set(wx, bladeY, wz);

                _rotation.set(
                    (Math.random() - 0.5) * 0.4,
                    Math.random() * Math.PI * 2,
                    (Math.random() - 0.5) * 0.3
                );
                _quaternion.setFromEuler(_rotation);

                const heightVar = 0.7 + Math.random() * 0.6;
                const widthVar = 0.8 + Math.random() * 0.5;
                _scale.set(widthVar, heightVar, widthVar);

                _matrix.compose(_position, _quaternion, _scale);
                grassMesh.setMatrixAt(instanceIdx, _matrix);

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
        for (const dec of (this.def.decorations || [])) {
            if (dec.type === 'house') {
                const s = (dec.scale || 1);
                if (Math.abs(x - dec.x) < 3 * s && Math.abs(z - dec.z) < 2 * s) return true;
            }
        }
        return false;
    }

    _buildBackground() {
        const { yardWidth, yardHeight } = this.def;
        const maxDim = Math.max(yardWidth, yardHeight);

        // --- Distant mountains (low-poly cones/pyramids in a ring) ---
        const mountainColors = [0x7986CB, 0x9FA8DA, 0x7E8CC4, 0x6A78B8];
        const snowColor = 0xE8EAF6;
        const numMountains = 14;
        const mountainDist = maxDim * 2.5 + 20;

        for (let i = 0; i < numMountains; i++) {
            const angle = (i / numMountains) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const dist = mountainDist + (Math.random() - 0.5) * 15;
            const mx = Math.cos(angle) * dist;
            const mz = Math.sin(angle) * dist;
            const mHeight = 8 + Math.random() * 14;
            const mRadius = 5 + Math.random() * 8;

            const mGeo = new THREE.ConeGeometry(mRadius, mHeight, 5 + Math.floor(Math.random() * 3));
            const mMat = new THREE.MeshLambertMaterial({
                color: mountainColors[i % mountainColors.length],
                flatShading: true,
            });
            const mountain = new THREE.Mesh(mGeo, mMat);
            mountain.position.set(mx, mHeight * 0.3, mz);
            mountain.rotation.y = Math.random() * Math.PI;
            this.group.add(mountain);

            // Snow cap on taller mountains
            if (mHeight > 12) {
                const capGeo = new THREE.ConeGeometry(mRadius * 0.35, mHeight * 0.25, 5);
                const capMat = new THREE.MeshLambertMaterial({ color: snowColor, flatShading: true });
                const cap = new THREE.Mesh(capGeo, capMat);
                cap.position.set(mx, mHeight * 0.75, mz);
                cap.rotation.y = mountain.rotation.y;
                this.group.add(cap);
            }
        }

        // --- Scattered background trees (beyond play area) ---
        const bgTreeColors = [0x558B2F, 0x33691E, 0x2E7D32, 0x388E3C];
        const numBgTrees = 40;
        const treeMinDist = maxDim * 0.7;
        const treeMaxDist = maxDim * 2.0;

        for (let i = 0; i < numBgTrees; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = treeMinDist + Math.random() * (treeMaxDist - treeMinDist);
            const tx = Math.cos(angle) * dist;
            const tz = Math.sin(angle) * dist;
            const treeH = 1.5 + Math.random() * 2.5;
            const treeR = 0.6 + Math.random() * 1.0;

            const g = new THREE.Group();

            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, treeH * 0.5, 5);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6D4C41, flatShading: true });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = treeH * 0.25;
            g.add(trunk);

            // Canopy (2 cones)
            for (let j = 0; j < 2; j++) {
                const cr = treeR * (1 - j * 0.3);
                const ch = treeH * 0.45;
                const cy = treeH * (0.4 + j * 0.28);
                const cGeo = new THREE.ConeGeometry(cr, ch, 5 + Math.floor(Math.random() * 2));
                const cMat = new THREE.MeshLambertMaterial({
                    color: bgTreeColors[Math.floor(Math.random() * bgTreeColors.length)],
                    flatShading: true,
                });
                const cone = new THREE.Mesh(cGeo, cMat);
                cone.position.y = cy;
                g.add(cone);
            }

            const terrainY = this.getHeightAt(tx, tz) * 0.3; // partial terrain influence
            g.position.set(tx, terrainY, tz);
            this.group.add(g);
        }

        // --- Clouds (floating flat ellipsoids) ---
        const cloudColor = 0xFFFFFF;
        const numClouds = 10;
        for (let i = 0; i < numClouds; i++) {
            const cx = (Math.random() - 0.5) * maxDim * 4;
            const cz = (Math.random() - 0.5) * maxDim * 4;
            const cy = 15 + Math.random() * 10;

            const cloudGroup = new THREE.Group();
            const numPuffs = 3 + Math.floor(Math.random() * 3);
            for (let p = 0; p < numPuffs; p++) {
                const pr = 1.0 + Math.random() * 2.0;
                const pGeo = new THREE.SphereGeometry(pr, 7, 5);
                const pMat = new THREE.MeshLambertMaterial({
                    color: cloudColor,
                    flatShading: true,
                    transparent: true,
                    opacity: 0.85,
                });
                const puff = new THREE.Mesh(pGeo, pMat);
                puff.position.set(
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 1.5
                );
                puff.scale.y = 0.4; // flatten
                cloudGroup.add(puff);
            }
            cloudGroup.position.set(cx, cy, cz);
            this.group.add(cloudGroup);
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
        const terrainY = this.getHeightAt(obs.x, obs.z);
        const g = new THREE.Group();

        const trunkGeo = new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.2 * s, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.6 * s;
        trunk.castShadow = true;
        g.add(trunk);

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

        g.position.set(obs.x, terrainY, obs.z);
        this.group.add(g);
        this.colliders.push({ type: 'circle', x: obs.x, z: obs.z, r: 0.4 * s });
    }

    _buildRock(obs) {
        const s = obs.scale || 1;
        const terrainY = this.getHeightAt(obs.x, obs.z);
        const geo = new THREE.DodecahedronGeometry(0.35 * s, 0);
        const mat = new THREE.MeshLambertMaterial({ color: 0xBDBDBD, flatShading: true });
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(obs.x, terrainY + 0.2 * s, obs.z);
        rock.rotation.set(0.3, 0.7, 0.2);
        rock.scale.y = 0.6;
        rock.castShadow = true;
        this.group.add(rock);
        this.colliders.push({ type: 'circle', x: obs.x, z: obs.z, r: 0.35 * s });
    }

    _buildFlowerbed(obs) {
        const w = obs.w || 2;
        const h = obs.h || 1;
        const terrainY = this.getHeightAt(obs.x, obs.z);

        const borderGeo = new THREE.BoxGeometry(w + 0.2, 0.15, h + 0.2);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0x795548, flatShading: true });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(obs.x, terrainY + 0.07, obs.z);
        this.group.add(border);

        const soilGeo = new THREE.BoxGeometry(w, 0.1, h);
        const soilMat = new THREE.MeshLambertMaterial({ color: 0x5D4037, flatShading: true });
        const soil = new THREE.Mesh(soilGeo, soilMat);
        soil.position.set(obs.x, terrainY + 0.1, obs.z);
        this.group.add(soil);

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
            flower.position.set(fx, terrainY + 0.2 + Math.random() * 0.08, fz);
            this.group.add(flower);
        }

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w: w + 0.2, h: h + 0.2 });
    }

    _buildSandbox(obs) {
        const s = obs.scale || 1;
        const size = 1.5 * s;
        const terrainY = this.getHeightAt(obs.x, obs.z);

        const boxGeo = new THREE.BoxGeometry(size, 0.2, size);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0xFFE082, flatShading: true });
        const sandbox = new THREE.Mesh(boxGeo, boxMat);
        sandbox.position.set(obs.x, terrainY + 0.1, obs.z);
        this.group.add(sandbox);

        const borderGeo = new THREE.BoxGeometry(size + 0.2, 0.3, size + 0.2);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63, flatShading: true });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.set(obs.x, terrainY + 0.05, obs.z);
        this.group.add(border);

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w: size + 0.2, h: size + 0.2 });
    }

    _buildPool(obs) {
        const w = obs.w || 3;
        const h = obs.h || 2;
        const terrainY = this.getHeightAt(obs.x, obs.z);

        const edgeGeo = new THREE.BoxGeometry(w + 0.3, 0.15, h + 0.3);
        const edgeMat = new THREE.MeshLambertMaterial({ color: 0xE0E0E0, flatShading: true });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(obs.x, terrainY + 0.07, obs.z);
        this.group.add(edge);

        const waterGeo = new THREE.BoxGeometry(w, 0.08, h);
        const waterMat = new THREE.MeshLambertMaterial({
            color: 0x4FC3F7,
            flatShading: true,
            transparent: true,
            opacity: 0.8,
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(obs.x, terrainY + 0.02, obs.z);
        this.group.add(water);

        this.colliders.push({ type: 'rect', x: obs.x, z: obs.z, w: w + 0.3, h: h + 0.3 });
    }

    _buildHedge(obs) {
        const w = obs.w || 1;
        const h = obs.h || 1;
        const terrainY = this.getHeightAt(obs.x, obs.z);
        const geo = new THREE.BoxGeometry(w, 0.7, h);
        const mat = new THREE.MeshLambertMaterial({ color: 0x2E7D32, flatShading: true });
        const hedge = new THREE.Mesh(geo, mat);
        hedge.position.set(obs.x, terrainY + 0.35, obs.z);
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
        const terrainY = this.getHeightAt(dec.x, dec.z);
        const g = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(4 * s, 2.5 * s, 3 * s);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xFFCC80, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.25 * s;
        body.castShadow = true;
        g.add(body);

        const roofGeo = new THREE.ConeGeometry(3.2 * s, 1.5 * s, 4);
        const roofMat = new THREE.MeshLambertMaterial({ color: 0xE57373, flatShading: true });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 3.1 * s;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        g.add(roof);

        const doorGeo = new THREE.BoxGeometry(0.6 * s, 1.2 * s, 0.1);
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x5D4037 });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 0.6 * s, 1.51 * s);
        g.add(door);

        const winGeo = new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.1);
        const winMat = new THREE.MeshLambertMaterial({ color: 0x81D4FA });
        for (const wx of [-1.2, 1.2]) {
            const win = new THREE.Mesh(winGeo, winMat);
            win.position.set(wx * s, 1.5 * s, 1.51 * s);
            g.add(win);
        }

        g.position.set(dec.x, terrainY, dec.z);
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
