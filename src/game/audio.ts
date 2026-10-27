// Audio system using Web Audio API

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
  }

  setEnabled(v: boolean) { this.enabled = v; }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.3, freqEnd?: number) {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 0.3) {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  shootMachinegun() {
    this.playTone(800, 0.05, 'square', 0.15);
  }

  shootLaser() {
    this.playTone(1200, 0.15, 'sawtooth', 0.2, 400);
  }

  shootRocket() {
    this.playTone(200, 0.3, 'sawtooth', 0.2, 100);
  }

  explosion() {
    this.playNoise(0.4, 0.4);
    this.playTone(100, 0.3, 'sawtooth', 0.3, 30);
  }

  bigExplosion() {
    this.playNoise(0.8, 0.5);
    this.playTone(60, 0.6, 'sawtooth', 0.4, 20);
  }

  pickup() {
    this.playTone(600, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(900, 0.1, 'sine', 0.2), 50);
    setTimeout(() => this.playTone(1200, 0.15, 'sine', 0.2), 100);
  }

  playerHit() {
    this.playNoise(0.2, 0.3);
    this.playTone(200, 0.2, 'square', 0.3, 50);
  }

  playerDeath() {
    this.playNoise(0.6, 0.4);
    this.playTone(300, 0.5, 'sawtooth', 0.4, 30);
  }

  bossAppear() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.playTone(100 + i * 50, 0.3, 'square', 0.2), i * 200);
    }
  }

  shieldBreak() {
    this.playTone(2000, 0.1, 'square', 0.3);
    this.playTone(1500, 0.1, 'square', 0.2);
    this.playNoise(0.15, 0.2);
  }

  ultimateActivate() {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.playTone(300 + i * 100, 0.15, 'sine', 0.2), i * 50);
    }
  }

  waveComplete() {
    this.playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.2), 150);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.2), 300);
  }

  enemyShoot() {
    this.playTone(400, 0.1, 'square', 0.1, 200);
  }
}

export const audio = new AudioSystem();
