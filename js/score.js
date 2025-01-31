/** @implements {ScoreManager} */
class ScoreManager {
    constructor() {
        /** @type {number} */
        this.currentScore = 0;
        /** @type {number} */
        this.highScore = parseInt(localStorage.getItem('highScore') || '0');
        /** @type {boolean} */
        this.walletConnected = false;
        /** @type {string} */
        this.userAddress = '';
        /** @type {any} */
        this.usdcContract = null;
        /** @type {any} */
        this.signer = null;
        
        this.updateScoreDisplay();
        
        // Configuration
        /** @type {{chainId: number, usdcContract: string, merchantWallet: string, rpcUrl: string}} */
        this.config = {
            chainId: 43114, // Avalanche C-Chain
            usdcContract: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
            merchantWallet: "0x18cd0B25309Df2e9c207f4417C5eaa7A7eaA19B8",
            rpcUrl: "https://api.avax.network/ext/bc/C/rpc"
        };
        
        this.initializeWeb3();
    }

    /** @returns {Promise<void>} */
    async initializeWeb3() {
        try {
            // Initialize database first
            try {
                const response = await fetch('/api/init-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) {
                    console.warn('Database initialization warning:', await response.text());
                }
            } catch (dbError) {
                console.warn('Database initialization warning:', dbError);
            }

            // Setup UI elements
            const connectWalletBtn = document.getElementById('connectWallet');
            const walletAddress = document.getElementById('walletAddress');
            const startButton = document.getElementById('startButton');
            const balanceDisplay = document.getElementById('usdcBalance');
            const buyLivesBtn = document.getElementById('buyLives');
            const transactionStatus = document.getElementById('transactionStatus');
            
            if (!connectWalletBtn || !walletAddress || !startButton || !balanceDisplay) {
                console.error('Required UI elements not found');
                return;
            }

            // Handle Web3 provider initialization
            if (typeof window.ethereum !== 'undefined') {
                // Just disable auto refresh, don't modify the provider
                window.ethereum.autoRefreshOnNetworkChange = false;
            } else {
                console.error('No Web3 provider found. Please install MetaMask or Core Wallet');
                alert('Please install MetaMask or Core Wallet to connect');
                return;
            }

            // Setup wallet connection
            connectWalletBtn.addEventListener('click', async () => {
                try {
                    connectWalletBtn.disabled = true;
                    connectWalletBtn.textContent = 'Connecting...';
                    
                    // Check if Core Wallet or MetaMask is installed
                    if (!window.ethereum) {
                        throw new Error('Please install Core Wallet or MetaMask');
                    }

                    // Request account access
                    const accounts = await window.ethereum.request({ 
                        method: 'eth_requestAccounts' 
                    });

                    if (!accounts || accounts.length === 0) {
                        throw new Error('No accounts found');
                    }

                    // Switch to Avalanche network
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: `0x${this.config.chainId.toString(16)}` }],
                        });
                    } catch (switchError) {
                        // Add the network if it doesn't exist
                        if (switchError.code === 4902) {
                            try {
                                await window.ethereum.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: `0x${this.config.chainId.toString(16)}`,
                                        chainName: 'Avalanche C-Chain',
                                        nativeCurrency: {
                                            name: 'AVAX',
                                            symbol: 'AVAX',
                                            decimals: 18
                                        },
                                        rpcUrls: [this.config.rpcUrl],
                                        blockExplorerUrls: ['https://snowtrace.io/']
                                    }]
                                });
                            } catch (addError) {
                                throw new Error('Failed to add Avalanche network: ' + addError.message);
                            }
                        } else {
                            throw new Error('Failed to switch to Avalanche network: ' + switchError.message);
                        }
                    }

                    const address = accounts[0];
                    
                    // Initialize provider and contract
                    const provider = new ethers.providers.Web3Provider(window.ethereum);
                    await provider.ready; // Ensure provider is ready
                    
                    const signer = provider.getSigner();
                    this.usdcContract = new ethers.Contract(
                        this.config.usdcContract,
                        window.USDC_ABI,
                        signer
                    );

                    this.walletConnected = true;
                    this.userAddress = address;
                    this.signer = signer;
                    
                    // Update UI
                    walletAddress.textContent = `${address.slice(0,6)}...${address.slice(-4)}`;
                    walletAddress.style.display = 'block';
                    connectWalletBtn.style.display = 'none';
                    startButton.classList.remove('hidden');
                    if (buyLivesBtn) buyLivesBtn.disabled = false;
                    
                    // Get and display USDC balance
                    await this.updateUSDCBalance(balanceDisplay);
                    
                    // Initialize with 1 life
                    window.lives = 1;
                    localStorage.setItem('currentLives', window.lives);
                    if (window.livesDisplay) {
                        window.livesDisplay.textContent = window.lives;
                    }
                    
                    console.log('Wallet connected successfully:', address);
                    
                } catch (error) {
                    console.error('Wallet connection failed:', error);
                    alert(error.message || 'Failed to connect wallet. Please try again.');
                } finally {
                    connectWalletBtn.disabled = false;
                    connectWalletBtn.textContent = 'Connect Wallet';
                }
            });

            // Setup buy lives button
            if (buyLivesBtn) {
                buyLivesBtn.addEventListener('click', async () => {
                    if (!this.walletConnected || !this.usdcContract) {
                        alert('Please connect your wallet first');
                        return;
                    }
                    
                    buyLivesBtn.disabled = true;
                    buyLivesBtn.textContent = 'Processing...';
                    if (transactionStatus) {
                        transactionStatus.textContent = 'Transaction pending...';
                        transactionStatus.className = 'transaction-status pending';
                    }
                    
                    try {
                        const price = ethers.utils.parseUnits("0.25", 6); // USDC has 6 decimals
                        
                        // Check USDC balance
                        const balance = await this.usdcContract.balanceOf(this.userAddress);
                        if (balance.lt(price)) {
                            throw new Error('Insufficient USDC balance');
                        }
                        
                        // Send transaction
                        const tx = await this.usdcContract.transfer(this.config.merchantWallet, price);
                        if (transactionStatus) {
                            transactionStatus.textContent = 'Confirming transaction...';
                        }
                        
                        await tx.wait();
                        
                        // Update lives and UI
                        const currentLives = parseInt(localStorage.getItem('currentLives')) || 0;
                        const newLives = currentLives + 5;
                        window.lives = newLives;
                        localStorage.setItem('currentLives', newLives);
                        if (window.livesDisplay) {
                            window.livesDisplay.textContent = newLives;
                        }

                        // Hide game over screen if visible
                        const gameOverScreen = document.getElementById('gameOverScreen');
                        if (gameOverScreen) {
                            gameOverScreen.classList.add('hidden');
                        }
                        
                        if (transactionStatus) {
                            transactionStatus.textContent = 'Purchase successful!';
                            transactionStatus.className = 'transaction-status success';
                        }
                        
                        // Update USDC balance
                        await this.updateUSDCBalance(balanceDisplay);
                        
                    } catch (error) {
                        console.error('Purchase failed:', error);
                        if (transactionStatus) {
                            transactionStatus.textContent = `Error: ${error.message}`;
                            transactionStatus.className = 'transaction-status error';
                        }
                    } finally {
                        buyLivesBtn.textContent = 'Buy 5 Lives (0.25 USDC)';
                        buyLivesBtn.disabled = false;
                    }
                });
            }
            
        } catch (error) {
            console.error('Web3 initialization failed:', error);
        }
    }

    /**
     * @param {HTMLElement} balanceDisplay
     * @returns {Promise<void>}
     */
    async updateUSDCBalance(balanceDisplay) {
        try {
            if (!this.usdcContract || !this.userAddress) {
                balanceDisplay.textContent = '0.00';
                return;
            }
            
            const balance = await this.usdcContract.balanceOf(this.userAddress);
            const formattedBalance = ethers.utils.formatUnits(balance, 6); // USDC has 6 decimals
            balanceDisplay.textContent = parseFloat(formattedBalance).toFixed(2);
        } catch (error) {
            console.error('Failed to update USDC balance:', error);
            balanceDisplay.textContent = 'Error';
        }
    }

    /**
     * @param {number} points
     * @returns {void}
     */
    addPoints(points) {
        this.currentScore += points;
        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            localStorage.setItem('highScore', this.highScore);
        }
        this.updateScoreDisplay();
    }

    /** @returns {void} */
    updateScoreDisplay() {
        const currentScoreEl = document.getElementById('currentScore');
        const highScoreEl = document.getElementById('highScore');
        
        if (currentScoreEl && highScoreEl) {
            currentScoreEl.textContent = this.currentScore;
            highScoreEl.textContent = this.highScore;
        }
    }

    /** @returns {Promise<void>} */
    async saveHighScore() {
        if (!this.walletConnected) {
            console.log('Wallet not connected, score will not be saved on-chain');
            return;
        }
        
        try {
            console.log('Attempting to save score for wallet:', this.userAddress);
            
            const response = await fetch("/api/scores", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    walletAddress: this.userAddress,
                    score: this.currentScore
                })
            });

            const responseText = await response.text();
            console.log('Raw response:', responseText);

            if (!response.ok) {
                throw new Error(`Score submission failed: ${responseText}`);
            }
            
            const result = JSON.parse(responseText);
            console.log('Score saved:', result);
            
            // Update leaderboard
            await this.updateLeaderboard();
            
        } catch (error) {
            console.error('Failed to save score:', error);
            alert('Failed to save score. Please try again.');
        }
    }

    /** @returns {Promise<void>} */
    async updateLeaderboard() {
        try {
            console.log('Fetching leaderboard data...');
            const response = await fetch("/api/leaderboard");
            const responseText = await response.text();
            console.log('Raw leaderboard response:', responseText);

            if (!response.ok) {
                throw new Error(`Failed to fetch leaderboard: ${responseText}`);
            }
            
            const data = JSON.parse(responseText);
            const leaderboardEl = document.getElementById('leaderboardScores');
            
            if (!data.scores || !Array.isArray(data.scores)) {
                throw new Error('Invalid leaderboard data format');
            }

            // Update prize pool information
            if (data.prizePool) {
                document.getElementById('totalPrizePool').textContent = parseFloat(data.prizePool.totalPrizePool).toFixed(2);
                document.getElementById('firstPlacePrize').textContent = data.prizePool.distribution.firstPlace;
                document.getElementById('secondPlacePrize').textContent = data.prizePool.distribution.secondPlace;
                document.getElementById('thirdPlacePrize').textContent = data.prizePool.distribution.thirdPlace;
            }
            
            if (leaderboardEl) {
                if (data.scores.length === 0) {
                    leaderboardEl.innerHTML = '<div class="no-scores">No scores yet. Be the first to play!</div>';
                    return;
                }

                // Get top 10 scores
                const topScores = data.scores.slice(0, 10);
                
                // Medal emojis for top 3
                const medals = ['🥇', '🥈', '🥉'];
                
                leaderboardEl.innerHTML = topScores.map((score, index) => {
                    const rankDisplay = index < 3 ? medals[index] : `#${index + 1}`;
                    const addressDisplay = score.walletAddress;
                    const scoreValue = typeof score.score === 'number' ? score.score.toLocaleString() : '0';
                    const prizeAmount = score.prizeAmount ? ` (${score.prizeAmount} USDC)` : '';
                    
                    return `
                        <div class="leaderboard-entry ${index < 3 ? 'top-three' : ''}">
                            <span class="rank">${rankDisplay}</span>
                            <span class="address">${addressDisplay}</span>
                            <span class="score">${scoreValue}${prizeAmount}</span>
                        </div>
                    `;
                }).join('');
            }
            
        } catch (error) {
            console.error('Failed to update leaderboard:', error);
            const leaderboardEl = document.getElementById('leaderboardScores');
            if (leaderboardEl) {
                leaderboardEl.innerHTML = `
                    <div class="error-message">
                        Failed to load leaderboard<br>
                        <small>${error.message}</small>
                    </div>
                `;
            }
        }
    }
}
