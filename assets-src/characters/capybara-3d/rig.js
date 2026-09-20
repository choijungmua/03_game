// 봉제인형 카피바라 3D 모델 + 뼈대 + 자세. 브라우저(three.js)에서 돌고, bake.mjs가 방향·동작마다 찍어 스프라이트로 굽는다.
// 부위(머리·몸통·팔·다리)는 뼈(Group)에 붙은 덩어리라, 옷도 같은 뼈에 붙이면 어떤 자세에서도 몸을 그대로 따라간다 (items.js).
// 치수·색은 원래 AI 스프라이트(public/assets/images/characters/capybara/capybara-stand-down.webp)를 같은 틀로 재어 맞췄다.
// 단위: 서 있는 키(귀 끝) ≈ 0.98, 바닥 y=0, 정면 +z
import * as THREE from "three";

export const C = {
  fur: "#d27e49",
  dark: "#684236",
  darker: "#2e1a12",
  earInner: "#43281e",
  eye: "#120c0a",
  blush: "#ff8f9a",
  mouth: "#2a140b",
  tongue: "#e57d86",
};

// ── 텍스처 (절차적으로 만든다) ─────────────────────────
function canvasTexture(size, draw, { repeat = 1, color = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** 이어 붙여도 이음새 없는 값 노이즈 (0~1) */
function tileNoise(size, cells, seed) {
  const rand = seeded(seed);
  const grid = Array.from({ length: cells * cells }, rand);
  const at = (x, y) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells;
      const gy = (y / size) * cells;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = smooth(gx - x0);
      const ty = smooth(gy - y0);
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      out[y * size + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

let textures;
function furTextures() {
  if (textures) return textures;
  const size = 256;
  const fine = tileNoise(size, 128, 3);
  const mid = tileNoise(size, 24, 5);
  const low = tileNoise(size, 6, 9);
  // 결: 굵기·밝기가 조금씩 다른 털 알갱이 + 넓은 얼룩 (원래 그림의 보송한 결)
  const grain = (i) => fine[i] * 0.55 + mid[i] * 0.3 + low[i] * 0.15;
  const map = canvasTexture(size, (ctx) => {
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 214 + (grain(i) - 0.5) * 64;
      img.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 3, color: true });
  const normal = canvasTexture(size, (ctx) => {
    const img = ctx.createImageData(size, size);
    const h = (x, y) => fine[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = new THREE.Vector3(-(h(x + 1, y) - h(x - 1, y)) * 2.2, -(h(x, y + 1) - h(x, y - 1)) * 2.2, 1).normalize();
        img.data.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], (y * size + x) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 3 });
  // 털 가닥: 촘촘한 점 노이즈 (껍데기마다 문턱값을 올려 끝으로 갈수록 가늘어진다)
  const strands = tileNoise(size, 256, 11);
  const hair = canvasTexture(size, (ctx) => {
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.min(255, Math.max(0, (strands[i] * 0.8 + fine[i] * 0.2) * 255));
      img.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, { repeat: 6 });
  // 볼터치: 가운데가 진하고 가장자리로 번지는 분홍 + 가는 사선 세 줄
  const blush = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const dx of [-18, 0, 18]) {
      ctx.beginPath();
      ctx.moveTo(s / 2 + dx - 6, s / 2 + 10);
      ctx.lineTo(s / 2 + dx + 6, s / 2 - 10);
      ctx.stroke();
    }
  });
  blush.wrapS = blush.wrapT = THREE.ClampToEdgeWrapping;
  textures = { map, normal, hair, blush };
  return textures;
}

// ── 재질 ─────────────────────────────────────────────
/** 펠트·털 재질. 결 텍스처 + 벨벳 광택(sheen)이 가장자리를 보송하게 밝힌다 */
export function felt(color, { sheen = 0.8, shine = "#ffd2a8", bumps = 0.45, grain = true } = {}) {
  const t = furTextures();
  return new THREE.MeshPhysicalMaterial({
    color,
    map: grain ? t.map : null,
    roughness: 0.95,
    sheen,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(shine),
    normalMap: t.normal,
    normalScale: new THREE.Vector2(bumps, bumps),
  });
}
export const gloss = (color, roughness = 0.12) => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 1, clearcoatRoughness: 0.05 });
export const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 });

/**
 * 털 껍데기: 메시를 법선 방향으로 조금씩 부풀린 겹을 여러 장 씌우고, 털 가닥 노이즈로 구멍을 뚫는다.
 * 바깥 겹일수록 가닥이 성기고 밝아져 가장자리가 보송보송해진다 (봉제인형 털)
 */
export function addFur(target, { length = 0.011, layers = 7 } = {}) {
  const base = target.material;
  const { hair } = furTextures();
  for (let i = 1; i <= layers; i++) {
    const k = i / layers;
    const material = base.clone();
    material.alphaMap = hair;
    material.alphaTest = 0.3 + k * 0.55;
    material.color = base.color.clone().multiplyScalar(0.86 + k * 0.2);
    const offset = (length * k).toFixed(5);
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\ntransformed += objectNormal * ${offset};`);
    };
    material.customProgramCacheKey = () => `fur-${offset}`;
    const shell = new THREE.Mesh(target.geometry, material);
    shell.name = target.name;
    shell.userData.fur = true;
    target.add(shell);
  }
  return target;
}

// ── 모양 ─────────────────────────────────────────────
/**
 * 둥근 덩어리. e<1이면 네모지게, e=1이면 타원체.
 * 반지름 [rx, ry, rz]에 아래·위 부풀림(bottom>1이면 아래가 불룩 — 볼·아랫배).
 * from·to: 높이 비율(1=꼭대기, -1=바닥)로 위아래를 깔끔하게 자른다. arc: 정면 기준 가로 반각(라디안)만 남긴다
 */
export function blobGeometry([rx, ry, rz], { e = 1, bottom = 1, top = 1, segments = 56, from = 1, to = -1, arc = null } = {}) {
  const thetaStart = Math.acos(from);
  const phi = arc === null ? [0, Math.PI * 2] : [Math.PI / 2 - arc, arc * 2];
  const geometry = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75), phi[0], phi[1], thetaStart, Math.acos(to) - thetaStart);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    if (e !== 1) {
      x = Math.sign(x) * Math.abs(x) ** e;
      y = Math.sign(y) * Math.abs(y) ** e;
      z = Math.sign(z) * Math.abs(z) ** e;
    }
    const swell = y < 0 ? 1 + (bottom - 1) * -y : 1 + (top - 1) * y;
    p.setXYZ(i, x * rx * swell, y * ry, z * rz * swell);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], name = "") {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.name = name;
  return m;
}

/** 곡선 한 줄(눈썹·입·감은 눈·홈): 점 목록을 잇는 둥근 관 */
export function stroke(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const tube = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(tube, material));
  for (const end of [points[0], points[points.length - 1]]) group.add(mesh(new THREE.SphereGeometry(radius, 10, 8), material, end));
  return group;
}

// ── 몸 치수 (옷이 같은 치수로 몸을 감싼다) ─────────────
export const BODY = {
  hipY: 0.2,
  /** 몸통: 엉덩이 기준. 옆이 곧고 통통한 몸 (목 없이 머리가 바로 얹힌다) */
  body: { at: [0, 0.1, 0], r: [0.285, 0.27, 0.25], bottom: 1.04, top: 0.93, e: 0.9 },
  /** 가슴(팔·목이 붙는 곳): 엉덩이에서 위로 */
  chestY: 0.26,
  neckY: 0.08,
  /** 머리: 목에서 위로. 가로로 넓은 둥근 네모, 아래 볼이 불룩 */
  headY: 0.19,
  head: { r: [0.285, 0.22, 0.3], bottom: 1.14, top: 0.84, e: 0.9 },
  shoulder: [0.2, 0.03, 0.13],
  arm: { r: [0.07, 0.095, 0.07] },
  paw: { r: [0.068, 0.06, 0.062], at: -0.12 },
  leg: { x: 0.13, r: [0.09, 0.1, 0.09] },
  foot: { r: [0.1, 0.05, 0.115], z: 0.035 },
};
/** 얼굴 자리 (머리 가운데 기준): 눈·귀. 옷(안경·후드·모자)도 이 자리를 따른다 */
export const EYE = { x: 0.158, y: 0.03 };
export const EAR = { x: 0.19, y: 0.18, z: -0.07, r: [0.062, 0.064, 0.034] };

/** 머리 표면 위 점: 앞에서 본 (x, y)에서 머리 겉면의 z (+lift만큼 띄움). 얼굴 부품이 머리 치수를 바꿔도 겉면에 붙는다 */
export function onHead(x, y, lift = 0) {
  const { r, bottom, top, e } = BODY.head;
  const ny = Math.max(-1, Math.min(1, y / r[1]));
  const swell = ny < 0 ? 1 + (bottom - 1) * -ny : 1 + (top - 1) * ny;
  const nx = Math.min(1, Math.abs(x / (r[0] * swell)));
  // 네모진 머리(e<1)의 겉면: |x|^(2/e) + |y|^(2/e) + |z|^(2/e) = 1
  const p = 2 / e;
  const nz = Math.max(0, 1 - nx ** p - Math.abs(ny) ** p) ** (1 / p);
  return [x, y, r[2] * swell * nz + lift];
}
/** 머리 겉면에서 바깥을 향하는 방향 (볼터치 같은 스티커를 붙일 때) */
function headNormal([x, y, z]) {
  const { r } = BODY.head;
  return new THREE.Vector3(x / r[0] ** 2, y / r[1] ** 2, z / r[2] ** 2).normalize();
}
/** 머리 겉면에 붙이는 얇은 스티커 (볼터치) */
function decal(material, [x, y], [w, h], lift = 0.004) {
  const at = onHead(x, y, lift);
  const m = mesh(new THREE.PlaneGeometry(w, h), material, at);
  m.lookAt(new THREE.Vector3(...at).add(headNormal(at)));
  return m;
}

/** 얼굴 표정 부품: 이름별로 켜고 끈다 */
function buildFace(head) {
  const face = {};
  const eyeMat = gloss(C.eye);
  const lineMat = flat(C.mouth);
  const white = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const { x: ex, y: ey } = EYE;

  // 눈: 반짝이는 검은 구슬 + 큰 반짝임·작은 반짝임
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.029, 28, 20), eyeMat, onHead(side * ex, ey, -0.006));
    eye.scale.set(0.92, 1.18, 0.62);
    eyes.add(eye);
    eyes.add(mesh(new THREE.SphereGeometry(0.0095, 12, 8), white, onHead(side * ex - 0.009, ey + 0.014, 0.012)));
    eyes.add(mesh(new THREE.SphereGeometry(0.004, 10, 8), white, onHead(side * ex + 0.009, ey - 0.011, 0.01)));
  }
  face.eyes = eyes;
  // 감은 눈: 아래로 둥근 선
  const closed = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * ex;
    closed.add(stroke([onHead(x - 0.028, ey + 0.004, 0.002), onHead(x, ey - 0.014, 0.004), onHead(x + 0.028, ey + 0.004, 0.002)], 0.0065, lineMat));
  }
  face.closed = closed;
  // 질끈 감은 눈 (하품): > <
  const squint = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * ex;
    squint.add(stroke([onHead(x - side * 0.028, ey + 0.024, 0.002), onHead(x + side * 0.018, ey, 0.004), onHead(x - side * 0.028, ey - 0.024, 0.002)], 0.0075, lineMat));
  }
  face.squint = squint;
  // 소용돌이 눈 (어지러움)
  const swirl = new THREE.Group();
  for (const side of [-1, 1]) {
    const pts = [];
    for (let t = 0; t <= 1; t += 0.05) {
      const a = t * Math.PI * 4 * side;
      const r = 0.004 + t * 0.028;
      pts.push(onHead(side * ex + Math.cos(a) * r, ey + Math.sin(a) * r, 0.003));
    }
    swirl.add(stroke(pts, 0.0055, lineMat));
  }
  face.swirl = swirl;
  // 눈썹: 짧고 굵은 둥근 막대, 안쪽이 살짝 올라간 걱정 눈썹 + 왼눈 옆 점 하나 (원래 그림의 귀여운 점)
  const brows = new THREE.Group();
  const browMat = flat(C.darker);
  for (const side of [-1, 1]) {
    brows.add(stroke([onHead(side * (ex - 0.03), ey + 0.078, 0.004), onHead(side * (ex + 0.004), ey + 0.07, 0.004), onHead(side * (ex + 0.034), ey + 0.058, 0.004)], 0.0105, browMat));
  }
  brows.add(mesh(new THREE.SphereGeometry(0.0085, 12, 8), browMat, onHead(-(ex + 0.052), ey + 0.018, 0.002)));
  face.brows = brows;
  // 볼터치: 번지는 분홍 스티커 (사선 세 줄)
  const blushMat = new THREE.MeshStandardMaterial({ color: C.blush, map: furTextures().blush, transparent: true, opacity: 0.85, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const blush = new THREE.Group();
  for (const side of [-1, 1]) blush.add(decal(blushMat, [side * 0.212, -0.05], [0.1, 0.07]));
  face.blush = blush;

  // 주둥이: 크고 짙은 네모진 덩어리, 위쪽에 콧구멍 둘 + Y자 입
  const snoutMat = felt(C.dark, { sheen: 0.55, shine: "#a8704c" });
  const snoutAt = onHead(0, -0.07, -0.075);
  const snoutR = [0.142, 0.122, 0.13];
  const muzzle = addFur(mesh(blobGeometry(snoutR, { e: 0.78, bottom: 1.05 }), snoutMat, snoutAt, [0, 0, 0], "snout"), { length: 0.006, layers: 5 });
  const snout = new THREE.Group();
  snout.add(muzzle);
  face.snout = snout;
  const front = snoutAt[2] + snoutR[2] * 0.98;
  const nose = new THREE.Group();
  for (const side of [-1, 1]) {
    const nostril = mesh(new THREE.SphereGeometry(0.013, 14, 10), flat(C.darker), [side * 0.036, snoutAt[1] + 0.05, front - 0.012]);
    nostril.scale.set(1.25, 0.75, 0.6);
    nostril.rotation.z = side * 0.35;
    nose.add(nostril);
  }
  face.nose = nose;
  const mouthMat = flat(C.darker);
  const mouth = new THREE.Group();
  mouth.add(stroke([[-0.03, snoutAt[1] + 0.036, front - 0.006], [0, snoutAt[1] + 0.012, front + 0.002], [0.03, snoutAt[1] + 0.036, front - 0.006]], 0.0048, mouthMat));
  mouth.add(stroke([[0, snoutAt[1] + 0.012, front + 0.002], [0, snoutAt[1] - 0.06, front - 0.008]], 0.0048, mouthMat));
  face.mouth = mouth;
  // 벌린 입 (하품·먹기): 짙은 타원 + 혀
  const open = new THREE.Group();
  const hole = mesh(new THREE.SphereGeometry(0.048, 24, 16), flat("#2a120a"), [0, snoutAt[1] - 0.035, front - 0.012]);
  hole.scale.set(0.95, 1.1, 0.4);
  open.add(hole);
  const tongue = mesh(new THREE.SphereGeometry(0.03, 20, 12), felt(C.tongue, { sheen: 0.3, grain: false }), [0, snoutAt[1] - 0.06, front - 0.002]);
  tongue.scale.set(1.1, 0.6, 0.5);
  open.add(tongue);
  open.add(stroke([[-0.028, snoutAt[1] + 0.036, front - 0.006], [0, snoutAt[1] + 0.014, front + 0.002], [0.028, snoutAt[1] + 0.036, front - 0.006]], 0.0048, mouthMat));
  face.open = open;
  for (const part of Object.values(face)) head.add(part);
  return face;
}

/** 앞발·발바닥의 홈 두 줄 */
function grooves(parent, center, normal, length, spread, material) {
  const n = new THREE.Vector3(...normal).normalize();
  const side = new THREE.Vector3(1, 0, 0);
  const along = new THREE.Vector3().crossVectors(n, side).normalize();
  for (const s of [-1, 1]) {
    const c = new THREE.Vector3(...center).addScaledVector(side, s * spread);
    const a = c.clone().addScaledVector(along, length / 2);
    const b = c.clone().addScaledVector(along, -length / 2);
    parent.add(stroke([a.toArray(), c.clone().addScaledVector(n, 0.003).toArray(), b.toArray()], 0.0042, material));
  }
}

/**
 * 카피바라 한 마리. 반환하는 bones에 옷을 붙이고, pose()로 자세를 잡는다.
 * 모든 부위 메시는 userData.body=true — 옷을 구울 때 가림막(depth)으로만 쓴다
 */
export function buildCapybara() {
  const root = new THREE.Group();
  const furMat = felt(C.fur);
  const darkMat = felt(C.dark, { sheen: 0.55, shine: "#a8704c" });
  const grooveMat = flat(C.darker);
  const fur = (m, opts) => addFur(m, opts);

  const hips = new THREE.Group();
  hips.position.y = BODY.hipY;
  root.add(hips);
  const { body } = BODY;
  hips.add(fur(mesh(blobGeometry(body.r, body), furMat, body.at, [0, 0, 0], "body")));
  hips.add(fur(mesh(new THREE.SphereGeometry(0.03, 16, 12), furMat, [0, 0.02, -body.r[2] - 0.005], [0, 0, 0], "tail")));

  const chest = new THREE.Group();
  chest.position.y = BODY.chestY;
  hips.add(chest);
  const neck = new THREE.Group();
  neck.position.set(0, BODY.neckY, 0);
  chest.add(neck);
  const head = new THREE.Group();
  head.position.set(0, BODY.headY, 0.03);
  neck.add(head);
  head.add(fur(mesh(blobGeometry(BODY.head.r, BODY.head), furMat, [0, 0, 0], [0, 0, 0], "head")));
  // 귀: 짙은 갈색 반달 귀 + 안쪽 오목한 자리
  for (const side of [-1, 1]) {
    const ear = fur(mesh(blobGeometry(EAR.r), darkMat, [side * EAR.x, EAR.y, EAR.z], [0.2, side * -0.25, side * -0.42], "ear"), { length: 0.006, layers: 5 });
    const inner = mesh(blobGeometry([EAR.r[0] * 0.62, EAR.r[1] * 0.58, EAR.r[2] * 0.45]), felt(C.earInner, { sheen: 0.3 }), [0, -0.008, EAR.r[2] * 0.62], [0, 0, 0], "ear");
    ear.add(inner);
    head.add(ear);
  }
  const face = buildFace(head);

  // 팔: 머리 바로 아래 몸통 옆에서 나오는 굵은 팔 + 홈 두 줄 난 짙은 앞발
  const arms = {};
  for (const [key, side] of [["L", 1], ["R", -1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * BODY.shoulder[0], BODY.shoulder[1], BODY.shoulder[2]);
    chest.add(shoulder);
    shoulder.add(fur(mesh(blobGeometry(BODY.arm.r, { bottom: 1.1 }), furMat, [0, -0.055, 0], [0, 0, 0], "arm")));
    const paw = fur(mesh(blobGeometry(BODY.paw.r), darkMat, [0, BODY.paw.at, 0.008], [0, 0, 0], "paw"), { length: 0.006, layers: 5 });
    grooves(paw, [0, -0.02, BODY.paw.r[2] * 0.88], [0, -0.35, 1], 0.05, 0.018, grooveMat);
    shoulder.add(paw);
    arms[key] = shoulder;
  }

  // 다리: 짧은 다리 + 넓적하고 홈 두 줄 난 짙은 발
  const legs = {};
  for (const [key, side] of [["L", 1], ["R", -1]]) {
    const hip = new THREE.Group();
    hip.position.set(side * BODY.leg.x, 0, 0);
    hips.add(hip);
    hip.add(fur(mesh(blobGeometry(BODY.leg.r), furMat, [0, -0.1, 0], [0, 0, 0], "leg")));
    const { r, z } = BODY.foot;
    const foot = fur(mesh(blobGeometry(r, { e: 0.9 }), darkMat, [0, -BODY.hipY + r[1], z], [0, 0, 0], "foot"), { length: 0.006, layers: 5 });
    grooves(foot, [0, r[1] * 0.35, r[2] * 0.9], [0, 0.45, 1], 0.045, 0.028, grooveMat);
    hip.add(foot);
    legs[key] = hip;
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.userData.body = true;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const bones = { root, hips, chest, neck, head, armL: arms.L, armR: arms.R, legL: legs.L, legR: legs.R };
  return { root, bones, face };
}

// ── 자세 ─────────────────────────────────────────────
const deg = (d) => (d * Math.PI) / 180;
const REST = {
  lift: 0,
  hips: [0, 0, 0],
  chest: [0, 0, 0],
  head: [0, 0, 0],
  // 팔: [앞뒤(−면 앞으로 듦), 비틀기, 옆(+면 L이 바깥으로)] — 기본은 배 위쪽에 앞발을 모음
  armL: [-62, 0, -24],
  armR: [-62, 0, 24],
  legL: [0, 0, 0],
  legR: [0, 0, 0],
  face: "normal",
  sit: false,
};

/** 자세 적용. 각도는 도(°). 안 준 값은 REST */
export function pose({ bones, face }, spec = {}) {
  const s = { ...REST, ...spec };
  const set = (bone, [x, y, z]) => bone.rotation.set(deg(x), deg(y), deg(z), "YXZ");
  bones.root.position.y = s.lift;
  set(bones.hips, s.hips);
  set(bones.chest, s.chest);
  set(bones.head, s.head);
  set(bones.armL, s.armL);
  set(bones.armR, s.armR);
  set(bones.legL, s.legL);
  set(bones.legR, s.legR);
  bones.hips.position.y = BODY.hipY + (s.sit ? -0.125 : 0);
  const show = {
    eyes: ["normal", "open", "chew"].includes(s.face),
    closed: ["sleep", "doze"].includes(s.face),
    squint: s.face === "yawn",
    swirl: s.face === "dizzy",
    brows: s.face !== "dizzy",
    blush: true,
    snout: true,
    nose: true,
    mouth: !["yawn", "open"].includes(s.face),
    open: ["yawn", "open"].includes(s.face),
  };
  for (const [name, part] of Object.entries(face)) part.visible = show[name] ?? false;
}
