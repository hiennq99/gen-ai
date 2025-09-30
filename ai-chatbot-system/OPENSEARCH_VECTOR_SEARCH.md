# OpenSearch Vector Search Implementation

## Current Status

✅ **OpenSearch Connected**: Backend successfully connected to AWS OpenSearch
✅ **Text Search Working**: Keyword-based search is operational
⚠️ **Vector Search**: Currently using text-based search, k-NN needs proper implementation

## Issue Fixed

**Problem**: The search query was using `script_score` with `cosineSimilarity` which caused errors in OpenSearch 3.1.0

**Solution**: Temporarily switched to text-based multi-match search while we implement proper k-NN vector search

## Current Search Implementation

The search now uses:
```javascript
{
  query: {
    bool: {
      should: [
        {
          multi_match: {
            query: "search term",
            fields: ['content^2', 'text^1.5', 'title^3'],
            type: 'best_fields'
          }
        }
      ]
    }
  }
}
```

This provides:
- ✅ Full-text search across content, text, and title fields
- ✅ Weighted scoring (title most important, then content, then text)
- ✅ Works with current OpenSearch 3.1.0 setup
- ❌ Not using vector embeddings yet

## To Implement Proper Vector Search

### Method 1: k-NN Plugin Query (Recommended)

OpenSearch 3.1.0 uses the k-NN plugin with this syntax:

```javascript
// Separate k-NN query (not in bool/should)
{
  "size": 10,
  "query": {
    "knn": {
      "embedding": {
        "vector": [0.1, 0.2, ...],  // 1536 dimensions
        "k": 10
      }
    }
  }
}
```

### Method 2: Hybrid Search (Best Approach)

Combine text search with k-NN:

```javascript
{
  "size": 10,
  "_source": ["title", "content", "metadata"],
  "query": {
    "hybrid": {
      "queries": [
        {
          "multi_match": {
            "query": "search term",
            "fields": ["content", "text", "title"]
          }
        },
        {
          "knn": {
            "embedding": {
              "vector": [0.1, 0.2, ...],
              "k": 10
            }
          }
        }
      ]
    }
  }
}
```

### Method 3: Neural Search (Advanced)

OpenSearch 3.x has neural search capabilities:

```javascript
{
  "query": {
    "neural": {
      "embedding": {
        "query_text": "search term",
        "model_id": "your-model-id",
        "k": 10
      }
    }
  }
}
```

## Implementation Steps

### 1. Update search.service.ts

File: `backend/src/modules/search/search.service.ts`

Find the `searchDocuments` method around line 238 and replace with:

```typescript
async searchDocuments(params: {
  query: string;
  emotion?: string;
  limit?: number;
  minScore?: number;
  exactMatchFirst?: boolean;
}) {
  const { query, emotion, limit = 10, minScore = 0.1 } = params;

  try {
    const node = this.configService.get<string>("opensearch.node");
    if (!node || node.includes('localhost')) {
      return await this.searchDocumentsFromDatabase(params);
    }

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);

    // Use k-NN search
    const response = await this.client.search({
      index: this.indices.documents,
      body: {
        size: limit,
        query: {
          knn: {
            embedding: {
              vector: queryEmbedding,
              k: limit * 2, // Get more results for filtering
            },
          },
        },
        // Optional: Add post-filter for metadata
        ...(emotion && {
          post_filter: {
            term: {
              "metadata.emotion": emotion,
            },
          },
        }),
      },
    });

    return response.body.hits.hits
      .filter((hit: any) => hit._score >= minScore)
      .map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      }));
  } catch (error: any) {
    this.logger.error("Error in k-NN search:", error.message);
    // Fallback to text search
    return await this.textSearchFallback(query, limit);
  }
}

private async textSearchFallback(query: string, limit: number) {
  try {
    const response = await this.client.search({
      index: this.indices.documents,
      body: {
        size: limit,
        query: {
          multi_match: {
            query,
            fields: ['content^2', 'text^1.5', 'title^3'],
            type: 'best_fields',
          },
        },
      },
    });

    return response.body.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      ...hit._source,
    }));
  } catch (error) {
    this.logger.error("Text search fallback failed:", error);
    return [];
  }
}
```

### 2. Test k-NN Search

```bash
# Test with OpenSearch directly
curl -X POST "https://your-domain.es.amazonaws.com/ai-chatbot-documents/_search" \
  -u "nicknq:Abcd!@#789" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 5,
    "query": {
      "knn": {
        "embedding": {
          "vector": [0.1, 0.2, 0.3, ...],
          "k": 5
        }
      }
    }
  }'
```

### 3. Verify Index Mapping

Make sure the index has the correct k-NN field:

```bash
curl -u "nicknq:Abcd!@#789" \
  "https://your-domain.es.amazonaws.com/ai-chatbot-documents/_mapping" | jq .
```

Should show:
```json
{
  "properties": {
    "embedding": {
      "type": "knn_vector",
      "dimension": 1536,
      "method": {
        "name": "hnsw",
        "space_type": "cosinesimil",
        "engine": "lucene"
      }
    }
  }
}
```

## Performance Considerations

### Current Setup (Text Search)
- **Pros**: Fast, reliable, works immediately
- **Cons**: Less accurate for semantic search
- **Speed**: ~10-50ms per query

### With k-NN Vector Search
- **Pros**: Semantic similarity, better relevance
- **Cons**: Slower, requires embeddings
- **Speed**: ~50-200ms per query (depending on dataset size)

### Hybrid Approach (Recommended)
- **Pros**: Best of both worlds
- **Cons**: More complex query
- **Speed**: ~100-300ms per query

## Recommendations

### For Development/Testing
✅ **Current text search is fine** - Fast and reliable for testing

### For Production
1. Implement k-NN vector search for semantic matching
2. Use hybrid search to combine text + vector
3. Cache frequently searched queries
4. Monitor query performance with CloudWatch

## Monitoring k-NN Performance

```bash
# Check k-NN stats
curl -u "nicknq:Abcd!@#789" \
  "https://your-domain.es.amazonaws.com/_plugins/_knn/stats"

# Monitor search latency
curl -u "nicknq:Abcd!@#789" \
  "https://your-domain.es.amazonaws.com/_cat/nodes?v&h=name,search.query_time_in_millis"
```

## Troubleshooting

### k-NN Query Returns No Results
- Check embedding dimension matches (1536)
- Verify documents have embeddings indexed
- Try increasing `k` parameter
- Check for errors in backend logs

### k-NN Query is Slow
- Reduce `k` parameter
- Use approximate search instead of exact
- Consider using FAISS engine (if available)
- Implement query caching

### Embeddings Not Generated
- Check AWS Bedrock permissions
- Verify Titan model access
- Check embedding generation logs
- Ensure document processing completed

## Next Steps

1. ✅ **Keep current text search working** (Done)
2. ⏳ **Test k-NN query directly in OpenSearch**
3. ⏳ **Implement k-NN search in code**
4. ⏳ **Benchmark performance**
5. ⏳ **Implement hybrid search**

## References

- [OpenSearch k-NN Plugin](https://opensearch.org/docs/latest/search-plugins/knn/index/)
- [OpenSearch Neural Search](https://opensearch.org/docs/latest/search-plugins/neural-search/)
- [k-NN Best Practices](https://opensearch.org/docs/latest/search-plugins/knn/performance-tuning/)

---

## Current Status Summary

✅ **Search is Working**: Text-based search operational
✅ **OpenSearch Connected**: All systems integrated
✅ **Indices Created**: Documents and conversations indices ready
⏳ **Vector Search**: Planned for future enhancement

Your system is fully operational with text search. Vector search can be added incrementally without breaking existing functionality.