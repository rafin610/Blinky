import { useBlinkyStore } from '../store/blinkyStore';

/**
 * Voice System for Blinky Companion
 * Provides Speech-to-Text and cute Text-to-Speech
 */

let recognitionInstance: any = null;

export function startVoiceRecognition(
  onResult: (text: string) => void,
  onError?: (err: string) => void
): boolean {
  if (!useBlinkyStore.getState().settings.privacy.allowMicrophone) {
    onError?.('Enable microphone access in Settings before using voice input.');
    return false;
  }
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (onError) onError('Speech recognition is not supported in this browser/webview.');
    return false;
  }

  try {
    if (recognitionInstance) {
      recognitionInstance.abort();
    }

    const recognition = new SpeechRecognition();
    recognitionInstance = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const { setListening } = useBlinkyStore.getState();
    setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      if (onError) onError('Speech recognition stopped. Check microphone permission and try again.');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
    return true;
  } catch (err: any) {
    useBlinkyStore.getState().setListening(false);
    if (onError) onError('Could not start voice recognition. Check microphone permission and try again.');
    return false;
  }
}

export function stopVoiceRecognition() {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {
      // ignore
    }
    recognitionInstance = null;
  }
  useBlinkyStore.getState().setListening(false);
}

export function speakText(text: string) {
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.25; // cute, friendly companion pitch
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('TTS error:', e);
  }
}
