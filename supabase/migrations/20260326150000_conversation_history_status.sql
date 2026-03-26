ALTER TABLE conversation_history
ADD COLUMN IF NOT EXISTS terminee boolean DEFAULT false;
