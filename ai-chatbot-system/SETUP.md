# AI Chatbot System Setup Guide

## Prerequisites

### 1. System Requirements
- Node.js v18 or higher
- npm or yarn
- Redis server
- AWS Account with appropriate permissions
- Docker (optional, for containerized deployment)

### 2. AWS Services Setup

#### Required AWS Services:
1. **AWS Bedrock**
   - Enable Claude model access in your AWS account
   - Supported models:
     - `anthropic.claude-3-sonnet-20240229-v1:0` (recommended)
     - `anthropic.claude-3-haiku-20240307-v1:0` (faster, cheaper)
     - `anthropic.claude-3-opus-20240229-v1:0` (most capable)

2. **DynamoDB Tables**
   Create the following tables:
   - `ai-chatbot-conversations` (Partition key: `id`)
   - `ai-chatbot-documents` (Partition key: `id`)
   - `ai-chatbot-users` (Partition key: `id`)
   - `ai-chatbot-qa` (Partition key: `id`)

3. **S3 Buckets**
   Create two buckets:
   - `ai-chatbot-documents` (for document uploads)
   - `ai-chatbot-media` (for images and videos)
   
   Configure CORS for both buckets to allow frontend access.

4. **OpenSearch Domain**
   - Create an OpenSearch domain
   - Note the endpoint URL
   - Configure authentication (username/password or IAM)

5. **IAM Permissions**
   Ensure your AWS credentials have permissions for:
   - Bedrock model invocation
   - DynamoDB read/write
   - S3 read/write
   - OpenSearch access

## Installation Steps

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if not already done)
cd ai-chatbot-system

# Install all dependencies
npm install
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

Required environment variables:
- AWS credentials and region
- DynamoDB table names
- S3 bucket names
- OpenSearch endpoint and credentials
- Redis connection details
- JWT secret key

### 3. Start Redis Server

```bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis

# Or run directly
redis-server
```

### 4. Initialize AWS Resources (Optional)

If tables/buckets don't exist, you can create them using AWS CLI:

```bash
# Create DynamoDB tables (in ap-southeast-2)
aws dynamodb create-table --region ap-southeast-2 \
  --table-name ai-chatbot-conversations \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Repeat for other tables...

# Create S3 buckets (in ap-southeast-2)
aws s3 mb s3://ai-chatbot-documents --region ap-southeast-2
aws s3 mb s3://ai-chatbot-media --region ap-southeast-2
```

## Running the Application

### Development Mode

Start all three services in separate terminals:

#### Terminal 1: Backend API
```bash
cd backend
npm run start:dev
# Runs on http://localhost:3000
```

#### Terminal 2: Frontend Application
```bash
cd frontend
npm run dev
# Runs on http://localhost:3001
```

#### Terminal 3: Admin CMS
```bash
cd admin-cms
npm run dev
# Runs on http://localhost:5173
```

### Production Mode

#### Option 1: Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js
```

#### Option 2: Using Docker
```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Verify Setup

### 1. Backend Health Check
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### 2. Frontend Access
- Open http://localhost:3001
- You should see the chat interface
- Try sending a message

### 3. Admin CMS Access
- Open http://localhost:5173
- Login with default credentials:
  - Username: `admin`
  - Password: `admin123`
- Navigate through the dashboard

## Common Issues and Solutions

### Issue: AWS Credentials Not Found
**Solution:** Configure AWS credentials:
```bash
aws configure
# Or set environment variables:
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

### Issue: Redis Connection Failed
**Solution:** Ensure Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

### Issue: CORS Errors
**Solution:** Verify environment variables for FRONTEND_URL and ADMIN_URL match your actual URLs.

### Issue: OpenSearch Connection Failed
**Solution:** 
- Verify OpenSearch endpoint URL
- Check security group allows access
- Ensure credentials are correct

### Issue: DynamoDB Tables Not Found
**Solution:** Create tables manually or update table names in .env to match existing tables.

## Testing the System

### 1. Upload a Document
- Login to Admin CMS
- Go to Documents section
- Upload a PDF, DOCX, or JSON file
- Wait for processing to complete

### 2. Import Q&A Pairs
- In Admin CMS, go to Documents
- Click "Import Q&A"
- Add question-answer pairs or upload JSON file

### 3. Test Chat
- Open the frontend chat interface
- Ask questions related to uploaded documents
- Verify emotion detection is working
- Check response time (should be 3-5 seconds)

### 4. Monitor Performance
- Admin CMS > Dashboard shows system metrics
- Check Analytics for usage patterns
- Monitor AWS CloudWatch for resource usage

## API Endpoints

### Backend API (http://localhost:3000)
- `POST /auth/login` - User authentication
- `POST /chat/message` - Send chat message
- `GET /chat/history/:userId` - Get chat history
- `POST /documents/upload` - Upload document
- `POST /documents/import-qa` - Import Q&A pairs
- `GET /health` - Health check

### WebSocket Events
- `connection` - Client connects
- `message` - Send/receive messages
- `typing` - Typing indicators
- `disconnect` - Client disconnects

## Security Considerations

1. **Production Deployment**
   - Use HTTPS for all services
   - Implement rate limiting
   - Enable AWS WAF for DDoS protection
   - Use secrets manager for sensitive data

2. **Authentication**
   - Change default admin credentials immediately
   - Implement proper user management
   - Use strong JWT secrets
   - Enable MFA for admin accounts

3. **Data Protection**
   - Encrypt data at rest (S3, DynamoDB)
   - Use VPC endpoints for AWS services
   - Implement backup strategies
   - Regular security audits

## Performance Optimization

1. **Caching**
   - Redis caches frequent queries
   - CloudFront for static assets
   - Browser caching for frontend

2. **Scaling**
   - Use AWS Auto Scaling for EC2
   - DynamoDB auto-scaling
   - OpenSearch cluster sizing
   - Load balancer for multiple instances

3. **Monitoring**
   - CloudWatch metrics and alarms
   - Application performance monitoring
   - Error tracking (Sentry recommended)
   - Custom dashboards for KPIs

## Support

For issues or questions:
- Check logs in each service directory
- Review AWS CloudWatch logs
- Verify all environment variables are set
- Ensure AWS services are properly configured

## Next Steps

1. Configure production environment
2. Set up CI/CD pipeline
3. Implement additional security measures
4. Add custom branding
5. Integrate with external services
6. Set up monitoring and alerting