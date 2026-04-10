// BEZPOŚREDNIE IMPORTY - To zadziała w 100% przeglądarek bez dodatków w HTML
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/GLTFLoader.js';

// --- 1. INTERFEJS (PRĘDKOŚCIOMIERZ) ---
const speedoDiv = document.createElement('div');
speedoDiv.style.position = 'absolute';
speedoDiv.style.bottom = '20px';
speedoDiv.style.right = '20px';
speedoDiv.style.color = '#00ff00';
speedoDiv.style.fontFamily = 'monospace';
speedoDiv.style.fontSize = '40px';
speedoDiv.style.fontWeight = 'bold';
speedoDiv.style.background = 'rgba(0,0,0,0.7)';
speedoDiv.style.padding = '10px 20px';
speedoDiv.style.borderRadius = '10px';
speedoDiv.innerHTML = '0 <span style="font-size: 20px">KM/H</span>';
document.body.appendChild(speedoDiv);

// --- 2. SCENA I KAMERA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Błękitne niebo
scene.fog = new THREE.FogExp2(0x87ceeb, 0.001); // Daleka mgła

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 5, -15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- 3. KAMERA MYSZKĄ (ORBIT CONTROLS) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02; 
controls.minDistance = 6;  
controls.maxDistance = 30;

// --- 4. ŚWIATŁA ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(500, 1000, 500);
sun.castShadow = true;
sun.shadow.camera.left = -500;
sun.shadow.camera.right = 500;
sun.shadow.camera.top = 500;
sun.shadow.camera.bottom = -500;
sun.shadow.camera.far = 3000;
scene.add(sun);

// --- 5. NAPRAWIONA MAPA I MIASTO ---
const groundGeo = new THREE.PlaneGeometry(4000, 4000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(4000, 200, 0x000000, 0x555555);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
const citySize = 50; 
const buildingMesh = new THREE.InstancedMesh(buildingGeo, buildingMat, citySize * citySize);
buildingMesh.castShadow = true;
buildingMesh.receiveShadow = true;

const dummy = new THREE.Object3D();
let bIndex = 0;
for (let x = -citySize / 2; x < citySize / 2; x++) {
    for (let z = -citySize / 2; z < citySize / 2; z++) {
        if (x % 5 === 0 || z % 5 === 0) continue; 
        if (Math.abs(x) < 8 && Math.abs(z) < 8) continue; 

        const height = 15 + Math.random() * 60; 
        dummy.position.set(x * 20, height / 2, z * 20);
        dummy.scale.set(12, height, 12);
        dummy.updateMatrix();
        
        const bColor = new THREE.Color().setHSL(Math.random() * 0.1, 0.1, 0.3 + Math.random() * 0.5);
        buildingMesh.setColorAt(bIndex, bColor);
        buildingMesh.setMatrixAt(bIndex, dummy.matrix);
        bIndex++;
    }
}
buildingMesh.count = bIndex;
scene.add(buildingMesh);

// --- 6. MODEL AUTA (Kuloodporne ładowanie) ---
const playerCar = new THREE.Group();
scene.add(playerCar);

const fallbackGeo = new THREE.BoxGeometry(2, 1, 4);
const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const fallbackCar = new THREE.Mesh(fallbackGeo, fallbackMat);
fallbackCar.position.y = 0.5;
playerCar.add(fallbackCar);

const loader = new GLTFLoader();
loader.load('auto.glb', (gltf) => {
    playerCar.remove(fallbackCar); 
    const realCarModel = gltf.scene;
    
    const box = new THREE.Box3().setFromObject(realCarModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    realCarModel.scale.set(scale, scale, scale);
    
    const newBox = new THREE.Box3().setFromObject(realCarModel);
    newBox.getCenter(realCarModel.position).multiplyScalar(-1);
    
    realCarModel.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
                node.material.side = THREE.DoubleSide;
                node.material.depthWrite = true;
                if (node.material.transparent && node.material.opacity > 0.9) {
                    node.material.transparent = false; 
                }
            }
        }
    });
    
    const finalBox = new THREE.Box3().setFromObject(realCarModel);
    realCarModel.position.y -= finalBox.min.y; 
    
    playerCar.add(realCarModel);
}, undefined, (err) => console.error("Błąd modelu: ", err));

// --- 7. STEROWANIE ---
const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// --- 8. ZAAWANSOWANA FIZYKA JAZDY ---
const clock = new THREE.Clock(); 
let speedKmh = 0; 

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta(); 
    let acceleration = 0;
    
    if (keys.w) {
        if (speedKmh >= 0) {
            if (speedKmh < 100) acceleration = 100 / 5;
            else if (speedKmh < 200) acceleration = 100 / 13;
            else if (speedKmh < 250) acceleration = 50 / 30;
            else acceleration = 0;
        } else {
            acceleration = 60;
        }
    } else if (keys.s) {
        if (speedKmh > 0) {
            acceleration = -80; 
        } else {
            acceleration = -15; 
            if (speedKmh < -40) acceleration = 0; 
        }
    } else {
        if (speedKmh > 0) {
            acceleration = -5;
            if (speedKmh + acceleration * delta < 0) speedKmh = 0;
        } else if (speedKmh < 0) {
            acceleration = 5;
            if (speedKmh + acceleration * delta > 0) speedKmh = 0;
        }
    }

    speedKmh += acceleration * delta;

    if (Math.abs(speedKmh) > 1) { 
        const turnSpeed = 1.5 * delta; 
        const turnDir = speedKmh > 0 ? 1 : -1; 
        
        if (keys.a) playerCar.rotation.y += turnSpeed * turnDir;
        if (keys.d) playerCar.rotation.y -= turnSpeed * turnDir;
    }

    const speedMs = speedKmh / 3.6; 
    playerCar.translateZ(speedMs * delta); 

    speedoDiv.innerHTML = `${Math.abs(Math.round(speedKmh))} <span style="font-size: 20px">KM/H</span>`;

    controls.target.copy(playerCar.position);
    controls.update();

    renderer.render(scene, camera);
}

animate();
