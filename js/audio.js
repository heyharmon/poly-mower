/**
 * Procedural audio for the mower game using Web Audio API.
 * All sounds are synthesized - no audio files needed.
 */

export class Audio {
    constructor() {
        this._ctx = null;
        this._started = false;

        // Nodes
        this._masterGain = null;
        this._engineOsc = null;
        this._engineGain = null;
        this._bladeOsc = null;
        this._bladeGain = null;
        this._bladeModOsc = null;
        this._bladeModGain = null;

        // State
        this._engineRunning = false;
        this._mowTimer = 0;
    }

    /**
     * Must be called from a user gesture (tap/click) to unlock Web Audio on iOS.
     */
    init() {
        if (this._started) return;
        try {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (_) {
            return; // No audio support
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

        // Amplitude modulation for the "spinning blade" chop effect
        this._bladeModOsc = this._ctx.createOscillator();
        this._bladeModOsc.type = 'square';
        this._bladeModOsc.frequency.value = 18; // blade spin rate
        this._bladeModGain = this._ctx.createGain();
        this._bladeModGain.gain.value = 0.06;

        // Low-pass filter to soften the buzz
        const bladeFilter = this._ctx.createBiquadFilter();
        bladeFilter.type = 'lowpass';
        bladeFilter.frequency.value = 600;
        bladeFilter.Q.value = 1.5;

        this._bladeOsc.connect(bladeFilter);
        bladeFilter.connect(this._bladeGain);
        this._bladeModOsc.connect(this._bladeModGain);
        this._bladeModGain.connect(this._bladeGain.gain);
        this._bladeGain.connect(this._masterGain);
        this._bladeOsc.start();
        this._bladeModOsc.start();
    }

    startEngine() {
        if (!this._ctx || this._engineRunning) return;
        this._engineRunning = true;
        const now = this._ctx.currentTime;

        // Ramp up engine
        this._engineGain.gain.cancelScheduledValues(now);
        this._engineGain.gain.setValueAtTime(this._engineGain.gain.value, now);
        this._engineGain.gain.linearRampToValueAtTime(0.25, now + 0.4);

        // Ramp up blade
        this._bladeGain.gain.cancelScheduledValues(now);
        this._bladeGain.gain.setValueAtTime(this._bladeGain.gain.value, now);
        this._bladeGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
    }

    stopEngine() {
        if (!this._ctx || !this._engineRunning) return;
        this._engineRunning = false;
        const now = this._ctx.currentTime;

        // Ramp down engine (wind-down effect)
        this._engineGain.gain.cancelScheduledValues(now);
        this._engineGain.gain.setValueAtTime(this._engineGain.gain.value, now);
        this._engineGain.gain.linearRampToValueAtTime(0, now + 0.8);

        // Pitch drops as it winds down
        this._engineOsc.frequency.cancelScheduledValues(now);
        this._engineOsc.frequency.setValueAtTime(this._engineOsc.frequency.value, now);
        this._engineOsc.frequency.linearRampToValueAtTime(50, now + 0.8);
        // Restore base pitch after wind-down
        this._engineOsc.frequency.setValueAtTime(85, now + 0.85);

        // Ramp down blade
        this._bladeGain.gain.cancelScheduledValues(now);
        this._bladeGain.gain.setValueAtTime(this._bladeGain.gain.value, now);
        this._bladeGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    /**
     * Call each frame when the mower is cutting grass.
     * Creates bursts of noise to simulate grass being cut.
     */
    mowTick(dt, isCutting) {
        if (!this._ctx || !this._engineRunning) return;

        // Slight engine pitch variation when cutting
        const basePitch = isCutting ? 90 : 85;
        const now = this._ctx.currentTime;
        this._engineOsc.frequency.setTargetAtTime(basePitch, now, 0.1);

        if (!isCutting) return;

        // Throttle grass-cut sounds
        this._mowTimer -= dt;
        if (this._mowTimer > 0) return;
        this._mowTimer = 0.06 + Math.random() * 0.06;

        this._playGrassCut();
    }

    _playGrassCut() {
        const ctx = this._ctx;
        const now = ctx.currentTime;

        // Short noise burst = grass snipping sound
        const bufferSize = ctx.sampleRate * 0.04; // 40ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Filtered noise with quick decay
            const t = i / bufferSize;
            data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.3;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000 + Math.random() * 3000;
        filter.Q.value = 0.8;

        const gain = ctx.createGain();
        gain.gain.value = 0.12;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._masterGain);
        source.start(now);
    }

    /**
     * Play a cheerful completion jingle.
     */
    playComplete() {
        if (!this._ctx) return;
        const ctx = this._ctx;
        const now = ctx.currentTime;

        // Simple ascending notes
        const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
        const duration = 0.18;

        for (let i = 0; i < notes.length; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = notes[i];

            const gain = ctx.createGain();
            const start = now + i * duration;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
            gain.gain.linearRampToValueAtTime(0, start + duration);

            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.start(start);
            osc.stop(start + duration + 0.01);
        }
    }

    /**
     * Play a short bump sound when hitting an obstacle.
     */
    playBump() {
        if (!this._ctx) return;
        const ctx = this._ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);

        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(now);
        osc.stop(now + 0.16);
    }

    resume() {
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
    }
}
