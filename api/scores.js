import { sql } from '@vercel/postgres';

// Simple rate limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute
const rateLimitMap = new Map();

function isRateLimited(walletAddress) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(walletAddress) || [];
  
  // Clean up old requests
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  rateLimitMap.set(walletAddress, recentRequests);
  
  return recentRequests.length >= RATE_LIMIT_MAX;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      console.log('Score submission request received');
      const { walletAddress, score } = req.body;
      console.log(`Attempting to save score: ${score} for wallet: ${walletAddress}`);

      // Input validation
      if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.log('Invalid wallet address:', walletAddress);
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      if (!score || typeof score !== 'number' || score < 0) {
        console.log('Invalid score:', score);
        return res.status(400).json({ error: 'Invalid score' });
      }

      // Check rate limit
      if (isRateLimited(walletAddress)) {
        console.log('Rate limit exceeded for wallet:', walletAddress);
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      // Add request to rate limit tracking
      const userRequests = rateLimitMap.get(walletAddress) || [];
      userRequests.push(Date.now());
      rateLimitMap.set(walletAddress, userRequests);

      // First check if the table exists
      console.log('Checking if leaderboard table exists...');
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'leaderboard'
        );
      `;

      if (!tableExists.rows[0].exists) {
        console.log('Leaderboard table does not exist, creating...');
        // Create the table if it doesn't exist
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
      }

      // Upsert score into leaderboard
      console.log('Upserting score into leaderboard...');
      const result = await sql`
        INSERT INTO leaderboard (wallet_address, score, last_updated)
        VALUES (${walletAddress}, ${score}, NOW())
        ON CONFLICT (wallet_address)
        DO UPDATE SET
          score = GREATEST(leaderboard.score, ${score}),
          last_updated = NOW()
        RETURNING score
      `;
      console.log('Score upserted successfully');
      
      const updatedScore = result.rows[0].score;
      
      res.status(200).json({ 
        success: true,
        score: updatedScore,
        message: updatedScore > score ? 'Previous high score retained' : 'New high score recorded'
      });
    } catch (error) {
      console.error('Score submission error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details
      });
      
      // Handle specific database errors
      if (error.code === '23505') { // Unique violation
        res.status(409).json({
          error: 'Score already exists for this wallet',
          details: error.message
        });
      } else if (error.code === '23502') { // Not null violation
        res.status(400).json({
          error: 'Missing required fields',
          details: error.message
        });
      } else if (error.code === '42P01') { // Undefined table
        res.status(500).json({
          error: 'Database table not found',
          details: 'Please try again as the table will be created automatically'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: error.code
        });
      }
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}