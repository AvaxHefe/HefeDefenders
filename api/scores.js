import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Log request details
    console.log('API Request:', {
      method: req.method,
      url: req.url,
      body: req.method === 'POST' ? req.body : undefined
    });

    if (req.method === 'GET') {
      // Get top scores
      const { rows } = await sql`
        SELECT name, score, submitted_at
        FROM scores
        ORDER BY score DESC
        LIMIT 10;
      `;
      
      console.log('Retrieved scores:', rows);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, score } = req.body;
      
      if (!name || !score) {
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'Name and score are required'
        });
      }

      const { rows } = await sql`
        INSERT INTO scores (name, score, submitted_at)
        VALUES (${name}, ${score}, NOW())
        RETURNING id;
      `;

      console.log('Score saved:', rows[0]);
      return res.status(200).json({ id: rows[0].id });
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
  }
}