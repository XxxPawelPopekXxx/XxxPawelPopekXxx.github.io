// --- KONFIGURACJA I INICJALIZACJA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); // Niebo - lekko szare dla kontrastu

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- OŚWIETLENIE ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true; // Włączamy cienie
scene.add(directionalLight);

// --- GENEROWANIE TEKSTUR ---
function createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333333'; // Ciemny szary asfalt
    ctx.fillRect(0, 0, 256, 256);
    // Dodajemy trochę "szumu" dla realizmu
    ctx.fillStyle = '#444444';
    for (let i = 0; i < 1000; i++) {
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    return texture;
}

const asphaltTexture = createAsphaltTexture();
const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x2d8e2d }); // Lepsza zieleń
const asphaltMaterial = new THREE.MeshLambertMaterial({ map: asphaltTexture });

// --- TWORZENIE ULEPSZONEJ MAPY (TORU) ---
// 1. Ogromne podłoże (Trawa)
const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
const ground = new THREE.Mesh(groundGeometry, grassMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 2. Tor (Asfalt) - Tworzymy kształt toru (owal)
const trackPath = new THREE.CurvePath();
const trackCurve = new THREE.EllipseCurve(
    0, 0,            // x, y centralne
    150, 80,         // xRadius, yRadius
    0, 2 * Math.PI,  // startAngle, endAngle
    false,            // clockwise
    0                // rotation
);
trackPath.add(trackCurve);

// Generujemy geometrię toru wzdłuż ścieżki
const trackGeometry = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(-10, 0), // Lewa krawędź
    new THREE.Vector2(10, 0),  // Prawa krawędź
]), {
    steps: 100,
    bevelEnabled: false,
    extrudePath: trackCurve
});

const track = new THREE.Mesh(trackGeometry, asphaltMaterial);
track.rotation.x = -Math.PI / 2;
track.position.y = 0.01; // Lekko nad trawą, by uniknąć migotania
scene.add(track);

// --- DEFINICJA SCIEŻKI DLA AI (WAYPOINTS) ---
// AI będzie jechało wzdłuż tego owalu
const points = trackCurve.getPoints(50);
const aiWaypoints = points.map(p => new THREE.Vector3(p.x, 0.5, -p.y)); // Dostosowanie osi

// --- FUNKCJA TWORZENIA ULEPSZONEGO MODELU AUTA ---
function createComplexCar(color, isPlayer = false) {
    const carGroup = new THREE.Group();

    // Nadwozie
    const bodyGeom = new THREE.BoxGeometry(2, 0.6, 4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: color });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.6;
    carGroup.add(body);

    // Kabina
    const cabinGeom = new THREE.BoxGeometry(1.4, 0.5, 2);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Ciemne szyby
    const cabin = new THREE.Mesh(cabinGeom, cabinMat);
    cabin.position.y = 1.15;
    cabin.position.z = -0.3; // Lekko przesunięta do tyłu
    carGroup.add(cabin);

    // Koła (Walce)
    const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Czarne opony
    
    const positions = [
        [-1.1, 0.4, 1.4],  // Przód Lewo
        [1.1, 0.4, 1.4],   // Przód Prawo
        [-1.1, 0.4, -1.4], // Tył Lewo
        [1.1, 0.4, -1.4]   // Tył Prawo
    ];

    positions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeom, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], pos[1], pos[2]);
        carGroup.add(wheel);
    });

    carGroup.castShadow = true;
    return carGroup;
}

// --- TWORZENIE GRACZA I AI ---
// Gracz
const playerCar = createComplexCar(0xff0000, true);
playerCar.position.set(0, 0, 150); // Start na krawędzi owalu
playerCar.rotation.y = Math.PI;    // Skierowany w dobrą stronę
scene.add(playerCar);

// Klasa Samochodu AI
class AICar {
    constructor(color, startingWaypointIndex) {
        this.mesh = createComplexCar(color);
        this.waypointIndex = startingWaypointIndex;
        this.mesh.position.copy(aiWaypoints[this.waypointIndex]);
        this.speed = 0.2 + Math.random() * 0.1; // Losowa prędkość AI
        scene.add(this.mesh);
    }

    update() {
        const target = aiWaypoints[this.waypointIndex];
        const distance = this.mesh.position.distanceTo(target);

        if (distance < 2) {
            // Dotarliśmy do punktu, celujemy w kolejny
            this.waypointIndex = (this.waypointIndex + 1) % aiWaypoints.length;
        } else {
            // Ruch w kierunku punktu
            const direction = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
            
            // Płynny obrót w stronę celu
            const targetRotation = Math.atan2(direction.x, direction.z);
            this.mesh.rotation.y = targetRotation;
            
            // Jazda
            this.mesh.translateZ(this.speed);
        }
    }
}

// Spawnowanie kilku aut AI
const aiCars = [
    new AICar(0x0000ff, 5),   // Niebieski, start w punkcie 5
    new AICar(0x00ff00, 15),  // Zielony, start w punkcie 15
    new AICar(0xffff00, 25),  // Żółty, start w punkcie 25
    new AICar(0xff00ff, 35)   // Fioletowy, start w punkcie 35
];


// --- STEROWANIE GRACZA (Zostało bez zmian) ---
const keys = { w: false, a: false, s: false, d: false };
document.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// --- PĘTLA GRY ---
const playerSpeed = 0.5;
const playerTurnSpeed = 0.03;

function animate() {
    requestAnimationFrame(animate);

    // Fizyka Gracza
    if (keys.w) playerCar.translateZ(playerSpeed);
    if (keys.s) playerCar.translateZ(-playerSpeed);
    if (keys.a) playerCar.rotation.y += playerTurnSpeed;
    if (keys.d) playerCar.rotation.y -= playerTurnSpeed;

    // Aktualizacja AI
    aiCars.forEach(car => car.update());

    // Kamera podążająca za graczem
    const relativeCameraOffset = new THREE.Vector3(0, 5, -12);
    const cameraOffset = relativeCameraOffset.applyMatrix4(playerCar.matrixWorld);
    camera.position.lerp(cameraOffset, 0.1);
    camera.lookAt(playerCar.position);

    renderer.render(scene, camera);
}

animate();
