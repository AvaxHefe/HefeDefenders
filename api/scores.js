import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
  regions: ['iad1']  // US East (N. Virginia)
};

export default async function handler(req) {
  try {
    // Parse request
    const method = req.method;
    const url = new URL(req.url);

    // Prepare response headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers 
      });
    }

    // Log request details
    console.log('API Request:', {
      method,
      url: url.toString(),
      headers: Object.fromEntries(req.headers)
    });

    if (method === 'GET') {
      const result = await sql`
        SELECT name, score, submitted_at
        FROM scores
        ORDER BY score DESC
        LIMIT 10;
      `;
      
      return new Response(
        JSON.stringify(result.rows),
        { status: 200, headers }
      );
    }

    if (method === 'POST') {
      const body = await req.json();
      const { name, score } = body;
      
      if (!name || !score) {
        return new Response(
          JSON.stringify({ 
            error: 'Name and score are required' 
          }),
          { status: 400, headers }
        );
      }

      const result = await sql`
        INSERT INTO scores (name, score, submitted_at)
        VALUES (${name}, ${score}, NOW())
        RETURNING id;
      `;

      return new Response(
        JSON.stringify({ id: result.rows[0].id }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: `Method ${method} not allowed` 
      }),
      { status: 405, headers }
    );

  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          code: error.code || '500',
          type: error.name
        }
      }),
      { 
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}