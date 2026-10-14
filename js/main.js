// הסצנה, המצלמה, הסיור בתחנות והממשק.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildLab } from './lab.js';
import { STATIONS, INTRO, OUTRO, OVERVIEW_VIEW, QUIZ_RIGHT, QUIZ_WRONG } from './data.js';
import { GLOSSARY } from './glossary.js';
import { Narrator, splitSentences } from './speech.js';
import { Presenter } from './presenter.js';

const $ = (id) => document.getElementById(id);
const phone = () => window.innerWidth <= 720;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// הטקסטים על הקנבסים בסצנה צריכים את הגופן לפני שמציירים אותם
await Promise.race([
  document.fonts.load('700 40px Rubik').then(() => document.fonts.load('500 40px Rubik')),
  new Promise((r) => setTimeout(r, 2000)),
]).catch(() => {});

// ---------- סצנה ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone() ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('scene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1024');

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 60);
camera.position.set(...OVERVIEW_VIEW.cam);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...OVERVIEW_VIEW.at);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 0.4;
controls.maxDistance = 10;
controls.maxPolarAngle = 1.52;
controls.autoRotateSpeed = 0.35;

const lab = await buildLab(scene, renderer, (f) => {
  $('loading').textContent = `טוען את המעבדה… ${Math.round(f * 100)}%`;
});
$('loading').hidden = true;
$('btn-start').disabled = false;
$('btn-explore').disabled = false;

// ---------- עיבוד התמונה: צל רך בפינות ובמגע בין חפצים (AO), זוהר עדין למסכים ולאורות ----------
// במחשב חלש או בטלפון מוותרים על ה־AO, שהוא הכי כבד
const highQuality = !phone() && (navigator.hardwareConcurrency || 8) >= 4;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
if (highQuality) {
  const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtao.updateGtaoMaterial({ radius: 0.4, distanceExponent: 1.2, thickness: 1, scale: 1, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
}
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.4, 0.98));
composer.addPass(new OutputPass());

// ---------- מצלמה ----------
// חלון ההסבר מכסה חלק מהמסך, ולכן מזיזים את מרכז התמונה אל החלק הפנוי
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  const base = w / h < 0.8 ? 64 : w / h < 1.2 ? 55 : 46;
  const panel = $('panel');
  const r = panel.hidden ? null : panel.getBoundingClientRect();
  camera.clearViewOffset();
  if (r && phone()) {
    const ph = Math.max(0, h - r.top);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) * (h + ph) / h));
    camera.aspect = w / (h + ph);
    camera.setViewOffset(w, h + ph, 0, ph, w, h);
  } else if (r) {
    const pw = Math.max(0, w - r.left);
    camera.fov = base;
    camera.aspect = (w + pw) / h;
    camera.setViewOffset(w + pw, h, pw, 0, w, h);
  } else {
    camera.fov = base;
    camera.aspect = w / h;
  }
  camera.updateProjectionMatrix();
  presenter.setSize($('presenter').clientWidth, $('presenter').clientHeight);
}

let flight = null;
function flyTo(view) {
  const to = { cam: new THREE.Vector3(...view.cam), at: new THREE.Vector3(...view.at) };
  // בטלפון המסך צר, אז מתרחקים קצת כדי שכל החפץ ייכנס
  if (phone() && view !== OVERVIEW_VIEW) to.cam.sub(to.at).multiplyScalar(1.45).add(to.at);
  const from = { cam: camera.position.clone(), at: controls.target.clone() };
  const dist = from.cam.distanceTo(to.cam);
  flight = { from, to, t: 0, dur: reduceMotion ? 0.01 : THREE.MathUtils.clamp(1.1 + dist * 0.18, 1.3, 2.4), lift: Math.min(0.7, dist * 0.12) };
  controls.enabled = false;
  controls.autoRotate = false;
}

function stepFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / flight.dur);
  const t = flight.t;
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(flight.from.cam, flight.to.cam, e);
  camera.position.y += Math.sin(Math.PI * e) * flight.lift;
  controls.target.lerpVectors(flight.from.at, flight.to.at, e);
  camera.lookAt(controls.target);
  if (t >= 1) {
    flight = null;
    controls.enabled = true;
  }
}

// ---------- נקודות התחנות ----------
const spots = STATIONS.map((s, i) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'spot';
  el.innerHTML = `<b>${i + 1}</b><span>${s.emoji} ${s.title}</span>`;
  el.setAttribute('aria-label', `תחנה ${i + 1}: ${s.title}`);
  el.addEventListener('click', () => go(i));
  $('labels').appendChild(el);
  return { el, pos: new THREE.Vector3(...s.view.spot) };
});

const v = new THREE.Vector3();
function placeSpots() {
  const w = window.innerWidth, h = window.innerHeight;
  for (const s of spots) {
    v.copy(s.pos).project(camera);
    const hidden = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
    s.el.style.display = hidden ? 'none' : '';
    if (!hidden) s.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
  }
}

// לחיצה על חפץ בסצנה עוברת לתחנה שלו
const raycaster = new THREE.Raycaster();
const owners = new Map(lab.pickables.map(([o, id]) => [o, id]));
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !$('intro').hidden) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  for (const hit of raycaster.intersectObjects(lab.pickables.map(([o]) => o), true)) {
    let o = hit.object;
    while (o && !owners.has(o)) o = o.parent;
    if (o) {
      const i = STATIONS.findIndex((s) => s.id === owners.get(o));
      if (i !== current) go(i);
      return;
    }
  }
});

// ---------- נועם והקריין ----------
const narrator = new Narrator();
const presenter = new Presenter($('presenter'));
narrator.onBoundary = () => presenter.pulse();
let voiceOn = true;

function speak(text, onEnd) {
  const sentences = [...document.querySelectorAll('#panel-body .narration span')];
  sentences.forEach((s) => s.classList.remove('speaking'));
  if (!voiceOn) return;
  narrator.speak(text, {
    onSentence: (k) => {
      sentences.forEach((s, j) => s.classList.toggle('speaking', j === k));
      sentences[k]?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    },
    onEnd: () => {
      sentences.forEach((s) => s.classList.remove('speaking'));
      onEnd?.();
    },
  });
}

function updateVoiceNote() {
  const note = $('voice-note');
  if (!note) return;
  note.hidden = narrator.hasHebrew || !voiceOn;
}
narrator.onVoiceChange = updateVoiceNote;

// ---------- הסיור ----------
let current = -1; // ‎-1 = פתיחה, STATIONS.length = סיום
const visited = new Set();

function narrationHTML(text) {
  return `<p class="narration">${splitSentences(text).map((s) => `<span>${s}</span>`).join(' ')}</p>`;
}

function go(i, { silent = false } = {}) {
  current = THREE.MathUtils.clamp(i, -1, STATIONS.length);
  const s = STATIONS[current];
  const body = $('panel-body');
  let text;
  if (!s) {
    const intro = current < 0;
    text = intro ? INTRO.narration : OUTRO.narration;
    body.innerHTML = `
      <span class="big-emoji">${intro ? '❤️' : '🎉'}</span>
      <div class="kicker">${intro ? 'יום ההורים' : 'סוף הסיור'}</div>
      <h2>${intro ? 'מסע במעבדת ה־EP' : 'כל הכבוד!'}</h2>
      ${narrationHTML(text)}
      <p class="hint">👆 לחצו על נקודה ממוספרת או על חפץ במעבדה. אפשר גם לסובב את המעבדה עם האצבע או העכבר.</p>
      <p class="voice-note" id="voice-note" hidden>אין במכשיר הזה קול בעברית, אז ההסברים מופיעים כטקסט.</p>`;
    flyTo(OVERVIEW_VIEW);
    lab.setActive(null);
    presenter.play('wave', 2.5);
  } else {
    visited.add(current);
    text = s.narration;
    body.innerHTML = `
      <span class="big-emoji">${s.emoji}</span>
      <div class="kicker">תחנה ${current + 1} מתוך ${STATIONS.length}</div>
      <h2>${s.title}</h2>
      ${narrationHTML(text)}
      ${s.facts ? `<table class="facts">${s.facts.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join('')}</table>` : ''}
      ${s.funFact ? `<div class="fun"><b>הידעתם?</b> ${s.funFact}</div>` : ''}
      ${s.quiz ? quizHTML(s.quiz) : ''}`;
    if (s.quiz) setupQuiz(s.quiz);
    flyTo(s.view);
    lab.setActive(s.id);
    presenter.play('point', 2.4);
  }
  body.scrollTop = 0;
  updateVoiceNote();
  spots.forEach(({ el }, j) => {
    el.classList.toggle('on', j === current);
    el.classList.toggle('visited', visited.has(j));
  });
  $('labels').classList.toggle('focused', !!s);
  [...$('dots').children].forEach((d, j) => {
    d.classList.toggle('on', j === current);
    d.setAttribute('aria-current', j === current ? 'step' : 'false');
  });
  $('btn-prev').disabled = current < 0;
  $('btn-next').textContent = current < 0 ? 'מתחילים ←' : current === STATIONS.length - 1 ? 'סיום ←' : current >= STATIONS.length ? 'מההתחלה ←' : 'הבאה ←';
  $('btn-next').classList.remove('ready');
  if (silent) narrator.stop();
  else speak(text, () => $('btn-next').classList.add('ready'));
  requestAnimationFrame(layout);
}

STATIONS.forEach((s, i) => {
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'dot';
  d.textContent = i + 1;
  d.title = s.title;
  d.setAttribute('aria-label', `תחנה ${i + 1}: ${s.title}`);
  d.addEventListener('click', () => go(i));
  $('dots').appendChild(d);
});

$('btn-prev').addEventListener('click', () => go(current - 1));
$('btn-next').addEventListener('click', () => go(current >= STATIONS.length ? -1 : current + 1));
$('btn-overview').addEventListener('click', () => {
  narrator.stop();
  flyTo(OVERVIEW_VIEW);
  lab.setActive(null);
});
document.addEventListener('keydown', (e) => {
  if (!$('intro').hidden || $('glossary').open) return;
  // בעברית "הבאה" נמצאת משמאל
  if (e.key === 'ArrowLeft' && current < STATIONS.length) go(current + 1);
  if (e.key === 'ArrowRight' && current > -1) go(current - 1);
});

// ---------- חידון ----------
function quizHTML(quiz) {
  return `<div class="quiz">${quiz.map((q, i) => `
    <div class="quiz-q" data-i="${i}">
      <p>${i + 1}. ${q.q}</p>
      <div class="opts">${q.options.map((o) => `<button class="opt" type="button">${o}</button>`).join('')}</div>
      <div class="feedback" aria-live="polite"></div>
    </div>`).join('')}
    <p>הציון שלכם: <b id="score">0</b> מתוך ${quiz.length}</p></div>`;
}

function setupQuiz(quiz) {
  document.querySelectorAll('.quiz-q').forEach((el) => {
    const q = quiz[+el.dataset.i];
    el.querySelectorAll('.opt').forEach((btn, j) => {
      btn.addEventListener('click', () => {
        if (el.dataset.done) return;
        const right = j === q.answer;
        btn.classList.add(right ? 'right' : 'wrong');
        el.querySelector('.feedback').textContent = right ? `${QUIZ_RIGHT} 🎉` : QUIZ_WRONG;
        if (right) el.dataset.done = '1';
        $('score').textContent = document.querySelectorAll('.opt.right').length;
        presenter.play(right ? 'wave' : 'open', 1.6);
        if (voiceOn) narrator.speak(right ? QUIZ_RIGHT : QUIZ_WRONG);
      });
    });
  });
}

// ---------- מילון ----------
const glossaryList = $('glossary-list');
GLOSSARY.forEach((g) => {
  const d = document.createElement('details');
  d.innerHTML = `<summary>${g.emoji} ${g.title}</summary><div>${g.text}</div>`;
  d.addEventListener('toggle', () => {
    if (d.open && voiceOn) {
      glossaryList.querySelectorAll('details[open]').forEach((o) => o !== d && (o.open = false));
      narrator.speak(g.text);
      presenter.play('open', 2);
    }
  });
  glossaryList.appendChild(d);
});
$('btn-glossary').addEventListener('click', () => { narrator.unlock(); $('glossary').showModal(); });
$('glossary-close').addEventListener('click', () => $('glossary').close());
$('glossary').addEventListener('click', (e) => { if (e.target === $('glossary')) $('glossary').close(); });
$('glossary').addEventListener('close', () => narrator.stop());

// ---------- כפתורים ----------
$('btn-voice').addEventListener('click', () => {
  voiceOn = !voiceOn;
  $('btn-voice').textContent = voiceOn ? '🔊' : '🔇';
  $('btn-voice').setAttribute('aria-pressed', voiceOn);
  $('btn-voice').title = voiceOn ? 'השתקת הקריין' : 'הפעלת הקריין';
  if (!voiceOn) narrator.stop();
  updateVoiceNote();
});
$('btn-guide').addEventListener('click', () => {
  const el = $('presenter');
  el.hidden = !el.hidden;
  $('btn-guide').setAttribute('aria-pressed', !el.hidden);
  if (!el.hidden) layout();
});

function start(tour) {
  narrator.unlock();
  $('intro').hidden = true;
  $('panel').hidden = false;
  document.body.classList.add('started');
  go(-1, { silent: !tour });
}
$('btn-start').addEventListener('click', () => start(true));
$('btn-explore').addEventListener('click', () => start(false));
$('btn-tour').addEventListener('click', () => {
  if (!$('intro').hidden) start(true);
  else go(0);
});

// ---------- לולאה ----------
const clock = new THREE.Clock();
let time = 0;
function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  time += dt;
  stepFlight(dt);
  if (!flight) controls.update();
  lab.update(time, dt);
  composer.render(dt);
  placeSpots();
  if (!$('presenter').hidden) presenter.update(dt, narrator.speaking, phone() ? 0.2 : 0.5);
}

window.addEventListener('resize', layout);
new ResizeObserver(() => layout()).observe($('panel'));
layout();
controls.autoRotate = !reduceMotion;
renderer.setAnimationLoop(animate);
presenter.play('wave', 3);
document.body.classList.add('ready');
