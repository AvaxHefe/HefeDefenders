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

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        error: 'Missing wallet address'
      });
    }

    // Check if wallet exists and hasn't used free life
    const result = await sql`
      SELECT used_free_life 
      FROM leaderboard 
      WHERE wallet_address = ${walletAddress}
    `;

    if (result.rows.length === 0) {
      // New wallet, create record with used_free_life = true
      await sql`
        INSERT INTO leaderboard (wallet_address, score, used_free_life)
        VALUES (${walletAddress}, 0, TRUE)
      `;
      return res.status(200).json({ success: true, message: 'Free life claimed' });
    }

    if (result.rows[0].used_free_life) {
      return res.status(400).json({
        error: 'Free life already claimed',
        details: 'This wallet has already used its free life'
      });
    }

    // Update the record to mark free life as used
    await sql`
      UPDATE leaderboard 
      SET used_free_life = TRUE
      WHERE wallet_address = ${walletAddress}
    `;

    res.status(200).json({
      success: true,
      message: 'Free life claimed'
    });

  } catch (error) {
    console.error('Claim free life error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}