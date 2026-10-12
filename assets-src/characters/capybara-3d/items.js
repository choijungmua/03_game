import * as THREE from "three";

import { blobGeometry, BODY, EYE, felt, flat, gloss, mesh, onHead, stroke } from "./rig.js";

/** 머리 꼭대기 높이 (머리 가운데 기준) */
const TOP = BODY.head.r[1];

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
