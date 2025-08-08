#!/bin/bash

echo "🚀 Starting AI Chatbot Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your AWS credentials and configuration"
fi

# Start Redis and other required services
echo "🔧 Starting local services with Docker Compose..."
docker-compose up -d redis opensearch

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start all services in development mode
echo "🎯 Starting all applications..."

# Function to cleanup on exit
cleanup() {
    echo -e "\n🛑 Stopping services..."
    pkill -f "nest start --watch"
    pkill -f "next dev"
    pkill -f "vite"
    docker-compose down
    exit 0
}

trap cleanup INT TERM

# Start backend
echo "🔵 Starting Backend (NestJS) on port 3000..."
cd backend && npm run dev &

# Start frontend
echo "🟢 Starting Frontend (NextJS) on port 3001..."
cd ../frontend && npm run dev &

# Start admin CMS
echo "🟡 Starting Admin CMS (React) on port 5173..."
cd ../admin-cms && npm run dev &

echo "✅ All services starting..."
echo ""
echo "📍 Services will be available at:"
echo "   - Backend API: http://localhost:3000"
echo "   - Frontend Chat: http://localhost:3001"
echo "   - Admin CMS: http://localhost:5173"
echo "   - OpenSearch: http://localhost:9200"
echo "   - Redis: localhost:6379"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait