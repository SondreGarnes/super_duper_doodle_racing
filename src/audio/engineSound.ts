// Fully procedural engine audio — no samples. A saw + sub-square pair through a
// lowpass gives the engine tone; looped noise through a bandpass gives the tire
// screech while drifting. Pitch and volume track speed/throttle; boost pitches up.
// Browsers block audio until a user gesture, so the context resumes on first input.

export class EngineSound {
  private ctx: AudioContext;
  private master: GainNode;
  private osc: OscillatorNode;
  private sub: OscillatorNode;
  private screechGain: GainNode;
  private screechFilter: BiquadFilterNode;
  private muted = false;
  private started = false;

  constructor() {
    this.ctx = new AudioContext();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineFilter.connect(this.master);

    this.osc = this.ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 55;
    const oscGain = this.ctx.createGain();
    oscGain.gain.value = 0.55;
    this.osc.connect(oscGain).connect(engineFilter);

    this.sub = this.ctx.createOscillator();
    this.sub.type = 'square';
    this.sub.frequency.value = 27.5;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.3;
    this.sub.connect(subGain).connect(engineFilter);

    // 1s white-noise loop for the drift screech.
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 2100;
    this.screechFilter.Q.value = 2.5;
    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;
    noise.connect(this.screechFilter).connect(this.screechGain).connect(this.master);

    this.osc.start();
    this.sub.start();
    noise.start();

    const resume = () => {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.started = true;
    };
    window.addEventListener('keydown', resume, { once: true });
    window.addEventListener('pointerdown', resume, { once: true });
  }

  update(speedMs: number, throttle: number, drifting: boolean, boosting: boolean): void {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const rpm = Math.min(Math.abs(speedMs) / 32, 1);

    const freq = (52 + 215 * rpm + 14 * throttle) * (boosting ? 1.3 : 1);
    this.osc.frequency.setTargetAtTime(freq, now, 0.06);
    this.sub.frequency.setTargetAtTime(freq / 2, now, 0.06);

    const volume = this.muted
      ? 0
      : 0.035 + 0.13 * rpm + 0.05 * throttle + (boosting ? 0.05 : 0);
    this.master.gain.setTargetAtTime(volume, now, 0.09);

    const screech = !this.muted && drifting ? 0.16 : 0;
    this.screechGain.gain.setTargetAtTime(screech, now, 0.05);
    if (drifting) {
      // Wobble the screech center so it sounds alive rather than like a test tone.
      this.screechFilter.frequency.setTargetAtTime(1900 + Math.random() * 500, now, 0.08);
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }
}
