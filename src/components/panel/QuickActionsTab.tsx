import React, { useEffect, useState } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { fetchSystemContext } from '../../services/systemService';
import { explainSystem } from '../../services/aiService';
import { Cpu, MemoryStick, Battery, Clock, Hand, Smile, Wind, MoonStar, Brain } from 'lucide-react';

export const QuickActionsTab: React.FC = () => {
  const { systemContext, setSystemContext, playAnimation, setMood, setActiveTab, addChatMessage } = useBlinkyStore();
  const [explaining, setExplaining] = useState(false);
  const [explainErr, setExplainErr] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemContext().then(setSystemContext);
    const t = setInterval(() => fetchSystemContext().then(setSystemContext), 5000);
    return () => clearInterval(t);
  }, []);

  const ramPct = Math.round((systemContext.ramUsedMb / (systemContext.ramTotalMb || 1)) * 100);
  const uptime = `${Math.floor(systemContext.uptimeSecs / 3600)}h ${Math.floor((systemContext.uptimeSecs % 3600) / 60)}m`;

  const tiles = [
    { icon: <Hand size={15} />, tint: 'sky', title: 'Wave', sub: 'say hello', fn: () => playAnimation('wave') },
    { icon: <Smile size={15} />, tint: 'peach', title: 'Happy', sub: 'little hop', fn: () => playAnimation('happy') },
    { icon: <Wind size={15} />, tint: 'mint', title: 'Breathe', sub: 'calm loop', fn: () => playAnimation('breathing') },
    { icon: <MoonStar size={15} />, tint: 'lav', title: 'Sleep', sub: 'rest eyes', fn: () => setMood('sleepy') },
  ] as const;

  return (
    <div>
      <div className="sys-sip">
        <div className="sys-sip-top">
          <b>System</b>
          <span>{systemContext.desktopSession}</span>
        </div>
        <div className="sys-grid">
          <div className="sys-cell">
            <label><Cpu size={11} /> CPU</label>
            <strong>{Math.round(systemContext.cpuUsage)}%</strong>
            <div className="meter"><i style={{ width: `${Math.min(100, systemContext.cpuUsage)}%` }} /></div>
          </div>
          <div className="sys-cell">
            <label><MemoryStick size={11} /> RAM</label>
            <strong>{ramPct}%</strong>
            <div className="meter"><i style={{ width: `${ramPct}%` }} /></div>
          </div>
          <div className="sys-cell">
            <label><Battery size={11} /> Power</label>
            <strong style={{ fontSize: 12 }}>{systemContext.batteryPercent != null ? `${systemContext.batteryPercent}%` : 'AC'}</strong>
            <small>{systemContext.isCharging ? 'charging' : 'on battery'}</small>
          </div>
          <div className="sys-cell">
            <label><Clock size={11} /> Uptime</label>
            <strong style={{ fontSize: 12 }}>{uptime}</strong>
            <small>awake with you</small>
          </div>
        </div>
      </div>

      <div className="section-label">Say hi to Blinky</div>
      <div className="tiles-2">
        {tiles.map((t) => (
          <button key={t.title} className="tile-calm" onClick={t.fn}>
            <span className={`menu-icon ${t.tint}`}>{t.icon}</span>
            <span><b>{t.title}</b><span>{t.sub}</span></span>
          </button>
        ))}
      </div>

      <div className="section-label">Need words?</div>
      <button className="menu-row" onClick={() => setActiveTab('ask')}>
        <span className="menu-icon sky"><Smile size={15} /></span>
        <span className="menu-text"><b>Ask something</b><span>Back to quiet chat</span></span>
      </button>

      <div className="section-label">Understand this</div>
      <button
        className="menu-row"
        disabled={explaining}
        onClick={async () => {
          setExplainErr(null);
          setExplaining(true);
          try {
            const answer = await explainSystem();
            addChatMessage({ sender: 'user', text: 'How is my Linux system running right now?' });
            addChatMessage({ sender: 'blinky', text: answer });
            setActiveTab('ask');
          } catch (err: any) {
            setExplainErr(err.message || 'Could not explain just now.');
          } finally {
            setExplaining(false);
          }
        }}
      >
        <span className="menu-icon mint"><Brain size={15} /></span>
        <span className="menu-text">
          <b>{explaining ? 'Blinky is looking…' : 'Explain my system'}</b>
          <span>CPU, RAM, battery in plain words</span>
        </span>
      </button>
      {explainErr && <div className="mini-error" style={{ marginTop: 6 }}><span>{explainErr}</span></div>}
    </div>
  );
};
