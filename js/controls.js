/**
 * Touch controls for iPad - fixed visible joystick + mower button.
 * Uses Pointer Events for unified touch/mouse handling.
 * Carefully tracks pointer IDs to avoid multi-touch glitches.
 */

export class Controls {
    constructor() {
        this.steerX = 0;  // -1 to 1
        this.steerY = 0;  // -1 to 1
        this.mowerRunning = false;
        this.enabled = false;

        this._joystickPointerId = null;
        this._maxDrag = 55; // pixels

        this._zone = document.getElementById('joystick-zone');
        this._base = document.getElementById('joystick-base');
        this._thumb = document.getElementById('joystick-thumb');
        this._btn = document.getElementById('mower-btn');

        this._onToggleMower = null;

        // Cache the joystick center position (updated on enable/resize)
        this._baseCenterX = 0;
        this._baseCenterY = 0;

        this._bindEvents();
    }

    enable() {
        this.enabled = true;
        this._zone.style.display = 'block';
        this._base.style.display = 'block';
        this._thumb.style.display = 'block';
        this._btn.style.display = 'flex';
        this.mowerRunning = false;
        this._btn.textContent = 'START';
        this._btn.classList.remove('running');
        this._updateBaseCenter();
        this._resetThumb();
    }

    disable() {
        this.enabled = false;
        this._zone.style.display = 'none';
        this._base.style.display = 'none';
        this._thumb.style.display = 'none';
        this._btn.style.display = 'none';
        this.steerX = 0;
        this.steerY = 0;
    }

    onToggleMower(cb) {
        this._onToggleMower = cb;
    }

    _updateBaseCenter() {
        const rect = this._base.getBoundingClientRect();
        this._baseCenterX = rect.left + rect.width / 2;
        this._baseCenterY = rect.top + rect.height / 2;
    }

    _resetThumb() {
        this._thumb.style.transform = 'translate(0px, 0px)';
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

        // Joystick - listen on zone for pointerdown
        this._zone.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        // Also allow starting directly on the base/thumb
        this._base.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        this._thumb.addEventListener('pointerdown', (e) => this._onPointerDown(e));

        // Listen on document for move/up so dragging outside zone still works
        document.addEventListener('pointermove', (e) => this._onPointerMove(e));
        document.addEventListener('pointerup', (e) => this._onPointerUp(e));
        document.addEventListener('pointercancel', (e) => this._onPointerUp(e));

        // Prevent default touch behaviors on game area
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.screen-overlay')) return;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('gesturechange', (e) => e.preventDefault());

        // Recalculate joystick center on resize/orientation change
        window.addEventListener('resize', () => {
            if (this.enabled) this._updateBaseCenter();
        });
    }

    _onPointerDown(e) {
        if (!this.enabled) return;
        if (this._joystickPointerId !== null) return;

        e.preventDefault();
        this._joystickPointerId = e.pointerId;

        // Recalculate center in case layout shifted
        this._updateBaseCenter();

        // Immediately process position
        this._processPointer(e.clientX, e.clientY);

        try { this._zone.setPointerCapture(e.pointerId); } catch(_) {}
    }

    _onPointerMove(e) {
        if (e.pointerId !== this._joystickPointerId) return;
        this._processPointer(e.clientX, e.clientY);
    }

    _processPointer(clientX, clientY) {
        const dx = clientX - this._baseCenterX;
        const dy = clientY - this._baseCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(dist, this._maxDrag);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clamped;
        const clampedY = Math.sin(angle) * clamped;

        // Move thumb relative to its resting center
        this._thumb.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

        // Normalize to -1..1 with deadzone
        const norm = clamped / this._maxDrag;
        if (norm < 0.1) {
            this.steerX = 0;
            this.steerY = 0;
        } else {
            this.steerX = Math.cos(angle) * norm;
            this.steerY = Math.sin(angle) * norm;
        }
    }

    _onPointerUp(e) {
        if (e.pointerId !== this._joystickPointerId) return;

        this._joystickPointerId = null;
        this.steerX = 0;
        this.steerY = 0;
        this._resetThumb();
    }
}
