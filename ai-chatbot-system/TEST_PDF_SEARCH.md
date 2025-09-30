# Testing Your Processed PDF Document

## ✅ PDF Successfully Processed!

```
✅ 2,180 chunks created
✅ 2,180 vectors generated
✅ 2,180 chunks indexed in OpenSearch
✅ Processing time: 1,978 seconds (~33 minutes)
✅ Average: 0.91s per chunk
```

## How to Test

### 1. Search via API

#### Basic Search
```bash
# Search for content in your PDF
curl "http://localhost:3000/api/v1/documents/search?q=your_search_term"

# Examples based on common PDF content:
curl "http://localhost:3000/api/v1/documents/search?q=spiritual"
curl "http://localhost:3000/api/v1/documents/search?q=guidance"
curl "http://localhost:3000/api/v1/documents/search?q=prayer"
```

#### Advanced Search with Parameters
```bash
# Limit results
curl "http://localhost:3000/api/v1/documents/search?q=spiritual&limit=5"

# With emotion filter
curl "http://localhost:3000/api/v1/documents/search?q=happiness&emotion=happy"

# Get more context
curl "http://localhost:3000/api/v1/documents/search?q=meditation&limit=10"
```

### 2. Test via Frontend/Admin CMS

#### Admin CMS (http://localhost:5173)
1. Open http://localhost:5173
2. Go to "Documents" or "Spiritual Guidance" section
3. Look for your uploaded PDF
4. Try searching for content
5. View document chunks and metadata

#### Frontend Chat (http://localhost:3001)
1. Open http://localhost:3001
2. Start a conversation
3. Ask questions related to your PDF content
4. The AI should use the PDF content in responses

### 3. Verify in OpenSearch

```bash
# Check total document count
curl -s -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/ai-chatbot-documents/_count" | jq '.'

# Expected: {"count": 2180, ...}

# Search directly in OpenSearch
curl -s -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/ai-chatbot-documents/_search?size=5" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "content": "your search term"
      }
    }
  }' | jq '.hits.hits'
```

### 4. Check Redis Vector Storage

```bash
# Check Redis for stored vectors
docker exec ai-chatbot-backend redis-cli DBSIZE

# Search for document keys
docker exec ai-chatbot-backend redis-cli KEYS "document:*" | head -20

# Get stats
curl "http://localhost:3000/api/v1/test/redis-vectors/stats"
```

### 5. Test Chat Integration

```bash
# Test chat with your PDF content
curl -X POST "http://localhost:3000/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about spiritual guidance",
    "sessionId": "test-session-123"
  }'

# The response should include information from your PDF
```

## Sample Test Queries

Based on your PDF being a "Handbook of Spiritual Medicine":

### Test 1: General Topic Search
```bash
curl "http://localhost:3000/api/v1/documents/search?q=spiritual+medicine"
```

**Expected Result:**
```json
[
  {
    "id": "doc-id-chunk-123",
    "score": 2.5,
    "content": "Text from your PDF about spiritual medicine...",
    "title": "pdf-upload-xxx.pdf - Chunk 124",
    "metadata": {
      "sourceFile": "pdf-upload-1759205836875.pdf",
      "type": "pdf_content",
      "chunkIndex": 123
    }
  }
]
```

### Test 2: Specific Concept
```bash
curl "http://localhost:3000/api/v1/documents/search?q=anger"
```

### Test 3: Arabic Terms (if in your PDF)
```bash
curl "http://localhost:3000/api/v1/documents/search?q=الغضب"
```

### Test 4: Page Content
```bash
# Search for content from a specific page you remember
curl "http://localhost:3000/api/v1/documents/search?q=page+content+here"
```

## Verify Search Quality

### Good Search Results Should Include:

1. **Relevant Content**: Text actually from your PDF
2. **Proper Metadata**:
   - `sourceFile`: Your PDF filename
   - `chunkIndex`: Number indicating position
   - `type`: "pdf_content"
3. **Good Scores**: Higher scores (> 1.0) for better matches
4. **Multiple Results**: Several chunks if content appears in multiple places

### Example Good Result:
```json
{
  "id": "abc123-chunk-456",
  "score": 3.2,
  "content": "Anger (الغضب) is discussed in the handbook as one of the spiritual diseases...",
  "title": "handbook-spiritual-medicine.pdf - Chunk 457",
  "metadata": {
    "sourceFile": "pdf-upload-1759205836875.pdf",
    "chunkIndex": 456,
    "startPosition": 456000,
    "endPosition": 458000,
    "type": "pdf_content",
    "chunkSize": 2000
  }
}
```

## Interactive Testing

### Test Script
```bash
#!/bin/bash
# Save as test-search.sh

echo "Testing PDF Search..."
echo ""

# Test 1
echo "1. Testing general search..."
curl -s "http://localhost:3000/api/v1/documents/search?q=spiritual" | jq '.[] | {score, content: .content[0:100]}'

# Test 2
echo ""
echo "2. Testing specific term..."
curl -s "http://localhost:3000/api/v1/documents/search?q=anger" | jq '.[] | {score, title}'

# Test 3
echo ""
echo "3. Checking total indexed..."
curl -s -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/ai-chatbot-documents/_count" | jq '.count'

echo ""
echo "✅ Testing complete!"
```

### Run the test:
```bash
chmod +x test-search.sh
./test-search.sh
```

## Performance Monitoring

### Check Processing Stats
```bash
# View recent logs
docker logs ai-chatbot-backend --tail 100 | grep "Successfully processed"

# Should show:
# Successfully processed PDF: 2180/2180 chunks with vectors, 2180 indexed
```

### Check System Resources
```bash
# OpenSearch cluster health
curl -s -u "nicknq:Abcd!@#789" \
  "https://search-m2m-lih4h2m6b2ti76wlojy5p2kjoy.ap-southeast-2.es.amazonaws.com/_cluster/health" | jq '.'

# Should show: "status": "green"
```

## Troubleshooting

### If Search Returns Empty []

1. **Check document count:**
```bash
curl -s -u "nicknq:Abcd!@#789" \
  "https://.../ai-chatbot-documents/_count"
```

2. **Check if indexing completed:**
```bash
docker logs ai-chatbot-backend | grep "Successfully processed"
```

3. **Try different search terms:**
```bash
# Use common words from your PDF
curl "http://localhost:3000/api/v1/documents/search?q=the"
```

### If Results Don't Match PDF Content

1. **Check the actual document:**
```bash
# Get a sample document
curl -s -u "nicknq:Abcd!@#789" \
  "https://.../ai-chatbot-documents/_search?size=1" | jq '.hits.hits[0]._source'
```

2. **Verify content field:**
```bash
# Should show text from your PDF
jq '.hits.hits[0]._source.content'
```

## Quick Verification Checklist

- [ ] API search returns results: `curl "http://localhost:3000/api/v1/documents/search?q=test"`
- [ ] OpenSearch shows 2,180 documents: `curl .../count`
- [ ] Results contain PDF content (not random text)
- [ ] Metadata includes your PDF filename
- [ ] Multiple search terms work
- [ ] Chat responds with PDF context
- [ ] Admin CMS shows the document

## Next Steps

### 1. Fine-tune Search
- Adjust search parameters (limit, minScore)
- Test different query types
- Optimize chunk size if needed

### 2. Test RAG Responses
- Ask questions via chat
- Verify AI uses PDF content
- Check citation quality

### 3. Monitor Performance
- Track search latency
- Monitor OpenSearch health
- Check Redis memory usage

## Example Test Session

```bash
# 1. Quick health check
curl "http://localhost:3000/api/health"

# 2. Search for main topics
curl "http://localhost:3000/api/v1/documents/search?q=spiritual+disease"

# 3. Test chat integration
curl -X POST "http://localhost:3000/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the spiritual diseases mentioned?", "sessionId": "test"}'

# 4. Verify counts
curl -s -u "nicknq:password" "https://.../count" | jq '.count'
# Expected: 2180

# 5. Check Redis
curl "http://localhost:3000/api/v1/test/redis-vectors/stats"
```

## Success Criteria

Your PDF search is working correctly if:

✅ Search returns relevant text from your PDF
✅ Multiple search terms find different content
✅ Metadata shows correct source file
✅ Chat AI can reference PDF content
✅ OpenSearch count matches 2,180 documents
✅ Search response time < 500ms
✅ Results have reasonable scores (> 1.0 for good matches)

**Your PDF is now fully searchable and ready for RAG!** 🎉