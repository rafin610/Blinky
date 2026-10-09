import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBlinkyRig } from '../src/model/BlinkyGeometry.js';
import { createBlinkyAnimations } from '../src/model/BlinkyAnimations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Polyfill FileReader for Node.js
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      const b64 = Buffer.from(buf).toString('base64');
      this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + b64;
      if (this.onloadend) this.onloadend();
    });
  }
}
globalThis.FileReader = NodeFileReader;

console.log('🤖 Generating 3D Character System for Blinky...');

const rig = createBlinkyRig();
const animations = createBlinkyAnimations();

console.log(`✨ Rig created with ${rig.skeleton.bones.length} bones:`);
rig.skeleton.bones.forEach((b, idx) => console.log(`   [${idx}] ${b.name}`));

console.log(`🎬 Generated ${animations.length} Animation Clips:`);
animations.forEach((anim, idx) => {
  console.log(`   ${idx + 1}. "${anim.name}" (${anim.duration.toFixed(2)}s, ${anim.tracks.length} tracks)`);
});

// Count total vertices and faces
let totalVertices = 0;
let totalFaces = 0;
rig.group.traverse((obj) => {
  if (obj.isMesh && obj.geometry) {
    const geom = obj.geometry;
    const vCount = geom.attributes.position ? geom.attributes.position.count : 0;
    const fCount = geom.index ? geom.index.count / 3 : vCount / 3;
    totalVertices += vCount;
    totalFaces += fCount;
    console.log(`   📦 Mesh "${obj.name}": ${vCount} vertices, ${fCount} triangles`);
  }
});

console.log(`📊 Total Polygon Count: ${totalFaces} triangles, ${totalVertices} vertices`);

const exporter = new GLTFExporter();
exporter.parse(
  rig.group,
  (glb) => {
    const buffer = Buffer.from(glb);
    const pubPath = path.join(rootDir, 'public', 'models', 'blinky.glb');
    const rootPath = path.join(rootDir, 'blinky.glb');

    fs.mkdirSync(path.dirname(pubPath), { recursive: true });
    fs.writeFileSync(pubPath, buffer);
    fs.writeFileSync(rootPath, buffer);

    const sizeKb = (buffer.length / 1024).toFixed(1);
    console.log(`\n🎉 SUCCESS! Blinky GLB exported successfully!`);
    console.log(`   📁 Output: ${pubPath} (${sizeKb} KB)`);
    console.log(`   📁 Output: ${rootPath} (${sizeKb} KB)`);
    console.log(`   ⚡ Optimized for real-time 3D Linux desktop companion!`);
  },
  (err) => {
    console.error('❌ Failed to export GLB:', err);
    process.exit(1);
  },
  {
    binary: true,
    animations: animations,
    embedImages: true
  }
);
