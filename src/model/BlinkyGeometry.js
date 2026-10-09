import * as THREE from 'three';

/**
 * Creates the complete 3D character mesh hierarchy and skeleton for Blinky,
 * closely matching the reference image:
 * - Smooth dome-like top / head
 * - Pear/marshmallow body swelling gently towards the lower torso
 * - Distinctive double-cushion bottom lobes with center cleft
 * - Two cute rounded stubby flipper arms on the sides
 * - Expressive dark charcoal vertical oval eyes and upward curved smile
 * - Clean bone hierarchy and morph targets for all 12 companion animations
 */

export function createBlinkyRig() {
  // 1. Create the Bone Hierarchy
  const bones = [];

  // Bone 0: Root (Ground origin [0, 0, 0])
  const rootBone = new THREE.Bone();
  rootBone.name = 'Root';
  rootBone.position.set(0, 0, 0);
  bones.push(rootBone);

  // Bone 1: Spine / Core Torso
  const spineBone = new THREE.Bone();
  spineBone.name = 'Spine';
  spineBone.position.set(0, 0.35, 0);
  rootBone.add(spineBone);
  bones.push(spineBone);

  // Bone 2: Head (for look-at tracking, head tilts, nodding)
  const headBone = new THREE.Bone();
  headBone.name = 'Head';
  headBone.position.set(0, 0.28, 0); // local to Spine (world y ≈ 0.63)
  spineBone.add(headBone);
  bones.push(headBone);

  // Bone 3: Left Arm (world [0.46, 0.40, 0.02])
  const armLBone = new THREE.Bone();
  armLBone.name = 'Arm_L';
  armLBone.position.set(0.46, 0.05, 0.02); // local to Spine
  spineBone.add(armLBone);
  bones.push(armLBone);

  // Bone 4: Right Arm (world [-0.46, 0.40, 0.02])
  const armRBone = new THREE.Bone();
  armRBone.name = 'Arm_R';
  armRBone.position.set(-0.46, 0.05, 0.02); // local to Spine
  spineBone.add(armRBone);
  bones.push(armRBone);

  // Bone 5: Left Bottom Lobe (cushion bounce / squish)
  const lobeLBone = new THREE.Bone();
  lobeLBone.name = 'Lobe_L';
  lobeLBone.position.set(0.22, 0.06, 0); // local to Root
  rootBone.add(lobeLBone);
  bones.push(lobeLBone);

  // Bone 6: Right Bottom Lobe (cushion bounce / squish)
  const lobeRBone = new THREE.Bone();
  lobeRBone.name = 'Lobe_R';
  lobeRBone.position.set(-0.22, 0.06, 0); // local to Root
  rootBone.add(lobeRBone);
  bones.push(lobeRBone);

  const skeleton = new THREE.Skeleton(bones);

  // 2. Materials
  // Body material: Soft touch silicone / vinyl pastel baby-blue
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C4E5FC'), // Soft powder baby blue matching reference
    roughness: 0.48, // Velvety matte silicone
    metalness: 0.0,
    name: 'Blinky_Body_Mat'
  });

  // Face material: Dark charcoal slate
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#222933'), // Charcoal slate matching reference
    roughness: 0.35,
    metalness: 0.02,
    name: 'Blinky_Face_Mat'
  });

  // Soft rosy blush material
  const blushMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFB3C6'),
    roughness: 0.6,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0, // Fades in during happy / excited reactions
    name: 'Blinky_Blush_Mat'
  });

  // 3. Build Body Geometry
  const bodyGeometry = createParametricBodyGeometry();
  skinGeometryToBones(bodyGeometry);

  const bodyMesh = new THREE.SkinnedMesh(bodyGeometry, bodyMaterial);
  bodyMesh.name = 'Blinky_Body';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.add(rootBone);
  bodyMesh.bind(skeleton);

  // Add arms to the skinned character
  const armsGeometry = createArmsGeometry();
  skinArmsGeometry(armsGeometry);
  const armsMesh = new THREE.SkinnedMesh(armsGeometry, bodyMaterial);
  armsMesh.name = 'Blinky_Arms';
  armsMesh.castShadow = true;
  armsMesh.receiveShadow = true;
  bodyMesh.add(armsMesh);
  armsMesh.bind(skeleton);

  // 4. Build Face Features with Morph Targets
  const faceGroup = createFaceGroup(faceMaterial, blushMaterial);
  headBone.add(faceGroup);

  // 5. Root Character Group
  const characterGroup = new THREE.Group();
  characterGroup.name = 'Blinky_Character';
  characterGroup.add(bodyMesh);

  return {
    group: characterGroup,
    skeleton,
    bones: {
      root: rootBone,
      spine: spineBone,
      head: headBone,
      armL: armLBone,
      armR: armRBone,
      lobeL: lobeLBone,
      lobeR: lobeRBone
    },
    meshes: {
      body: bodyMesh,
      arms: armsMesh,
      face: faceGroup
    },
    materials: {
      body: bodyMaterial,
      face: faceMaterial,
      blush: blushMaterial
    }
  };
}

/**
 * Procedural body mesh closely matching the reference:
 * - Upper dome: smooth hemisphere
 * - Mid section: gentle pear flare towards belly
 * - Bottom: double-lobe contour with center cleft indentation
 */
function createParametricBodyGeometry() {
  const widthSegments = 48;
  const heightSegments = 36;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments; // 0 at top pole, 1 at bottom pole
    const polarAngle = v * Math.PI; // 0 to PI
    const cosPolar = Math.cos(polarAngle);
    const sinPolar = Math.sin(polarAngle);

    for (let i = 0; i <= widthSegments; i++) {
      const u = i / widthSegments;
      const azimuth = u * Math.PI * 2;
      const sinAzimuth = Math.sin(azimuth);
      const cosAzimuth = Math.cos(azimuth);

      let x, y, z;

      if (v <= 0.5) {
        // Upper dome (v from 0 to 0.5)
        // Smooth spherical crown slightly flattened front-to-back
        const domeHeight = 0.45;
        const baseY = 0.55;
        y = baseY + domeHeight * cosPolar;

        // Radius flares out gently as we move down
        const flare = 1.0 + 0.14 * (1.0 - cosPolar);
        const radius = 0.45 * sinPolar * flare;
        x = radius * sinAzimuth;
        z = radius * cosAzimuth * 0.93; // slightly flatter front-to-back
      } else {
        // Lower body and bottom lobes (v from 0.5 to 1.0)
        const t = (v - 0.5) / 0.5; // 0 at waist, 1 at bottom pole
        const baseY = 0.55;
        const botHeight = 0.55;
        
        let curY = baseY - botHeight * t;
        const baseRadius = 0.515 * Math.sqrt(Math.max(0, 1.0 - Math.pow(t, 2.0)));
        
        x = baseRadius * sinAzimuth;
        z = baseRadius * cosAzimuth * 0.93;

        // Bottom double-lobe cleft modulation
        if (t > 0.4) {
          const cleftT = Math.pow((t - 0.4) / 0.6, 1.6);
          
          // Center cleft indentation (lifts center bottom upward)
          const centerCleft = 0.075 * Math.exp(-Math.pow(x / 0.17, 2.0)) * Math.exp(-Math.pow(z / 0.28, 2.0)) * cleftT;
          
          // Lobe dip (left and right lobes touch the ground at y = 0)
          const lobeDip = -0.042 * Math.exp(-Math.pow((Math.abs(x) - 0.21) / 0.14, 2.0)) * Math.exp(-Math.pow(z / 0.32, 2.0)) * cleftT;
          
          curY += centerCleft + lobeDip;
        }

        y = curY;
      }

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  // Generate quad-strip indices
  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < widthSegments; i++) {
      const a = j * (widthSegments + 1) + i;
      const b = (j + 1) * (widthSegments + 1) + i;
      const c = (j + 1) * (widthSegments + 1) + (i + 1);
      const d = j * (widthSegments + 1) + (i + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Add squash & stretch morph targets
  addSquashStretchMorphs(geometry);

  return geometry;
}

/**
 * Adds vertex morph targets for squash and stretch squash physics
 */
function addSquashStretchMorphs(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  const squashPositions = new Float32Array(count * 3);
  const stretchPositions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Squash: compress vertically by 25%, expand horizontally by 18%
    squashPositions[i * 3 + 0] = x * 1.18;
    squashPositions[i * 3 + 1] = y * 0.75;
    squashPositions[i * 3 + 2] = z * 1.18;

    // Stretch: extend vertically by 22%, contract horizontally by 12%
    stretchPositions[i * 3 + 0] = x * 0.88;
    stretchPositions[i * 3 + 1] = y * 1.22;
    stretchPositions[i * 3 + 2] = z * 0.88;
  }

  geometry.morphAttributes.position = [
    new THREE.BufferAttribute(squashPositions, 3),
    new THREE.BufferAttribute(stretchPositions, 3)
  ];
  geometry.morphAttributes.position[0].name = 'squash';
  geometry.morphAttributes.position[1].name = 'stretch';
}

/**
 * Weights body vertices smoothly to Root, Spine, Head, and Bottom Lobes
 */
function skinGeometryToBones(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  const skinIndices = [];
  const skinWeights = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    // Bones mapping:
    // 0: Root (y = 0)
    // 1: Spine (y = 0.35)
    // 2: Head (y = 0.63)
    // 5: Lobe_L (x = +0.22, y = 0.06)
    // 6: Lobe_R (x = -0.22, y = 0.06)

    let wRoot = 0;
    let wSpine = 0;
    let wHead = 0;
    let wLobe = 0;
    let lobeIndex = x >= 0 ? 5 : 6;

    if (y > 0.60) {
      // Upper head / crown
      const t = Math.min(1.0, (y - 0.60) / 0.35);
      wHead = 0.6 + 0.4 * t;
      wSpine = 1.0 - wHead;
      skinIndices.push(2, 1, 0, 0);
      skinWeights.push(wHead, wSpine, 0, 0);
    } else if (y > 0.28) {
      // Mid torso / spine region
      const t = (y - 0.28) / (0.60 - 0.28);
      wHead = 0.5 * t;
      wSpine = 0.7 - 0.2 * t;
      wRoot = 1.0 - (wHead + wSpine);
      skinIndices.push(1, 2, 0, 0);
      skinWeights.push(wSpine, wHead, wRoot, 0);
    } else {
      // Bottom base & lobes
      const t = y / 0.28;
      const distToLobe = Math.abs(Math.abs(x) - 0.22);
      const lobeFactor = Math.exp(-Math.pow(distToLobe / 0.16, 2.0)) * (1.0 - t);

      wLobe = 0.55 * lobeFactor;
      wRoot = 0.7 * (1.0 - t) * (1.0 - wLobe * 0.5);
      wSpine = Math.max(0, 1.0 - (wLobe + wRoot));

      // Normalize
      const sum = wLobe + wRoot + wSpine || 1;
      skinIndices.push(lobeIndex, 0, 1, 0);
      skinWeights.push(wLobe / sum, wRoot / sum, wSpine / sum, 0);
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

/**
 * Creates the two cute rounded stubby flipper arms matching the reference
 */
function createArmsGeometry() {
  const armGeomL = createSingleArmGeometry(+1); // Left arm
  const armGeomR = createSingleArmGeometry(-1); // Right arm

  // Merge geometries
  return mergeArmGeometries([armGeomL, armGeomR]);
}

/**
 * Creates a single tapered rounded stub arm
 * side: +1 for Left, -1 for Right
 */
function createSingleArmGeometry(side) {
  // A tapered capsule-like stub arm
  const radialSegments = 24;
  const lengthSegments = 16;
  const length = 0.23;
  const baseRadius = 0.088;
  const tipRadius = 0.058;

  const positions = [];
  const uvs = [];
  const indices = [];

  // Arm pivot location in world space
  const pivotX = side * 0.46;
  const pivotY = 0.40;
  const pivotZ = 0.02;

  // Arm rest angle: angled downwards ~32 deg and slightly outwards
  const angleZ = side * (-0.56); // outward tilt
  const angleY = side * 0.15;   // slight forward angle
  const angleX = 0.10;

  for (let j = 0; j <= lengthSegments; j++) {
    const v = j / lengthSegments; // 0 at base, 1 at tip
    const curRadius = baseRadius + (tipRadius - baseRadius) * v;
    const curLen = length * v;

    for (let i = 0; i <= radialSegments; i++) {
      const u = i / radialSegments;
      const theta = u * Math.PI * 2;

      // Local arm coordinate along its axis (extending along local X)
      let localX = curLen * side;
      let localY = curRadius * Math.sin(theta);
      let localZ = curRadius * Math.cos(theta);

      // Tip rounded cap
      if (v > 0.8) {
        const capT = (v - 0.8) / 0.2;
        localX += side * tipRadius * Math.sin(capT * Math.PI * 0.5) * 0.4;
      }

      // Rotate local coordinates to rest angle
      // 1. Roll around Z
      let rx = localX * Math.cos(angleZ) - localY * Math.sin(angleZ);
      let ry = localX * Math.sin(angleZ) + localY * Math.cos(angleZ);
      let rz = localZ;

      // 2. Yaw around Y
      let rx2 = rx * Math.cos(angleY) + rz * Math.sin(angleY);
      let ry2 = ry;
      let rz2 = -rx * Math.sin(angleY) + rz * Math.cos(angleY);

      // World position
      positions.push(pivotX + rx2, pivotY + ry2, pivotZ + rz2);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < lengthSegments; j++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = j * (radialSegments + 1) + i;
      const b = (j + 1) * (radialSegments + 1) + i;
      const c = (j + 1) * (radialSegments + 1) + (i + 1);
      const d = j * (radialSegments + 1) + (i + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return { geom, side };
}

function mergeArmGeometries(arms) {
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  const sides = [];

  let indexOffset = 0;

  for (const { geom, side } of arms) {
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    const norm = geom.attributes.normal;
    const idx = geom.index;

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      sides.push(side);
    }

    for (let i = 0; i < idx.count; i++) {
      indices.push(idx.getX(i) + indexOffset);
    }

    indexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  merged.userData.sides = sides;
  return merged;
}

/**
 * Weights arm vertices to Arm_L (bone 3) and Arm_R (bone 4), blending into Spine (bone 1)
 */
function skinArmsGeometry(geometry) {
  const pos = geometry.attributes.position;
  const sides = geometry.userData.sides || [];
  const count = pos.count;

  const skinIndices = [];
  const skinWeights = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const side = sides[i] || (x >= 0 ? 1 : -1);
    const armBoneIndex = side === 1 ? 3 : 4; // 3: Arm_L, 4: Arm_R

    // Distance from body surface (shoulder attachment)
    const distFromCenter = Math.abs(x) - 0.44;
    const blendFactor = Math.max(0, Math.min(1.0, distFromCenter / 0.08));

    const wArm = 0.4 + 0.6 * blendFactor;
    const wSpine = 1.0 - wArm;

    skinIndices.push(armBoneIndex, 1, 0, 0);
    skinWeights.push(wArm, wSpine, 0, 0);
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

/**
 * Creates the facial features matching the reference:
 * - Expressive dark charcoal vertical oval eyes
 * - Curved upward smile arc
 * - Soft rosy blush cheeks
 * - Morph targets for blinking, smiling, sad, and surprised expressions
 */
function createFaceGroup(faceMaterial, blushMaterial) {
  const group = new THREE.Group();
  group.name = 'Blinky_Face_Group';
  // Head bone is at world y ≈ 0.63. We offset local positions accordingly.
  const headOffsetY = 0.63;

  // 1. Left Eye (World [0.17, 0.54, 0.468])
  const eyeL = createEyeMesh(+1, faceMaterial);
  eyeL.position.set(0.17, 0.54 - headOffsetY, 0.468);
  eyeL.name = 'Eye_L';
  group.add(eyeL);

  // 2. Right Eye (World [-0.17, 0.54, 0.468])
  const eyeR = createEyeMesh(-1, faceMaterial);
  eyeR.position.set(-0.17, 0.54 - headOffsetY, 0.468);
  eyeR.name = 'Eye_R';
  group.add(eyeR);

  // 3. Mouth Smile Arc (World [0, 0.478, 0.495])
  const mouth = createMouthMesh(faceMaterial);
  mouth.position.set(0, 0.478 - headOffsetY, 0.495);
  mouth.name = 'Mouth';
  group.add(mouth);

  // 4. Soft Blush Spots (World [±0.26, 0.46, 0.43])
  const blushL = createBlushMesh(+1, blushMaterial);
  blushL.position.set(0.26, 0.46 - headOffsetY, 0.43);
  blushL.name = 'Blush_L';
  group.add(blushL);

  const blushR = createBlushMesh(-1, blushMaterial);
  blushR.position.set(-0.26, 0.46 - headOffsetY, 0.43);
  blushR.name = 'Blush_R';
  group.add(blushR);

  return group;
}

/**
 * Creates an expressive dark vertical oval eye with morph targets:
 * - blink: squashes into a flat closed slit
 * - happy: curves into an inverted crescent `^`
 * - squint: half-closed sleepy/thinking slit
 */
function createEyeMesh(side, material) {
  const radiusX = 0.042;
  const radiusY = 0.058;
  const depth = 0.024;
  const segments = 24;

  const positions = [];
  const uvs = [];
  const indices = [];

  // Create smooth front-curved oval cap
  positions.push(0, 0, depth * 0.5); // Center front vertex
  uvs.push(0.5, 0.5);

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = Math.cos(theta) * radiusX;
    const y = Math.sin(theta) * radiusY;
    const z = 0;
    positions.push(x, y, z);
    uvs.push(0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta));
  }

  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Morph Target: Blink (flat closed eye)
  const blinkPositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    blinkPositions[i * 3 + 0] = positions[i * 3 + 0] * 1.15;
    blinkPositions[i * 3 + 1] = positions[i * 3 + 1] * 0.06; // Flat horizontal line
    blinkPositions[i * 3 + 2] = positions[i * 3 + 2] * 0.2;
  }

  // Morph Target: Happy Eyes (curved smiling crescent `^`)
  const happyPositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    // Curve upwards like `^`
    const arch = 0.035 * (1.0 - Math.pow(x / radiusX, 2.0));
    happyPositions[i * 3 + 0] = x * 1.1;
    happyPositions[i * 3 + 1] = (y * 0.18) + arch;
    happyPositions[i * 3 + 2] = positions[i * 3 + 2];
  }

  // Morph Target: Sad / Droopy Eyes
  const sadPositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    // Droop down towards the outside
    const droop = side * x * 0.2;
    sadPositions[i * 3 + 0] = x;
    sadPositions[i * 3 + 1] = (y * 0.7) - 0.015 + droop;
    sadPositions[i * 3 + 2] = positions[i * 3 + 2];
  }

  geometry.morphAttributes.position = [
    new THREE.BufferAttribute(blinkPositions, 3),
    new THREE.BufferAttribute(happyPositions, 3),
    new THREE.BufferAttribute(sadPositions, 3)
  ];
  geometry.morphAttributes.position[0].name = 'blink';
  geometry.morphAttributes.position[1].name = 'happy';
  geometry.morphAttributes.position[2].name = 'sad';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.y = side * 0.22; // Align to face curvature
  mesh.rotation.x = -0.06;
  mesh.castShadow = true;
  return mesh;
}

/**
 * Creates the curved upward smile arc with morph targets:
 * - smile_wide: enthusiastic wide open smile
 * - mouth_sad: downward curved frown `:(`
 * - mouth_o: surprised / curious round `o`
 */
function createMouthMesh(material) {
  const arcSegments = 24;
  const tubeSegments = 8;
  const arcWidth = 0.138;
  const arcDip = 0.038;
  const tubeRadius = 0.012;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= arcSegments; i++) {
    const t = i / arcSegments; // 0 to 1
    const x = (t - 0.5) * arcWidth;
    // Parabolic upward curve: dips in center, rises at tips
    const y = -arcDip * (1.0 - Math.pow(x / (arcWidth * 0.5), 2.0));
    // Conforms slightly to the curved dome in Z
    const z = -0.012 * Math.pow(x / (arcWidth * 0.5), 2.0);

    for (let j = 0; j <= tubeSegments; j++) {
      const phi = (j / tubeSegments) * Math.PI * 2;
      const px = x + tubeRadius * Math.cos(phi) * 0.4;
      const py = y + tubeRadius * Math.sin(phi);
      const pz = z + tubeRadius * Math.cos(phi);

      positions.push(px, py, pz);
      uvs.push(t, j / tubeSegments);
    }
  }

  for (let i = 0; i < arcSegments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const a = i * (tubeSegments + 1) + j;
      const b = (i + 1) * (tubeSegments + 1) + j;
      const c = (i + 1) * (tubeSegments + 1) + (j + 1);
      const d = i * (tubeSegments + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Morph Target: Wide Smile / Open Happy `:D`
  const wideSmilePositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    wideSmilePositions[i * 3 + 0] = x * 1.25;
    wideSmilePositions[i * 3 + 1] = y * 1.4 + 0.01;
    wideSmilePositions[i * 3 + 2] = positions[i * 3 + 2];
  }

  // Morph Target: Sad Frown `:(`
  const sadPositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    // Invert the curve
    sadPositions[i * 3 + 0] = x * 0.9;
    sadPositions[i * 3 + 1] = -y * 0.8 - 0.02;
    sadPositions[i * 3 + 2] = positions[i * 3 + 2];
  }

  // Morph Target: Surprised / Curious round `o`
  const mouthOPositions = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    const angle = Math.atan2(y, x);
    const radius = 0.032;
    mouthOPositions[i * 3 + 0] = Math.cos(angle) * radius;
    mouthOPositions[i * 3 + 1] = Math.sin(angle) * radius - 0.01;
    mouthOPositions[i * 3 + 2] = positions[i * 3 + 2];
  }

  geometry.morphAttributes.position = [
    new THREE.BufferAttribute(wideSmilePositions, 3),
    new THREE.BufferAttribute(sadPositions, 3),
    new THREE.BufferAttribute(mouthOPositions, 3)
  ];
  geometry.morphAttributes.position[0].name = 'smile_wide';
  geometry.morphAttributes.position[1].name = 'mouth_sad';
  geometry.morphAttributes.position[2].name = 'mouth_o';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.06;
  mesh.castShadow = true;
  return mesh;
}

/**
 * Creates soft peach blush cheek spots
 */
function createBlushMesh(side, material) {
  const geometry = new THREE.CircleGeometry(0.045, 16);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.y = side * 0.42;
  mesh.rotation.x = -0.05;
  return mesh;
}
