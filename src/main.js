import { BlinkyViewer } from './viewer/BlinkyViewer.js';
import { BlinkyCharacter } from './character/BlinkyCharacter.js';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // 1. Initialize 3D Viewer & Character
  const viewer = new BlinkyViewer(container, {
    transparent: true,
    fov: 30
  });

  const character = new BlinkyCharacter({
    modelUrl: '/models/blinky.glb',
    enableLookAt: true,
    enableAutoBlink: true,
    enableSpringPhysics: true
  });

  await character.init();
  viewer.setCharacter(character);

  console.log('🤖 Blinky initialized:', character.getInfo());

  // 2. UI Elements
  const currentBadge = document.getElementById('current-anim-badge');
  const animCards = document.querySelectorAll('.anim-card');
  const dockButtons = document.querySelectorAll('.dock-btn');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Animation Update Helper
  function activateAnimation(name) {
    character.playAnimation(name, { restart: true });
    if (currentBadge) currentBadge.textContent = name;

    animCards.forEach((c) => {
      c.classList.toggle('active', c.dataset.anim === name);
    });
  }

  // 3. Bind Animation Cards
  animCards.forEach((card) => {
    card.addEventListener('click', () => {
      const animName = card.dataset.anim;
      activateAnimation(animName);
    });
  });

  // 4. Bind Quick Floating Dock
  dockButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const animName = btn.dataset.anim;
      if (animName === 'click') {
        character.triggerSquish(0.45);
      } else {
        activateAnimation(animName);
      }
    });
  });

  // 5. View Mode Switcher (Studio, Transparent, Dark Desktop)
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      viewer.setBackgroundMode(mode);
    });
  });

  // 6. Sidebar Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = `content-${btn.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 7. Interactive Look-At & Auto-Blink Toggles
  const toggleLookAt = document.getElementById('toggle-lookat');
  if (toggleLookAt) {
    toggleLookAt.addEventListener('change', (e) => {
      character.options.enableLookAt = e.target.checked;
    });
  }

  const toggleAutoBlink = document.getElementById('toggle-autoblink');
  if (toggleAutoBlink) {
    toggleAutoBlink.addEventListener('change', (e) => {
      character.options.enableAutoBlink = e.target.checked;
    });
  }

  // 8. Wireframe & Skeleton Toggles
  const toggleWireframe = document.getElementById('toggle-wireframe');
  if (toggleWireframe) {
    toggleWireframe.addEventListener('change', (e) => {
      viewer.setWireframe(e.target.checked);
    });
  }

  const toggleSkeleton = document.getElementById('toggle-skeleton');
  if (toggleSkeleton) {
    toggleSkeleton.addEventListener('change', (e) => {
      viewer.setSkeletonVisible(e.target.checked);
    });
  }

  // 9. Silicone Color Chips & Picker
  const colorChips = document.querySelectorAll('.color-chip');
  const colorPicker = document.getElementById('body-color-picker');

  colorChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      colorChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const color = chip.dataset.color;
      character.setBodyColor(color);
      if (colorPicker) colorPicker.value = color;
    });
  });

  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      colorChips.forEach((c) => c.classList.remove('active'));
      character.setBodyColor(e.target.value);
    });
  }

  // 10. Roughness Slider
  const roughnessSlider = document.getElementById('roughness-slider');
  const roughnessVal = document.getElementById('roughness-val');
  if (roughnessSlider) {
    roughnessSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (roughnessVal) roughnessVal.textContent = val.toFixed(2);
      character.setRoughness(val);
    });
  }

  // 11. Copy Code Snippet Buttons
  document.querySelectorAll('.copy-code-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const codeBox = btn.closest('.code-snippet-box');
      if (codeBox) {
        const codeText = codeBox.querySelector('code').textContent;
        navigator.clipboard.writeText(codeText);
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1500);
      }
    });
  });

  // 12. Keyboard Shortcuts (1-9, 0, -, = for the 12 animations; Space for squish)
  const animList = [
    'idle', 'blink', 'breathing', 'floating',
    'happy', 'notification', 'click', 'thinking',
    'sleep', 'error_sad', 'wave', 'excited'
  ];

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      character.triggerSquish(0.45);
      return;
    }

    const keyIndexMap = {
      'Digit1': 0, 'Digit2': 1, 'Digit3': 2, 'Digit4': 3,
      'Digit5': 4, 'Digit6': 5, 'Digit7': 6, 'Digit8': 7,
      'Digit9': 8, 'Digit0': 9, 'Minus': 10, 'Equal': 11
    };

    if (keyIndexMap[e.code] !== undefined) {
      const animName = animList[keyIndexMap[e.code]];
      if (animName) activateAnimation(animName);
    }
  });
});
