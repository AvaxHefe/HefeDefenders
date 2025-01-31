import { ethers } from 'ethers';

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
    // Configuration
    const config = {
      chainId: 43114, // Avalanche C-Chain
      usdcContract: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      merchantWallet: "0x18cd0B25309Df2e9c207f4417C5eaa7A7eaA19B8",
      rpcUrl: "https://api.avax.network/ext/bc/C/rpc"
    };

    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

    // USDC Contract ABI (only need balanceOf function)
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
    const prizes = {
      first: totalPrizePool * 0.5,    // 50% of prize pool
      second: totalPrizePool * 0.3,   // 30% of prize pool
      third: totalPrizePool * 0.2     // 20% of prize pool
    };

    res.status(200).json({
      totalBalance: formattedBalance,
      prizePool: totalPrizePool,
      distribution: {
        firstPlace: prizes.first.toFixed(2),
        secondPlace: prizes.second.toFixed(2),
        thirdPlace: prizes.third.toFixed(2)
      }
    });

  } catch (error) {
    console.error('Prize pool fetch error:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch prize pool',
      message: error.message
    });
  }
}