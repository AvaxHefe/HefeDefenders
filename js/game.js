/** @type {Player} */
class Player {
    constructor() {
        /** @type {number} */
        this.x = 400;
        /** @type {number} */
        this.y = 550;
        /** @type {number} */
        this.width = 80;
        /** @type {number} */
        this.height = 60;
        /** @type {number} */
        this.speed = 7;
        /** @type {Bullet[]} */
        this.bullets = [];
        /** @type {HTMLImageElement} */
        this.sprite = new Image();
        this.sprite.src = 'assets/sprites/hefeship.png';
        /** @type {number} */
        this.lastShotTime = 0;
        /** @type {number} */
        this.shootCooldown = 200; // 200ms cooldown
        /** @type {boolean} */
        this.isSpaceHeld = false;
    }

    move(direction) {
        if (direction === 'left' && this.x > 0) this.x -= this.speed;
        if (direction === 'right' && this.x < 760) this.x += this.speed;
    }

    canShoot() {
        const now = Date.now();
        // If space is being held, apply cooldown
        if (this.isSpaceHeld) {
            return now - this.lastShotTime >= this.shootCooldown;
        }
        // If space was just pressed (not held), allow immediate shot
        return true;
    }

    shoot() {
        if (!this.canShoot()) return;
        
        this.bullets.push({
            x: this.x + this.width/2 - 2,
            y: this.y,
            width: 4,
            height: 10,
            speed: -8
        });
        
        this.lastShotTime = Date.now();
        laserSound.currentTime = 0;
        laserSound.play().catch(console.error);
    }
}

/** @type {EnemyWave} */
class EnemyWave {
    /**
     * @param {number} [waveNumber=1]
     */
    constructor(waveNumber = 1) {
        /** @type {Enemy[]} */
        this.enemies = [];
        /** @type {number} */
        this.speed = 2;
        /** @type {number} */
        this.direction = 1;
        /** @type {number} */
        this.yOffset = 0;
        /** @type {number} */
        this.waveNumber = waveNumber;
    }

    spawnWave() {
        const extraRows = Math.min(Math.floor((this.waveNumber - 1) / 5), 2);
        const rows = Math.min(3 + extraRows, 5);
        const cols = 12 + Math.min(this.waveNumber - 1, 4);
        const spacing = Math.max(40, 50 - (this.waveNumber * 2));
        this.speed = 2 + Math.min(this.waveNumber * 0.5, 4);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                this.enemies.push({
                    x: col * spacing + 30,
                    y: row * spacing + 100 + this.yOffset,
                    width: 30,
                    height: 25,
                    type: Math.floor(Math.random() * 4) + 1,
                    alive: true,
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

// Game state
/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;
/** @type {Player | null} */
let player = null;
/** @type {EnemyWave | null} */
let currentWave = null;
/** @type {boolean} */
let gameActive = false;
/** @type {HTMLElement | null} */
let waveDisplay = null;
/** @type {{[key: string]: boolean}} */
let keys = {
    ArrowLeft: false,
    ArrowRight: false,
    KeyA: false,
    KeyD: false,
    Space: false
};

// Audio setup
const bgMusic = new Audio('assets/sounds/backgroundmusic.mp3');
const laserSound = new Audio('assets/sounds/Lazer sound 1.wav');
laserSound.volume = 0.15;
bgMusic.loop = true;
bgMusic.volume = 0.5;

// Initialize game systems
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing game...');
        
        // Initialize canvas
        canvas = document.getElementById('gameCanvas');
        if (!canvas) throw new Error('Canvas element not found');
        
        ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        
        console.log('Canvas initialized');
        
        // Initialize score manager
        window.scoreManager = new ScoreManager();
        console.log('Score manager initialized');
        
        // Initialize UI elements
        window.livesDisplay = document.getElementById('livesCount');
        if (!window.livesDisplay) throw new Error('Lives display element not found');

        waveDisplay = document.getElementById('waveNumber');
        if (!waveDisplay) throw new Error('Wave display element not found');

        // Initialize start button
        const startButton = document.getElementById('startButton');
        if (!startButton) throw new Error('Start button not found');
        
        startButton.addEventListener('click', () => {
            if (!window.scoreManager.walletConnected) {
                alert('Please connect your wallet to start the game');
                return;
            }
            
            const currentLives = parseInt(localStorage.getItem('currentLives')) || 0;
            if (currentLives <= 0) {
                alert('You need to buy more lives to play! Click the "Buy 5 Lives" button to continue playing.');
                return;
            }
            
            startGame();
        });
        
        // Initialize restart button
        const restartButton = document.getElementById('restartGame');
        if (restartButton) {
            restartButton.addEventListener('click', () => {
                const currentLives = parseInt(localStorage.getItem('currentLives')) || 0;
                if (currentLives <= 0) {
                    alert('You need to buy more lives to play! Click the "Buy 5 Lives" button to continue playing.');
                    return;
                }
                document.getElementById('gameOverScreen').classList.add('hidden');
                startGame();
            });
        }

        // Initialize leaderboard button
        const leaderboardBtn = document.getElementById('showLeaderboard');
        const leaderboardModal = document.getElementById('leaderboardModal');
        const closeBtn = document.querySelector('.close-button');
        
        if (leaderboardBtn && leaderboardModal && closeBtn) {
            leaderboardBtn.addEventListener('click', () => {
                leaderboardModal.classList.remove('hidden');
                window.scoreManager.updateLeaderboard();
            });
            
            closeBtn.addEventListener('click', () => {
                leaderboardModal.classList.add('hidden');
            });
        }

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
    currentWave.spawnWave();
    
    // Get stored lives or use default
    const storedLives = localStorage.getItem('currentLives');
    window.lives = storedLives ? parseInt(storedLives) : 1;
    window.livesDisplay.textContent = window.lives;
    waveDisplay.textContent = '1';
    gameActive = true;
    
    // Reset score
    if (window.scoreManager) {
        window.scoreManager.currentScore = 0;
        window.scoreManager.updateScoreDisplay();
    }
    
    // Start background music
    bgMusic.play().catch(console.error);
    
    // Start game loop
    gameLoop();
    
    // Initialize keyboard controls
    initializeControls();
}

function initializeControls() {
    document.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        
        switch(e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys[e.code] = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                keys[e.code] = true;
                break;
            case 'Space':
                if (!keys.Space) { // Only shoot on initial press
                    player.shoot();
                }
                keys.Space = true;
                player.isSpaceHeld = true;
                break;
            case 'KeyM':
                bgMusic.muted = !bgMusic.muted;
                laserSound.muted = !laserSound.muted;
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'ArrowLeft':
            case 'KeyA':
            case 'ArrowRight':
            case 'KeyD':
                keys[e.code] = false;
                break;
            case 'Space':
                keys.Space = false;
                player.isSpaceHeld = false;
                break;
        }
    });
}

function gameLoop() {
    if (!gameActive) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Handle player movement
    if (keys.ArrowLeft || keys.KeyA) player.move('left');
    if (keys.ArrowRight || keys.KeyD) player.move('right');
    if (keys.Space && player.isSpaceHeld) player.shoot();

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
                window.scoreManager.addPoints(points);
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
        currentWave.spawnWave();
    }

    // Check if enemies reached bottom
    currentWave.enemies.forEach((enemy, index) => {
        if (enemy.alive && enemy.y + enemy.height >= canvas.height - 100) {
            window.lives = Math.max(0, window.lives - 1); // Prevent negative lives
            window.livesDisplay.textContent = window.lives;
            localStorage.setItem('currentLives', window.lives);
            enemy.alive = false;
            currentWave.enemies.splice(index, 1);
            
            if (window.lives <= 0) {
                gameActive = false;
                if (window.scoreManager) {
                    window.scoreManager.saveHighScore();
                }
                const gameOverScreen = document.getElementById('gameOverScreen');
                const finalScoreSpan = document.getElementById('finalScore');
                if (finalScoreSpan) {
                    finalScoreSpan.textContent = window.scoreManager.currentScore;
                }
                gameOverScreen.classList.remove('hidden');
            }
        }
    });

    requestAnimationFrame(gameLoop);
}