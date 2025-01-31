import { initializeDatabase, getLeaderboard } from './db.js';
import { ethers } from 'ethers';

async function getPrizePool() {
  // Configuration
  const config = {
    chainId: 43114, // Avalanche C-Chain
    usdcContract: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    merchantWallet: "0x18cd0B25309Df2e9c207f4417C5eaa7A7eaA19B8",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc"
  };

  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

  // USDC Contract ABI
  const usdcAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  // Initialize contract
  const usdcContract = new ethers.Contract(
    config.usdcContract,
    usdcAbi,
    provider
  );

  // Get USDC balance and decimals
  const [balance, decimals] = await Promise.all([
    usdcContract.balanceOf(config.merchantWallet),
    usdcContract.decimals()
  ]);

  // Format balance
  const formattedBalance = ethers.utils.formatUnits(balance, decimals);
  const totalPrizePool = parseFloat(formattedBalance) * 0.7; // 70% of total balance

  // Calculate prize distribution
  return {
    totalBalance: formattedBalance,
    prizePool: totalPrizePool,
    distribution: {
      firstPlace: (totalPrizePool * 0.5).toFixed(2),  // 50% of prize pool
      secondPlace: (totalPrizePool * 0.3).toFixed(2), // 30% of prize pool
      thirdPlace: (totalPrizePool * 0.2).toFixed(2)   // 20% of prize pool
    }
  };
}

/** @type {import('next').NextApiHandler} */
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

    // Get leaderboard data and prize pool in parallel
    const [leaderboardData, prizePoolData] = await Promise.all([
      getLeaderboard(page, limit),
      getPrizePool()
    ]);
    
    const { scores, total } = leaderboardData;
    
    // Format the response and add prize amounts for top 3
    const formattedRows = scores.map((row, index) => ({
      rank: row.rank,
      walletAddress: `${row.wallet_address.slice(0, 6)}...${row.wallet_address.slice(-4)}`,
      score: row.score,
      lastUpdated: row.last_updated,
      ...(index < 3 && {
        prizeAmount: Object.values(prizePoolData.distribution)[index]
      })
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
      },
      prizePool: {
        totalBalance: prizePoolData.totalBalance,
        totalPrizePool: prizePoolData.prizePool,
        distribution: prizePoolData.distribution
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
}