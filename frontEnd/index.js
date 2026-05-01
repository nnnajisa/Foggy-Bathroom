import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Reflector }  from "three/addons/objects/Reflector.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

// ── room constants ────────────────────────────────────────────────
const RW = 7, RD = 5, RH = 3.8;
const HW = RW / 2;   // 3.5  (x: -3.5 → 3.5)
const HD = RD / 2;   // 2.5  (z: -2.5 → 2.5)

// window dimensions (used by wall-with-hole + glass pane)
const WIN_W = 1.6, WIN_H = 1.2, WIN_Y = 1.7;

// nozzle for water cone
const NOZZLE = new THREE.Vector3(-2.5, 2.1, -2.35);

// ── globals ───────────────────────────────────────────────────────
let scene, myRenderer, camera;
let socket;
let ceilingLight, ambientLight;
let currentState = { humidity: 0.5, showerOn: true, lightOn: true };

//users
let myName = "guest";
let myId = null;
const users = {};
let handTemplate = null;

// proximity
const SHOWER_TRIGGER = new THREE.Vector3(-2.2, 1.8, -1.4);
const SWITCH_TRIGGER = new THREE.Vector3( 2.5, 1.2,  2.0);
const TRIGGER_R      = 2.0;
let activePrompt = "";

// fps controls
let yaw = 0, pitch = 0;
let isDragging = false, lastMX = 0, lastMY = 0;
const keys = {};

// water
let waterMesh;
let showerSound;
let soundUnlocked = false;

// mirror fog
let fogCanvas, fogCtx, fogTexture, fogOverlayMesh;
let fogLevel = 0.3;
let fogMap = null;       // Float32Array: per-pixel fog opacity (0=wiped, 1=full)
let fogImageData = null; // pre-allocated ImageData for putImageData
const mouse     = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let lastStrokeUV = null;

// ── socket ────────────────────────────────────────────────────────
function setupMySocket() {
  socket = io();

  socket.on("initUser", (id) => {
    myId = id;
    myName = "me";
    socket.emit("joinUser", { name: myName });
  });

  socket.on("state", (s) => {
    currentState = s;
    applyState(s);
  });

  socket.on("draw", (data) => {
    paintStroke(data);
  });

  socket.on("users", (serverUsers) => {
    syncUsers(serverUsers);
  });

  socket.on("userMoved", (user) => {
    updateRemoteUser(user);
  });
}

function applyState(s) {
  document.getElementById("humidity-label").textContent =
    "humidity: " + Math.round(s.humidity * 100) + "%";

  const sb = document.getElementById("shower-btn");
  sb.textContent = "shower: " + (s.showerOn ? "ON" : "OFF");
  sb.className   = s.showerOn ? "on" : "";

  const lb = document.getElementById("light-btn");
  lb.textContent = "light: " + (s.lightOn ? "ON" : "OFF");
  lb.className   = s.lightOn ? "" : "on";

  if (ceilingLight) {
    ceilingLight.intensity = s.lightOn ? 1.8 : 0;
    ambientLight.intensity = s.lightOn ? 0.38 : 0;
  }
  
  updateShowerSound();
}

// ── room shell ────────────────────────────────────────────────────
function buildRoom() {
  const wall = new THREE.MeshStandardMaterial({ color: 0xd2dae0, roughness: 0.9 });
  const tile = new THREE.MeshStandardMaterial({ color: 0x88a4b2, roughness: 0.6 });
  const ceil = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 1.0 });

  mkPlane(RW, RD, tile, [0, 0, 0],       [-Math.PI/2, 0, 0]);       // floor
  mkPlane(RW, RD, ceil, [0, RH, 0],      [ Math.PI/2, 0, 0]);       // ceiling
  mkPlane(RW, RH, wall, [0, RH/2, -HD],  [0, 0, 0]);                // back wall
  mkPlane(RW, RH, wall, [0, RH/2,  HD],  [0, Math.PI, 0]);          // front wall
  mkPlane(RD, RH, wall, [-HW, RH/2, 0],  [0,  Math.PI/2, 0]);       // left wall
  buildRightWall(wall);                                               // right wall w/ window hole
}

// right wall uses ShapeGeometry so the window opening is a real hole
function buildRightWall(wallMat) {
  const shape = new THREE.Shape();
  shape.moveTo(-HD, -RH/2);
  shape.lineTo( HD, -RH/2);
  shape.lineTo( HD,  RH/2);
  shape.lineTo(-HD,  RH/2);
  shape.closePath();

  // hole in local mesh space
  // local_x = world_z, local_y = world_y - RH/2
  const hy = WIN_Y - RH/2;
  const hole = new THREE.Path();
  hole.moveTo(-WIN_W/2, hy - WIN_H/2);
  hole.lineTo( WIN_W/2, hy - WIN_H/2);
  hole.lineTo( WIN_W/2, hy + WIN_H/2);
  hole.lineTo(-WIN_W/2, hy + WIN_H/2);
  hole.closePath();
  shape.holes.push(hole);

  const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMat);
  wall.position.set(HW, RH/2, 0);
  wall.rotation.y = -Math.PI / 2;
  wall.receiveShadow = true;
  scene.add(wall);
}

function mkPlane(w, h, mat, pos, rot) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// ── shower: glass divider ─────────────────────────────────────────
// x = -1.5 ; runs from back wall (z=-HD) to z=0.5 (length=3, more than half of RD=5)
function buildShowerArea() {
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xaaccdd, transparent: true, opacity: 0.22,
    roughness: 0.05, side: THREE.DoubleSide,
  });
  const frameM = new THREE.MeshStandardMaterial(
    { color: 0x7a8898, roughness: 0.25, metalness: 0.75 }
  );

  const GX  = -1.5;
  const GL  = 3.0;                  // glass length along Z
  const GH  = 2.4;
  const GCZ = -HD + GL / 2;        // center z = -1.0

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(GL, GH), glassMat);
  glass.position.set(GX, GH / 2, GCZ);
  glass.rotation.y = Math.PI / 2;
  scene.add(glass);

  // top rail — parallel to glass (along Z)
  box(0.04, 0.04, GL + 0.08, frameM, [GX, GH, GCZ]);
  // floor trim — parallel to glass (along Z)
  box(0.02, 0.02, GL + 0.08, frameM, [GX, 0.01, GCZ]);
  // front vertical post (open end)
  box(0.04, GH + 0.04, 0.04, frameM, [GX, GH / 2, -HD + GL]);
}

// ── showerhead GLB ────────────────────────────────────────────────
function loadShowerhead() {
  new GLTFLoader().load(
    "/models/shower_head.glb",
    (gltf) => {
      const model = gltf.scene;
      const size  = new THREE.Vector3();
      new THREE.Box3().setFromObject(model).getSize(size);
      model.scale.setScalar(0.9 / Math.max(size.x, size.y, size.z));
      model.position.set(-2.5, 2.3, -(HD - 0.12));
      model.rotation.y = 0;
      scene.add(model);
    },
    undefined,
    (err) => console.warn("showerhead load failed:", err)
  );
}

// ── water: cone spray from nozzle ────────────────────────────────
function buildWater() {
  const waterMat = new THREE.MeshBasicMaterial({
    color: 0x66bbff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });

  const geo = new THREE.BoxGeometry(0.38, 2.3, 0.38);

  waterMesh = new THREE.Mesh(geo, waterMat);

  waterMesh.position.set(-2.5, 1.25, -1.99);

  scene.add(waterMesh);
  waterMesh.visible = false;
}

function updateWater() {
  if (!waterMesh) return;
  waterMesh.visible = currentState.showerOn;
}

function setupShowerSound() {
  showerSound = new Audio("/models/water.mp3");
  showerSound.loop = true;
  showerSound.volume = 0.45;

  window.addEventListener("click", unlockSoundOnce, { once: true });
  window.addEventListener("keydown", unlockSoundOnce, { once: true });
}

function unlockSoundOnce() {
  soundUnlocked = true;
  updateShowerSound();
}

function updateShowerSound() {
  if (!showerSound || !soundUnlocked) return;

  if (currentState.showerOn) {
    showerSound.play().catch(() => {});
  } else {
    showerSound.pause();
    showerSound.currentTime = 0;
  }
}

// ── mirror (Reflector) ────────────────────────────────────────────
// nearly fills upper portion of back wall to the right of the divider (x > -1.5)
function buildMirror() {
  const MW = 4.2, MH = 1.25;

  const mirror = new Reflector(new THREE.PlaneGeometry(MW, MH), {
    clipBias:     0.003,
    textureWidth:  512,
    textureHeight: 512,
    color:         0x889aaa,
  });
  mirror.position.set(0.9, 2.1, -(HD - 0.03));
  scene.add(mirror);

  const frameM = new THREE.MeshStandardMaterial(
    { color: 0x263040, roughness: 0.2, metalness: 0.9 }
  );
  const fb = 0.05;
  box(MW + fb*2, fb, fb, frameM, [0.9, 2.1 + MH/2 + fb/2, -(HD-0.02)]);
  box(MW + fb*2, fb, fb, frameM, [0.9, 2.1 - MH/2 - fb/2, -(HD-0.02)]);
  box(fb, MH + fb*2, fb, frameM, [0.9 - MW/2 - fb/2, 2.1, -(HD-0.02)]);
  box(fb, MH + fb*2, fb, frameM, [0.9 + MW/2 + fb/2, 2.1, -(HD-0.02)]);

  // ── fog overlay canvas ──────────────────────────────────────────
  const CW = 1024, CH = 256;
  fogCanvas        = document.createElement("canvas");
  fogCanvas.width  = CW;
  fogCanvas.height = CH;
  fogCtx           = fogCanvas.getContext("2d");
  // per-pixel fog state: 1.0 = fully fogged, 0.0 = fully wiped
  fogMap = new Float32Array(CW * CH);
  fogMap.fill(1.0);
  fogImageData = fogCtx.createImageData(CW, CH);
  for (let i = 0; i < fogMap.length; i++) {
    const j = i * 4;
    fogImageData.data[j]   = 190;
    fogImageData.data[j+1] = 205;
    fogImageData.data[j+2] = 215;
    fogImageData.data[j+3] = 255;
  }
  fogCtx.putImageData(fogImageData, 0, 0);

  fogTexture = new THREE.CanvasTexture(fogCanvas);

  fogOverlayMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MW, MH),
    new THREE.MeshBasicMaterial({
      map:         fogTexture,
      transparent: true,
      depthWrite:  false,
      opacity:     fogLevel,
    })
  );
  // sit just in front of the Reflector so it renders on top
  fogOverlayMesh.position.set(0.9, 2.1, -(HD - 0.07));
  scene.add(fogOverlayMesh);
}

// ── sink ─────────────────────────────────────────────────────────
function buildSink() {
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.3 });
  const basin = new THREE.MeshStandardMaterial({ color: 0xb0c4ce, roughness: 0.4 });
  const rim   = new THREE.MeshStandardMaterial({ color: 0xd8e2e8 });

  const CX = 0.9, CZ = -(HD - 0.32);   // counter center

  box(4.2, 0.07, 0.58, white, [CX, 0.9, CZ]);                  // slab
  box(4.2, 0.9, 0.05,  white, [CX, 0.45, CZ + 0.29]);          // front face
  box(0.05, 0.9, 0.58, white, [CX - 2.1, 0.45, CZ]);           // left side
  box(0.05, 0.9, 0.58, white, [CX + 2.1, 0.45, CZ]);           // right side

  const bp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.44), basin);
  bp.rotation.x = -Math.PI / 2;
  bp.position.set(CX, 0.895, CZ);
  scene.add(bp);

  box(1.06, 0.015, 0.015, rim, [CX, 0.9, CZ + 0.22]);
  box(1.06, 0.015, 0.015, rim, [CX, 0.9, CZ - 0.22]);
  box(0.015, 0.015, 0.44, rim, [CX - 0.53, 0.9, CZ]);
  box(0.015, 0.015, 0.44, rim, [CX + 0.53, 0.9, CZ]);
}

// ── ceiling light ─────────────────────────────────────────────────
function buildCeilingLight() {
  ceilingLight = new THREE.PointLight(0xfff8e8, 1.8, RW * 1.6);
  ceilingLight.position.set(0, RH - 0.1, 0);
  ceilingLight.castShadow = true;
  ceilingLight.shadow.mapSize.set(512, 512);
  scene.add(ceilingLight);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff8e8 })
  );
  bulb.position.copy(ceilingLight.position);
  scene.add(bulb);

  box(0.28, 0.03, 0.28,
    new THREE.MeshStandardMaterial({ color: 0xcccccc }),
    [0, RH - 0.01, 0]
  );
}

// ── light switch ──────────────────────────────────────────────────
function buildLightSwitch() {
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 })
  );
  plate.position.set(2.5, 1.2, HD - 0.025);
  plate.rotation.y = Math.PI;
  scene.add(plate);

  box(0.04, 0.07, 0.02,
    new THREE.MeshStandardMaterial({ color: 0xdddddd }),
    [2.5, 1.2, HD - 0.035]
  );
}

// ── door ─────────────────────────────────────────────────────────
function buildDoor() {
  const frameM = new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.85 });
  const doorM  = new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 0.9  });
  const DX = 0.8, DW = 0.9, DH = 2.15, Dz = HD - 0.025;

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), doorM);
  panel.position.set(DX, DH / 2, Dz);
  panel.rotation.y = Math.PI;
  scene.add(panel);

  box(DW + 0.1,  0.07, 0.06, frameM, [DX, DH + 0.035, HD - 0.03]);
  box(0.07, DH + 0.07, 0.06, frameM, [DX - DW/2 - 0.04, DH/2, HD - 0.03]);
  box(0.07, DH + 0.07, 0.06, frameM, [DX + DW/2 + 0.04, DH/2, HD - 0.03]);
}

// ── window + glass pane (right wall, hole already cut) ────────────
function buildWindow() {
  const frameM = new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.8 });
  const glassM = new THREE.MeshPhysicalMaterial({
    color: 0xd0eaf5, transparent: true, opacity: 0.12,
    roughness: 0.02, side: THREE.DoubleSide,
  });

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), glassM);
  glass.position.set(HW - 0.02, WIN_Y, 0);
  glass.rotation.y = -Math.PI / 2;
  scene.add(glass);

  // frame bars
  box(0.06, WIN_H + 0.12, 0.06, frameM, [HW - 0.03, WIN_Y, -WIN_W/2]);
  box(0.06, WIN_H + 0.12, 0.06, frameM, [HW - 0.03, WIN_Y,  WIN_W/2]);
  box(0.06, 0.06, WIN_W + 0.12, frameM, [HW - 0.03, WIN_Y + WIN_H/2, 0]);
  box(0.06, 0.06, WIN_W + 0.12, frameM, [HW - 0.03, WIN_Y - WIN_H/2, 0]);
  box(0.03, 0.03, WIN_W,         frameM, [HW - 0.03, WIN_Y, 0]);
}

function loadHandTemplate() {
  new GLTFLoader().load(
    "/models/hand.glb",
    (gltf) => {
      handTemplate = gltf.scene;
      // Upgrade any users that were created before the GLB finished loading
      for (const id in users) attachHandToGroup(users[id]);
    },
    undefined,
    (err) => console.warn("hand load failed:", err)
  );
}

// ── HDRI background + environment ────────────────────────────────
function loadHDRI() {
  new RGBELoader().load(
    "/models/kloofendal_48d_partly_cloudy_puresky_1k.hdr",
    (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      scene.background  = hdr;   // visible through window hole
      scene.environment = hdr;   // drives material reflections
      myRenderer.toneMappingExposure = 0.55;
    },
    undefined,
    (err) => console.warn("HDRI load failed:", err)
  );
}

function paintStroke({ uv, size }) {
  const r = size === "large" ? 10 : size === "small" ? 3 : 5;

  if (lastStrokeUV) {
    const dx = uv.x - lastStrokeUV.x;
    const dy = uv.y - lastStrokeUV.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const steps = Math.max(1, Math.ceil(dist * 1000));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const interpUV = {
        x: lastStrokeUV.x + dx * t,
        y: lastStrokeUV.y + dy * t
      };
      drawFogEraseDot(interpUV, r);
    }
  } else {
    drawFogEraseDot(uv, r);
  }

  lastStrokeUV = uv;
  if (fogCtx && fogImageData) {
    fogCtx.putImageData(fogImageData, 0, 0);
    fogTexture.needsUpdate = true;
  }
}

function drawFogEraseDot(uv, r) {
  if (!fogMap || !fogImageData) return;
  const CW = fogCanvas.width, CH = fogCanvas.height;
  const cx = Math.round(uv.x * CW);
  const cy = Math.round((1 - uv.y) * CH);
  const ri = Math.ceil(r);

  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= CW || y < 0 || y >= CH) continue;
      // gradient: full erase at center, taper at edge
      const wipe = dist < r * 0.65
        ? 1.0
        : 1.0 - (dist - r * 0.65) / (r * 0.35);
      const idx = y * CW + x;
      fogMap[idx] = Math.max(0, fogMap[idx] - wipe);
      fogImageData.data[idx * 4 + 3] = Math.round(fogMap[idx] * 255);
    }
  }
}

function refogMirror(h) {
  if (!fogCtx || !fogOverlayMesh || !fogMap || !fogImageData) return;

  const t = THREE.MathUtils.clamp((h - 0.5) / 0.5, 0, 1);
  const targetFog = THREE.MathUtils.lerp(0.3, 1.0, t);

  // Global fog level: linear rise/fall, speed proportional to humidity
  const riseSpeed = THREE.MathUtils.lerp(0.0002, 0.0012, t);
  const fallSpeed = THREE.MathUtils.lerp(0.0012, 0.0002, t);

  if (fogLevel < targetFog) {
    fogLevel = Math.min(targetFog, fogLevel + riseSpeed);
  } else if (fogLevel > targetFog) {
    fogLevel = Math.max(targetFog, fogLevel - fallSpeed);
  }
  fogOverlayMesh.material.opacity = fogLevel;

  // Per-pixel linear refill — rate tuned to match snow-sketch.js accumulation pace
  // t=0 (50% humidity): ~55 s to refill; t=1 (100%): ~14 s to refill
  const refillRate = THREE.MathUtils.lerp(0.0003, 0.0012, t);
  const data = fogImageData.data;
  let dirty = false;

  for (let i = 0; i < fogMap.length; i++) {
    if (fogMap[i] < 1.0) {
      fogMap[i] = Math.min(1.0, fogMap[i] + refillRate);
      data[i * 4 + 3] = Math.round(fogMap[i] * 255);
      dirty = true;
    }
  }

  if (dirty) {
    fogCtx.putImageData(fogImageData, 0, 0);
    fogTexture.needsUpdate = true;
  }
}

// ── helper ────────────────────────────────────────────────────────
function box(w, h, d, mat, pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(...pos);
  m.castShadow = true;
  scene.add(m);
  return m;
}

// ── init ──────────────────────────────────────────────────────────
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1820);   // replaced once HDRI loads

  myRenderer = new THREE.WebGLRenderer({ antialias: true });
  myRenderer.setSize(window.innerWidth, window.innerHeight);
  myRenderer.setPixelRatio(window.devicePixelRatio);
  myRenderer.shadowMap.enabled = true;
  myRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  myRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  myRenderer.toneMappingExposure = 1.0;
  document.body.appendChild(myRenderer.domElement);

  camera = new THREE.PerspectiveCamera(
    70, window.innerWidth / window.innerHeight, 0.1, 60
  );
  camera.position.set(0, 1.6, 2.5);
  camera.lookAt(-1.2, 1.6, -1.5);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.38);
  scene.add(ambientLight);

  buildRoom();
  buildShowerArea();
  loadShowerhead();
  loadHandTemplate();
  buildWater();
  setupShowerSound();
  buildMirror();
  buildSink();
  buildCeilingLight();
  buildLightSwitch();
  buildDoor();
  buildWindow();
  loadHDRI();

  setupMySocket();
  setupUI();
  setupControls();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    myRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  draw();
}

// ── UI buttons ────────────────────────────────────────────────────
function setupUI() {
  document.getElementById("shower-btn").addEventListener("click", () => {
    socket.emit("setShower", !currentState.showerOn);
  });
  document.getElementById("light-btn").addEventListener("click", () => {
    socket.emit("setLight", !currentState.lightOn);
  });
}

// ── FPS controls ──────────────────────────────────────────────────
function setupControls() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  yaw   = e.y;
  pitch = e.x;

  // drag to look
  myRenderer.domElement.addEventListener("mousedown", (ev) => {
    isDragging = true; lastMX = ev.clientX; lastMY = ev.clientY;
  });
  window.addEventListener("mouseup", () => {
  isDragging = false;
  lastStrokeUV = null;
});
  window.addEventListener("mousemove", (ev) => {
    if (!isDragging) return;

    if (keys["Shift"] && fogOverlayMesh) {
      // Shift + drag → wipe fog on mirror
      mouse.x =  (ev.clientX / window.innerWidth)  * 2 - 1;
      mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(fogOverlayMesh);
      if (hits[0]?.uv) {
        const data = { uv: { x: hits[0].uv.x, y: hits[0].uv.y }, size: "medium" };
        paintStroke(data);
        socket.emit("draw", data);
      }
    } else {
      // normal drag → look around
      yaw   -= (ev.clientX - lastMX) * 0.003;
      pitch -= (ev.clientY - lastMY) * 0.003;
      pitch  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, pitch));
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
    }
    lastMX = ev.clientX; lastMY = ev.clientY;
  });

  // scroll to zoom (move along look direction)
  myRenderer.domElement.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, -ev.deltaY * 0.005);
  }, { passive: false });

  // keys
  window.addEventListener("keydown", (ev) => {
    keys[ev.key] = true;
    const k = ev.key.toLowerCase();
    if (k === "e" && activePrompt === "shower")
      socket.emit("setShower", !currentState.showerOn);
    if (k === "f" && activePrompt === "switch")
      socket.emit("setLight",  !currentState.lightOn);
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(ev.key))
      ev.preventDefault();
  });
  window.addEventListener("keyup", (ev) => { keys[ev.key] = false; });
}

const _fwd   = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up    = new THREE.Vector3(0, 1, 0);

function makeNameLabel(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "28px monospace";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText(name, 128, 42);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.8, 0.2, 1);
  sprite.position.set(0, 0.35, 0);

  return sprite;
}

function attachHandToGroup(group) {
  if (group.userData.handMesh) {
    group.remove(group.userData.handMesh);
  }
  let hand;
  if (handTemplate) {
    hand = handTemplate.clone(true);
    hand.scale.setScalar(0.25);
    hand.rotation.set(3 * Math.PI/2, Math.PI, 2 * Math.PI);
  } else {
    hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffccaa })
    );
  }
  group.add(hand);
  group.userData.handMesh = hand;
}

function createUserHand(user) {
  const group = new THREE.Group();
  attachHandToGroup(group);
  group.add(makeNameLabel(user.name));
  scene.add(group);
  users[user.id] = group;
  updateRemoteUser(user);
}

function syncUsers(serverUsers) {
  for (const id in serverUsers) {
    if (!users[id]) createUserHand(serverUsers[id]);
    else updateRemoteUser(serverUsers[id]);
  }

  for (const id in users) {
    if (!serverUsers[id]) {
      scene.remove(users[id]);
      delete users[id];
    }
  }
}

function updateRemoteUser(user) {
  if (!users[user.id]) createUserHand(user);

  const p = user.position;
  users[user.id].position.set(p.x, p.y, p.z);
}

function sendMyHandPosition() {
  if (!socket || !myId) return;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const handPos = camera.position.clone()
    .addScaledVector(dir, 0.85);

  handPos.y -= 0.25;

  const userData = {
    id: myId,
    name: myName,
    position: {
      x: handPos.x,
      y: handPos.y,
      z: handPos.z
    }
  };

  // update my own hand locally
  updateRemoteUser(userData);

  // send to other people
  socket.emit("userMove", {
    position: userData.position
  });
}

function moveCamera() {
  const speed = 0.055;
  camera.getWorldDirection(_fwd);
  _fwd.y = 0; 
  _fwd.normalize();
  _right.crossVectors(_fwd, _up).normalize();

  if (keys["w"] || keys["ArrowUp"])    camera.position.addScaledVector(_fwd,    speed);
  if (keys["s"] || keys["ArrowDown"])  camera.position.addScaledVector(_fwd,   -speed);
  if (keys["a"] || keys["ArrowLeft"])  camera.position.addScaledVector(_right, -speed);
  if (keys["d"] || keys["ArrowRight"]) camera.position.addScaledVector(_right,  speed);

  // keep user inside the bathroom
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -HW + 0.25, HW - 0.25);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -HD + 0.25, HD - 0.25);

  // keep camera at eye height
  camera.position.y = 1.6;
}

// ── proximity ─────────────────────────────────────────────────────
function checkProximity() {
  const cp = camera.position;
  const el = document.getElementById("prompt");

  if (cp.distanceTo(SHOWER_TRIGGER) < TRIGGER_R) {
    activePrompt = "shower";
    el.textContent  = "[ E ] — Toggle shower";
    el.style.display = "block";
  } else if (cp.distanceTo(SWITCH_TRIGGER) < TRIGGER_R) {
    activePrompt = "switch";
    el.textContent  = "[ F ] — Toggle light";
    el.style.display = "block";
  } else {
    activePrompt = "";
    el.style.display = "none";
  }
}

// ── draw loop ─────────────────────────────────────────────────────
function draw() {
  moveCamera();
  sendMyHandPosition();
  checkProximity();
  updateWater();
  refogMirror(currentState.humidity);
  myRenderer.render(scene, camera);
  window.requestAnimationFrame(draw);
}

init();
