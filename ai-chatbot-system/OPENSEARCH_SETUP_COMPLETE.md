# ✅ AWS OpenSearch Setup Complete

## Configuration Summary

Your AWS OpenSearch cluster is now fully configured and connected to your application!

### Connection Details
- **OpenSearch Domain**: `search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com`
- **Username**: `nicknq`
- **Region**: `ap-southeast-2`
- **Version**: OpenSearch 3.1.0
- **Cluster Status**: 🟢 GREEN
- **Nodes**: 6 (3 data nodes)

### Indices Created
1. ✅ **ai-chatbot-documents** - For storing uploaded documents and embeddings
   - Vector field: `embedding` (1536 dimensions, cosine similarity)
   - Engine: Lucene HNSW

2. ✅ **ai-chatbot-conversations** - For storing chat conversations

### Environment Configuration

Your `.env` file has been configured with:
```bash
OPENSEARCH_NODE=https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com
OPENSEARCH_USERNAME=nicknq
OPENSEARCH_PASSWORD="Abcd!@#789"  # ⚠️ Quoted to handle special characters
OPENSEARCH_DOCUMENTS_INDEX=ai-chatbot-documents
OPENSEARCH_CONVERSATIONS_INDEX=ai-chatbot-conversations
```

### Important Note: Password Quoting
⚠️ **Critical**: The password contains `#` which is treated as a comment in .env files.
Always keep quotes around the password: `OPENSEARCH_PASSWORD="Abcd!@#789"`

## Next Steps

### 1. Upload Training Documents
Use the Admin CMS to upload your training documents:
- Navigate to: http://localhost:5173
- Go to "Documents" section
- Upload PDF or CSV files with Q&A pairs

### 2. Test Document Search
```bash
# Search for documents
curl "http://localhost:3000/api/documents/search?q=test"

# Upload a test document
curl -X POST "http://localhost:3000/api/documents/upload" \
  -F "file=@your-document.pdf" \
  -F "title=Test Document"
```

### 3. Monitor OpenSearch
```bash
# Check cluster health
curl -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/_cluster/health"

# List indices
curl -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/_cat/indices?v"

# Check document count
curl -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/ai-chatbot-documents/_count"
```

### 4. Run Test Scripts
```bash
cd backend

# Test OpenSearch connection
node test-opensearch-simple.js

# Check environment variables
node test-env-debug.js
```

## Troubleshooting

### Connection Test Failed
If you encounter connection issues:
1. Verify credentials are correct
2. Check IP whitelist in AWS OpenSearch access policy
3. Ensure security groups allow your IP (if using VPC)

### Index Already Exists Error
If you need to recreate indices:
```bash
# Delete index
curl -XDELETE -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/ai-chatbot-documents"

# Recreate using the command from OPENSEARCH_AWS_SETUP.md
```

### Password Issues
If authentication fails:
1. Ensure password is quoted in .env: `OPENSEARCH_PASSWORD="Abcd!@#789"`
2. Restart backend after changing .env
3. Test with curl first to verify credentials

## OpenSearch Features

### Vector Search (RAG)
Your system now supports:
- ✅ 1536-dimension vector embeddings (AWS Bedrock Titan/OpenAI compatible)
- ✅ Cosine similarity search
- ✅ Hybrid search (keyword + semantic)
- ✅ Metadata filtering

### Document Types Supported
- ✅ PDF documents (with text extraction)
- ✅ CSV files with Q&A pairs
- ✅ DOCX documents
- ✅ Plain text files
- ✅ JSON data

### Search Capabilities
1. **Keyword Search**: Traditional text-based search
2. **Semantic Search**: Vector similarity using embeddings
3. **Hybrid Search**: Combines both approaches
4. **Filtered Search**: Search with metadata filters (emotion, category, etc.)

## Performance Optimization

### Current Setup
- **Nodes**: 6 (3 data nodes for high availability)
- **Shards**: 107 active shards
- **Index Strategy**: Separate indices for documents and conversations

### Monitoring Recommendations
1. **CloudWatch Metrics**:
   - Monitor `ClusterStatus.red` (should be 0)
   - Set alarm on `FreeStorageSpace` < 20%
   - Monitor `CPUUtilization` and `JVMMemoryPressure`

2. **Index Management**:
   - Consider Index State Management (ISM) policies for old data
   - Set up automated snapshots
   - Monitor index size and shard count

### Cost Optimization
- Current cluster: ~6 nodes (production setup)
- Consider scaling down to 1-3 nodes for development
- Use reserved instances for 30-50% cost savings
- Implement data lifecycle policies to delete old indices

## Security Best Practices

### Current Security
- ✅ Fine-grained access control enabled
- ✅ HTTPS enforcement
- ✅ Authentication required

### Recommendations
1. **Production Security**:
   - Move to VPC access (no public endpoint)
   - Use IAM roles instead of username/password
   - Enable audit logging
   - Store credentials in AWS Secrets Manager

2. **Access Control**:
   - Review and tighten access policies
   - Implement role-based access control (RBAC)
   - Regular credential rotation

## Support & Resources

### Test Scripts Available
- `test-opensearch-connection.js` - Full connection test
- `test-opensearch-simple.js` - Quick connection verify
- `test-env-debug.js` - Environment variable checker

### Documentation
- `OPENSEARCH_AWS_SETUP.md` - Complete setup guide
- AWS OpenSearch Docs: https://docs.aws.amazon.com/opensearch-service/

### Common Operations
```bash
# Restart backend
docker-compose restart backend

# Check backend logs
docker logs ai-chatbot-backend | grep -i opensearch

# Test document upload
npm run test:documents
```

---

## Summary

✅ **OpenSearch Cluster**: Connected and healthy
✅ **Indices Created**: Documents and conversations indices ready
✅ **Vector Search**: Configured with 1536-dim embeddings
✅ **Backend Integration**: Application connected successfully
✅ **Security**: Fine-grained access control enabled

Your RAG system is now fully operational! 🚀

Start uploading documents through the Admin CMS and your chatbot will use them for intelligent responses.