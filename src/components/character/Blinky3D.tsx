import React, { useEffect, useRef, useState } from 'react';
import { useBlinkyStore } from '../../store/blinkyStore';
import { BlinkyViewer } from '../../viewer/BlinkyViewer';
import { BlinkyCharacter } from '../../character/BlinkyCharacter';

interface Blinky3DProps {
  isPanelOpen: boolean;
}

export const Blinky3D: React.FC<Blinky3DProps> = ({ isPanelOpen }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<BlinkyViewer | null>(null);
  const characterRef = useRef<BlinkyCharacter | null>(null);
  const [hovering, setHovering] = useState(false);

  const {
    currentAnimation,
    settings,
    togglePanel,
    isThinking,
    isListening,
  } = useBlinkyStore();

  // Init Three.js once — lightweight, transparent, idle-friendly
  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = new BlinkyViewer(containerRef.current, {
      transparent: true,
      fov: 30,
      showShadow: false, // we use CSS floor shadow — cheaper + softer
    });
    viewer.setBackgroundMode('transparent');
    viewerRef.current = viewer;

    const character = new BlinkyCharacter({
      modelUrl: '/models/blinky.glb',
      enableLookAt: settings.enableLookAt,
      enableAutoBlink: settings.enableAutoBlink,
      enableSpringPhysics: true,
    });

    character.init().then(() => {
      viewer.setCharacter(character);
      characterRef.current = character;
      character.setBodyColor(settings.siliconeColor);
      character.setRoughness(settings.roughness);
      // Single soft CSS floor shadow — hide the 3D blob to avoid doubling
      try {
        const v = viewer as unknown as { shadowPlane?: { visible: boolean } };
        if (v.shadowPlane) v.shadowPlane.visible = false;
      } catch { /* noop */ }
      // Idle behavior from settings
      const idleMap = { float: 'floating', breathe: 'breathing', still: 'idle' } as const;
      const idleAnim = idleMap[settings.idleBehavior || 'float'];
      if (idleAnim && idleAnim !== 'idle') {
        try { character.playAnimation(idleAnim); } catch { /* noop */ }
      }
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
      characterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync animation + appearance (respects intensity for squish)
  useEffect(() => {
    if (characterRef.current) {
      try { characterRef.current.playAnimation(currentAnimation); } catch { /* noop */ }
    }
  }, [currentAnimation]);

  useEffect(() => {
    if (characterRef.current) {
      characterRef.current.setBodyColor(settings.siliconeColor);
      characterRef.current.setRoughness(settings.roughness);
      characterRef.current.options.enableLookAt = settings.enableLookAt && !settings.reducedMotion;
      characterRef.current.options.enableAutoBlink = settings.enableAutoBlink;
    }
  }, [settings.siliconeColor, settings.roughness, settings.enableLookAt, settings.enableAutoBlink, settings.reducedMotion]);

  const startDrag = async () => {
    try {
      if ('__TAURI_INTERNALS__' in window) {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        await getCurrentWebviewWindow().startDragging();
      }
    } catch { /* browser preview — ignore */ }
  };

  const handleTap = () => {
    // Gentle poke scaled by animation intensity, then open home menu
    if (characterRef.current && !settings.reducedMotion) {
      const intensity = 0.25 + (settings.animationIntensity ?? 0.7) * 0.35;
      characterRef.current.triggerSquish(intensity);
    }
    togglePanel();
  };

  const presenceLabel = isListening ? 'listening' : isThinking ? 'thinking' : isPanelOpen ? 'here to help' : 'on your desk';

  return (
    <div
      className="blinky-character-zone"
      onMouseDown={(e) => { if (e.button === 0) startDrag(); }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handleTap}
      title="Blinky — click to say hi, drag to move"
      role="button"
      aria-label="Blinky desktop companion. Activate to open menu."
    >
      <div className="blinky-floor-shadow" />
      <div ref={containerRef} className="blinky-canvas" />

      {/* Only chrome when idle: a tiny breathing presence pill */}
      <div className="blinky-presence">
        <span className={`presence-dot ${isThinking ? 'thinking' : isListening ? 'listening' : ''}`} />
        <span className="presence-label">{presenceLabel}</span>
      </div>

      {hovering && !isPanelOpen && (
        <div className="blinky-hint">hi, I&apos;m Blinky ✦</div>
      )}
    </div>
  );
};
