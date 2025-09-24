#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "🔄 Starting build process..."

# Create the required directory structure
echo "📂 Setting up directory structure..."
mkdir -p /opt/render/project/src

# Copy all files to the expected location
echo "📦 Copying files..."
cp -r . /opt/render/project/src

# Navigate to the src directory
cd /opt/render/project/src

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the client
echo "🏗️  Building client..."
npm run build:client

echo "✅ Build completed successfully!"