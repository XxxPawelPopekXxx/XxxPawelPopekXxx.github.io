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
const skyColor = 0x87ceeb;
scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.Fog(skyColor, 50, 400); 

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
// POPRAWKA: Kamera ustawiona wyżej i odrobinę dalej
camera.position.set(0, 4, -8); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- 3. KAMERA MYSZKĄ ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
// POPRAWKA: Blokada przed zejściem za nisko (kamera nie dotknie asfaltu)
controls.maxPolarAngle = Math.PI / 2 - 0.15; 
controls.minDistance = 4.0; // Więcej przestrzeni
controls.maxDistance = 10.0;
controls.enableZoom = false; 

// --- 4. ŚWIATŁA ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(100, 200, 50);
sun.castShadow = true;
sun.shadow.camera.left = -200;
sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200;
sun.shadow.camera.bottom = -200;
sun.shadow.camera.far = 1000;
scene.add(sun);

// --- 5. PRAWDZIWY AUTOBAHN (BEZ MIGOTANIA) ---
const roadLength = 20000; 

// POPRAWKA: Tylko JEDNA podłoga (Trawa), żeby uniknąć migotania Z-fighting
const grassGeo = new THREE.PlaneGeometry(10000, roadLength);
const grassMat = new THREE.MeshLambertMaterial({ color: 0x2e5c1e }); 
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.rotation.x = -Math.PI / 2;
grass.position.y = 0; // Trawa jest na samym dole
grass.receiveShadow = true;
scene.add(grass);

// Asfalt (wyraźnie ponad trawą, żeby z nią nie walczył o piksele)
const roadWidth = 24; 
const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
const roadMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); 
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.05; // 5 centymetrów nad trawą
road.receiveShadow = true;
scene.add(road);

// Bariery energochłonne (Środek i Boki)
const barrierMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 });
const barrierGeo = new THREE.BoxGeometry(0.6, 1.2, roadLength);

const midBarrier = new THREE.Mesh(barrierGeo, barrierMat);
midBarrier.position.set(0, 0.6, 0);
midBarrier.castShadow = true;
scene.add(midBarrier);

const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
leftBarrier.position.set(-roadWidth/2 - 0.5, 0.6, 0);
leftBarrier.castShadow = true;
scene.add(leftBarrier);

const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
rightBarrier.position.set(roadWidth/2 + 0.5, 0.6, 0);
rightBarrier.castShadow = true;
scene.add(rightBarrier);

// Pasy ruchu (Linie na asfalcie)
const laneGroup = new THREE.Group();
const lineGeo = new THREE.PlaneGeometry(0.2, 3);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

const lanePositions = [-8, -4, 4, 8]; 
for (let x of lanePositions) {
    for (let z = -roadLength/2; z < roadLength/2; z += 8) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.07, z); // Wyraźnie nad asfaltem
        laneGroup.add(line);
    }
}
scene.add(laneGroup);

// Lasy po bokach 
const treeCount = 2000;
const treeGroup = new THREE.Group();

const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 2);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
const leavesGeo = new THREE.ConeGeometry(1.5, 4, 8);
const leavesMat = new THREE.MeshLambertMaterial({ color: 0x1e4d2b });

for (let i = 0; i < treeCount; i++) {
    const tree = new THREE.Group();
    
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 3;
    leaves.castShadow = true;
    
    tree.add(trunk);
    tree.add(leaves);
    
    let rx = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 80);
    let rz = (Math.random() - 0.5) * roadLength;
    
    tree.position.set(rx, 0, rz);
    
    if(Math.abs(rz) < 2000) {
        treeGroup.add(tree);
    }
}
scene.add(treeGroup);

// --- 6. MODEL AUTA ---
const playerCar = new THREE.Group();
scene.add(playerCar);

const fallbackGeo = new THREE.BoxGeometry(1.8, 0.8, 4);
const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const fallbackCar = new THREE.Mesh(fallbackGeo, fallbackMat);
fallbackCar.position.y = 0.4;
fallbackCar.castShadow = true;
playerCar.add(fallbackCar);

playerCar.position.set(-6, 0, 0); 

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
}, undefined, (err) => console.log("Czekam na Twój plik auto.glb... Używam auta zastępczego."));

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

    // POPRAWKA KAMERY: Kamera patrzy 1.5 metra NAD autem (na dach), a nie na koła!
    controls.target.copy(playerCar.position);
    controls.target.y += 1.5; 
    controls.update();

    if (playerCar.position.z > 5000 || playerCar.position.z < -5000) {
        playerCar.position.z = 0;
    }

    renderer.render(scene, camera);
}

animate();
