interface Window {
    scoreManager: ScoreManager;
    lives: number;
    livesDisplay: HTMLElement | null;
    USDC_ABI: string[];
}

interface ScoreManager {
    currentScore: number;
    highScore: number;
    walletConnected: boolean;
    userAddress: string;
    config: {
        chainId: number;
        usdcContract: string;
        merchantWallet: string;
        rpcUrl: string;
    };
    usdcContract: any;
    signer: any;
    initializeWeb3(): Promise<void>;
    updateUSDCBalance(balanceDisplay: HTMLElement): Promise<void>;
    addPoints(points: number): void;
    updateScoreDisplay(): void;
    saveHighScore(): Promise<void>;
    updateLeaderboard(): Promise<void>;
}

interface Player {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    bullets: Bullet[];
    sprite: HTMLImageElement;
    lastShotTime: number;
    shootCooldown: number;
    isSpaceHeld: boolean;
    move(direction: 'left' | 'right'): void;
    canShoot(): boolean;
    shoot(): void;
}

interface Bullet {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
}

interface Enemy {
    x: number;
    y: number;
    width: number;
    height: number;
    type: number;
    alive: boolean;
    pointsMultiplier: number;
}

interface EnemyWave {
    enemies: Enemy[];
    speed: number;
    direction: number;
    yOffset: number;
    waveNumber: number;
    spawnWave(): void;
    move(): void;
}

interface LeaderboardEntry {
    rank: number;
    walletAddress: string;
    score: number;
    lastUpdated: string;
}

interface LeaderboardResponse {
    scores: LeaderboardEntry[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}