#!/bin/bash

# Database initialization script for KindiCore AI

echo "🎓 KindiCore AI - Database Initialization"
echo "=========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ Error: MySQL is not installed"
    exit 1
fi

echo ""
echo "📊 Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Create database
echo "Creating database..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully"
else
    echo "❌ Error creating database"
    exit 1
fi

# Import schema
echo ""
echo "Importing schema..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < database/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema imported successfully"
else
    echo "❌ Error importing schema"
    exit 1
fi

echo ""
echo "✅ Database initialization complete!"
echo ""
echo "Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Run the application: python app.py"
echo "3. Access at: http://localhost:5000"
