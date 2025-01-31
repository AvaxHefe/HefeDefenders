-- Drop existing tables if they exist
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS weekly_payouts;
DROP TABLE IF EXISTS leaderboard;

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_wallet UNIQUE (wallet_address),
    CONSTRAINT score_positive CHECK (score >= 0),
    CONSTRAINT valid_wallet CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Create weekly payouts table to track rewards
CREATE TABLE IF NOT EXISTS weekly_payouts (
    id SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    amount DECIMAL(10,6) NOT NULL,
    score INTEGER NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    week_start TIMESTAMP WITH TIME ZONE NOT NULL,
    week_end TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_hash TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_wallet CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_tx_hash CHECK (transaction_hash IS NULL OR transaction_hash ~ '^0x[a-fA-F0-9]{64}$')
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS leaderboard_last_updated_idx ON leaderboard(last_updated);
CREATE INDEX IF NOT EXISTS leaderboard_wallet_score_idx ON leaderboard(wallet_address, score);

CREATE INDEX IF NOT EXISTS weekly_payouts_week_idx ON weekly_payouts(week_start, week_end);
CREATE INDEX IF NOT EXISTS weekly_payouts_status_idx ON weekly_payouts(status);
CREATE INDEX IF NOT EXISTS weekly_payouts_wallet_idx ON weekly_payouts(wallet_address);

-- Create function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_updated
CREATE TRIGGER update_leaderboard_timestamp
    BEFORE UPDATE ON leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated();