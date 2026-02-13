const canvas = document.getElementById('gameCanvas');
const speedEl = document.getElementById('speed');
const cameraBtn = document.getElementById('cameraBtn');
const audioBtn = document.getElementById('audioBtn');
const touchpad = document.getElementById('touchpad');
const touchpadKnob = document.getElementById('touchpadKnob');
const throttleBtn = document.getElementById('throttleBtn');
const brakeBtn = document.getElementById('brakeBtn');
const boostBtn = document.getElementById('boostBtn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd5ebff, 200, 3000);

const worldSize = 2600;
const roadColor = new THREE.Color('#8b9bb6');
const grassColor = new THREE.Color('#caf0df');
const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 6000);
let cameraMode = 'third';

scene.add(new THREE.HemisphereLight(0xfff2fa, 0xa4d7c3, 1.2));
const sun = new THREE.DirectionalLight(0xfffaf2, 0.95);
sun.position.set(220, 360, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(worldSize, worldSize),
  new THREE.MeshStandardMaterial({ color: grassColor, roughness: 0.95, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const roadMaterial = new THREE.MeshStandardMaterial({ color: roadColor, roughness: 0.87, metalness: 0.05 });
const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xd9e2f0, roughness: 0.5, metalness: 0.1 });
const roadDefs = [
  [0, -560, 2100, 150], [0, -150, 1900, 140], [0, 280, 2200, 160],
  [-780, 0, 150, 2050], [-230, 0, 150, 2140], [340, 0, 150, 2050], [820, 0, 150, 2100],
  [560, 700, 820, 130],
];

for (const [x, z, w, h] of roadDefs) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(w, 4, h), roadMaterial);
  road.position.set(x, 1.9, z);
  road.receiveShadow = true;
  scene.add(road);

  const lineCount = Math.floor((w > h ? w : h) / 85);
  for (let i = 0; i < lineCount; i++) {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(w > h ? 38 : 6, 1, w > h ? 6 : 38), laneMaterial);
    if (w > h) lane.position.set(x - w / 2 + 55 + i * 80, 4.8, z);
    else lane.position.set(x, 4.8, z - h / 2 + 55 + i * 80);
    scene.add(lane);
  }
}

for (let i = 0; i < 200; i++) {
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(12 + (i % 4) * 2, 30 + (i % 3) * 6, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${120 + (i % 6) * 8},70%,75%)`) }),
  );
  tree.position.set(((i * 147) % worldSize) - worldSize / 2, 16, ((i * 307) % worldSize) - worldSize / 2);
  scene.add(tree);
}

for (let i = 0; i < 70; i++) {
  const w = 35 + (i % 5) * 10;
  const h = 45 + (i % 4) * 22;
  const d = 35 + (i % 3) * 12;
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(['#fbc8df', '#f6e0ab', '#c8d9ff', '#ffe0ef'][i % 4]) }),
  );
  building.position.set(((i * 223) % (worldSize - 220)) - worldSize / 2 + 110, h / 2, ((i * 419) % (worldSize - 220)) - worldSize / 2 + 110);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);
}

const carGroup = new THREE.Group();
const carBody = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 30), new THREE.MeshStandardMaterial({ color: 0xff5f8d, roughness: 0.35, metalness: 0.22 }));
carBody.position.y = 5;
carBody.castShadow = true;
carGroup.add(carBody);
const cockpit = new THREE.Mesh(new THREE.BoxGeometry(11, 4.5, 11), new THREE.MeshStandardMaterial({ color: 0xffd2e3, roughness: 0.28, metalness: 0.12 }));
cockpit.position.set(0, 9, -2);
carGroup.add(cockpit);
scene.add(carGroup);

const state = { x: 0, z: 0, heading: 0, speed: 0, steer: 0, boostVfx: 0 };
const control = { steer: 0, throttle: 0, brake: 0, boost: 0 };

let touchpadPointerId = null;
const touchpadState = { x: 0, y: 0, active: false };

function updateTouchpadFromPointer(ev) {
  const rect = touchpad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = ev.clientX - cx;
  const dy = ev.clientY - cy;
  const radius = rect.width * 0.38;
  const len = Math.min(radius, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  touchpadState.x = Math.cos(angle) * len;
  touchpadState.y = Math.sin(angle) * len;
  touchpadKnob.style.transform = `translate(calc(-50% + ${touchpadState.x}px), calc(-50% + ${touchpadState.y}px))`;
  control.steer = THREE.MathUtils.clamp(touchpadState.x / radius, -1, 1);
}

touchpad.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  touchpadPointerId = ev.pointerId;
  touchpadState.active = true;
  touchpad.setPointerCapture(ev.pointerId);
  updateTouchpadFromPointer(ev);
});
touchpad.addEventListener('pointermove', (ev) => {
  if (!touchpadState.active || ev.pointerId !== touchpadPointerId) return;
  updateTouchpadFromPointer(ev);
});
function releaseTouchpad(ev) {
  if (ev.pointerId !== touchpadPointerId) return;
  touchpadState.active = false;
  touchpadPointerId = null;
  touchpadState.x = 0;
  touchpadState.y = 0;
  control.steer = 0;
  touchpadKnob.style.transform = 'translate(-50%, -50%)';
}
touchpad.addEventListener('pointerup', releaseTouchpad);
touchpad.addEventListener('pointercancel', releaseTouchpad);

function bindHoldButton(el, onDown, onUp) {
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    onDown();
  });
  const up = () => onUp();
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}

bindHoldButton(throttleBtn, () => { control.throttle = 1; }, () => { control.throttle = 0; });
bindHoldButton(brakeBtn, () => { control.brake = 1; }, () => { control.brake = 0; });
bindHoldButton(boostBtn, () => { control.boost = 1; }, () => { control.boost = 0; });

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') control.steer = -1;
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') control.steer = 1;
  if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') control.throttle = 1;
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') control.brake = 1;
  if (e.key === 'Shift') control.boost = 1;
  if (e.key.toLowerCase() === 'c') cameraBtn.click();
});
addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key) && !touchpadState.active) control.steer = 0;
  if (['ArrowUp', 'w', 'W'].includes(e.key)) control.throttle = 0;
  if (['ArrowDown', 's', 'S'].includes(e.key)) control.brake = 0;
  if (e.key === 'Shift') control.boost = 0;
});

let audioCtx, osc, gain;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  gain = audioCtx.createGain();
  gain.gain.value = 0.001;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  audioBtn.textContent = '사운드 ON';
}
audioBtn.addEventListener('click', async () => {
  initAudio();
  await audioCtx.resume();
});

cameraBtn.addEventListener('click', () => {
  cameraMode = cameraMode === 'third' ? 'first' : 'third';
  cameraBtn.textContent = cameraMode === 'third' ? '카메라: 3인칭' : '카메라: 1인칭';
});

function updateCar(dt) {
  state.steer += (control.steer - state.steer) * Math.min(1, dt * 9);

  const normalMaxSpeed = 390;
  const boostMaxSpeed = 580;
  const boostOn = control.boost > 0.5;
  const maxSpeed = boostOn ? boostMaxSpeed : normalMaxSpeed;
  const accel = boostOn ? 520 : 270;

  state.speed += control.throttle * accel * dt;
  state.speed -= control.brake * 420 * dt;
  state.speed -= (boostOn ? 10 : 24) * dt;
  state.speed = THREE.MathUtils.clamp(state.speed, 0, maxSpeed);

  state.heading -= state.steer * (0.5 + state.speed / maxSpeed) * dt * (boostOn ? 2.8 : 2.2);
  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;

  const bound = worldSize / 2 - 40;
  state.x = THREE.MathUtils.clamp(state.x, -bound, bound);
  state.z = THREE.MathUtils.clamp(state.z, -bound, bound);

  state.boostVfx = boostOn ? Math.min(1, state.boostVfx + dt * 6) : Math.max(0, state.boostVfx - dt * 3.5);
  boostBtn.style.transform = boostOn ? 'scale(1.04)' : 'scale(1)';

  carGroup.position.set(state.x, 0, state.z);
  carGroup.rotation.y = state.heading;

  if (audioCtx) {
    const ratio = state.speed / boostMaxSpeed;
    osc.frequency.setTargetAtTime(95 + ratio * 560 + state.boostVfx * 200, audioCtx.currentTime, 0.04);
    gain.gain.setTargetAtTime(0.02 + ratio * 0.12, audioCtx.currentTime, 0.08);
  }

  speedEl.textContent = Math.round(state.speed * 1.35);
}

function updateCamera(dt) {
  const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  if (cameraMode === 'third') {
    const back = forward.clone().multiplyScalar(-60 - (state.speed / 580) * 34 - state.boostVfx * 36);
    const targetPos = new THREE.Vector3(state.x, 29 + (state.speed / 580) * 13 + state.boostVfx * 8, state.z).add(back);
    camera.position.lerp(targetPos, Math.min(1, dt * 7));
    camera.lookAt(state.x + forward.x * (30 + state.boostVfx * 20), 8, state.z + forward.z * (30 + state.boostVfx * 20));
  } else {
    const targetPos = new THREE.Vector3(state.x, 10.7, state.z).add(forward.clone().multiplyScalar(7.8));
    camera.position.lerp(targetPos, Math.min(1, dt * 11));
    camera.lookAt(state.x + forward.x * (120 + state.boostVfx * 80), 9, state.z + forward.z * (120 + state.boostVfx * 80));
  }

  camera.fov = THREE.MathUtils.lerp(camera.fov, 58 + state.boostVfx * 20 + Math.min(8, state.speed / 90), Math.min(1, dt * 4.5));
  camera.updateProjectionMatrix();
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener('resize', resize);
resize();

let prev = performance.now();
function animate(now) {
  const dt = Math.min(0.033, (now - prev) / 1000);
  prev = now;

  updateCar(dt);
  updateCamera(dt);

  const w = innerWidth;
  const h = innerHeight;
  const wideAspect = 2.05;
  const renderH = Math.min(h, w / wideAspect);
  const y = Math.floor((h - renderH) / 2);
  camera.aspect = w / renderH;
  renderer.setViewport(0, y, w, renderH);
  renderer.setScissor(0, y, w, renderH);
  renderer.setScissorTest(true);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
