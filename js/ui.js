/**
 * UI manager - handles screen transitions and HUD updates.
 */
import { LEVELS, MOWERS } from './levels.js';

export class UI {
    constructor(gameSave) {
        this.save = gameSave;

        // Screens
        this.titleScreen = document.getElementById('title-screen');
        this.levelSelectScreen = document.getElementById('level-select-screen');
        this.mowerSelectScreen = document.getElementById('mower-select-screen');
        this.completeScreen = document.getElementById('complete-screen');

        // HUD
        this.hud = document.getElementById('hud');
        this.progressFill = document.getElementById('progress-bar-fill');
        this.progressText = document.getElementById('progress-text');
        this.levelLabel = document.getElementById('level-label');
        this.mowerLabel = document.getElementById('mower-label');

        // Callbacks
        this.onStartLevel = null;
        this.onSelectMower = null;

        this._bindButtons();
    }

    _bindButtons() {
        document.getElementById('btn-play').addEventListener('click', () => {
            this.showScreen('level-select');
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('Reset all progress? This will lock all levels and mowers.')) {
                this.save.resetAll();
                this.showScreen('title');
            }
        });

        document.getElementById('btn-mowers').addEventListener('click', () => {
            this.showScreen('mower-select');
        });

        document.getElementById('btn-back-title').addEventListener('click', () => {
            this.showScreen('title');
        });

        document.getElementById('btn-back-levels').addEventListener('click', () => {
            this.showScreen('level-select');
        });

        document.getElementById('btn-next-level').addEventListener('click', () => {
            if (this._lastCompletedLevel) {
                const nextId = this._lastCompletedLevel + 1;
                if (nextId <= LEVELS.length && this.save.isLevelUnlocked(nextId)) {
                    if (this.onStartLevel) this.onStartLevel(nextId);
                } else {
                    this.showScreen('level-select');
                }
            }
        });

        document.getElementById('btn-replay').addEventListener('click', () => {
            if (this._lastCompletedLevel && this.onStartLevel) {
                this.onStartLevel(this._lastCompletedLevel);
            }
        });

        document.getElementById('btn-to-levels').addEventListener('click', () => {
            this.showScreen('level-select');
        });
    }

    showScreen(name) {
        // Hide all overlays
        const screens = [this.titleScreen, this.levelSelectScreen, this.mowerSelectScreen, this.completeScreen];
        for (const s of screens) {
            s.classList.add('hidden');
            s.style.display = 'none';
        }
        this.hud.style.display = 'none';

        switch (name) {
            case 'title':
                this.titleScreen.style.display = 'flex';
                this.titleScreen.classList.remove('hidden');
                break;
            case 'level-select':
                this._buildLevelGrid();
                this.levelSelectScreen.style.display = 'flex';
                this.levelSelectScreen.classList.remove('hidden');
                break;
            case 'mower-select':
                this._buildMowerGrid();
                this.mowerSelectScreen.style.display = 'flex';
                this.mowerSelectScreen.classList.remove('hidden');
                break;
            case 'playing':
                this.hud.style.display = 'flex';
                break;
            case 'complete':
                this.completeScreen.style.display = 'flex';
                this.completeScreen.classList.remove('hidden');
                break;
        }
    }

    _buildLevelGrid() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';

        for (const level of LEVELS) {
            const tile = document.createElement('button');
            tile.className = 'level-tile';
            const unlocked = this.save.isLevelUnlocked(level.id);
            const result = this.save.getLevelResult(level.id);

            if (!unlocked) {
                tile.classList.add('locked');
                tile.innerHTML = `<span>${level.id}</span><span class="stars">🔒</span>`;
            } else {
                const stars = result ? '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars) : '☆☆☆';
                tile.innerHTML = `<span>${level.id}</span><span class="stars">${stars}</span>`;
                tile.addEventListener('click', () => {
                    if (this.onStartLevel) this.onStartLevel(level.id);
                });
            }

            grid.appendChild(tile);
        }
    }

    _buildMowerGrid() {
        const grid = document.getElementById('mower-grid');
        grid.innerHTML = '';
        const selected = this.save.getSelectedMower();

        for (const mower of MOWERS) {
            const card = document.createElement('div');
            card.className = 'mower-card';
            const unlocked = this.save.isMowerUnlocked(mower.id);

            if (!unlocked) card.classList.add('locked');
            if (mower.id === selected.id) card.classList.add('selected');

            const colorHex = '#' + mower.color.toString(16).padStart(6, '0');
            const accentHex = '#' + mower.accentColor.toString(16).padStart(6, '0');

            card.innerHTML = `
                <div class="mower-preview" style="background: radial-gradient(circle at 40% 40%, ${colorHex}, ${accentHex});"></div>
                <div class="mower-name">${unlocked ? mower.name : '???'}</div>
                <div class="mower-stat">${unlocked ? mower.description : 'Locked'}</div>
            `;

            if (unlocked) {
                card.addEventListener('click', () => {
                    this.save.selectMower(mower.id);
                    this._buildMowerGrid();
                });
            }

            grid.appendChild(card);
        }
    }

    showHUD(levelDef, mowerDef) {
        this.showScreen('playing');
        this.levelLabel.textContent = levelDef.name;
        this.mowerLabel.textContent = mowerDef.name;
        this.updateProgress(0);
    }

    updateProgress(percent) {
        const p = Math.floor(percent * 100);
        this.progressFill.style.width = p + '%';
        this.progressText.textContent = p + '%';

        // Color transitions
        if (percent >= 1.0) {
            this.progressFill.style.background = 'linear-gradient(90deg, #FFD54F, #FF8F00)';
        } else if (percent >= 0.8) {
            this.progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #2E7D32)';
        } else {
            this.progressFill.style.background = 'linear-gradient(90deg, #7CB342, #4CAF50)';
        }
    }

    showComplete(levelId, percent, result) {
        this._lastCompletedLevel = levelId;

        const starsEl = document.getElementById('result-stars');
        const textEl = document.getElementById('result-text');
        const unlockBanner = document.getElementById('unlock-banner');
        const nextBtn = document.getElementById('btn-next-level');

        const p = Math.floor(percent * 100);
        starsEl.textContent = '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
        textEl.textContent = `Mowed ${p}% of the yard!`;

        // Unlock messages
        const messages = [];
        if (result.levelUnlocked) messages.push('New yard unlocked!');
        if (result.mowerUnlocked) messages.push(`New mower unlocked: ${result.mowerUnlocked}!`);

        if (messages.length > 0) {
            unlockBanner.textContent = messages.join(' ');
            unlockBanner.classList.remove('hidden');
        } else {
            unlockBanner.classList.add('hidden');
        }

        // Hide next button if no next level
        const nextId = levelId + 1;
        if (nextId <= LEVELS.length && this.save.isLevelUnlocked(nextId)) {
            nextBtn.style.display = '';
        } else {
            nextBtn.style.display = 'none';
        }

        this.showScreen('complete');
    }
}
