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

// Firebase Leaderboard Integration
const firebaseConfig = {
  apiKey: "AIzaSyC9B_gA2K29bXbc4yKDolyCKFEft6eQss8",
  authDomain: "hefe-s.firebaseapp.com",
  projectId: "hefe-s",
  storageBucket: "hefe-s.appspot.com",
  messagingSenderId: "203193310179",
  appId: "1:203193310179:web:bb1afaa4860100edd09ed6",
  measurementId: "G-M1DMQCZBSH"
};

// Initialize Firebase with error handling
let db;
let isOnline = false;  // Start offline by default

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('Firebase initialized');
} catch (error) {
    console.error('Firebase initialization failed:', error);
    console.log('Operating in offline mode only');
}
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
  
  // Only attempt Firebase submission if we have a valid connection
  if (db && isOnline) {
    try {
      await db.collection('scores').add({
        name: name,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      submitButton.textContent = 'Saved Online!';
    } catch (error) {
      console.log('Firebase submission failed, operating in local mode');
      isOnline = false;
    }
  } else {
    submitButton.textContent = 'Saved Locally!';
  }

  // Update the leaderboard display
  updateLeaderboard();
  
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

  // Only attempt to fetch online scores if we have a valid connection
  if (db && isOnline) {
    try {
      const snapshot = await db.collection('scores')
        .orderBy('score', 'desc')
        .limit(10)
        .get();

      if (!snapshot.empty) {
        // Add a separator between local and online scores
        const separatorDiv = document.createElement('div');
        separatorDiv.className = 'scores-separator';
        separatorDiv.textContent = '🌐 Global Leaderboard 🌐';
        leaderboardDiv.appendChild(separatorDiv);

        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          const scoreDiv = document.createElement('div');
          scoreDiv.innerHTML = `
            <span>${index + 1}. ${data.name}</span>
            <span>${data.score}</span>
          `;
          leaderboardDiv.appendChild(scoreDiv);
        });
      }
    } catch (error) {
      console.log('Failed to fetch online scores, showing local only');
      isOnline = false;
    }
  }
}

// Initialize leaderboard on page load
updateLeaderboard();

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
