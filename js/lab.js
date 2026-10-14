// מעבדת ה־EP בתלת־ממד: החדר, המיטה והמטופל, מכשיר הרנטגן, המסכים, העגלות וחדר הבקרה.
// הכול בנוי בקוד, בלי קבצי מודלים. היחידות הן מטרים: x ימינה, y למעלה, z לכיוון הצופה.
// הקיר האחורי ב־z = -3.5, ומאחוריו חדר הבקרה. החזית פתוחה, כמו בבית בובות.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { makePerson } from './people.js';

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
// מקטינים או מגדילים אובייקט לגובה מסוים, וממרכזים אותו סביב הראשית
function fit(obj, height) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const k = height / size.y;
  obj.scale.multiplyScalar(k);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  obj.position.sub(c);
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

// הלב שעל המטופל: המודל האמיתי, עם זוהר אדום שפועם
function patientHeart(src) {
  const root = src.clone(true);
  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.emissive = new THREE.Color('#ff1e3c');
    o.material.emissiveIntensity = 0.1;
    o.castShadow = true;
    mats.push(o.material);
  });
  return { group: fit(root, 0.15), mats };
}

// מפת ההפעלה (כמו ב־CARTO) על הלב האמיתי: צבע לפי הזמן שבו האות החשמלי מגיע לכל נקודה,
// ופס לבן שעובר על הלב ומראה את ההתפשטות.
function activationHeart(src) {
  const root = src.clone(true);
  const group = fit(root, 2.3);
  group.updateMatrixWorld(true);
  let mesh = null;
  root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone();
  mesh.geometry = geo;
  const p = geo.attributes.position;
  const n = p.count;
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  // "קוצב הלב הטבעי": למעלה, בצד ימין של הלב (משמאל במסך)
  const source = new THREE.Vector3(box.min.x + size.x * 0.25, box.max.y - size.y * 0.25, box.max.z - size.z * 0.3);
  const act = new Float32Array(n);
  const v = new THREE.Vector3();
  let max = 0;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    act[i] = v.distanceTo(source) + 0.08 * Math.sin(v.x * 4 + v.z * 3);
    max = Math.max(max, act[i]);
  }
  const base = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    act[i] /= max;
    c.setHSL(act[i] * 0.78, 0.95, 0.5);
    base.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(base.slice(), 3));
  mesh.material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.02, normalMap: mesh.material.normalMap || null,
  });

  // נקודות האבלציה (כדורים אדומים קטנים) בשורה על הלב
  const dots = new THREE.Group();
  const dotMat = mat('#ff2b2b', 0.4, 0, { emissive: '#ff0000', emissiveIntensity: 0.6 });
  const ray = new THREE.Raycaster();
  for (let k = 0; k < 10; k++) {
    const a = -0.75 + k * 0.13;
    const dir = new THREE.Vector3(Math.sin(a), 0.25 - k * 0.04, Math.cos(a)).normalize();
    ray.set(dir.clone().multiplyScalar(4), dir.clone().negate());
    const hit = ray.intersectObject(mesh)[0];
    if (hit) add(dots, new THREE.SphereGeometry(0.05, 12, 10), dotMat, hit.point.toArray());
  }
  group.add(dots);

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
  return { mesh: group, update };
}

// סדין שנופל על המטופל: רשת שכל נקודה בה "נוחתת" על הגוף או על המזרן, ובקצוות נופלת למטה
function drapeSheet(targets, { x0, x1, z0, z1, edge, top }) {
  const nx = 70, nz = 30;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = geo.attributes.position;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const base = new Float32Array(p.count);
  const visible = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const cols = nx + 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (Math.abs(z) > edge) continue;
    ray.set(new THREE.Vector3(x, 2.5, z), down);
    const hit = ray.intersectObjects(targets, true).find((r) => visible(r.object));
    base[i] = hit ? hit.point.y : top;
  }
  // מעבר לקצה המזרן הבד נופל למטה, מהגובה שהיה לו בקצה
  for (let cx = 0; cx <= nx; cx++) {
    let lo = -1, hi = -1;
    for (let cz = 0; cz <= nz; cz++) {
      if (Math.abs(p.getZ(cz * cols + cx)) <= edge) { if (lo < 0) lo = cz; hi = cz; }
    }
    for (let cz = 0; cz <= nz; cz++) {
      const i = cz * cols + cx, z = p.getZ(i);
      if (Math.abs(z) <= edge) continue;
      const from = base[(z < 0 ? lo : hi) * cols + cx];
      base[i] = from - (Math.abs(z) - edge) * 2.6;
    }
  }
  // החלקה, כדי שהבד ייראה רך ולא יעקוב אחרי כל פרט (אבל לא ייכנס לתוך הגוף)
  // החלקה, כדי שהבד ייראה רך ולא יעקוב אחרי כל פרט (אבל לא ייכנס לתוך הגוף)
  const h = base.slice();
  for (let pass = 0; pass < 6; pass++) {
    const copy = h.slice();
    for (let i = 0; i < p.count; i++) {
      const cx = i % cols, cz = Math.floor(i / cols);
      let s = 0, k = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx, zz = cz + dz;
        if (xx < 0 || xx > nx || zz < 0 || zz > nz) continue;
        s += copy[zz * cols + xx]; k++;
      }
      h[i] = Math.max(base[i], s / k);
    }
  }
  // קפלים קטנים בבד
  for (let i = 0; i < p.count; i++) p.setY(i, h[i] + 0.012 + 0.006 * Math.sin(p.getX(i) * 19 + Math.sin(p.getZ(i) * 9) * 2));
  geo.computeVertexNormals();
  return geo;
}

// טקסטורת "נורמל" מתוך מפת גובה (קנבס בגווני אפור): נותנת לתפרים ולמרקם עומק אמיתי באור
function normalFromHeight(srcCanvas, strength = 2) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255;
    out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------- מודלים מוכנים ----------
// מעתיקים חלק ממודל glTF, מקטינים לגודל אמיתי, ומעמידים אותו על הרצפה במקום ובכיוון הנכונים.
// size: { scale } – פי כמה להגדיל, או { height } – הגובה הרצוי במטרים
function placeModel(parent, src, size, pos, rotY = 0) {
  src.updateMatrixWorld(true);
  const inner = src.clone(true);
  src.matrixWorld.decompose(inner.position, inner.quaternion, inner.scale);
  const mid = new THREE.Group();
  mid.add(inner);
  mid.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(mid);
  const k = size.scale ?? size.height / box.getSize(new THREE.Vector3()).y;
  mid.scale.setScalar(k);
  mid.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(mid);
  const c = box.getCenter(new THREE.Vector3());
  mid.position.set(-c.x, -box.min.y, -c.z);
  const outer = group(parent, pos, rotY);
  outer.add(mid);
  return outer;
}

// טקסטורה נוספת על אותו קנבס, בכיוון של מודלים מוכנים (glTF לא הופך את התמונה)
function gltfTexture(tex) {
  const t = new THREE.CanvasTexture(tex.image);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// גובה של משטח מתחת לנקודה (x, z)
const _ray = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
function surfaceY(obj, x, z) {
  _ray.set(new THREE.Vector3(x, 4, z), _down);
  const hit = _ray.intersectObject(obj, true)[0];
  return hit ? hit.point.y : -1;
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
export async function buildLab(scene, renderer, onProgress = () => {}) {
  // ---- נכסים: מפת תאורה של מעבדה אמיתית, הלב, והדמות ----
  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, done, total) => onProgress(done / total);
  const gltf = new GLTFLoader(manager);
  const [env, heartGltf, personGltf, equipGltf, surgeonGltf, ecgGltf, cartGltf, ivGltf] = await Promise.all([
    new EXRLoader(manager).loadAsync('assets/hdri/lab.exr'),
    ...['heart', 'person', 'equipset', 'surgeon', 'ecg', 'cart', 'ivstand'].map((n) => gltf.loadAsync(`assets/models/${n}.glb`)),
  ]);
  const equip = equipGltf.scene;
  const EQ = 0.42; // קנה המידה של ערכת הציוד, כך שהמיטה באורך של כ־2.25 מ'
  const TABLE_ROT = 0, SURGEON_ROT = 0, LAMP_ROT = 0, TOWER_ROT = 0, ECG_ROT = -2.3;
  env.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  scene.environmentRotation = new THREE.Euler(0, 1.2, 0);
  const heartSrc = heartGltf.scene;
  const personSrc = personGltf.scene;

  const lab = new THREE.Group();
  scene.add(lab);
  const pickables = []; // [אובייקט, מזהה תחנה]
  const tag = (obj, id) => { pickables.push([obj, id]); return obj; };

  // ---- תאורה ----
  scene.add(new THREE.HemisphereLight('#e6edff', '#4a5268', 0.3));
  // אור רך מהפנלים שבתקרה (בלי צללים, אבל עם השתקפויות רכות ואמיתיות)
  RectAreaLightUniformsLib.init();
  for (const [x, z] of [[-0.6, 0.2], [1.0, 0.2]]) {
    const ra = new THREE.RectAreaLight('#fff6ea', 1.8, 1.2, 0.6);
    ra.position.set(x, 2.98, z);
    ra.lookAt(x, 0, z);
    scene.add(ra);
  }
  const key = new THREE.DirectionalLight('#fff7ee', 1.1);
  key.position.set(2.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 5, bottom: -5, near: 1, far: 16 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const lamp = new THREE.SpotLight('#fff6e6', 11, 6, 0.5, 0.65, 0);
  lamp.position.set(-0.55, 2.15, 0.45);
  lamp.target.position.set(-0.1, 1, 0);
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
  const floorH = document.createElement('canvas');
  floorH.width = floorH.height = 512;
  {
    const c = floorH.getContext('2d');
    c.fillStyle = '#808080'; c.fillRect(0, 0, 512, 512);
    const rnd = mulberry(11);
    for (let i = 0; i < 9000; i++) { const g = 110 + rnd() * 40; c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
    c.fillStyle = '#3a3a3a';
    for (let i = 0; i <= 4; i++) { c.fillRect(i * 128 - 2, 0, 4, 512); c.fillRect(0, i * 128 - 2, 512, 4); }
  }
  const floorN = normalFromHeight(floorH, 3);
  floorN.repeat.set(4, 4);
  const floor = add(lab, new THREE.PlaneGeometry(9, 7.5), mat('#ffffff', 0.32, 0, { map: floorTex, normalMap: floorN, normalScale: new THREE.Vector2(0.6, 0.6) }), [0, 0, 0.25], [-Math.PI / 2, 0, 0]);
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
  for (const [x, role] of [[2.0, 'staffA'], [3.1, 'staffB']]) {
    const p = makePerson(personSrc, role);
    p.position.set(x, -0.49, -4.74);
    p.rotation.y = Math.PI;
    ctrl.add(p);
  }
  // אבא: עומד עם מחשב נייד ומסתכל אל המעבדה
  const dad = makePerson(personSrc, 'dad');
  dad.position.set(1.5, 0, -4.35);
  dad.rotation.y = 0.35;
  ctrl.add(dad);
  const laptop = group(dad, [0, 1.07, 0.36]);
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
  // מיטת ניתוח אמיתית (מתוך ערכת הציוד). מודדים את גובה המזרן ואת הרוחב שלו
  const table = placeModel(bed, equip.getObjectByName('Obj_OP_Bett'), { scale: EQ }, [0, 0, 0], TABLE_ROT);
  bed.updateMatrixWorld(true);
  const top = surfaceY(table, 0.3, 0);
  let edge = 0.05;
  while (edge < 0.6 && surfaceY(table, 0.3, edge + 0.01) > top - 0.03) edge += 0.01;
  const dy = top - 1.055; // כמה המזרן גבוה (או נמוך) מהמיטה הקודמת
  // המטופל: שוכב על הגב, הראש על הכרית, ומעליו סדין שנופל על הגוף
  add(bed, rbox(0.36, 0.08, 0.42, 0.04), mat('#f7f9fc', 0.85), [0.83, top + 0.035, 0]);
  const patient = makePerson(personSrc, 'patient');
  patient.setRotationFromMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
  patient.position.set(-0.92, top + 0.085, 0);
  bed.add(patient);
  bed.updateMatrixWorld(true);
  const sheetGeo = drapeSheet([patient, table], { x0: -1.16, x1: 0.56, z0: -edge - 0.15, z1: edge + 0.15, edge: edge + 0.01, top: top + 0.015 });
  const sheetM = new THREE.MeshPhysicalMaterial({ color: '#3f78b8', roughness: 0.95, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color('#9cc0f0'), side: THREE.DoubleSide });
  add(bed, sheetGeo, sheetM);
  // הלב, פועם מעל החזה
  const { group: heartG, mats: heartMats } = patientHeart(heartSrc);
  heartG.position.set(0.42, 1.36 + dy, 0.02);
  heartG.rotation.set(-0.3, 0.4, 0);
  bed.add(heartG);
  tag(bed, 'patient');

  // ---- 5: משטח המיקום ----
  const pad = group(lab, [0.42, top - 0.03, 0]);
  const padM = new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.45, emissive: '#ff2a2a', emissiveIntensity: 0.12 });
  add(pad, rbox(0.52, 0.025, 2 * edge + 0.1, 0.008), padM);
  const coilM = mat('#ffd0ce', 0.4, 0, { emissive: '#ff8a85', emissiveIntensity: 0.6 });
  for (const x of [-0.17, 0, 0.17]) add(pad, new THREE.TorusGeometry(0.035, 0.006, 8, 24), coilM, [x, 0.0, edge + 0.05], [0, 0, 0]);
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
  // הרופא: סריקה תלת־ממדית של רופא בבגדי ניתוח, עם כובע, מסכה וכפפות
  const doc = placeModel(lab, surgeonGltf.scene, { height: 1.8 }, [0.0, 0, -0.68], SURGEON_ROT);
  const handR = new THREE.Vector3(-0.12, top + 0.22, -0.36);
  const handL = new THREE.Vector3(0.06, top + 0.2, -0.3);
  const catheterM = mat('#3d6fe0', 0.35, 0.1);
  const groin = new THREE.Vector3(0.08, top + 0.1, -0.08);
  const catheter = new THREE.CatmullRomCurve3([
    handR.clone().add(new THREE.Vector3(0.02, -0.03, 0.04)), handL.clone().lerp(groin, 0.4).add(new THREE.Vector3(0, 0.05, 0)), groin,
  ]);
  add(lab, new THREE.TubeGeometry(catheter, 40, 0.005, 8), catheterM);
  add(lab, new THREE.CapsuleGeometry(0.016, 0.11, 4, 10), mat('#e8ecf5', 0.4), handR.clone().add(new THREE.Vector3(0, -0.02, 0)).toArray(), [Math.PI / 2.3, 0, 0]);
  const cable = new THREE.CatmullRomCurve3([
    handR.clone().add(new THREE.Vector3(0, -0.05, -0.06)), new THREE.Vector3(handR.x - 0.1, 0.7, -0.5), new THREE.Vector3(-0.2, 0.02, -0.95),
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
  const opLight = placeModel(lab, equip.getObjectByName('Obj_Oplicht'), { height: 1.05 }, [-0.75, WH - 1.05, 0.55], LAMP_ROT);

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
  const act = activationHeart(heartSrc);
  act.mesh.position.x = -0.3;
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
  const rec = group(lab, [-3.3, 0, -0.45], 0.85);
  const tower = placeModel(rec, equip.getObjectByName('Obj_Computer'), { scale: EQ }, [0, 0, 0], TOWER_ROT);
  const recAg = gltfTexture(recA), recBg = gltfTexture(recB);
  // במסך העליון של המגדל התמונה מסובבת ברבע סיבוב
  recBg.center.set(0.5, 0.5);
  recBg.rotation = -Math.PI / 2;
  const screenMats = {
    Obj_Computer_Mat_Display_1_0: recAg, Obj_Computer_Mat_Display2_0: recBg, Obj_Computer_Mat_Display_3_0: recAg, Obj_Computer_Mat_Fernseher_0: recBg,
  };
  tower.traverse((o) => {
    if (o.isMesh && screenMats[o.name]) o.material = new THREE.MeshBasicMaterial({ map: screenMats[o.name], toneMapped: false });
  });
  tag(rec, 'recording');

  // ---- 4: מגש הקטטרים ----
  const tray = group(lab, [-1.9, 0, 0.9], 0.2);
  const trolley = placeModel(tray, equip.getObjectByName('Obj_Schiebewagen'), { scale: EQ }, [0, 0, 0], 0);
  tray.updateMatrixWorld(true);
  const trayTop = new THREE.Box3().setFromObject(trolley).max.y - tray.position.y;
  add(tray, new THREE.BoxGeometry(0.42, 0.004, 0.62), mat('#4fa3a5', 0.9), [0, trayTop + 0.002, 0]);
  const coil = (cx, cz, r, turns, color, tipColor) => {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = i / 160 * Math.PI * 2 * turns;
      const rr = r * (1 - i / 160 * 0.35);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, trayTop + 0.01 + i * 0.00003, cz + Math.sin(a) * rr));
    }
    add(tray, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0055, 8), mat(color, 0.35, 0.05));
    const end = pts[pts.length - 1];
    add(tray, new THREE.SphereGeometry(0.011, 10, 8), mat(tipColor, 0.2, 0.7), end.toArray());
  };
  coil(0, -0.15, 0.14, 3, '#3d6fe0', '#d0d6e0');
  coil(0.02, 0.16, 0.12, 3, '#f2f4f8', '#ffb52e');
  // קטטר "פרח": קצה עם כמה זרועות
  const flower = group(tray, [0.1, trayTop + 0.02, 0.0]);
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
  placeModel(lab, ivGltf.scene, { height: 2.0 }, [1.4, 0, -0.55], 0);
  add(lab, new THREE.CapsuleGeometry(0.06, 0.14, 6, 14), bagM, [1.4, 1.72, -0.47], null, [1, 1, 0.5]);
  // מוניטור לצד הראש, שמראה את הדופק של המטופל
  const ecgStand = placeModel(lab, ecgGltf.scene, { height: 1.55 }, [1.75, 0, 0.75], ECG_ROT);
  const recAg2 = gltfTexture(recA);
  ecgStand.traverse((o) => {
    if (o.isMesh && /Display/.test(o.name)) o.material = new THREE.MeshBasicMaterial({ map: recAg2, toneMapped: false });
  });
  // עגלת ציוד ליד הקיר
  placeModel(lab, cartGltf.scene, { height: 0.9 }, [3.95, 0, 2.3], -Math.PI / 2);

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
    heartG.scale.setScalar(1 + 0.1 * pulse);
    for (const m of heartMats) m.emissiveIntensity = 0.08 + 0.45 * pulse;

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
      recAg.needsUpdate = recBg.needsUpdate = recAg2.needsUpdate = true;
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
  }

  return {
    pickables,
    update,
    setActive(id) { active = id; },
  };
}
