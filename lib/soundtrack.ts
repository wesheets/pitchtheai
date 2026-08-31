export type Soundtrack =
  | 'silence'
  | 'cinematic'
  | 'heartbeat'
  | 'tense'
  | 'fear'
  | 'excitement'
  | 'triumph';

function oscillator(
  context: AudioContext,
  output: AudioNode,
  frequency: number,
  type: OscillatorType,
  volume: number,
) {
  const source = context.createOscillator();
  const gain = context.createGain();
  source.type = type;
  source.frequency.value = frequency;
  gain.gain.value = volume;
  source.connect(gain).connect(output);
  source.start();
  return { source, gain };
}

export function startSoundtrack(
  context: AudioContext,
  track: Soundtrack,
  volume = 0.42,
) {
  if (track === 'cinematic') {
    const audio = new Audio('/audio/elevenlabs-cinematic.mp3');
    audio.loop = true;
    audio.volume = Math.min(0.65, Math.max(0, volume));
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }

  const master = context.createGain();
  master.gain.value = Math.min(0.7, Math.max(0, volume));
  master.connect(context.destination);
  const sources: OscillatorNode[] = [];
  const intervals: number[] = [];
  const add = (frequency: number, type: OscillatorType, volume: number) => {
    const voice = oscillator(context, master, frequency, type, volume);
    sources.push(voice.source);
    return voice;
  };

  if (track === 'heartbeat') {
    const beat = add(54, 'sine', 0);
    const pulse = () => {
      const now = context.currentTime;
      beat.gain.gain.cancelScheduledValues(now);
      beat.gain.gain.setValueAtTime(0, now);
      beat.gain.gain.linearRampToValueAtTime(0.75, now + 0.025);
      beat.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      beat.gain.gain.linearRampToValueAtTime(0.5, now + 0.24);
      beat.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.41);
    };
    pulse();
    intervals.push(window.setInterval(pulse, 920));
  }

  if (track === 'tense') {
    add(92, 'sawtooth', 0.11);
    add(98, 'sine', 0.16);
    const high = add(184, 'triangle', 0.025);
    const breathe = () => {
      const now = context.currentTime;
      high.gain.gain.cancelScheduledValues(now);
      high.gain.gain.setValueAtTime(0.015, now);
      high.gain.gain.linearRampToValueAtTime(0.07, now + 1.4);
      high.gain.gain.linearRampToValueAtTime(0.015, now + 2.8);
    };
    breathe();
    intervals.push(window.setInterval(breathe, 2800));
  }

  if (track === 'fear') {
    add(46, 'sine', 0.24);
    const scrape = add(311, 'sawtooth', 0.012);
    const shift = () => {
      const now = context.currentTime;
      scrape.source.frequency.cancelScheduledValues(now);
      scrape.source.frequency.setValueAtTime(311, now);
      scrape.source.frequency.exponentialRampToValueAtTime(225, now + 1.2);
    };
    shift();
    intervals.push(window.setInterval(shift, 2100));
  }

  if (track === 'excitement') {
    const notes = [220, 277.18, 329.63, 440];
    const lead = add(notes[0], 'triangle', 0.12);
    let step = 0;
    const advance = () => {
      lead.source.frequency.setValueAtTime(
        notes[step % notes.length],
        context.currentTime,
      );
      step += 1;
    };
    intervals.push(window.setInterval(advance, 210));
    add(110, 'sine', 0.07);
  }

  if (track === 'triumph') {
    const chord = [261.63, 329.63, 392];
    chord.forEach((note) => add(note, 'triangle', 0.055));
    const shimmer = add(783.99, 'sine', 0.018);
    const swell = () => {
      const now = context.currentTime;
      shimmer.gain.gain.cancelScheduledValues(now);
      shimmer.gain.gain.setValueAtTime(0.008, now);
      shimmer.gain.gain.linearRampToValueAtTime(0.05, now + 1.1);
      shimmer.gain.gain.linearRampToValueAtTime(0.008, now + 2.2);
    };
    swell();
    intervals.push(window.setInterval(swell, 2200));
  }

  return () => {
    intervals.forEach((interval) => window.clearInterval(interval));
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.08);
    window.setTimeout(() => {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // The oscillator may already be stopped during rapid mood changes.
        }
      });
      master.disconnect();
    }, 100);
  };
}
