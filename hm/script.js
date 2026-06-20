const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// Stan gry
let gameActive = false;
let score = 0;
let level = 1;
let lives = 3;
let keys = {};

// Konfiguracja obiektów
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 60,
    width: 50,
    height: 30,
    speed: 7,
    color: '#00ffcc'
};

let projectiles = [];
let targets = [];
let particles = [];

// Obsługa klawiatury
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Przyciski UI
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

function startGame() {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    resetGameStats();
    gameActive = true;
    animate();
}

function resetGameStats() {
    score = 0;
    level = 1;
    lives = 3;
    projectiles = [];
    targets = [];
    particles = [];
    player.x = canvas.width / 2 - 25;
    updateUI();
}

function updateUI() {
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    document.getElementById('lives').innerText = lives;
}

function spawnTarget() {
    if (Math.random() < 0.03 + (level * 0.005) && targets.length < 10) {
        const size = Math.random() * 20 + 20;
        targets.push({
            x: Math.random() * (canvas.width - size),
            y: -size,
            width: size,
            height: size,
            speed: Math.random() * 2 + 1 + (level * 0.3),
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
        });
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            radius: Math.random() * 3 + 1,
            alpha: 1,
            color: color
        });
    }
}

function handleInput() {
    if (keys['ArrowLeft'] || keys['KeyA']) {
        if (player.x > 0) player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        if (player.x < canvas.width - player.width) player.x += player.speed;
    }
    if (keys['Space']) {
        if (projectiles.length === 0 || projectiles[projectiles.length - 1].y < player.y - 150) {
            projectiles.push({
                x: player.x + player.width / 2 - 3,
                y: player.y,
                width: 6,
                height: 15,
                speed: 9
            });
        }
    }
}

function updateMechanics() {
    // Pociski
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].y -= projectiles[i].speed;
        if (projectiles[i].y < 0) projectiles.splice(i, 1);
    }

    // Cele
    for (let i = targets.length - 1; i >= 0; i--) {
        targets[i].y += targets[i].speed;

        // Kolizja z graczem
        if (checkCollision(targets[i], player)) {
            createParticles(targets[i].x, targets[i].y, '#ff3366');
            targets.splice(i, 1);
            lives--;
            updateUI();
            if (lives <= 0) gameOver();
            continue;
        }

        // Przekroczenie dolnej krawędzi
        if (targets[i].y > canvas.height) {
            targets.splice(i, 1);
            lives--;
            updateUI();
            if (lives <= 0) gameOver();
            continue;
        }

        // Kolizje pocisków z celami
        for (let j = projectiles.length - 1; j >= 0; j--) {
            if (targets[i] && checkCollision(projectiles[j], targets[i])) {
                createParticles(targets[i].x + targets[i].width/2, targets[i].y + targets[i].height/2, targets[i].color);
                targets.splice(i, 1);
                projectiles.splice(j, 1);
                score += 10;
                if (score % 100 === 0) {
                    level++;
                }
                updateUI();
                break;
            }
        }
    }

    // Cząsteczki
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].alpha -= 0.02;
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gracz
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Pociski
    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    projectiles.forEach(p => ctx.fillRect(p.x, p.y, p.width, p.height));

    // Cele
    targets.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.fillRect(t.x, t.y, t.width, t.height);
    });

    // Cząsteczki
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    
    ctx.shadowBlur = 0; // Reset cieni
}

function gameOver() {
    gameActive = false;
    document.getElementById('final-score').innerText = score;
    document.getElementById('gameover-overlay').classList.remove('hidden');
}

function animate() {
    if (!gameActive) return;
    handleInput();
    spawnTarget();
    updateMechanics();
    draw();
    requestAnimationFrame(animate);
}
