class Player {
    constructor() {
        this.x = 400;
        this.y = 550;
        this.width = 80;
        this.height = 60;
        this.speed = 7;
        this.bullets = [];
        this.sprite = new Image();
        this.sprite.src = 'assets/sprites/hefeship.png';
    }

    move(direction) {
        if (direction === 'left' && this.x > 0) this.x -= this.speed;
        if (direction === 'right' && this.x < 760) this.x += this.speed;
    }

    shoot() {
        this.bullets.push({
            x: this.x + this.width/2 - 2,
            y: this.y,
            width: 4,
            height: 10,
            speed: -8
        });
    }
}

class EnemyWave {
    constructor(waveNumber = 1) {
        this.enemies = [];
        this.speed = 2;
        this.direction = 1;
        this.yOffset = 0;
        this.waveNumber = waveNumber;
    }

    spawnWave() {
        // Calculate rows (start with 3, max 5)
        const extraRows = Math.min(Math.floor((this.waveNumber - 1) / 5), 2); // Max 2 extra rows
        const rows = Math.min(3 + extraRows, 5); // Ensure total rows never exceeds 5
        const cols = 12 + Math.min(this.waveNumber - 1, 4);
        
        // Decrease spacing as waves progress to fit more enemies
        const spacing = Math.max(40, 50 - (this.waveNumber * 2));
        
        // Increase speed with each wave
        this.speed = 2 + Math.min(this.waveNumber * 0.5, 4);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                this.enemies.push({
                    x: col * spacing + 30,
                    y: row * spacing + 100 + this.yOffset, // Moved down by 50px
                    width: 30,
                    height: 25,
                    type: Math.floor(Math.random() * 4) + 1,
                    alive: true,
                    // Add points multiplier based on wave
                    pointsMultiplier: 1 + (this.waveNumber * 0.5)
                });
            }
        }
    }

    move() {
        let edgeReached = false;
        this.enemies.forEach(enemy => {
            enemy.x += this.speed * this.direction;
            if (enemy.x <= 0 || enemy.x >= 770) edgeReached = true;
        });

        if (edgeReached) {
            this.direction *= -1;
            this.yOffset += 20;
            this.enemies.forEach(enemy => enemy.y += 20);
        }
    }
}

// Game variables
let canvas, ctx, scoreManager, player, currentWave;
let gameActive = false;
let lives = 5;
let livesDisplay, waveDisplay;
let keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// Initialize game systems
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing game...');
        canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        
        ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }
        
        console.log('Canvas initialized');
        
        scoreManager = new ScoreManager();
        console.log('Score manager initialized');
        
        livesDisplay = document.getElementById('livesCount');
        if (!livesDisplay) {
            throw new Error('Lives display element not found');
        }

        waveDisplay = document.getElementById('waveNumber');
        if (!waveDisplay) {
            throw new Error('Wave display element not found');
        }

        // Initialize start button
        const startButton = document.getElementById('startButton');
        if (!startButton) {
            throw new Error('Start button not found');
        }

        startButton.addEventListener('click', startGame);
        console.log('Game elements initialized');
        
    } catch (error) {
        console.error('Game initialization error:', error);
    }
});

function startGame() {
    // Hide start screen
    document.getElementById('startScreen').classList.add('hidden');
    
    // Initialize game objects
    player = new Player();
    currentWave = new EnemyWave(1);
    currentWave.spawnWave(); // Spawn initial wave
    lives = 5;
    livesDisplay.textContent = lives;
    waveDisplay.textContent = '1';
    gameActive = true;
    
    // Log initial wave info
    console.log('Starting Wave 1. Rows: 3');
    
    // Start background music
    bgMusic.play().catch(console.error);
    
    // Start game loop
    gameLoop();
    
    // Initialize keyboard controls
    initializeControls();
}

// Audio elements
const bgMusic = new Audio('assets/sounds/backgroundmusic.mp3');
const laserSound = new Audio('assets/sounds/Lazer sound 1.wav');
laserSound.volume = 0.25;  // Set laser sound to 25%
bgMusic.loop = true;
bgMusic.volume = 0.5;

function initializeControls() {
    document.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            keys[e.key] = true;
        }
        if (e.key === ' ') {
            player.shoot();
            laserSound.currentTime = 0;
            laserSound.play().catch(console.error);
        }
        if (e.key.toLowerCase() === 'm') {
            bgMusic.muted = !bgMusic.muted;
            laserSound.muted = !laserSound.muted;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            keys[e.key] = false;
        }
    });
}

function gameLoop() {
    if (!gameActive) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Handle player movement
    if (keys.ArrowLeft) player.move('left');
    if (keys.ArrowRight) player.move('right');

    // Draw player
    if (player.sprite.complete) {
        ctx.drawImage(player.sprite, player.x, player.y, player.width, player.height);
    }

    // Update and draw bullets
    player.bullets.forEach((bullet, index) => {
        bullet.y += bullet.speed;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        
        // Remove off-screen bullets
        if (bullet.y < -10) player.bullets.splice(index, 1);
    });

    // Update enemies and check collisions
    currentWave.move();
    currentWave.enemies.forEach((enemy, enemyIndex) => {
        if (!enemy.alive) return;
        
        // Check bullet collisions
        player.bullets.forEach((bullet, bulletIndex) => {
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                
                enemy.alive = false;
                player.bullets.splice(bulletIndex, 1);
                const points = Math.floor(enemy.type * 100 * enemy.pointsMultiplier);
                scoreManager.addPoints(points);
            }
        });

        // Draw enemy if still alive
        if (enemy.alive) {
            const sprite = new Image();
            sprite.src = `assets/sprites/alien${enemy.type}.png`;
            if (sprite.complete) {
                ctx.drawImage(sprite, enemy.x, enemy.y, enemy.width, enemy.height);
            }
        } else {
            currentWave.enemies.splice(enemyIndex, 1);
        }
    });

    // Spawn new wave if all enemies defeated
    if (currentWave.enemies.length === 0) {
        const nextWaveNumber = currentWave.waveNumber + 1;
        waveDisplay.textContent = nextWaveNumber;
        currentWave = new EnemyWave(nextWaveNumber);
        currentWave.spawnWave(); // Respawn with new wave number
        
        // Log wave info for debugging
        const extraRows = Math.min(Math.floor((nextWaveNumber - 1) / 5), 2);
        const totalRows = Math.min(3 + extraRows, 5);
        console.log(`Wave ${nextWaveNumber} started. Rows: ${totalRows} (max 5), Extra rows: ${extraRows}`);
    }

    // Check if enemies reached bottom
    currentWave.enemies.forEach((enemy, index) => {
        if (enemy.alive && enemy.y + enemy.height >= canvas.height - 100) { // Adjusted to match new spawn height
            lives--;
            livesDisplay.textContent = lives;
            enemy.alive = false;
            currentWave.enemies.splice(index, 1);
            if (lives <= 0) {
                gameActive = false;
                scoreManager.saveHighScore();
                const gameOverScreen = document.getElementById('gameOverScreen');
                const finalScoreSpan = document.getElementById('finalScore');
                finalScoreSpan.textContent = scoreManager.currentScore;
                gameOverScreen.classList.remove('hidden');
            }
        }
    });

    // Debug info
    console.log(`Active enemies: ${currentWave.enemies.length}`);

    requestAnimationFrame(gameLoop);
}