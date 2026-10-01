import * as THREE from './three.module.min.js';

// =============== 기본 ===============
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const settings = Object.assign({ sens: 1.2, quality: isTouch ? 'low' : 'high', sound: true, assist: isTouch }, store.get('ns2_settings', {}));
const saveSettings = () => store.set('ns2_settings', settings);

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1220);
scene.fog = new THREE.Fog(0x0a1220, 20, 75);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 220);
scene.add(camera);
let baseFov = 72;

const hemi = new THREE.HemisphereLight(0xa8c8ff, 0x3a2a40, 1.8);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0x6080a0, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(20, 35, 12);
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 90 });
scene.add(sun);

function applyQuality() {
  const hi = settings.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, hi ? 2 : 1.25));
  renderer.shadowMap.enabled = hi;
  sun.castShadow = hi;
  scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  baseFov = w < h ? 85 : 72;
  camera.updateProjectionMatrix();
  if (typeof checkRotate === 'function') checkRotate();
}
window.addEventListener('resize', resize);

// =============== 테마 ===============
const THEMES = [
  { name: 'NEON CITY', bg: 0x0a1220, neon: 0x2ab7ff, acc: 0xff5fa2, floor: '#1f2a3d', line: '#1f6f9a', hemi: 0xa8c8ff },
  { name: 'CRIMSON ZONE', bg: 0x1a0a12, neon: 0xff3b5c, acc: 0xffcf4d, floor: '#2e1c24', line: '#9a1f3a', hemi: 0xffc0c0 },
  { name: 'TOXIC LAB', bg: 0x08180e, neon: 0x5cff8a, acc: 0xb05cff, floor: '#1a2e22', line: '#1f9a4a', hemi: 0xb8ffd0 },
  { name: 'SOLAR CORE', bg: 0x1a1208, neon: 0xffa12a, acc: 0x2ab7ff, floor: '#2e2618', line: '#9a6a1f', hemi: 0xffe0b0 },
];
const neonMat = new THREE.MeshBasicMaterial({ color: 0x2ab7ff });
const accMat = new THREE.MeshBasicMaterial({ color: 0xff5fa2 });
const ARENA = 40;
const floorCanvas = document.createElement('canvas'); floorCanvas.width = floorCanvas.height = 256;
const floorTex = new THREE.CanvasTexture(floorCanvas);
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(ARENA / 2, ARENA / 2);
floorTex.colorSpace = THREE.SRGBColorSpace; floorTex.anisotropy = 4;
let themeIdx = 0;
function applyTheme(i) {
  themeIdx = i % THEMES.length;
  const T = THEMES[themeIdx];
  scene.background.setHex(T.bg); scene.fog.color.setHex(T.bg);
  neonMat.color.setHex(T.neon); accMat.color.setHex(T.acc);
  hemi.color.setHex(T.hemi);
  const g = floorCanvas.getContext('2d');
  g.fillStyle = T.floor; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = T.line; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  floorTex.needsUpdate = true;
  const hex = '#' + T.neon.toString(16).padStart(6, '0');
  document.documentElement.style.setProperty('--neon', hex);
  jumpPads.forEach(p => p.ring.material.color.setHex(T.acc));
}

// =============== 맵 ===============
const colliders = [];
const worldMeshes = [];
const jumpPads = [];
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: .85, metalness: .1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor); worldMeshes.push(floor);

function crateTexture(base, line) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  g.lineWidth = 3; g.beginPath(); g.moveTo(6, 6); g.lineTo(122, 122); g.moveTo(122, 6); g.lineTo(6, 122); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const matCrate = new THREE.MeshStandardMaterial({ map: crateTexture('#3e4f70', '#5fd4ff'), roughness: .7, metalness: .1 });
const matCrate2 = new THREE.MeshStandardMaterial({ map: crateTexture('#5a3a52', '#ff5fa2'), roughness: .7, metalness: .1 });
const matWall = new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: .9, emissive: 0x0a1a2c });
const matPillar = new THREE.MeshStandardMaterial({ color: 0x4a5a78, roughness: .6, metalness: .3 });

function addBox(x, z, w, h, d, mat, y0 = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y0 + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  scene.add(m); worldMeshes.push(m);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y0 + h, bottom: y0 });
  return m;
}
const WH = 6;
addBox(0, -ARENA - .5, ARENA * 2 + 2, WH, 1, matWall);
addBox(0, ARENA + .5, ARENA * 2 + 2, WH, 1, matWall);
addBox(-ARENA - .5, 0, 1, WH, ARENA * 2, matWall);
addBox(ARENA + .5, 0, 1, WH, ARENA * 2, matWall);
[[0, -ARENA, ARENA * 2, .15], [0, ARENA, ARENA * 2, .15], [-ARENA, 0, .15, ARENA * 2], [ARENA, 0, .15, ARENA * 2]].forEach(([x, z, w, d]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, .12, d), neonMat); m.position.set(x, WH + .05, z); scene.add(m);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, .08, d), neonMat); m2.position.set(x, 1.2, z); scene.add(m2);
});

let seed = 7; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pillarPos = [[-14, -14], [14, -14], [-14, 14], [14, 14], [0, -24], [0, 24], [-24, 0], [24, 0]];
pillarPos.forEach(([x, z]) => {
  addBox(x, z, 2.4, 7, 2.4, matPillar);
  const ring = new THREE.Mesh(new THREE.BoxGeometry(2.5, .15, 2.5), accMat); ring.position.set(x, 3.2, z); scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, .1, 2.5), neonMat); ring2.position.set(x, 6.9, z); scene.add(ring2);
});
const padPos = [[-28, -28], [28, -28], [-28, 28], [28, 28], [0, -10], [0, 10]];
padPos.forEach(([x, z]) => {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, .2, 20), matPillar); base.position.set(x, .1, z); scene.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .09, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff5fa2 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(x, .25, z); scene.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.45, .6, 4), neonMat); arrow.position.set(x, .9, z); scene.add(arrow);
  jumpPads.push({ x, z, ring, arrow });
});
for (let i = 0; i < 30; i++) {
  const x = (srnd() - .5) * (ARENA * 2 - 10), z = (srnd() - .5) * (ARENA * 2 - 10);
  if (Math.hypot(x, z) < 7) continue;
  if (pillarPos.some(([px, pz]) => Math.abs(px - x) < 3.5 && Math.abs(pz - z) < 3.5)) continue;
  if (padPos.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4)) continue;
  const s = 1.4 + srnd() * .8, m = srnd() < .5 ? matCrate : matCrate2;
  addBox(x, z, s, s, s, m);
  if (srnd() < .35) addBox(x + (srnd() - .5) * .3, z + (srnd() - .5) * .3, s * .8, s * .8, s * .8, m, s);
}
addBox(0, 0, 5, 1.1, 5, matPillar);
{ const m = new THREE.Mesh(new THREE.BoxGeometry(5.05, .08, 5.05), neonMat); m.position.set(0, 1.1, 0); scene.add(m); }

{ // 별
  const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * .5 + .08, r = 160; p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fd8ff, size: .6, fog: false })));
}

function collideXZ(p, r, feetY, headY) {
  let hit = false;
  for (const c of colliders) {
    if (feetY >= c.top - .01 || headY <= c.bottom) continue;
    const cx = Math.max(c.minX, Math.min(p.x, c.maxX)), cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; p.x += dx / d * push; p.z += dz / d * push; }
      else {
        const o = [p.x - c.minX + r, c.maxX - p.x + r, p.z - c.minZ + r, c.maxZ - p.z + r], m = Math.min(...o);
        if (m === o[0]) p.x = c.minX - r; else if (m === o[1]) p.x = c.maxX + r; else if (m === o[2]) p.z = c.minZ - r; else p.z = c.maxZ + r;
      }
    }
  }
  return hit;
}
function groundHeight(x, z, r, fromY) {
  let h = 0;
  for (const c of colliders) {
    if (x + r * .7 > c.minX && x - r * .7 < c.maxX && z + r * .7 > c.minZ && z - r * .7 < c.maxZ && c.top <= fromY + .05) h = Math.max(h, c.top);
  }
  return h;
}
function pointInCollider(p) {
  if (p.y <= 0) return true;
  for (const c of colliders) if (p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ && p.y < c.top && p.y > c.bottom) return true;
  return false;
}

// =============== 오디오 ===============
let actx = null, master = null, nb = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = .8; master.connect(actx.destination); } catch {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function noiseBuf(ctx, dur) { const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2; return b; }
function tone(ctx, out, t, type, f0, f1, dur, vol) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + .02);
}
function noise(ctx, out, t, f0, f1, dur, vol, q = 0) {
  const n = ctx.createBufferSource(); n.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + dur + .02);
}
let lastSfx = {};
function sfx(type, vol = 1) {
  if (!settings.sound) return;
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  if (lastSfx[type] && now - lastSfx[type] < .025) return; lastSfx[type] = now;
  if (!nb) nb = noiseBuf(ctx, .6);
  const t = now, out = ctx.createGain(); out.gain.value = .32 * vol; out.connect(master);
  switch (type) {
    case 'rifle': noise(ctx, out, t, 3500, 300, .13, 1); tone(ctx, out, t, 'square', 180, 40, .08, .5); break;
    case 'smg': noise(ctx, out, t, 4200, 500, .08, .8); tone(ctx, out, t, 'square', 240, 60, .05, .35); break;
    case 'shotgun': noise(ctx, out, t, 2500, 150, .3, 1.3); tone(ctx, out, t, 'sawtooth', 120, 30, .2, .6); break;
    case 'sniper': noise(ctx, out, t, 5000, 200, .45, 1.3); tone(ctx, out, t, 'square', 300, 30, .3, .6); tone(ctx, out, t + .05, 'sine', 2400, 600, .4, .15); break;
    case 'rocket': noise(ctx, out, t, 1200, 200, .5, .9); tone(ctx, out, t, 'sawtooth', 90, 200, .4, .3); break;
    case 'hit': tone(ctx, out, t, 'triangle', 900, 900, .07, .4); break;
    case 'head': tone(ctx, out, t, 'triangle', 1400, 1400, .08, .45); tone(ctx, out, t + .03, 'sine', 2200, 2200, .06, .2); break;
    case 'kill': tone(ctx, out, t, 'sine', 700, 1400, .12, .3); break;
    case 'boom': noise(ctx, out, t, 900, 60, .6, 1.4); tone(ctx, out, t, 'sine', 80, 30, .5, .8); break;
    case 'hurt': tone(ctx, out, t, 'sawtooth', 220, 90, .2, .4); break;
    case 'reload': [0, .25, .55].forEach((d, i) => tone(ctx, out, t + d, 'square', [500, 350, 700][i], [500, 350, 700][i], .05, .15)); break;
    case 'empty': tone(ctx, out, t, 'square', 1200, 1200, .03, .1); break;
    case 'pickup': tone(ctx, out, t, 'sine', 660, 660, .15, .3); tone(ctx, out, t + .08, 'sine', 990, 990, .15, .3); break;
    case 'eshot': tone(ctx, out, t, 'sine', 900, 200, .15, .18); break;
    case 'wave': [0, .15, .3].forEach((d, i) => tone(ctx, out, t + d, 'triangle', [440, 554, 659][i], [440, 554, 659][i], .3, .25)); break;
    case 'boss': [0, .35, .7].forEach(d => { tone(ctx, out, t + d, 'sawtooth', 110, 70, .3, .5); }); break;
    case 'slam': noise(ctx, out, t, 600, 40, .8, 1.6); tone(ctx, out, t, 'sine', 60, 25, .7, 1); break;
    case 'switch': tone(ctx, out, t, 'square', 400, 800, .06, .12); break;
    case 'dash': noise(ctx, out, t, 6000, 800, .25, .6, 4); break;
    case 'pad': tone(ctx, out, t, 'sine', 200, 900, .35, .35); break;
    case 'buy': tone(ctx, out, t, 'triangle', 880, 880, .08, .3); tone(ctx, out, t + .07, 'triangle', 1320, 1320, .12, .3); break;
    case 'nope': tone(ctx, out, t, 'square', 200, 150, .12, .2); break;
    case 'nade': tone(ctx, out, t, 'sine', 500, 250, .15, .25); break;
    case 'beep': tone(ctx, out, t, 'square', 1500, 1500, .05, .15); break;
  }
}

// =============== 무기 정의 ===============
const WEAPONS = {
  rifle:    { name: '라이플', icon: 'AR', rate: .1, dmg: 24, head: 2.2, mag: 30, reserve: Infinity, reload: 1.4, spread: .012, ads: .003, pellets: 1, kick: .011, zoom: 1.35, price: 0, sound: 'rifle', desc: '균형 잡힌 기본 자동소총. 탄약 무한' },
  smg:      { name: 'SMG', icon: 'SMG', rate: .06, dmg: 15, head: 1.8, mag: 40, reserve: 240, reload: 1.2, spread: .024, ads: .012, pellets: 1, kick: .007, zoom: 1.25, price: 700, sound: 'smg', desc: '초고속 연사. 근거리 제압용' },
  shotgun:  { name: '샷건', icon: 'SG', rate: .72, dmg: 14, head: 1.5, mag: 6, reserve: 36, reload: 1.9, spread: .075, ads: .05, pellets: 9, kick: .045, zoom: 1.15, price: 900, sound: 'shotgun', falloff: 22, desc: '산탄 9발. 가까울수록 강력' },
  sniper:   { name: '저격총', icon: 'SR', rate: 1.0, dmg: 160, head: 2.5, mag: 5, reserve: 25, reload: 2.2, spread: .04, ads: 0, pellets: 1, kick: .05, zoom: 3.4, price: 1400, sound: 'sniper', pierce: true, scope: true, desc: '관통 + 헤드샷 2.5배. 조준 시 스코프' },
  launcher: { name: '로켓', icon: 'RL', rate: .9, dmg: 190, head: 1, mag: 1, reserve: 8, reload: 1.5, spread: .01, ads: 0, pellets: 1, kick: .04, zoom: 1.3, price: 2000, sound: 'rocket', rocket: true, radius: 4.8, desc: '범위 폭발 피해. 자폭 주의' },
};
const WKEYS = Object.keys(WEAPONS);

// 강화
const UP = {
  dmg:    { name: '화력 강화', desc: '모든 무기 피해 +15%', max: 5, base: 300 },
  mag:    { name: '확장 탄창', desc: '탄창 용량 +25%', max: 4, base: 250 },
  reload: { name: '고속 재장전', desc: '재장전 속도 +12%', max: 4, base: 250 },
  hp:     { name: '강화 외골격', desc: '최대 체력 +20', max: 5, base: 300 },
  nade:   { name: '수류탄 가방', desc: '수류탄 최대 +1', max: 3, base: 400 },
  dash:   { name: '추진기 개조', desc: '대시 쿨다운 -20%', max: 3, base: 350 },
};
let up = {};
const magOf = k => Math.max(1, Math.round(WEAPONS[k].mag * (1 + .25 * up.mag)));
const reloadOf = k => WEAPONS[k].reload * (1 - .12 * up.reload);
const dmgMul = () => 1 + .15 * up.dmg;

// =============== 무기 모델 ===============
const gunHolder = new THREE.Group();
camera.add(gunHolder);
const GUN_HIP = new THREE.Vector3(.16, -.15, -.3), GUN_ADS = new THREE.Vector3(0, -.085, -.22);
gunHolder.position.copy(GUN_HIP);
const gm = {
  dark: new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: .45, metalness: .3, emissive: 0x151c28 }),
  mid: new THREE.MeshStandardMaterial({ color: 0x7a8aa2, roughness: .5, metalness: .3, emissive: 0x1a2230 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: .7 }),
};
const glowMats = {};
function buildGun(key) {
  const g = new THREE.Group();
  const colors = { rifle: 0x2ab7ff, smg: 0x5cff8a, shotgun: 0xffa12a, sniper: 0xb05cff, launcher: 0xff3b5c };
  const glow = glowMats[key] = new THREE.MeshBasicMaterial({ color: colors[key] });
  const add = (w, h, d, x, y, z, m, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
  let muzzle = -.7;
  if (key === 'rifle') {
    add(.09, .11, .5, 0, 0, -.1, gm.dark); add(.05, .05, .35, 0, .02, -.48, gm.mid); add(.07, .04, .2, 0, .08, -.1, gm.mid);
    add(.02, .02, .45, .05, 0, -.12, glow); add(.07, .16, .08, 0, -.12, .02, gm.dark, .25); add(.06, .15, .1, 0, -.12, -.2, gm.mid, -.15);
    add(.08, .09, .18, 0, -.01, .22, gm.dark);
  } else if (key === 'smg') {
    add(.1, .12, .36, 0, 0, -.05, gm.dark); add(.045, .045, .18, 0, .02, -.32, gm.mid); add(.06, .22, .07, 0, -.16, -.08, gm.mid);
    add(.02, .02, .3, .055, .02, -.05, glow); add(.07, .14, .07, 0, -.11, .08, gm.dark, .25); add(.04, .04, .16, 0, .0, .2, gm.mid);
    muzzle = -.45;
  } else if (key === 'shotgun') {
    add(.1, .12, .42, 0, 0, -.05, gm.dark); add(.07, .07, .5, 0, .03, -.45, gm.mid); add(.075, .06, .3, 0, -.05, -.4, gm.wood);
    add(.02, .02, .5, .05, .05, -.3, glow); add(.08, .1, .24, 0, -.03, .25, gm.wood); add(.07, .14, .07, 0, -.11, .05, gm.dark, .25);
    muzzle = -.75;
  } else if (key === 'sniper') {
    add(.08, .1, .6, 0, 0, -.1, gm.dark); add(.04, .04, .55, 0, .02, -.65, gm.mid); add(.06, .06, .28, 0, .12, -.1, gm.dark);
    add(.075, .075, .03, 0, .12, -.25, glow); add(.075, .075, .03, 0, .12, .05, glow); add(.02, .02, .5, .045, -.01, -.15, glow);
    add(.07, .14, .07, 0, -.11, .03, gm.dark, .25); add(.08, .11, .22, 0, -.02, .28, gm.dark); add(.05, .1, .08, 0, -.1, -.22, gm.mid);
    muzzle = -.95;
  } else if (key === 'launcher') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .8, 12), gm.dark); tube.rotation.x = Math.PI / 2; tube.position.set(0, .03, -.2); g.add(tube);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .06, 12), glow); ring.rotation.x = Math.PI / 2; ring.position.set(0, .03, -.58); g.add(ring);
    const ring2 = ring.clone(); ring2.position.z = .17; g.add(ring2);
    add(.07, .15, .07, 0, -.12, -.05, gm.dark, .25); add(.06, .1, .12, 0, .14, -.15, gm.mid);
    muzzle = -.65;
  }
  g.userData.muzzle = muzzle;
  g.visible = false;
  gunHolder.add(g);
  return g;
}
const gunModels = {};
WKEYS.forEach(k => gunModels[k] = buildGun(k));
gunHolder.scale.setScalar(.56);

const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.3, 'rgba(255,200,80,.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
flash.scale.set(.3, .3, .3); flash.visible = false;
const flashLight = new THREE.PointLight(0xffb040, 0, 9);
gunHolder.add(flash); gunHolder.add(flashLight);

// =============== 플레이어 ===============
const P = {
  pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
  hp: 100, maxHp: 100, armor: 0, onGround: true, radius: .4, eye: 1.6,
  reloading: 0, fireCd: 0, switchT: 0, aiming: false, aimT: 0,
  bob: 0, spread: 0, recoilAcc: 0, sprint: false, nades: 2, dashCd: 0, dashT: 0, invul: 0,
};
let inventory = ['rifle'], curW = 'rifle';
const wstate = {};
const maxNades = () => 2 + up.nade;
const dashCdMax = () => 3 * (1 - .2 * up.dash);
const input = { mx: 0, mz: 0, fire: false, jump: false };
const keys = {};

// =============== 이펙트 ===============
const particles = [];
const pGeo = new THREE.BoxGeometry(.08, .08, .08);
const pMats = {};
function pMat(color) { return pMats[color] || (pMats[color] = new THREE.MeshBasicMaterial({ color })); }
function burst(pos, color, n = 8, speed = 4, size = 1) {
  if (particles.length > 260) n = Math.min(n, 3);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(pGeo, pMat(color)); m.position.copy(pos); m.scale.setScalar(size);
    const v = new THREE.Vector3(Math.random() - .5, Math.random() * .8 + .2, Math.random() - .5).normalize().multiplyScalar(speed * (.4 + Math.random()));
    scene.add(m); particles.push({ m, v, life: .5 + Math.random() * .4, size });
  }
}
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe28a, transparent: true, opacity: .9 });
function tracer(a, b, color) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = tracerMat.clone(); if (color) mat.color.setHex(color);
  const l = new THREE.Line(g, mat); scene.add(l); tracers.push({ l, life: .07, max: .07 });
}
const blasts = [];
const blastGeo = new THREE.SphereGeometry(1, 16, 12);
function blastFx(pos, radius, color = 0xff8a2a) {
  const m = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); m.scale.setScalar(.2); scene.add(m);
  const light = new THREE.PointLight(color, 30, radius * 4); light.position.copy(pos); scene.add(light);
  blasts.push({ m, light, life: .45, radius });
  burst(pos, color, 16, 9, 1.6); burst(pos, 0xffffff, 6, 7); burst(pos, 0x333333, 8, 5, 2);
}

// 데미지 숫자
const nums = [];
const numLayer = $('nums');
const tmpProj = new THREE.Vector3();
function dmgNum(pos, val, head) {
  if (nums.length > 28) { const o = nums.shift(); o.el.remove(); }
  const el = document.createElement('div'); el.className = 'num' + (head ? ' h' : ''); el.textContent = Math.round(val);
  numLayer.appendChild(el);
  nums.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - .5) * .4, .3, (Math.random() - .5) * .4)), life: .8 });
}
function updateNums(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.life -= dt; n.pos.y += dt * 1.2;
    if (n.life <= 0) { n.el.remove(); nums.splice(i, 1); continue; }
    tmpProj.copy(n.pos).project(camera);
    if (tmpProj.z > 1) { n.el.style.display = 'none'; continue; }
    n.el.style.display = '';
    n.el.style.left = ((tmpProj.x + 1) / 2 * w) + 'px'; n.el.style.top = ((1 - tmpProj.y) / 2 * h) + 'px';
    n.el.style.opacity = Math.min(1, n.life * 3);
  }
}

// =============== 적 ===============
const TYPES = {
  runner:   { name: '러너', hp: 60, speed: 5.2, dmg: 12, color: 0xff3b5c, size: .8, score: 100, cash: 15 },
  tank:     { name: '탱커', hp: 260, speed: 2.4, dmg: 28, color: 0xffa12a, size: 1.3, score: 300, cash: 45 },
  gunner:   { name: '거너', hp: 90, speed: 3.0, dmg: 9, color: 0xb05cff, size: .9, score: 200, cash: 25, ranged: true },
  exploder: { name: '자폭병', hp: 40, speed: 6.6, dmg: 38, color: 0xd4ff3b, size: .7, score: 150, cash: 20, explode: true },
  flyer:    { name: '드론', hp: 70, speed: 4.5, dmg: 8, color: 0x3bf0ff, size: .8, score: 250, cash: 30, ranged: true, fly: true },
  boss:     { name: 'OVERLORD', hp: 2600, speed: 2.2, dmg: 35, color: 0xff2a4a, size: 2.6, score: 3000, cash: 600, boss: true },
};
const enemies = [];
const hitboxes = [];
const hbMat = new THREE.MeshBasicMaterial({ visible: false });
const eBodyMat = new THREE.MeshStandardMaterial({ color: 0x5a6680, roughness: .4, metalness: .4 });

function makeEnemy(type, x, z, mult) {
  const T = TYPES[type], s = T.size;
  const g = new THREE.Group();
  const glowMat = new THREE.MeshStandardMaterial({ color: T.color, emissive: T.color, emissiveIntensity: .9, roughness: .4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: T.color });
  const flashables = [];
  const mesh = (geo, mat, x, y, z, flash = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); if (flash) flashables.push(m); return m; };
  const e = { type, T, g, hp: 0, maxHp: 0, dead: false, spawnT: 0, flash: 0, atkCd: 1, shootCd: 1.5 + Math.random() * 2, bobP: Math.random() * 6, strafe: Math.random() < .5 ? 1 : -1, fuse: -1, parts: {} };
  let hbBodySize, hbBodyY, hbHeadSize, hbHeadY, hbHeadZ = 0;
  if (type === 'flyer') {
    const body = mesh(new THREE.CylinderGeometry(.55 * s, .4 * s, .28 * s, 10), eBodyMat.clone(), 0, 0, 0);
    mesh(new THREE.SphereGeometry(.25 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowMat, 0, .12 * s, 0, false);
    mesh(new THREE.BoxGeometry(.3 * s, .06, .06), eyeMat, 0, 0, -.5 * s, false);
    e.parts.rotors = [];
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => { const r = mesh(new THREE.BoxGeometry(.5 * s, .02, .06), glowMat, a * .55 * s, .18 * s, b * .55 * s, false); e.parts.rotors.push(r); });
    e.parts.body = body;
    hbBodySize = [1.3 * s, .5 * s, 1.3 * s]; hbBodyY = 0; hbHeadSize = [.5 * s, .35 * s, .5 * s]; hbHeadY = .2 * s;
    e.alt = 4.5 + Math.random() * 2;
  } else if (type === 'exploder') {
    const body = mesh(new THREE.IcosahedronGeometry(.5 * s, 1), glowMat.clone(), 0, .7 * s, 0);
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(.12 * s, .4 * s, 5), eBodyMat); const d = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      c.position.copy(d.clone().multiplyScalar(.5 * s)); c.position.y += .7 * s; c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(c);
    }
    mesh(new THREE.BoxGeometry(.4 * s, .1 * s, .05), new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, .8 * s, -.48 * s, false);
    e.parts.body = body;
    hbBodySize = [1.1 * s, 1.1 * s, 1.1 * s]; hbBodyY = .7 * s; hbHeadSize = [.5 * s, .35 * s, .5 * s]; hbHeadY = 1.1 * s;
  } else if (type === 'boss') {
    const body = mesh(new THREE.IcosahedronGeometry(.6 * s, 1), eBodyMat.clone(), 0, 1.3 * s, 0);
    const core = mesh(new THREE.IcosahedronGeometry(.2 * s, 0), glowMat, 0, 1.35 * s, -.55 * s, false);
    const crown = mesh(new THREE.TorusGeometry(.45 * s, .05 * s, 6, 20), glowMat, 0, 1.95 * s, 0, false); crown.rotation.x = Math.PI / 2;
    [-1, 1].forEach(sd => {
      mesh(new THREE.BoxGeometry(.35 * s, .35 * s, .35 * s), eBodyMat.clone(), sd * .75 * s, 1.45 * s, 0);
      mesh(new THREE.CylinderGeometry(.08 * s, .1 * s, .7 * s, 8), eBodyMat.clone(), sd * .75 * s, 1.45 * s, -.4 * s).rotation.x = Math.PI / 2;
      mesh(new THREE.BoxGeometry(.2 * s, .6 * s, .2 * s), eBodyMat.clone(), sd * .35 * s, .45 * s, 0);
    });
    const ring = mesh(new THREE.TorusGeometry(.7 * s, .06 * s, 6, 24), glowMat, 0, .15 * s, 0, false); ring.rotation.x = Math.PI / 2;
    e.parts = { body, core, crown, ring };
    hbBodySize = [1.4 * s, 1.6 * s, 1.3 * s]; hbBodyY = 1.1 * s; hbHeadSize = [.55 * s, .55 * s, .4 * s]; hbHeadY = 1.35 * s; hbHeadZ = -.55 * s;
    e.state = 'chase'; e.phaseT = 3; e.attackIdx = 0;
  } else {
    const body = mesh(new THREE.IcosahedronGeometry(.55 * s, 0), eBodyMat.clone(), 0, 1.0 * s, 0);
    mesh(new THREE.IcosahedronGeometry(.3 * s, 0), glowMat, 0, 1.0 * s, -.35 * s, false);
    mesh(new THREE.BoxGeometry(.5 * s, .35 * s, .45 * s), eBodyMat.clone(), 0, 1.65 * s, 0);
    mesh(new THREE.BoxGeometry(.4 * s, .09 * s, .05), eyeMat, 0, 1.68 * s, -.24 * s, false);
    const ring = mesh(new THREE.TorusGeometry(.5 * s, .05 * s, 6, 16), glowMat, 0, .35 * s, 0, false); ring.rotation.x = Math.PI / 2;
    if (T.ranged) mesh(new THREE.BoxGeometry(.12, .12, .6), eBodyMat, .45 * s, 1.1 * s, -.3);
    if (type === 'tank') { [-1, 1].forEach(sd => mesh(new THREE.BoxGeometry(.3 * s, .5 * s, .6 * s), eBodyMat.clone(), sd * .6 * s, 1.1 * s, 0)); }
    e.parts.ring = ring;
    hbBodySize = [1.1 * s, 1.3 * s, 1.1 * s]; hbBodyY = .85 * s; hbHeadSize = [.6 * s, .45 * s, .6 * s]; hbHeadY = 1.65 * s;
  }
  const hbBody = new THREE.Mesh(new THREE.BoxGeometry(...hbBodySize), hbMat); hbBody.position.y = hbBodyY; g.add(hbBody);
  const hbHead = new THREE.Mesh(new THREE.BoxGeometry(...hbHeadSize), hbMat); hbHead.position.set(0, hbHeadY, hbHeadZ); g.add(hbHead);
  hbBody.userData = { e, head: false }; hbHead.userData = { e, head: true };
  hitboxes.push(hbBody, hbHead);
  e.hbBody = hbBody; e.hbHead = hbHead; e.flashables = flashables;
  e.centerY = hbBodyY; e.radius = (type === 'boss' ? .7 : .5) * s;
  e.hp = e.maxHp = T.hp * mult * (T.boss ? 1 + (mult - 1) * 1.5 : 1);
  e.speed = T.speed * (1 + (mult - 1) * .2);
  e.dmg = T.dmg * (1 + (mult - 1) * .45);
  g.position.set(x, type === 'flyer' ? e.alt : 0, z);
  g.scale.setScalar(.01);
  scene.add(g);
  enemies.push(e);
  return e;
}
function removeEnemy(e) {
  scene.remove(e.g);
  e.g.traverse(o => { if (o.geometry && o.geometry !== pGeo) o.geometry.dispose(); });
  for (const hb of [e.hbBody, e.hbHead]) { const i = hitboxes.indexOf(hb); if (i >= 0) hitboxes.splice(i, 1); }
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
}
const enemyCenter = (e, out = new THREE.Vector3()) => out.set(e.g.position.x, e.g.position.y + e.centerY, e.g.position.z);

// 적 탄환
const eBullets = [];
const eBulletGeo = new THREE.SphereGeometry(.14, 8, 6), bossBulletGeo = new THREE.SphereGeometry(.32, 10, 8);
const eBulletMat = new THREE.MeshBasicMaterial({ color: 0xd08aff }), bossBulletMat = new THREE.MeshBasicMaterial({ color: 0xff4a6a });
function enemyBullet(from, dir, speed, dmg, boss) {
  const m = new THREE.Mesh(boss ? bossBulletGeo : eBulletGeo, boss ? bossBulletMat : eBulletMat);
  m.position.copy(from); scene.add(m);
  eBullets.push({ m, v: dir.clone().normalize().multiplyScalar(speed), life: 5, dmg, r: boss ? .7 : .55 });
}
function enemyShoot(e) {
  const from = enemyCenter(e); if (e.type !== 'flyer') from.y += .1;
  const target = new THREE.Vector3(P.pos.x + (Math.random() - .5) * 1.4 + P.vel.x * .25, P.pos.y + P.eye - .3, P.pos.z + (Math.random() - .5) * 1.4 + P.vel.z * .25);
  enemyBullet(from, target.sub(from), 17, e.dmg, false);
  sfx('eshot', .6);
}
// 충격파
const shockwaves = [];
const swGeo = new THREE.RingGeometry(.88, 1, 56);
function shockwave(x, z, dmg) {
  const m = new THREE.Mesh(swGeo, new THREE.MeshBasicMaterial({ color: 0xff4a6a, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .15, z); scene.add(m);
  shockwaves.push({ m, r: 1, x, z, dmg, hit: false });
}

// =============== 폭발 ===============
const pendingBlasts = [];
function explode(pos, radius, dmg, opt = {}) {
  blastFx(pos, radius, opt.color);
  sfx('boom', opt.vol || 1);
  const dP = Math.hypot(pos.x - P.pos.x, pos.y - (P.pos.y + .9), pos.z - P.pos.z);
  shake = Math.min(.8, shake + Math.max(0, 1 - dP / 25) * .6);
  if (opt.hurtsEnemies !== false) {
    for (const e of [...enemies]) {
      if (e.dead) continue;
      const c = enemyCenter(e), d = c.distanceTo(pos) - e.radius;
      if (d < radius) damageEnemy(e, dmg * (1 - Math.max(0, d) / radius * .6), false, c, opt.src || 'blast');
    }
  }
  const pm = opt.playerMul ?? 1;
  if (pm > 0 && dP < radius) damagePlayer(dmg * pm * (1 - dP / radius * .6), pos);
}

// =============== 사격 ===============
const raycaster = new THREE.Raycaster();
const camPos = new THREE.Vector3(), camDir = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
const muzzleWorld = new THREE.Vector3();
function aimAssist(dir) {
  if (!settings.assist) return dir;
  let best = null, bestA = P.aiming ? .05 : .075;
  const c = new THREE.Vector3();
  for (const e of enemies) {
    if (e.dead || e.spawnT < 1) continue;
    enemyCenter(e, c);
    const to = c.clone().sub(camPos), dist = to.length(); if (dist > 70) continue;
    const a = to.normalize().angleTo(dir);
    const lim = bestA * Math.max(.5, Math.min(1.5, 10 / dist)) + (e.type === 'boss' ? .05 : 0);
    if (a < lim) {
      raycaster.set(camPos, to); raycaster.far = dist;
      if (raycaster.intersectObjects(worldMeshes, false).length) continue;
      best = to; bestA = a;
    }
  }
  return best ? dir.clone().lerp(best, .75).normalize() : dir;
}
function fireWeapon() {
  const W = WEAPONS[curW], st = wstate[curW];
  if (P.reloading > 0 || P.fireCd > 0 || P.switchT > 0) return;
  if (st.mag <= 0) { sfx('empty'); P.fireCd = .25; startReload(); return; }
  st.mag--; P.fireCd = W.rate;
  sfx(W.sound);
  { const kk = W.kick * (P.aiming ? .5 : 1); P.pitch += kk; P.recoilAcc += kk; } P.yaw += (Math.random() - .5) * W.kick * .5;
  P.spread = Math.min(P.spread + (P.aiming ? .15 : .45), 1);
  flash.visible = true; flash.material.rotation = Math.random() * 6; flashLight.intensity = 6; flashT = .05;
  gunKick = W.rocket || W.pellets > 1 || W.scope ? 2 : 1;
  camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
  camRight.set(1, 0, 0).applyQuaternion(camera.quaternion); camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  flash.getWorldPosition(muzzleWorld);
  const moving = Math.hypot(input.mx, input.mz) > .1 ? 1 : 0;
  const spreadAmt = P.aiming ? W.ads + P.spread * W.ads : W.spread + P.spread * W.spread * 1.5 + moving * .008 + (P.onGround ? 0 : .02);
  const base = W.pellets > 1 ? camDir.clone() : aimAssist(camDir.clone());
  if (W.rocket) { const d = base.clone(); spawnRocket(muzzleWorld.clone(), d, W); return; }
  for (let i = 0; i < W.pellets; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spreadAmt;
    const dir = base.clone().addScaledVector(camRight, Math.cos(a) * r).addScaledVector(camUp, Math.sin(a) * r).normalize();
    hitscan(camPos, dir, W, i === 0 || i % 3 === 0);
  }
  if (st.mag === 0 && st.reserve > 0) setTimeout(() => { if (state === 'play') startReload(); }, 180);
  updateHUD();
}
function hitscan(origin, dir, W, drawTracer) {
  raycaster.set(origin, dir); raycaster.far = 200;
  const hw = raycaster.intersectObjects(worldMeshes, false);
  const wd = hw.length ? hw[0].distance : 200;
  const he = raycaster.intersectObjects(hitboxes, false).filter(h => h.distance < wd);
  // 적별 첫 히트 (머리 우선)
  const per = new Map();
  for (const h of he) {
    const e = h.object.userData.e; if (e.dead) continue;
    const prev = per.get(e);
    if (!prev) per.set(e, h);
    else if (h.object.userData.head && !prev.object.userData.head && h.distance - prev.distance < .7) per.set(e, h);
  }
  let targets = [...per.values()].sort((a, b) => a.distance - b.distance);
  if (!W.pierce) targets = targets.slice(0, 1);
  let end = targets.length && !W.pierce ? targets[0].point : (hw.length ? hw[0].point : raycaster.ray.at(200, new THREE.Vector3()));
  if (drawTracer) tracer(muzzleWorld, end.clone(), W.scope ? 0xd0a0ff : null);
  let pierceMul = 1;
  for (const h of targets) {
    const e = h.object.userData.e, head = h.object.userData.head;
    let dmg = W.dmg * dmgMul() * (head ? W.head : 1) * pierceMul;
    if (W.falloff) dmg *= Math.max(.25, 1 - h.distance / W.falloff);
    else dmg *= 1 - Math.min(h.distance, 80) / 250;
    burst(h.point, e.T.color, head ? 6 : 3, 3);
    damageEnemy(e, dmg, head, h.point, 'gun');
    pierceMul *= .75;
  }
  if (!targets.length && hw.length) burst(hw[0].point, 0x9fd8ff, 3, 2);
}
// 로켓 & 수류탄
const rockets = [];
function spawnRocket(pos, dir, W) {
  const m = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .45, 8), new THREE.MeshBasicMaterial({ color: 0xdddddd })); body.rotation.x = Math.PI / 2; m.add(body);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b5c })); tip.position.z = -.25; m.add(tip);
  m.position.copy(pos); m.lookAt(pos.clone().add(dir)); scene.add(m);
  rockets.push({ m, v: dir.clone().multiplyScalar(38), life: 4, dmg: W.dmg * dmgMul(), radius: W.radius, trail: 0 });
}
const grenades = [];
const nadeGeo = new THREE.SphereGeometry(.13, 10, 8), nadeMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, emissive: 0x44ff66, emissiveIntensity: .4 });
function throwGrenade() {
  if (P.nades <= 0 || state !== 'play') { sfx('nope'); return; }
  P.nades--; sfx('nade');
  camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
  const m = new THREE.Mesh(nadeGeo, nadeMat); m.position.copy(camPos).addScaledVector(camDir, .6); m.position.y -= .15; scene.add(m);
  const v = camDir.clone().multiplyScalar(17); v.y += 4.5; v.x += P.vel.x * .5; v.z += P.vel.z * .5;
  grenades.push({ m, v, fuse: 1.6, beep: 0 });
  updateHUD();
}
function updateProjectiles(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; r.life -= dt;
    const steps = 3; let hit = false;
    for (let s = 0; s < steps && !hit; s++) {
      r.m.position.addScaledVector(r.v, dt / steps);
      if (pointInCollider(r.m.position)) hit = true;
      for (const e of enemies) { if (e.dead) continue; if (enemyCenter(e).distanceTo(r.m.position) < e.radius + .7) { hit = true; break; } }
    }
    r.trail -= dt; if (r.trail <= 0) { r.trail = .02; burst(r.m.position, 0xffa040, 1, .6, 1.4); }
    if (hit || r.life <= 0) { explode(r.m.position.clone(), r.radius, r.dmg, { playerMul: .3, src: 'rocket' }); scene.remove(r.m); rockets.splice(i, 1); }
  }
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i]; g.fuse -= dt;
    g.v.y -= 20 * dt;
    const p = g.m.position;
    p.x += g.v.x * dt; if (pointInCollider(p)) { p.x -= g.v.x * dt; g.v.x *= -.5; }
    p.z += g.v.z * dt; if (pointInCollider(p)) { p.z -= g.v.z * dt; g.v.z *= -.5; }
    p.y += g.v.y * dt;
    if (p.y < .13 || pointInCollider(p)) { p.y -= g.v.y * dt; if (p.y < .13) p.y = .13; g.v.y *= -.4; g.v.x *= .7; g.v.z *= .7; }
    g.m.rotation.x += dt * 8;
    g.beep -= dt; if (g.beep <= 0) { g.beep = g.fuse < .6 ? .1 : .3; sfx('beep', .5); }
    let touch = false;
    for (const e of enemies) if (!e.dead && enemyCenter(e).distanceTo(p) < e.radius + .4) touch = true;
    if (g.fuse <= 0 || (touch && g.fuse < 1.3)) { explode(p.clone(), 5.5, 200 * dmgMul(), { playerMul: .3, src: 'nade', color: 0x66ff88 }); scene.remove(g.m); grenades.splice(i, 1); }
  }
}

// =============== 게임 상태 ===============
let state = 'menu'; // menu | play | pause | shop | over
let wave = 0, score = 0, cash = 0, kills = 0, heads = 0, bossKills = 0;
let toSpawn = 0, spawnTimer = 0, waveActive = false, clearT = 0, startT = 0;
let comboN = 0, comboT = 0, maxCombo = 0;
let flashT = 0, gunKick = 0, shake = 0, vigT = 0;
let curBoss = null;
const pickups = [];

function initWeaponState(k) { wstate[k] = { mag: magOf(k), reserve: WEAPONS[k].reserve }; }
function resetGame() {
  [...enemies].forEach(removeEnemy);
  [eBullets, pickups, particles, rockets, grenades, shockwaves].forEach(arr => { arr.forEach(o => scene.remove(o.m)); arr.length = 0; });
  blasts.forEach(b => { scene.remove(b.m); scene.remove(b.light); }); blasts.length = 0;
  nums.forEach(n => n.el.remove()); nums.length = 0;
  pendingBlasts.length = 0;
  up = { dmg: 0, mag: 0, reload: 0, hp: 0, nade: 0, dash: 0 };
  inventory = ['rifle']; curW = 'rifle';
  WKEYS.forEach(initWeaponState);
  Object.assign(P, { hp: 100, maxHp: 100, armor: 0, reloading: 0, fireCd: 0, switchT: 0, yaw: 0, pitch: 0, spread: 0, recoilAcc: 0, aiming: false, aimT: 0, nades: 2, dashCd: 0, dashT: 0, invul: 0 });
  P.pos.set(0, 0, 8); P.vel.set(0, 0, 0);
  wave = 0; score = 0; cash = 0; kills = 0; heads = 0; bossKills = 0; comboN = 0; comboT = 0; maxCombo = 0;
  toSpawn = 0; waveActive = false; clearT = 0; startT = 1.2; curBoss = null;
  applyTheme(0);
  equip('rifle', true);
  $('boss').style.display = 'none';
  updateHUD();
}
function equip(k, instant) {
  curW = k;
  WKEYS.forEach(w => gunModels[w].visible = w === k);
  flash.position.set(0, .02, gunModels[k].userData.muzzle);
  flashLight.position.set(0, 0, gunModels[k].userData.muzzle - .1);
  P.reloading = 0;
  P.switchT = instant ? 0 : .35;
  $('swapIcon').textContent = WEAPONS[k].icon;
}
function switchWeapon(k) {
  if (state !== 'play' || k === curW || !inventory.includes(k)) return;
  equip(k); sfx('switch'); updateHUD();
}
function nextWeapon(dir = 1) {
  if (inventory.length < 2) return;
  const i = inventory.indexOf(curW);
  switchWeapon(inventory[(i + dir + inventory.length) % inventory.length]);
}
function startReload() {
  const st = wstate[curW];
  if (P.reloading > 0 || P.switchT > 0 || st.mag >= magOf(curW) || st.reserve <= 0) return;
  P.reloading = P.reloadMax = reloadOf(curW); sfx('reload'); updateHUD();
}
function finishReload() {
  const st = wstate[curW], take = Math.min(magOf(curW) - st.mag, st.reserve);
  st.mag += take; st.reserve -= take; P.reloading = 0; updateHUD();
}
function dash() {
  if (state !== 'play' || P.dashCd > 0) return;
  const fwd = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = new THREE.Vector3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const d = new THREE.Vector3().addScaledVector(right, input.mx).addScaledVector(fwd, -input.mz);
  if (d.lengthSq() < .01) d.copy(fwd); d.normalize();
  P.vel.x = d.x * 24; P.vel.z = d.z * 24; P.dashT = .18; P.dashCd = dashCdMax(); P.invul = .3;
  sfx('dash'); camera.fov += 8; camera.updateProjectionMatrix();
}

// =============== 데미지 / 처치 ===============
function damageEnemy(e, dmg, head, point, src) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = .08;
  dmgNum(point, dmg, head);
  if (src === 'gun') { showHit(head ? 'head' : ''); sfx(head ? 'head' : 'hit', .8); }
  if (e.hp <= 0) killEnemy(e, head);
}
function killEnemy(e, head) {
  if (e.dead) return;
  e.dead = true; kills++; if (head) heads++;
  comboN++; comboT = 3.2; maxCombo = Math.max(maxCombo, comboN);
  const mult = 1 + Math.min(comboN - 1, 10) * .2;
  const pts = Math.round(e.T.score * (head ? 1.5 : 1) * mult * (1 + (wave - 1) * .1));
  const gain = Math.round(e.T.cash * (1 + wave * .05));
  score += pts; cash += gain;
  const c = enemyCenter(e);
  burst(c, e.T.color, e.T.boss ? 40 : 16, e.T.boss ? 12 : 6, e.T.boss ? 2 : 1); burst(c, 0xffffff, 6, 5);
  sfx('kill', .6);
  showHit('kill');
  feed(`${head ? '💥 헤드샷 ' : ''}${e.T.name} 처치 +${pts}  ◆${gain}`, head ? '#ff6b7d' : '#9fe8ff');
  if (e.T.explode) pendingBlasts.push({ pos: c.clone(), r: 4.2, dmg: e.dmg * 1.6, opt: { playerMul: .5, color: 0xd4ff3b } });
  if (e.T.boss) {
    bossKills++; curBoss = null; $('boss').style.display = 'none';
    for (let i = 0; i < 4; i++) setTimeout(() => blastFx(c.clone().add(new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .5) * 5)), 5, 0xff4a6a), i * 160);
    sfx('boom'); shake = .9;
    showBanner('BOSS DEFEATED', `+◆${gain}`);
    for (let i = 0; i < 4; i++) spawnPickup(c.x + (Math.random() - .5) * 4, c.z + (Math.random() - .5) * 4, ['hp', 'ammo', 'cash', 'cash'][i]);
  } else dropPickup(e.g.position);
  removeEnemy(e);
  updateHUD();
}
function detonate(e) {
  if (e.dead) return;
  e.dead = true;
  const c = enemyCenter(e);
  removeEnemy(e);
  explode(c, 4.2, e.dmg, { playerMul: 1, color: 0xd4ff3b });
  updateHUD();
}
function damagePlayer(d, from) {
  if (state !== 'play' || P.invul > 0) return;
  if (P.armor > 0) { const a = Math.min(P.armor, d * .7); P.armor -= a; d -= a; }
  P.hp -= d; vigT = .6; sfx('hurt');
  if (from) damageDir(from);
  shake = Math.min(shake + .25, .7);
  updateHUD();
  if (P.hp <= 0) gameOver();
}

// 픽업
function spawnPickup(x, z, kind) {
  const col = { hp: 0x29e07a, ammo: 0xffcf4d, cash: 0x5fd4ff }[kind];
  const geo = kind === 'cash' ? new THREE.OctahedronGeometry(.25) : kind === 'hp' ? new THREE.BoxGeometry(.4, .4, .4) : new THREE.CylinderGeometry(.18, .18, .45, 8);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .9 }));
  m.position.set(Math.max(-ARENA + 1, Math.min(ARENA - 1, x)), .6, Math.max(-ARENA + 1, Math.min(ARENA - 1, z))); scene.add(m);
  pickups.push({ m, kind, life: 25 });
}
function dropPickup(pos) {
  const r = Math.random();
  if (r < .1) spawnPickup(pos.x, pos.z, 'hp');
  else if (r < .2) spawnPickup(pos.x, pos.z, 'ammo');
  else if (r < .3) spawnPickup(pos.x, pos.z, 'cash');
}

// =============== 웨이브 ===============
function pickType() {
  const w = wave, pool = [['runner', 10]];
  if (w >= 2) pool.push(['gunner', 3 + w * .5], ['exploder', 2 + w * .5]);
  if (w >= 3) pool.push(['tank', 1 + w * .35]);
  if (w >= 4) pool.push(['flyer', 2 + w * .45]);
  let sum = pool.reduce((a, b) => a + b[1], 0), r = Math.random() * sum;
  for (const [t, wt] of pool) { r -= wt; if (r <= 0) return t; }
  return 'runner';
}
function edgeSpawn() {
  let x, z, tries = 0;
  do {
    const side = Math.floor(Math.random() * 4), t = (Math.random() - .5) * (ARENA * 2 - 6);
    [x, z] = [[t, -ARENA + 3], [t, ARENA - 3], [-ARENA + 3, t], [ARENA - 3, t]][side];
  } while (Math.hypot(x - P.pos.x, z - P.pos.z) < 20 && ++tries < 12);
  return [x, z];
}
const mult = () => 1 + (wave - 1) * .13;
function startWave() {
  wave++;
  waveActive = true; spawnTimer = .5;
  if (wave > 1 && (wave - 1) % 5 === 0) { applyTheme((wave - 1) / 5); feed('구역 이동: ' + THEMES[themeIdx].name, '#ffcf4d'); }
  if (wave % 5 === 0) {
    toSpawn = 4 + wave;
    const [x, z] = edgeSpawn();
    curBoss = makeEnemy('boss', x, z, mult());
    $('bossName').textContent = '⚠ ' + TYPES.boss.name + (wave > 5 ? ' Mk.' + (wave / 5) : '');
    $('boss').style.display = 'block';
    showBanner('⚠ BOSS WAVE ' + wave, THEMES[themeIdx].name); sfx('boss');
  } else {
    toSpawn = 6 + wave * 3;
    showBanner('WAVE ' + wave, THEMES[themeIdx].name); sfx('wave');
  }
  updateHUD();
}
function spawnOne() {
  const t = pickType();
  const [x, z] = edgeSpawn();
  makeEnemy(t, x, z, mult());
  toSpawn--;
}
function waveClear() {
  waveActive = false; clearT = 2;
  const bonus = 100 + wave * 30;
  cash += bonus;
  P.nades = Math.min(maxNades(), P.nades + 1);
  P.hp = Math.min(P.maxHp, P.hp + 15);
  showBanner('WAVE CLEAR!', `보너스 +◆${bonus}`);
  updateHUD();
}

// =============== 상점 ===============
function openShop() {
  state = 'shop';
  input.fire = false; input.mx = input.mz = 0; P.aiming = false;
  showControls(false);
  if (document.pointerLockElement) document.exitPointerLock();
  $('shop').classList.remove('hidden');
  renderShop();
}
function closeShop() {
  $('shop').classList.add('hidden');
  state = 'play'; showControls(true);
  if (!isTouch) canvas.requestPointerLock?.();
  startWave();
}
function card(parent, { t, d, lv, price, label, disabled, owned, onBuy }) {
  const el = document.createElement('div'); el.className = 'card' + (owned ? ' owned' : '');
  el.innerHTML = `<div class="t">${t}</div>${lv ? `<div class="lv">${lv}</div>` : ''}<div class="d">${d}</div>`;
  const b = document.createElement('button');
  b.textContent = label || ('◆ ' + price);
  b.disabled = !!disabled || (price != null && cash < price);
  b.onclick = () => { if (price != null && cash < price) { sfx('nope'); return; } if (price != null) cash -= price; onBuy(); sfx('buy'); renderShop(); updateHUD(); };
  el.appendChild(b); parent.appendChild(el);
}
function renderShop() {
  $('shopCash').textContent = '◆ ' + cash.toLocaleString();
  $('shopInfo').textContent = `다음: WAVE ${wave + 1}${(wave + 1) % 5 === 0 ? ' ⚠ 보스 출현!' : ''} · HP ${Math.ceil(P.hp)}/${P.maxHp} · 방어막 ${Math.ceil(P.armor)} · 수류탄 ${P.nades}/${maxNades()}`;
  const gw = $('gWeap'), gu = $('gUp'), gi = $('gItem');
  gw.innerHTML = gu.innerHTML = gi.innerHTML = '';
  WKEYS.filter(k => k !== 'rifle').forEach(k => {
    const W = WEAPONS[k], st = wstate[k];
    if (!inventory.includes(k)) card(gw, { t: W.name, d: W.desc, price: W.price, onBuy: () => { inventory.push(k); initWeaponState(k); equip(k); } });
    else {
      const p = Math.round(W.price * .12) + wave * 5;
      card(gw, { t: W.name + ' 탄약', d: `보유 ${st.reserve} / ${W.reserve}`, owned: true, price: p, disabled: st.reserve >= W.reserve, onBuy: () => { st.reserve = W.reserve; } });
    }
  });
  Object.entries(UP).forEach(([k, U]) => {
    const lv = up[k], maxed = lv >= U.max, price = U.base * (lv + 1);
    card(gu, { t: U.name, d: U.desc, lv: '★'.repeat(lv) + '☆'.repeat(U.max - lv), price: maxed ? null : price, label: maxed ? 'MAX' : null, disabled: maxed,
      onBuy: () => { up[k]++; if (k === 'hp') { P.maxHp += 20; P.hp += 20; } if (k === 'nade') P.nades++; if (k === 'mag') { const st = wstate[curW]; st.mag = Math.min(st.mag, magOf(curW)); } } });
  });
  const healP = 120 + wave * 10;
  card(gi, { t: '수리 키트', d: '체력 완전 회복', price: healP, disabled: P.hp >= P.maxHp, onBuy: () => P.hp = P.maxHp });
  card(gi, { t: '방어막 +50', d: '받는 피해 70% 흡수 (최대 100)', price: 220, disabled: P.armor >= 100, onBuy: () => P.armor = Math.min(100, P.armor + 50) });
  card(gi, { t: '수류탄 +1', d: '범위 폭발. 적에 닿으면 즉시 폭발', price: 100, disabled: P.nades >= maxNades(), onBuy: () => P.nades++ });
}
$('shopGo').onclick = closeShop;

// =============== HUD ===============
const hud = {
  hp: $('hpfill'), ar: $('arfill'), hpT: $('hptxt'), wave: $('wave'), left: $('left'), score: $('score'), cash: $('cash'),
  ammoN: $('ammoN'), ammoR: $('ammoR'), wname: $('wname'), rl: $('rl'), vig: $('vig'), banner: $('banner'), cross: $('cross'), hit: $('hit'),
  feed: $('feed'), dd: $('dmgdir'), combo: $('combo'), bossfill: $('bossfill'), scope: $('scope'), ring: $('reloadRing'), rrc: $('rrc'),
  nadeN: $('nadeN'), bNade: $('bNade'), bDash: $('bDash'), radar: $('radar')
};
function updateHUD() {
  const f = Math.max(0, P.hp / P.maxHp);
  hud.hp.style.width = f * 100 + '%';
  hud.hp.style.background = f > .5 ? 'linear-gradient(90deg,#29e07a,#b8ff5c)' : f > .25 ? 'linear-gradient(90deg,#ffb02a,#ffe05c)' : 'linear-gradient(90deg,#ff2a4a,#ff6a5c)';
  hud.ar.style.width = Math.min(100, P.armor) + '%';
  hud.hpT.textContent = `HP ${Math.ceil(Math.max(0, P.hp))}${P.armor > 0 ? ' · 🛡' + Math.ceil(P.armor) : ''}`;
  hud.wave.textContent = wave; hud.left.textContent = enemies.length + toSpawn; hud.score.textContent = score.toLocaleString();
  hud.cash.textContent = '◆ ' + cash.toLocaleString();
  const st = wstate[curW]; if (!st) return;
  hud.ammoN.textContent = st.mag; hud.ammoN.style.color = st.mag <= Math.ceil(magOf(curW) * .2) ? '#ff5f6d' : '#fff';
  hud.ammoR.textContent = '/ ' + (st.reserve === Infinity ? '∞' : st.reserve);
  hud.wname.textContent = WEAPONS[curW].name + (up.dmg ? ' +' + up.dmg : '');
  hud.rl.textContent = P.reloading > 0 ? '재장전 중...' : (st.mag === 0 ? (st.reserve > 0 ? '재장전 필요!' : '탄약 없음 — 무기 교체') : '');
  hud.nadeN.textContent = P.nades;
  hud.bNade.classList.toggle('cd', P.nades <= 0);
}
let bannerT = 0;
function showBanner(t, sub) { hud.banner.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); hud.banner.style.opacity = 1; bannerT = 2; }
let hitT = 0;
function showHit(kind) { hud.hit.className = kind; hud.hit.style.opacity = 1; hitT = kind === 'kill' ? .25 : .12; }
function feed(t, c = '#fff') {
  const d = document.createElement('div'); d.textContent = t; d.style.color = c; hud.feed.prepend(d);
  setTimeout(() => d.style.opacity = 0, 1500); setTimeout(() => d.remove(), 2200);
  while (hud.feed.children.length > 5) hud.feed.lastChild.remove();
}
function damageDir(from) {
  const dx = from.x - P.pos.x, dz = from.z - P.pos.z;
  const r = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), f = -dx * Math.sin(P.yaw) - dz * Math.cos(P.yaw);
  const d = document.createElement('div'); d.className = 'dd'; d.style.transform = `rotate(${Math.atan2(r, f)}rad)`;
  hud.dd.appendChild(d); setTimeout(() => d.style.opacity = 0, 300); setTimeout(() => d.remove(), 1100);
}
const rctx = hud.radar.getContext('2d');
function drawRadar() {
  const S = 168, C = S / 2, R = 36, sc = (C - 6) / R;
  rctx.clearRect(0, 0, S, S);
  rctx.strokeStyle = 'rgba(120,200,255,.18)'; rctx.lineWidth = 2;
  rctx.beginPath(); rctx.arc(C, C, C * .5, 0, 7); rctx.stroke();
  rctx.beginPath(); rctx.moveTo(C, 6); rctx.lineTo(C, S - 6); rctx.moveTo(6, C); rctx.lineTo(S - 6, C); rctx.stroke();
  const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const plot = (x, z, col, rad) => {
    const dx = x - P.pos.x, dz = z - P.pos.z;
    let rx = dx * cs - dz * sn, fz = -dx * sn - dz * cs;
    const d = Math.hypot(rx, fz); if (d > R) { rx *= R / d; fz *= R / d; }
    rctx.fillStyle = col; rctx.beginPath(); rctx.arc(C + rx * sc, C - fz * sc, rad, 0, 7); rctx.fill();
  };
  for (const p of pickups) plot(p.m.position.x, p.m.position.z, 'rgba(255,207,77,.8)', 3);
  for (const e of enemies) plot(e.g.position.x, e.g.position.z, e.T.boss ? '#ff2a4a' : '#' + e.T.color.toString(16).padStart(6, '0'), e.T.boss ? 9 : 4.5);
  rctx.fillStyle = '#fff'; rctx.beginPath(); rctx.moveTo(C, C - 9); rctx.lineTo(C - 6, C + 6); rctx.lineTo(C + 6, C + 6); rctx.fill();
}

// =============== 흐름 ===============
function gameOver() {
  state = 'over';
  const best = store.get('ns2_best', 0), bestW = store.get('ns2_bestW', 0);
  const nb = score > best; if (nb) store.set('ns2_best', score); if (wave > bestW) store.set('ns2_bestW', wave);
  $('oWave').textContent = wave; $('oKills').textContent = kills; $('oHead').textContent = heads; $('oScore').textContent = score.toLocaleString();
  $('oCombo').textContent = maxCombo; $('oBoss').textContent = bossKills;
  $('oBest').textContent = nb ? '🏆 신기록!' : '최고 기록 ' + best.toLocaleString();
  refreshBest();
  setTimeout(() => { $('over').classList.remove('hidden'); showControls(false); $('hud').classList.add('hidden'); }, 800);
  if (document.pointerLockElement) document.exitPointerLock();
}
function refreshBest() { $('best').textContent = store.get('ns2_best', 0).toLocaleString(); $('bestW').textContent = store.get('ns2_bestW', 0); }
function showControls(v) { $('ctrl').style.display = v && isTouch ? 'block' : 'none'; }
function play() {
  audio();
  resetGame();
  ['menu', 'over', 'pause', 'shop'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  showControls(true);
  state = 'play';
  checkRotate();
  tryFullscreen();
  if (!isTouch) canvas.requestPointerLock?.();
}
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause'; $('pause').classList.remove('hidden'); showControls(false);
  input.fire = false; input.mx = input.mz = 0; P.aiming = false;
  renderSettings($('setBox2'));
}
function resumeGame() {
  state = 'play'; $('pause').classList.add('hidden'); showControls(true);
  if (!isTouch) canvas.requestPointerLock?.();
}
function toMenu() {
  state = 'menu'; ['over', 'pause', 'shop'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.add('hidden'); showControls(false); $('menu').classList.remove('hidden');
  $('boss').style.display = 'none';
  applyTheme(0); refreshBest(); checkRotate();
}
function tryFullscreen() {
  if (!isTouch) return;
  const el = document.documentElement;
  try { const r = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); if (r && r.then) r.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch {}
}
function renderSettings(box) {
  box.innerHTML = '';
  const row = (label, el) => { const l = document.createElement('label'); l.append(label, el); box.appendChild(l); };
  const wrap = document.createElement('span'); wrap.style.display = 'flex'; wrap.style.gap = '8px'; wrap.style.alignItems = 'center';
  const r = document.createElement('input'); r.type = 'range'; r.min = .4; r.max = 2.5; r.step = .1; r.value = settings.sens;
  const v = document.createElement('span'); v.textContent = settings.sens;
  r.oninput = () => { settings.sens = +r.value; v.textContent = settings.sens; saveSettings(); };
  wrap.append(r, v); row('감도', wrap);
  const tog = (label, key, on, off, fn) => {
    const b = document.createElement('button'); b.className = 'tog';
    const upd = () => { const val = key === 'quality' ? settings.quality === 'high' : settings[key]; b.textContent = val ? on : off; b.classList.toggle('on', val); };
    b.onclick = () => { if (key === 'quality') settings.quality = settings.quality === 'high' ? 'low' : 'high'; else settings[key] = !settings[key]; saveSettings(); upd(); fn && fn(); };
    upd(); row(label, b);
  };
  tog('그래픽', 'quality', '고품질', '저사양', applyQuality);
  tog('사운드', 'sound', 'ON', 'OFF');
  tog('조준 보정', 'assist', 'ON', 'OFF');
}
$('play').onclick = play; $('again').onclick = play; $('resume').onclick = resumeGame; $('quit').onclick = toMenu; $('toMenu').onclick = toMenu;
$('openSet').onclick = () => { const b = $('setBox1'); b.classList.toggle('hidden'); renderSettings(b); };
$('openHelp').onclick = () => $('help').classList.toggle('hidden');

let rotateDismissed = false;
function checkRotate() {
  const show = isTouch && !rotateDismissed && window.innerHeight > window.innerWidth && state !== 'menu';
  $('rotate').style.display = show ? 'flex' : 'none';
}
$('rotate').addEventListener('click', () => { rotateDismissed = true; checkRotate(); });

// =============== 터치 입력 ===============
const stick = { id: null, ox: 0, oy: 0 }, look = { id: null, x: 0, y: 0 };
const base = $('stickBase'), knob = $('stickKnob');
const btnTouches = new Map();
function bindBtn(el, down, up) {
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) btnTouches.set(t.identifier, el); el.classList.add('on'); down(); }, { passive: false });
  const end = e => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) btnTouches.delete(t.identifier); let still = false; for (const v of btnTouches.values()) if (v === el) still = true; if (!still) { el.classList.remove('on'); up && up(); } };
  el.addEventListener('touchend', end, { passive: false }); el.addEventListener('touchcancel', end, { passive: false });
}
let fireHolders = 0;
bindBtn($('bFire'), () => { input.fire = true; }, () => { input.fire = btnTouches.size && [...btnTouches.values()].some(v => v.id === 'bFire2'); });
bindBtn($('bFire2'), () => { input.fire = true; }, () => { input.fire = btnTouches.size && [...btnTouches.values()].some(v => v.id === 'bFire'); });
bindBtn($('bJump'), () => input.jump = true);
bindBtn($('bReload'), startReload);
bindBtn($('bAim'), () => P.aiming = !P.aiming);
bindBtn($('bSwap'), () => nextWeapon(1));
bindBtn($('bNade'), throwGrenade);
bindBtn($('bDash'), dash);
bindBtn($('bPause'), pauseGame);

const fireLook = new Map();
['bFire', 'bFire2'].forEach(id => {
  const el = $(id);
  el.addEventListener('touchstart', e => { for (const t of e.changedTouches) fireLook.set(t.identifier, { x: t.clientX, y: t.clientY }); });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) { const p = fireLook.get(t.identifier); if (!p) continue; applyLook(t.clientX - p.x, t.clientY - p.y); p.x = t.clientX; p.y = t.clientY; }
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) fireLook.delete(t.identifier); };
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
});
function applyLook(dx, dy) {
  const z = 1 + (WEAPONS[curW].zoom - 1) * P.aimT;
  const k = .0042 * settings.sens / Math.pow(z, .85);
  P.yaw -= dx * k; P.pitch -= dy * k;
  P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
}
const ctrl = $('ctrl');
ctrl.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < window.innerWidth * .42 && stick.id === null) {
      stick.id = t.identifier; stick.ox = t.clientX; stick.oy = t.clientY;
      base.style.display = 'block'; base.style.left = (t.clientX - 60) + 'px'; base.style.top = (t.clientY - 60) + 'px';
      knob.style.transform = 'translate(0,0)';
    } else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
  }
}, { passive: false });
ctrl.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) {
      let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy;
      const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      input.mx = dx / max; input.mz = dy / max;
      P.sprint = d > max * 1.5;
    } else if (t.identifier === look.id) {
      applyLook(t.clientX - look.x, t.clientY - look.y);
      look.x = t.clientX; look.y = t.clientY;
    }
  }
}, { passive: false });
const tEnd = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) { stick.id = null; input.mx = input.mz = 0; base.style.display = 'none'; P.sprint = false; }
    if (t.identifier === look.id) look.id = null;
  }
};
ctrl.addEventListener('touchend', tEnd); ctrl.addEventListener('touchcancel', tEnd);

// =============== 키보드/마우스 ===============
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state !== 'play') { if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'pause') resumeGame(); return; }
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyQ') nextWeapon(1);
  if (e.code === 'KeyG') throwGrenade();
  if (e.code === 'KeyE') dash();
  if (e.code.startsWith('Digit')) { const k = WKEYS[+e.code.slice(5) - 1]; if (k) switchWeapon(k); }
  if (e.code === 'KeyP') pauseGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousedown', e => {
  if (state !== 'play') return;
  if (!document.pointerLockElement) { canvas.requestPointerLock?.(); return; }
  if (e.button === 0) input.fire = true;
  if (e.button === 2) P.aiming = true;
});
window.addEventListener('mouseup', e => { if (isTouch && btnTouches.size) return; if (e.button === 0) input.fire = false; if (e.button === 2) P.aiming = false; });
window.addEventListener('wheel', e => { if (state === 'play') nextWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && state === 'play') applyLook(e.movementX * .55, e.movementY * .55); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state === 'play' && !isTouch) pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// =============== 업데이트 ===============
const fwdV = new THREE.Vector3(), rightV = new THREE.Vector3(), tmpC = new THREE.Vector3();
function updatePlayer(dt) {
  if (!isTouch || keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) {
    const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), kz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    if (kx || kz || !isTouch) { input.mx = kx; input.mz = kz; P.sprint = !!(keys.ShiftLeft || keys.ShiftRight); }
  }
  const W = WEAPONS[curW];
  fwdV.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); rightV.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  let mx = input.mx, mz = input.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const spd = P.aiming ? 3.4 : (P.sprint && mz < -.3 ? 8.8 : 6.2);
  P.dashT -= dt; P.dashCd = Math.max(0, P.dashCd - dt); P.invul -= dt;
  if (P.dashT <= 0) {
    const wx = rightV.x * mx * spd - fwdV.x * mz * spd, wz = rightV.z * mx * spd - fwdV.z * mz * spd;
    const accel = P.onGround ? 14 : 4;
    P.vel.x += (wx - P.vel.x) * Math.min(1, accel * dt);
    P.vel.z += (wz - P.vel.z) * Math.min(1, accel * dt);
  }
  if (input.jump && P.onGround) { P.vel.y = 7.4; P.onGround = false; }
  input.jump = false;
  P.vel.y -= 20 * dt;
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  collideXZ(P.pos, P.radius, P.pos.y, P.pos.y + 1.8);
  const prevY = P.pos.y;
  P.pos.y += P.vel.y * dt;
  const gh = groundHeight(P.pos.x, P.pos.z, P.radius, prevY);
  if (P.pos.y <= gh) { P.pos.y = gh; P.vel.y = 0; P.onGround = true; } else if (P.pos.y > gh + .05) P.onGround = false;
  P.pos.x = Math.max(-ARENA + P.radius, Math.min(ARENA - P.radius, P.pos.x));
  P.pos.z = Math.max(-ARENA + P.radius, Math.min(ARENA - P.radius, P.pos.z));
  // 점프패드
  for (const pad of jumpPads) {
    if (P.pos.y < .3 && Math.hypot(P.pos.x - pad.x, P.pos.z - pad.z) < 1.3 && P.vel.y <= 0) {
      P.vel.y = 15; P.onGround = false; sfx('pad'); burst(new THREE.Vector3(pad.x, .3, pad.z), accMat.color.getHex(), 12, 5);
    }
  }
  // 무기
  P.fireCd -= dt;
  if (P.switchT > 0) P.switchT -= dt;
  if (P.reloading > 0) { P.reloading -= dt; if (P.reloading <= 0) finishReload(); }
  if (input.fire) fireWeapon();
  P.spread = Math.max(0, P.spread - dt * 2.2);
  if (P.recoilAcc > 0 && P.fireCd < -.04) { const r = Math.min(P.recoilAcc, dt * (.25 + P.recoilAcc * 4)); P.pitch -= r; P.recoilAcc -= r; }
  P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));

  // 카메라
  const moving = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround) P.bob += dt * moving * 1.6;
  P.aimT += ((P.aiming && P.reloading <= 0 && P.switchT <= 0 ? 1 : 0) - P.aimT) * Math.min(1, dt * 12);
  const bobY = Math.sin(P.bob * 2) * .04 * Math.min(1, moving / 6) * (1 - P.aimT * .9);
  camera.position.set(P.pos.x, P.pos.y + P.eye + bobY, P.pos.z);
  shake = Math.max(0, shake - dt * 2);
  camera.rotation.set(P.pitch + (Math.random() - .5) * shake * .05, P.yaw + (Math.random() - .5) * shake * .05, 0, 'YXZ');
  const fov = baseFov / (1 + (W.zoom - 1) * P.aimT) + (P.sprint && moving > 7 ? 6 : 0);
  if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }

  // 총 모델
  gunKick = Math.max(0, gunKick - dt * 10);
  const gp = GUN_HIP.clone().lerp(GUN_ADS, P.aimT);
  const mv = Math.min(1, moving / 6);
  gp.x += Math.cos(P.bob) * .012 * mv; gp.y += Math.abs(Math.sin(P.bob)) * .012 * mv; gp.z += gunKick * .05;
  let rotX = gunKick * .07;
  if (P.reloading > 0) { const k = Math.sin((1 - P.reloading / P.reloadMax) * Math.PI); gp.y -= k * .18; rotX = -k * .6; }
  if (P.switchT > 0) { gp.y -= P.switchT / .35 * .3; rotX = -P.switchT * 2; }
  gunHolder.rotation.x = rotX;
  gunHolder.position.lerp(gp, Math.min(1, dt * 20));
  flashT -= dt; if (flashT <= 0) { flash.visible = false; flashLight.intensity = 0; }
  const scoped = W.scope && P.aimT > .85;
  hud.scope.style.display = scoped ? 'block' : 'none';
  gunHolder.visible = !scoped;
  // 크로스헤어
  const sp = P.aiming ? W.ads + P.spread * W.ads : W.spread + P.spread * W.spread * 1.5 + (Math.hypot(input.mx, input.mz) > .1 ? .008 : 0);
  const px = Math.min(90, 14 + sp * 700);
  hud.cross.style.width = hud.cross.style.height = px + 'px';
  hud.cross.style.opacity = scoped ? 0 : (P.aiming ? .5 : 1);
  if (P.reloading > 0) { hud.ring.style.display = 'block'; hud.rrc.style.strokeDashoffset = 119.4 * (P.reloading / P.reloadMax); } else hud.ring.style.display = 'none';
  hud.bDash.classList.toggle('cd', P.dashCd > 0);
}

function updateWaves(dt) {
  if (startT > 0) { startT -= dt; if (startT <= 0) startWave(); return; }
  if (waveActive && toSpawn <= 0 && enemies.length === 0) waveClear();
  if (!waveActive && clearT > 0) { clearT -= dt; if (clearT <= 0) openShop(); return; }
  if (waveActive && toSpawn > 0) {
    spawnTimer -= dt;
    const cap = 6 + Math.min(wave * 2, 18);
    if (spawnTimer <= 0 && enemies.length < cap) { spawnOne(); spawnTimer = Math.max(.35, 1.4 - wave * .07); updateHUD(); }
  }
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) comboN = 0; }
  if (comboN >= 2) { hud.combo.style.opacity = 1; hud.combo.textContent = `${comboN} COMBO  x${(1 + Math.min(comboN - 1, 10) * .2).toFixed(1)}`; }
  else hud.combo.style.opacity = 0;
}

function updateBoss(e, dt, dx, dz, dist) {
  const pos = e.g.position, enr = e.hp < e.maxHp * .5;
  const sp = e.speed * (enr ? 1.4 : 1);
  e.parts.crown.rotation.z += dt * (enr ? 4 : 1.5); e.parts.ring.rotation.z -= dt * 2; e.parts.core.rotation.y += dt * 3;
  if (e.state === 'chase') {
    if (dist > 4) { const np = { x: pos.x + dx / dist * sp * dt, z: pos.z + dz / dist * sp * dt }; collideXZ(np, e.radius * .6, 0, 3); pos.x = np.x; pos.z = np.z; }
    pos.y = Math.abs(Math.sin(e.bobP)) * .15;
    e.phaseT -= dt;
    if (e.phaseT <= 0 && e.spawnT >= 1) {
      const seq = ['slam', 'barrage', 'slam', 'summon', 'barrage'];
      const a = seq[e.attackIdx++ % seq.length];
      if (a === 'slam') { e.state = 'slam'; e.t = 0; e.from = pos.clone(); const d = Math.min(dist, 16); e.to = new THREE.Vector3(pos.x + dx / dist * d, 0, pos.z + dz / dist * d); }
      else if (a === 'barrage') { e.state = 'barrage'; e.t = .6; e.volley = 0; }
      else { for (let i = 0; i < (enr ? 4 : 3); i++) { const t = Math.random() < .5 ? 'runner' : 'exploder'; makeEnemy(t, pos.x + (Math.random() - .5) * 6, pos.z + (Math.random() - .5) * 6, mult()); } feed('⚠ 보스가 부하를 소환!', '#ff6b7d'); e.phaseT = 2; updateHUD(); }
    }
  } else if (e.state === 'slam') {
    e.t += dt / 1.3; const k = Math.min(1, e.t);
    pos.x = e.from.x + (e.to.x - e.from.x) * k; pos.z = e.from.z + (e.to.z - e.from.z) * k;
    pos.y = Math.sin(Math.PI * k) * 7;
    if (k >= 1) {
      pos.y = 0; shockwave(pos.x, pos.z, e.dmg * .8); sfx('slam');
      shake = Math.min(.9, shake + .6); burst(new THREE.Vector3(pos.x, .3, pos.z), 0xff4a6a, 24, 10, 1.5);
      if (dist < e.radius + 2.5 && P.pos.y < 2) damagePlayer(e.dmg, pos);
      e.state = 'chase'; e.phaseT = enr ? 2 : 3.2;
      feed('점프로 충격파를 피하세요!', '#ffcf4d');
    }
  } else if (e.state === 'barrage') {
    e.t -= dt;
    if (e.t <= 0) {
      const from = pos.clone(); from.y += 1.4 * e.T.size;
      const to = new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z).sub(from);
      const n = enr ? 11 : 8, spread = 1.1, baseA = Math.atan2(to.x, to.z), hd = Math.hypot(to.x, to.z);
      for (let i = 0; i < n; i++) {
        const a = baseA + (i / (n - 1) - .5) * spread + (e.volley % 2 ? spread / (n - 1) / 2 : 0);
        enemyBullet(from, new THREE.Vector3(Math.sin(a) * hd, to.y, Math.cos(a) * hd), 15, e.dmg * .45, true);
      }
      sfx('eshot', 1.2);
      e.volley++; e.t = .5;
      if (e.volley >= (enr ? 4 : 3)) { e.state = 'chase'; e.phaseT = enr ? 2.2 : 3.5; }
    }
  }
  e.atkCd -= dt;
  if (dist < e.radius + P.radius + 1 && P.pos.y < 2.5 && e.atkCd <= 0 && e.state !== 'slam') { damagePlayer(e.dmg * .8, pos); e.atkCd = 1.2; P.vel.x += dx / dist * -12; P.vel.z += dz / dist * -12; }
  hud.bossfill.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
}

function updateEnemies(dt) {
  for (const e of [...enemies]) {
    if (e.dead) continue;
    e.spawnT = Math.min(1, e.spawnT + dt * 2.5); e.g.scale.setScalar(e.spawnT);
    const pos = e.g.position;
    const dx = P.pos.x - pos.x, dz = P.pos.z - pos.z, dist = Math.hypot(dx, dz) || .001;
    e.bobP += dt * 6;
    e.g.rotation.y = Math.atan2(-dx, -dz);
    e.flash -= dt;
    const fl = e.flash > 0 ? 1 : 0;
    for (const m of e.flashables) m.material.emissive && m.material.emissive.setRGB(fl, fl, fl);
    if (e.T.boss) { updateBoss(e, dt, dx, dz, dist); continue; }
    if (e.type === 'flyer') {
      const k = dist > 14 ? 1 : dist < 9 ? -.8 : 0;
      let vx = dx / dist * k + (-dz / dist) * e.strafe * .7, vz = dz / dist * k + (dx / dist) * e.strafe * .7;
      if (Math.random() < dt * .4) e.strafe *= -1;
      for (const o of enemies) { if (o === e || o.type !== 'flyer') continue; const ox = pos.x - o.g.position.x, oz = pos.z - o.g.position.z, od = Math.hypot(ox, oz); if (od < 2.5 && od > .001) { vx += ox / od; vz += oz / od; } }
      const vl = Math.hypot(vx, vz) || 1;
      pos.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, pos.x + vx / vl * e.speed * dt));
      pos.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, pos.z + vz / vl * e.speed * dt));
      pos.y = e.alt + Math.sin(e.bobP * .5) * .4;
      e.parts.rotors.forEach((r, i) => r.rotation.y += dt * 30 * (i % 2 ? 1 : -1));
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist < 40 && e.spawnT >= 1) { enemyShoot(e); e.shootCd = Math.max(1, 2.6 - wave * .06) + Math.random(); }
      continue;
    }
    // 자폭병 퓨즈
    if (e.T.explode && e.fuse >= 0) {
      e.fuse -= dt;
      const s = 1 + Math.sin(e.fuse * 40) * .15 + (1 - e.fuse / .55) * .3; e.g.scale.setScalar(s);
      if (Math.floor(e.fuse * 20) % 2 === 0) sfx('beep', .4);
      if (e.fuse <= 0) detonate(e);
      continue;
    }
    if (e.T.explode && dist < 2.4 && P.pos.y < 2.5 && e.spawnT >= 1) { e.fuse = .55; continue; }
    let vx = dx / dist, vz = dz / dist;
    if (e.T.ranged) {
      const want = 13, k = dist > want + 2 ? 1 : dist < want - 3 ? -.8 : 0;
      vx = vx * k + (-dz / dist) * e.strafe * .6; vz = vz * k + (dx / dist) * e.strafe * .6;
      if (Math.random() < dt * .3) e.strafe *= -1;
    }
    for (const o of enemies) {
      if (o === e || o.type === 'flyer') continue;
      const ox = pos.x - o.g.position.x, oz = pos.z - o.g.position.z, od = Math.hypot(ox, oz), rr = e.radius + o.radius + .2;
      if (od < rr && od > .001) { vx += ox / od * (rr - od) * 2; vz += oz / od * (rr - od) * 2; }
    }
    const vl = Math.hypot(vx, vz) || 1, sp = e.speed * e.spawnT;
    const np = { x: pos.x + vx / vl * sp * dt, z: pos.z + vz / vl * sp * dt };
    collideXZ(np, e.radius, 0, 2);
    if (Math.hypot(np.x - pos.x, np.z - pos.z) < sp * dt * .35 && !e.T.ranged) { np.x += (-vz / vl) * e.strafe * sp * dt; np.z += (vx / vl) * e.strafe * sp * dt; collideXZ(np, e.radius, 0, 2); }
    pos.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, np.x)); pos.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, np.z));
    pos.y = Math.sin(e.bobP) * .08 + .1;
    if (e.parts.ring) e.parts.ring.rotation.z += dt * 4;
    if (e.parts.body && e.T.explode) e.parts.body.rotation.y += dt * 5;
    e.atkCd -= dt;
    if (!e.T.explode && dist < e.radius + P.radius + .6 && P.pos.y < 2 && e.atkCd <= 0) { damagePlayer(e.dmg, pos); e.atkCd = 1; }
    if (e.T.ranged) {
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist < 35 && e.spawnT >= 1) { enemyShoot(e); e.shootCd = Math.max(.9, 2.4 - wave * .07) + Math.random(); }
    }
  }
}

function updateWorld(dt) {
  // 적 탄환
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i]; b.m.position.addScaledVector(b.v, dt); b.life -= dt;
    const bp = b.m.position;
    let dead = b.life <= 0 || bp.y < 0 || Math.abs(bp.x) > ARENA + 2 || Math.abs(bp.z) > ARENA + 2;
    if (!dead && Math.hypot(bp.x - P.pos.x, bp.z - P.pos.z) < b.r && Math.abs(bp.y - (P.pos.y + .9)) < 1.1) { damagePlayer(b.dmg, bp.clone().sub(b.v)); dead = true; }
    if (!dead && pointInCollider(bp)) { dead = true; burst(bp, 0xd08aff, 3, 2); }
    if (dead) { scene.remove(b.m); eBullets.splice(i, 1); }
  }
  // 충격파
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i]; s.r += 17 * dt; s.m.scale.setScalar(s.r); s.m.material.opacity = Math.max(0, .9 - s.r / 40);
    const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
    if (!s.hit && Math.abs(d - s.r) < 1 && P.onGround) { s.hit = true; damagePlayer(s.dmg, new THREE.Vector3(s.x, 0, s.z)); P.vel.y = 6; P.onGround = false; }
    if (s.r > 42) { scene.remove(s.m); s.m.material.dispose(); shockwaves.splice(i, 1); }
  }
  // 지연 폭발 (자폭병 연쇄)
  while (pendingBlasts.length) { const b = pendingBlasts.shift(); explode(b.pos, b.r, b.dmg, b.opt); }
  // 픽업
  const tnow = performance.now() / 300;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.m.rotation.y += dt * 3; p.m.position.y = .6 + Math.sin(tnow + i) * .12; p.life -= dt;
    const d = Math.hypot(p.m.position.x - P.pos.x, p.m.position.z - P.pos.z);
    if (d < 4 && d > 1.2) { p.m.position.x += (P.pos.x - p.m.position.x) * dt * 3; p.m.position.z += (P.pos.z - p.m.position.z) * dt * 3; }
    if (d < 1.2 && P.pos.y < 1.8) {
      if (p.kind === 'hp') { P.hp = Math.min(P.maxHp, P.hp + 30); feed('+30 HP', '#29e07a'); }
      else if (p.kind === 'ammo') {
        inventory.forEach(k => { const W = WEAPONS[k], st = wstate[k]; if (W.reserve !== Infinity) st.reserve = Math.min(W.reserve, st.reserve + Math.ceil(W.reserve * .35)); });
        if (curW === 'rifle') wstate.rifle.mag = magOf('rifle');
        feed('탄약 보충', '#ffcf4d');
      } else { const c = 40 + wave * 8; cash += c; feed('+◆' + c, '#5fd4ff'); }
      sfx('pickup'); updateHUD(); p.life = 0;
    }
    if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); pickups.splice(i, 1); }
    else p.m.visible = !(p.life < 3 && Math.floor(p.life * 6) % 2 === 0);
  }
  // 점프패드 연출
  for (const pad of jumpPads) { pad.arrow.position.y = .9 + Math.sin(tnow * 1.5) * .2; pad.arrow.rotation.y += dt * 2; }
}

function updateFX(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt; p.v.y -= 12 * dt; p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < .04) { p.m.position.y = .04; p.v.set(p.v.x * .5, -p.v.y * .3, p.v.z * .5); }
    p.m.scale.setScalar(Math.max(.01, p.life * 2 * p.size));
    if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; t.l.material.opacity = Math.max(0, t.life / t.max); if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); tracers.splice(i, 1); } }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i]; b.life -= dt; const k = 1 - b.life / .45;
    b.m.scale.setScalar(.2 + k * b.radius); b.m.material.opacity = .8 * (1 - k); b.light.intensity = 30 * (1 - k);
    if (b.life <= 0) { scene.remove(b.m); scene.remove(b.light); b.m.material.dispose(); blasts.splice(i, 1); }
  }
  updateNums(dt);
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) hud.banner.style.opacity = 0; }
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) hud.hit.style.opacity = 0; }
  if (vigT > 0) vigT -= dt;
  const low = P.hp < 30 && state === 'play' ? .35 + Math.sin(performance.now() / 200) * .1 : 0;
  hud.vig.style.opacity = Math.max(vigT > 0 ? vigT * 1.4 : 0, low);
}

// =============== 루프 ===============
let last = performance.now(), menuT = 0, radarT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state === 'play') {
    updatePlayer(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateWorld(dt);
    radarT -= dt; if (radarT <= 0) { radarT = .05; drawRadar(); }
  } else if (state === 'menu') {
    menuT += dt * .12;
    camera.position.set(Math.sin(menuT) * 24, 10, Math.cos(menuT) * 24);
    camera.lookAt(0, 1, 0);
  }
  gunHolder.visible = state !== 'menu' && hud.scope.style.display !== 'block';
  updateFX(dt);
  renderer.render(scene, camera);
}
applyTheme(0);
WKEYS.forEach(initWeaponState);
equip('rifle', true);
refreshBest();
applyQuality();
requestAnimationFrame(loop);
