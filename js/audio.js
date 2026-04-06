/**
 * Mower engine sound using Web Audio API.
 * Only the engine drone + blade buzz - no other sounds.
 */

export class Audio {
    constructor() {
        this._ctx = null;
        this._started = false;
        this._engineRunning = false;
    }

    /**
     * Must be called from a user gesture (tap/click) to unlock Web Audio on iOS.
     */
    init() {
        if (this._started) return;
        try {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (_) {
            return;
        }
        this._started = true;

        // Master volume
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = 0.35;
        this._masterGain.connect(this._ctx.destination);

        // --- Engine drone (low hum) ---
        this._engineOsc = this._ctx.createOscillator();
        this._engineOsc.type = 'triangle';
        this._engineOsc.frequency.value = 85;

        this._engineGain = this._ctx.createGain();
        this._engineGain.gain.value = 0;

        // Slight wobble on engine for realism
        const engineLFO = this._ctx.createOscillator();
        engineLFO.type = 'sine';
        engineLFO.frequency.value = 3.5;
        const engineLFOGain = this._ctx.createGain();
        engineLFOGain.gain.value = 4;
        engineLFO.connect(engineLFOGain);
        engineLFOGain.connect(this._engineOsc.frequency);
        engineLFO.start();

        this._engineOsc.connect(this._engineGain);
        this._engineGain.connect(this._masterGain);
        this._engineOsc.start();

        // --- Blade buzz (higher frequency, modulated) ---
        this._bladeOsc = this._ctx.createOscillator();
        this._bladeOsc.type = 'sawtooth';
        this._bladeOsc.frequency.value = 220;

        this._bladeGain = this._ctx.createGain();
        this._bladeGain.gain.value = 0;

        // Amplitude modulation for spinning blade chop
        const bladeModOsc = this._ctx.createOscillator();
        bladeModOsc.type = 'square';
        bladeModOsc.frequency.value = 18;
        const bladeModGain = this._ctx.createGain();
        bladeModGain.gain.value = 0.06;

        // Low-pass filter to soften the buzz
        const bladeFilter = this._ctx.createBiquadFilter();
        bladeFilter.type = 'lowpass';
        bladeFilter.frequency.value = 600;
        bladeFilter.Q.value = 1.5;

        this._bladeOsc.connect(bladeFilter);
        bladeFilter.connect(this._bladeGain);
        bladeModOsc.connect(bladeModGain);
        bladeModGain.connect(this._bladeGain.gain);
        this._bladeGain.connect(this._masterGain);
        this._bladeOsc.start();
        bladeModOsc.start();
    }

    startEngine() {
        if (!this._ctx || this._engineRunning) return;
        this._engineRunning = true;
        const now = this._ctx.currentTime;

        this._engineGain.gain.cancelScheduledValues(now);
        this._engineGain.gain.setValueAtTime(this._engineGain.gain.value, now);
        this._engineGain.gain.linearRampToValueAtTime(0.25, now + 0.4);

        this._bladeGain.gain.cancelScheduledValues(now);
        this._bladeGain.gain.setValueAtTime(this._bladeGain.gain.value, now);
        this._bladeGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
    }

    stopEngine() {
        if (!this._ctx || !this._engineRunning) return;
        this._engineRunning = false;
        const now = this._ctx.currentTime;

        // Wind-down: volume fades and pitch drops
        this._engineGain.gain.cancelScheduledValues(now);
        this._engineGain.gain.setValueAtTime(this._engineGain.gain.value, now);
        this._engineGain.gain.linearRampToValueAtTime(0, now + 0.8);

        this._engineOsc.frequency.cancelScheduledValues(now);
        this._engineOsc.frequency.setValueAtTime(this._engineOsc.frequency.value, now);
        this._engineOsc.frequency.linearRampToValueAtTime(50, now + 0.8);
        this._engineOsc.frequency.setValueAtTime(85, now + 0.85);

        this._bladeGain.gain.cancelScheduledValues(now);
        this._bladeGain.gain.setValueAtTime(this._bladeGain.gain.value, now);
        this._bladeGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    /**
     * Call each frame - slightly raises engine pitch when cutting.
     */
    mowTick(dt, isCutting) {
        if (!this._ctx || !this._engineRunning) return;
        const basePitch = isCutting ? 90 : 85;
        this._engineOsc.frequency.setTargetAtTime(basePitch, this._ctx.currentTime, 0.1);
    }

    resume() {
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
    }
}
