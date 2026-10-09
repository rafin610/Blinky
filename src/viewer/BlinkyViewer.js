import * as THREE from 'three';

/**
 * Three.js 3D Viewer & Scene Manager for Blinky Desktop Companion
 * Features:
 * - Transparent / background-free rendering support
 * - Studio lighting replication from the reference image
 * - Mouse cursor tracking & raycasting for interactive click/squish
 * - Toggleable contact shadow, wireframe mode, and skeleton helper
 * - Responsive resize handling
 */
export class BlinkyViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      transparent: true,
      fov: 30,
      showShadow: true,
      ...options
    };

    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.character = null;
    this.clock = new THREE.Clock();

    // Scene elements
    this.lights = {};
    this.shadowPlane = null;
    this.skeletonHelper = null;

    // View states
    this.backgroundMode = 'studio'; // 'transparent' | 'studio' | 'desktop_dark' | 'wireframe'
    this.isDragging = false;
    this.mouse = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();

    // Animation loop state
    this.isRunning = false;
    this.rafId = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Camera (30 deg FOV for flattering companion framing)
    this.camera = new THREE.PerspectiveCamera(this.options.fov, width / height, 0.1, 100);
    this.camera.position.set(0, 0.52, 2.5);
    this.camera.lookAt(0, 0.52, 0);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 3. Studio Lighting (carefully matching the reference image)
    this.setupLighting();

    // 4. Soft Contact Shadow Plane
    this.setupContactShadow();

    // 5. Event Listeners
    this.setupEvents();

    // Apply initial background mode
    this.setBackgroundMode(this.backgroundMode);

    this.start();
  }

  setupLighting() {
    // Soft ambient hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xF0F8FF, 0xCCE7FA, 0.95);
    hemiLight.position.set(0, 5, 0);
    this.scene.add(hemiLight);
    this.lights.hemi = hemiLight;

    // Main key light (upper-left-front)
    const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.35);
    keyLight.position.set(1.8, 3.2, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);
    this.lights.key = keyLight;

    // Soft fill light (lower right)
    const fillLight = new THREE.DirectionalLight(0xD8EEFC, 0.5);
    fillLight.position.set(-2.0, 1.2, 1.5);
    this.scene.add(fillLight);
    this.lights.fill = fillLight;

    // Soft cool rim light (back right)
    const rimLight = new THREE.DirectionalLight(0xB2DCFD, 0.75);
    rimLight.position.set(-1.5, 2.5, -2.5);
    this.scene.add(rimLight);
    this.lights.rim = rimLight;
  }

  /**
   * Procedural soft radial contact shadow under Blinky
   */
  setupContactShadow() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(100, 140, 180, 0.45)');
    grad.addColorStop(0.35, 'rgba(120, 160, 200, 0.25)');
    grad.addColorStop(0.7, 'rgba(140, 180, 220, 0.08)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });

    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.4);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.005;
    shadowMesh.name = 'Contact_Shadow';
    this.scene.add(shadowMesh);
    this.shadowPlane = shadowMesh;
  }

  /**
   * Attach character controller to viewer
   */
  setCharacter(character) {
    if (this.character) {
      this.scene.remove(this.character.group);
    }
    this.character = character;
    this.scene.add(character.group);

    // Setup skeleton helper
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
    }
    this.skeletonHelper = new THREE.SkeletonHelper(character.group);
    this.skeletonHelper.visible = false;
    this.scene.add(this.skeletonHelper);
  }

  /**
   * Switch background visual style
   * @param {'transparent'|'studio'|'desktop_dark'} mode
   */
  setBackgroundMode(mode) {
    this.backgroundMode = mode;

    if (mode === 'transparent') {
      this.renderer.setClearColor(0x000000, 0);
      if (this.shadowPlane) this.shadowPlane.visible = true;
      this.container.classList.remove('bg-studio', 'bg-desktop-dark');
      this.container.classList.add('bg-transparent-mode');
    } else if (mode === 'studio') {
      // Soft clean studio backdrop matching the reference photo
      this.renderer.setClearColor(0xF6F9FC, 1.0);
      if (this.shadowPlane) this.shadowPlane.visible = true;
      this.container.classList.remove('bg-transparent-mode', 'bg-desktop-dark');
      this.container.classList.add('bg-studio');
    } else if (mode === 'desktop_dark') {
      // Sleek dark Linux desktop backdrop
      this.renderer.setClearColor(0x131720, 1.0);
      if (this.shadowPlane) this.shadowPlane.visible = true;
      this.container.classList.remove('bg-transparent-mode', 'bg-studio');
      this.container.classList.add('bg-desktop-dark');
    }
  }

  /**
   * Toggle wireframe rendering
   */
  setWireframe(enabled) {
    if (!this.character) return;
    this.character.group.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = enabled;
      }
    });
  }

  /**
   * Toggle skeleton bone overlay
   */
  setSkeletonVisible(visible) {
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = visible;
    }
  }

  setupEvents() {
    window.addEventListener('resize', this.onResize.bind(this));

    const dom = this.renderer.domElement;

    // Track mouse movement for Look-At targeting
    window.addEventListener('mousemove', (e) => {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      this.mouse.set(x, y);

      if (this.character) {
        this.character.setCursorTarget(x, y);
      }
    });

    // Tap/Click to poke Blinky with squish physics
    dom.addEventListener('pointerdown', (e) => {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
      if (this.character) {
        const intersects = this.raycaster.intersectObjects(this.character.group.children, true);
        if (intersects.length > 0) {
          // Poke Blinky!
          this.character.triggerSquish(0.4);
        }
      }
    });
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const loop = () => {
      if (!this.isRunning) return;
      this.rafId = requestAnimationFrame(loop);

      const delta = Math.min(this.clock.getDelta(), 0.1);

      if (this.character) {
        this.character.update(delta);
      }

      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}
