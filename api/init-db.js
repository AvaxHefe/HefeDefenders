import { sql } from '@vercel/postgres';

/** @type {import('next').NextApiHandler} */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Checking database connection...');
    await sql`SELECT NOW()`;
    console.log('Database connection successful');

    console.log('Checking if leaderboard table exists...');
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'leaderboard'
      );
    `;

    if (!tableExists.rows[0].exists) {
      console.log('Creating leaderboard table...');
      await sql`
        CREATE TABLE leaderboard (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          score INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_wallet UNIQUE (wallet_address),
          CONSTRAINT score_positive CHECK (score >= 0),
          CONSTRAINT valid_wallet CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
        )
      `;

      console.log('Creating indexes...');
      await sql`CREATE INDEX leaderboard_score_idx ON leaderboard(score DESC)`;
      await sql`CREATE INDEX leaderboard_last_updated_idx ON leaderboard(last_updated)`;
      await sql`CREATE INDEX leaderboard_wallet_score_idx ON leaderboard(wallet_address, score)`;

      console.log('Creating update_last_updated function...');
      await sql`
        CREATE OR REPLACE FUNCTION update_last_updated()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.last_updated = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `;

      console.log('Creating trigger...');
      await sql`
        CREATE TRIGGER update_leaderboard_timestamp
            BEFORE UPDATE ON leaderboard
            FOR EACH ROW
            EXECUTE FUNCTION update_last_updated()
      `;

      console.log('Database initialization completed successfully');
      res.status(200).json({ message: 'Database initialized successfully' });
    } else {
      console.log('Leaderboard table already exists');
      res.status(200).json({ message: 'Database already initialized' });
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    const errorMessage = error.message || 'Unknown database error';
    res.status(500).json({ 
      error: 'Failed to initialize database', 
      details: errorMessage,
      code: error.code
    });
  }
}