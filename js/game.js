/**
 * Main game - sets up Three.js scene, camera, lighting,
 * and runs the game loop.
 */
import * as THREE from 'three';
import { Controls } from './controls.js';
import { Mower } from './mower.js';
import { Yard } from './yard.js';
import { LEVELS, GameSave } from './levels.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { GrassParticles } from './particles.js';

class Game {
    constructor() {
        this.save = new GameSave();
        this.controls = new Controls();
        this.ui = new UI(this.save);

        this.yard = null;
        this.mower = null;
        this.currentLevelId = null;
        this.levelComplete = false;

        // Audio
        this.audio = new Audio();

        // Particles
        this.particles = new GrassParticles();

        // Raycasting for touch-to-world projection
        this._raycaster = new THREE.Raycaster();
        this._touchVec2 = new THREE.Vector2();
        this._groundPlane = new THREE.Plane();

        this._initRenderer();
        this._initScene();
        this._initCamera();
        this._initLighting();
        this._bindCallbacks();
        this._onResize();

        window.addEventListener('resize', () => this._onResize());

        // Start render loop
        this._clock = new THREE.Clock();
        this._animate();
    }

    _initRenderer() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87CEEB); // Sky blue
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
    }

    _initScene() {
        this.scene = new THREE.Scene();

        // Lighter fog for open-world feel with visible background
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.006);

        // Large sky sphere
        const skyGeo = new THREE.SphereGeometry(200, 20, 14);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }

    _initCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);
        // 3rd-person angle - behind and above the mower
        this.camera.position.set(0, 6, 8);
        this.camera.lookAt(0, 0, 0);

        this._cameraTarget = new THREE.Vector3(0, 0, 0);
        this._cameraOffset = new THREE.Vector3(0, 6, 8);
    }

    _initLighting() {
        // Warm ambient (Bluey palette feel)
        const ambient = new THREE.AmbientLight(0xFFE0B2, 0.6);
        this.scene.add(ambient);

        // Main directional (warm sunlight)
        const sun = new THREE.DirectionalLight(0xFFF8E1, 1.0);
        sun.position.set(8, 15, 5);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 60;
        sun.shadow.camera.left = -15;
        sun.shadow.camera.right = 15;
        sun.shadow.camera.top = 15;
        sun.shadow.camera.bottom = -15;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);
        this._sun = sun;

        // Fill light (cool, from opposite side)
        const fill = new THREE.DirectionalLight(0xBBDEFB, 0.3);
        fill.position.set(-5, 8, -5);
        this.scene.add(fill);

        // Hemisphere for natural outdoor feel
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8BC34A, 0.3);
        this.scene.add(hemi);
    }

    _bindCallbacks() {
        this.ui.onStartLevel = (levelId) => {
            // Init audio on first user gesture (required by iOS)
            this.audio.init();
            this.startLevel(levelId);
        };
        this.controls.onToggleMower((running) => {
            if (this.mower) this.mower.running = running;
            if (running) {
                this.audio.resume();
                this.audio.startEngine();
            } else {
                this.audio.stopEngine();
            }
        });
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    startLevel(levelId) {
        // Clean up previous
        if (this.yard) {
            this.scene.remove(this.yard.group);
            this.yard.dispose();
        }
        if (this.mower) {
            this.scene.remove(this.mower.group);
        }

        const levelDef = LEVELS.find(l => l.id === levelId);
        if (!levelDef) return;

        this.currentLevelId = levelId;
        this.levelComplete = false;

        // Create yard
        this.yard = new Yard(levelDef);
        this.scene.add(this.yard.group);

        // Create mower
        const mowerDef = this.save.getSelectedMower();
        this.mower = new Mower(mowerDef);
        // Wire up terrain so mower rides the surface
        this.mower.setTerrain(
            (x, z) => this.yard.getHeightAt(x, z),
            (x, z) => this.yard.getNormalAt(x, z)
        );
        this.mower.setPosition(levelDef.mowerStart.x, levelDef.mowerStart.z);
        this.scene.add(this.mower.group);

        // Add particles to scene
        this.scene.remove(this.particles.group);
        this.scene.add(this.particles.group);

        // 3rd-person camera - fixed close behind the mower
        this._cameraOffset.set(0, 6, 8);

        // Update shadow camera for larger levels
        const maxDim = Math.max(levelDef.yardWidth, levelDef.yardHeight);
        this._sun.shadow.camera.left = -maxDim;
        this._sun.shadow.camera.right = maxDim;
        this._sun.shadow.camera.top = maxDim;
        this._sun.shadow.camera.bottom = -maxDim;
        this._sun.shadow.camera.updateProjectionMatrix();

        // Show HUD
        this.ui.showHUD(levelDef, mowerDef);
        this.controls.enable();

        // Reset mower state
        this.mower.running = false;
        this.controls.mowerRunning = false;
    }

    _update(dt) {
        if (!this.mower || !this.yard || this.levelComplete) return;

        // Raycast touch position to world-space target on terrain
        let targetX = 0, targetZ = 0, hasTarget = false;
        if (this.controls.touchActive) {
            // Cast a ray from camera through touch point
            this._raycaster.setFromCamera(
                this._touchVec2.set(this.controls.touchScreenX, this.controls.touchScreenY),
                this.camera
            );
            // Intersect with a horizontal plane at the mower's Y height
            const mowerY = this.yard.getHeightAt(
                this.mower.getPosition().x, this.mower.getPosition().z
            );
            this._groundPlane.set(new THREE.Vector3(0, 1, 0), -mowerY);
            const hit = new THREE.Vector3();
            if (this._raycaster.ray.intersectPlane(this._groundPlane, hit)) {
                targetX = hit.x;
                targetZ = hit.z;
                hasTarget = true;
            }
        }

        // Update mower
        const bounds = this.yard.getBounds();
        this.mower.update(
            dt,
            targetX,
            targetZ,
            hasTarget,
            bounds,
            this.yard.colliders
        );

        // Mow grass + particles + sound
        let isCutting = false;
        if (this.mower.running) {
            const pos = this.mower.getPosition();
            const mowed = this.yard.mowAt(pos.x, pos.z, this.mower.cutWidth);
            if (mowed > 0) {
                isCutting = true;
                // Spray grass clippings
                const terrainY = this.yard.getHeightAt(pos.x, pos.z);
                this.particles.emit(
                    pos.x, terrainY, pos.z,
                    this.mower.angle,
                    Math.min(mowed * 2, 6)
                );
            }
        }
        this.audio.mowTick(dt, isCutting);

        // Update particles
        this.particles.update(dt);

        // Update progress
        const progress = this.yard.getProgress();
        this.ui.updateProgress(progress);

        // Camera follow - track terrain height under mower
        const mPos = this.mower.getPosition();
        const terrainY = this.yard.getHeightAt(mPos.x, mPos.z);
        this._cameraTarget.lerp(
            new THREE.Vector3(mPos.x, terrainY, mPos.z),
            dt * 3
        );
        this.camera.position.copy(this._cameraTarget).add(this._cameraOffset);
        this.camera.lookAt(this._cameraTarget);

        // Check level complete
        if (progress >= 0.80 && !this.levelComplete) {
            // Don't auto-complete at 80%, let them keep going
            // Complete when they stop the mower at 80%+ OR hit 100%
            if (progress >= 1.0) {
                this._completeLevel(progress);
            }
        }

        // If mower stops and progress >= 80%, offer completion
        if (!this.mower.running && progress >= 0.80 && !this.levelComplete && this._wasRunning) {
            this._completeLevel(progress);
        }
        this._wasRunning = this.mower.running;
    }

    _completeLevel(progress) {
        this.levelComplete = true;
        this.controls.disable();
        this.audio.stopEngine();
        this.audio.playComplete();

        const result = this.save.completeLevel(this.currentLevelId, Math.floor(progress * 100));

        // Short delay before showing complete screen
        setTimeout(() => {
            this.ui.showComplete(this.currentLevelId, progress, result);
        }, 500);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const dt = Math.min(this._clock.getDelta(), 1 / 30); // cap dt
        this._update(dt);
        this.renderer.render(this.scene, this.camera);
    }
}

// Boot
const game = new Game();
