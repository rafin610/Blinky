let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

/** Resume audio from a user gesture so a later permitted alert can chime. */
export function primeNotificationAudio(): void {
  const context = getAudioContext();
  if (context?.state === 'suspended') void context.resume().catch(() => {});
}

export async function playCuteNotificationSound(volume: number): Promise<void> {
  const context = getAudioContext();
  if (!context || volume <= 0) return;
  try {
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return;
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(Math.min(1, Math.max(0, volume)) * 0.22, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    master.connect(context.destination);

    for (const [offset, frequency] of [[0, 784], [0.11, 1046]] as const) {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      noteGain.gain.setValueAtTime(0.001, now + offset);
      noteGain.gain.exponentialRampToValueAtTime(0.8, now + offset + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.24);
      oscillator.connect(noteGain);
      noteGain.connect(master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.25);
    }
  } catch {
    // The OS/WebView may reject audio until a user gesture enables playback.
  }
}
