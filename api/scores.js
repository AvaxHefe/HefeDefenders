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
      const { walletAddress, score } = req.body;

      // Input validation
      if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      if (!score || typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      // Check rate limit
      if (isRateLimited(walletAddress)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      // Add request to rate limit tracking
      const userRequests = rateLimitMap.get(walletAddress) || [];
      userRequests.push(Date.now());
      rateLimitMap.set(walletAddress, userRequests);

      // Upsert score into leaderboard
      const result = await sql`
        INSERT INTO leaderboard (wallet_address, score, last_updated)
        VALUES (${walletAddress}, ${score}, NOW())
        ON CONFLICT (wallet_address) 
        DO UPDATE SET 
          score = GREATEST(leaderboard.score, ${score}),
          last_updated = NOW()
        RETURNING score
      `;
      
      const updatedScore = result.rows[0].score;
      
      res.status(200).json({ 
        success: true,
        score: updatedScore,
        message: updatedScore > score ? 'Previous high score retained' : 'New high score recorded'
      });
    } catch (error) {
      console.error('Score submission error:', error);
      
      // Handle specific database errors
      if (error.code === '23505') { // Unique violation
        res.status(409).json({ error: 'Score already exists for this wallet' });
      } else if (error.code === '23502') { // Not null violation
        res.status(400).json({ error: 'Missing required fields' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}