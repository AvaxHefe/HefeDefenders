const { initializeDatabase, getLeaderboard } = require('./db');

/** @type {import('next').NextApiHandler} */
const handler = async (req, res) => {
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
    console.log('Leaderboard request received');

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

    // Initialize database if needed
    await initializeDatabase();

    // Get leaderboard data
    const { scores, total } = await getLeaderboard(page, limit);
    
    // Format the response
    const formattedRows = scores.map(row => ({
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
  }
};

module.exports = handler;