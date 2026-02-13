const canvas = document.getElementById('gameCanvas');
const speedEl = document.getElementById('speed');
const cameraBtn = document.getElementById('cameraBtn');
const audioBtn = document.getElementById('audioBtn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd5ebff, 200, 2600);

const worldSize = 2400;
const roadColor = new THREE.Color('#8b9bb6');
const grassColor = new THREE.Color('#caf0df');

const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 5000);
let cameraMode = 'third';

const hemi = new THREE.HemisphereLight(0xfff2fa, 0xa4d7c3, 1.15);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfffaf2, 0.9);
sun.position.set(220, 360, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(worldSize, worldSize, 1, 1),
  new THREE.MeshStandardMaterial({ color: grassColor, roughness: 0.95, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const roadMaterial = new THREE.MeshStandardMaterial({ color: roadColor, roughness: 0.87, metalness: 0.05 });
const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xd9e2f0, roughness: 0.5, metalness: 0.1 });

const roadDefs = [
  [0, -560, 1900, 140],
  [0, -150, 1700, 130],
  [0, 280, 2000, 150],
  [-740, 0, 130, 1900],
  [-230, 0, 140, 2000],
  [300, 0, 130, 1880],
  [760, 0, 140, 1950],
  [520, 640, 760, 120],
];

for (const [x, z, w, h] of roadDefs) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(w, 4, h), roadMaterial);
  road.position.set(x, 1.9, z);
  road.receiveShadow = true;
  scene.add(road);

  const lineCount = Math.floor((w > h ? w : h) / 85);
  for (let i = 0; i < lineCount; i++) {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(w > h ? 35 : 6, 1, w > h ? 6 : 35), laneMaterial);
    if (w > h) lane.position.set(x - w / 2 + 50 + i * 80, 4.8, z);
    else lane.position.set(x, 4.8, z - h / 2 + 50 + i * 80);
    scene.add(lane);
  }
}

for (let i = 0; i < 180; i++) {
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(12 + (i % 4) * 2, 30 + (i % 3) * 6, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${120 + (i % 6) * 8},70%,75%)`) }),
  );
  tree.position.set(((i * 147) % worldSize) - worldSize / 2, 16, ((i * 307) % worldSize) - worldSize / 2);
  scene.add(tree);
}

for (let i = 0; i < 65; i++) {
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
const carBody = new THREE.Mesh(
  new THREE.BoxGeometry(16, 6, 30),
  new THREE.MeshStandardMaterial({ color: 0xff5f8d, roughness: 0.35, metalness: 0.22 }),
);
carBody.position.y = 5;
carBody.castShadow = true;
carGroup.add(carBody);

const cockpit = new THREE.Mesh(
  new THREE.BoxGeometry(11, 4.5, 11),
  new THREE.MeshStandardMaterial({ color: 0xffd2e3, roughness: 0.28, metalness: 0.12 }),
);
cockpit.position.set(0, 9, -2);
carGroup.add(cockpit);
scene.add(carGroup);

const state = { x: 0, z: 0, heading: 0, speed: 0, steer: 0, boost: 0 };
const control = { steer: 0, throttle: 0, brake: 0 };

const touches = new Map();
canvas.addEventListener('touchstart', touchUpdate, { passive: false });
canvas.addEventListener('touchmove', touchUpdate, { passive: false });
canvas.addEventListener('touchend', touchEnd, { passive: false });
canvas.addEventListener('touchcancel', touchEnd, { passive: false });

function touchUpdate(e) {
  e.preventDefault();
  for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY });
  calcTouchControl();
}

function touchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) touches.delete(t.identifier);
  calcTouchControl();
}

function calcTouchControl() {
  control.steer = 0;
  control.throttle = 0;
  control.brake = 0;
  for (const t of touches.values()) {
    if (t.x < innerWidth * 0.5) {
      control.steer = THREE.MathUtils.clamp((t.x - innerWidth * 0.25) / (innerWidth * 0.25), -1, 1);
    } else {
      if (t.y < innerHeight * 0.56) control.throttle = THREE.MathUtils.clamp((innerHeight * 0.56 - t.y) / (innerHeight * 0.5), 0, 1);
      else control.brake = THREE.MathUtils.clamp((t.y - innerHeight * 0.56) / (innerHeight * 0.44), 0, 1);
    }
  }
}

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') control.steer = -1;
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') control.steer = 1;
  if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') control.throttle = 1;
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') control.brake = 1;
  if (e.key.toLowerCase() === 'c') cameraBtn.click();
});

addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) control.steer = 0;
  if (['ArrowUp', 'w', 'W'].includes(e.key)) control.throttle = 0;
  if (['ArrowDown', 's', 'S'].includes(e.key)) control.brake = 0;
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
  state.steer += (control.steer - state.steer) * Math.min(1, dt * 8);
  const maxSpeed = 380;
  state.speed += control.throttle * 260 * dt;
  state.speed -= control.brake * 360 * dt;
  state.speed -= 22 * dt;
  state.speed = THREE.MathUtils.clamp(state.speed, 0, maxSpeed);

  state.heading -= state.steer * (0.5 + state.speed / maxSpeed) * dt * 2.2;
  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;

  const bound = worldSize / 2 - 40;
  state.x = THREE.MathUtils.clamp(state.x, -bound, bound);
  state.z = THREE.MathUtils.clamp(state.z, -bound, bound);

  state.boost = state.speed > maxSpeed * 0.82 && control.throttle > 0.7 ? Math.min(1, state.boost + dt * 4) : Math.max(0, state.boost - dt * 2.6);

  carGroup.position.set(state.x, 0, state.z);
  carGroup.rotation.y = state.heading;

  if (audioCtx) {
    const ratio = state.speed / maxSpeed;
    osc.frequency.setTargetAtTime(95 + ratio * 420 + state.boost * 120, audioCtx.currentTime, 0.04);
    gain.gain.setTargetAtTime(0.02 + ratio * 0.09, audioCtx.currentTime, 0.08);
  }

  speedEl.textContent = Math.round(state.speed * 1.35);
}

function updateCamera(dt) {
  const forward = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  const up = new THREE.Vector3(0, 1, 0);
  if (cameraMode === 'third') {
    const back = forward.clone().multiplyScalar(-58 - (state.speed / 380) * 26 - state.boost * 22);
    const targetPos = new THREE.Vector3(state.x, 24 + (state.speed / 380) * 11, state.z).add(back).add(up.clone().multiplyScalar(20));
    camera.position.lerp(targetPos, Math.min(1, dt * 6));
    camera.lookAt(state.x + forward.x * 28, 7, state.z + forward.z * 28);
  } else {
    const targetPos = new THREE.Vector3(state.x, 10.5, state.z).add(forward.clone().multiplyScalar(7.2));
    camera.position.lerp(targetPos, Math.min(1, dt * 10));
    camera.lookAt(state.x + forward.x * 120, 9, state.z + forward.z * 120);
  }
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
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
  camera.updateProjectionMatrix();
  renderer.setViewport(0, y, w, renderH);
  renderer.setScissor(0, y, w, renderH);
  renderer.setScissorTest(true);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
