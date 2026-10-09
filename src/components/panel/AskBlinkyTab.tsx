import React, { useState, useRef, useEffect } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { askBlinkyStream, isAbortError } from '../../services/aiService';
import { startVoiceRecognition, stopVoiceRecognition } from '../../services/voiceService';
import { Send, Mic, MicOff, ShieldAlert, Square } from 'lucide-react';

export const AskBlinkyTab: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const { chatMessages, addChatMessage, updateLastChatMessage, settings, isListening } = useBlinkyStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth' });
  }, [chatMessages, isLoading]);

  useEffect(() => () => {
    cancelRef.current?.();
    stopVoiceRecognition();
  }, []);

  const handleSend = async (textToSend?: string, opts: { codeText?: string; errorText?: string } = {}) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;
    setInputText('');
    setErrorMessage(null);
    addChatMessage({ sender: 'user', text });
    // Placeholder Blinky message; streamed tokens append into it live.
    addChatMessage({ sender: 'blinky', text: '', isStreaming: true });
    setIsLoading(true);
    useBlinkyStore.getState().setThinking(true);
    let streamed = '';
    try {
      const { promise, cancel } = askBlinkyStream(
        text,
        (token) => {
          streamed += token;
          updateLastChatMessage(streamed);
        },
        { codeText: opts.codeText, errorText: opts.errorText }
      );
      cancelRef.current = cancel;
      const reply = await promise;
      updateLastChatMessage(reply);
    } catch (err: any) {
      if (isAbortError(err)) {
        updateLastChatMessage(streamed.trim() ? `${streamed}\n\n— stopped —` : 'Stopped. Ask me again anytime?');
      } else {
        // Drop the empty placeholder on hard failure, show the reason.
        const msgs = useBlinkyStore.getState().chatMessages;
        if (msgs.length > 0 && msgs[msgs.length - 1].sender === 'blinky' && !msgs[msgs.length - 1].text) {
          useBlinkyStore.setState({ chatMessages: msgs.slice(0, -1) });
        }
        setErrorMessage(err.message || 'Hmm, I got sleepy. Try again?');
      }
    } finally {
      cancelRef.current = null;
      setIsLoading(false);
      useBlinkyStore.getState().setThinking(false);
    }
  };

  const handleStop = () => cancelRef.current?.();

  const handleToggleVoice = () => {
    if (isListening) stopVoiceRecognition();
    else {
      if (!settings.privacy.allowMicrophone) {
        setErrorMessage('Enable microphone access in Settings before using voice input.');
        return;
      }
      setErrorMessage(null);
      startVoiceRecognition(
        (transcript) => { setInputText(transcript); },
        (err) => setErrorMessage(`Voice nap: ${err}`)
      );
    }
  };

  const preparePaste = (kind: 'error' | 'code') => {
    setInputText(kind === 'error' ? 'Explain this error:\n' : 'Explain this code:\n');
    inputRef.current?.focus();
  };

  const suggestions = [
    { label: 'System check', text: 'How is my Linux system running right now?' },
    { label: 'Explain error', action: () => preparePaste('error') },
    { label: 'Code help', action: () => preparePaste('code') },
    { label: 'Linux tip', text: 'Give me one calm, useful Linux terminal tip.' },
  ];

  const isLocal = settings.aiProvider === 'ollama';

  return (
    <div>
      <div className={`chat-local-pill ${isLocal ? '' : 'cloud'}`}>
        <i />{isLocal ? `local · ${settings.ollamaModel}` : `cloud · ${settings.openaiModel}`}
      </div>

      <div className="chat-scroll mini-scroll">
        {chatMessages.slice(-20).map((msg) => (
          <div key={msg.id} className={`msg ${msg.sender === 'user' ? 'user' : 'blinky'}`}>
            {msg.text || (msg.isStreaming ? '…' : '')}
            {msg.screenSnapshot && <img src={msg.screenSnapshot} alt="Screen" className="msg-img" />}
          </div>
        ))}
        {errorMessage && <div className="mini-error"><ShieldAlert size={13} />{errorMessage}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="suggest-row">
        {suggestions.map((s) => (
          <button
            key={s.label}
            className="suggest-chip"
            onClick={() => ('text' in s && s.text ? handleSend(s.text) : (s as any).action?.())}
            disabled={isLoading}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isListening && <div className="voice-listening-indicator" role="status">Listening — tap the mic to stop</div>}
      <form
        className="chat-input"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={isListening ? 'Listening…' : 'Ask Blinky…'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isLoading}
          aria-label="Ask Blinky"
        />
        {isLoading ? (
          <button type="button" className="round-btn mic live" onClick={handleStop} title="Stop answering">
            <Square size={13} />
          </button>
        ) : (
          <button type="button" className={`round-btn mic ${isListening ? 'live' : ''}`} onClick={handleToggleVoice} title="Voice input">
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}
        <button type="submit" className="round-btn send" disabled={!inputText.trim() || isLoading} title="Send">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
