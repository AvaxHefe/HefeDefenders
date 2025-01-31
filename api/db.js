import { sql } from '@vercel/postgres';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await sql`SELECT NOW()`;
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}

async function initializeDatabase() {
  try {
    // Test connection first
    await testConnection();

    console.log('Checking if leaderboard table exists...');
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'leaderboard'
      );
    `;

    if (!tableExists.rows[0].exists) {
      console.log('Creating leaderboard table...');
      await sql`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          score INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_wallet UNIQUE (wallet_address),
          CONSTRAINT score_positive CHECK (score >= 0),
          CONSTRAINT valid_wallet CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard(score DESC)`;
      console.log('Leaderboard table created successfully');
    } else {
      console.log('Leaderboard table already exists');
    }

    return true;
  } catch (error) {
    console.error('Database initialization error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}

async function getLeaderboard(page = 1, limit = 10) {
  try {
    // Test connection first
    await testConnection();

    const offset = (page - 1) * limit;

    const countResult = await sql`SELECT COUNT(*) as total FROM leaderboard`;
    const total = parseInt(countResult.rows[0].total);

    const { rows } = await sql`
      SELECT
        wallet_address,
        nickname,
        score,
        last_updated,
        RANK() OVER (ORDER BY score DESC) as rank
      FROM leaderboard
      ORDER BY score DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      scores: rows,
      total,
      page,
      limit
    };
  } catch (error) {
    console.error('Get leaderboard error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}

async function saveScore(walletAddress, score) {
  try {
    // Test connection first
    await testConnection();

    const result = await sql`
      INSERT INTO leaderboard (wallet_address, score, last_updated)
      VALUES (${walletAddress}, ${score}, NOW())
      ON CONFLICT (wallet_address) 
      DO UPDATE SET 
        score = GREATEST(leaderboard.score, ${score}),
        last_updated = NOW()
      RETURNING score
    `;

    return result.rows[0];
  } catch (error) {
    console.error('Save score error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}

export {
  initializeDatabase,
  getLeaderboard,
  saveScore,
  testConnection
};