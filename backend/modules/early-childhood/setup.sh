#!/bin/bash

# Setup script for KindiCore AI

echo "🎓 KindiCore AI - Setup Script"
echo "=============================="
echo ""

# Check Python version
echo "Checking Python version..."
python3 --version

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip3 install --upgrade pip

# Install dependencies
echo ""
echo "Installing dependencies..."
pip3 install -r requirements.txt

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env and add your API keys"
else
    echo "✅ .env file already exists"
fi

# Create necessary directories
echo ""
echo "Creating necessary directories..."
mkdir -p uploads
mkdir -p reports/output
mkdir -p logs

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys (OpenAI or Google Gemini)"
echo "2. Configure database credentials in .env"
echo "3. Run: ./init_db.sh (to initialize database)"
echo "4. Run: source venv/bin/activate"
echo "5. Run: python app.py"
echo ""
