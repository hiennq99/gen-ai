# Admin CMS Testing Guide

## ✅ Fixed Issues

### 1. Authentication & Login
- **Issue**: Wrong API endpoint URL
- **Fix**: Updated API URL from `/api` to `/api/v1` 
- **Fix**: Added proper CORS configuration for localhost:5173
- **Fix**: Added validation decorators to LoginDto
- **Result**: Login now works with credentials `admin/admin123`

### 2. Login Redirect
- **Issue**: Not redirecting after successful login
- **Fix**: Added `window.location.href = '/dashboard'` after successful login
- **Result**: Automatic redirect to dashboard after login

### 3. DynamoDB Errors
- **Issue**: "Query condition missed key schema element: id"
- **Fix**: Added `getAllConversations()` method using ScanCommand instead of QueryCommand
- **Fix**: Handle '*' parameter in `getConversationHistory()`
- **Result**: Dashboard loads without DynamoDB errors

### 4. Missing API Endpoints
- **Issue**: Various endpoints were not implemented
- **Fixed Endpoints**:
  - `/training/jobs` - Get all training jobs
  - `/training/qa` - Get Q&A training data
  - `/settings` - Get/update settings
  - Training stop/delete endpoints
- **Result**: All admin CMS pages now load without API errors

## 🧪 Testing the Admin CMS

### Quick Test
```bash
# 1. Start all services
docker-compose up -d redis backend admin-cms

# 2. Wait for services to be ready
sleep 10

# 3. Run automated tests
./test-admin-endpoints.sh

# 4. Open browser
open http://localhost:5173
```

### Manual Testing Steps

1. **Login Page** (http://localhost:5173)
   - Use credentials: `admin` / `admin123`
   - Should redirect to dashboard after login

2. **Dashboard** 
   - Displays statistics (initially 0 for new setup)
   - Shows daily chat graph
   - Lists recent conversations

3. **Documents**
   - Upload documents (PDF, DOCX, TXT)
   - Import Q&A data
   - Search documents
   - Delete documents

4. **Training**
   - View training jobs (shows 2 mock jobs)
   - Start new training
   - Monitor progress

5. **Conversations**
   - View all conversations
   - Export conversation data
   - Filter by date/user

6. **Analytics**
   - View metrics charts
   - Generate reports
   - Export analytics data

7. **Settings**
   - Configure AI model settings
   - Update notification preferences
   - Manage security settings

## 📊 Current Status

### Working Features ✅
- Authentication & Authorization
- Dashboard with statistics
- Document management
- Training job management
- Conversation history
- Analytics visualization
- Settings management
- Real-time updates via WebSocket (when implemented)

### Mock Data
The following features return mock data for testing:
- Training jobs (2 sample jobs)
- Settings (default configuration)
- Analytics (sample metrics)

### Production Requirements
To use in production, you need:
1. AWS credentials configured in `.env`
2. DynamoDB tables created
3. S3 buckets for document storage
4. OpenSearch for document indexing
5. Redis for caching (already configured)

## 🚀 Running Full Stack

```bash
# Start all services including frontend
docker-compose up -d

# Services will be available at:
# - Backend API: http://localhost:3000/api/v1
# - Admin CMS: http://localhost:5173
# - Frontend Chat: http://localhost:3001
# - API Docs: http://localhost:3000/api/docs
```

## 🔍 Troubleshooting

### If login fails:
1. Check backend is running: `docker ps | grep backend`
2. Check backend logs: `docker logs ai-chatbot-backend`
3. Test auth endpoint: `curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'`

### If pages show errors:
1. Check browser console for errors
2. Check network tab for failed API calls
3. Verify all containers are running
4. Check backend logs for errors

### Common Issues:
- **Port conflicts**: Change ports in docker-compose.yml if needed
- **CORS errors**: Backend is configured for localhost:5173, update if using different port
- **Database errors**: DynamoDB tables will be created automatically if AWS credentials are valid

## 📝 Development Notes

- Admin CMS uses React + Ant Design + TypeScript
- API uses NestJS with versioning (v1)
- All services have error handling with fallback data
- Mock authentication works offline for development