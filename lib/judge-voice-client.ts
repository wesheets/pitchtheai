export type VoiceJudgeId = 'maya' | 'julian' | 'priya' | 'theo';
export type VoiceProvider = 'checking' | 'elevenlabs' | 'browser';

type JudgeVoice = {
  name: string;
  pitch: number;
  rate: number;
};

const BROWSER_VOICES: Record<VoiceJudgeId, JudgeVoice> = {
  maya: { name: 'Maya Cross', pitch: 1.12, rate: 1.04 },
  julian: { name: 'Julian Voss', pitch: 0.88, rate: 0.96 },
  priya: { name: 'Priya Nair', pitch: 1, rate: 1.08 },
  theo: { name: 'Theo Grant', pitch: 0.76, rate: 0.92 },
};

function abortError() {
  return new DOMException('Voice playback was stopped.', 'AbortError');
}

export async function getVoiceProvider(): Promise<VoiceProvider> {
  try {
    const response = await fetch('/api/speech', { cache: 'no-store' });
    const result = (await response.json()) as { provider?: VoiceProvider };
    return result.provider === 'elevenlabs' ? 'elevenlabs' : 'browser';
  } catch {
    return 'browser';
  }
}

function speakWithBrowser(
  judgeId: VoiceJudgeId,
  text: string,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    if (!window.speechSynthesis) return reject(new Error('Speech unavailable'));
    const voice = BROWSER_VOICES[judgeId];
    const utterance = new SpeechSynthesisUtterance(`${voice.name}. ${text}`);
    utterance.pitch = voice.pitch;
    utterance.rate = voice.rate;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('Browser speech failed'));
    signal.addEventListener(
      'abort',
      () => {
        window.speechSynthesis.cancel();
        reject(abortError());
      },
      { once: true },
    );
    window.speechSynthesis.speak(utterance);
  });
}

async function playStreamedMp3(
  response: Response,
  signal: AbortSignal,
  setAudio: (audio: HTMLAudioElement | null) => void,
) {
  if (!response.body) throw new Error('Voice stream was empty');

  const audio = new Audio();
  setAudio(audio);
  const mime = 'audio/mpeg';
  const canStream =
    'MediaSource' in window && MediaSource.isTypeSupported(mime);

  if (!canStream) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    try {
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Voice playback failed'));
        signal.addEventListener('abort', () => reject(abortError()), {
          once: true,
        });
      });
    } finally {
      URL.revokeObjectURL(url);
      setAudio(null);
    }
    return;
  }

  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);
  audio.src = url;
  const reader = response.body.getReader();
  const abort = () => {
    audio.pause();
    void reader.cancel();
  };
  signal.addEventListener('abort', abort, { once: true });

  try {
    await new Promise<void>((resolve) => {
      mediaSource.addEventListener('sourceopen', () => resolve(), {
        once: true,
      });
    });
    if (signal.aborted) throw abortError();
    const source = mediaSource.addSourceBuffer(mime);
    let started = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise<void>((resolve, reject) => {
        source.addEventListener('updateend', () => resolve(), { once: true });
        source.addEventListener(
          'error',
          () => reject(new Error('Voice stream decode failed')),
          { once: true },
        );
        source.appendBuffer(value);
      });
      if (!started) {
        started = true;
        await audio.play();
      }
    }
    if (mediaSource.readyState === 'open') mediaSource.endOfStream();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Voice playback failed'));
      signal.addEventListener('abort', () => reject(abortError()), {
        once: true,
      });
    });
  } finally {
    signal.removeEventListener('abort', abort);
    audio.pause();
    URL.revokeObjectURL(url);
    setAudio(null);
  }
}

export async function speakJudge(
  judgeId: VoiceJudgeId,
  text: string,
  provider: VoiceProvider,
  signal: AbortSignal,
  setAudio: (audio: HTMLAudioElement | null) => void,
) {
  if (signal.aborted) throw abortError();
  if (provider === 'elevenlabs') {
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ judgeId, text }),
        signal,
      });
      if (!response.ok) throw new Error('ElevenLabs unavailable');
      await playStreamedMp3(response, signal, setAudio);
      return 'elevenlabs' as const;
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  await speakWithBrowser(judgeId, text, signal);
  return 'browser' as const;
}
