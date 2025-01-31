import { Pool } from '@neondatabase/serverless';
import { createClient } from '@vercel/postgres';

// Initialize the database client
const client = createClient();

export default async function handler(req, res) {
  if (!client.isConnected) await client.connect();

  try {
    if (req.method === 'POST') {
      // Handle score submission
      const { name, score } = req.body;
      
      if (!name || !score) {
        return res.status(400).json({ error: 'Name and score are required' });
      }

      const result = await client.sql`
        INSERT INTO scores (name, score, submitted_at)
        VALUES (${name}, ${score}, NOW())
        RETURNING id;
      `;

      return res.status(200).json({ id: result.rows[0].id });

    } else if (req.method === 'GET') {
      // Get top scores
      const result = await client.sql`
        SELECT name, score, submitted_at
        FROM scores
        ORDER BY score DESC
        LIMIT 10;
      `;

      return res.status(200).json(result.rows);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}