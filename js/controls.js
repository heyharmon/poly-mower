/**
 * Touch controls for iPad - slide finger left/right to steer.
 * Finger's horizontal position maps to the mower's heading angle.
 * Full 360° rotation across the screen width.
 * Uses Pointer Events with ID tracking for multi-touch safety.
 */

export class Controls {
    constructor() {
        // Steering output: absolute angle in radians, and whether touch is active
        this.touchActive = false;
        this.steerAngle = 0; // radians, 0 = forward (+Z), PI/2 = right, etc.

        this.mowerRunning = false;
        this.enabled = false;

        this._steerPointerId = null;
        this._btn = document.getElementById('mower-btn');
        this._onToggleMower = null;

        // Visual touch indicator
        this._indicator = document.getElementById('touch-indicator');

        // On pointer down, we capture the finger's X and the mower's current angle.
        // Moving left/right from that point rotates relative to that starting angle.
        this._touchStartX = 0;
        this._angleAtTouchStart = 0;

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

    /**
     * Called by game to sync the mower's current angle so that
     * the next touch starts relative to where the mower is facing.
     */
    setCurrentAngle(angle) {
        if (!this.touchActive) {
            this.steerAngle = angle;
        }
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
            if (e.target === this._btn || e.target.closest('#mower-btn')) return;

            e.preventDefault();
            this._steerPointerId = e.pointerId;

            // Record starting X and current angle
            this._touchStartX = e.clientX;
            this._angleAtTouchStart = this.steerAngle;
            this.touchActive = true;

            this._showIndicator(e.clientX, e.clientY);
            try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
        });

        document.addEventListener('pointermove', (e) => {
            if (e.pointerId !== this._steerPointerId) return;
            this._updateSteer(e);
            this._showIndicator(e.clientX, e.clientY);
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

    _updateSteer(e) {
        // Horizontal pixel delta from touch start
        const dx = e.clientX - this._touchStartX;

        // Map full screen width to a full 360° (2*PI) rotation.
        // Moving right = clockwise, moving left = counter-clockwise.
        const screenWidth = window.innerWidth;
        const angleOffset = (dx / screenWidth) * Math.PI * 2;

        this.steerAngle = this._angleAtTouchStart + angleOffset;
    }

    _showIndicator(x, y) {
        if (this._indicator) {
            this._indicator.style.display = 'block';
            this._indicator.style.left = x + 'px';
            this._indicator.style.top = y + 'px';
        }
    }

    _hideIndicator() {
        if (this._indicator) {
            this._indicator.style.display = 'none';
        }
    }
}
