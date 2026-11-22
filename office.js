import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0e8dc);
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);

scene.add(new THREE.HemisphereLight(0xfff1dc, 0xa08c74, 1.25));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.1);
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

// ---------- procedural textures ----------
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const TEX = {};
// oak parquet, staggered planks with grain (1024px = 4 m)
TEX.parquet = canvasTex(1024, 1024, (g, s) => {
  const pl = 300, ph = 38;
  for (let y = 0, row = 0; y < s; y += ph, row++) {
    for (let x = -((row * 137) % pl); x < s; x += pl) {
      const l = rnd(62, 71), hu = rnd(30, 38), sa = rnd(24, 34);
      g.fillStyle = `hsl(${hu},${sa}%,${l}%)`; g.fillRect(x, y, pl, ph);
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `hsla(${hu - 4},${sa}%,${l - rnd(6, 14)}%,${rnd(0.15, 0.4)})`; g.lineWidth = rnd(0.6, 1.6);
        g.beginPath(); const yy = y + rnd(3, ph - 3); g.moveTo(x, yy);
        g.bezierCurveTo(x + pl * 0.3, yy + rnd(-4, 4), x + pl * 0.7, yy + rnd(-4, 4), x + pl, yy + rnd(-2, 2)); g.stroke();
      }
      if (Math.random() < 0.25) { g.fillStyle = `hsla(${hu - 6},40%,${l - 18}%,.5)`; g.beginPath(); g.ellipse(x + rnd(30, pl - 30), y + ph / 2, rnd(3, 7), rnd(2, 4), 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(70,45,25,.45)'; g.fillRect(x, y, 2, ph);
    }
    g.fillStyle = 'rgba(70,45,25,.35)'; g.fillRect(0, y, s, 1.5);
  }
}, W / 4, D / 4);
// warm plaster
TEX.plaster = canvasTex(256, 256, (g, s) => {
  g.fillStyle = '#f3ede4'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '120,100,80' : '255,255,255'},${rnd(.02, .07)})`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 4), rnd(1, 4)); }
}, 6, 2);
// Iznik tiles: cream ground, cobalt + turquoise flower, coral-red dots
TEX.iznik = canvasTex(512, 512, (g, s) => {
  const t = s / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * t, y = j * t, cx = x + t / 2, cy = y + t / 2;
    g.fillStyle = '#f6f1e6'; g.fillRect(x, y, t, t);
    g.strokeStyle = '#1f4fa3'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, t * 0.36, 0, 7); g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4; g.save(); g.translate(cx + Math.cos(a) * t * 0.2, cy + Math.sin(a) * t * 0.2); g.rotate(a);
      g.fillStyle = k % 2 ? '#2fa3a0' : '#1f4fa3'; g.beginPath(); g.ellipse(0, 0, t * 0.12, t * 0.05, 0, 0, 7); g.fill(); g.restore();
    }
    g.fillStyle = '#c8402f'; g.beginPath(); g.arc(cx, cy, t * 0.07, 0, 7); g.fill();
    g.fillStyle = '#1f4fa3'; for (const [px, py] of [[x, y], [x + t, y], [x, y + t], [x + t, y + t]]) { g.beginPath(); g.arc(px, py, t * 0.13, 0, 7); g.fill(); }
    g.fillStyle = '#2fa3a0'; for (const [px, py] of [[cx, y], [cx, y + t], [x, cy], [x + t, cy]]) { g.beginPath(); g.arc(px, py, t * 0.05, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(160,150,135,.9)'; g.lineWidth = 3; g.strokeRect(x, y, t, t);
  }
});
// kilim rug generator
const KILIM = {
  content: ['#9e2f2a', '#e8d3a8', '#1f3d6b', '#d98a2b'], beauty: ['#a8385a', '#f0dcc0', '#3b2a4d', '#d9a441'],
  health: ['#3f6b4a', '#eadcb8', '#9e3b2a', '#d9a441'], home: ['#b0652a', '#f0e0c0', '#2c4a6e', '#8f2f2a'],
  study: ['#24476e', '#eadcbf', '#a33a2a', '#d9a441'], soul: ['#5b3d73', '#eedcc2', '#b8862e', '#2f6e6a'],
  money: ['#6e7a2c', '#efe0bd', '#8f2f2a', '#1f3d6b'], hall: ['#8f4a35', '#ecdcc0', '#2f4d6b', '#c99a3e'],
  boss: ['#7a2421', '#e9d6ae', '#14325c', '#c9952e'], lounge: ['#a3342b', '#efdcb4', '#1d4f7a', '#e0a33a'],
};
const kilimCache = {};
function kilimTex(key) {
  if (kilimCache[key]) return kilimCache[key];
  const [base, light, dark, acc] = KILIM[key] || KILIM.hall;
  return (kilimCache[key] = canvasTex(512, 768, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // borders
    const bands = [[0, dark, 26], [26, light, 10], [36, acc, 22], [58, light, 8]];
    for (const [o, c, th] of bands) { g.strokeStyle = c; g.lineWidth = th; g.strokeRect(o + th / 2, o + th / 2, w - 2 * o - th, h - 2 * o - th); }
    // zig-zag in the outer band
    g.fillStyle = light; for (let x = 0; x < w; x += 26) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x + 13, 6); g.lineTo(x + 26, 26); g.fill(); g.beginPath(); g.moveTo(x, h - 26); g.lineTo(x + 13, h - 6); g.lineTo(x + 26, h - 26); g.fill(); }
    // field of stepped diamonds (göl)
    const fx = 90, fy = 90, fw = w - 180, fh = h - 180, cols = 2, rows = 3;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = fx + fw * (i + 0.5) / cols, cy = fy + fh * (j + 0.5) / rows, r = Math.min(fw / cols, fh / rows) * 0.46;
      const ring = [dark, light, acc, dark, light];
      ring.forEach((c, k) => {
        const rr = r * (1 - k * 0.19), st = 6;
        g.fillStyle = c; g.beginPath();
        for (let q = 0; q < 4; q++) for (let s = 0; s <= st; s++) {
          const tt = s / st, ang = q * Math.PI / 2;
          const px = Math.cos(ang) * (1 - tt) + Math.cos(ang + Math.PI / 2) * tt, py = Math.sin(ang) * (1 - tt) + Math.sin(ang + Math.PI / 2) * tt;
          const sx = Math.round(px * st) / st, sy = Math.round(py * st) / st;
          g.lineTo(cx + sx * rr, cy + sy * rr * 1.15);
        }
        g.closePath(); g.fill();
      });
      // hooks
      g.fillStyle = acc; for (const s of [-1, 1]) { g.fillRect(cx + s * r * 0.95 - 6, cy - 6, 12, 12); g.fillRect(cx - 6, cy + s * r * 1.1 - 6, 12, 12); }
    }
    // woven texture
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${y % 6 ? .05 : .09})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0, .06)})`; g.fillRect(rnd(0, w), rnd(0, h), 2, 1); }
  }));
}
function kilimRug(cx, cz, w, d, key, rot = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), new THREE.MeshStandardMaterial({ map: kilimTex(key), roughness: 0.95 }));
  m.position.set(cx, 0.008, cz); m.rotation.y = rot; m.receiveShadow = true; scene.add(m);
  if (w > d) { m.material.map = kilimTex(key).clone(); m.material.map.center.set(0.5, 0.5); m.material.map.rotation = Math.PI / 2; m.material.map.needsUpdate = true; }
  return m;
}
// mosaic glass for Ottoman lamps
TEX.mosaic = canvasTex(256, 128, (g, w, h) => {
  const cols = ['#d6302a', '#1fa3a8', '#e8a623', '#2a56c6', '#3f9e4a', '#c43a8c', '#f2d16b'];
  for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 * 5; x < w; x += 10) { g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.fillRect(x, y, 9, 9); }
  g.fillStyle = 'rgba(60,40,10,.9)'; for (let y = 0; y < h; y += 10) g.fillRect(0, y + 9, w, 1);
});
TEX.glow = canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,.85)'); gr.addColorStop(0.35, 'rgba(255,180,100,.35)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

// ---------- walls (fade those between camera and office) ----------
const fadeWalls = [];
function wall(x0, z0, x1, z1, center, h = WALL_H, color = 0xf7f3ec, y0 = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, WALL_T), new THREE.MeshStandardMaterial({ color, map: TEX.plaster, roughness: 0.92, transparent: true }));
  m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.castShadow = true; m.receiveShadow = true; scene.add(m);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, WALL_T + 0.04), new THREE.MeshStandardMaterial({ color: 0x8c7a68, transparent: true }));
  cap.position.y = h / 2 + 0.03; m.add(cap);
  // skirting board
  if (y0 === 0) { const sk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, WALL_T + 0.03), new THREE.MeshStandardMaterial({ color: 0x6b4a33, transparent: true })); sk.position.y = -h / 2 + 0.05; m.add(sk); }
  const mid = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const n = new THREE.Vector3(center.x - mid.x, 0, center.z - mid.z).normalize(); // inward normal
  const e = { m, cap, mid, n, len, h, extra: [] };
  fadeWalls.push(e);
  return e;
}
function windows(e, offsets, ww = 2.4, wh = 2.3, cy = 2.35) {
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfdcea, emissive: 0x9cc6dc, emissiveIntensity: 0.45, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.92 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x3e352e, roughness: 0.5, metalness: 0.4, transparent: true });
  const y = cy - e.h / 2, d = WALL_T + 0.05;
  for (const off of offsets) {
    const add = (w, h, dd, x, yy, mt) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mt); k.position.set(x, yy, 0); e.m.add(k); return k; };
    add(ww, wh, WALL_T + 0.02, off, y, glass);
    add(ww + 0.12, 0.08, d, off, y + wh / 2, frame); add(ww + 0.2, 0.08, d + 0.12, off, y - wh / 2, frame);
    add(0.08, wh, d, off - ww / 2, y, frame); add(0.08, wh, d, off + ww / 2, y, frame); add(0.05, wh, d, off, y, frame);
    add(ww, 0.05, d, off, y + wh * 0.22, frame);
  }
  e.extra.push(glass, frame);
}
function updateWallFade() {
  for (const w of fadeWalls) {
    const v = new THREE.Vector3(camera.position.x - w.mid.x, 0, camera.position.z - w.mid.z);
    const outside = v.dot(w.n) < 0; // camera is on the outer side of the wall
    const steep = polar < 0.35;
    const op = outside && !steep ? 0.07 : 1;
    w.m.material.opacity += (op - w.m.material.opacity) * 0.2;
    const o = w.m.material.opacity;
    w.cap.material.opacity = Math.max(o, 0.35);
    w.m.material.depthWrite = o > 0.9;
    w.m.castShadow = o > 0.9;
    for (const mt of w.extra) { mt.opacity = mt.userData.base != null ? mt.userData.base * o : (mt.userData.base = mt.opacity, mt.opacity * o); mt.depthWrite = o > 0.9; }
    w.m.children.forEach(c => { if (c.material && c.material !== w.cap.material && !w.extra.includes(c.material)) c.material.opacity = o; });
  }
}

// ---------- the building ----------
const GLASS = new THREE.MeshStandardMaterial({ color: 0xd6ecf2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
const FROST = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false });
const ALU = 0x2f3236, BRASS = 0xc9a14a, OAK = 0xd9c09a, WALNUT = 0x6b4a33;
let eastWall;
function buildShell() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: TEX.parquet, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0xe9e1d4));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  const C = { x: 0, z: 0 };
  const back = wall(X0, Z0, X1, Z0, C); windows(back, [-18, -12, -6, 0, 6, 12, 18]);
  eastWall = wall(X1, Z0, X1, Z1, C); windows(eastWall, [-11, -4.6, 7.5, 12]);
  const south = wall(X1, Z1, X0, Z1, C); windows(south, [-15, -9, -3, 3, 9, 15]);
  const west = wall(X0, Z1, X0, Z0, C); windows(west, [-10, -3.5, 3.5, 10]);
  // bookshelves along the west wall
  for (const z of [-13.2, -1.8, 10.5]) bookshelf(X0 + 0.32, z, Math.PI / 2);
}
function glassWall(x0, z0, x1, z1, h = 3.0, y0 = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.Group(); g.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); g.rotation.y = -Math.atan2(z1 - z0, x1 - x0); scene.add(g);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.03), GLASS); pane.position.y = h / 2; pane.renderOrder = 2; g.add(pane);
  if (y0 === 0) { const fr = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.035), FROST); fr.position.y = 1.25; fr.renderOrder = 2; g.add(fr); }
  box(len, 0.09, 0.08, ALU, 0, 0.045, 0, g); box(len, 0.07, 0.08, ALU, 0, h - 0.035, 0, g);
  const n = Math.max(1, Math.round(len / 1.3));
  for (let i = 0; i <= n; i++) box(0.05, h, 0.07, ALU, -len / 2 + i * len / n, h / 2, 0, g);
  return g;
}
function nazar(parent, x, y, z) {
  const rings = [[0.075, 0x123a8c], [0.055, 0xffffff], [0.037, 0x5fb7e8], [0.017, 0x101010]];
  rings.forEach(([r, c], i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 24), mat(c, { roughness: 0.2, metalness: 0.1 })); m.rotation.x = Math.PI / 2; m.position.set(x, y, z + i * 0.004); parent.add(m); });
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.18, 6), mat(0x8a1f1f)); s.position.set(x, y + 0.16, z); parent.add(s);
}
function arch(cx, cy, z, r, rotY = 0) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 10, 36, Math.PI), mat(WALNUT, { roughness: 0.5 }));
  t.position.set(cx, cy, z); t.rotation.y = rotY; t.castShadow = true; scene.add(t);
  // little tile keystone
  const k = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), new THREE.MeshStandardMaterial({ map: TEX.iznik, roughness: 0.3 }));
  k.position.set(cx, cy + r + 0.02, z); k.rotation.y = rotY; scene.add(k);
}
function buildCabinet() {
  const c = CAB, cc = { x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 }, dx = (c.doorX0 + c.doorX1) / 2;
  kilimRug(cc.x + 0.2, -11.6, 4.2, 3.0, 'boss', 0);
  glassWall(c.x0, c.z0, c.x0, c.z1);
  glassWall(c.x0, c.z1, c.doorX0 - 0.05, c.z1);
  glassWall(c.doorX1 + 0.05, c.z1, c.x1, c.z1);
  glassWall(c.doorX0, c.z1, c.doorX1, c.z1, 3.0 - 2.62, 2.62);
  // wooden door frame with an Ottoman arch on top
  for (const x of [c.doorX0 - 0.03, c.doorX1 + 0.03]) box(0.08, 2.15, 0.14, WALNUT, x, 1.075, c.z1);
  arch(dx, 2.15, c.z1, 0.53);
  const hinge = new THREE.Object3D(); hinge.position.set(c.doorX0, 0, c.z1); scene.add(hinge);
  box(1.0, 2.1, 0.05, 0x7a5236, 0.5, 1.05, 0, hinge);
  for (const [yy, hh] of [[0.55, 0.7], [1.5, 0.7]]) box(0.7, hh, 0.012, 0x8a6142, 0.5, yy, 0.03, hinge);
  box(0.04, 0.04, 0.14, BRASS, 0.88, 1.0, 0, hinge);
  nazar(hinge, 0.5, 1.95, 0.035);
  hinge.rotation.y = 1.15; // opened inwards
  signAt('Кабинет директора', cc.x, 3.6, c.z1, true);
  desk(cc.x + 0.3, -12.6, 0, 2.0, true);
  bookshelf(cc.x - 1.0, c.z0 + 0.3, 0); bookshelf(cc.x + 1.0, c.z0 + 0.3, 0);
  plant(c.x1 - 0.6, c.z0 + 0.6, 1.3); plant(c.x0 + 0.6, c.z1 - 0.6, 1.0);
  sofa(c.x0 + 0.6, -10.5, Math.PI / 2, 1.9, 0x5a3a28);
  ottomanLamp(cc.x + 0.3, -11.8, 2.5);
}
function buildLounge() {
  const L = LOUNGE, lc = { x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2 }, gz = (L.gapZ0 + L.gapZ1) / 2;
  kilimRug(lc.x + 0.3, lc.z + 0.2, 5.2, 7.4, 'lounge');
  const TERRA = 0xe8c9a8;
  wall(L.x0, L.z0, L.x1, L.z0, lc, 3.2, TERRA);
  wall(L.x0, L.z0, L.x0, L.gapZ0, lc, 3.2, TERRA);
  wall(L.x0, L.gapZ1, L.x0, L.z1, lc, 3.2, TERRA);
  wall(L.x0, L.gapZ0, L.x0, L.gapZ1, lc, 0.25, TERRA, 2.95);
  arch(L.x0, 2.05, gz, 0.9, Math.PI / 2);
  signAt('🛋 Комната отдыха', lc.x + 1.5, 3.4, lc.z + 1.5, true);
  plant(L.x1 - 0.5, L.z1 - 0.5, 1.2); plant(L.x0 + 0.5, L.z1 - 0.5, 0.9); plant(L.x1 - 0.5, L.z0 + 0.6, 1.0);
  // low brass tray table (sini) and floor cushions
  cyl(0.6, 0.6, 0.025, BRASS, 18, 0.36, 9.6, scene, 36).material = mat(BRASS, { metalness: 0.35, roughness: 0.35 });
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; cyl(0.03, 0.03, 0.34, WALNUT, 18 + Math.cos(a) * 0.4, 0.17, 9.6 + Math.sin(a) * 0.4, scene, 6); }
  teaGlasses(18, 0.38, 9.6, 4, 0.18);
  for (const [x, z, c] of [[16.6, 8.2, 0xb8432f], [19.6, 11.2, 0x1f6e8c], [16.4, 11.4, 0xd9a441]]) { const p = cyl(0.32, 0.34, 0.22, c, x, 0.11, z, scene, 18); p.scale.y = 1; }
  ottomanLamp(18, 9.6, 2.4); ottomanLamp(16, 12.6, 2.6); ottomanLamp(20.4, 6.6, 2.6);
}
function lathe(points, color, o = {}) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 20), mat(color, o));
  m.castShadow = true; return m;
}
function teaGlasses(x, y, z, n, r = 0.12) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, gx = x + Math.cos(a) * r, gz = z + Math.sin(a) * r;
    const saucer = cyl(0.045, 0.04, 0.008, 0xb3261e, gx, y + 0.004, gz, scene, 16); saucer.castShadow = false;
    const g = lathe([[0, 0], [0.02, 0], [0.02, 0.005], [0.011, 0.014], [0.019, 0.04], [0.024, 0.06], [0.018, 0.077], [0.022, 0.097], [0.024, 0.1]], 0xb04a17, { roughness: 0.15, metalness: 0.1 });
    g.position.set(gx, y + 0.008, gz); scene.add(g);
  }
}
function caydanlik(x, y, z) {
  const steel = { metalness: 0.4, roughness: 0.3 };
  cyl(0.12, 0.12, 0.03, 0x222222, x, y + 0.015, z, scene, 20);
  const low = lathe([[0, 0], [0.11, 0], [0.12, 0.05], [0.115, 0.13], [0.08, 0.17], [0.07, 0.18]], 0xc9ccd1, steel); low.position.set(x, y + 0.03, z); scene.add(low);
  const up = lathe([[0, 0], [0.075, 0], [0.08, 0.04], [0.075, 0.1], [0.04, 0.13], [0.012, 0.15], [0, 0.16]], 0xd9dde2, steel); up.position.set(x, y + 0.21, z); scene.add(up);
  for (const [yy, l, rr] of [[0.1, 0.13, 0.016], [0.27, 0.1, 0.011]]) { const s = cyl(rr * 0.6, rr, l, 0xc9ccd1, x - 0.12, y + yy, z, scene, 8); s.rotation.z = 0.9; }
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16, Math.PI), mat(0x333333)); h.position.set(x, y + 0.37, z); scene.add(h);
}
function buildKitchen() {
  const zc = -1.0, cx = X1 - 0.45;
  box(0.65, 0.88, 3.4, WALNUT, cx, 0.44, zc);
  box(0.7, 0.04, 3.5, 0xf1ece4, cx, 0.9, zc, scene, { roughness: 0.3 });
  // Iznik tile backsplash
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.35), new THREE.MeshStandardMaterial({ map: TEX.iznik, roughness: 0.25, transparent: true }));
  TEX.iznik.repeat.set(3.5 / 0.6, 1.35 / 0.6);
  tiles.position.set(X1 - WALL_T / 2 - 0.012, 0.92 + 0.675, zc); tiles.rotation.y = -Math.PI / 2; scene.add(tiles);
  eastWall.extra.push(tiles.material);
  // open shelf with glasses
  box(0.3, 0.04, 2.0, OAK, X1 - 0.27, 2.0, zc + 0.5);
  teaGlasses(X1 - 0.27, 2.02, zc + 0.1, 5, 0.09); teaGlasses(X1 - 0.27, 2.02, zc + 0.9, 5, 0.09);
  // espresso machine
  box(0.45, 0.42, 0.42, 0xc4c8cc, cx - 0.02, 1.13, zc - 1.1, scene, { metalness: 0.4, roughness: 0.35 });
  box(0.12, 0.06, 0.08, 0x222222, cx - 0.25, 1.05, zc - 1.1);
  caydanlik(cx - 0.05, 0.92, zc + 0.3);
  cyl(0.17, 0.17, 0.012, BRASS, cx - 0.05, 0.926, zc + 0.95, scene, 28).material = mat(BRASS, { metalness: 0.35, roughness: 0.35 });
  teaGlasses(cx - 0.05, 0.932, zc + 0.95, 5, 0.1);
  signAt('🫖 Чайный уголок · Çay', cx - 0.8, 2.75, zc);
  // bistro table and stools
  cyl(0.38, 0.38, 0.03, 0xf1ece4, 19.6, 1.04, zc, scene, 28); cyl(0.04, 0.04, 1.02, ALU, 19.6, 0.51, zc, scene, 8); cyl(0.25, 0.25, 0.02, ALU, 19.6, 0.01, zc, scene, 16);
  teaGlasses(19.6, 1.055, zc, 2, 0.12);
  for (const dz of [-0.75, 0.75]) { cyl(0.18, 0.18, 0.06, 0x1f6e8c, 19.6, 0.78, zc + dz, scene, 16); cyl(0.025, 0.025, 0.75, ALU, 19.6, 0.38, zc + dz, scene, 6); }
  kilimRug(20.2, zc, 1.6, 3.0, 'home');
  plant(X1 - 0.5, 1.6, 1.1);
  ottomanLamp(20.6, zc, 2.5);
}

// ---------- furniture ----------
function desk(x, z, rotY, width = 1.4, boss = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const dd = boss ? 0.9 : 0.75;
  box(width, 0.035, dd, boss ? WALNUT : 0xece3d4, 0, 0.74, 0, g, { roughness: 0.45 });
  for (const sx of [-1, 1]) { box(0.04, 0.72, 0.04, 0x222326, sx * (width / 2 - 0.06), 0.36, -dd / 2 + 0.06, g); box(0.04, 0.72, 0.04, 0x222326, sx * (width / 2 - 0.06), 0.36, dd / 2 - 0.06, g); box(0.04, 0.04, dd - 0.1, 0x222326, sx * (width / 2 - 0.06), 0.06, 0, g); }
  if (boss) box(width - 0.1, 0.6, 0.03, 0x5a3d2a, 0, 0.42, -dd / 2 + 0.05, g);
  else box(width, 0.38, 0.03, 0x8fa39a, 0, 0.95, -dd / 2 + 0.01, g, { roughness: 1 }); // acoustic felt screen
  // monitor
  box(0.6, 0.36, 0.025, 0x16181b, 0, 1.06, -0.2, g);
  const scr = box(0.56, 0.32, 0.005, 0x2b4a66, 0, 1.06, -0.186, g, { emissive: 0x3a6fa0, emissiveIntensity: 0.55, roughness: 0.2 }); scr.castShadow = false;
  box(0.05, 0.16, 0.05, 0x2a2a2a, 0, 0.84, -0.22, g); box(0.22, 0.012, 0.16, 0x2a2a2a, 0, 0.762, -0.22, g);
  box(0.44, 0.015, 0.14, 0xe8e8e8, 0, 0.765, 0.08, g); box(0.06, 0.02, 0.1, 0xe8e8e8, 0.32, 0.765, 0.1, g);
  if (boss) { cyl(0.04, 0.035, 0.1, 0xb3261e, 0.7, 0.81, -0.1, g, 12); nazarDesk(g); }
  else { const h = hash(x + ',' + z); if (h % 3 === 0) cyl(0.045, 0.04, 0.1, 0xffffff, 0.52, 0.81, 0.05, g, 12); else { cyl(0.05, 0.04, 0.08, 0xb9714d, 0.52, 0.8, -0.15, g, 10); const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(0x5f8f5a)); l.position.set(0.52, 0.9, -0.15); g.add(l); } }
  chair(0, 0.62, g, boss ? 0x3a2a20 : 0x34383e);
  return g;
}
function nazarDesk(g) { const m = new THREE.Group(); m.position.set(-0.7, 0.77, 0.1); g.add(m); nazar(m, 0, 0.06, 0); m.rotation.x = -0.4; }
function chair(x, z, parent, color = 0x47505a, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; parent.add(g);
  box(0.48, 0.07, 0.46, color, 0, 0.46, 0, g, { roughness: 0.95 });
  box(0.44, 0.52, 0.06, color, 0, 0.78, 0.22, g, { roughness: 0.95 });
  box(0.04, 0.3, 0.04, 0x222222, 0, 0.58, 0.24, g);
  cyl(0.025, 0.025, 0.38, 0x777777, 0, 0.23, 0, g, 8);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const leg = box(0.28, 0.03, 0.04, 0x222222, Math.cos(a) * 0.13, 0.05, Math.sin(a) * 0.13, g); leg.rotation.y = -a; leg.castShadow = false; }
  return g;
}
function plant(x, z, s = 1) {
  const pot = lathe([[0, 0], [0.16, 0], [0.2, 0.36], [0.21, 0.4], [0, 0.4]].map(([r, y]) => [r * s, y * s]), 0x2f6e8c, { roughness: 0.35 });
  pot.position.set(x, 0, z); scene.add(pot);
  cyl(0.02 * s, 0.025 * s, 0.7 * s, 0x5a4030, x, 0.7 * s, z, scene, 6);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, hgt = (0.55 + (i % 5) * 0.15) * s;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), mat(i % 2 ? 0x4f8a4a : 0x3f7a3e));
    leaf.scale.set(1, 0.35, 0.6); leaf.position.set(x + Math.cos(a) * 0.15 * s, hgt + 0.3 * s, z + Math.sin(a) * 0.15 * s);
    leaf.rotation.set(rnd(-0.6, 0.6), a, rnd(-0.5, 0.5)); leaf.castShadow = true; scene.add(leaf);
  }
}
function bookshelf(x, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const w = 1.6, h = 2.0, d = 0.34;
  for (const sx of [-1, 1]) box(0.03, h, d, WALNUT, sx * w / 2, h / 2, 0, g);
  for (let i = 0; i <= 4; i++) box(w, 0.03, d, WALNUT, 0, 0.05 + i * (h - 0.08) / 4, 0, g);
  const cols = [0x8f2f2a, 0x1f3d6b, 0xd9a441, 0x2f6e6a, 0xe8dcc8, 0x5b3d73, 0x3a3a3a];
  for (let i = 0; i < 4; i++) {
    let bx = -w / 2 + 0.06; const y0 = 0.065 + i * (h - 0.08) / 4;
    while (bx < w / 2 - 0.2) {
      if (Math.random() < 0.12) { const v = cyl(0.06, 0.05, 0.2, Math.random() < .5 ? 0x2fa3a0 : 0x1f4fa3, bx + 0.08, y0 + 0.1, 0, g, 12); bx += 0.2; continue; }
      const bw = rnd(0.03, 0.06), bh = rnd(0.22, 0.34);
      box(bw, bh, rnd(0.2, 0.26), cols[Math.floor(Math.random() * cols.length)], bx, y0 + bh / 2, 0.02, g).castShadow = false; bx += bw + 0.004;
    }
  }
  return g;
}
function sofa(x, z, rotY, len = 2.2, color = 0x7d8f9e) { // backrest at local -z, people face local +z
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  box(len, 0.3, 0.85, color, 0, 0.27, 0, g, { roughness: 0.6 });
  box(len - 0.1, 0.12, 0.7, color, 0, 0.47, 0.05, g, { roughness: 0.6 });
  box(len, 0.55, 0.2, color, 0, 0.62, -0.33, g, { roughness: 0.6 });
  for (const s of [-1, 1]) box(0.18, 0.62, 0.85, color, s * (len / 2 + 0.09), 0.31, 0, g, { roughness: 0.6 });
  for (const s of [-1, 1]) cyl(0.025, 0.02, 0.12, 0x222222, s * len / 2, 0.06, 0.3, g, 6);
  return g;
}
const CUSH = [0xb8432f, 0x1f6e8c, 0xd9a441, 0x2f7a5a, 0x7a2f5a];
function sedir(x, z, rotY, len = 3) { // low Turkish divan: back at local -z
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  box(len, 0.32, 0.82, WALNUT, 0, 0.16, 0, g, { roughness: 0.6 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.8), new THREE.MeshStandardMaterial({ map: kilimTex('lounge'), roughness: 0.95 }));
  top.position.set(0, 0.39, 0.01); top.castShadow = top.receiveShadow = true; g.add(top);
  const n = Math.round(len / 0.75);
  for (let i = 0; i < n; i++) { const c = box(len / n - 0.06, 0.45, 0.16, CUSH[(i + Math.round(x)) % CUSH.length], -len / 2 + (i + 0.5) * len / n, 0.66, -0.3, g, { roughness: 0.9 }); c.rotation.x = -0.18; }
  return g;
}
function ottomanLamp(x, z, y = 2.5) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  cyl(0.004, 0.004, WALL_H + 0.3 - y, 0x222222, 0, (WALL_H + 0.3 + y) / 2, 0, g, 4).castShadow = false;
  const glassM = new THREE.MeshStandardMaterial({ map: TEX.mosaic, emissiveMap: TEX.mosaic, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 });
  [[0, 0, 0.17], [0.2, -0.28, 0.12], [-0.17, -0.18, 0.11]].forEach(([dx, dy, r], i) => {
    const yy = y + dy;
    if (i) cyl(0.003, 0.003, -dy + 0.05, 0x222222, dx, y - (dy) / 2 - 0.02, 0, g, 4).castShadow = false;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), glassM); b.position.set(dx, yy, 0); b.scale.y = 1.15; g.add(b);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, r * 0.5, 12), mat(BRASS, { metalness: 0.4, roughness: 0.35 })); cap.position.set(dx, yy + r * 1.2, 0); g.add(cap);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    sp.position.set(dx, yy, 0); sp.scale.set(r * 7, r * 7, 1); g.add(sp);
  });
  return g;
}
function roundTable(x, z, seats) {
  cyl(0.95, 0.95, 0.05, 0xece3d4, x, 0.75, z, scene, 48).material = mat(OAK, { roughness: 0.4 });
  cyl(0.08, 0.08, 0.72, 0x2a2a2a, x, 0.37, z, scene, 12);
  cyl(0.42, 0.45, 0.04, 0x2a2a2a, x, 0.02, z, scene, 24);
  kilimRug(x, z, 3.6, 3.6 * 1.3, Object.keys(KILIM)[hash(seats.join()) % 8]);
  teaGlasses(x, 0.776, z, Math.min(seats.length, 4), 0.35);
  caydanlik(x, 0.776, z);
  ottomanLamp(x, z, 2.35);
  const pos = [];
  seats.forEach((s, i) => {
    const a = (i / seats.length) * Math.PI * 2 + Math.PI / 2;
    const cx = x + Math.cos(a) * 1.3, cz = z + Math.sin(a) * 1.3;
    const rot = Math.atan2(x - cx, z - cz) + Math.PI;
    chair(cx, cz, scene, 0x8e5f4e, rot);
    pos.push({ x: cx, z: cz, rot: Math.atan2(x - cx, z - cz), kind: 'chair', name: s });
  });
  return pos;
}
function bench(x, z, n) { // faces -z, its back against the lounge wall
  const len = Math.max(2.4, n * 0.62 + 0.3);
  const g = new THREE.Group(); g.position.set(x + len / 2, 0, z); scene.add(g);
  box(len, 0.05, 0.45, 0xb98a5a, 0, 0.45, 0, g);
  const top = new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, 0.05, 0.4), new THREE.MeshStandardMaterial({ map: kilimTex('content'), roughness: 0.95 }));
  top.position.set(0, 0.49, 0); g.add(top);
  box(len, 0.32, 0.04, 0xb98a5a, 0, 0.72, 0.22, g);
  for (const s of [-1, 1]) box(0.06, 0.45, 0.42, 0x5a4a3c, s * (len / 2 - 0.1), 0.22, 0, g);
  signAt('🪑 Ждут тебя', x + len / 2, 3.0, z + 0.3, true);
  const seats = [];
  for (let i = 0; i < n; i++) seats.push({ x: x + 0.45 + i * 0.62, z: z - 0.02, rot: Math.PI, kind: 'bench' });
  return seats;
}

// ---------- people ----------
const SKIN = [0xf1c8a5, 0xe0ac85, 0xc98f68, 0xf6d2b4, 0xd9a07a];
const HAIR = [0x2a1f1a, 0x4a3326, 0x161616, 0x6a3f22, 0x8a5a36];
const SHIRT = [0xc94f45, 0x3f78b8, 0x4f9572, 0xd99a33, 0x8a5fb8, 0x2f7f8c, 0xb84f80, 0x5e6c7a, 0xd8703f, 0x6f8a36, 0xe8dcc8, 0x1f3d6b];
const JACKET = [0x2b2f36, 0x4a3b30, 0x1f3d6b, 0x6b6f75, 0x7a2f2a];
function limb(len, r, color) {
  const pivot = new THREE.Object3D();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10), mat(color, { roughness: 0.85 }));
  m.position.y = -len / 2; m.castShadow = true; pivot.add(m);
  return pivot;
}
function makePerson(bot) {
  const h = hash(bot.name);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 3) % HAIR.length];
  const shirt = bot.main ? 0xf3efe8 : SHIRT[(h >>> 6) % SHIRT.length];
  const hasJacket = bot.main || (h >>> 12) % 3 === 0, jacket = bot.main ? 0x1c1c1f : JACKET[(h >>> 14) % JACKET.length];
  const pants = bot.main ? 0x1c1c1f : [0x2f3640, 0x4a4036, 0x30405a, 0xcbbd9e, 0x3a3a3a][(h >>> 9) % 5];
  const shoes = [0x2a2a2a, 0x5a3a24, 0xe8e4dc][(h >>> 17) % 3];
  const root = new THREE.Group();
  const hips = new THREE.Object3D(); hips.position.y = 0.92; root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.06, 4, 10), mat(pants)); pelvis.scale.z = 0.75; pelvis.position.y = 0.02; pelvis.castShadow = true; hips.add(pelvis);
  const legs = [-1, 1].map(s => {
    const thigh = limb(0.46, 0.078, pants); thigh.position.set(s * 0.095, 0, 0); hips.add(thigh);
    const shin = limb(0.46, 0.062, pants); shin.position.y = -0.46; thigh.add(shin);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), mat(shoes, { roughness: 0.5 })); shoe.rotation.x = Math.PI / 2; shoe.position.set(0, -0.44, 0.05); shoe.castShadow = true; shin.add(shoe);
    return { thigh, shin };
  });
  const torso = new THREE.Object3D(); hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.165, 0.3, 4, 14), mat(shirt, { roughness: 0.85 }));
  body.scale.set(1, 1, 0.68); body.position.y = 0.3; body.castShadow = true; torso.add(body);
  if (hasJacket) {
    for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 10), mat(jacket, { roughness: 0.8 })); j.scale.set(1, 1, 0.8); j.position.set(s * 0.09, 0.3, -0.01); j.castShadow = true; torso.add(j); }
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.04, 16), mat(0x2a221c)); belt.scale.z = 0.7; belt.position.y = 0.07; torso.add(belt);
  const neck = new THREE.Object3D(); neck.position.y = 0.6; torso.add(neck);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), mat(skin)); nk.position.y = 0.0; neck.add(nk);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), mat(skin, { roughness: 0.7 })); head.scale.set(0.92, 1.08, 1); head.position.y = 0.13; head.castShadow = true; neck.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.118, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair, { roughness: 0.6 })); hairM.position.y = 0.15; hairM.rotation.x = -0.3; neck.add(hairM);
  const style = (h >>> 20) % 3;
  if (style === 0) { const long = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 10), mat(hair, { roughness: 0.6 })); long.scale.z = 0.5; long.position.set(0, 0.04, -0.08); neck.add(long); }
  else if (style === 1) { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), mat(hair)); bun.position.set(0, 0.24, -0.08); neck.add(bun); }
  // eyes for close-ups
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), mat(0x1a1a1a)); e.position.set(s * 0.038, 0.14, 0.098); neck.add(e); }
  const sleeve = hasJacket ? jacket : shirt;
  const arms = [-1, 1].map(s => {
    const up = limb(0.3, 0.05, sleeve); up.position.set(s * 0.215, 0.5, 0); torso.add(up);
    const fo = limb(0.27, 0.042, (h >>> 22) % 2 && !hasJacket ? skin : sleeve); fo.position.y = -0.3; up.add(fo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), mat(skin)); hand.scale.set(0.8, 1.1, 0.6); hand.position.y = -0.3; fo.add(hand);
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
function burst({ f = 3000, q = 1, dur = 0.03, vol = 0.05, type = 'bandpass', attack = 0.002, at = 0, pan = 0, dest = null, when = null }) {
  const { ctx, master, noise } = audio; if (!ctx) return;
  const t0 = when ?? ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const out = dest || master;
  src.connect(fl); fl.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
  src.start(t0, Math.random() * 1.5); src.stop(t0 + attack + dur + 0.05);
}
const sfx = {
  key(pan) { burst({ f: 2400 + Math.random() * 2200, q: 2.5, dur: 0.025 + Math.random() * 0.02, vol: 0.035 + Math.random() * 0.02, pan }); },
  step(pan) { burst({ f: 180 + Math.random() * 60, q: 0.9, dur: 0.07, vol: 0.09, type: 'lowpass', pan }); burst({ f: 1200, q: 1, dur: 0.02, vol: 0.012, pan }); },
  coffee() {
    for (let i = 0; i < 26; i++) burst({ f: 700 + Math.random() * 500, q: 3, dur: 0.09, vol: 0.022, at: i * 0.09, pan: 0.6 });
    burst({ f: 5200, q: 0.7, dur: 2.2, vol: 0.018, attack: 0.4, at: 3.0, type: 'highpass', pan: 0.6 });
    for (let i = 0; i < 6; i++) burst({ f: 900, q: 6, dur: 0.06, vol: 0.02, at: 5.8 + i * 0.35, pan: 0.6 });
  },
  clink() { // tea spoon in a tulip glass
    const { ctx, master } = audio; if (!ctx) return;
    for (let i = 0; i < 3; i++) { const t0 = ctx.currentTime + i * 0.18 + Math.random() * 0.05; const o = ctx.createOscillator(); o.frequency.value = 3100 + Math.random() * 500; const g = ctx.createGain(); g.gain.setValueAtTime(0.012, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.4); }
  },
  snore(pan) { burst({ f: 260, q: 1.5, dur: 1.1, vol: 0.022, attack: 0.7, type: 'lowpass', pan }); burst({ f: 900, q: 0.7, dur: 1.0, vol: 0.006, attack: 0.5, at: 1.9, pan }); },
};

// ---------- Turkish background music: synthesized, so it is free of any copyright ----------
// Gentle Hijaz makam phrases on an oud/saz-like plucked string (Karplus-Strong) over a soft darbuka "maqsum".
const music = { on: false, out: null, next: 0, step: 0, phrase: 0, note: 0, noteLeft: 0, timer: null, cache: {} };
const D4 = 293.66, EIGHTH = 60 / 84 / 2;
const PHRASES = [ // [semitones above D4, length in eighths]; Hijaz on D: D Eb F# G A Bb C D
  [[7, 2], [8, 1], [7, 1], [5, 2], [4, 2], [5, 1], [4, 1], [1, 1], [4, 1], [0, 4]],
  [[0, 1], [1, 1], [4, 1], [5, 1], [7, 2], [8, 2], [10, 1], [8, 1], [7, 1], [5, 1], [7, 4]],
  [[12, 2], [10, 1], [8, 1], [7, 2], [8, 1], [7, 1], [5, 1], [4, 1], [5, 1], [7, 1], [4, 2], [1, 2]],
  [[4, 1], [5, 1], [4, 1], [1, 1], [0, 2], [-2, 1], [0, 1], [1, 2], [4, 1], [1, 1], [0, 4]],
  [[null, 4], [7, 1], [5, 1], [4, 1], [5, 1], [7, 2], [null, 2], [8, 1], [7, 1], [5, 2]],
  [[4, 2], [1, 1], [0, 1], [1, 2], [4, 1], [5, 1], [4, 2], [1, 2], [0, 4]],
];
const MAQSUM = ['D', 'T', '', 'T', 'D', '', 'T', 'k']; // 8 eighths
function pluckBuffer(freq) {
  const key = Math.round(freq * 10); if (music.cache[key]) return music.cache[key];
  const ctx = audio.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 1.8), N = Math.max(2, Math.round(sr / freq));
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (i < N * 0.5 ? 1 : 0.6);
  let prev = 0;
  for (let i = 0; i < len; i++) { const j = i % N, nx = (j + 1) % N; const v = 0.4985 * (ring[j] + ring[nx]); ring[j] = v; d[i] = v * 0.7 + prev * 0.3; prev = v; }
  return (music.cache[key] = buf);
}
function pluck(semi, t, vol = 0.22, oct = 0) {
  const ctx = audio.ctx, f = D4 * Math.pow(2, semi / 12 + oct);
  const src = ctx.createBufferSource(); src.buffer = pluckBuffer(f);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.8;
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 5; body.Q.value = 1.2;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  src.connect(lp); lp.connect(body); body.connect(g); g.connect(music.out); src.start(t); src.stop(t + 1.7);
}
function drum(kind, t) {
  const ctx = audio.ctx;
  if (kind === 'D') { // doum: low skin
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(music.out); o.start(t); o.stop(t + 0.4);
  } else { // tek / ka: rim
    burst({ f: kind === 'T' ? 3800 : 2800, q: 1.8, dur: kind === 'T' ? 0.05 : 0.03, vol: kind === 'T' ? 0.11 : 0.05, dest: music.out, when: t });
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = kind === 'T' ? 720 : 640;
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(g); g.connect(music.out); o.start(t); o.stop(t + 0.08);
  }
}
function musicTick() {
  const ctx = audio.ctx;
  while (music.next < ctx.currentTime + 0.25) {
    const t = music.next, s = music.step;
    // darbuka joins after 2 bars, light ghost notes on some bars
    if (s >= 16) { const k = MAQSUM[s % 8]; if (k) drum(k, t); else if ((s >> 3) % 4 === 3 && Math.random() < 0.5) drum('k', t); }
    // bass pluck on the downbeat of every bar
    if (s % 8 === 0) pluck(0, t, 0.16, -2);
    // melody
    if (music.noteLeft <= 0) {
      const ph = PHRASES[music.phrase];
      const [semi, len] = ph[music.note];
      music.noteLeft = len;
      if (semi != null) {
        pluck(semi, t, 0.2, -1 + (music.phrase % 3 === 2 ? 0 : 0));
        if (len >= 4) for (let r = 1; r < len * 2; r++) pluck(semi, t + r * EIGHTH / 2, 0.07, -1); // oud tremolo (risha)
      }
      music.note++;
      if (music.note >= ph.length) { music.note = 0; music.phrase = (music.phrase + 1) % PHRASES.length; }
    }
    music.noteLeft--; music.step++; music.next += EIGHTH * (s % 2 ? 0.96 : 1.04); // slight swing
  }
}
function setMusic(on) {
  if (!audio.ctx) initAudio();
  const ctx = audio.ctx;
  if (!music.out) {
    music.out = ctx.createGain(); music.out.gain.value = 0;
    const verb = ctx.createConvolver(), ir = ctx.createBuffer(2, ctx.sampleRate * 1.6, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.22;
    music.out.connect(ctx.destination); music.out.connect(verb); verb.connect(wet); wet.connect(ctx.destination);
  }
  music.on = on;
  if (on) {
    ctx.resume(); music.next = ctx.currentTime + 0.1; music.step = 0; music.phrase = 0; music.note = 0; music.noteLeft = 0;
    music.out.gain.cancelScheduledValues(ctx.currentTime); music.out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    clearInterval(music.timer); music.timer = setInterval(musicTick, 60);
  } else {
    music.out.gain.cancelScheduledValues(ctx.currentTime); music.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    setTimeout(() => { if (!music.on) clearInterval(music.timer); }, 700);
  }
  syncCtx();
}
function syncCtx() { if (!audio.ctx) return; if (audio.on || music.on) audio.ctx.resume(); else setTimeout(() => { if (!audio.on && !music.on) audio.ctx.suspend(); }, 800); }
const sndBtn = document.getElementById('snd');
sndBtn.onclick = () => {
  if (!audio.ctx) initAudio();
  audio.on = !audio.on; syncCtx();
  sndBtn.textContent = audio.on ? '🔊' : '🔇'; sndBtn.classList.toggle('on', audio.on);
};
const musBtn = document.getElementById('mus');
musBtn.onclick = () => { setMusic(!music.on); musBtn.classList.toggle('on', music.on); musBtn.setAttribute('aria-pressed', music.on); };
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
    const zoneFloor = box(cw - 0.6, 0.006, ch - 0.6, ZONE_COLORS[zk] || 0xe8e2d8, cx, 0.004, cz, scene, { transparent: true, opacity: 0.28 }); zoneFloor.castShadow = false;
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
    if (deskers.length) {
      const nc = Math.min(cols, deskers.length), nr = Math.ceil(deskers.length / cols);
      const rx = deskArea.x0 + 1.0 + (nc - 1) * 1.05, rz = z0 + 2.6 + (nr - 1) * 1.35 + 0.3;
      kilimRug(rx, rz, nc * 2.1 + 0.4, nr * 2.7 + 0.2, zk);
      ottomanLamp(rx, rz, 2.6);
    }
    plant(x0 + cw - 0.8, z0 + ch - 0.8, 0.9 + (idx % 3) * 0.15);
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
  sedir(16.2, L.z1 - 0.62, Math.PI, 3.0); sedir(L.x1 - 0.62, 9.5, -Math.PI / 2, 3.0); sedir(16.2, L.z0 + 0.82, 0, 3.0);
  for (let i = 0; i < 3; i++) loungeSeats.push({ x: 15.3 + i * 0.9, z: L.z1 - 0.75, rot: Math.PI, kind: 'sofa' });
  for (let i = 0; i < 3; i++) loungeSeats.push({ x: L.x1 - 0.75, z: 8.6 + i * 0.9, rot: -Math.PI / 2, kind: 'sofa' });
  for (let i = 0; i < 3; i++) loungeSeats.push({ x: 15.3 + i * 0.9, z: L.z0 + 0.95, rot: 0, kind: 'sofa' });
  for (let i = 9; i < 30; i++) loungeSeats.push({ x: 15.2 + (i % 4) * 1.1, z: 6.2 + Math.floor(i / 4) * 1.0, rot: Math.PI / 2, kind: 'stand' });
  waiting.forEach((b, i) => { seat[b.name] = benchSeats[i]; });
  resting.forEach((b, i) => { seat[b.name] = loungeSeats[i]; });

  for (const b of bots) {
    const s = seat[b.name] || { x: 0, z: 0, rot: 0, kind: 'stand' };
    const obj = makePerson(b); obj.userData.dynamic = true; obj.position.set(s.x, 0, s.z); obj.rotation.y = s.rot; scene.add(obj);
    const st = b.active ? '<span class="st bulb">💡</span>' : '';
    const zz = b.sleeping ? '<span class="zz">Zz</span>' : '';
    const lbl = label(`${st}<span>${esc(b.name)}</span>${zz}`, 'lbl' + (b.main ? ' main' : '') + (b.sleeping ? ' sleep' : ''), obj, 2.05);
    const p = { bot: b, obj, home: s, state: 'seated', path: null, timer: 4 + Math.random() * 18, phase: Math.random() * 10, lbl, stepAcc: 0 };
    people.push(p);
  }
  mergeStatic();
  // stats
  const act = bots.filter(b => b.active).length, sl = bots.filter(b => b.sleeping && !b.lounge).length;
  document.getElementById('stats').innerHTML =
    `<span class="chip">👥 ${bots.length} ботов</span><span class="chip">💡 ${act} активны</span><span class="chip">Zz ${sl} спят</span>` +
    `<span class="chip">🪑 ${waiting.length} ждут тебя</span><span class="chip">🛋 ${resting.length} на отдыхе</span>`;
  const t = new Date(data.generatedAt).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  document.getElementById('updated').textContent = `Последние изменения: ${t} (Алматы) · 💡 активен ≤30 мин · Zz спит >3 ч`;
}

// ---------- merge static furniture into a few draw calls (keeps phones cool) ----------
function mergeStatic() {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.userData.dynamic) return;
    if (o.material.transparent || Array.isArray(o.material)) return;
    const key = o.material.uuid + '|' + (o.castShadow ? 1 : 0);
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    groups.get(key).list.push(o);
  });
  let merged = 0;
  for (const g of groups.values()) {
    if (g.list.length < 2) continue;
    const geos = g.list.map(o => {
      const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
      if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
      gg.morphAttributes = {};
      return gg.applyMatrix4(o.matrixWorld);
    });
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, g.mat); m.castShadow = g.cast; m.receiveShadow = true; scene.add(m);
    for (const o of g.list) o.parent.remove(o);
    merged += g.list.length;
  }
  return merged;
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
  if ((coffeeT -= dt) <= 0) { if (Math.random() < 0.5) sfx.coffee(); else sfx.clink(); coffeeT = 50 + Math.random() * 70; }
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
  window.__info = () => ({ ...renderer.info.render, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
  window.__ready = true;
}
start();
