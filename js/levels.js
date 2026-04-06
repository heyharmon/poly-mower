/**
 * Level definitions and save/load system.
 * Each level defines a yard layout with obstacles, fences, etc.
 */

export const MOWERS = [
    {
        id: 'buzz',
        name: 'Buzz',
        color: 0x4CAF50,
        accentColor: 0x388E3C,
        speed: 3.0,
        turnSpeed: 2.5,
        cutWidth: 0.8,
        description: 'The starter bot',
    },
    {
        id: 'dash',
        name: 'Dash',
        color: 0xFF7043,
        accentColor: 0xD84315,
        speed: 4.5,
        turnSpeed: 3.0,
        cutWidth: 0.8,
        description: 'Quick and nimble',
    },
    {
        id: 'chunk',
        name: 'Chunk',
        color: 0x5C6BC0,
        accentColor: 0x3949AB,
        speed: 2.2,
        turnSpeed: 1.8,
        cutWidth: 1.4,
        description: 'Wide cut path',
    },
    {
        id: 'goldie',
        name: 'Goldie',
        color: 0xFFCA28,
        accentColor: 0xF9A825,
        speed: 3.8,
        turnSpeed: 2.8,
        cutWidth: 1.0,
        description: 'The golden one',
    },
];

export const LEVELS = [
    {
        id: 1,
        name: 'The Front Yard',
        yardWidth: 24,
        yardHeight: 18,
        grassResolution: 0.5,  // size of each grass cell
        mowerStart: { x: 0, z: 5 },
        fenceColor: 0x8D6E63,
        groundColor: 0x7CB342,
        mowedColor: 0xA5D6A7,
        terrain: [
            { x: -6, z: -2, radius: 6.0, height: 1.2 },
            { x: 5, z: 3, radius: 4.5, height: 0.8 },
            { x: 8, z: -5, radius: 3.5, height: -0.5 },
            { x: -3, z: 6, radius: 3.0, height: 0.5 },
        ],
        obstacles: [
            { type: 'tree', x: -5, z: -3, scale: 1.0 },
            { type: 'tree', x: 4, z: -4, scale: 0.8 },
            { type: 'rock', x: 2, z: 1, scale: 0.6 },
            { type: 'flowerbed', x: -3, z: 2, w: 2, h: 1.5 },
        ],
        decorations: [
            { type: 'house', x: 0, z: -7, scale: 1.0 },
        ],
    },
    {
        id: 2,
        name: 'The Backyard',
        yardWidth: 28,
        yardHeight: 22,
        grassResolution: 0.5,
        mowerStart: { x: -7, z: 5 },
        fenceColor: 0x8D6E63,
        groundColor: 0x689F38,
        mowedColor: 0x9CCC65,
        terrain: [
            { x: -5, z: -3, radius: 7.0, height: 1.8 },
            { x: 7, z: 2, radius: 5.0, height: 1.2 },
            { x: -8, z: 6, radius: 4.5, height: 0.7 },
            { x: 3, z: -7, radius: 3.5, height: -0.8 },
            { x: 10, z: 8, radius: 4.0, height: -0.5 },
            { x: -2, z: 9, radius: 3.0, height: 0.6 },
        ],
        obstacles: [
            { type: 'tree', x: -6, z: -4, scale: 1.2 },
            { type: 'tree', x: 5, z: -2, scale: 0.9 },
            { type: 'tree', x: 3, z: 3, scale: 0.7 },
            { type: 'rock', x: -2, z: 0, scale: 0.5 },
            { type: 'rock', x: 6, z: 4, scale: 0.4 },
            { type: 'flowerbed', x: 0, z: -5, w: 3, h: 1 },
            { type: 'sandbox', x: 5, z: -5, scale: 1.2 },
        ],
        decorations: [
            { type: 'house', x: -2, z: -8, scale: 1.2 },
        ],
    },
    {
        id: 3,
        name: 'Neighbour\'s Yard',
        yardWidth: 26,
        yardHeight: 24,
        grassResolution: 0.5,
        mowerStart: { x: 0, z: 7 },
        fenceColor: 0xBCAAA4,
        groundColor: 0x558B2F,
        mowedColor: 0x8BC34A,
        terrain: [
            { x: 0, z: -5, radius: 7.0, height: 2.0 },
            { x: -8, z: 4, radius: 5.0, height: 1.0 },
            { x: 7, z: 6, radius: 5.5, height: 1.3 },
            { x: -5, z: -8, radius: 4.0, height: -0.7 },
            { x: 8, z: -2, radius: 3.5, height: -0.5 },
            { x: -3, z: 10, radius: 4.0, height: 0.6 },
        ],
        obstacles: [
            { type: 'tree', x: -4, z: -5, scale: 1.3 },
            { type: 'tree', x: 3, z: -6, scale: 1.0 },
            { type: 'tree', x: -2, z: 2, scale: 0.6 },
            { type: 'rock', x: 4, z: 0, scale: 0.7 },
            { type: 'rock', x: -5, z: 3, scale: 0.5 },
            { type: 'flowerbed', x: 2, z: 4, w: 2, h: 2 },
            { type: 'pool', x: -1, z: -2, w: 3, h: 2 },
        ],
        decorations: [
            { type: 'house', x: 0, z: -9, scale: 1.0 },
        ],
    },
    {
        id: 4,
        name: 'The Park',
        yardWidth: 34,
        yardHeight: 28,
        grassResolution: 0.5,
        mowerStart: { x: -8, z: 7 },
        fenceColor: 0x795548,
        groundColor: 0x7CB342,
        mowedColor: 0xC5E1A5,
        terrain: [
            { x: -8, z: -5, radius: 8.0, height: 2.5 },
            { x: 8, z: 3, radius: 6.0, height: 1.8 },
            { x: -3, z: 8, radius: 5.5, height: 1.3 },
            { x: 12, z: -7, radius: 4.5, height: 1.0 },
            { x: 0, z: -10, radius: 5.0, height: -1.0 },
            { x: -12, z: 0, radius: 4.0, height: -0.6 },
            { x: 10, z: 10, radius: 5.0, height: 0.8 },
            { x: -6, z: -10, radius: 3.5, height: 0.5 },
        ],
        obstacles: [
            { type: 'tree', x: -7, z: -5, scale: 1.5 },
            { type: 'tree', x: 0, z: -6, scale: 1.2 },
            { type: 'tree', x: 7, z: -4, scale: 1.4 },
            { type: 'tree', x: -4, z: 2, scale: 0.9 },
            { type: 'tree', x: 5, z: 3, scale: 1.0 },
            { type: 'rock', x: -2, z: -1, scale: 0.8 },
            { type: 'rock', x: 3, z: 5, scale: 0.6 },
            { type: 'flowerbed', x: 8, z: -6, w: 2, h: 2 },
            { type: 'flowerbed', x: -8, z: 4, w: 1.5, h: 1.5 },
            { type: 'sandbox', x: 2, z: -3, scale: 1.5 },
        ],
        decorations: [],
    },
    {
        id: 5,
        name: 'The Estate',
        yardWidth: 36,
        yardHeight: 30,
        grassResolution: 0.5,
        mowerStart: { x: 0, z: 9 },
        fenceColor: 0xA1887F,
        groundColor: 0x33691E,
        mowedColor: 0x7CB342,
        terrain: [
            { x: -10, z: -7, radius: 7.0, height: 2.5 },
            { x: 6, z: -9, radius: 5.5, height: 2.0 },
            { x: 12, z: 5, radius: 6.0, height: 2.2 },
            { x: -6, z: 8, radius: 6.5, height: 1.5 },
            { x: 0, z: 0, radius: 4.5, height: -1.2 },
            { x: -13, z: -2, radius: 4.0, height: 0.9 },
            { x: 5, z: 10, radius: 5.0, height: -0.8 },
            { x: 13, z: -8, radius: 3.5, height: 0.7 },
            { x: -4, z: -12, radius: 4.0, height: 0.6 },
        ],
        obstacles: [
            { type: 'tree', x: -9, z: -7, scale: 1.6 },
            { type: 'tree', x: -3, z: -8, scale: 1.1 },
            { type: 'tree', x: 5, z: -7, scale: 1.3 },
            { type: 'tree', x: 9, z: -3, scale: 1.0 },
            { type: 'tree', x: -7, z: 2, scale: 0.8 },
            { type: 'tree', x: 8, z: 5, scale: 1.2 },
            { type: 'rock', x: -1, z: 0, scale: 0.9 },
            { type: 'rock', x: 4, z: -2, scale: 0.6 },
            { type: 'rock', x: -5, z: 5, scale: 0.7 },
            { type: 'pool', x: 6, z: -5, w: 4, h: 3 },
            { type: 'flowerbed', x: -6, z: -4, w: 2, h: 2 },
            { type: 'flowerbed', x: 2, z: 6, w: 3, h: 1.5 },
            { type: 'sandbox', x: -3, z: 4, scale: 1.0 },
        ],
        decorations: [
            { type: 'house', x: 0, z: -11, scale: 1.5 },
        ],
    },
    {
        id: 6,
        name: 'The Maze Yard',
        yardWidth: 26,
        yardHeight: 26,
        grassResolution: 0.5,
        mowerStart: { x: -6, z: 7 },
        fenceColor: 0x6D4C41,
        groundColor: 0x558B2F,
        mowedColor: 0xAED581,
        terrain: [
            { x: 0, z: 0, radius: 7.0, height: 2.0 },
            { x: -8, z: -8, radius: 5.0, height: 1.2 },
            { x: 8, z: -8, radius: 5.0, height: 1.2 },
            { x: -8, z: 8, radius: 5.5, height: -0.8 },
            { x: 8, z: 8, radius: 4.0, height: 0.7 },
            { x: -3, z: -10, radius: 3.5, height: 0.5 },
        ],
        obstacles: [
            { type: 'hedge', x: -2, z: -4, w: 6, h: 0.5 },
            { type: 'hedge', x: -2, z: 0, w: 0.5, h: 4 },
            { type: 'hedge', x: 3, z: -1, w: 0.5, h: 6 },
            { type: 'hedge', x: -5, z: 2, w: 3, h: 0.5 },
            { type: 'hedge', x: 0, z: 4, w: 5, h: 0.5 },
            { type: 'tree', x: -6, z: -6, scale: 1.0 },
            { type: 'tree', x: 6, z: -6, scale: 1.0 },
            { type: 'flowerbed', x: 5, z: 5, w: 2, h: 2 },
        ],
        decorations: [
            { type: 'house', x: 0, z: -9, scale: 1.0 },
        ],
    },
];

const SAVE_KEY = 'poly-mower-save';

export class GameSave {
    constructor() {
        this.data = this._load();
    }

    _defaultData() {
        return {
            unlockedLevels: [1],
            completedLevels: {},  // id -> { percent, stars }
            unlockedMowers: ['buzz'],
            selectedMower: 'buzz',
        };
    }

    _load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const d = JSON.parse(raw);
                // Merge with defaults for forward compatibility
                return { ...this._defaultData(), ...d };
            }
        } catch (_) {}
        return this._defaultData();
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (_) {}
    }

    isLevelUnlocked(id) {
        return this.data.unlockedLevels.includes(id);
    }

    getLevelResult(id) {
        return this.data.completedLevels[id] || null;
    }

    completeLevel(id, percent) {
        const stars = percent >= 100 ? 3 : percent >= 80 ? 2 : percent >= 50 ? 1 : 0;
        const prev = this.data.completedLevels[id];
        if (!prev || percent > prev.percent) {
            this.data.completedLevels[id] = { percent, stars };
        }

        // Unlock next level if >= 80%
        const nextId = id + 1;
        let levelUnlocked = false;
        if (percent >= 80 && nextId <= LEVELS.length && !this.data.unlockedLevels.includes(nextId)) {
            this.data.unlockedLevels.push(nextId);
            levelUnlocked = true;
        }

        // Unlock mower if 100%
        let mowerUnlocked = null;
        if (percent >= 100) {
            const mowerIndex = id; // level 1 100% -> unlock mower index 1 (dash), etc.
            if (mowerIndex < MOWERS.length && !this.data.unlockedMowers.includes(MOWERS[mowerIndex].id)) {
                this.data.unlockedMowers.push(MOWERS[mowerIndex].id);
                mowerUnlocked = MOWERS[mowerIndex].name;
            }
        }

        this.save();
        return { stars, levelUnlocked, mowerUnlocked };
    }

    isMowerUnlocked(id) {
        return this.data.unlockedMowers.includes(id);
    }

    selectMower(id) {
        this.data.selectedMower = id;
        this.save();
    }

    getSelectedMower() {
        return MOWERS.find(m => m.id === this.data.selectedMower) || MOWERS[0];
    }

    resetAll() {
        this.data = this._defaultData();
        this.save();
    }
}
