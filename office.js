import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';

// ---------- constants (metres) ----------
const W = 44, D = 30, X0 = -22, X1 = 22, Z0 = -15, Z1 = 15;
const WALL_H = 4.5, WALL_T = 0.22;
const GRID = { x0: -22, x1: 13, z0: -15, z1: 15, cols: 3, rows: 3 };
const CAB = { x0: 14, x1: 22, z0: -15, z1: -7, doorX0: 19.6, doorX1: 20.6 };
const LOUNGE = { x0: 14, x1: 22, z0: 4, z1: 15, gapZ0: 7.6, gapZ1: 9.4 };
const ZONE_COLORS = { content: 0xf4c9bd, beauty: 0xf0c3dc, health: 0xc4e6c9, home: 0xf2dfb5, study: 0xc3d6f2, money: 0xd8e8b0, soul: 0xdccdf2, hall: 0xe8e2d8 };
const ZONE_ORDER = ['content', 'beauty', 'health', 'home', 'study', 'soul', 'money', 'hall'];
const HOUR = 3600e3, MIN = 60e3, DAY = 24 * HOUR;

const params = new URLSearchParams(location.search);
const NOW_OVERRIDE = params.get('now') ? Number(params.get('now')) : null;
const now = () => NOW_OVERRIDE || Date.now();

// ---------- renderer ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefe9df);
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);

scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb9ae9e, 1.15));
const sun = new THREE.DirectionalLight(0xfff3e0, 1.6);
sun.position.set(-18, 40, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, near: 5, far: 120 });
sun.shadow.bias = -0.0006;
scene.add(sun);

// ---------- materials & helpers ----------
const matCache = {};
const mat = (c, o = {}) => (matCache[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, ...o }));
function box(w, h, d, color, x, y, z, parent = scene, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(rt, rb, h, color, x, y, z, parent = scene, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function label(html, cls, obj, y) {
  const el = document.createElement('div'); el.className = cls; el.innerHTML = html;
  const o = new CSS2DObject(el); o.position.set(0, y, 0); obj.add(o); return o;
}
function signAt(text, x, y, z, big) {
  const g = new THREE.Object3D(); g.position.set(x, y, z); scene.add(g);
  label(text, 'sign' + (big ? ' big' : ''), g, 0); return g;
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------- walls (fade those between camera and office) ----------
const fadeWalls = [];
function wall(x0, z0, x1, z1, center, h = WALL_H, color = 0xf7f3ec) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, WALL_T), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true }));
  m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.castShadow = true; m.receiveShadow = true; scene.add(m);
  // cap strip on top for a crisp edge
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, WALL_T + 0.04), new THREE.MeshStandardMaterial({ color: 0x8c8076, transparent: true }));
  cap.position.y = h / 2 + 0.03; m.add(cap);
  const mid = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const n = new THREE.Vector3(center.x - mid.x, 0, center.z - mid.z).normalize(); // inward normal
  fadeWalls.push({ m, cap, mid, n });
  return m;
}
function updateWallFade() {
  for (const w of fadeWalls) {
    const v = new THREE.Vector3(camera.position.x - w.mid.x, 0, camera.position.z - w.mid.z);
    const outside = v.dot(w.n) < 0; // camera is on the outer side of the wall
    const steep = polar < 0.35;
    const op = outside && !steep ? 0.07 : 1;
    w.m.material.opacity += (op - w.m.material.opacity) * 0.2;
    w.cap.material.opacity = Math.max(w.m.material.opacity, 0.35);
    w.m.material.depthWrite = w.m.material.opacity > 0.9;
    w.m.castShadow = w.m.material.opacity > 0.9;
  }
}

// ---------- the building ----------
function buildShell() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xd8cbb7));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0xe6dfd3));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  // floor plank lines
  const lines = new THREE.Group();
  for (let x = X0 + 1.5; x < X1; x += 1.5) box(0.02, 0.003, D, 0xcbbca5, x, 0.002, 0, lines);
  lines.children.forEach(m => { m.castShadow = false; }); scene.add(lines);
  const C = { x: 0, z: 0 };
  wall(X0, Z0, X1, Z0, C); wall(X1, Z0, X1, Z1, C); wall(X1, Z1, X0, Z1, C); wall(X0, Z1, X0, Z0, C);
  // windows on the back wall (glass strips)
  for (let x = X0 + 3; x < X1 - 2; x += 5) box(3, 1.6, 0.05, 0xbcd6e6, x, 2.4, Z0 + 0.13, scene, { roughness: 0.2, metalness: 0.1 });
}

function buildCabinet() {
  const c = CAB, cc = { x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 };
  const carpet = box(c.x1 - c.x0 - 0.3, 0.02, c.z1 - c.z0 - 0.3, 0xcfd8d2, cc.x, 0.01, cc.z); carpet.castShadow = false;
  wall(c.x0, c.z0, c.x0, c.z1, cc, WALL_H, 0xeee7dc);
  wall(c.x0, c.z1, c.doorX0, c.z1, cc, WALL_H, 0xeee7dc);
  wall(c.doorX1, c.z1, c.x1, c.z1, cc, WALL_H, 0xeee7dc);
  // lintel above the door
  const lin = box(c.doorX1 - c.doorX0, WALL_H - 2.15, WALL_T, 0xeee7dc, (c.doorX0 + c.doorX1) / 2, 2.15 + (WALL_H - 2.15) / 2, c.z1);
  lin.material = lin.material.clone(); lin.material.transparent = true;
  fadeWalls.push({ m: lin, cap: new THREE.Mesh(), mid: new THREE.Vector3((c.doorX0 + c.doorX1) / 2, 0, c.z1), n: new THREE.Vector3(0, 0, -1) });
  // the door itself, ajar
  const hinge = new THREE.Object3D(); hinge.position.set(c.doorX0, 0, c.z1); scene.add(hinge);
  box(1.0, 2.1, 0.05, 0x7a5236, 0.5, 1.05, 0, hinge);
  box(0.04, 0.04, 0.14, 0xd8c08a, 0.88, 1.0, 0, hinge);
  hinge.rotation.y = 1.15; // opened inwards
  signAt('Кабинет директора', cc.x, WALL_H + 0.5, c.z1, true);
  // furniture: big desk, chair, plant, shelf, sofa
  desk(cc.x + 0.3, -12.6, 0, 2.0, true);
  box(3.2, 2.2, 0.4, 0x8d6b4f, cc.x, 1.1, c.z0 + 0.35);
  for (let i = 0; i < 4; i++) box(0.5, 0.35, 0.3, [0x4a6b8a, 0xb35d4a, 0xd9b45a, 0x5f8f6a][i], cc.x - 1.1 + i * 0.7, 1.55, c.z0 + 0.45);
  plant(c.x1 - 0.6, c.z0 + 0.6); plant(c.x0 + 0.6, c.z1 - 0.6);
  sofa(c.x0 + 0.6, -10.5, Math.PI / 2, 1.8);
}

function buildLounge() {
  const L = LOUNGE, lc = { x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2 };
  const rug = box(L.x1 - L.x0 - 0.4, 0.02, L.z1 - L.z0 - 0.4, 0xe9d7c3, lc.x, 0.01, lc.z); rug.castShadow = false;
  wall(L.x0, L.z0, L.x1, L.z0, lc, 2.6, 0xe4d7c8);
  wall(L.x0, L.z0, L.x0, L.gapZ0, lc, 2.6, 0xe4d7c8);
  wall(L.x0, L.gapZ1, L.x0, L.z1, lc, 2.6, 0xe4d7c8);
  signAt('🛋 Комната отдыха', lc.x + 1.5, 2.9, lc.z + 1.5, true);
  plant(L.x1 - 0.5, L.z1 - 0.5); plant(L.x0 + 0.5, L.z1 - 0.5); plant(L.x1 - 0.5, L.z0 + 0.6);
  cyl(0.55, 0.55, 0.38, 0xb08a64, 18, 0.19, 9.5); // coffee table
}

function buildKitchen() {
  // coffee point between cabinet and lounge
  box(0.65, 0.92, 3.2, 0xa98b6c, X1 - 0.45, 0.46, -1.0);
  box(0.7, 0.04, 3.3, 0xece6dc, X1 - 0.45, 0.94, -1.0);
  const cm = box(0.42, 0.5, 0.4, 0x3a3533, X1 - 0.5, 1.21, -1.6); // coffee machine
  box(0.1, 0.06, 0.1, 0xc0392b, X1 - 0.72, 1.36, -1.6);
  cyl(0.05, 0.04, 0.1, 0xffffff, X1 - 0.5, 1.0, -0.9);
  signAt('☕ Кофе-поинт', X1 - 1.2, 2.3, -1.0);
  plant(X1 - 0.5, 1.6);
  return cm;
}

// ---------- furniture ----------
function desk(x, z, rotY, width = 1.4, boss = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const top = boss ? 0x6b4a33 : 0xe8dccb;
  box(width, 0.04, boss ? 0.9 : 0.7, top, 0, 0.74, 0, g);
  for (const sx of [-1, 1]) box(0.05, 0.72, (boss ? 0.8 : 0.6), boss ? 0x5a3d2a : 0x9b9087, sx * (width / 2 - 0.05), 0.36, 0, g);
  box(0.55, 0.34, 0.03, 0x1e2226, 0, 1.0, -0.22, g); // monitor
  box(0.06, 0.18, 0.06, 0x555555, 0, 0.83, -0.24, g);
  box(0.42, 0.015, 0.14, 0x2c2c2c, 0, 0.765, 0.06, g); // keyboard
  if (boss) box(0.18, 0.12, 0.18, 0xd9b45a, 0.65, 0.82, -0.2, g);
  else cyl(0.04, 0.035, 0.1, [0xffffff, 0xd96b4f, 0x4f8fd9][hash(x + ',' + z) % 3], 0.5, 0.81, 0.05, g, 12);
  chair(0, 0.62, g, 0x3b3f46);
  return g;
}
function chair(x, z, parent, color = 0x47505a, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  box(0.46, 0.06, 0.44, color, 0, 0.46, 0, g);
  box(0.44, 0.5, 0.05, color, 0, 0.74, 0.2, g);
  cyl(0.03, 0.03, 0.4, 0x777777, 0, 0.23, 0, g, 8);
  cyl(0.24, 0.24, 0.03, 0x555555, 0, 0.03, 0, g, 12);
  return g;
}
function plant(x, z) {
  cyl(0.2, 0.16, 0.4, 0xb9714d, x, 0.2, z, scene, 14);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0x5f8f5a));
  leaves.position.set(x, 0.85, z); leaves.scale.y = 1.3; leaves.castShadow = true; scene.add(leaves);
}
function sofa(x, z, rotY, len = 2.2, color = 0x7d8f9e) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  box(len, 0.42, 0.85, color, 0, 0.21, 0, g);
  box(len, 0.5, 0.2, color, 0, 0.62, 0.33, g);
  for (const s of [-1, 1]) box(0.18, 0.6, 0.85, color, s * (len / 2 + 0.09), 0.3, 0, g);
  return g;
}
function roundTable(x, z, seats) {
  cyl(0.95, 0.95, 0.05, 0xe9dfd0, x, 0.75, z, scene, 40);
  cyl(0.07, 0.07, 0.72, 0x8c8076, x, 0.37, z, scene, 10);
  cyl(0.4, 0.4, 0.03, 0x8c8076, x, 0.02, z, scene, 20);
  const pos = [];
  seats.forEach((s, i) => {
    const a = (i / seats.length) * Math.PI * 2 + Math.PI / 2;
    const cx = x + Math.cos(a) * 1.3, cz = z + Math.sin(a) * 1.3;
    const rot = Math.atan2(x - cx, z - cz) + Math.PI; // chair back away from the table
    chair(cx, cz, scene, 0x8e5f4e, rot);
    pos.push({ x: cx, z: cz, rot: Math.atan2(x - cx, z - cz), kind: 'chair', name: s });
  });
  return pos;
}
function bench(x, z, n) { // faces -z, its back against the lounge wall
  const len = Math.max(2.4, n * 0.62 + 0.3);
  const g = new THREE.Group(); g.position.set(x + len / 2, 0, z); scene.add(g);
  box(len, 0.05, 0.45, 0xb98a5a, 0, 0.45, 0, g);
  box(len, 0.32, 0.04, 0xb98a5a, 0, 0.72, 0.22, g);
  for (const s of [-1, 1]) box(0.06, 0.45, 0.42, 0x5a4a3c, s * (len / 2 - 0.1), 0.22, 0, g);
  signAt('🪑 Ждут тебя', x + len / 2, 3.0, z + 0.3, true);
  const seats = [];
  for (let i = 0; i < n; i++) seats.push({ x: x + 0.45 + i * 0.62, z: z - 0.02, rot: Math.PI, kind: 'bench' });
  return seats;
}

// ---------- people ----------
const SKIN = [0xf1c8a5, 0xe0ac85, 0xc98f68, 0xf6d2b4];
const HAIR = [0x2a1f1a, 0x4a3326, 0x161616, 0x7a4b2a, 0xa3714a];
const SHIRT = [0xd9665b, 0x4f86c6, 0x5aa17f, 0xe0a83f, 0x9b6bc4, 0x3a8f9c, 0xc75b8e, 0x6c7a89, 0xe07b4f, 0x7d9a3f];
function limb(len, r, color) {
  const pivot = new THREE.Object3D();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10), mat(color));
  m.position.y = -len / 2; m.castShadow = true; pivot.add(m);
  return pivot;
}
function makePerson(bot) {
  const h = hash(bot.name);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 3) % HAIR.length];
  const shirt = bot.main ? 0x2b2622 : SHIRT[(h >>> 6) % SHIRT.length], pants = [0x2f3640, 0x4a4036, 0x30405a][(h >>> 9) % 3];
  const root = new THREE.Group();
  const hips = new THREE.Object3D(); hips.position.y = 0.92; root.add(hips);
  const legs = [-1, 1].map(s => {
    const thigh = limb(0.46, 0.075, pants); thigh.position.set(s * 0.1, 0, 0); hips.add(thigh);
    const shin = limb(0.46, 0.065, pants); shin.position.y = -0.46; thigh.add(shin);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), mat(0x2a2a2a)); shoe.position.set(0, -0.46, 0.05); shoe.castShadow = true; shin.add(shoe);
    return { thigh, shin };
  });
  const torso = new THREE.Object3D(); hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 4, 12), mat(shirt));
  body.scale.z = 0.7; body.position.y = 0.3; body.castShadow = true; torso.add(body);
  const neck = new THREE.Object3D(); neck.position.y = 0.6; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), mat(skin)); head.position.y = 0.13; head.castShadow = true; neck.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), mat(hair)); hairM.position.y = 0.145; hairM.rotation.x = -0.25; neck.add(hairM);
  if (h % 2) { const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), mat(hair)); tail.position.set(0, 0.07, -0.12); neck.add(tail); }
  const arms = [-1, 1].map(s => {
    const up = limb(0.3, 0.05, shirt); up.position.set(s * 0.23, 0.5, 0); torso.add(up);
    const fo = limb(0.28, 0.045, skin); fo.position.y = -0.3; up.add(fo);
    return { up, fo };
  });
  root.userData = { hips, legs, torso, neck, arms };
  return root;
}
function pose(p, kind, t) {
  const { hips, legs, torso, neck, arms } = p.obj.userData;
  const ph = p.phase + t;
  if (kind === 'walk') {
    const s = Math.sin(ph * 7.5);
    hips.position.y = 0.92 + Math.abs(Math.cos(ph * 7.5)) * 0.025;
    legs[0].thigh.rotation.x = s * 0.45; legs[1].thigh.rotation.x = -s * 0.45;
    legs[0].shin.rotation.x = Math.max(0, -s) * 0.6; legs[1].shin.rotation.x = Math.max(0, s) * 0.6;
    arms[0].up.rotation.x = -s * 0.35; arms[1].up.rotation.x = s * 0.35; arms[0].fo.rotation.x = arms[1].fo.rotation.x = -0.25;
    torso.rotation.x = 0.04; neck.rotation.x = 0;
  } else if (kind === 'stand') {
    hips.position.y = 0.92;
    for (const l of legs) { l.thigh.rotation.x = 0; l.shin.rotation.x = 0; }
    arms[0].up.rotation.x = -0.15 + Math.sin(ph * 2) * 0.12; arms[1].up.rotation.x = -0.1; arms[0].fo.rotation.x = -0.9; arms[1].fo.rotation.x = -0.2;
    torso.rotation.x = 0; neck.rotation.x = Math.sin(ph * 1.3) * 0.08;
  } else { // seated variants
    const benchSeat = kind === 'bench' || kind === 'sofa';
    hips.position.y = kind === 'sofa' ? 0.47 : 0.5;
    for (const l of legs) { l.thigh.rotation.x = -Math.PI / 2; l.shin.rotation.x = Math.PI / 2; }
    if (kind === 'sleep') {
      torso.rotation.x = 0.55 + Math.sin(ph * 1.4) * 0.015; neck.rotation.x = 0.5;
      arms[0].up.rotation.x = arms[1].up.rotation.x = -1.05; arms[0].fo.rotation.x = arms[1].fo.rotation.x = -0.9;
    } else if (kind === 'sleepback') {
      torso.rotation.x = -0.18; neck.rotation.x = 0.55 + Math.sin(ph * 1.4) * 0.03;
      arms[0].up.rotation.x = arms[1].up.rotation.x = -0.35; arms[0].fo.rotation.x = arms[1].fo.rotation.x = -0.9;
    } else if (benchSeat) {
      torso.rotation.x = -0.05; neck.rotation.x = Math.sin(ph * 0.9) * 0.1;
      arms[0].up.rotation.x = arms[1].up.rotation.x = -0.45; arms[0].fo.rotation.x = arms[1].fo.rotation.x = -0.6;
    } else { // typing
      torso.rotation.x = 0.08; neck.rotation.x = 0.12;
      arms[0].up.rotation.x = -0.75; arms[1].up.rotation.x = -0.75;
      arms[0].fo.rotation.x = -0.75 + Math.sin(ph * 17) * 0.06; arms[1].fo.rotation.x = -0.75 + Math.cos(ph * 15) * 0.06;
    }
  }
}

// ---------- camera rig (custom touch: 2 fingers rotate / tilt / pinch) ----------
let target = new THREE.Vector3(0, 0, 0), dist = 60, az = 0.55, polar = 0.9;
let goal = null; // animated camera goal
const POLAR_MIN = 0.02, POLAR_MAX = 1.35, DIST_MIN = 6, DIST_MAX = 120;
let savedPolar = 0.9;
function applyCamera() {
  polar = Math.min(POLAR_MAX, Math.max(POLAR_MIN, polar));
  dist = Math.min(DIST_MAX, Math.max(DIST_MIN, dist));
  target.x = Math.min(X1, Math.max(X0, target.x)); target.z = Math.min(Z1, Math.max(Z0, target.z));
  const sp = Math.sin(polar);
  camera.position.set(target.x + dist * sp * Math.sin(az), target.y + dist * Math.cos(polar), target.z + dist * sp * Math.cos(az));
  camera.up.set(-Math.sin(az) * (polar < 0.05 ? 1 : 0), polar < 0.05 ? 0 : 1, -Math.cos(az) * (polar < 0.05 ? 1 : 0));
  if (polar >= 0.05) camera.up.set(0, 1, 0);
  camera.lookAt(target);
}
function fitDistance() {
  const aspect = innerWidth / innerHeight;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  // portrait: the short side (D) goes across the screen; landscape: the long side (W)
  const across = aspect < 1 ? D : W, along = aspect < 1 ? W : D;
  const dH = (across / 2 + 1) / Math.tan(hfov / 2), dV = (along * Math.cos(polar) / 2 + 2) / Math.tan(vfov / 2);
  return Math.min(DIST_MAX, Math.max(dH, dV) * 1.06);
}
const pointers = new Map();
let gest = null;
function gestureState() {
  const [a, b] = [...pointers.values()];
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
}
function panBy(dx, dy) {
  const k = dist * 0.0016;
  const fx = -Math.sin(az), fz = -Math.cos(az); // forward on ground
  const rx = Math.cos(az), rz = -Math.sin(az);
  target.x -= (rx * dx - fx * dy) * k; target.z -= (rz * dx - fz * dy) * k;
}
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }); goal = null; gest = pointers.size === 2 ? gestureState() : null; hideHint(); });
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const g = gestureState();
    if (gest) {
      dist *= gest.d / Math.max(g.d, 1);
      let da = g.ang - gest.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      az -= da;
      polar -= (g.cy - gest.cy) * 0.006;
    }
    gest = g;
  } else if (pointers.size === 1) {
    if (e.pointerType === 'mouse' && p.b === 0 && !p.shift) { az -= dx * 0.006; polar -= dy * 0.005; }
    else panBy(dx, dy);
  }
});
const up = e => { pointers.delete(e.pointerId); gest = pointers.size === 2 ? gestureState() : null; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); dist *= Math.exp(e.deltaY * 0.0012); goal = null; }, { passive: false });
function animateTo(g) { goal = { az: g.az ?? az, polar: g.polar ?? polar, dist: g.dist ?? dist }; }
document.getElementById('rotL').onclick = () => animateTo({ az: (goal?.az ?? az) + Math.PI / 4 });
document.getElementById('rotR').onclick = () => animateTo({ az: (goal?.az ?? az) - Math.PI / 4 });
const topBtn = document.getElementById('topv');
topBtn.onclick = () => {
  const isTop = polar < 0.1 && !goal || goal?.polar < 0.1;
  if (isTop) { animateTo({ polar: savedPolar > 0.15 ? savedPolar : 0.9 }); topBtn.classList.remove('on'); topBtn.textContent = 'Сверху'; }
  else { savedPolar = polar; animateTo({ polar: POLAR_MIN, dist: fitDistance() * 0.95 }); target.set(0, 0, 0); topBtn.classList.add('on'); topBtn.textContent = '3D'; }
};
const hintEl = document.getElementById('hint');
function hideHint() { hintEl.style.opacity = 0; }
setTimeout(hideHint, 6000);

// ---------- sound (Web Audio, synthesized, muted by default) ----------
const audio = { ctx: null, master: null, on: false, noise: null };
function initAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  Object.assign(audio, { ctx, master, noise: buf });
}
function burst({ f = 3000, q = 1, dur = 0.03, vol = 0.05, type = 'bandpass', attack = 0.002, at = 0, pan = 0 }) {
  const { ctx, master, noise } = audio; if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  src.connect(fl); fl.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
  src.start(t0, Math.random() * 1.5); src.stop(t0 + attack + dur + 0.05);
}
const sfx = {
  key(pan) { burst({ f: 2400 + Math.random() * 2200, q: 2.5, dur: 0.025 + Math.random() * 0.02, vol: 0.035 + Math.random() * 0.02, pan }); },
  step(pan) { burst({ f: 180 + Math.random() * 60, q: 0.9, dur: 0.07, vol: 0.09, type: 'lowpass', pan }); burst({ f: 1200, q: 1, dur: 0.02, vol: 0.012, pan }); },
  coffee() { // grinder then a soft steam hiss
    const { ctx } = audio; if (!ctx) return;
    for (let i = 0; i < 26; i++) burst({ f: 700 + Math.random() * 500, q: 3, dur: 0.09, vol: 0.022, at: i * 0.09, pan: 0.6 });
    burst({ f: 5200, q: 0.7, dur: 2.2, vol: 0.018, attack: 0.4, at: 3.0, type: 'highpass', pan: 0.6 });
    for (let i = 0; i < 6; i++) burst({ f: 900, q: 6, dur: 0.06, vol: 0.02, at: 5.8 + i * 0.35, pan: 0.6 });
  },
  snore(pan) { burst({ f: 260, q: 1.5, dur: 1.1, vol: 0.022, attack: 0.7, type: 'lowpass', pan }); burst({ f: 900, q: 0.7, dur: 1.0, vol: 0.006, attack: 0.5, at: 1.9, pan }); },
};
const sndBtn = document.getElementById('snd');
sndBtn.onclick = () => {
  if (!audio.ctx) initAudio();
  audio.on = !audio.on;
  if (audio.on) audio.ctx.resume(); else audio.ctx.suspend();
  sndBtn.textContent = audio.on ? '🔊' : '🔇'; sndBtn.classList.toggle('on', audio.on);
};
function panOf(p) { const v = p.obj.position.clone().project(camera); return Math.max(-0.8, Math.min(0.8, v.x)); }

// ---------- routing ----------
const AISLE_Z = [-5, 5], AISLE_X = [-10.33, 1.33, 13.2];
const CAB_IN = { x: (CAB.doorX0 + CAB.doorX1) / 2, z: CAB.z1 - 0.9 }, CAB_OUT = { x: (CAB.doorX0 + CAB.doorX1) / 2, z: CAB.z1 + 0.9 };
const L_IN = { x: LOUNGE.x0 + 0.9, z: (LOUNGE.gapZ0 + LOUNGE.gapZ1) / 2 }, L_OUT = { x: LOUNGE.x0 - 0.8, z: (LOUNGE.gapZ0 + LOUNGE.gapZ1) / 2 };
const inCab = p => p.x > CAB.x0 && p.z < CAB.z1;
const inLounge = p => p.x > LOUNGE.x0 && p.z > LOUNGE.z0;
const nearest = (arr, v) => arr.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
function route(a, b) {
  const pts = [];
  let s = { x: a.x, z: a.z };
  if (inCab(s)) { pts.push(CAB_IN, CAB_OUT); s = CAB_OUT; }
  else if (inLounge(s)) { pts.push(L_IN, L_OUT); s = L_OUT; }
  let e = { x: b.x, z: b.z }, tail = [];
  if (inCab(e)) { tail = [CAB_OUT, CAB_IN]; e = CAB_OUT; }
  else if (inLounge(e)) { tail = [L_OUT, L_IN]; e = L_OUT; }
  const za = nearest(AISLE_Z, s.z), zb = nearest(AISLE_Z, e.z);
  pts.push({ x: s.x, z: za });
  if (za !== zb) { const xv = nearest(AISLE_X, (s.x + e.x) / 2); pts.push({ x: xv, z: za }, { x: xv, z: zb }); }
  pts.push({ x: e.x, z: zb });
  pts.push(...tail, { x: b.x, z: b.z });
  return pts.filter((p, i, arr) => i === 0 || Math.hypot(p.x - arr[i - 1].x, p.z - arr[i - 1].z) > 0.05);
}

// ---------- build world from data ----------
let people = [], edgesByName = {}, coffeeMachine;
const fmtAgo = ms => { if (ms == null) return 'нет данных'; const m = Math.round(ms / MIN); if (m < 60) return `${Math.max(1, m)} мин назад`; const h = Math.round(ms / HOUR); if (h < 48) return `${h} ч назад`; return `${Math.round(ms / DAY)} дн назад`; };
function statusOf(b, th) {
  const age = b.lastActive ? now() - b.lastActive : Infinity;
  return { age, active: age <= th.activeMin * MIN, sleeping: age > th.sleepHours * HOUR, lounge: !b.main && age > th.loungeDays * DAY };
}
function signature(data) { return JSON.stringify(data.bots.map(b => { const s = statusOf(b, data.thresholds); return [b.name, s.active, s.sleeping, s.lounge, b.awaiting]; })); }

function build(data) {
  const th = data.thresholds;
  buildShell(); buildCabinet(); buildLounge(); coffeeMachine = buildKitchen();
  const bots = data.bots.map(b => ({ ...b, ...statusOf(b, th) }));
  const byName = Object.fromEntries(bots.map(b => [b.name, b]));
  for (const e of data.edges) {
    const w = e.w7 * 3 + e.w30;
    (edgesByName[e.a] ||= []).push({ to: e.b, w }); (edgesByName[e.b] ||= []).push({ to: e.a, w });
  }
  // zones present (except boss)
  const zoneLabel = Object.fromEntries(data.zones.map(z => [z.key, z.label]));
  const zones = [...new Set(bots.filter(b => !b.main).map(b => b.zone))].sort((a, b) => ZONE_ORDER.indexOf(a) - ZONE_ORDER.indexOf(b));
  const cw = (GRID.x1 - GRID.x0) / GRID.cols, ch = (GRID.z1 - GRID.z0) / GRID.rows;
  const seat = {};
  // table membership: first table for each bot
  const tableOf = {};
  data.tables.forEach((t, i) => t.members.forEach(m => { if (!byName[m]?.main && tableOf[m] == null) tableOf[m] = i; }));
  const tablesByZone = {};
  data.tables.forEach((t, i) => (tablesByZone[t.zone] ||= []).push(i));
  zones.slice(0, GRID.cols * GRID.rows).forEach((zk, idx) => {
    const col = idx % GRID.cols, row = Math.floor(idx / GRID.cols);
    const x0 = GRID.x0 + col * cw, z0 = GRID.z0 + row * ch, cx = x0 + cw / 2, cz = z0 + ch / 2;
    const rug = box(cw - 1.2, 0.015, ch - 1.4, ZONE_COLORS[zk] || 0xe8e2d8, cx, 0.008, cz); rug.castShadow = false;
    signAt(esc(zoneLabel[zk] || zk), cx, 0.2, z0 + 0.7);
    const tbl = (tablesByZone[zk] || []);
    let deskArea = { x0: x0 + 1.2, x1: x0 + cw - 1.2 };
    tbl.forEach((ti, k) => {
      const tx = x0 + 2.9 + k * 4.2, tz = cz + 0.3;
      const pos = roundTable(tx, tz, data.tables[ti].members);
      pos.forEach(p => { if (tableOf[p.name] === ti) seat[p.name] = p; });
      deskArea.x0 = tx + 2.2;
    });
    // desks for zone members not seated at a table
    const deskers = bots.filter(b => b.zone === zk && tableOf[b.name] == null);
    const cols = Math.max(1, Math.floor((deskArea.x1 - deskArea.x0) / 2.1));
    deskers.forEach((b, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const dx = deskArea.x0 + 1.0 + c * 2.1, dz = z0 + 2.6 + r * 2.7;
      desk(dx, dz, 0);
      seat[b.name] = { x: dx, z: dz + 0.62, rot: Math.PI, kind: 'chair' };
    });
  });
  // director's cabinet seat
  const boss = bots.find(b => b.main);
  if (boss) seat[boss.name] = { x: (CAB.x0 + CAB.x1) / 2 + 0.3, z: -12.6 + 0.62, rot: Math.PI, kind: 'chair' };
  // bench and lounge override the home seat
  const waiting = bots.filter(b => b.awaiting && !b.main);
  const benchSeats = bench(14.8, LOUNGE.z0 - 0.45, Math.max(3, waiting.length));
  const resting = bots.filter(b => b.lounge && !b.awaiting);
  const L = LOUNGE;
  const loungeSeats = [];
  const s1 = sofa(16.2, L.z1 - 0.7, Math.PI, 2.6, 0x9e7d6b), s2 = sofa(L.x1 - 0.7, 9.5, -Math.PI / 2, 2.6, 0x7d8f9e), s3 = sofa(16.2, L.z0 + 0.9, 0, 2.6, 0x8a9b7c);
  for (let i = 0; i < 3; i++) loungeSeats.push({ x: 15.3 + i * 0.9, z: L.z1 - 0.75, rot: Math.PI, kind: 'sofa' });
  for (let i = 0; i < 3; i++) loungeSeats.push({ x: L.x1 - 0.75, z: 8.6 + i * 0.9, rot: -Math.PI / 2, kind: 'sofa' });
  for (let i = 0; i < 3; i++) loungeSeats.push({ x: 15.3 + i * 0.9, z: L.z0 + 0.95, rot: 0, kind: 'sofa' });
  for (let i = 9; i < 30; i++) loungeSeats.push({ x: 15.2 + (i % 4) * 1.1, z: 6.2 + Math.floor(i / 4) * 1.0, rot: Math.PI / 2, kind: 'stand' });
  waiting.forEach((b, i) => { seat[b.name] = benchSeats[i]; });
  resting.forEach((b, i) => { seat[b.name] = loungeSeats[i]; });

  for (const b of bots) {
    const s = seat[b.name] || { x: 0, z: 0, rot: 0, kind: 'stand' };
    const obj = makePerson(b); obj.position.set(s.x, 0, s.z); obj.rotation.y = s.rot; scene.add(obj);
    const st = b.active ? '<span class="st bulb">💡</span>' : '';
    const zz = b.sleeping ? '<span class="zz">Zz</span>' : '';
    const lbl = label(`${st}<span>${esc(b.name)}</span>${zz}`, 'lbl' + (b.main ? ' main' : '') + (b.sleeping ? ' sleep' : ''), obj, 2.05);
    const p = { bot: b, obj, home: s, state: 'seated', path: null, timer: 4 + Math.random() * 18, phase: Math.random() * 10, lbl, stepAcc: 0 };
    people.push(p);
  }
  // stats
  const act = bots.filter(b => b.active).length, sl = bots.filter(b => b.sleeping && !b.lounge).length;
  document.getElementById('stats').innerHTML =
    `<span class="chip">👥 ${bots.length} ботов</span><span class="chip">💡 ${act} активны</span><span class="chip">Zz ${sl} спят</span>` +
    `<span class="chip">🪑 ${waiting.length} ждут тебя</span><span class="chip">🛋 ${resting.length} на отдыхе</span>`;
  const t = new Date(data.generatedAt).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  document.getElementById('updated').textContent = `Последние изменения: ${t} (Алматы) · 💡 активен ≤30 мин · Zz спит >3 ч`;
}

// ---------- behaviour ----------
function homePoseKind(p) {
  const b = p.bot, k = p.home.kind;
  if (k === 'stand') return 'stand';
  if (b.sleeping) return k === 'chair' && !b.awaiting ? (p.home === undefined ? 'sleep' : (b.lounge ? 'sleepback' : 'sleep')) : 'sleepback';
  if (k === 'bench' || k === 'sofa') return k;
  return 'type';
}
function pickPartner(p) {
  const list = (edgesByName[p.bot.name] || []).filter(e => people.some(q => q.bot.name === e.to));
  if (!list.length) return null;
  let r = Math.random() * list.reduce((s, e) => s + e.w, 0);
  for (const e of list) { r -= e.w; if (r <= 0) return people.find(q => q.bot.name === e.to); }
  return people.find(q => q.bot.name === list[0].to);
}
function canWalk(p) { const b = p.bot; return !b.sleeping && !b.lounge && !b.awaiting && (edgesByName[b.name] || []).length > 0; }
function visitPoint(q, from) {
  const h = q.home; let dx = from.x - h.x, dz = from.z - h.z; const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  // stand beside the colleague, slightly off their facing direction
  const fx = Math.sin(h.rot), fz = Math.cos(h.rot);
  let vx = dx * 0.5 + fx * 0.3 + -fz * 0.5, vz = dz * 0.5 + fz * 0.3 + fx * 0.5;
  const vl = Math.hypot(vx, vz) || 1; return { x: h.x + vx / vl * 0.85, z: h.z + vz / vl * 0.85 };
}
let footstepCount = 0;
function update(dt, t) {
  for (const p of people) {
    if (p.state === 'seated') {
      pose(p, homePoseKind(p), t);
      if (canWalk(p) && (p.timer -= dt) <= 0) {
        const q = pickPartner(p);
        if (q && q !== p) {
          const vp = visitPoint(q, p.home);
          p.path = route(p.home, vp); p.state = 'walk'; p.visit = q; p.returning = false;
        }
        p.timer = 25 + Math.random() * 40;
      }
    } else if (p.state === 'walk') {
      const tgt = p.path[0];
      const pos = p.obj.position; const dx = tgt.x - pos.x, dz = tgt.z - pos.z; const l = Math.hypot(dx, dz);
      const sp = 1.25 * dt;
      if (l <= sp) { pos.x = tgt.x; pos.z = tgt.z; p.path.shift(); }
      else { pos.x += dx / l * sp; pos.z += dz / l * sp; const want = Math.atan2(dx, dz); let d = want - p.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); p.obj.rotation.y += d * Math.min(1, dt * 8); }
      pose(p, 'walk', t);
      p.stepAcc += dt * 7.5 / Math.PI; if (p.stepAcc >= 1) { p.stepAcc -= 1; if (audio.on && footstepCount++ % 1 === 0) sfx.step(panOf(p)); }
      if (!p.path.length) {
        if (p.returning) { p.state = 'seated'; p.obj.rotation.y = p.home.rot; p.obj.position.set(p.home.x, 0, p.home.z); }
        else { p.state = 'visit'; p.stay = 6 + Math.random() * 6; const q = p.visit; p.obj.rotation.y = Math.atan2(q.obj.position.x - p.obj.position.x, q.obj.position.z - p.obj.position.z); }
      }
    } else if (p.state === 'visit') {
      pose(p, 'stand', t);
      if ((p.stay -= dt) <= 0) { p.path = route(p.obj.position, p.home); p.path.push({ x: p.home.x, z: p.home.z }); p.state = 'walk'; p.returning = true; }
    }
  }
}
// ambient sound scheduler
let keyT = 0, coffeeT = 20 + Math.random() * 30, snoreT = 3;
function soundTick(dt) {
  if (!audio.on) return;
  const typists = people.filter(p => p.state === 'seated' && homePoseKind(p) === 'type');
  const sleepers = people.filter(p => p.bot.sleeping);
  if (typists.length && (keyT -= dt) <= 0) {
    const p = typists[Math.floor(Math.random() * typists.length)];
    const n = 3 + Math.floor(Math.random() * 9), pan = panOf(p);
    for (let i = 0; i < n; i++) setTimeout(() => sfx.key(pan), i * (70 + Math.random() * 90));
    keyT = (1.2 + Math.random() * 2.5) / Math.min(4, typists.length);
  }
  if ((coffeeT -= dt) <= 0) { sfx.coffee(); coffeeT = 70 + Math.random() * 80; }
  if (sleepers.length && (snoreT -= dt) <= 0) { const p = sleepers[Math.floor(Math.random() * sleepers.length)]; sfx.snore(panOf(p) * 0.6); snoreT = 5 + Math.random() * 5; }
}

// ---------- main ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); labelRenderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
let lastSig = '', lastText = '';
async function load() {
  const res = await fetch('data.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
  const text = await res.text(); const data = JSON.parse(text); lastText = text; lastSig = signature(data); return data;
}
async function start() {
  resize();
  let data;
  try { data = await load(); } catch (e) { const el = document.getElementById('err'); el.style.display = 'block'; el.textContent = 'Не удалось загрузить data.json'; return; }
  build(data);
  if (innerWidth < innerHeight) { az = -Math.PI / 2 + 0.07; polar = 0.78; } else { az = 0.3; polar = 0.85; }
  dist = fitDistance(); applyCamera();
  if (params.get('az')) az = Number(params.get('az'));
  if (params.get('polar')) polar = Number(params.get('polar'));
  if (params.get('dist')) dist = Number(params.get('dist'));
  if (params.get('tx')) target.set(Number(params.get('tx')), 0, Number(params.get('tz') || 0));
  // re-check data every 5 minutes, and statuses every minute
  setInterval(async () => { try { const r = await fetch('data.json?t=' + Date.now(), { cache: 'no-store' }); const tx = await r.text(); if (tx !== lastText) location.reload(); } catch {} }, 5 * 60e3);
  setInterval(() => { if (signature(data) !== lastSig) location.reload(); }, 60e3);
  const clock = new THREE.Clock();
  // warm-up: let walkers move a bit for screenshots
  if (params.has('shot')) { for (const p of people) if (canWalk(p)) p.timer = 0.1; for (let i = 0; i < 160; i++) update(1 / 30, i / 30); }
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    if (goal) {
      const k = Math.min(1, dt * 5);
      az += (goal.az - az) * k; polar += (goal.polar - polar) * k; dist += (goal.dist - dist) * k;
      if (Math.abs(goal.az - az) < 0.002 && Math.abs(goal.polar - polar) < 0.002 && Math.abs(goal.dist - dist) < 0.05) goal = null;
    }
    applyCamera(); updateWallFade();
    const fs = Math.max(7.5, Math.min(13, 520 / dist));
    if (Math.abs(fs - (window.__fs || 0)) > 0.25) { window.__fs = fs; document.documentElement.style.setProperty('--fs', fs + 'px'); }
    update(dt, t); soundTick(dt);
    renderer.render(scene, camera); labelRenderer.render(scene, camera);
  });
  window.__ready = true;
}
start();
