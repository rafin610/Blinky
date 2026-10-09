import React from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { AskBlinkyTab } from './AskBlinkyTab';
import { NotificationsTab } from './NotificationsTab';
import { AnalyzeScreenTab } from './AnalyzeScreenTab';
import { QuickActionsTab } from './QuickActionsTab';
import { SettingsTab } from './SettingsTab';
import {
  MessageCircleHeart,
  ScanEye,
  Bell,
  Sparkles,
  Settings as SettingsIcon,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkle,
} from 'lucide-react';
import type { PanelView } from '../../types';

const VIEW_META: Record<Exclude<PanelView, 'home'>, { title: string; desc: string }> = {
  ask: { title: 'Ask Blinky', desc: 'Quiet chat — I stay right here' },
  analyze: { title: 'Analyze Screen', desc: 'Only with your permission' },
  notifications: { title: 'Notifications', desc: 'What arrived while you were away' },
  actions: { title: 'Quick Actions', desc: 'Small things, one tap' },
  settings: { title: 'Settings', desc: 'Keep me calm and out of the way' },
};

export const InteractionPanel: React.FC = () => {
  const { isPanelOpen, togglePanel, activeTab, setActiveTab, goHome, notifications, playAnimation } = useBlinkyStore();

  if (!isPanelOpen) return null;

  const unread = notifications.filter((n) => !n.read).length;

  if (activeTab === 'home') {
    return (
      <div className="blinky-panel" role="dialog" aria-label="Blinky menu">
        <div className="panel-top">
          <div className="panel-identity">
            <div className="identity-spark"><Sparkle size={14} /></div>
            <span className="identity-name">Blinky</span>
            <span className="identity-live"><i />live</span>
          </div>
          <button className="panel-close" onClick={() => togglePanel(false)} aria-label="Close Blinky panel">
            <X size={14} />
          </button>
        </div>

        <div className="panel-body">
          <div className="home-greeting">
            <h2>What can I help with?</h2>
            <p>Your calm little desk friend ✦</p>
          </div>

          <div className="home-menu">
            <button className="menu-row" onClick={() => { playAnimation('happy'); setActiveTab('ask'); }}>
              <span className="menu-icon sky"><MessageCircleHeart size={16} /></span>
              <span className="menu-text"><b>Ask Blinky</b><span>Chat, tips &amp; Linux help</span></span>
              <ChevronRight size={15} className="menu-chev" />
            </button>

            <button className="menu-row" onClick={() => { playAnimation('thinking'); setActiveTab('analyze'); }}>
              <span className="menu-icon lav"><ScanEye size={16} /></span>
              <span className="menu-text"><b>Analyze Screen</b><span>Look at my workspace</span></span>
              <ChevronRight size={15} className="menu-chev" />
            </button>

            <button className="menu-row" onClick={() => setActiveTab('notifications')}>
              <span className="menu-icon peach"><Bell size={16} /></span>
              <span className="menu-text"><b>Notifications</b><span>{unread > 0 ? `${unread} waiting for you` : 'All caught up'}</span></span>
              {unread > 0 && <span className="menu-badge">{unread > 9 ? '9+' : unread}</span>}
              <ChevronRight size={15} className="menu-chev" />
            </button>

            <button className="menu-row" onClick={() => setActiveTab('actions')}>
              <span className="menu-icon mint"><Sparkles size={16} /></span>
              <span className="menu-text"><b>Quick Actions</b><span>Wave, breathe, system</span></span>
              <ChevronRight size={15} className="menu-chev" />
            </button>
          </div>

          <div className="home-foot">
            <button onClick={() => setActiveTab('settings')}>
              <SettingsIcon size={13} /> Settings
            </button>
            <span className="hotkey-hint"><b>Ctrl</b> + <b>Space</b> to call me</span>
          </div>
        </div>
      </div>
    );
  }

  const meta = VIEW_META[activeTab as Exclude<PanelView, 'home'>];

  return (
    <div className="blinky-panel" role="dialog" aria-label={meta.title}>
      <div className="panel-top" style={{ paddingBottom: 0 }}>
        <div className="panel-identity">
          <div className="identity-spark"><Sparkle size={14} /></div>
          <span className="identity-name">Blinky</span>
        </div>
        <button className="panel-close" onClick={() => togglePanel(false)} aria-label="Close panel">
          <X size={14} />
        </button>
      </div>

      <div className="panel-subhead">
        <button className="panel-back" onClick={goHome} aria-label="Back to menu">
          <ChevronLeft size={15} />
        </button>
        <div>
          <div className="panel-subtitle">{meta.title}</div>
          <div className="panel-subdesc">{meta.desc}</div>
        </div>
      </div>

      <div className="panel-body mini-scroll">
        {activeTab === 'ask' && <AskBlinkyTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'analyze' && <AnalyzeScreenTab />}
        {activeTab === 'actions' && <QuickActionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};
