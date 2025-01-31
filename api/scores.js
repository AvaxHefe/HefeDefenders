import { createClient } from '@vercel/postgres';

// Initialize the database client
const client = createClient();

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('API Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
  
  try {
    if (!client.isConnected) {
      console.log('Connecting to database...');
      await client.connect();
      console.log('Database connected successfully');
    }

    // Log database connection state
    console.log('Database connection state:', {
      isConnected: client.isConnected,
      config: {
        ...client.config,
        // Mask sensitive information
        password: client.config?.password ? '***' : undefined
      }
    });

    if (req.method === 'POST') {
      console.log('Handling POST request');
      const { name, score } = req.body;
      console.log('Received score submission:', { name, score });
      
      if (!name || !score) {
        console.log('Invalid submission - missing name or score');
        return res.status(400).json({ error: 'Name and score are required' });
      }

      try {
        const result = await client.sql`
          INSERT INTO scores (name, score, submitted_at)
          VALUES (${name}, ${score}, NOW())
          RETURNING id;
        `;
        console.log('Score saved successfully:', result.rows[0]);
        return res.status(200).json({ id: result.rows[0].id });
      } catch (dbError) {
        console.error('Database query error:', {
          error: dbError,
          query: 'INSERT INTO scores',
          params: { name, score }
        });
        throw dbError;
      }

    } else if (req.method === 'GET') {
      console.log('Handling GET request');
      try {
        const result = await client.sql`
          SELECT name, score, submitted_at
          FROM scores
          ORDER BY score DESC
          LIMIT 10;
        `;
        console.log('Retrieved scores:', result.rows);
        return res.status(200).json(result.rows);
      } catch (dbError) {
        console.error('Database query error:', {
          error: dbError,
          query: 'SELECT FROM scores'
        });
        throw dbError;
      }
    }

    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      connectionDetails: {
        isConnected: client?.isConnected,
        config: client?.config ? {
          ...client.config,
          password: '***'
        } : undefined
      },
      env: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        postgresUrlLength: process.env.POSTGRES_URL?.length
      }
    });

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      code: error.code
    });
  }
}