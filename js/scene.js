import * as THREE from 'three';

export const canvas = document.getElementById('canvas');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2535);
scene.fog        = new THREE.FogExp2(0x1a2535, 0.012);

export const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 5, -10);
camera.lookAt(0, 0, 0);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
sun.position.set(15, 30, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near   = 0.5;
sun.shadow.camera.far    = 300;
sun.shadow.camera.left   = -80;
sun.shadow.camera.right  = 80;
sun.shadow.camera.top    = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias          = -0.001;
scene.add(sun);

scene.add(new THREE.HemisphereLight(0x4488aa, 0x223322, 0.4));

// Ground plane (visual only — physics ground is in physics.js)
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400, 1, 1),
  new THREE.MeshLambertMaterial({ color: 0x2a3d2a })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const grid = new THREE.GridHelper(400, 80, 0x000000, 0x1e3a1e);
grid.material.opacity     = 0.4;
grid.material.transparent = true;
scene.add(grid);

// Camera follow state
const _camDesired = new THREE.Vector3();
const _camLookAt  = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();

export function updateCamera(carGroup) {
  const offset = new THREE.Vector3(0, 3.5, -8);
  offset.applyQuaternion(carGroup.quaternion);
  _camDesired.copy(carGroup.position).add(offset);
  camera.position.lerp(_camDesired, 0.06);
  _camTarget.set(carGroup.position.x, carGroup.position.y + 0.5, carGroup.position.z);
  _camLookAt.lerp(_camTarget, 0.08);
  camera.lookAt(_camLookAt);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
