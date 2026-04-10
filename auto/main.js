import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
scene.background = new THREE.Color(0x87ceeb); // Niebo
scene.fog = new THREE.FogExp2(0x87ceeb, 0.001); // Daleka mgła

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 6, -12); // Ustalona pozycja kamery

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- 3. KAMERA MYSZKĄ (ORBIT CONTROLS) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02; // Nie pozwalamy wejść pod ziemię
controls.minDistance = 6;  // Ochrona przed wpadnięciem do kabiny
controls.maxDistance = 12; // Zablokowanie zbytniego oddalania
controls.enableZoom = false; // Stały dystans kamery

// --- 4. ŚWIATŁA ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(500, 1000, 500);
sun.castShadow = true;
sun.shadow.camera.left = -1000;
sun.shadow.camera.right = 1000;
sun.shadow.camera.top = 1000;
sun.shadow.camera.bottom = -1000;
sun.shadow.camera.far = 4000;
scene.add(sun);

// --- 5. MAPA (AUTOBAHN) I MIASTO ---
const groundGeo = new THREE.PlaneGeometry(10000, 10000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(10000, 400, 0x000000, 0x444444);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Pasy autostrady
function createLanes() {
    const laneGroup = new THREE.Group();
    const laneGeo = new THREE.PlaneGeometry(0.3, 2);
    const laneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    
    for (let i = -1.5; i <= 1.5; i++) {
        if (i === -1.5 || i === 1.5) {
            const solidLineGeo = new THREE.PlaneGeometry(0.1, 10000);
            const solidLine = new THREE.Mesh(solidLineGeo, laneMat);
            solidLine.rotation.x = -Math.PI / 2;
            solidLine.position.set(i * 4, 0.02, 0);
            laneGroup.add(solidLine);
        } else {
            for (let z = -5000; z < 5000; z += 10) {
                const brokenLine = new THREE.Mesh(laneGeo, laneMat);
                brokenLine.rotation.x = -Math.PI / 2;
                brokenLine.position.set(i * 4, 0.02, z);
                laneGroup.add(brokenLine);
            }
        }
    }
    scene.add(laneGroup);
}
createLanes();

// Budynki
const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5 });
const citySize = 70; 
const buildingMesh = new THREE.InstancedMesh(buildingGeo, buildingMat, citySize * citySize * 2);
buildingMesh.castShadow = true;
buildingMesh.receiveShadow = true;

const dummy = new THREE.Object3D();
let bIndex = 0;
for (let x = -citySize / 2; x < citySize / 2; x++) {
    for (let z = -citySize / 2; z < citySize / 2; z++) {
        if (Math.abs(x) < 25 && Math.abs(z) < 15) continue; 
        if (x % 5 === 0 || z % 5 === 0) continue; 

        const height = 10 + Math.random() * 80; 
        
        // Lewa strona
        dummy.position.set((x - 25) * 20, height / 2, z * 20);
        dummy.scale.set(12, height, 12);
        dummy.updateMatrix();
        let bColor = new THREE.Color().setHSL(Math.random() * 0.1, 0.1, 0.2 + Math.random() * 0.4);
        buildingMesh.setColorAt(bIndex, bColor);
        buildingMesh.setMatrixAt(bIndex, dummy.matrix);
        bIndex++;

        // Prawa strona
        dummy.position.set((x + 25) * 20, height / 2, z * 20);
        dummy.scale.set(12, height, 12);
        dummy.updateMatrix();
        bColor = new THREE.Color().setHSL(Math.random() * 0.1, 0.1, 0.2 + Math.random() * 0.4);
        buildingMesh.setColorAt(bIndex, bColor);
        buildingMesh.setMatrixAt(bIndex, dummy.matrix);
        bIndex++;
    }
}
buildingMesh.count = bIndex;
scene.add(buildingMesh);

// --- 6. MODEL AUTA ---
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
        const baseTurnSpeed = 1.0;
        const currentTurnSpeed = baseTurnSpeed / (1 + Math.abs(speedKmh) / 30);
        const turnDir = speedKmh > 0 ? 1 : -1; 
        
        if (keys.a) playerCar.rotation.y += currentTurnSpeed * turnDir * delta;
        if (keys.d) playerCar.rotation.y -= currentTurnSpeed * turnDir * delta;
    }

    const speedMs = speedKmh / 3.6; 
    playerCar.translateZ(speedMs * delta); 

    speedoDiv.innerHTML = `${Math.abs(Math.round(speedKmh))} <span style="font-size: 20px">KM/H</span>`;

    controls.target.copy(playerCar.position);
    controls.update();

    renderer.render(scene, camera);
}

animate();
