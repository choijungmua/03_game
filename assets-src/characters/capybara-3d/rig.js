// 봉제인형 카피바라 3D 모델 + 뼈대 + 자세. 브라우저(three.js)에서 돌고, bake.mjs가 방향·동작마다 찍어 스프라이트로 굽는다.
// 부위(머리·몸통·팔·다리)는 뼈(Group)에 붙은 덩어리라, 옷도 같은 뼈에 붙이면 어떤 자세에서도 몸을 그대로 따라간다 (items.js).
// 단위: 서 있는 키 ≈ 1, 바닥 y=0, 정면 +z
import * as THREE from "three";

export const C = {
  fur: "#c98a52",
  furLight: "#d9a676",
  dark: "#5e3620",
  darker: "#4a2a17",
  eye: "#141010",
  blush: "#f4a3a3",
  mouth: "#3a1f12",
  tongue: "#e57d86",
};

// ── 재질 ─────────────────────────────────────────────
/** 털 결: 잔잔한 노이즈 노멀맵 (봉제인형 펠트 보풀) */
function fuzzNormalMap(seed = 1) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const h = new Float32Array(size * size).map(() => rand());
  // 살짝 뭉개서 보풀 알갱이를 만든다
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.9;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.9;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

let fuzz;
/** 펠트·털 재질. 벨벳 광택(sheen)이 가장자리를 보송하게 밝혀 봉제인형처럼 보인다 */
export function felt(color, { sheen = 0.7, shine = "#f3c89a", bumps = 0.35 } = {}) {
  fuzz ??= fuzzNormalMap();
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.92,
    sheen,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(shine),
    normalMap: fuzz,
    normalScale: new THREE.Vector2(bumps, bumps),
  });
}
export const gloss = (color, roughness = 0.18) => new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 1, clearcoatRoughness: 0.1 });
export const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 });

// ── 모양 ─────────────────────────────────────────────
/**
 * 둥근 덩어리. e<1이면 네모지게(주둥이), e=1이면 타원체.
 * 반지름 [rx, ry, rz]에 아래·위 부풀림(bottom>1이면 아랫배가 불룩한 서양배 모양)
 */
export function blobGeometry([rx, ry, rz], { e = 1, bottom = 1, top = 1, segments = 48, from = 1, to = -1, arc = null } = {}) {
  // from·to: 높이 비율(1=꼭대기, -1=바닥)로 위아래를 깔끔하게 자른다. arc: 정면 기준 가로 반각(라디안)만 남긴다
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
    // 서양배: 아래로 갈수록(y<0) 가로로 불룩
    const swell = y < 0 ? 1 + (bottom - 1) * (-y) : 1 + (top - 1) * y;
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

/** 곡선 한 줄(눈썹·입·감은 눈): 점 목록을 잇는 둥근 관 */
export function stroke(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const tube = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(tube, material));
  // 끝을 둥글게
  for (const end of [points[0], points[points.length - 1]]) group.add(mesh(new THREE.SphereGeometry(radius, 10, 8), material, end));
  return group;
}

// ── 몸 치수 (옷이 같은 치수로 몸을 감싼다) ─────────────
export const BODY = {
  hipY: 0.16,
  /** 몸통: 엉덩이 기준. 아랫배가 불룩한 서양배 */
  body: { at: [0, 0.1, 0], r: [0.265, 0.235, 0.225], bottom: 1.1 },
  /** 가슴(팔·목이 붙는 곳): 엉덩이에서 위로 */
  chestY: 0.25,
  neckY: 0.08,
  /** 머리: 목에서 위로. 크고 둥근 머리가 키의 절반쯤 */
  headY: 0.18,
  head: { r: [0.285, 0.24, 0.285], bottom: 1.08, top: 0.95 },
  shoulder: [0.19, 0.05, 0.1],
  arm: { r: [0.062, 0.085, 0.062] },
  leg: [0.115, 0.0, 0.0],
};

/** 머리 표면 위 점: 앞에서 본 (x, y)에서 머리 겉면의 z (+lift만큼 띄움). 얼굴 부품이 머리 치수를 바꿔도 겉면에 붙는다 */
export function onHead(x, y, lift = 0) {
  const [rx, ry, rz] = BODY.head.r;
  const ny = Math.max(-1, Math.min(1, y / ry));
  const swell = ny < 0 ? 1 + (BODY.head.bottom - 1) * -ny : 1 + (BODY.head.top - 1) * ny;
  const nx = x / (rx * swell);
  return [x, y, rz * swell * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) + lift];
}

/** 얼굴 표정 부품: 이름별로 켜고 끈다 */
function buildFace(head) {
  const face = {};
  const eyeMat = gloss(C.eye);
  const darkMat = flat(C.mouth);
  const z = BODY.head.r[2];
  const eyeY = 0.035;
  // 눈 (구슬 + 반짝임)
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.03, 24, 16), eyeMat, onHead(side * 0.14, eyeY, -0.008));
    eye.scale.set(1, 1.15, 0.6);
    eyes.add(eye);
    const glint = mesh(new THREE.SphereGeometry(0.009, 10, 8), flat("#ffffff"), onHead(side * 0.14 + 0.01, eyeY + 0.014, 0.008));
    glint.material.emissive = new THREE.Color("#ffffff");
    eyes.add(glint);
  }
  face.eyes = eyes;
  // 감은 눈: 아래로 둥근 선
  const closed = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * 0.14;
    closed.add(stroke([onHead(x - 0.03, eyeY + 0.005), onHead(x, eyeY - 0.015, 0.003), onHead(x + 0.03, eyeY + 0.005)], 0.007, darkMat));
  }
  face.closed = closed;
  // 질끈 감은 눈 (하품): > <
  const squint = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * 0.14;
    squint.add(stroke([onHead(x - side * 0.03, eyeY + 0.025), onHead(x + side * 0.02, eyeY, 0.003), onHead(x - side * 0.03, eyeY - 0.025)], 0.008, darkMat));
  }
  face.squint = squint;
  // 소용돌이 눈 (어지러움)
  const swirl = new THREE.Group();
  for (const side of [-1, 1]) {
    const pts = [];
    for (let t = 0; t <= 1; t += 0.05) {
      const a = t * Math.PI * 4 * side;
      const r = 0.004 + t * 0.03;
      pts.push(onHead(side * 0.14 + Math.cos(a) * r, eyeY + Math.sin(a) * r, 0.002));
    }
    swirl.add(stroke(pts, 0.006, darkMat));
  }
  face.swirl = swirl;
  // 눈썹: 살짝 걱정스러운 八자
  const brows = new THREE.Group();
  for (const side of [-1, 1]) {
    brows.add(stroke([onHead(side * 0.1, eyeY + 0.074), onHead(side * 0.14, eyeY + 0.07), onHead(side * 0.18, eyeY + 0.052)], 0.009, flat(C.darker)));
  }
  face.brows = brows;
  // 볼터치
  const blush = new THREE.Group();
  for (const side of [-1, 1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.04, 20, 12), new THREE.MeshStandardMaterial({ color: C.blush, roughness: 1, transparent: true, opacity: 0.75 }), onHead(side * 0.2, -0.035, -0.012));
    cheek.scale.set(1.2, 0.7, 0.35);
    cheek.lookAt(cheek.position.clone().multiplyScalar(3));
    blush.add(cheek);
  }
  face.blush = blush;
  // 주둥이 (짙은 갈색 네모진 타원) + 입선
  const snout = new THREE.Group();
  const muzzle = mesh(blobGeometry([0.13, 0.12, 0.13], { e: 0.78, bottom: 1.06 }), felt(C.dark, { sheen: 0.5, shine: "#b07a55" }), [0, -0.065, z * 0.74]);
  snout.add(muzzle);
  face.snout = snout;
  const mouthZ = z * 0.74 + 0.128;
  face.mouth = stroke([[-0.03, -0.1, mouthZ - 0.012], [0, -0.085, mouthZ], [0.03, -0.1, mouthZ - 0.012]], 0.005, flat(C.darker));
  face.mouth.add(stroke([[0, -0.04, mouthZ + 0.002], [0, -0.085, mouthZ]], 0.005, flat(C.darker)));
  // 벌린 입 (하품·먹기): 짙은 타원 + 혀
  const open = new THREE.Group();
  const hole = mesh(new THREE.SphereGeometry(0.05, 24, 16), flat("#2a120a"), [0, -0.095, mouthZ - 0.02]);
  hole.scale.set(0.9, 1.05, 0.45);
  open.add(hole);
  const tongue = mesh(new THREE.SphereGeometry(0.03, 20, 12), felt(C.tongue, { sheen: 0.3 }), [0, -0.12, mouthZ - 0.004]);
  tongue.scale.set(1.1, 0.6, 0.5);
  open.add(tongue);
  face.open = open;
  for (const part of Object.values(face)) head.add(part);
  return face;
}

/**
 * 카피바라 한 마리. 반환하는 bones에 옷을 붙이고, pose()로 자세를 잡는다.
 * 모든 부위 메시는 userData.body=true — 옷을 구울 때 가림막(depth)으로만 쓴다
 */
export function buildCapybara() {
  const root = new THREE.Group();
  const furMat = felt(C.fur);
  const darkMat = felt(C.dark, { sheen: 0.5, shine: "#b07a55" });

  const hips = new THREE.Group();
  hips.position.y = BODY.hipY;
  root.add(hips);
  hips.add(mesh(blobGeometry(BODY.body.r, { bottom: BODY.body.bottom }), furMat, BODY.body.at, [0, 0, 0], "body"));
  hips.add(mesh(new THREE.SphereGeometry(0.028, 16, 12), furMat, [0, 0.02, -0.21], [0, 0, 0], "tail"));

  const chest = new THREE.Group();
  chest.position.y = BODY.chestY;
  hips.add(chest);

  const neck = new THREE.Group();
  neck.position.set(0, BODY.neckY, 0);
  chest.add(neck);
  const head = new THREE.Group();
  head.position.set(0, BODY.headY, 0.01);
  neck.add(head);
  head.add(mesh(blobGeometry(BODY.head.r, BODY.head), furMat, [0, 0, 0], [0, 0, 0], "head"));
  // 귀: 짙은 갈색 동그란 귀
  for (const side of [-1, 1]) {
    const ear = mesh(blobGeometry([0.06, 0.058, 0.032]), darkMat, [side * 0.19, 0.2, -0.05], [0, side * -0.3, side * -0.3], "ear");
    head.add(ear);
  }
  const face = buildFace(head);

  // 팔: 어깨에서 앞으로 내려오는 짧은 원통 + 짙은 앞발
  const arms = {};
  for (const [key, side] of [["L", 1], ["R", -1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * BODY.shoulder[0], BODY.shoulder[1], BODY.shoulder[2]);
    chest.add(shoulder);
    const arm = mesh(blobGeometry(BODY.arm.r, { bottom: 1.15 }), furMat, [0, -0.06, 0], [0, 0, 0], "arm");
    shoulder.add(arm);
    const paw = mesh(blobGeometry([0.056, 0.05, 0.05]), darkMat, [0, -0.13, 0.01], [0, 0, 0], "paw");
    shoulder.add(paw);
    arms[key] = shoulder;
  }

  // 다리: 엉덩이에서 내려오는 짧은 다리 + 넓적한 짙은 발
  const legs = {};
  for (const [key, side] of [["L", 1], ["R", -1]]) {
    const hip = new THREE.Group();
    hip.position.set(side * BODY.leg[0], 0, 0);
    hips.add(hip);
    hip.add(mesh(blobGeometry([0.08, 0.1, 0.08]), furMat, [0, -0.09, 0], [0, 0, 0], "leg"));
    hip.add(mesh(blobGeometry([0.078, 0.044, 0.1], { e: 0.9 }), darkMat, [0, -BODY.hipY + 0.044, 0.03], [0, 0, 0], "foot"));
    legs[key] = hip;
  }

  root.traverse((o) => {
    if (o.isMesh) o.userData.body = true;
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
  // 팔: [앞뒤(−면 앞으로 듦), 비틀기, 옆(+면 L이 바깥으로)] — 기본은 배 앞에 앞발을 모음
  armL: [-55, 0, -22],
  armR: [-55, 0, 22],
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
  // 팔 각도는 L 기준, R은 거울
  set(bones.armL, s.armL);
  set(bones.armR, s.armR);
  set(bones.legL, s.legL);
  set(bones.legR, s.legR);
  bones.hips.position.y = BODY.hipY + (s.sit ? -0.12 : 0);
  const show = {
    eyes: ["normal", "open", "chew"].includes(s.face),
    closed: ["sleep", "doze"].includes(s.face),
    squint: s.face === "yawn",
    swirl: s.face === "dizzy",
    brows: s.face !== "dizzy",
    blush: true,
    snout: true,
    mouth: !["yawn", "open"].includes(s.face),
    open: ["yawn", "open"].includes(s.face),
  };
  for (const [name, part] of Object.entries(face)) part.visible = show[name] ?? false;
}
