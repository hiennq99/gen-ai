# AI Consulting Chatbot System

## Overview
Enterprise-grade AI consulting chatbot powered by Claude on AWS Bedrock with emotion detection, document training, and multi-channel support.

## Features
- 🤖 Claude AI integration via AWS Bedrock
- 😊 Emotion detection for context-aware responses
- 📚 Document training (PDF, DOCX, JSON)
- 🎯 70-90% accuracy for 500+ Q&A scenarios
- ⚡ 3-5 second response time
- 🖼️ Text + media (images, videos) responses
- 🔍 Semantic search with OpenSearch
- 📊 Admin dashboard for content management

## Architecture

```
                    ┌──────────────┐     ┌─────────────┐
                    │   NextJS     │────▶│   NestJS    │
                    │   Chat UI    │     │   Backend   │
                    └──────────────┘     └─────┬───────┘
                                                │
                    ┌──────────────┐            ▼
                    │   NextJS     │     ┌─────────────┐
                    │   Chat UI    │────▶│   Claude    │
                    └──────────────┘     │   Bedrock   │
                                        └─────────────┘
                    ┌──────────────┐            ▲
                    │   ReactJS    │            │
                    │   Admin CMS  │────────────┘
                    └──────────────┘
                            │
                    ┌───────▼──────┐     ┌─────────────┐
                    │   DynamoDB   │     │ OpenSearch  │
                    └──────────────┘     └─────────────┘
                            │                    │
                    ┌───────▼──────────────────▼┘
                    │         S3 Storage         │
                    └────────────────────────────┘
```

## Tech Stack
- **Backend**: NestJS + TypeScript
- **Frontend**: NextJS 14 + TailwindCSS
- **Admin**: ReactJS + Ant Design
- **AI**: Claude 3 via AWS Bedrock
- **Database**: DynamoDB + OpenSearch
- **Storage**: AWS S3
- **Queue**: AWS SQS
- **Cache**: Redis

## Quick Start

### Prerequisites
- Node.js 18+
- AWS Account with Bedrock access
- Docker & Docker Compose

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ai-chatbot-system

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your AWS credentials

# Start development servers
npm run dev
```

### Deployment

```bash
# Build all services
npm run build

# Deploy to AWS
npm run deploy:prod
```

## Project Structure

```
ai-chatbot-system/
├── backend/          # NestJS API server
├── frontend/         # NextJS chat interface
├── admin-cms/        # ReactJS admin dashboard
├── shared/           # Shared types and utilities
├── infrastructure/   # AWS CDK/Terraform configs
└── docs/            # Documentation
```

## License
MIT