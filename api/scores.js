import { createClient } from '@vercel/postgres';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  
  try {
    // Log environment check
    console.log('Environment check:', {
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      postgresUrlLength: process.env.POSTGRES_URL?.length || 0,
      nodeEnv: process.env.NODE_ENV
    });

    // Initialize client
    client = createClient();
    
    // Connect with timeout
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    
    console.log('Database connected successfully');

    if (req.method === 'GET') {
      console.log('Executing SELECT query');
      const result = await client.sql`
        SELECT name, score, submitted_at
        FROM scores
        ORDER BY score DESC
        LIMIT 10;
      `;
      console.log('Query result:', result.rows);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { name, score } = req.body;
      
      if (!name || !score) {
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'Name and score are required'
        });
      }

      console.log('Executing INSERT query');
      const result = await client.sql`
        INSERT INTO scores (name, score, submitted_at)
        VALUES (${name}, ${score}, NOW())
        RETURNING id;
      `;
      console.log('Insert result:', result.rows[0]);
      return res.status(200).json({ id: result.rows[0].id });
    }

    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `Method ${req.method} is not supported`
    });

  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      connectionDetails: {
        hasClient: !!client,
        isConnected: client?.isConnected,
      },
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        postgresUrlLength: process.env.POSTGRES_URL?.length || 0,
        nodeEnv: process.env.NODE_ENV
      }
    });

    return res.status(500).json({ 
      error: {
        message: error.message,
        code: error.code || '500',
        type: error.name
      }
    });

  } finally {
    // Always try to end the client connection
    try {
      if (client) {
        await client.end();
        console.log('Database connection closed');
      }
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}