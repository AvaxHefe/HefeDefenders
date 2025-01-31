import { sql } from '@vercel/postgres';

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

  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 100' 
      });
    }

    const offset = (page - 1) * limit;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total FROM leaderboard
    `;
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const { rows } = await sql`
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
    console.error('Leaderboard fetch error:', error);
    
    // Handle specific database errors
    if (error.code === '42P01') { // Undefined table
      res.status(500).json({ error: 'Leaderboard table not found' });
    } else if (error.code === '42703') { // Undefined column
      res.status(500).json({ error: 'Invalid column reference' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}