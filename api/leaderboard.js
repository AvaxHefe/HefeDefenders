import { sql, createPool } from '@vercel/postgres';

// Create a connection pool
const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    console.log('Leaderboard request received');
    
    // Get a client from the pool
    console.log('Getting database connection from pool...');
    client = await pool.connect();
    
    // First check if the table exists
    console.log('Checking if leaderboard table exists...');
    const tableExists = await client.sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'leaderboard'
      );
    `;

    if (!tableExists.rows[0].exists) {
      console.log('Leaderboard table does not exist, creating...');
      // Create the table if it doesn't exist
      await client.sql`
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
      
      await client.sql`CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard(score DESC)`;
      console.log('Leaderboard table created successfully');
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`Fetching leaderboard data (page: ${page}, limit: ${limit})`);
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 100'
      });
    }

    const offset = (page - 1) * limit;

    // Get total count for pagination
    console.log('Getting total count...');
    const countResult = await client.sql`
      SELECT COUNT(*) as total FROM leaderboard
    `;
    const total = parseInt(countResult.rows[0].total);
    console.log(`Total records: ${total}`);

    // Get paginated results
    console.log('Fetching scores...');
    const { rows } = await client.sql`
      SELECT
        wallet_address,
        score,
        last_updated,
        RANK() OVER (ORDER BY score DESC) as rank
      FROM leaderboard
      ORDER BY score DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    console.log(`Retrieved ${rows.length} scores`);
    
    // Format the response
    const formattedRows = rows.map(row => ({
      rank: row.rank,
      walletAddress: `${row.wallet_address.slice(0, 6)}...${row.wallet_address.slice(-4)}`,
      score: row.score,
      lastUpdated: row.last_updated
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      scores: formattedRows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Leaderboard fetch error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      details: error.details
    });
    
    // Handle specific database errors
    if (error.code === '42P01') { // Undefined table
      res.status(500).json({ 
        error: 'Leaderboard table not found',
        details: 'Please try again as the table will be created automatically'
      });
    } else if (error.code === '42703') { // Undefined column
      res.status(500).json({ 
        error: 'Invalid column reference',
        details: error.message
      });
    } else if (error.code === '28P01') { // Invalid password
      res.status(500).json({ 
        error: 'Database authentication failed',
        details: 'Please check database credentials'
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        code: error.code
      });
    }
  } finally {
    if (client) {
      console.log('Releasing database connection back to pool');
      client.release();
    }
  }
}