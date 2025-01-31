// Simple script to initialize the database
async function initDB() {
  try {
    const response = await fetch('/api/init-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to initialize database');
    }

    const result = await response.json();
    console.log('Database initialized:', result);
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Run initialization
initDB();