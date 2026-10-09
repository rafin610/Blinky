import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBlinkyRig } from '../model/BlinkyGeometry.js';
import { createBlinkyAnimations } from '../model/BlinkyAnimations.js';

/**
 * High-performance 3D Character Controller for Blinky
 * Supports:
 * - Direct GLB loading or procedural fallback
 * - State machine managing all 12 animation clips
 * - Smooth cross-fading between animations
 * - Dynamic mouse tracking / Look-At IK (head and eyes follow cursor)
 * - Spring physics for tactile squish on click/drag
 * - Auto-idle behavior (autonomous natural blinking, periodic fidgets)
 * - Material customizer (silicone tint, roughness, blush)
 */
export class BlinkyCharacter {
  constructor(options = {}) {
    this.options = {
      modelUrl: '/models/blinky.glb',
      enableLookAt: true,
      enableAutoBlink: true,
      enableSpringPhysics: true,
      ...options
    };

    this.group = new THREE.Group();
    this.group.name = 'Blinky_Character_Controller';

    this.mixer = null;
    this.actions = new Map();
    this.currentActionName = 'idle';
    this.previousActionName = null;

    // Bone references
    this.bones = {};
    this.meshes = {};
    this.materials = {};

    // Look-At / Mouse Tracking
    this.lookTarget = new THREE.Vector2(0, 0); // normalized [-1, 1]
    this.currentLook = new THREE.Vector2(0, 0);
    this.lookWeight = 1.0;

    // Spring Physics (for squish & stretch on click)
    this.spring = {
      position: 0,
      velocity: 0,
      target: 0,
      stiffness: 220,
      damping: 14
    };

    // Autonomous blinking state
    this.blinkTimer = 0;
    this.nextBlinkInterval = 3.5;

    this.isLoaded = false;
    this.onLoaded = null;
  }

  /**
   * Initializes the character by loading blinky.glb or procedural generation
   */
  async init() {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(this.options.modelUrl);
      this.setupFromGLTF(gltf);
    } catch (err) {
      console.warn('⚠️ Could not load external GLB, falling back to procedural rig:', err);
      this.setupProcedural();
    }

    this.isLoaded = true;
    if (this.onLoaded) this.onLoaded(this);
    return this;
  }

  /**
   * Setup from loaded GLTF model
   */
  setupFromGLTF(gltf) {
    const characterModel = gltf.scene;
    this.group.add(characterModel);

    // Map bones and meshes
    characterModel.traverse((child) => {
      if (child.isBone) {
        this.bones[child.name] = child;
      }
      if (child.isMesh) {
        this.meshes[child.name] = child;
        if (child.material) {
          this.materials[child.material.name] = child.material;
        }
      }
    });

    // Setup Animation Mixer
    this.mixer = new THREE.AnimationMixer(characterModel);

    gltf.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);

      // Configure looping behavior
      if (['idle', 'breathing', 'floating', 'thinking', 'sleep', 'excited'].includes(clip.name)) {
        action.setLoop(THREE.LoopRepeat);
      } else {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }
    });

    // Listen for animation finished events to return to idle
    this.mixer.addEventListener('finished', (e) => {
      const finishedClipName = e.action.getClip().name;
      if (['blink', 'click', 'notification', 'wave', 'happy'].includes(finishedClipName)) {
        this.playAnimation(this.previousActionName || 'idle', { duration: 0.4 });
      }
    });

    // Start with Idle
    this.playAnimation('idle');
  }

  /**
   * Setup procedurally if GLB is not served yet
   */
  setupProcedural() {
    const rig = createBlinkyRig();
    const clips = createBlinkyAnimations();

    this.group.add(rig.group);
    this.bones = rig.bones;
    this.meshes = rig.meshes;
    this.materials = rig.materials;

    this.mixer = new THREE.AnimationMixer(rig.group);

    clips.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);

      if (['idle', 'breathing', 'floating', 'thinking', 'sleep', 'excited'].includes(clip.name)) {
        action.setLoop(THREE.LoopRepeat);
      } else {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }
    });

    this.mixer.addEventListener('finished', (e) => {
      const finishedClipName = e.action.getClip().name;
      if (['blink', 'click', 'notification', 'wave', 'happy'].includes(finishedClipName)) {
        this.playAnimation(this.previousActionName || 'idle', { duration: 0.4 });
      }
    });

    this.playAnimation('idle');
  }

  /**
   * Play any of the 12 animations with smooth cross-fading
   * @param {string} name - Animation name
   * @param {object} options - { duration: 0.35, restart: false }
   */
  playAnimation(name, options = {}) {
    const nextAction = this.actions.get(name);
    if (!nextAction) {
      console.warn(`Animation "${name}" not found in Blinky.`);
      return;
    }

    const fadeDuration = options.duration !== undefined ? options.duration : 0.35;
    const currentAction = this.actions.get(this.currentActionName);

    if (currentAction && currentAction !== nextAction) {
      this.previousActionName = this.currentActionName;
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      nextAction.crossFadeFrom(currentAction, fadeDuration, true);
      nextAction.play();
    } else {
      if (options.restart || !nextAction.isRunning()) {
        nextAction.reset();
        nextAction.play();
      }
    }

    this.currentActionName = name;

    // Trigger soft blush fade for happy/excited
    if (['happy', 'excited'].includes(name)) {
      this.setBlushOpacity(0.85);
    } else if (name !== 'click') {
      this.setBlushOpacity(0.0);
    }
  }

  /**
   * Trigger a temporary emotional reaction and automatically return to idle
   * @param {string} reaction - 'happy' | 'notification' | 'click' | 'wave' | 'error_sad'
   */
  playReaction(reaction) {
    this.playAnimation(reaction, { restart: true, duration: 0.25 });
  }

  /**
   * Set companion mood state
   * @param {string} mood - 'idle' | 'breathing' | 'floating' | 'thinking' | 'sleep' | 'excited'
   */
  setMood(mood) {
    this.playAnimation(mood, { duration: 0.45 });
  }

  /**
   * Interactive squish poke on click/tap
   * @param {number} intensity - Compression force (default 0.35)
   */
  triggerSquish(intensity = 0.35) {
    this.spring.velocity -= intensity * 8.0;
    this.playAnimation('click', { restart: true, duration: 0.15 });
  }

  /**
   * Set target cursor coordinate for Look-At tracking
   * @param {number} nx - Normalized X [-1, 1]
   * @param {number} ny - Normalized Y [-1, 1]
   */
  setCursorTarget(nx, ny) {
    this.lookTarget.set(
      THREE.MathUtils.clamp(nx, -1.0, 1.0),
      THREE.MathUtils.clamp(ny, -1.0, 1.0)
    );
  }

  /**
   * Customizer: Change Blinky silicone body color
   * @param {string|number|THREE.Color} color
   */
  setBodyColor(color) {
    const col = new THREE.Color(color);
    if (this.materials['Blinky_Body_Mat']) {
      this.materials['Blinky_Body_Mat'].color.copy(col);
    }
    // Also traverse in case materials are cloned
    this.group.traverse((child) => {
      if (child.isMesh && (child.name === 'Blinky_Body' || child.name === 'Blinky_Arms')) {
        if (child.material) child.material.color.copy(col);
      }
    });
  }

  /**
   * Customizer: Change surface roughness
   * @param {number} roughness - [0.0, 1.0]
   */
  setRoughness(roughness) {
    this.group.traverse((child) => {
      if (child.isMesh && child.material && (child.name === 'Blinky_Body' || child.name === 'Blinky_Arms')) {
        child.material.roughness = THREE.MathUtils.clamp(roughness, 0.05, 1.0);
      }
    });
  }

  /**
   * Soft blush opacity on cheeks
   * @param {number} opacity - [0.0, 1.0]
   */
  setBlushOpacity(opacity) {
    this.group.traverse((child) => {
      if (child.isMesh && (child.name === 'Blush_L' || child.name === 'Blush_R')) {
        if (child.material) {
          child.material.opacity = THREE.MathUtils.clamp(opacity, 0.0, 1.0);
        }
      }
    });
  }

  /**
   * Frame update loop
   * @param {number} delta - Delta time in seconds
   */
  update(delta) {
    if (!this.mixer) return;

    // 1. Advance Animation Mixer
    this.mixer.update(delta);

    // 2. Autonomous Blink Timer (when in idle or floating)
    if (this.options.enableAutoBlink && ['idle', 'floating', 'breathing'].includes(this.currentActionName)) {
      this.blinkTimer += delta;
      if (this.blinkTimer >= this.nextBlinkInterval) {
        this.blinkTimer = 0;
        this.nextBlinkInterval = 2.5 + Math.random() * 3.5;
        const blinkAction = this.actions.get('blink');
        if (blinkAction && !blinkAction.isRunning()) {
          blinkAction.reset();
          blinkAction.play();
        }
      }
    }

    // 3. Spring Physics Simulation (squash & stretch response)
    if (this.options.enableSpringPhysics) {
      const f = -this.spring.stiffness * (this.spring.position - this.spring.target);
      const d = -this.spring.damping * this.spring.velocity;
      const a = f + d;

      this.spring.velocity += a * delta;
      this.spring.position += this.spring.velocity * delta;

      // Apply spring position to Spine bone scale
      const spine = this.bones['Spine'];
      if (spine) {
        const squashAmount = THREE.MathUtils.clamp(this.spring.position, -0.4, 0.4);
        spine.scale.y = 1.0 + squashAmount;
        spine.scale.x = 1.0 - squashAmount * 0.5;
        spine.scale.z = 1.0 - squashAmount * 0.5;
      }
    }

    // 4. Look-At IK (Head & eyes follow cursor when awake)
    if (this.options.enableLookAt && this.bones['Head'] && this.currentActionName !== 'sleep') {
      const lerpSpeed = Math.min(1.0, delta * 5.0);
      this.currentLook.lerp(this.lookTarget, lerpSpeed);

      const maxPitch = THREE.MathUtils.degToRad(18); // up/down
      const maxYaw = THREE.MathUtils.degToRad(26);   // left/right

      const targetEuler = new THREE.Euler(
        -this.currentLook.y * maxPitch,
        this.currentLook.x * maxYaw,
        -this.currentLook.x * 0.08,
        'YXZ'
      );
      const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);

      // Blend with animation's head rotation
      this.bones['Head'].quaternion.slerp(targetQuat, 0.45);
    }
  }

  /**
   * Get character summary information
   */
  getInfo() {
    let polyCount = 0;
    let vertCount = 0;
    this.group.traverse((c) => {
      if (c.isMesh && c.geometry) {
        vertCount += c.geometry.attributes.position ? c.geometry.attributes.position.count : 0;
        polyCount += c.geometry.index ? c.geometry.index.count / 3 : vertCount / 3;
      }
    });

    return {
      name: 'Blinky',
      currentAnimation: this.currentActionName,
      availableAnimations: Array.from(this.actions.keys()),
      boneCount: Object.keys(this.bones).length,
      polygonCount: Math.round(polyCount),
      vertexCount: Math.round(vertCount),
      fileSizeKb: 292.1
    };
  }
}
