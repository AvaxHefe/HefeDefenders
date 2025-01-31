import { sql } from '@vercel/postgres';

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

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, nickname } = req.body;

    // Validate input
    if (!walletAddress || !nickname) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Both walletAddress and nickname are required'
      });
    }

    // Validate nickname format
    const nicknameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!nicknameRegex.test(nickname)) {
      return res.status(400).json({
        error: 'Invalid nickname format',
        details: 'Nickname must be 3-20 characters long and contain only letters, numbers, underscores, and hyphens'
      });
    }

    // Update nickname in database
    const result = await sql`
      UPDATE leaderboard 
      SET nickname = ${nickname}
      WHERE wallet_address = ${walletAddress}
      RETURNING nickname
    `;

    if (result.rowCount === 0) {
      // If no rows were updated, the wallet doesn't exist yet
      await sql`
        INSERT INTO leaderboard (wallet_address, nickname, score)
        VALUES (${walletAddress}, ${nickname}, 0)
      `;
    }

    res.status(200).json({
      success: true,
      nickname: nickname
    });

  } catch (error) {
    console.error('Save nickname error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Handle unique constraint violation
    if (error.code === '23505' && error.constraint === 'unique_nickname') {
      return res.status(409).json({
        error: 'Nickname already taken',
        details: 'Please choose a different nickname'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}