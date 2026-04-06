/**
 * Touch controls for iPad - touch anywhere to steer.
 * The mower drives toward wherever your finger is on screen.
 * Uses Pointer Events with ID tracking for multi-touch safety.
 */

export class Controls {
    constructor() {
        // Screen-space touch position (normalized -1 to 1 for raycasting)
        this.touchActive = false;
        this.touchScreenX = 0; // normalized device coords (-1 to 1)
        this.touchScreenY = 0;

        this.mowerRunning = false;
        this.enabled = false;

        this._steerPointerId = null;
        this._btn = document.getElementById('mower-btn');
        this._onToggleMower = null;

        // Visual touch indicator
        this._indicator = document.getElementById('touch-indicator');

        this._bindEvents();
    }

    enable() {
        this.enabled = true;
        this._btn.style.display = 'flex';
        this.mowerRunning = false;
        this._btn.textContent = 'START';
        this._btn.classList.remove('running');
        this.touchActive = false;
    }

    disable() {
        this.enabled = false;
        this._btn.style.display = 'none';
        this.touchActive = false;
        this._hideIndicator();
    }

    onToggleMower(cb) {
        this._onToggleMower = cb;
    }

    _bindEvents() {
        // Mower button
        this._btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.enabled) return;

            this.mowerRunning = !this.mowerRunning;
            this._btn.textContent = this.mowerRunning ? 'STOP' : 'START';
            this._btn.classList.toggle('running', this.mowerRunning);
            if (this._onToggleMower) this._onToggleMower(this.mowerRunning);
        });

        // Touch anywhere on the canvas to steer
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('pointerdown', (e) => {
            if (!this.enabled) return;
            if (this._steerPointerId !== null) return;
            // Don't capture if touching the button
            if (e.target === this._btn || e.target.closest('#mower-btn')) return;

            e.preventDefault();
            this._steerPointerId = e.pointerId;
            this._updateTouch(e);
            try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
        });

        document.addEventListener('pointermove', (e) => {
            if (e.pointerId !== this._steerPointerId) return;
            this._updateTouch(e);
        });

        document.addEventListener('pointerup', (e) => {
            if (e.pointerId !== this._steerPointerId) return;
            this._steerPointerId = null;
            this.touchActive = false;
            this._hideIndicator();
        });

        document.addEventListener('pointercancel', (e) => {
            if (e.pointerId !== this._steerPointerId) return;
            this._steerPointerId = null;
            this.touchActive = false;
            this._hideIndicator();
        });

        // Prevent default touch behaviors on game area
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.screen-overlay')) return;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());
    }

    _updateTouch(e) {
        this.touchActive = true;
        // Convert to normalized device coordinates (-1 to 1)
        this.touchScreenX = (e.clientX / window.innerWidth) * 2 - 1;
        this.touchScreenY = -(e.clientY / window.innerHeight) * 2 + 1;

        // Show touch indicator
        if (this._indicator) {
            this._indicator.style.display = 'block';
            this._indicator.style.left = e.clientX + 'px';
            this._indicator.style.top = e.clientY + 'px';
        }
    }

    _hideIndicator() {
        if (this._indicator) {
            this._indicator.style.display = 'none';
        }
    }
}
