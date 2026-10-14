// אנשים במעבדה: דמות תלת־ממדית אמיתית (Ready Player Me, מתוך הדוגמאות של three.js),
// שמלבישים לה בגדים לפי התפקיד ומעמידים אותה בתנוחה (בלי אנימציה, רק סיבוב עצמות).
// במודל המקורי הדמות מסתכלת לכיוון +z, הצד השמאלי שלה ב־+x, והגובה בערך 1.87 מ'.

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();

// מסובב עצם כך שהכיוון ממנה אל העצם הבאה יהיה dir (במרחב של הדמות)
function aim(model, bone, child, dir) {
  model.updateMatrixWorld(true);
  const b = model.getObjectByName(bone);
  const c = model.getObjectByName(child);
  if (!b || !c) return;
  const cur = c.getWorldPosition(v2).sub(b.getWorldPosition(v1)).normalize();
  q1.setFromUnitVectors(cur, v1.set(...dir).normalize());
  b.getWorldQuaternion(q2);
  b.parent.getWorldQuaternion(q3);
  b.quaternion.copy(q3.invert().multiply(q1.multiply(q2)));
  model.updateMatrixWorld(true);
}

// x הפוך לצד ימין
const mirror = ([x, y, z]) => [-x, y, z];

const POSES = {
  stand: { arm: [0.1, -1, 0], fore: [0.02, -1, 0.12] },
  reach: { spine: [0, 1, 0.22], arm: [0.25, -0.62, 0.75], fore: [-0.3, -0.35, 0.9] },
  laptop: { arm: [0.12, -0.95, 0.22], fore: [-0.2, -0.05, 1] },
  sit: { arm: [0.15, -0.75, 0.6], fore: [-0.12, -0.15, 1], thigh: [0.05, -0.05, 1], shin: [0, -1, 0.08] },
  lie: { arm: [0.07, -1, 0.03], fore: [0.02, -1, 0.06], foot: [0, -1, 0.45] },
};

function pose(model, name) {
  const p = POSES[name];
  if (p.spine) aim(model, 'Spine', 'Spine2', p.spine);
  for (const [side, d] of [['Left', (x) => x], ['Right', mirror]]) {
    aim(model, `${side}Arm`, `${side}ForeArm`, d(p.arm));
    aim(model, `${side}ForeArm`, `${side}Hand`, d(p.fore));
    if (p.foot) aim(model, `${side}Foot`, `${side}ToeBase`, d(p.foot));
    if (p.thigh) {
      aim(model, `${side}UpLeg`, `${side}Leg`, d(p.thigh));
      aim(model, `${side}Leg`, `${side}Foot`, d(p.shin));
    }
  }
}

// גרסה אפורה של טקסטורת הבגדים: שומרת את הקפלים והתפרים, ואת הצבע נותנים בחומר
const grayCache = new Map();
function grayTexture(tex) {
  if (grayCache.has(tex)) return grayCache.get(tex);
  const img = tex.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  let sum = 0;
  for (let i = 0; i < d.data.length; i += 4) sum += d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
  const mean = sum / (d.data.length / 4) || 1;
  for (let i = 0; i < d.data.length; i += 4) {
    const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    const g = Math.max(0, Math.min(255, 215 + (l - mean) * 0.9));
    d.data[i] = d.data[i + 1] = d.data[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  grayCache.set(tex, t);
  return t;
}

function dress(mesh, color, roughness = 0.88) {
  const m = mesh.material.clone();
  if (m.map) m.map = grayTexture(m.map);
  m.color = new THREE.Color(color);
  m.roughness = roughness;
  m.metalness = 0;
  m.metalnessMap = null;
  m.roughnessMap = null;
  mesh.material = m;
}

// מחבר אובייקט לעצם, ושומר על המיקום שלו בעולם
function attach(model, boneName, obj) {
  model.updateMatrixWorld(true);
  model.add(obj);
  obj.updateMatrixWorld(true);
  model.getObjectByName(boneName).attach(obj);
}

// סינר עופרת: עותק "מנופח" מעט של חולצת הדמות, בלי השרוולים, שזז עם אותן עצמות
function addApron(model, color) {
  const top = model.getObjectByName('Wolf3D_Outfit_Top');
  // מיישרים את הפפיון והדשים שבולטים קדימה, כדי שהסינר ייראה חלק
  top.geometry = top.geometry.clone();
  const tp = top.geometry.attributes.position;
  // בין החזה לצוואר: z לא יותר מקו ישר בין 0.147 (בגובה 1.34) ל־0.085 (בגובה 1.50)
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    if (y < 1.34 || y > 1.52 || Math.abs(tp.getX(i)) > 0.11) continue;
    const limit = 0.147 + (y - 1.34) * (0.085 - 0.147) / 0.16 - 0.006;
    if (tp.getZ(i) > limit) tp.setZ(i, limit);
  }
  top.geometry.computeVertexNormals();
  const geo = top.geometry.clone();
  const bones = top.skeleton.bones;
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const isArm = (i) => {
    let best = 0, w = -1;
    for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > w) { w = sw.getComponent(i, k); best = si.getComponent(i, k); }
    return /Arm|Hand/.test(bones[best].name);
  };
  const idx = geo.index.array;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (!isArm(idx[t]) && !isArm(idx[t + 1]) && !isArm(idx[t + 2])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  geo.setIndex(keep);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.016, pos.getY(i) + nor.getY(i) * 0.016, pos.getZ(i) + nor.getZ(i) * 0.016);
  }
  const apron = new THREE.SkinnedMesh(geo, new THREE.MeshPhysicalMaterial({
    color, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color('#9fb8d8'),
  }));
  apron.castShadow = true;
  apron.frustumCulled = false;
  top.parent.add(apron);
  apron.bind(top.skeleton, top.bindMatrix);
}

const ROLES = {
  doctor: { top: '#2b8a8c', bottom: '#2b8a8c', shoes: '#e9edf2', cap: '#3d7fd6', mask: true, apron: '#2f4f6f', beard: false, pose: 'reach' },
  dad: { top: '#34507f', bottom: '#2b2f3a', hair: '#2b1d14', beard: false, pose: 'laptop' },
  staffA: { top: '#4f8fd8', bottom: '#4f8fd8', shoes: '#e9edf2', hair: '#2b1d14', beard: false, pose: 'sit' },
  staffB: { top: '#7e57c2', bottom: '#7e57c2', shoes: '#e9edf2', hair: '#6b4428', beard: true, pose: 'sit' },
  patient: { top: '#a9c4dc', bottom: '#a9c4dc', hair: '#3a2a20', beard: true, pose: 'lie' },
};

export function makePerson(source, role) {
  const r = ROLES[role];
  const model = SkeletonUtils.clone(source);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // לדמות עם עצמות אין תיבת גבולות מעודכנת
    if (o.name === 'Wolf3D_Headwear') o.visible = false;
    if (o.name === 'Wolf3D_Beard') o.visible = r.beard;
    if (o.name === 'Wolf3D_Outfit_Top') dress(o, r.top);
    if (o.name === 'Wolf3D_Outfit_Bottom') dress(o, r.bottom);
    if (o.name === 'Wolf3D_Outfit_Footwear' && r.shoes) dress(o, r.shoes, 0.5);
    if (o.name === 'Wolf3D_Head' || o.name === 'Wolf3D_Body') {
      o.material = o.material.clone();
      o.material.roughness = 0.62;
    }
  });

  // שיער או כובע ניתוח, ומסכה
  const capColor = r.cap || r.hair;
  if (capColor) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 40, 20, 0, Math.PI * 2, 0, Math.PI * (r.cap ? 0.5 : 0.56)),
      new THREE.MeshStandardMaterial({ color: capColor, roughness: r.cap ? 0.9 : 0.75 }),
    );
    cap.position.set(0, r.cap ? 1.765 : 1.762, r.cap ? 0.0 : -0.012);
    cap.rotation.x = r.cap ? -0.12 : -0.42;
    cap.scale.set(0.97, 0.98, 1.1);
    if (!r.cap) {
      // שיער: קצת "מבולגן", כדי שלא ייראה כמו כובע חלק
      const hp = cap.geometry.attributes.position;
      let seed = 3;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < hp.count; i++) {
        const k = 1 + (rnd() - 0.5) * 0.06;
        hp.setXYZ(i, hp.getX(i) * k, hp.getY(i) * k, hp.getZ(i) * k);
      }
      cap.geometry.computeVertexNormals();
      cap.material.roughness = 0.95;
    }
    cap.castShadow = true;
    attach(model, 'Head', cap);
  }
  if (r.mask) {
    const mask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.092, 0.095, 32, 1, true, -1.2, 2.4),
      new THREE.MeshStandardMaterial({ color: '#cfeee9', roughness: 0.95, side: THREE.DoubleSide }),
    );
    mask.position.set(0, 1.655, 0.055);
    attach(model, 'Head', mask);
  }

  if (r.apron) addApron(model, r.apron);
  pose(model, r.pose);
  return model;
}
