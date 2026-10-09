import React, { useEffect, useState } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { X, ArrowRight } from 'lucide-react';

const dotFor = (category: string) => {
  switch (category) {
    case 'important': return '#F2738C';
    case 'normal': return '#6FAEE4';
    case 'low': return '#C2B6AA';
    default: return '#C2B6AA';
  }
};

export const NotificationBubble: React.FC = () => {
  const { activeNotificationBubble, dismissActiveBubble, setActiveTab, settings } = useBlinkyStore();
  const [leaving, setLeaving] = useState(false);

  const durationSec = Math.min(15, Math.max(3, settings.notificationDuration || 6));

  useEffect(() => {
    if (!activeNotificationBubble) return;
    setLeaving(false);
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => dismissActiveBubble(), 200);
    }, durationSec * 1000);
    return () => clearTimeout(timer);
  }, [activeNotificationBubble?.id]);

  if (!activeNotificationBubble) return null;
  const n = activeNotificationBubble;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => dismissActiveBubble(), 180);
  };

  const open = () => {
    setLeaving(true);
    setTimeout(() => {
      dismissActiveBubble();
      setActiveTab('notifications');
    }, 120);
  };

  const time = new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`notif-bubble ${leaving ? 'leaving' : ''}`}
      onClick={open}
      role="alert"
      aria-label={`Notification from ${n.appName}: ${n.title}`}
    >
      <div className="bubble-top">
        <div className="bubble-app">
          <span className="bubble-dot" style={{ background: dotFor(n.category) }} />
          <span>{n.appName}</span>
        </div>
        <button className="bubble-x" onClick={dismiss} aria-label="Dismiss notification">
          <X size={13} />
        </button>
      </div>
      <div className="bubble-title">{n.title}</div>
      <div className="bubble-text">{n.body}</div>
      <div className="bubble-bottom">
        <span className="bubble-time">{time}</span>
        <button className="bubble-open" onClick={(e) => { e.stopPropagation(); open(); }}>
          Open <ArrowRight size={12} />
        </button>
      </div>
      {!settings.reducedMotion && (
        <div className="bubble-progress">
          <i key={n.id} style={{ animationDuration: `${durationSec}s` }} />
        </div>
      )}
    </div>
  );
};
