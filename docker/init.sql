-- DefiCredit PostgreSQL initialization
-- Prisma handles the actual schema migrations

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE deficredit TO deficredit;
