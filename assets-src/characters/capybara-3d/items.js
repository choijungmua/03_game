// 옷장 옷: 옷 하나 = 뼈에 붙는 메시 몇 개. 카피바라와 같은 뼈에 붙으니 어떤 자세·방향에서도 몸을 그대로 따라간다.
// 새 옷은 ITEMS에 하나 넣고 bake.mjs를 돌리면 모든 프레임이 구워진다.
//   build(bones, attach): attach(뼈, 메시)로 붙인다. 몸 치수(BODY)를 두께만큼 부풀린 껍데기(shell)를 쓰면 몸에 딱 맞는다
//   hides: 이 옷이 덮는 몸 부위 이름 (그 부위는 가림막에서 빠져 옷이 위에 그려진다. 예: 후드가 귀를 덮음)
import * as THREE from "three";

import { blobGeometry, BODY, EAR, EYE, felt, flat, gloss, mesh, onHead, stroke } from "./rig.js";

/** 머리 꼭대기 높이 (머리 가운데 기준) */
const TOP = BODY.head.r[1];

// ── 옷 만들기 도구 ─────────────────────────────────────
const pad = ([x, y, z], t) => [x + t, y + t, z + t];

/** 몸통 껍데기 (엉덩이 뼈). top·bottom: 몸통 높이 비율로 위·아래를 잘라 바지·허리띠를, arc: 앞쪽만 남겨 배판을 만든다 */
function torso(material, { t = 0.022, top = 1, bottom = -1, arc = null } = {}) {
  const cut = top < 1 || bottom > -1 || arc !== null;
  const m = cut ? material.clone() : material;
  if (cut) m.side = THREE.DoubleSide;
  const { e, top: crown, bottom: belly } = BODY.body;
  return mesh(blobGeometry(pad(BODY.body.r, t), { e, top: crown, bottom: belly, from: top, to: bottom, arc }), m, BODY.body.at);
}
/** 소매 (어깨 뼈): 팔 껍데기. 앞발은 밖으로 나온다 */
function sleeve(material, { t = 0.016, flare = 1 } = {}) {
  const r = pad(BODY.arm.r, t);
  const m = material.clone();
  m.side = THREE.DoubleSide;
  return mesh(blobGeometry([r[0] * flare, r[1], r[2] * flare], { bottom: 1.1 * flare, to: -0.55 }), m, [0, -0.055, 0]);
}
/** 바짓가랑이 (다리 뼈) */
function trouser(material, { t = 0.016 } = {}) {
  const m = material.clone();
  m.side = THREE.DoubleSide;
  return mesh(blobGeometry(pad(BODY.leg.r, t), { to: -0.45 }), m, [0, -0.1, 0]);
}
/** 삼각형 거르기: 중심이 keepFn(x,y,z)를 만족하는 면만 남긴다 (양면 재질로 쓴다) */
function keep(geometry, keepFn) {
  const g = geometry.toNonIndexed();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  const out = { p: [], n: [], uv: [] };
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (!keepFn(cx, cy, cz)) continue;
    for (let k = i; k < i + 3; k++) {
      out.p.push(p.getX(k), p.getY(k), p.getZ(k));
      out.n.push(n.getX(k), n.getY(k), n.getZ(k));
      out.uv.push(uv.getX(k), uv.getY(k));
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(out.p, 3));
  result.setAttribute("normal", new THREE.Float32BufferAttribute(out.n, 3));
  result.setAttribute("uv", new THREE.Float32BufferAttribute(out.uv, 2));
  return result;
}

/**
 * 후드 (머리 뼈): 머리 껍데기에서 얼굴 자리를 둥글게 뚫고 테두리를 두른다. 귀 자리엔 귀 주머니.
 * 돌려주는 face(nx, ny)는 구멍 둘레 위 점 — 이빨·장식을 두를 때 쓴다
 */
function hood(attach, head, material, { t = 0.03, rim = material, earPockets = true } = {}) {
  const r = pad(BODY.head.r, t);
  const opening = { cx: 0, cy: -0.12, rx: 0.64, ry: 0.66 };
  const inFace = (x, y, z) => z > 0 && ((x / r[0] - opening.cx) / opening.rx) ** 2 + ((y / r[1] - opening.cy) / opening.ry) ** 2 < 1;
  const geometry = keep(blobGeometry(r, { e: BODY.head.e, bottom: BODY.head.bottom, top: BODY.head.top }), (x, y, z) => !inFace(x, y, z));
  const sided = material.clone();
  sided.side = THREE.DoubleSide;
  attach(head, mesh(geometry, sided));
  const around = (a, lift = 0) => {
    const nx = opening.cx + opening.rx * Math.cos(a);
    const ny = opening.cy + opening.ry * Math.sin(a);
    const swell = ny < 0 ? 1 + (BODY.head.bottom - 1) * -ny : 1 + (BODY.head.top - 1) * ny;
    const nz = Math.sqrt(Math.max(0, 1 - (nx / swell) ** 2 - ny * ny));
    return [nx * r[0], ny * r[1], nz * r[2] * swell + lift];
  };
  const ring = [];
  for (let i = 0; i <= 48; i++) ring.push(around((i / 48) * Math.PI * 2));
  const loop = new THREE.CatmullRomCurve3(ring.map((q) => new THREE.Vector3(...q)), true);
  attach(head, new THREE.Mesh(new THREE.TubeGeometry(loop, 96, 0.022, 10, true), rim));
  if (earPockets) {
    for (const side of [-1, 1]) {
      attach(head, mesh(blobGeometry([EAR.r[0] + 0.016, EAR.r[1] + 0.012, EAR.r[2] + 0.02]), material, [side * EAR.x, EAR.y, EAR.z], [0.2, side * -0.25, side * -0.42]));
    }
  }
  return around;
}

/** 몸통 겉면 위 점 (엉덩이 뼈 좌표): 가로 각 a(0=정면), 높이 비율 v(-1~1) */
function onTorso(a, v, t = 0.022, lift = 0) {
  const r = pad(BODY.body.r, t + lift);
  const swell = v < 0 ? 1 + (BODY.body.bottom - 1) * -v : 1;
  const c = Math.sqrt(Math.max(0, 1 - v * v));
  return [BODY.body.at[0] + Math.sin(a) * c * r[0] * swell, BODY.body.at[1] + v * r[1], BODY.body.at[2] + Math.cos(a) * c * r[2] * swell];
}
/** 몸통 겉면에 점박이(씨앗·무늬)를 흩뿌린다 */
function dots(attach, bone, material, { count, size, from = -0.8, to = 0.75, t = 0.022, seed = 7, shape = [1, 1, 0.5] }) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const v = from + rand() * (to - from);
    const at = new THREE.Vector3(...onTorso(a, v, t));
    const dot = mesh(new THREE.SphereGeometry(size, 12, 8), material, at.toArray());
    dot.scale.set(...shape);
    const out = at.clone().sub(new THREE.Vector3(...BODY.body.at)).multiplyScalar(2).add(at);
    dot.lookAt(out);
    attach(bone, dot);
  }
}

/** 안경테: 두 눈 앞 렌즈 + 다리. lens(재질)·frame(재질)·shape(렌즈 모양 함수 → Shape) */
function spectacles(attach, head, { frame, lens, shape, size = 0.056, bridge = true, band = null }) {
  const eyeY = EYE.y;
  for (const side of [-1, 1]) {
    const [x, y, z] = onHead(side * EYE.x, eyeY, 0.035);
    const outline = shape(size);
    const lensMesh = mesh(new THREE.ShapeGeometry(outline, 24), lens, [x, y, z]);
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outline, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 }),
      frame,
    );
    // 테는 가운데를 뚫은 링: 바깥 모양에 조금 작은 구멍
    const hole = shape(size * 0.8);
    outline.holes.push(new THREE.Path(hole.getPoints(24)));
    rim.geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 });
    rim.position.set(x, y, z - 0.006);
    // 머리 겉면을 따라 살짝 옆으로 돈다
    const turn = side * Math.atan2(x, z) * 0.6;
    rim.rotation.y = turn;
    lensMesh.rotation.y = turn;
    lensMesh.position.z += 0.002;
    attach(head, rim);
    attach(head, lensMesh);
    // 다리: 렌즈 바깥에서 머리 옆을 따라 귀 쪽으로
    const start = [x + side * size * 0.95, y + size * 0.2, z - 0.01];
    const path = [start, onHead(side * (BODY.head.r[0] - 0.045), eyeY + 0.04, 0.012), [side * (BODY.head.r[0] + 0.006), eyeY + 0.04, -0.04]];
    attach(head, band ? stroke(path, 0.012, band) : stroke(path, 0.006, frame));
  }
  if (bridge) attach(head, stroke([onHead(-(EYE.x - size), eyeY + 0.02, 0.04), onHead(0, eyeY + 0.035, 0.07), onHead(EYE.x - size, eyeY + 0.02, 0.04)], 0.006, frame));
}
const circle = (r) => new THREE.Shape().absarc(0, 0, r, 0, Math.PI * 2);
const roundRect = (r) => {
  const w = r * 1.15;
  const h = r * 0.85;
  const k = r * 0.35;
  const s = new THREE.Shape();
  s.moveTo(-w + k, -h);
  s.lineTo(w - k, -h);
  s.quadraticCurveTo(w, -h, w, -h + k);
  s.lineTo(w, h - k);
  s.quadraticCurveTo(w, h, w - k, h);
  s.lineTo(-w + k, h);
  s.quadraticCurveTo(-w, h, -w, h - k);
  s.lineTo(-w, -h + k);
  s.quadraticCurveTo(-w, -h, -w + k, -h);
  return s;
};
const heart = (r) => {
  const s = new THREE.Shape();
  s.moveTo(0, -r);
  s.bezierCurveTo(r * 0.3, -r * 0.6, r * 1.2, -r * 0.2, r * 1.1, r * 0.35);
  s.bezierCurveTo(r, r * 0.95, r * 0.25, r * 1.0, 0, r * 0.5);
  s.bezierCurveTo(-r * 0.25, r * 1.0, -r, r * 0.95, -r * 1.1, r * 0.35);
  s.bezierCurveTo(-r * 1.2, -r * 0.2, -r * 0.3, -r * 0.6, 0, -r);
  return s;
};
const star = (r) => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r * 1.25 : r * 0.55;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
};
const glass = (color, opacity = 0.55) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transparent: true, opacity, clearcoat: 1, side: THREE.DoubleSide });
const plastic = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6 });
const metal = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.9 });

/** 몸통 + 두 소매 + 두 바짓가랑이 한 벌 */
function suit(bones, attach, material, { sleeves = true, legs = true, t = 0.022, flare = 1 } = {}) {
  attach(bones.hips, torso(material, { t }));
  if (sleeves) for (const arm of [bones.armL, bones.armR]) attach(arm, sleeve(material, { flare }));
  if (legs) for (const leg of [bones.legL, bones.legR]) attach(leg, trouser(material));
}
/** 둥근 단추 한 줄 (몸통 정면) */
function buttons(attach, hips, material, vs, { size = 0.018, t = 0.022 } = {}) {
  for (const v of vs) {
    const b = mesh(new THREE.SphereGeometry(size, 14, 10), material, onTorso(0, v, t, 0.004));
    b.scale.z = 0.5;
    attach(hips, b);
  }
}
/** 꼬리 (엉덩이 뼈 뒤): 가운데 선을 따라 굵기가 줄어드는 원뿔 */
function tail(attach, hips, material, { length = 0.2, radius = 0.07, lift = 0.1 } = {}) {
  const geometry = new THREE.ConeGeometry(radius, length, 20, 6);
  geometry.rotateX(-Math.PI / 2 - 0.5);
  const at = onTorso(Math.PI, -0.55, 0.022);
  const cone = mesh(geometry, material, [at[0], at[1] + lift * 0.1, at[2] - length * 0.35]);
  attach(hips, cone);
}

// ── 옷 목록 (칸/id) ───────────────────────────────────
export const ITEMS = {
  // 모자 ------------------------------------------------
  "hat/crown": {
    build({ head }, attach) {
      const gold = metal("#e8b53a");
      const band = new THREE.CylinderGeometry(0.11, 0.1, 0.07, 32, 1, true);
      const crown = new THREE.Group();
      const sided = gold.clone();
      sided.side = THREE.DoubleSide;
      crown.add(new THREE.Mesh(band, sided));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = mesh(new THREE.ConeGeometry(0.03, 0.07, 12), gold, [Math.sin(a) * 0.1, 0.065, Math.cos(a) * 0.1]);
        crown.add(spike);
        crown.add(mesh(new THREE.SphereGeometry(0.014, 12, 8), gold, [Math.sin(a) * 0.1, 0.105, Math.cos(a) * 0.1]));
        const gem = mesh(new THREE.SphereGeometry(0.015, 12, 8), gloss(i % 2 ? "#2f7de0" : "#e0303f"), [Math.sin(a + 0.63) * 0.108, 0.0, Math.cos(a + 0.63) * 0.108]);
        crown.add(gem);
      }
      crown.add(mesh(new THREE.SphereGeometry(0.095, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), felt("#c8243a"), [0, 0.02, 0]));
      crown.position.set(0, TOP - 0.005, -0.02);
      crown.rotation.x = -0.12;
      attach(head, crown);
    },
  },
  "hat/straw": {
    hides: ["ear"],
    build({ head }, attach) {
      const straw = felt("#e3c27a", { sheen: 0.4, shine: "#fff0c4", bumps: 0.9 });
      const hat = new THREE.Group();
      const brim = mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.018, 48), straw, [0, 0, 0]);
      hat.add(brim);
      hat.add(mesh(blobGeometry([0.2, 0.15, 0.2], { e: 0.9 }), straw, [0, 0.03, 0]));
      const ribbon = new THREE.CylinderGeometry(0.205, 0.205, 0.04, 40, 1, true);
      const band = felt("#8a4a2a", { sheen: 0.3 });
      band.side = THREE.DoubleSide;
      hat.add(mesh(ribbon, band, [0, 0.035, 0]));
      hat.position.set(0, TOP - 0.035, -0.02);
      hat.rotation.x = -0.18;
      attach(head, hat);
    },
  },
  "hat/yuzu-towel": {
    build({ head }, attach) {
      const towel = felt("#fbf6ec", { sheen: 1, shine: "#ffffff", bumps: 0.8 });
      const g = new THREE.Group();
      // 개어 얹은 수건 (둥근 네모 두 겹)
      g.add(mesh(blobGeometry([0.15, 0.03, 0.11], { e: 0.55 }), towel, [0, 0, 0]));
      g.add(mesh(blobGeometry([0.13, 0.025, 0.1], { e: 0.55 }), towel, [0.01, 0.04, 0.005], [0, 0.15, 0]));
      g.add(stroke([[-0.13, 0.02, 0.09], [0.13, 0.02, 0.09]], 0.004, flat("#7bb3d9")));
      // 유자 한 알 + 잎
      g.add(mesh(new THREE.SphereGeometry(0.06, 24, 16), felt("#ffc01e", { sheen: 0.6, shine: "#fff1a6", bumps: 0.6 }), [0.0, 0.115, 0.0]));
      const leaf = mesh(blobGeometry([0.035, 0.008, 0.018]), felt("#4f9a3a"), [0.035, 0.17, -0.005], [0, 0.4, 0.6]);
      g.add(leaf);
      g.position.set(0, TOP, -0.02);
      g.rotation.x = -0.15;
      attach(head, g);
    },
  },

  // 안경 ------------------------------------------------
  "glasses/wood": {
    build({ head }, attach) {
      spectacles(attach, head, { frame: felt("#8b5a2b", { sheen: 0.2, bumps: 0.2 }), lens: glass("#e9f6ff", 0.25), shape: circle, size: 0.05 });
    },
  },
  "glasses/sunglasses": {
    build({ head }, attach) {
      spectacles(attach, head, { frame: plastic("#161616"), lens: glass("#1b1b22", 0.92), shape: roundRect, size: 0.052 });
    },
  },
  "glasses/heart": {
    build({ head }, attach) {
      spectacles(attach, head, { frame: plastic("#ff5c9a"), lens: glass("#ff9cc2", 0.55), shape: heart, size: 0.05 });
    },
  },
  "glasses/star": {
    build({ head }, attach) {
      spectacles(attach, head, { frame: plastic("#ffc928"), lens: glass("#2a2320", 0.9), shape: star, size: 0.05 });
    },
  },
  "glasses/rainbow": {
    build({ head }, attach) {
      const frame = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6, vertexColors: false, color: "#ff7ab8" });
      spectacles(attach, head, { frame, lens: glass("#b3e9ff", 0.45), shape: circle, size: 0.055 });
      // 무지개 테: 렌즈 둘레에 색 고리 여러 겹
      const colors = ["#ff4d4d", "#ffa53a", "#ffe14d", "#57d163", "#4aa8ff", "#9a6bff"];
      for (const side of [-1, 1]) {
        const [x, y, z] = onHead(side * EYE.x, EYE.y, 0.05);
        colors.forEach((c, i) => {
          const ring = mesh(new THREE.TorusGeometry(0.058 + i * 0.006, 0.0035, 8, 40), plastic(c), [x, y, z]);
          ring.rotation.y = side * Math.atan2(x, z) * 0.6;
          attach(head, ring);
        });
      }
    },
  },
  "glasses/goggles": {
    build({ head }, attach) {
      spectacles(attach, head, {
        frame: plastic("#2bb673"),
        lens: glass("#5fd4ff", 0.6),
        shape: (r) => new THREE.Shape().absellipse(0, 0, r * 1.15, r * 0.95, 0, Math.PI * 2),
        size: 0.058,
        band: felt("#2bb673", { sheen: 0.3 }),
      });
      // 뒤통수를 두르는 끈
      const back = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI;
        back.push([Math.cos(a) * (BODY.head.r[0] + 0.012), EYE.y + 0.04, -Math.sin(a) * (BODY.head.r[2] + 0.012)]);
      }
      attach(head, stroke(back.map(([x, y, z]) => [x * 0.98, y, z]), 0.013, felt("#2bb673", { sheen: 0.3 })));
    },
  },

  // 한벌옷 ----------------------------------------------
  "onepiece/overalls": {
    build(bones, attach) {
      const denim = felt("#3f6fb5", { sheen: 0.5, shine: "#a8c6f0", bumps: 0.7 });
      const shirt = felt("#f6efe2", { sheen: 0.8 });
      // 흰 티셔츠 위에 멜빵바지: 아래 몸통 + 가슴받이 + 멜빵
      attach(bones.hips, torso(shirt, { t: 0.018 }));
      for (const arm of [bones.armL, bones.armR]) attach(arm, mesh(blobGeometry(pad(BODY.arm.r, 0.015), { bottom: 1.1, to: 0 }), shirt, [0, -0.055, 0]));
      attach(bones.hips, torso(denim, { t: 0.03, top: 0.15 }));
      const bib = mesh(blobGeometry([0.12, 0.09, 0.03], { e: 0.6 }), denim, onTorso(0, 0.35, 0.03, 0.004));
      bib.lookAt(new THREE.Vector3(...onTorso(0, 0.35, 0.3)));
      attach(bones.hips, bib);
      for (const side of [-1, 1]) {
        const strap = [onTorso(side * 0.35, 0.5, 0.03, 0.006), onTorso(side * 0.5, 0.85, 0.03, 0.01), onTorso(side * 2.6, 0.8, 0.03, 0.01), onTorso(side * 2.9, 0.2, 0.03, 0.006)];
        attach(bones.hips, stroke(strap, 0.014, denim));
        attach(bones.hips, mesh(new THREE.SphereGeometry(0.014, 12, 8), metal("#e8c24a"), onTorso(side * 0.34, 0.5, 0.03, 0.02)));
      }
      const pocket = mesh(blobGeometry([0.05, 0.035, 0.01], { e: 0.6 }), felt("#355f9e", { sheen: 0.4 }), onTorso(0, 0.3, 0.03, 0.022));
      attach(bones.hips, pocket);
      for (const leg of [bones.legL, bones.legR]) attach(leg, trouser(denim, { t: 0.02 }));
    },
  },
  "onepiece/yukata": {
    build(bones, attach) {
      const navy = felt("#2c3f7a", { sheen: 0.6, shine: "#8ea5e6" });
      suit(bones, attach, navy, { legs: true, flare: 1.35 });
      // 허리띠(오비)
      attach(bones.hips, torso(felt("#7fb0e0", { sheen: 0.5 }), { t: 0.032, top: 0.05, bottom: -0.2 }));
      // 여밈 깃 (V자)
      for (const side of [-1, 1]) {
        attach(bones.hips, stroke([onTorso(side * 0.55, 0.95, 0.022, 0.006), onTorso(side * 0.15, 0.45, 0.022, 0.008), onTorso(0, 0.1, 0.022, 0.008)], 0.012, felt("#f3ead8")));
      }
      // 온천 무늬 (흰 물결 점)
      dots(attach, bones.hips, flat("#e9eefc"), { count: 16, size: 0.014, from: -0.8, to: 0.8, shape: [1.4, 0.5, 0.4], seed: 3 });
    },
  },
  "onepiece/strawberry": {
    build(bones, attach) {
      const red = felt("#e5323b", { sheen: 0.8, shine: "#ff9b8f" });
      suit(bones, attach, red, { legs: false });
      dots(attach, bones.hips, felt("#ffe26a", { sheen: 0.4 }), { count: 22, size: 0.011, from: -0.85, to: 0.7, shape: [0.7, 1, 0.5], seed: 11 });
      // 목둘레 초록 꼭지잎
      const leaf = felt("#3f9a3a", { sheen: 0.5 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const at = onTorso(a, 0.86, 0.03, 0.01);
        const petal = mesh(blobGeometry([0.045, 0.012, 0.075]), leaf, at);
        petal.rotation.set(0.45, a, 0, "YXZ");
        attach(bones.hips, petal);
      }
    },
  },
  "onepiece/raincoat": {
    hides: ["ear"],
    build(bones, attach) {
      const yellow = felt("#ffcf33", { sheen: 0.9, shine: "#fff3b0" });
      suit(bones, attach, yellow, { legs: true, t: 0.026 });
      hood(attach, bones.head, yellow);
      // 개구리 눈 (후드 위)
      for (const side of [-1, 1]) {
        attach(bones.head, mesh(new THREE.SphereGeometry(0.06, 24, 16), felt("#7cc24a", { sheen: 0.6 }), [side * 0.13, TOP - 0.01, 0.06]));
        attach(bones.head, mesh(new THREE.SphereGeometry(0.035, 20, 12), felt("#ffffff"), [side * 0.13, TOP, 0.105]));
        attach(bones.head, mesh(new THREE.SphereGeometry(0.02, 14, 10), gloss("#141010"), [side * 0.13, TOP, 0.132]));
      }
      buttons(attach, bones.hips, felt("#6aa83e", { sheen: 0.4 }), [0.55, 0.2, -0.15], { size: 0.02 });
    },
  },
  "onepiece/dino": {
    hides: ["ear"],
    build(bones, attach) {
      const green = felt("#4cae4f", { sheen: 0.8, shine: "#c5f0a8" });
      suit(bones, attach, green, { t: 0.026 });
      hood(attach, bones.head, green);
      // 배: 연두색 배판
      attach(bones.hips, torso(felt("#c8e67a", { sheen: 0.6 }), { t: 0.031, top: 0.45, bottom: -0.8, arc: 0.75 }));
      // 등 가시: 머리 꼭대기부터 꼬리까지
      const spike = felt("#f2d23a", { sheen: 0.5 });
      for (const [bone, pts] of [
        [bones.head, [[0, TOP + 0.035, 0.05], [0, TOP + 0.025, -0.1], [0, TOP - 0.06, -0.24]]],
        [bones.hips, [onTorso(Math.PI, 0.65, 0.026), onTorso(Math.PI, 0.25, 0.026), onTorso(Math.PI, -0.15, 0.026)]],
      ]) {
        for (const at of pts) {
          const cone = mesh(new THREE.ConeGeometry(0.035, 0.07, 14), spike, at);
          const out = new THREE.Vector3(...at).normalize();
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out.lengthSq() ? out : new THREE.Vector3(0, 1, 0));
          attach(bone, cone);
        }
      }
      tail(attach, bones.hips, green, { length: 0.22, radius: 0.075 });
    },
  },
  "onepiece/shark": {
    hides: ["ear"],
    build(bones, attach) {
      const grey = felt("#8fa3b8", { sheen: 0.8, shine: "#e2ecf7" });
      suit(bones, attach, grey, { t: 0.026 });
      const around = hood(attach, bones.head, grey);
      // 흰 배 + 후드 구멍 둘레 이빨
      attach(bones.hips, torso(felt("#f5f7fa"), { t: 0.031, top: 0.5, bottom: -0.85, arc: 0.8 }));
      const tooth = felt("#ffffff", { sheen: 0.4 });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const at = around(a, 0.01);
        const cone = mesh(new THREE.ConeGeometry(0.014, 0.035, 10), tooth, at);
        // 구멍 가운데를 향해
        const center = new THREE.Vector3(0, -0.12 * BODY.head.r[1], at[2]);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), center.sub(new THREE.Vector3(...at)).normalize());
        attach(bones.head, cone);
      }
      // 등지느러미 (머리 위) + 꼬리지느러미
      const fin = mesh(new THREE.ConeGeometry(0.06, 0.14, 3), grey, [0, TOP + 0.07, -0.06]);
      fin.scale.z = 0.35;
      fin.rotation.x = -0.35;
      attach(bones.head, fin);
      tail(attach, bones.hips, grey, { length: 0.2, radius: 0.07 });
      const flukes = mesh(blobGeometry([0.1, 0.03, 0.05]), grey, onTorso(Math.PI, -0.8, 0.026, 0.2));
      flukes.rotation.x = 0.4;
      attach(bones.hips, flukes);
    },
  },
};

/**
 * 카피바라의 뼈에 옷을 전부 붙여 두고(숨김) 옷 id → 붙인 부품 목록을 돌려준다.
 * item.build(bones, attach)에서 attach(뼈, 메시)로 붙인다
 */
export function dress(capybara) {
  const worn = {};
  for (const [id, item] of Object.entries(ITEMS)) {
    const parts = [];
    item.build(capybara.bones, (bone, object) => {
      object.visible = false;
      object.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      bone.add(object);
      parts.push(object);
      return object;
    });
    worn[id] = parts;
  }
  return worn;
}
