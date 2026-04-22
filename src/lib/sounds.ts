/**
 * SoundManager utility for Grid-Strike
 * Uses Web Audio API to synthesize "TRON-like" digital sound effects.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Audio context is initialized lazily to comply with browser autoplay policies
  }

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; // Global volume
    this.masterGain.connect(this.ctx.destination);
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(err => console.warn("AUDIO_SYNC_FAILED: THE GRID IS SILENT.", err));
    }
  }

  /**
   * Creates a processing chain with optional occlusion (lowpass filter)
   */
  private createChain(occlusion: number = 0) {
    this.init();
    if (!this.ctx || !this.masterGain) return null;

    const gain = this.ctx.createGain();
    let lastNode: AudioNode = gain;

    if (occlusion > 0) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // 20000Hz (full) to 400Hz (muffled)
      const freq = 20000 * Math.pow(0.02, occlusion); 
      filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
      filter.Q.setValueAtTime(1, this.ctx.currentTime);
      
      gain.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(this.masterGain);
    return { gain, lastNode };
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 1, fade: boolean = true, occlusion: number = 0) {
    const chain = this.createChain(occlusion);
    if (!chain || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    chain.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    if (fade) {
      chain.gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    }

    osc.connect(chain.gain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Laser/Plasma discharge
  playShoot(occlusion: number = 0) {
    const chain = this.createChain(occlusion);
    if (!chain || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);

    chain.gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    chain.gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(chain.gain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Target destruction/De-rez
  playExplosion(occlusion: number = 0, volume: number = 1) {
    const chain = this.createChain(occlusion);
    if (!chain || !this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);

    noise.connect(filter);
    filter.connect(chain.gain);

    chain.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    chain.gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    noise.start();
  }

  // Short blip for movement
  playMove(occlusion: number = 0) {
    this.playTone(220, 'sine', 0.05, 0.2, true, occlusion);
  }

  // Arpeggio for power-ups or success
  playSuccess(occlusion: number = 0) {
    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.2, 0.3, true, occlusion);
      }, i * 100);
    });
  }

  // Low frequency impact for collisions
  playImpact(occlusion: number = 0, volume: number = 1) {
    const chain = this.createChain(occlusion);
    if (!chain || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

    chain.gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    chain.gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    osc.connect(chain.gain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
    
    // Add some noise for the "crunch"
    this.playExplosion(occlusion, volume);
  }

  playGameOver() {
    this.playTone(110, 'sawtooth', 2, 0.5, true, 0); // Game over is usually global UI, no occlusion
  }
}

export const sounds = new SoundManager();
