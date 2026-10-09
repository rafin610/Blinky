import React, { useState } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import type { NotificationCategory } from '../../types';
import { BellOff, CheckCheck, Trash2, Sparkles } from 'lucide-react';

const dotFor = (c: NotificationCategory) =>
  c === 'important' ? '#F2738C' : c === 'normal' ? '#6FAEE4' : '#C2B6AA';

export const NotificationsTab: React.FC = () => {
  const [filter, setFilter] = useState<'all' | NotificationCategory>('all');
  const { notifications, dismissNotification, clearAllNotifications, addNotification, togglePanel, settings } = useBlinkyStore();

  const filtered = notifications.filter((n) => (filter === 'all' ? true : n.category === filter));

  const simulate = () => {
    const samples = [
      { appName: 'GitHub', title: 'New issue assigned to you', body: 'blinky-widget: soften the idle shadow on 4K displays', category: 'important' as const },
      { appName: 'Discord', title: '#linux-dev mentioned you', body: 'New Wayland transparency patch is ready to test', category: 'normal' as const },
      { appName: 'Terminal', title: 'Build finished', body: 'cargo build completed with 0 errors', category: 'low' as const },
    ];
    // Preview the true idle moment: tuck the panel away first so the
    // bubble floats above Blinky, just like a real OS notification.
    togglePanel(false);
    addNotification(samples[Math.floor(Math.random() * samples.length)]);
  };

  return (
    <div>
      {!settings.privacy.allowNotificationMonitoring && (
        <div className="privacy-note" style={{ marginBottom: 8 }}>
          <b>Notification monitoring is off</b>
          <p>Enable it in Settings and choose the apps Blinky may monitor.</p>
        </div>
      )}
      <div className="desktop-window-note">
        Blinky handles notification events forwarded by an integration. This build does not intercept other apps&apos; system notifications; use Preview a notification to test the in-app sound and animation.
      </div>
      <div className="filter-row">
        {(['all', 'important', 'normal', 'low'] as const).map((c) => (
          <button key={c} className={`filter-pill ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
        <span className="filter-spacer" />
        <button className="icon-mini" onClick={simulate} title="Preview a notification">
          <Sparkles size={13} />
        </button>
        {notifications.length > 0 && (
          <button className="icon-mini" onClick={clearAllNotifications} title="Clear all">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-calm">
          <div className="empty-face"><BellOff size={18} /></div>
          <b>All quiet ✦</b>
          <span>Blinky will tap you gently<br />when something arrives.</span>
        </div>
      ) : (
        <div className="calm-list mini-scroll">
          {filtered.map((n) => (
            <div key={n.id} className="calm-card">
              <div className="calm-card-top">
                <span className="calm-app">
                  <span className="bubble-dot" style={{ background: dotFor(n.category) }} />
                  {n.appName}
                </span>
                <span className="calm-time">
                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="calm-title">{n.title}</div>
              <div className="calm-text">{n.body}</div>
              <div className="calm-actions">
                <span className={`tag-pill ${n.category}`}>{n.category}</span>
                <button className="mini-btn" onClick={() => dismissNotification(n.id)}>
                  <CheckCheck size={12} /> Done
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
