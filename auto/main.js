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

// Ładowanie PRAWDZIWEGO modelu (wersja z automatycznym skalowaniem)
const loader = new GLTFLoader();
loader.load('auto.glb', (gltf) => {
    // Usuwamy czerwony sześcian
    playerCar.remove(fallbackCar);
    
    const realCarModel = gltf.scene;
    
    // 1. Sprawdzamy oryginalny rozmiar tego "potwora"
    const box = new THREE.Box3().setFromObject(realCarModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // 2. Chcemy, żeby auto miało równe 4 jednostki długości (zazwyczaj oś Z)
    // Jeśli twórca obrócił auto bokiem, możemy użyć największego wymiaru:
    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetSize = 4; // Nasza docelowa wielkość
    const scaleRatio = targetSize / maxDimension;
    
    // 3. Aplikujemy wyliczoną skalę!
    realCarModel.scale.set(scaleRatio, scaleRatio, scaleRatio);
    
    // 4. Centrujemy przeskalowany model (żeby nie kręcił się wokół złej osi)
    const newBox = new THREE.Box3().setFromObject(realCarModel);
    newBox.getCenter(realCarModel.position).multiplyScalar(-1);
    
    // 5. Podnosimy go lekko, żeby koła nie wpadły pod asfalt
    const newSize = new THREE.Vector3();
    newBox.getSize(newSize);
    realCarModel.position.y += newSize.y / 2;
    
    // Włączamy cienie i NAPRAWIAMY MATERIAŁY
    realCarModel.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            
            // Jeśli obiekt ma materiał, wymuszamy poprawne rysowanie
            if (node.material) {
                node.material.side = THREE.DoubleSide; // Rysuj obiekt z zewnątrz i od wewnątrz
                node.material.depthWrite = true;       // Naprawia błędy z dziwnym przenikaniem warstw
                
                // Czasami modele mają włączoną przezroczystość na 100% dla blachy, wyłączamy to:
                if (node.material.transparent && node.material.opacity === 1) {
                    node.material.transparent = false;
                }
            }
        }
    });
    
    playerCar.add(realCarModel);
    console.log("Realistyczny model załadowany i idealnie dopasowany!");
    
}, undefined, (error) => {
    console.error("Wystąpił błąd podczas ładowania modelu: ", error);
});
