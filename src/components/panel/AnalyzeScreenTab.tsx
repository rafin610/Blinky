import React, { useState } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { captureScreenNative } from '../../services/systemService';
import { askBlinky, describeVisionSupport, VisionSupport } from '../../services/aiService';
import { ShieldCheck, Camera, ScanEye, AlertCircle, Sparkles, EyeOff } from 'lucide-react';

export const AnalyzeScreenTab: React.FC = () => {
  const { settings, updateSettings, addChatMessage } = useBlinkyStore();
  const [snap, setSnap] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionSupport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOptedIn = settings.privacy.allowScreenCapture;
  const isCloud = settings.aiProvider === 'openai';

  const handleCapture = async () => {
    setErrorMsg(null);
    setIsCapturing(true);
    try {
      const dataUrl = await captureScreenNative(true);
      setSnap(dataUrl);
      setAnalysisResult(null);
      // Verify vision support for the CURRENT provider+model before any
      // image-shaped payload is sent anywhere.
      setVision(await describeVisionSupport());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to capture screen.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleAnalyze = async (promptToUse?: string) => {
    const prompt = (promptToUse || customPrompt || 'Explain what is visible on this screen.').trim();
    if (!snap || isAnalyzing) return;

    // Hard gate: text-only local model → image never leaves the device.
    const support = vision ?? (await describeVisionSupport());
    if (!vision) setVision(support);
    if (!support.supported) {
      setErrorMsg(support.reason);
      return;
    }
    // Cloud images need their own explicit consent at send time.
    if (isCloud && !settings.privacy.allowCloudAI) {
      setErrorMsg('Sending screenshots to the cloud needs your explicit opt-in in Settings → AI first.');
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const response = await askBlinky(prompt, snap);
      setAnalysisResult(response);
      addChatMessage({ sender: 'user', text: prompt });
      addChatMessage({ sender: 'blinky', text: response });
    } catch (err: any) {
      setErrorMsg(err.message || 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const presets = [
    { label: 'Summarize', prompt: 'Summarize the main content and text on this screen.' },
    { label: 'Find errors', prompt: 'Look at the screen and identify any errors, warnings, or bugs.' },
    { label: 'Next step', prompt: 'What is the most logical next action based on what is open here?' },
  ];

  if (!isOptedIn) {
    return (
      <div className="privacy-note">
        <span className="menu-icon peach"><ShieldCheck size={18} /></span>
        <b>Your screen stays yours</b>
        <p>Blinky never looks without asking.<br />Opt in once to let me glance at your workspace — only when you tap capture.</p>
        <label className="consent-row">
          <input
            type="checkbox"
            onChange={(e) => updateSettings({ privacy: { ...settings.privacy, allowScreenCapture: e.target.checked } })}
          />
          <span>I allow Blinky to capture my screen when I ask.</span>
        </label>
      </div>
    );
  }

  const visionBlocked = vision != null && !vision.supported;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button className="mini-btn dark" onClick={handleCapture} disabled={isCapturing || isAnalyzing} style={{ flex: 1, justifyContent: 'center' }}>
          <Camera size={13} /> {snap ? 'Retake' : isCapturing ? 'Capturing…' : 'Capture screen'}
        </button>
      </div>

      {snap ? (
        <>
          <img src={snap} alt="Workspace snapshot" className="snap-img" />

          {vision && !vision.supported && (
            <div className="vision-limit-card">
              <EyeOff size={15} />
              <div>
                <b>{vision.model} can’t see images</b>
                <p>{vision.reason}</p>
                {!vision.ocrAvailable && <code>{vision.ocrHint}</code>}
              </div>
            </div>
          )}

          <div className="suggest-row" style={{ marginTop: 8 }}>
            {presets.map((p) => (
              <button
                key={p.label}
                className="suggest-chip"
                disabled={isAnalyzing || visionBlocked}
                title={visionBlocked ? 'Current model cannot see images' : p.label}
                onClick={() => handleAnalyze(p.prompt)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="analyze-row">
            <input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask about this screen…"
              disabled={isAnalyzing || visionBlocked}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
            />
            <button className="round-btn send" onClick={() => handleAnalyze()} disabled={isAnalyzing || visionBlocked} title="Analyze">
              <ScanEye size={14} />
            </button>
          </div>

          {isAnalyzing && (
            <div className="msg blinky thinking" style={{ marginTop: 8 }}>
              <span>looking closely</span>
              <span className="typing-dots"><i /><i /><i /></span>
            </div>
          )}
          {analysisResult && (
            <div className="result-calm">
              <b><Sparkles size={12} /> Blinky sees</b>
              <p>{analysisResult}</p>
            </div>
          )}
        </>
      ) : (
        <div className="empty-calm">
          <div className="empty-face"><ScanEye size={18} /></div>
          <b>No snapshot yet</b>
          <span>Capture your workspace,<br />then ask me about it.</span>
        </div>
      )}

      {errorMsg && <div className="mini-error" style={{ marginTop: 8 }}><AlertCircle size={13} />{errorMsg}</div>}
    </div>
  );
};
