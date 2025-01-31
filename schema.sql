-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster score retrieval
CREATE INDEX IF NOT EXISTS scores_score_idx ON scores(score DESC);

-- Add constraint to prevent empty names
ALTER TABLE scores ADD CONSTRAINT scores_name_not_empty CHECK (name <> '');

-- Add constraint to prevent negative scores
ALTER TABLE scores ADD CONSTRAINT scores_score_positive CHECK (score >= 0);