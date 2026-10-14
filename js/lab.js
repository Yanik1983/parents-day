// מעבדת ה־EP בתלת־ממד: החדר, המיטה והמטופל, מכשיר הרנטגן, המסכים, העגלות וחדר הבקרה.
// הכול בנוי בקוד, בלי קבצי מודלים. היחידות הן מטרים: x ימינה, y למעלה, z לכיוון הצופה.
// הקיר האחורי ב־z = -3.5, ומאחוריו חדר הבקרה. החזית פתוחה, כמו בבית בובות.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const FONT = 'Rubik, "Segoe UI", Arial, sans-serif';

// ---------- עזרים ----------

// קופסה עם פינות מעוגלות
function rbox(w, h, d, r = 0.02) {
  r = Math.min(r, w / 2 * 0.98, h / 2 * 0.98, d / 2 * 0.98);
  const iw = w - 2 * r, ih = h - 2 * r, e = 1e-3;
  const x0 = -iw / 2, y0 = -ih / 2, x1 = iw / 2, y1 = ih / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + e, y0);
  s.lineTo(x1 - e, y0); s.quadraticCurveTo(x1, y0, x1, y0 + e);
  s.lineTo(x1, y1 - e); s.quadraticCurveTo(x1, y1, x1 - e, y1);
  s.lineTo(x0 + e, y1); s.quadraticCurveTo(x0, y1, x0, y1 - e);
  s.lineTo(x0, y0 + e); s.quadraticCurveTo(x0, y0, x0 + e, y0);
  let g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(1e-4, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 4,
  });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  return g;
}

const mat = (color, roughness = 0.6, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function add(parent, geo, material, pos = [0, 0, 0], rot = null, scale = null) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  parent.add(m);
  return m;
}

function group(parent, pos = [0, 0, 0], rotY = 0) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData = { ctx, w, h, draw };
  return tex;
}

function redraw(tex, ...args) {
  const { ctx, w, h, draw } = tex.userData;
  draw(ctx, w, h, ...args);
  tex.needsUpdate = true;
}

// מסך: מסגרת מעוגלת + תמונה מאירה
function screen(parent, w, h, texture, pos, rotY = 0, frame = '#2a2f3a') {
  const g = group(parent, pos, rotY);
  add(g, rbox(w + 0.06, h + 0.06, 0.045, 0.015), mat(frame, 0.45, 0.3));
  const face = add(g, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }), [0, 0, 0.024]);
  face.userData.noShadow = true;
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- אותות הלב ----------
// פעימה סינתטית: גל P קטן, QRS חד וגל T. phase בין 0 ל־1.
function beat(phase) {
  const g = (c, w, a) => a * Math.exp(-((phase - c) ** 2) / (2 * w * w));
  return g(0.12, 0.025, 0.12) - g(0.27, 0.008, 0.12) + g(0.3, 0.01, 1) - g(0.33, 0.01, 0.25) + g(0.55, 0.045, 0.28);
}
// פרפור: רעד לא סדיר
function fib(t, seed) {
  return 0.22 * Math.sin(t * 37 + seed) + 0.16 * Math.sin(t * 53.3 + seed * 2.1) + 0.12 * Math.sin(t * 71.7 + seed * 0.7) + 0.08 * Math.sin(t * 23.1 + seed * 3);
}

function drawTraces(ctx, w, h, t, channels) {
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(80,110,160,0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const rowH = h / channels.length;
  channels.forEach((ch, i) => {
    const mid = rowH * (i + 0.62);
    ctx.fillStyle = ch.color;
    ctx.font = `600 ${Math.round(rowH * 0.28)}px ${FONT}`;
    ctx.fillText(ch.name, 8, mid - rowH * 0.3);
    ctx.strokeStyle = ch.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const tt = t - (w - x) / w * 2.4 + ch.delay;
      const v = ch.fib ? fib(tt, i * 1.7) : beat(((tt / 0.85) % 1 + 1) % 1);
      const y = mid - v * rowH * 0.42 * ch.gain;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
}

const TRACES_A = [
  { name: 'I', color: '#4de2c5', delay: 0, gain: 1 },
  { name: 'II', color: '#4de2c5', delay: 0.01, gain: 1.15 },
  { name: 'V1', color: '#ffd166', delay: 0.02, gain: 0.8 },
  { name: 'CS 1-2', color: '#ff6b8a', delay: 0, gain: 1, fib: true },
];
const TRACES_B = [
  { name: 'MAP d', color: '#7aa8ff', delay: 0.05, gain: 1.2 },
  { name: 'MAP p', color: '#7aa8ff', delay: 0.07, gain: 0.9 },
  { name: 'HIS', color: '#c59bff', delay: 0.04, gain: 0.7 },
  { name: 'RV', color: '#ffb52e', delay: 0.12, gain: 1 },
];

// ---------- הלב ----------
// כדור שמעוצב ללב: מתחדד לקודקוד למטה, עם שקע קטן בין שני "הפרוזדורים" למעלה, ומוטה הצידה.
function heartGeometry(seg = 72) {
  let g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const tilt = new THREE.Matrix4().makeRotationZ(-0.45).multiply(new THREE.Matrix4().makeRotationX(0.25));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (1 - v.y) / 2; // 0 למעלה, 1 בקודקוד
    const taper = 1 - 0.72 * Math.pow(t, 1.7);
    v.x *= taper;
    v.z *= taper * 0.82;
    v.y *= 1.18;
    if (v.y > 0) v.y -= 0.32 * v.y * Math.exp(-(v.x * v.x) / 0.06) * (v.z > -0.2 ? 1 : 0.4);
    v.x += 0.08 * Math.sin(v.y * 2.4); // קצת אי־סימטריה
    v.applyMatrix4(tilt);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

// לב "אנטומי" קטן: שריר + כלי דם
function anatomicalHeart() {
  const g = new THREE.Group();
  const muscle = new THREE.MeshPhysicalMaterial({
    color: '#c8323f', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.5, sheenColor: new THREE.Color('#ff9aa5'),
    emissive: new THREE.Color('#ff1e3c'), emissiveIntensity: 0.15,
  });
  const heart = add(g, heartGeometry(64), muscle);
  const aorta = mat('#d9475a', 0.45, 0, { emissive: '#ff1e3c', emissiveIntensity: 0.1 });
  const vein = mat('#4a6fd1', 0.45, 0, { emissive: '#2040ff', emissiveIntensity: 0.08 });
  add(g, new THREE.TorusGeometry(0.42, 0.13, 16, 40, Math.PI * 1.15), aorta, [0.05, 1.05, -0.05], [0, 0.4, -0.2]);
  add(g, new THREE.CylinderGeometry(0.15, 0.17, 0.6, 20), aorta, [0.05, 0.85, 0.05]);
  add(g, new THREE.CylinderGeometry(0.13, 0.15, 0.5, 20), vein, [-0.25, 0.95, 0.25], [0.25, 0, 0.35]);
  add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.55, 20), vein, [0.45, 0.9, -0.1], [0, 0, -0.15]);
  return { group: g, muscle, heart };
}

// מפת ההפעלה (כמו ב־CARTO): צבע לפי הזמן שבו האות החשמלי מגיע לכל נקודה,
// ופס לבן שעובר על הלב ומראה את ההתפשטות.
function activationHeart() {
  const geo = heartGeometry(96);
  const p = geo.attributes.position;
  const n = p.count;
  const source = new THREE.Vector3(0.55, 0.75, 0.35); // "קוצב הלב הטבעי"
  const act = new Float32Array(n);
  const v = new THREE.Vector3();
  let max = 0;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    act[i] = v.distanceTo(source) + 0.12 * Math.sin(v.x * 5 + v.z * 3);
    max = Math.max(max, act[i]);
  }
  const base = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    act[i] /= max;
    c.setHSL(act[i] * 0.78, 0.95, 0.52);
    base.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(base.slice(), 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, material);

  // נקודות האבלציה (כדורים אדומים קטנים) לאורך קו על הלב
  const dots = new THREE.Group();
  const dotMat = mat('#ff2b2b', 0.4, 0, { emissive: '#ff0000', emissiveIntensity: 0.6 });
  const ray = new THREE.Raycaster();
  for (let k = 0; k < 9; k++) {
    const a = -0.9 + k * 0.17;
    const dir = new THREE.Vector3(Math.sin(a) * 0.9, 0.35 - k * 0.03, Math.cos(a)).normalize();
    ray.set(dir.clone().multiplyScalar(3), dir.clone().negate());
    const hit = ray.intersectObject(mesh)[0];
    if (hit) add(dots, new THREE.SphereGeometry(0.045, 12, 10), dotMat, hit.point.toArray());
  }
  mesh.add(dots);

  const colors = geo.attributes.color;
  function update(t) {
    const front = (t * 0.55) % 1.35 - 0.15;
    for (let i = 0; i < n; i++) {
      const w = Math.exp(-(((act[i] - front) / 0.045) ** 2));
      colors.array[i * 3] = base[i * 3] + (1 - base[i * 3]) * w;
      colors.array[i * 3 + 1] = base[i * 3 + 1] + (1 - base[i * 3 + 1]) * w;
      colors.array[i * 3 + 2] = base[i * 3 + 2] + (1 - base[i * 3 + 2]) * w;
    }
    colors.needsUpdate = true;
  }
  return { mesh, update };
}

// ---------- אנשים ----------
// דמות פשוטה ומסוגננת. sitting: יושבת על כיסא. facing: הכיוון שאליו היא מסתכלת (רדיאנים סביב y).
function person(parent, { pos, facing = 0, skin = '#e0b48f', scrub = '#2f8c8f', apron = null, cap = '#3d7fd6', hair = '#3a2418', mask = true, sitting = false, reach = 0 }) {
  const g = group(parent, pos, facing);
  const skinM = new THREE.MeshPhysicalMaterial({ color: skin, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd8c8') });
  const cloth = mat(scrub, 0.85);
  const pants = mat(new THREE.Color(scrub).multiplyScalar(0.8), 0.85);
  const shoe = mat('#e9edf2', 0.5);
  const hipY = sitting ? 0.48 : 0.92;
  if (sitting) {
    for (const s of [-1, 1]) {
      add(g, new THREE.CapsuleGeometry(0.065, 0.36, 6, 14), pants, [s * 0.1, hipY, 0.2], [Math.PI / 2, 0, 0]);
      add(g, new THREE.CapsuleGeometry(0.06, 0.36, 6, 14), pants, [s * 0.1, 0.25, 0.4]);
      add(g, rbox(0.11, 0.07, 0.24, 0.03), shoe, [s * 0.1, 0.035, 0.45]);
    }
  } else {
    for (const s of [-1, 1]) {
      add(g, new THREE.CapsuleGeometry(0.07, 0.72, 6, 14), pants, [s * 0.1, 0.48, 0]);
      add(g, rbox(0.11, 0.07, 0.26, 0.03), shoe, [s * 0.1, 0.035, 0.05]);
    }
  }
  add(g, new THREE.CapsuleGeometry(0.17, 0.42, 8, 20), cloth, [0, hipY + 0.32, 0], null, [1, 1, 0.68]);
  if (apron) add(g, rbox(0.38, 0.7, 0.05, 0.03), mat(apron, 0.55, 0.05), [0, hipY + 0.22, 0.12]);
  add(g, new THREE.CylinderGeometry(0.05, 0.055, 0.08, 14), skinM, [0, hipY + 0.66, 0]);
  const head = add(g, new THREE.SphereGeometry(0.11, 32, 24), skinM, [0, hipY + 0.8, 0], null, [0.92, 1.05, 1]);
  if (cap) add(g, new THREE.SphereGeometry(0.118, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap, 0.85), [0, hipY + 0.82, -0.005], [-0.2, 0, 0], [0.95, 0.85, 1.02]);
  else add(g, new THREE.SphereGeometry(0.117, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.7), mat(hair, 0.8), [0, hipY + 0.82, -0.01], [-0.35, 0, 0]);
  if (mask) add(g, rbox(0.15, 0.08, 0.04, 0.015), mat('#d9f2ee', 0.9), [0, hipY + 0.76, 0.095]);
  else {
    const eye = mat('#1d1d22', 0.3);
    add(g, new THREE.SphereGeometry(0.012, 10, 8), eye, [-0.035, hipY + 0.81, 0.1]);
    add(g, new THREE.SphereGeometry(0.012, 10, 8), eye, [0.035, hipY + 0.81, 0.1]);
    add(g, new THREE.TorusGeometry(0.025, 0.005, 6, 16, Math.PI), mat('#a5524f', 0.6), [0, hipY + 0.765, 0.098], [0, 0, Math.PI]);
  }
  // ידיים: reach = כמה הן מושטות קדימה (0 עד 1)
  for (const s of [-1, 1]) {
    const arm = group(g, [s * 0.2, hipY + 0.55, 0]);
    arm.rotation.x = -0.25 - reach * 0.9;
    arm.rotation.z = s * 0.08;
    add(arm, new THREE.CapsuleGeometry(0.05, 0.26, 6, 12), cloth, [0, -0.15, 0]);
    const fore = group(arm, [0, -0.3, 0]);
    fore.rotation.x = -0.5 - reach * 0.6;
    add(fore, new THREE.CapsuleGeometry(0.042, 0.22, 6, 12), skinM, [0, -0.13, 0]);
    add(fore, new THREE.SphereGeometry(0.05, 14, 10), mat('#e9eef7', 0.6), [0, -0.27, 0]);
  }
  g.userData.head = head;
  return g;
}

// ---------- ציורים על קנבס ----------
function drawFloor(ctx, w, h) {
  ctx.fillStyle = '#a9b6c8';
  ctx.fillRect(0, 0, w, h);
  const rnd = mulberry(7);
  for (let i = 0; i < 6000; i++) {
    const s = rnd();
    ctx.fillStyle = s < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(70,90,120,0.12)';
    ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  ctx.strokeStyle = 'rgba(90,105,130,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSign(ctx, w, h) {
  ctx.fillStyle = '#0f5132';
  roundRect(ctx, 0, 0, w, h, 24); ctx.fill();
  ctx.fillStyle = '#d7ffe9';
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.font = `700 ${h * 0.42}px ${FONT}`;
  ctx.fillText('מעבדת EP', w / 2, h * 0.5);
  ctx.font = `500 ${h * 0.2}px ${FONT}`;
  ctx.fillText('אלקטרופיזיולוגיה', w / 2, h * 0.82);
}

function drawRadiation(ctx, w, h) {
  ctx.fillStyle = '#ffcc33';
  roundRect(ctx, 0, 0, w, h, 20); ctx.fill();
  ctx.fillStyle = '#1a1206';
  const cx = w * 0.26, cy = h / 2, r = h * 0.36;
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + k * (Math.PI * 2 / 3);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a - 0.5, a + 0.5); ctx.fill();
  }
  ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1206'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.18, 0, 7); ctx.fill();
  ctx.direction = 'rtl'; ctx.textAlign = 'center';
  ctx.font = `700 ${h * 0.36}px ${FONT}`;
  ctx.fillText('קרינה', w * 0.7, h * 0.64);
}

function drawPoster(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#04050f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const rnd = mulberry(3);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, rnd() * 1.6 + 0.3, 0, 7); ctx.fill();
  }
  const cx = w / 2, cy = h * 0.42;
  const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.16);
  sun.addColorStop(0, '#fff3c0'); sun.addColorStop(0.5, '#ffb52e'); sun.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, w * 0.16, 0, 7); ctx.fill();
  const planets = [[0.17, '#a9a39b', 6], [0.24, '#e8c07a', 9], [0.31, '#4d8dff', 10], [0.38, '#e0573a', 8], [0.47, '#d9a066', 20], [0.56, '#e8d3a8', 16]];
  planets.forEach(([r, col, s], i) => {
    ctx.strokeStyle = 'rgba(160,180,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * w, r * w * 0.38, 0, 0, 7); ctx.stroke();
    const a = 1.1 + i * 1.7;
    const x = cx + Math.cos(a) * r * w, y = cy + Math.sin(a) * r * w * 0.38;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    if (i === 5) { ctx.strokeStyle = '#f0e0b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, s * 2, s * 0.6, -0.3, 0, 7); ctx.stroke(); }
  });
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2f4ff';
  ctx.font = `700 ${w * 0.1}px ${FONT}`;
  ctx.fillText('מסע במערכת השמש', w / 2, h * 0.84);
  ctx.font = `400 ${w * 0.055}px ${FONT}`; ctx.fillStyle = '#aab3dd';
  ctx.fillText('🪐 השמש ושמונת כוכבי הלכת', w / 2, h * 0.92);
}

function drawBoard(ctx, w, h) {
  ctx.fillStyle = '#f4f6fa'; ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // לב
  ctx.strokeStyle = '#e0435d'; ctx.lineWidth = 9;
  ctx.beginPath();
  const hx = w * 0.2, hy = h * 0.42, s = h * 0.22;
  ctx.moveTo(hx, hy + s);
  ctx.bezierCurveTo(hx - s * 1.6, hy, hx - s * 0.9, hy - s * 1.1, hx, hy - s * 0.35);
  ctx.bezierCurveTo(hx + s * 0.9, hy - s * 1.1, hx + s * 1.6, hy, hx, hy + s);
  ctx.stroke();
  // אק"ג
  ctx.strokeStyle = '#2a62d6'; ctx.lineWidth = 7;
  ctx.beginPath();
  const y0 = h * 0.82;
  ctx.moveTo(w * 0.05, y0); ctx.lineTo(w * 0.25, y0); ctx.lineTo(w * 0.28, y0 - 30); ctx.lineTo(w * 0.31, y0 + 40);
  ctx.lineTo(w * 0.34, y0 - 90); ctx.lineTo(w * 0.37, y0); ctx.lineTo(w * 0.6, y0); ctx.lineTo(w * 0.63, y0 - 30);
  ctx.lineTo(w * 0.66, y0 + 40); ctx.lineTo(w * 0.69, y0 - 90); ctx.lineTo(w * 0.72, y0); ctx.lineTo(w * 0.95, y0);
  ctx.stroke();
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#1f2a44';
  ctx.font = `700 ${h * 0.13}px ${FONT}`;
  ctx.fillText('מה למדנו היום?', w * 0.94, h * 0.2);
  ctx.font = `500 ${h * 0.085}px ${FONT}`;
  ctx.fillStyle = '#1f8a5b';
  ctx.fillText('⚡ ללב יש חשמל', w * 0.94, h * 0.36);
  ctx.fillText('🗺️ ממפים את הלב', w * 0.94, h * 0.49);
  ctx.fillText('🔥 מתקנים את הקצב', w * 0.94, h * 0.62);
  ctx.fillStyle = '#e0435d';
  ctx.font = `700 ${h * 0.3}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('?', w * 0.45, h * 0.55);
}

function drawGenerator(ctx, w, h, t = 0) {
  ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, w, h);
  const on = Math.floor(t) % 6 < 4;
  ctx.direction = 'ltr'; ctx.textAlign = 'center';
  ctx.fillStyle = on ? '#4de2c5' : '#5d6b7d';
  ctx.font = `700 ${h * 0.42}px ${FONT}`;
  ctx.fillText(on ? '35 W' : '0 W', w * 0.3, h * 0.6);
  ctx.fillStyle = '#ffd166';
  ctx.font = `600 ${h * 0.2}px ${FONT}`;
  ctx.fillText(`${on ? 41 + Math.round(Math.sin(t * 3) * 2) : 37}°C`, w * 0.75, h * 0.38);
  const s = Math.floor(t) % 60;
  ctx.fillStyle = '#c9d1e6';
  ctx.fillText(`00:${String(s).padStart(2, '0')}`, w * 0.75, h * 0.72);
  ctx.fillStyle = on ? '#3fd87a' : '#2a3342';
  ctx.fillRect(w * 0.06, h * 0.82, w * 0.48 * ((t % 4) / 4), h * 0.07);
}

function drawControlScreen(ctx, w, h, kind) {
  ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, w, h);
  if (kind === 'map') {
    const g = ctx.createLinearGradient(w * 0.25, h * 0.2, w * 0.75, h * 0.85);
    ['#ff3b3b', '#ffb52e', '#ffee55', '#3fd87a', '#3d8bff', '#9b5cff'].forEach((c, i) => g.addColorStop(i / 5, c));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.52, w * 0.26, h * 0.34, -0.4, 0, 7); ctx.fill();
  } else if (kind === 'data') {
    ctx.fillStyle = '#4de2c5';
    for (let i = 0; i < 7; i++) ctx.fillRect(w * 0.08, h * (0.12 + i * 0.11), w * (0.3 + ((i * 37) % 50) / 100), h * 0.05);
  } else {
    drawTraces(ctx, w, h, 3.3, TRACES_A.slice(0, 3));
  }
}

function glowTexture(color) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

function labelSprite(text) {
  const tex = canvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,181,46,0.95)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 40); ctx.fill();
    ctx.fillStyle = '#1a1206'; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.font = `700 ${h * 0.5}px ${FONT}`;
    ctx.fillText(text, w / 2, h * 0.66);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false }));
  s.scale.set(0.42, 0.16, 1);
  s.renderOrder = 5;
  return s;
}

// ---------- בניית המעבדה ----------
export function buildLab(scene, renderer) {
  const lab = new THREE.Group();
  scene.add(lab);
  const pickables = []; // [אובייקט, מזהה תחנה]
  const tag = (obj, id) => { pickables.push([obj, id]); return obj; };
  const animated = [];

  // ---- תאורה ----
  scene.add(new THREE.HemisphereLight('#e6edff', '#4a5268', 0.55));
  const key = new THREE.DirectionalLight('#fff7ee', 1.35);
  key.position.set(2.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 5, bottom: -5, near: 1, far: 16 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const lamp = new THREE.SpotLight('#fff6e6', 22, 6, 0.5, 0.65, 0);
  lamp.position.set(0.25, 2.4, 0.35);
  lamp.target.position.set(0.25, 1, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0005;
  scene.add(lamp, lamp.target);
  const ctrlLight = new THREE.PointLight('#ffe2b8', 6, 6, 1.4);
  ctrlLight.position.set(2.6, 2.6, -4.7);
  scene.add(ctrlLight);

  // ---- רצפה, קירות ותקרה ----
  const floorTex = canvasTexture(1024, 1024, drawFloor);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4, 4);
  const floor = add(lab, new THREE.PlaneGeometry(9, 7.5), mat('#ffffff', 0.38, 0, { map: floorTex }), [0, 0, 0.25], [-Math.PI / 2, 0, 0]);
  floor.userData.receiveOnly = true;

  // הקירות והתקרה הם משטחים חד־צדדיים שפונים פנימה: כשהמצלמה בחוץ הם נעלמים, כמו בבית בובות
  const wallM = mat('#d5dde9', 0.85);
  const accentM = mat('#3d7fd6', 0.6);
  const W = 9, Z = -3.5, WH = 3;
  const wall = (w, h, pos, rotY = 0, m = wallM) => add(lab, new THREE.PlaneGeometry(w, h), m, pos, [0, rotY, 0]);
  // הקיר האחורי, עם פתח לחלון של חדר הבקרה (x בין 1 ל־4.2, y בין 0.95 ל־2.35)
  wall(5.5, WH, [-1.75, WH / 2, Z]);
  wall(0.3, WH, [4.35, WH / 2, Z]);
  wall(3.2, 0.95, [2.6, 0.475, Z]);
  wall(3.2, 0.65, [2.6, 2.675, Z]);
  // פס צבע ופנל תחתון
  add(lab, new THREE.BoxGeometry(W, 0.14, 0.02), mat('#aeb9ca', 0.7), [0, 0.07, Z + 0.01]);
  add(lab, new THREE.BoxGeometry(5.5, 0.05, 0.02), accentM, [-1.75, 1.05, Z + 0.01]);
  // קירות צד
  wall(7.5, WH, [-4.5, WH / 2, 0.25], Math.PI / 2);
  wall(7.5, WH, [4.5, WH / 2, 0.25], -Math.PI / 2);
  add(lab, new THREE.BoxGeometry(0.02, 0.05, 7.5), accentM, [-4.49, 1.05, 0.25]);
  // תקרה עם פנלים מאירים
  add(lab, new THREE.PlaneGeometry(W, 7.5), mat('#eef1f6', 0.9), [0, WH, 0.25], [Math.PI / 2, 0, 0]).userData.noShadow = true;
  const panelM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff8ea', emissiveIntensity: 1.6 });
  for (const [x, z] of [[-2.6, -1.6], [2.6, 1.2], [-2.6, 1.2], [0, 2.2], [2.6, -1.6]]) {
    add(lab, new THREE.PlaneGeometry(1.2, 0.6), panelM, [x, WH - 0.01, z], [Math.PI / 2, 0, 0]).userData.noShadow = true;
  }
  // ארונות לאורך הקיר השמאלי
  const cabM = mat('#f7f9fc', 0.5);
  for (let i = 0; i < 4; i++) {
    const z = 0.6 + i * 0.62;
    add(lab, rbox(0.5, 2.0, 0.6, 0.02), cabM, [-4.18, 1.0, z]);
    add(lab, new THREE.BoxGeometry(0.02, 0.3, 0.02), mat('#9aa6c9', 0.3, 0.8), [-3.92, 1.05, z + 0.22]);
  }

  // ---- 1: הדלת ----
  const door = group(lab, [-3.6, 0, Z + 0.06]);
  add(door, rbox(1.3, 2.3, 0.08, 0.02), mat('#9aa6c9', 0.4, 0.5), [0, 1.15, 0]);
  add(door, rbox(1.18, 2.2, 0.06, 0.01), mat('#5b74b8', 0.55), [0, 1.11, 0.03]);
  add(door, new THREE.PlaneGeometry(0.35, 0.45), new THREE.MeshPhysicalMaterial({ color: '#cfe2ff', roughness: 0.05, transparent: true, opacity: 0.5 }), [0.2, 1.6, 0.065]);
  add(door, new THREE.CapsuleGeometry(0.018, 0.16, 4, 10), mat('#d7dde8', 0.25, 0.9), [-0.45, 1.05, 0.1], [0, 0, Math.PI / 2]);
  add(door, new THREE.PlaneGeometry(1.1, 0.3), new THREE.MeshBasicMaterial({ map: canvasTexture(512, 140, drawSign), toneMapped: false }), [0, 2.48, 0.01]);
  add(door, new THREE.PlaneGeometry(0.42, 0.2), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 120, drawRadiation), roughness: 0.6 }), [0.2, 1.25, 0.07]);
  const xrayLight = add(door, rbox(0.3, 0.1, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: '#ff4444', emissive: '#ff2020', emissiveIntensity: 0.4 }), [0.55, 2.48, 0.03]);
  tag(door, 'door');

  // ---- 10: פוסטר החלל ----
  const poster = group(lab, [-2.2, 1.62, Z + 0.07]);
  add(poster, rbox(0.82, 1.12, 0.03, 0.01), mat('#c9d1e6', 0.35, 0.6));
  add(poster, new THREE.PlaneGeometry(0.76, 1.06), new THREE.MeshStandardMaterial({ map: canvasTexture(512, 720, drawPoster), roughness: 0.35 }), [0, 0, 0.017]);
  tag(poster, 'space');

  // ---- 11: הלוח ----
  const board = group(lab, [-0.6, 1.55, Z + 0.07]);
  add(board, rbox(1.62, 1.04, 0.04, 0.015), mat('#aeb8d0', 0.35, 0.6));
  add(board, new THREE.PlaneGeometry(1.54, 0.96), new THREE.MeshStandardMaterial({ map: canvasTexture(1024, 640, drawBoard), roughness: 0.25 }), [0, 0, 0.022]);
  add(board, rbox(1.0, 0.04, 0.08, 0.01), mat('#aeb8d0', 0.35, 0.6), [0, -0.55, 0.04]);
  ['#e0435d', '#2a62d6', '#1f8a5b'].forEach((c, i) => add(board, new THREE.CapsuleGeometry(0.012, 0.1, 4, 8), mat(c, 0.5), [-0.2 + i * 0.15, -0.51, 0.05], [0, 0, Math.PI / 2]));
  tag(board, 'quiz');

  // ---- 9: חדר הבקרה ----
  const ctrl = group(lab, [0, 0, 0]);
  add(ctrl, new THREE.BoxGeometry(3.6, 0.04, 2.6), mat('#8e9ab3', 0.7), [2.6, -0.02, -4.8]);
  const ctrlWall = mat('#b9c3d6', 0.9);
  add(ctrl, new THREE.PlaneGeometry(3.6, WH), ctrlWall, [2.6, WH / 2, -6.1]);
  add(ctrl, new THREE.PlaneGeometry(2.6, WH), ctrlWall, [0.85, WH / 2, -4.8], [0, Math.PI / 2, 0]);
  add(ctrl, new THREE.PlaneGeometry(2.6, WH), ctrlWall, [4.45, WH / 2, -4.8], [0, -Math.PI / 2, 0]);
  add(ctrl, new THREE.PlaneGeometry(3.6, 2.6), mat('#e4e8ef', 0.9), [2.6, WH, -4.8], [Math.PI / 2, 0, 0]).userData.noShadow = true;
  // שולחן ומסכים
  add(ctrl, rbox(3.0, 0.05, 0.8, 0.01), mat('#f2efe9', 0.5), [2.6, 0.76, -5.55]);
  add(ctrl, new THREE.BoxGeometry(2.9, 0.7, 0.05), mat('#9aa6c9', 0.6), [2.6, 0.38, -5.9]);
  const ctrlScreens = [['map', 1.75], ['traces', 2.6], ['data', 3.45]];
  for (const [kind, x] of ctrlScreens) {
    const tex = canvasTexture(512, 320, (ctx, w, h) => drawControlScreen(ctx, w, h, kind));
    screen(ctrl, 0.68, 0.42, tex, [x, 1.12, -5.75], 0);
    add(ctrl, new THREE.CylinderGeometry(0.02, 0.02, 0.15, 10), mat('#2a2f3a', 0.4, 0.5), [x, 0.85, -5.8]);
  }
  add(ctrl, rbox(0.5, 0.025, 0.16, 0.008), mat('#2a2f3a', 0.5), [2.0, 0.79, -5.35]);
  add(ctrl, rbox(0.5, 0.025, 0.16, 0.008), mat('#2a2f3a', 0.5), [3.1, 0.79, -5.35]);
  // כיסאות ואנשים שמסתכלים על המסכים
  for (const x of [2.0, 3.1]) {
    add(ctrl, rbox(0.46, 0.08, 0.46, 0.03), mat('#2a2f3a', 0.7), [x, 0.46, -4.82]);
    add(ctrl, rbox(0.46, 0.5, 0.07, 0.03), mat('#2a2f3a', 0.7), [x, 0.76, -4.55]);
    add(ctrl, new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), mat('#7b88b0', 0.3, 0.8), [x, 0.22, -4.82]);
  }
  person(ctrl, { pos: [2.0, 0, -4.95], facing: Math.PI, sitting: true, scrub: '#3a7bd5', mask: false, cap: null, hair: '#2b1d14', skin: '#c99272', reach: 0.4 });
  person(ctrl, { pos: [3.1, 0, -4.95], facing: Math.PI, sitting: true, scrub: '#7e57c2', mask: false, cap: null, hair: '#6b4428', reach: 0.4 });
  // אבא: עומד עם מחשב נייד ומסתכל אל המעבדה
  const dad = person(ctrl, { pos: [1.5, 0, -4.35], facing: 0.35, scrub: '#3f4a63', mask: false, cap: null, hair: '#2b1d14', skin: '#e0b48f', reach: 0.7 });
  const laptop = group(dad, [0, 1.1, 0.32]);
  add(laptop, rbox(0.34, 0.015, 0.24, 0.005), mat('#c9ced6', 0.3, 0.8));
  const lid = group(laptop, [0, 0.005, -0.11]);
  lid.rotation.x = -1.75;
  add(lid, rbox(0.34, 0.012, 0.23, 0.005), mat('#c9ced6', 0.3, 0.8), [0, 0, 0.115]);
  add(lid, new THREE.PlaneGeometry(0.31, 0.2), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 160, (c, w, h) => drawControlScreen(c, w, h, 'map')), toneMapped: false }), [0, -0.008, 0.115], [Math.PI / 2, 0, 0]);
  const dadTag = labelSprite('אבא 👋');
  dadTag.position.set(1.5, 2.02, -4.35);
  ctrl.add(dadTag);
  // החלון
  const glass = add(ctrl, new THREE.PlaneGeometry(3.2, 1.4), new THREE.MeshPhysicalMaterial({
    color: '#cfe2ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, envMapIntensity: 1.4, depthWrite: false,
  }), [2.6, 1.65, Z]);
  glass.userData.noShadow = true;
  const frameM = mat('#9aa6c9', 0.35, 0.6);
  add(ctrl, new THREE.BoxGeometry(3.3, 0.06, 0.16), frameM, [2.6, 0.95, Z]);
  add(ctrl, new THREE.BoxGeometry(3.3, 0.06, 0.16), frameM, [2.6, 2.35, Z]);
  add(ctrl, new THREE.BoxGeometry(0.06, 1.46, 0.16), frameM, [1.0, 1.65, Z]);
  add(ctrl, new THREE.BoxGeometry(0.06, 1.46, 0.16), frameM, [4.2, 1.65, Z]);
  tag(ctrl, 'control');

  // ---- 2: מיטת הטיפולים והמטופל ----
  const bed = group(lab, [0, 0, 0]);
  const steel = mat('#c9ced6', 0.3, 0.75);
  add(bed, rbox(1.0, 0.06, 0.6, 0.02), mat('#7b88b0', 0.5, 0.3), [-0.2, 0.03, 0]);
  add(bed, rbox(0.42, 0.82, 0.34, 0.04), mat('#9aa6c9', 0.45, 0.3), [-0.2, 0.47, 0]);
  add(bed, rbox(2.45, 0.05, 0.62, 0.015), mat('#2b3140', 0.35, 0.2), [0, 0.925, 0]);
  add(bed, rbox(2.3, 0.08, 0.56, 0.035), mat('#e9eef6', 0.7), [-0.02, 1.015, 0]);
  add(bed, new THREE.BoxGeometry(2.3, 0.02, 0.02), steel, [0, 0.93, 0.32]);
  // המטופל מתחת לסדין
  const sheetM = new THREE.MeshPhysicalMaterial({ color: '#4f8fd8', roughness: 0.9, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#9cc4ff') });
  add(bed, new THREE.CapsuleGeometry(0.19, 1.3, 10, 28), sheetM, [-0.12, 1.12, 0], [0, 0, Math.PI / 2], [1, 0.62, 1.12]);
  add(bed, new THREE.SphereGeometry(0.12, 20, 14), sheetM, [-0.88, 1.12, 0.09], null, [1, 0.8, 0.9]);
  add(bed, new THREE.SphereGeometry(0.12, 20, 14), sheetM, [-0.88, 1.12, -0.09], null, [1, 0.8, 0.9]);
  add(bed, rbox(0.34, 0.08, 0.4, 0.04), mat('#f7f9fc', 0.85), [0.97, 1.08, 0]);
  const skin = new THREE.MeshPhysicalMaterial({ color: '#e0b896', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd8c8') });
  add(bed, new THREE.SphereGeometry(0.1, 32, 24), skin, [0.97, 1.2, 0], null, [1, 0.95, 0.9]);
  add(bed, new THREE.SphereGeometry(0.104, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#5a3d2b', 0.85), [1.0, 1.2, 0], [0, 0, -Math.PI / 2]);
  // הלב, פועם מעל החזה
  const { group: heartG, muscle } = anatomicalHeart();
  heartG.scale.setScalar(0.07);
  heartG.position.set(0.42, 1.3, 0.04);
  heartG.rotation.y = 0.5;
  bed.add(heartG);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,70,100,0.9)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.copy(heartG.position);
  glow.scale.setScalar(0.32);
  bed.add(glow);
  tag(bed, 'patient');

  // ---- 5: משטח המיקום ----
  const pad = group(lab, [0.42, 0.9625, 0]);
  const padM = new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.45, emissive: '#ff2a2a', emissiveIntensity: 0.12 });
  add(pad, rbox(0.52, 0.025, 0.66, 0.008), padM);
  const coilM = mat('#ffd0ce', 0.4, 0, { emissive: '#ff8a85', emissiveIntensity: 0.6 });
  for (const x of [-0.17, 0, 0.17]) add(pad, new THREE.TorusGeometry(0.035, 0.006, 8, 24), coilM, [x, 0.0, 0.33], [0, 0, 0]);
  // קווי השדה המגנטי: קשתות שקופות שמהבהבות
  const fieldM = new THREE.MeshBasicMaterial({ color: '#ff8a85', transparent: true, opacity: 0.35, depthWrite: false });
  const field = group(pad, [0, 0.01, 0]);
  for (let i = 0; i < 4; i++) {
    const r = 0.12 + i * 0.07;
    add(field, new THREE.TorusGeometry(r, 0.003, 6, 48, Math.PI), fieldM, [0, 0, 0.0], [0, Math.PI / 2, 0]);
  }
  field.visible = false;
  tag(pad, 'pad');

  // ---- הרופאה, הקטטר והכבלים ----
  const doc = person(lab, { pos: [-0.28, 0, -0.66], facing: 0, apron: '#2f6f73', scrub: '#2f8c8f', reach: 0.9 });
  const catheterM = mat('#3d6fe0', 0.35, 0.1);
  const catheter = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, 1.13, -0.36), new THREE.Vector3(-0.3, 1.18, -0.22), new THREE.Vector3(-0.26, 1.16, -0.1), new THREE.Vector3(-0.22, 1.13, -0.04),
  ]);
  add(lab, new THREE.TubeGeometry(catheter, 40, 0.006, 8), catheterM);
  add(lab, new THREE.CapsuleGeometry(0.018, 0.12, 4, 10), mat('#e8ecf5', 0.4), [-0.32, 1.12, -0.42], [Math.PI / 2.4, 0, 0]);
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, 1.1, -0.48), new THREE.Vector3(-0.5, 0.7, -0.5), new THREE.Vector3(-0.2, 0.02, -0.95),
    new THREE.Vector3(1.6, 0.02, -0.5), new THREE.Vector3(2.35, 0.3, 0.25), new THREE.Vector3(2.45, 0.85, 0.5),
  ]);
  add(lab, new THREE.TubeGeometry(cable, 120, 0.008, 8), mat('#9aa3b5', 0.5));

  // ---- 7: מכשיר הרנטגן (C-arm) ----
  const carm = group(lab, [0.42, 1.12, 0]);
  const carmM = mat('#eef1f6', 0.32, 0.15);
  const arcGeo = new THREE.TorusGeometry(0.98, 0.075, 18, 80, Math.PI);
  arcGeo.rotateZ(-Math.PI / 2);
  arcGeo.rotateY(Math.PI / 2);
  add(carm, arcGeo, carmM, [0, 0, 0], null, [1, 1, 1]);
  const stripe = new THREE.TorusGeometry(1.0, 0.03, 10, 80, Math.PI * 0.6);
  stripe.rotateZ(-Math.PI * 0.3);
  stripe.rotateY(Math.PI / 2);
  add(carm, stripe, accentM);
  add(carm, rbox(0.46, 0.16, 0.46, 0.04), carmM, [0, 0.95, 0]);
  add(carm, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 40), mat('#2b3140', 0.3), [0, 0.86, 0]);
  add(carm, new THREE.CylinderGeometry(0.15, 0.17, 0.2, 32), carmM, [0, -0.93, 0]);
  // הזרוע שמחזיקה את ה־C, והעמוד
  add(carm, rbox(0.2, 0.2, 0.6, 0.04), carmM, [0, 0, -1.25]);
  add(lab, rbox(0.34, 1.25, 0.34, 0.05), carmM, [0.42, 0.66, -1.62]);
  add(lab, rbox(0.9, 0.08, 0.9, 0.04), mat('#9aa6c9', 0.4, 0.3), [0.42, 0.04, -1.62]);
  const xrayLamp = add(carm, new THREE.SphereGeometry(0.025, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffb52e', emissive: '#ffb52e', emissiveIntensity: 1 }), [0.2, 0.98, 0.2]);
  tag(carm, 'carm');

  // ---- מנורת ניתוח ----
  add(lab, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 16), steel, [-0.2, WH - 0.15, 0.55]);
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, WH - 0.28, 0.55), new THREE.Vector3(0.0, 2.75, 0.45), new THREE.Vector3(0.25, 2.55, 0.35)]);
  add(lab, new THREE.TubeGeometry(arm, 20, 0.03, 10), steel);
  add(lab, new THREE.SphereGeometry(0.28, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f4f6fa', 0.35, 0.2, { side: THREE.DoubleSide }), [0.25, 2.42, 0.35], null, [1, 0.45, 1]);
  add(lab, new THREE.CircleGeometry(0.24, 40), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6e0', emissiveIntensity: 2.2 }), [0.25, 2.415, 0.35], [Math.PI / 2, 0, 0]).userData.noShadow = true;

  // ---- 6: המסכים התלויים ומפת הלב ----
  const rt = new THREE.WebGLRenderTarget(1024, 600, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const mapScene = new THREE.Scene();
  mapScene.background = new THREE.Color('#05070d');
  const mapCam = new THREE.PerspectiveCamera(32, 1024 / 600, 0.1, 20);
  mapCam.position.set(0, 0.05, 5.4);
  mapScene.add(new THREE.HemisphereLight('#ffffff', '#334', 1.4));
  const mk = new THREE.DirectionalLight('#ffffff', 2.2);
  mk.position.set(2, 3, 4);
  mapScene.add(mk);
  const act = activationHeart();
  act.mesh.position.x = -0.35;
  mapScene.add(act.mesh);
  // סרגל צבעים בצד המסך
  const legend = canvasTexture(64, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 10; i++) { const c = new THREE.Color().setHSL(i / 10 * 0.78, 0.95, 0.52); g.addColorStop(i / 10, `#${c.getHexString()}`); }
    ctx.fillStyle = g; ctx.fillRect(16, 0, 32, h);
  });
  add(mapScene, new THREE.PlaneGeometry(0.16, 2.2), new THREE.MeshBasicMaterial({ map: legend }), [2.35, 0, 0]);
  // קטטר על המפה
  const mcat = new THREE.CatmullRomCurve3([new THREE.Vector3(0.3, -2.2, 1), new THREE.Vector3(0.2, -1, 1.2), new THREE.Vector3(-0.1, 0.1, 1.15)]);
  add(mapScene, new THREE.TubeGeometry(mcat, 30, 0.03, 8), mat('#ffffff', 0.3));
  add(mapScene, new THREE.SphereGeometry(0.07, 16, 12), mat('#ffffff', 0.2, 0, { emissive: '#ffffff', emissiveIntensity: 0.6 }), [-0.1, 0.1, 1.15]);

  const boom = group(lab, [0, 0, 0]);
  add(boom, new THREE.CylinderGeometry(0.06, 0.06, 0.55, 16), steel, [1.9, WH - 0.28, -1.15]);
  add(boom, rbox(1.7, 0.08, 0.12, 0.03), steel, [2.05, 2.48, -1.15], [0, -0.35, 0]);
  screen(boom, 1.18, 0.69, rt.texture, [1.65, 2.02, -1.28], -0.35);
  const recA = canvasTexture(768, 480, (ctx, w, h, t = 0) => drawTraces(ctx, w, h, t, TRACES_A));
  const recB = canvasTexture(768, 480, (ctx, w, h, t = 0) => drawTraces(ctx, w, h, t, TRACES_B));
  const fluoro = canvasTexture(512, 360, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.55);
    g.addColorStop(0, '#9aa0aa'); g.addColorStop(1, '#1b1d22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(230,235,240,0.55)'; ctx.lineWidth = 10;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(w / 2, h * 0.15 + i * 55, w * 0.35, 30, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.strokeStyle = '#f4f6f8'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(w * 0.35, h); ctx.bezierCurveTo(w * 0.4, h * 0.6, w * 0.6, h * 0.55, w * 0.55, h * 0.35); ctx.stroke();
  });
  screen(boom, 0.56, 0.36, recA, [2.6, 2.1, -0.95], -0.55);
  screen(boom, 0.56, 0.36, fluoro, [2.6, 1.66, -0.95], -0.55);
  tag(boom, 'mapping');

  // ---- 3: מערכת ההקלטה ----
  const rec = group(lab, [-3.0, 0, -1.2], 0.55);
  add(rec, rbox(0.75, 0.82, 0.55, 0.03), mat('#e8ecf2', 0.5), [0, 0.47, 0]);
  for (const [x, z] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) add(rec, new THREE.SphereGeometry(0.04, 12, 10), mat('#2a2f3a', 0.5), [x, 0.04, z]);
  add(rec, rbox(0.6, 0.03, 0.22, 0.01), mat('#2a2f3a', 0.5), [0, 0.9, 0.1]);
  add(rec, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 12), steel, [0, 1.35, -0.18]);
  screen(rec, 0.72, 0.45, recA, [0, 1.25, -0.12], 0);
  screen(rec, 0.72, 0.45, recB, [0, 1.78, -0.12], 0);
  tag(rec, 'recording');

  // ---- 4: מגש הקטטרים ----
  const tray = group(lab, [-1.9, 0, 0.9], 0.2);
  add(tray, rbox(0.9, 0.03, 0.55, 0.01), steel, [0, 0.9, 0]);
  add(tray, new THREE.BoxGeometry(0.86, 0.004, 0.52), mat('#4fa3a5', 0.9), [0, 0.917, 0]);
  for (const [x, z] of [[-0.4, -0.23], [0.4, -0.23], [-0.4, 0.23], [0.4, 0.23]]) {
    add(tray, new THREE.CylinderGeometry(0.015, 0.015, 0.88, 10), steel, [x, 0.45, z]);
    add(tray, new THREE.SphereGeometry(0.03, 10, 8), mat('#2a2f3a', 0.5), [x, 0.03, z]);
  }
  add(tray, rbox(0.86, 0.02, 0.5, 0.01), steel, [0, 0.35, 0]);
  const coil = (cx, cz, r, turns, color, tipColor) => {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = i / 160 * Math.PI * 2 * turns;
      const rr = r * (1 - i / 160 * 0.35);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, 0.93 + i * 0.00003, cz + Math.sin(a) * rr));
    }
    add(tray, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0055, 8), mat(color, 0.35, 0.05));
    const end = pts[pts.length - 1];
    add(tray, new THREE.SphereGeometry(0.011, 10, 8), mat(tipColor, 0.2, 0.7), end.toArray());
  };
  coil(-0.2, -0.02, 0.17, 3, '#3d6fe0', '#d0d6e0');
  coil(0.18, 0.04, 0.15, 3, '#f2f4f8', '#ffb52e');
  // קטטר "פרח": קצה עם כמה זרועות
  const flower = group(tray, [0.24, 0.94, -0.18]);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.05, 0.02, Math.sin(a) * 0.05), new THREE.Vector3(Math.cos(a) * 0.035, 0.05, Math.sin(a) * 0.035), new THREE.Vector3(0, 0.06, 0)]);
    add(flower, new THREE.TubeGeometry(c, 20, 0.003, 6), mat(['#ff6b8a', '#ffd166', '#4de2c5', '#7aa8ff', '#c59bff'][k], 0.4));
  }
  add(flower, new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), mat('#3d6fe0', 0.35), [-0.1, 0, 0], [0, 0, Math.PI / 2]);
  tag(tray, 'catheters');

  // ---- 8: מחולל האבלציה ----
  const gen = group(lab, [2.6, 0, 0.55], -0.6);
  add(gen, rbox(0.62, 0.72, 0.5, 0.03), mat('#e8ecf2', 0.5), [0, 0.42, 0]);
  for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) add(gen, new THREE.SphereGeometry(0.04, 12, 10), mat('#2a2f3a', 0.5), [x, 0.04, z]);
  add(gen, rbox(0.56, 0.24, 0.4, 0.03), mat('#f7f9fc', 0.35, 0.05), [0, 0.9, 0]);
  const genTex = canvasTexture(512, 240, drawGenerator);
  add(gen, new THREE.PlaneGeometry(0.3, 0.14), new THREE.MeshBasicMaterial({ map: genTex, toneMapped: false }), [-0.08, 0.92, 0.202]);
  add(gen, new THREE.CylinderGeometry(0.04, 0.04, 0.03, 24), mat('#7b88b0', 0.3, 0.7), [0.18, 0.93, 0.21], [Math.PI / 2, 0, 0]);
  add(gen, rbox(0.06, 0.03, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: '#3fd87a', emissive: '#3fd87a', emissiveIntensity: 0.6 }), [0.12, 0.84, 0.205]);
  add(gen, rbox(0.06, 0.03, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: '#e0435d', emissive: '#e0435d', emissiveIntensity: 0.4 }), [0.22, 0.84, 0.205]);
  // משאבת הקירור
  add(gen, rbox(0.36, 0.14, 0.28, 0.03), mat('#dfe5f3', 0.4), [0, 1.09, -0.02]);
  const roller = add(gen, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 6), mat('#9aa6c9', 0.3, 0.7), [-0.08, 1.12, 0.13], [Math.PI / 2, 0, 0]);
  const bagM = new THREE.MeshPhysicalMaterial({ color: '#dff1ff', roughness: 0.15, transparent: true, opacity: 0.55 });
  add(gen, new THREE.CylinderGeometry(0.01, 0.01, 0.9, 8), steel, [0.22, 1.55, -0.12]);
  add(gen, new THREE.CapsuleGeometry(0.06, 0.12, 6, 14), bagM, [0.22, 1.9, -0.12], null, [1, 1, 0.5]);
  const tube = new THREE.CatmullRomCurve3([new THREE.Vector3(0.22, 1.8, -0.1), new THREE.Vector3(0.05, 1.3, 0.05), new THREE.Vector3(-0.08, 1.14, 0.15)]);
  add(gen, new THREE.TubeGeometry(tube, 30, 0.005, 6), new THREE.MeshPhysicalMaterial({ color: '#e8f6ff', roughness: 0.1, transparent: true, opacity: 0.7 }));
  tag(gen, 'ablation');

  // ---- עמוד אינפוזיה ליד הראש ----
  add(lab, new THREE.CylinderGeometry(0.012, 0.012, 1.9, 10), steel, [1.4, 0.95, -0.55]);
  add(lab, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 5), steel, [1.4, 0.03, -0.55]);
  add(lab, new THREE.CapsuleGeometry(0.06, 0.14, 6, 14), bagM, [1.4, 1.72, -0.55], null, [1, 1, 0.5]);

  // צללים לכל מה שלא סומן אחרת
  lab.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.receiveOnly) { o.receiveShadow = true; return; }
    if (o.userData.noShadow || o.material.transparent) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });

  // ---- אנימציה ----
  let recTimer = 0, genTimer = 0;
  let active = null;
  function update(t, dt) {
    // פעימות הלב: שתי פעימות קצרות, כמו לב אמיתי
    const ph = (t / 0.85) % 1;
    const pulse = Math.exp(-(((ph - 0.08) / 0.05) ** 2)) + 0.6 * Math.exp(-(((ph - 0.28) / 0.05) ** 2));
    heartG.scale.setScalar(0.07 * (1 + 0.12 * pulse));
    muscle.emissiveIntensity = 0.12 + 0.5 * pulse;
    glow.material.opacity = 0.35 + 0.6 * pulse;
    glow.scale.setScalar((active === 'patient' ? 0.42 : 0.3) * (1 + 0.15 * pulse));

    act.mesh.rotation.y = t * 0.35;
    act.mesh.rotation.x = Math.sin(t * 0.25) * 0.15;
    act.update(t);
    renderer.setRenderTarget(rt);
    renderer.render(mapScene, mapCam);
    renderer.setRenderTarget(null);

    recTimer += dt;
    if (recTimer > 1 / 30) {
      recTimer = 0;
      redraw(recA, t);
      redraw(recB, t);
    }
    genTimer += dt;
    if (genTimer > 0.2) {
      genTimer = 0;
      redraw(genTex, t);
    }
    roller.rotation.y = t * 4;
    xrayLamp.material.emissiveIntensity = active === 'carm' ? 1 + Math.sin(t * 8) : 0.6;
    xrayLight.material.emissiveIntensity = active === 'carm' || active === 'door' ? 1.2 + Math.sin(t * 5) * 0.8 : 0.4;
    padM.emissiveIntensity = active === 'pad' ? 0.35 + 0.25 * Math.sin(t * 4) : 0.12;
    field.visible = active === 'pad';
    if (field.visible) field.children.forEach((c, i) => { c.scale.setScalar(1 + ((t * 0.6 + i * 0.25) % 1) * 0.5); });
    fieldM.opacity = 0.25 + 0.15 * Math.sin(t * 4);
    dadTag.material.opacity = active === 'control' ? 1 : 0.85;
    dadTag.position.y = 2.02 + Math.sin(t * 2) * 0.02;
    doc.rotation.y = Math.sin(t * 0.5) * 0.06;
  }

  return {
    pickables,
    update,
    setActive(id) { active = id; },
  };
}
