const { initializeDatabase } = require('./db');

/** @type {import('next').NextApiHandler} */
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check all required environment variables
    const requiredEnvVars = [
      'POSTGRES_URL',
      'POSTGRES_URL_NON_POOLING',
      'POSTGRES_PRISMA_URL',
      'POSTGRES_USER',
      'POSTGRES_HOST',
      'POSTGRES_PASSWORD',
      'POSTGRES_DATABASE'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars);
      throw new Error(`Missing environment variables: ${missingEnvVars.join(', ')}`);
    }

    console.log('All required environment variables present');
    console.log('Database URL format:', process.env.POSTGRES_URL ? 'Present' : 'Missing');
    console.log('Database Host:', process.env.POSTGRES_HOST);

    // Initialize database
    await initializeDatabase();
    
    res.status(200).json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database initialization error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      details: error.details
    });

    if (error.code === '28P01') { // Invalid password
      res.status(500).json({ 
        error: 'Database authentication failed',
        details: 'Please check database credentials'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to initialize database', 
        details: error.message,
        code: error.code
      });
    }
  }
};

module.exports = handler;