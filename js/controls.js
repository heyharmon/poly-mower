/**
 * Touch controls for iPad - virtual joystick + mower button.
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
        this._joystickOrigin = { x: 0, y: 0 };
        this._maxDrag = 55; // pixels

        this._zone = document.getElementById('joystick-zone');
        this._base = document.getElementById('joystick-base');
        this._thumb = document.getElementById('joystick-thumb');
        this._btn = document.getElementById('mower-btn');

        this._onToggleMower = null;

        this._bindEvents();
    }

    enable() {
        this.enabled = true;
        this._zone.style.display = 'block';
        this._btn.style.display = 'flex';
        this.mowerRunning = false;
        this._btn.textContent = 'START';
        this._btn.classList.remove('running');
    }

    disable() {
        this.enabled = false;
        this._zone.style.display = 'none';
        this._btn.style.display = 'none';
        this._hideJoystick();
        this.steerX = 0;
        this.steerY = 0;
    }

    onToggleMower(cb) {
        this._onToggleMower = cb;
    }

    _bindEvents() {
        // Mower button - use pointerdown for instant response
        this._btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.enabled) return;

            this.mowerRunning = !this.mowerRunning;
            this._btn.textContent = this.mowerRunning ? 'STOP' : 'START';
            this._btn.classList.toggle('running', this.mowerRunning);
            if (this._onToggleMower) this._onToggleMower(this.mowerRunning);
        });

        // Joystick zone - pointer events
        this._zone.addEventListener('pointerdown', (e) => this._onPointerDown(e));

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
    }

    _onPointerDown(e) {
        if (!this.enabled) return;
        if (this._joystickPointerId !== null) return; // already tracking a finger

        e.preventDefault();
        this._joystickPointerId = e.pointerId;
        this._joystickOrigin.x = e.clientX;
        this._joystickOrigin.y = e.clientY;

        this._base.style.left = e.clientX + 'px';
        this._base.style.top = e.clientY + 'px';
        this._base.style.display = 'block';

        this._thumb.style.left = e.clientX + 'px';
        this._thumb.style.top = e.clientY + 'px';
        this._thumb.style.display = 'block';

        // Capture this pointer so we get all its events
        try { this._zone.setPointerCapture(e.pointerId); } catch(_) {}
    }

    _onPointerMove(e) {
        if (e.pointerId !== this._joystickPointerId) return;

        const dx = e.clientX - this._joystickOrigin.x;
        const dy = e.clientY - this._joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(dist, this._maxDrag);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clamped;
        const clampedY = Math.sin(angle) * clamped;

        this._thumb.style.left = (this._joystickOrigin.x + clampedX) + 'px';
        this._thumb.style.top = (this._joystickOrigin.y + clampedY) + 'px';

        // Normalize to -1..1 with a small deadzone
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
        this._hideJoystick();
    }

    _hideJoystick() {
        this._base.style.display = 'none';
        this._thumb.style.display = 'none';
    }
}
