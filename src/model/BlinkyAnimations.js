import * as THREE from 'three';

/**
 * Generates all 12 complete glTF AnimationClips for Blinky:
 * 1. Idle (gentle organic floating, subtle breathing, micro arm sways, natural blink)
 * 2. Blink (snappy realistic eyelid blink)
 * 3. Breathing (calming rhythmic chest expansion and vertical float)
 * 4. Small floating movement (zero-gravity drift with tilt and trailing arms)
 * 5. Happy reaction (joyful squash-and-hop, flap arms up, happy smile and eyes)
 * 6. Notification reaction (curious double-perk pulse, head tilt, alert arms, surprised mouth)
 * 7. Click reaction (elastic spring squash on tap, pop up with wobble settling)
 * 8. Thinking (head tilted thoughtfully looking up, right arm raised to chin, slow sway)
 * 9. Sleep (snuggled down into bottom lobes, eyes shut, deep slow breathing)
 * 10. Error/sad reaction (drooped posture, hanging head, sad frown and droopy eyes, shiver)
 * 11. Wave (friendly greeting, body lean, right arm waving enthusiastically 3 times)
 * 12. Excited movement (rapid joyful bouncing, side-to-side twist wiggle, fluttery arms)
 */

export function createBlinkyAnimations() {
  return [
    createIdleAnimation(),
    createBlinkAnimation(),
    createBreathingAnimation(),
    createFloatingAnimation(),
    createHappyAnimation(),
    createNotificationAnimation(),
    createClickAnimation(),
    createThinkingAnimation(),
    createSleepAnimation(),
    createErrorSadAnimation(),
    createWaveAnimation(),
    createExcitedAnimation()
  ];
}

// Helper to convert Euler degrees to quaternion [x, y, z, w]
function qDeg(xDeg, yDeg, zDeg) {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(xDeg),
    THREE.MathUtils.degToRad(yDeg),
    THREE.MathUtils.degToRad(zDeg)
  );
  const q = new THREE.Quaternion().setFromEuler(euler);
  return [q.x, q.y, q.z, q.w];
}

// 1. Idle Animation (3.2s, Looped)
function createIdleAnimation() {
  const duration = 3.2;

  // Root Position (gentle micro-float)
  const rootTimes = [0, 0.8, 1.6, 2.4, 3.2];
  const rootPos = [
    0, 0, 0,
    0, 0.02, 0,
    0, 0.035, 0,
    0, 0.015, 0,
    0, 0, 0
  ];

  // Spine Rotation (subtle breathing sway)
  const spineTimes = [0, 1.6, 3.2];
  const spineQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(1.5, 0, 1.0),
    ...qDeg(0, 0, 0)
  ];

  // Head Rotation (gentle cute micro-tilt)
  const headTimes = [0, 1.0, 2.2, 3.2];
  const headQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-1.5, 0, -2.0),
    ...qDeg(1.0, 0, 2.0),
    ...qDeg(0, 0, 0)
  ];

  // Arms Rotation (rest sway)
  const armTimes = [0, 1.6, 3.2];
  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(2, 0, 3),
    ...qDeg(0, 0, 0)
  ];
  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(2, 0, -3),
    ...qDeg(0, 0, 0)
  ];

  // Natural blink during idle (at t = 1.6s)
  const blinkTimes = [0, 1.48, 1.56, 1.64, 1.74, 3.2];
  const blinkVals = [0, 0, 1.0, 1.0, 0, 0];

  return new THREE.AnimationClip('idle', duration, [
    new THREE.VectorKeyframeTrack('Root.position', rootTimes, rootPos),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', spineTimes, spineQuat),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', headTimes, headQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', armTimes, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', armTimes, armRQuat),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[blink]', blinkTimes, blinkVals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[blink]', blinkTimes, blinkVals)
  ]);
}

// 2. Blink Animation (0.28s, One-shot)
function createBlinkAnimation() {
  const duration = 0.28;
  const times = [0, 0.08, 0.16, 0.28];
  const vals = [0, 1.0, 1.0, 0];

  const headTimes = [0, 0.12, 0.28];
  const headQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(2.0, 0, 0),
    ...qDeg(0, 0, 0)
  ];

  return new THREE.AnimationClip('blink', duration, [
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[blink]', times, vals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[blink]', times, vals),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', headTimes, headQuat)
  ]);
}

// 3. Breathing Animation (4.0s, Looped)
function createBreathingAnimation() {
  const duration = 4.0;

  // Inhale: body rises, spine expands, arms open slightly
  const times = [0, 1.8, 2.2, 4.0];
  const rootPos = [
    0, 0, 0,
    0, 0.04, 0,
    0, 0.04, 0,
    0, 0, 0
  ];

  const spineQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(3.0, 0, 0),
    ...qDeg(3.0, 0, 0),
    ...qDeg(0, 0, 0)
  ];

  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, -4.5),
    ...qDeg(0, 0, -4.5),
    ...qDeg(0, 0, 0)
  ];

  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, 4.5),
    ...qDeg(0, 0, 4.5),
    ...qDeg(0, 0, 0)
  ];

  // Body stretch morph during inhale
  const stretchTimes = [0, 1.8, 2.2, 4.0];
  const stretchVals = [0, 0.18, 0.18, 0];

  return new THREE.AnimationClip('breathing', duration, [
    new THREE.VectorKeyframeTrack('Root.position', times, rootPos),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', times, spineQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', times, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', times, armRQuat),
    new THREE.NumberKeyframeTrack('Blinky_Body.morphTargetInfluences[stretch]', stretchTimes, stretchVals)
  ]);
}

// 4. Floating Movement (3.0s, Looped)
function createFloatingAnimation() {
  const duration = 3.0;

  const times = [0, 0.75, 1.5, 2.25, 3.0];
  const rootPos = [
    0, 0.05, 0,
    0.02, 0.14, 0.02,
    0, 0.08, -0.01,
    -0.02, 0.15, 0.02,
    0, 0.05, 0
  ];

  const rootQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-3, 2, 4),
    ...qDeg(2, -1, 0),
    ...qDeg(-2, -2, -4),
    ...qDeg(0, 0, 0)
  ];

  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(5, 0, 8),
    ...qDeg(-3, 0, -5),
    ...qDeg(6, 0, 10),
    ...qDeg(0, 0, 0)
  ];

  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(5, 0, -8),
    ...qDeg(-3, 0, 5),
    ...qDeg(6, 0, -10),
    ...qDeg(0, 0, 0)
  ];

  return new THREE.AnimationClip('floating', duration, [
    new THREE.VectorKeyframeTrack('Root.position', times, rootPos),
    new THREE.QuaternionKeyframeTrack('Root.quaternion', times, rootQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', times, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', times, armRQuat)
  ]);
}

// 5. Happy Reaction (1.4s, One-shot)
function createHappyAnimation() {
  const duration = 1.4;

  // Key milestones: Anticipate squash -> Hop up -> Arm flap -> Cushion land
  const times = [0, 0.18, 0.45, 0.75, 1.05, 1.4];
  const rootPos = [
    0, 0, 0,
    0, -0.06, 0,      // squash down
    0, 0.28, 0,       // hop high
    0, -0.04, 0,      // land cushion
    0, 0.02, 0,       // small secondary bounce
    0, 0, 0
  ];

  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-5, 0, -12),
    ...qDeg(15, 0, 48),  // flaps up joyfully
    ...qDeg(-5, 0, 15),
    ...qDeg(5, 0, 5),
    ...qDeg(0, 0, 0)
  ];

  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-5, 0, 12),
    ...qDeg(15, 0, -48), // flaps up joyfully
    ...qDeg(-5, 0, -15),
    ...qDeg(5, 0, -5),
    ...qDeg(0, 0, 0)
  ];

  // Facial morphs: happy eyes `^ ^`, wide open smile
  const faceTimes = [0, 0.25, 0.85, 1.4];
  const happyEyeVals = [0, 1.0, 1.0, 0];
  const wideSmileVals = [0, 1.0, 1.0, 0];

  // Body squash morph
  const squashTimes = [0, 0.18, 0.45, 0.75, 1.0, 1.4];
  const squashVals = [0, 0.55, 0, 0.35, 0.05, 0];

  return new THREE.AnimationClip('happy', duration, [
    new THREE.VectorKeyframeTrack('Root.position', times, rootPos),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', times, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', times, armRQuat),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[happy]', faceTimes, happyEyeVals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[happy]', faceTimes, happyEyeVals),
    new THREE.NumberKeyframeTrack('Mouth.morphTargetInfluences[smile_wide]', faceTimes, wideSmileVals),
    new THREE.NumberKeyframeTrack('Blinky_Body.morphTargetInfluences[squash]', squashTimes, squashVals)
  ]);
}

// 6. Notification Reaction (1.2s, One-shot)
function createNotificationAnimation() {
  const duration = 1.2;

  // Double perk pulse
  const times = [0, 0.15, 0.32, 0.5, 0.85, 1.2];
  const rootPos = [
    0, 0, 0,
    0, 0.12, 0,
    0, 0.05, 0,
    0, 0.10, 0,
    0, 0.03, 0,
    0, 0, 0
  ];

  // Head tilts with curiosity
  const headTimes = [0, 0.2, 0.7, 1.2];
  const headQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(10, 5, 12), // forward curious tilt
    ...qDeg(8, 4, 10),
    ...qDeg(0, 0, 0)
  ];

  // Arms raise alertly
  const armTimes = [0, 0.25, 0.75, 1.2];
  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(10, 0, 28),
    ...qDeg(8, 0, 22),
    ...qDeg(0, 0, 0)
  ];
  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(10, 0, -28),
    ...qDeg(8, 0, -22),
    ...qDeg(0, 0, 0)
  ];

  // Mouth surprised `o`
  const faceTimes = [0, 0.18, 0.75, 1.2];
  const mouthOVals = [0, 1.0, 0.8, 0];

  return new THREE.AnimationClip('notification', duration, [
    new THREE.VectorKeyframeTrack('Root.position', times, rootPos),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', headTimes, headQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', armTimes, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', armTimes, armRQuat),
    new THREE.NumberKeyframeTrack('Mouth.morphTargetInfluences[mouth_o]', faceTimes, mouthOVals)
  ]);
}

// 7. Click Reaction (0.8s, One-shot)
function createClickAnimation() {
  const duration = 0.8;

  // Snappy squash on poke, elastic rebound
  const times = [0, 0.08, 0.22, 0.42, 0.62, 0.8];
  const rootPos = [
    0, 0, 0,
    0, -0.08, 0,   // squash down immediately
    0, 0.10, 0,    // pop up
    0, -0.02, 0,   // wobble
    0, 0.01, 0,
    0, 0, 0
  ];

  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, 35),  // flare out on squash
    ...qDeg(0, 0, -10),
    ...qDeg(0, 0, 8),
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, 0)
  ];

  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, -35),
    ...qDeg(0, 0, 10),
    ...qDeg(0, 0, -8),
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, 0)
  ];

  // Body squash morph track
  const squashVals = [0, 0.85, 0, 0.22, 0.05, 0];

  // Quick wink/happy blink
  const blinkTimes = [0, 0.1, 0.35, 0.8];
  const blinkVals = [0, 1.0, 0.4, 0];

  return new THREE.AnimationClip('click', duration, [
    new THREE.VectorKeyframeTrack('Root.position', times, rootPos),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', times, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', times, armRQuat),
    new THREE.NumberKeyframeTrack('Blinky_Body.morphTargetInfluences[squash]', times, squashVals),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[happy]', blinkTimes, blinkVals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[blink]', blinkTimes, blinkVals)
  ]);
}

// 8. Thinking Animation (3.5s, Looped)
function createThinkingAnimation() {
  const duration = 3.5;

  // Head tilted to the side, looking up/away
  const headTimes = [0, 1.75, 3.5];
  const headQuat = [
    ...qDeg(-6, -8, 16),
    ...qDeg(-10, -12, 20),
    ...qDeg(-6, -8, 16)
  ];

  // Right arm raised towards chin
  const armTimes = [0, 1.75, 3.5];
  const armRQuat = [
    ...qDeg(25, -15, -45),
    ...qDeg(30, -18, -48),
    ...qDeg(25, -15, -45)
  ];

  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-2, 0, -5),
    ...qDeg(0, 0, 0)
  ];

  // Slow rhythmic floating sway
  const rootTimes = [0, 1.75, 3.5];
  const rootPos = [
    0, 0.04, 0,
    0, 0.08, 0,
    0, 0.04, 0
  ];

  // Thoughtful mouth shape
  const mouthTimes = [0, 1.75, 3.5];
  const mouthOVals = [0.45, 0.6, 0.45];

  return new THREE.AnimationClip('thinking', duration, [
    new THREE.VectorKeyframeTrack('Root.position', rootTimes, rootPos),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', headTimes, headQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', armTimes, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', armTimes, armRQuat),
    new THREE.NumberKeyframeTrack('Mouth.morphTargetInfluences[mouth_o]', mouthTimes, mouthOVals)
  ]);
}

// 9. Sleep Animation (4.0s, Looped)
function createSleepAnimation() {
  const duration = 4.0;

  // Sunk down into resting cushion
  const rootTimes = [0, 2.0, 4.0];
  const rootPos = [
    0, -0.04, 0,
    0, -0.02, 0, // deep breathe rise
    0, -0.04, 0
  ];

  // Head droops comfortably forward
  const headTimes = [0, 2.0, 4.0];
  const headQuat = [
    ...qDeg(14, 0, 4),
    ...qDeg(11, 0, 3),
    ...qDeg(14, 0, 4)
  ];

  // Eyes stay completely shut
  const eyeTimes = [0, 4.0];
  const eyeBlink = [1.0, 1.0];

  // Arms completely relaxed
  const armLQuat = [
    ...qDeg(0, 0, -10),
    ...qDeg(0, 0, -6),
    ...qDeg(0, 0, -10)
  ];
  const armRQuat = [
    ...qDeg(0, 0, 10),
    ...qDeg(0, 0, 6),
    ...qDeg(0, 0, 10)
  ];

  // Subtle breathing squash
  const squashTimes = [0, 2.0, 4.0];
  const squashVals = [0.28, 0.12, 0.28];

  return new THREE.AnimationClip('sleep', duration, [
    new THREE.VectorKeyframeTrack('Root.position', rootTimes, rootPos),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', headTimes, headQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', headTimes, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', headTimes, armRQuat),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[blink]', eyeTimes, eyeBlink),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[blink]', eyeTimes, eyeBlink),
    new THREE.NumberKeyframeTrack('Blinky_Body.morphTargetInfluences[squash]', squashTimes, squashVals)
  ]);
}

// 10. Error / Sad Reaction (2.5s, Looped / One-shot)
function createErrorSadAnimation() {
  const duration = 2.5;

  // Drooped posture
  const rootTimes = [0, 0.6, 1.2, 1.8, 2.5];
  const rootPos = [
    0, 0, 0,
    0, -0.04, 0,
    0, -0.04, 0,
    0, -0.03, 0,
    0, 0, 0
  ];

  // Head hangs low
  const headTimes = [0, 0.5, 1.2, 2.0, 2.5];
  const headQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(16, 0, -3),
    ...qDeg(18, 0, -4),
    ...qDeg(16, 0, -3),
    ...qDeg(0, 0, 0)
  ];

  // Arms hang limp
  const armTimes = [0, 0.6, 2.0, 2.5];
  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-6, 0, -18),
    ...qDeg(-6, 0, -18),
    ...qDeg(0, 0, 0)
  ];
  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-6, 0, 18),
    ...qDeg(-6, 0, 18),
    ...qDeg(0, 0, 0)
  ];

  // Face: sad mouth, droopy eyes
  const faceTimes = [0, 0.4, 2.0, 2.5];
  const sadVals = [0, 1.0, 1.0, 0];

  // Sad shiver tremor at t = 1.0 - 1.4s
  const tremorTimes = [0, 0.95, 1.02, 1.08, 1.15, 1.22, 1.3, 2.5];
  const spineQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(2, 0, 0),
    ...qDeg(2, 2, 1),
    ...qDeg(2, -2, -1),
    ...qDeg(2, 2, 1),
    ...qDeg(2, -1, 0),
    ...qDeg(2, 0, 0),
    ...qDeg(0, 0, 0)
  ];

  return new THREE.AnimationClip('error_sad', duration, [
    new THREE.VectorKeyframeTrack('Root.position', rootTimes, rootPos),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', tremorTimes, spineQuat),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', headTimes, headQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', armTimes, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', armTimes, armRQuat),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[sad]', faceTimes, sadVals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[sad]', faceTimes, sadVals),
    new THREE.NumberKeyframeTrack('Mouth.morphTargetInfluences[mouth_sad]', faceTimes, sadVals)
  ]);
}

// 11. Wave Animation (2.0s, One-shot)
function createWaveAnimation() {
  const duration = 2.0;

  // Body leans slightly left, right arm waves 3 times
  const times = [0, 0.35, 0.65, 0.95, 1.25, 1.55, 2.0];

  const spineQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, 6),
    ...qDeg(0, 0, 7),
    ...qDeg(0, 0, 7),
    ...qDeg(0, 0, 7),
    ...qDeg(0, 0, 4),
    ...qDeg(0, 0, 0)
  ];

  const headQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(-4, 0, -8),
    ...qDeg(-4, 0, -8),
    ...qDeg(-4, 0, -8),
    ...qDeg(-4, 0, -8),
    ...qDeg(-2, 0, -4),
    ...qDeg(0, 0, 0)
  ];

  // Right arm waving cycle
  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(15, -10, -55), // raise arm up
    ...qDeg(15, -10, -78), // wave out
    ...qDeg(15, -10, -48), // wave in
    ...qDeg(15, -10, -78), // wave out
    ...qDeg(15, -10, -50), // wave in
    ...qDeg(0, 0, 0)
  ];

  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 0, 10),
    ...qDeg(0, 0, 10),
    ...qDeg(0, 0, 10),
    ...qDeg(0, 0, 10),
    ...qDeg(0, 0, 4),
    ...qDeg(0, 0, 0)
  ];

  // Happy eyes & smile while waving
  const faceTimes = [0, 0.3, 1.6, 2.0];
  const faceVals = [0, 1.0, 1.0, 0];

  return new THREE.AnimationClip('wave', duration, [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', times, spineQuat),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', times, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', times, armRQuat),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[happy]', faceTimes, faceVals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[happy]', faceTimes, faceVals),
    new THREE.NumberKeyframeTrack('Mouth.morphTargetInfluences[smile_wide]', faceTimes, faceVals)
  ]);
}

// 12. Excited Movement (1.2s, Looped)
function createExcitedAnimation() {
  const duration = 1.2;

  // Rapid bouncy hops & body twists
  const times = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2];

  const rootPos = [
    0, 0, 0,
    0, 0.16, 0,
    0, 0, 0,
    0, 0.16, 0,
    0, 0, 0,
    0, 0.16, 0,
    0, 0, 0,
    0, 0.16, 0,
    0, 0, 0
  ];

  // Alternating side-to-side twist
  const spineQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(0, 12, 5),
    ...qDeg(0, 0, 0),
    ...qDeg(0, -12, -5),
    ...qDeg(0, 0, 0),
    ...qDeg(0, 12, 5),
    ...qDeg(0, 0, 0),
    ...qDeg(0, -12, -5),
    ...qDeg(0, 0, 0)
  ];

  // Fluttery arm flapping
  const armLQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(10, 0, 38),
    ...qDeg(0, 0, 5),
    ...qDeg(10, 0, 38),
    ...qDeg(0, 0, 5),
    ...qDeg(10, 0, 38),
    ...qDeg(0, 0, 5),
    ...qDeg(10, 0, 38),
    ...qDeg(0, 0, 0)
  ];

  const armRQuat = [
    ...qDeg(0, 0, 0),
    ...qDeg(10, 0, -38),
    ...qDeg(0, 0, -5),
    ...qDeg(10, 0, -38),
    ...qDeg(0, 0, -5),
    ...qDeg(10, 0, -38),
    ...qDeg(0, 0, -5),
    ...qDeg(10, 0, -38),
    ...qDeg(0, 0, 0)
  ];

  // Happy expressions throughout
  const faceTimes = [0, 1.2];
  const faceVals = [1.0, 1.0];

  return new THREE.AnimationClip('excited', duration, [
    new THREE.VectorKeyframeTrack('Root.position', times, rootPos),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', times, spineQuat),
    new THREE.QuaternionKeyframeTrack('Arm_L.quaternion', times, armLQuat),
    new THREE.QuaternionKeyframeTrack('Arm_R.quaternion', times, armRQuat),
    new THREE.NumberKeyframeTrack('Eye_L.morphTargetInfluences[happy]', faceTimes, faceVals),
    new THREE.NumberKeyframeTrack('Eye_R.morphTargetInfluences[happy]', faceTimes, faceVals),
    new THREE.NumberKeyframeTrack('Mouth.morphTargetInfluences[smile_wide]', faceTimes, faceVals)
  ]);
}
