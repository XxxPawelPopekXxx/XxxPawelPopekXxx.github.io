// 1. INICJALIZACJA SCENY, KAMERY I RENDERERA
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Niebo

// Kamera podąża za graczem, ustawiamy jej pole widzenia
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. ŚWIATŁO
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Ogólne rozproszone światło
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Światło kierunkowe (Słońce)
directionalLight.position.set(100, 100, 50);
scene.add(directionalLight);

// 3. TWORZENIE TORU / PODŁOŻA
const planeGeometry = new THREE.PlaneGeometry(200, 200);
const planeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Zielona trawa
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Obracamy, żeby leżało płasko
scene.add(plane);

// 4. TWORZENIE SAMOCHODU GRACZA (Czerwony sześcian)
const carGeometry = new THREE.BoxGeometry(2, 1, 4);
const carMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const car = new THREE.Mesh(carGeometry, carMaterial);
car.position.y = 0.5; // Podnosimy nad ziemię, żeby nie "tonął"
scene.add(car);

// 5. OBSŁUGA KLAWIATURY (Klawisze W, A, S, D)
const keys = { w: false, a: false, s: false, d: false };

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// Zmiana rozmiaru okna
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// 6. GŁÓWNA PĘTLA GRY (Fizyka i renderowanie)
const speed = 0.3;      // Prędkość jazdy
const turnSpeed = 0.05; // Prędkość skręcania

function animate() {
    requestAnimationFrame(animate);

    // Ruch do przodu / do tyłu (Z)
    if (keys.w) {
        car.translateZ(-speed);
    }
    if (keys.s) {
        car.translateZ(speed);
    }
    
    // Skręcanie (Y) - działa tylko podczas jazdy
    if (keys.a && (keys.w || keys.s)) {
        car.rotation.y += turnSpeed;
    }
    if (keys.d && (keys.w || keys.s)) {
        car.rotation.y -= turnSpeed;
    }

    // Kamera podążająca za samochodem (za i nad autem)
    const relativeCameraOffset = new THREE.Vector3(0, 4, 10);
    const cameraOffset = relativeCameraOffset.applyMatrix4(car.matrixWorld);
    
    camera.position.lerp(cameraOffset, 0.1); // Płynne podążanie (lerp)
    camera.lookAt(car.position);

    // Rysowanie klatki
    renderer.render(scene, camera);
}

// Uruchomienie pętli
animate();
