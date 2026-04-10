import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- INICJALIZACJA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Niebo
scene.fog = new THREE.FogExp2(0x87ceeb, 0.002); // Mgła, żeby ukryć kraniec mapy

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
// Ustawienie kamery lekko z tyłu i góry
camera.position.set(0, 5, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Włączamy cienie
document.body.appendChild(renderer.domElement);

// --- STEROWANIE KAMERĄ MYSZKĄ ---
// OrbitControls pozwala na idealne obracanie kamery wokół zadanego punktu (naszego auta)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Płynne ruchy myszką
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Blokada, żeby nie zejść kamerą pod ziemię
controls.minDistance = 5; // Minimalne przybliżenie (zoom)
controls.maxDistance = 20; // Maksymalne oddalenie

// --- OŚWIETLENIE ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(200, 500, 200);
sun.castShadow = true;
sun.shadow.camera.left = -500;
sun.shadow.camera.right = 500;
sun.shadow.camera.top = 500;
sun.shadow.camera.bottom = -500;
scene.add(sun);

// --- GENERATOR MIASTA ---
// Asfalt (Ziemia)
const groundGeo = new THREE.PlaneGeometry(2000, 2000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Budynki
const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
// "InstancedMesh" to specjalna technika do rysowania tysięcy obiektów bez zacinania gry
const citySize = 40; // Ilość budynków w rzędzie/kolumnie (40x40 = 1600 budynków)
const buildingMesh = new THREE.InstancedMesh(buildingGeo, new THREE.MeshStandardMaterial({ color: 0x888888 }), citySize * citySize);
buildingMesh.castShadow = true;
buildingMesh.receiveShadow = true;

const dummy = new THREE.Object3D();
let buildingIndex = 0;

for (let x = -citySize / 2; x < citySize / 2; x++) {
    for (let z = -citySize / 2; z < citySize / 2; z++) {
        // Zostawiamy miejsce na szerokie drogi (jeśli x lub z jest podzielne przez 4, robimy pustą drogę)
        if (x % 4 === 0 || z % 4 === 0) continue; 
        
        // Wycinamy środek na plac startowy
        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

        const height = 10 + Math.random() * 40; // Losowa wysokość od 10 do 50
        dummy.position.set(x * 15, height / 2, z * 15);
        dummy.scale.set(10, height, 10);
        dummy.updateMatrix();
        
        // Ustawiamy losowy kolor dla budynku
        const bColor = new THREE.Color().setHSL(Math.random() * 0.1, 0.2, 0.4 + Math.random() * 0.4);
        buildingMesh.setColorAt(buildingIndex, bColor);
        buildingMesh.setMatrixAt(buildingIndex, dummy.matrix);
        
        buildingIndex++;
    }
}
buildingMesh.count = buildingIndex;
scene.add(buildingMesh);

// --- SAMOCHÓD GRACZA (MODEL GLTF LUB ZASTĘPCZY) ---
const playerCar = new THREE.Group();
scene.add(playerCar);

// Tworzymy prosty model zastępczy (zniknie, gdy załaduje się prawdziwy model 3D)
const fallbackGeo = new THREE.BoxGeometry(2, 1, 4);
const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const fallbackCar = new THREE.Mesh(fallbackGeo, fallbackMat);
fallbackCar.position.y = 0.5;
fallbackCar.castShadow = true;
playerCar.add(fallbackCar);

// Ładowanie PRAWDZIWEGO modelu (wymaga pliku auto.glb na GitHubie)
const loader = new GLTFLoader();
loader.load('auto.glb', (gltf) => {
    // Kiedy model się wczyta, usuwamy czerwony sześcian
    playerCar.remove(fallbackCar);
    
    const realCarModel = gltf.scene;
    // Skalujemy model, bo często z internetu są gigantyczne
    realCarModel.scale.set(100, 100, 100); 
    
    // Włączamy cienie dla załadowanego modelu
    realCarModel.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });
    
    playerCar.add(realCarModel);
    console.log("Realistyczny model załadowany!");
}, undefined, (error) => {
    console.log("Brak pliku auto.glb, użyto modelu zastępczego.");
});

// --- STEROWANIE ---
const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// --- PĘTLA GRY ---
let speed = 0;
const maxSpeed = 1.0;
const acceleration = 0.02;
const braking = 0.05;
const friction = 0.01;
const turnSpeed = 0.04;

function animate() {
    requestAnimationFrame(animate);

    // 1. Fizyka i ruch samochodu (WASD)
    if (keys.w) { speed += acceleration; }
    else if (keys.s) { speed -= braking; }
    else {
        // Tarcie (auto zwalnia jak puścisz gaz)
        if (speed > 0) speed -= friction;
        if (speed < 0) speed += friction;
        if (Math.abs(speed) < friction) speed = 0;
    }
    
    // Ograniczenie prędkości
    speed = Math.max(Math.min(speed, maxSpeed), -maxSpeed / 2);

    // Skręcanie działa tylko, gdy auto się porusza
    if (speed !== 0) {
        // Zmiana kierunku skręcania podczas jazdy do tyłu
        const turnDir = speed > 0 ? 1 : -1;
        if (keys.a) playerCar.rotation.y += turnSpeed * turnDir;
        if (keys.d) playerCar.rotation.y -= turnSpeed * turnDir;
    }

    // Ruch do przodu/tyłu
    playerCar.translateZ(speed);

    // 2. Aktualizacja kamery (Myszka)
    // Ustawiamy środek obrotu kamery na pozycję naszego samochodu
    controls.target.copy(playerCar.position);
    controls.update(); // Wymagane dla płynnego ruchu (damping)

    renderer.render(scene, camera);
}

animate();
