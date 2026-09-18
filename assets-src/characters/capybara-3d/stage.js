// 찍는 무대: 조명·카메라·렌더러. bake.mjs가 헤드리스 크로미움에서 window.shoot(...)을 부른다
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { FRAMES, VIEW } from "./frames.js";
import { dress, ITEMS } from "./items.js";
import { buildCapybara, pose } from "./rig.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
// 왼쪽 위에서 오는 부드러운 빛 (로비 에셋과 같은 조명 방향) + 뒤에서 털 가장자리를 밝히는 빛
const key = new THREE.DirectionalLight("#fff4e6", 2.1);
key.position.set(-1.2, 2.2, 2);
scene.add(key);
const rim = new THREE.DirectionalLight("#ffe7cc", 0.9);
rim.position.set(0.8, 1.2, -2);
scene.add(rim);
scene.add(new THREE.HemisphereLight("#fff8ee", "#8a6a4a", 0.9));

const capybara = buildCapybara();
const turn = new THREE.Group(); // 방향(몸 전체 y축 회전)
turn.add(capybara.root);
scene.add(turn);
const worn = dress(capybara); // 옷 id → 뼈에 붙인 부품들 (처음엔 모두 숨김)

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
const elevation = THREE.MathUtils.degToRad(VIEW.elevation);
camera.position.set(0, Math.sin(elevation) * 5, Math.cos(elevation) * 5);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
{
  // 바닥 원점이 그림의 발바닥 줄(VIEW.foot)에 오게 화면을 맞춘다
  const half = VIEW.height / 2;
  const origin = new THREE.Vector3(0, 0, 0).applyMatrix4(camera.matrixWorldInverse); // 카메라 공간
  const bottom = origin.y - VIEW.height * (1 - VIEW.foot);
  camera.top = bottom + VIEW.height;
  camera.bottom = bottom;
  camera.left = -half;
  camera.right = half;
  camera.updateProjectionMatrix();
}

const bodyMeshes = [];
capybara.root.traverse((o) => o.isMesh && o.userData.body && bodyMeshes.push(o));
const setBodyColor = (on) => {
  for (const m of bodyMeshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat.colorWrite = on;
  }
};

/**
 * 한 장 찍기. layer가 "body"면 카피바라만, "<칸>/<id>"면 그 옷만 찍되 몸은 깊이만 그려(가림막) 몸 뒤로 돌아간 옷은 지운다.
 * 반환: PNG data URL (투명 배경)
 */
window.shoot = ({ frame, layer, size }) => {
  const spec = FRAMES[frame];
  if (!spec) throw new Error(`frame ${frame}?`);
  renderer.setSize(size, size, false);
  pose(capybara, spec.pose);
  turn.rotation.y = THREE.MathUtils.degToRad(spec.yaw);
  for (const [id, parts] of Object.entries(worn)) for (const part of parts) part.visible = id === layer;
  setBodyColor(layer === "body");
  if (layer !== "body" && !worn[layer]) throw new Error(`item ${layer}?`);
  // 옷이 몸의 일부를 덮어야 하면(후드가 귀를 덮는 등) 그 부위는 가림막에서 뺀다
  const hides = new Set(layer === "body" ? [] : (ITEMS[layer].hides ?? []));
  for (const m of bodyMeshes) m.visible = !hides.has(m.name);
  renderer.render(scene, camera);
  for (const m of bodyMeshes) m.visible = true;
  setBodyColor(true);
  return renderer.domElement.toDataURL("image/png");
};

/** 머리 기준점(이미지 %): 로비가 머리 위에 소품(유자 수건·말풍선)을 얹을 때 쓴다 */
window.anchors = (frame) => {
  const spec = FRAMES[frame];
  pose(capybara, spec.pose);
  turn.rotation.y = THREE.MathUtils.degToRad(spec.yaw);
  scene.updateMatrixWorld(true);
  const toPct = (v) => {
    const p = v.clone().project(camera);
    return [+((p.x * 0.5 + 0.5) * 100).toFixed(2), +((0.5 - p.y * 0.5) * 100).toFixed(2)];
  };
  const head = capybara.bones.head;
  const top = toPct(head.localToWorld(new THREE.Vector3(0, 0.2, 0)));
  const center = toPct(head.localToWorld(new THREE.Vector3(0, 0, 0)));
  return { headTop: top, headCenter: center };
};

window.ready = true;
