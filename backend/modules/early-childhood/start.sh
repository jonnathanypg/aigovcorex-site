#!/bin/bash

# Quick start script for KindiCore AI

echo "🚀 KindiCore AI - Quick Start"
echo "=============================="
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run: ./setup.sh first"
    exit 1
fi

# Activate venv
echo "Activating virtual environment..."
source venv/bin/activate

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Run the app
echo ""
echo "Starting KindiCore AI..."
echo "Access at: http://localhost:5000"
echo "Press Ctrl+C to stop"
echo ""

python app.py
