class ScoreManager {
  constructor() {
    this.currentScore = 0;
    this.highScore = localStorage.getItem('hefeHighScore') || 0;
    this.scoreDisplay = document.getElementById('currentScore');
    this.highScoreDisplay = document.getElementById('highScore');
    
    this.updateDisplays();
  }

  addPoints(points) {
    this.currentScore += points;
    if (this.currentScore > this.highScore) {
      this.highScore = this.currentScore;
    }
    this.updateDisplays();
  }

  updateDisplays() {
    this.scoreDisplay.textContent = `Score: ${this.currentScore}`;
    this.highScoreDisplay.textContent = `High Score: ${this.highScore}`;
  }

  saveHighScore() {
    localStorage.setItem('hefeHighScore', this.highScore);
    this.updateDisplays();
  }

  reset() {
    this.currentScore = 0;
    this.updateDisplays();
  }
}

// Offline storage handling
let pendingScores = [];
let localHighScores = [];

// Load saved data from localStorage
try {
  const savedPending = localStorage.getItem('pendingScores');
  if (savedPending) {
    pendingScores = JSON.parse(savedPending);
  }
  
  const savedHighScores = localStorage.getItem('localHighScores');
  if (savedHighScores) {
    localHighScores = JSON.parse(savedHighScores);
  }
} catch (e) {
  console.error('Error loading saved data:', e);
}

// Function to update local high scores
function updateLocalHighScores(name, score) {
  localHighScores.push({ name, score });
  localHighScores.sort((a, b) => b.score - a.score);
  localHighScores = localHighScores.slice(0, 10); // Keep top 10
  localStorage.setItem('localHighScores', JSON.stringify(localHighScores));
}

async function submitToLeaderboard(name, score) {
  const submitButton = document.getElementById('submitScore');
  const originalText = submitButton.textContent;
  
  submitButton.textContent = 'Saving...';
  submitButton.disabled = true;

  // Always update local high scores first
  updateLocalHighScores(name, score);
  console.log('Local high scores updated');

  try {
    // Attempt to submit score to Vercel API
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        score,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit score');
    }

    console.log('Score submitted to global leaderboard');
    submitButton.textContent = 'Saved Online!';

    // If successful, try to submit any pending scores
    if (pendingScores.length > 0) {
      console.log('Attempting to submit pending scores...');
      const successfulSubmissions = [];

      for (const pendingScore of pendingScores) {
        try {
          await fetch('/api/scores', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pendingScore),
          });
          successfulSubmissions.push(pendingScore);
        } catch (error) {
          console.error('Failed to submit pending score:', error);
        }
      }

      // Remove successfully submitted scores from pending
      pendingScores = pendingScores.filter(
        score => !successfulSubmissions.includes(score)
      );
      localStorage.setItem('pendingScores', JSON.stringify(pendingScores));
    }
  } catch (error) {
    console.error('Failed to submit score:', error);
    // Store score locally for later submission
    pendingScores.push({ name, score, timestamp: new Date().toISOString() });
    localStorage.setItem('pendingScores', JSON.stringify(pendingScores));
    submitButton.textContent = 'Saved Locally!';
  }

  // Update the leaderboard display
  await updateLeaderboard();
  
  // Reset button state
  setTimeout(() => {
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }, 2000);
}

function showLocalScores(leaderboardDiv) {
  const headerDiv = document.createElement('div');
  headerDiv.className = 'leaderboard-header';
  headerDiv.textContent = 'Local High Scores';
  leaderboardDiv.appendChild(headerDiv);

  if (localHighScores.length > 0) {
    localHighScores.forEach((score, index) => {
      const scoreDiv = document.createElement('div');
      scoreDiv.innerHTML = `
        <span>${index + 1}. ${score.name}</span>
        <span>${score.score}</span>
      `;
      leaderboardDiv.appendChild(scoreDiv);
    });
  } else {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'offline-message';
    messageDiv.textContent = 'No local scores yet!';
    leaderboardDiv.appendChild(messageDiv);
  }
}

async function updateLeaderboard() {
  console.log('Updating leaderboard...');
  const leaderboardDiv = document.getElementById('leaderboardScores');
  if (!leaderboardDiv) {
    console.error('Leaderboard div not found!');
    return;
  }
  leaderboardDiv.innerHTML = '';

  // Always show local scores first
  showLocalScores(leaderboardDiv);

  try {
    // Fetch global scores from Vercel API
    const response = await fetch('/api/scores');
    if (!response.ok) {
      throw new Error('Failed to fetch scores');
    }

    const scores = await response.json();
    
    if (scores.length > 0) {
      // Add a separator between local and online scores
      const separatorDiv = document.createElement('div');
      separatorDiv.className = 'scores-separator';
      separatorDiv.textContent = '🌐 Global Leaderboard 🌐';
      leaderboardDiv.appendChild(separatorDiv);

      scores.forEach((score, index) => {
        const scoreDiv = document.createElement('div');
        scoreDiv.innerHTML = `
          <span>${index + 1}. ${score.name}</span>
          <span>${score.score}</span>
        `;
        leaderboardDiv.appendChild(scoreDiv);
      });
    }
  } catch (error) {
    console.error('Failed to fetch online scores:', error);
    // Don't show any error message since we already show local scores
  }
}

// Initialize leaderboard on page load
updateLeaderboard();

// Setup game over screen handlers
document.addEventListener('DOMContentLoaded', () => {
  console.log('Setting up game over screen handlers...');
  
  const submitButton = document.getElementById('submitScore');
  const restartButton = document.getElementById('restartGame');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const nameInput = document.getElementById('playerName');
  
  if (!submitButton || !restartButton || !gameOverScreen || !nameInput) {
    console.error('Required game over elements not found:', {
      submit: !!submitButton,
      restart: !!restartButton,
      screen: !!gameOverScreen,
      input: !!nameInput
    });
    return;
  }

  submitButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (name) {
      await submitToLeaderboard(name, scoreManager.currentScore);
      nameInput.value = '';
      gameOverScreen.classList.add('hidden');
    }
  });

  restartButton.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    location.reload();
  });
});

// Setup all UI event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Setting up leaderboard controls...');
  
  const showLeaderboardBtn = document.getElementById('showLeaderboard');
  const leaderboardModal = document.getElementById('leaderboardModal');
  const closeButton = document.querySelector('.close-button');
  
  if (!showLeaderboardBtn || !leaderboardModal || !closeButton) {
    console.error('Required leaderboard elements not found:', {
      button: !!showLeaderboardBtn,
      modal: !!leaderboardModal,
      closeBtn: !!closeButton
    });
    return;
  }

  showLeaderboardBtn.addEventListener('click', (e) => {
    console.log('Leaderboard button clicked');
    e.stopPropagation();
    leaderboardModal.classList.remove('hidden');
    updateLeaderboard();
  });

  closeButton.addEventListener('click', () => {
    console.log('Close button clicked');
    leaderboardModal.classList.add('hidden');
  });

  leaderboardModal.addEventListener('click', (e) => {
    if (e.target.id === 'leaderboardModal') {
      console.log('Clicked outside modal');
      leaderboardModal.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !leaderboardModal.classList.contains('hidden')) {
      console.log('Escape pressed, closing modal');
      leaderboardModal.classList.add('hidden');
    }
  });
});
