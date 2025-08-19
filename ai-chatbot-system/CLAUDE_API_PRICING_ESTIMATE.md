# Claude API Pricing Estimation for AI Chatbot System

## Current Configuration
- **Model**: Claude 3 Sonnet (via AWS Bedrock)
- **Model ID**: `anthropic.claude-3-sonnet-20240229-v1:0`
- **Max Tokens**: 4,096 per response
- **Region**: ap-southeast-2 (Sydney)

## Claude 3 Sonnet Pricing (AWS Bedrock)
As of 2024, Claude 3 Sonnet pricing on AWS Bedrock:
- **Input**: $0.003 per 1,000 tokens
- **Output**: $0.015 per 1,000 tokens

## Token Usage Analysis

### Per Message Breakdown
Based on your `chat.service.ts` implementation:

1. **Input Tokens per Request**:
   - User message: ~50-200 tokens (average: 100)
   - System prompt: ~500 tokens
   - Context from search results: ~500-2,000 tokens
   - Conversation history (5 messages): ~500-1,000 tokens
   - **Total Input**: ~1,600-3,700 tokens per request

2. **Output Tokens per Response**:
   - Response content: ~200-1,000 tokens (average: 500)
   - **Total Output**: ~500 tokens per response

### Cost Per Message
- **Average Input Cost**: 2,650 tokens × $0.003/1K = $0.00795
- **Average Output Cost**: 500 tokens × $0.015/1K = $0.0075
- **Total per Message**: ~$0.01545

## Monthly Cost Projections

### Low Usage (Small Business/Startup)
- **Daily Messages**: 100
- **Monthly Messages**: 3,000
- **Monthly Cost**: 3,000 × $0.01545 = **$46.35**

### Medium Usage (Growing Business)
- **Daily Messages**: 500
- **Monthly Messages**: 15,000
- **Monthly Cost**: 15,000 × $0.01545 = **$231.75**

### High Usage (Enterprise)
- **Daily Messages**: 2,000
- **Monthly Messages**: 60,000
- **Monthly Cost**: 60,000 × $0.01545 = **$927.00**

### Very High Usage (Large Enterprise)
- **Daily Messages**: 10,000
- **Monthly Messages**: 300,000
- **Monthly Cost**: 300,000 × $0.01545 = **$4,635.00**

## Cost Optimization Strategies

### 1. Caching (Already Implemented)
Your system caches responses for 1 hour when emotion confidence > 80%:
- **Potential Savings**: 20-30% for repeated questions
- **Estimated Impact**: Reduce costs by ~25%

### 2. Exact Match Mode (Already Implemented)
Returns documents directly without Claude API when relevance > 65%:
- **Potential Savings**: 40-60% of requests don't use Claude
- **Estimated Impact**: Reduce costs by ~50%

### 3. Token Optimization Opportunities

#### Reduce Context Window
```typescript
// Current: MAX_CONTEXT_LENGTH = 10000
// Suggested: 5000 for most cases
private readonly MAX_CONTEXT_LENGTH = 5000;
```
**Savings**: ~20% on input tokens

#### Limit Conversation History
```typescript
// Current: Last 5 messages
// Suggested: Last 3 messages for most cases
history.slice(-3).forEach(h => {
  messages.push({ role: 'user', content: h.userMessage });
  messages.push({ role: 'assistant', content: h.assistantMessage });
});
```
**Savings**: ~10% on input tokens

#### Compress System Prompts
- Current system prompt: ~500 tokens
- Optimized: ~300 tokens
**Savings**: ~10% on input tokens

### 4. Alternative Models for Cost Reduction

#### Claude 3 Haiku (Faster & Cheaper)
- **Input**: $0.00025 per 1K tokens (92% cheaper)
- **Output**: $0.00125 per 1K tokens (92% cheaper)
- **Use Case**: Simple queries, FAQs, basic conversations
- **Monthly Cost (Medium Usage)**: ~$18.54 (vs $231.75)

#### Hybrid Approach
- Use Claude 3 Haiku for simple/emotional responses
- Use Claude 3 Sonnet for complex/technical queries
- **Estimated Savings**: 60-70%

## Revised Cost Estimates with Optimizations

### With Current Optimizations (Caching + Exact Match)
Assuming 50% of requests use exact match and 25% hit cache:
- **Effective Messages Using Claude**: 37.5% of total
- **Monthly Cost (Medium Usage)**: 15,000 × 37.5% × $0.01545 = **$86.91**

### With All Optimizations
Including token reduction (30% savings) + hybrid model approach:
- **Monthly Cost (Medium Usage)**: **~$30-50**

## Implementation Recommendations

### 1. Immediate Actions (No Code Changes)
- Monitor actual token usage via CloudWatch
- Track cache hit rates
- Measure exact match usage percentage

### 2. Quick Wins (Minor Code Changes)
```typescript
// Add to .env
BEDROCK_MODEL_ID_SIMPLE=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_MODEL_ID_COMPLEX=anthropic.claude-3-sonnet-20240229-v1:0

// In bedrock.service.ts, choose model based on complexity
const modelId = this.isComplexQuery(request) 
  ? this.complexModelId 
  : this.simpleModelId;
```

### 3. Advanced Optimizations
- Implement request batching
- Add user-based rate limiting
- Implement progressive context loading
- Use embedding-based semantic cache

## 5,000 Active Users Scenario

### User Behavior Assumptions
- **Daily Active Users (DAU)**: 30% of total = 1,500 users
- **Messages per active user per day**: 5-10 messages
- **Total daily messages**: 7,500-15,000
- **Monthly messages**: 225,000-450,000

### Cost Breakdown for 5,000 Users

#### Light Usage (5 messages/user/day)
- **Monthly Messages**: 225,000
- **Base Cost**: 225,000 × $0.01545 = **$3,476.25**
- **With Current Optimizations (62.5% reduction)**: **$1,303.59**
- **With All Optimizations (80-85% reduction)**: **$450-695**

#### Moderate Usage (7 messages/user/day)
- **Monthly Messages**: 315,000
- **Base Cost**: 315,000 × $0.01545 = **$4,866.75**
- **With Current Optimizations**: **$1,825.03**
- **With All Optimizations**: **$630-973**

#### Heavy Usage (10 messages/user/day)
- **Monthly Messages**: 450,000
- **Base Cost**: 450,000 × $0.01545 = **$6,952.50**
- **With Current Optimizations**: **$2,607.19**
- **With All Optimizations**: **$900-1,390**

### Cost Per User Analysis
| Usage Pattern | Messages/Month/User | Cost/User/Month | With Opt. |
|--------------|-------------------|-----------------|-----------|
| Light (5/day) | 45 | $0.69 | $0.09-0.14 |
| Moderate (7/day) | 63 | $0.97 | $0.13-0.19 |
| Heavy (10/day) | 90 | $1.39 | $0.18-0.28 |

## Budget Planning Table

| Usage Tier | Users | Messages/Month | Base Cost | With Current Opt. | With All Opt. |
|------------|-------|---------------|-----------|-------------------|---------------|
| Startup    | 100   | 3,000         | $46       | $17               | $6-10         |
| Small Biz  | 500   | 10,000        | $155      | $58               | $20-35        |
| Medium Biz | 1,000 | 30,000        | $464      | $174              | $60-100       |
| Growing    | 5,000 | 315,000       | $4,867    | $1,825            | $630-973      |
| Enterprise | 10,000| 630,000       | $9,734    | $3,650            | $1,260-1,947  |
| Large Ent. | 50,000| 3,150,000     | $48,668   | $18,250           | $6,300-9,734  |

## Monitoring & Alerts

### Set Up Cost Alerts
```bash
# AWS CLI command to create billing alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "Bedrock-Claude-Monthly-Cost" \
  --alarm-description "Alert when Bedrock costs exceed threshold" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

### Track Usage Metrics
```typescript
// Add to chat.service.ts
private async logTokenUsage(response: any): Promise<void> {
  const usage = {
    timestamp: new Date(),
    inputTokens: response.usage?.inputTokens || 0,
    outputTokens: response.usage?.outputTokens || 0,
    estimatedCost: this.calculateCost(response.usage),
    modelId: response.modelId,
  };
  
  await this.databaseService.saveTokenUsage(usage);
  this.logger.log(`Token usage: ${JSON.stringify(usage)}`);
}

private calculateCost(usage: any): number {
  const inputCost = (usage.inputTokens / 1000) * 0.003;
  const outputCost = (usage.outputTokens / 1000) * 0.015;
  return inputCost + outputCost;
}
```

## Pricing Strategy for 5,000 Users

### Subscription Pricing Recommendations

#### Option 1: Flat Monthly Subscription
- **Price per user**: $2.99-4.99/month
- **Monthly Revenue**: $14,950-24,950
- **API Costs**: $630-1,825
- **Gross Margin**: 85-96%

#### Option 2: Tiered Pricing
| Tier | Messages/Month | Price/Month | Users (est.) | Revenue |
|------|---------------|-------------|--------------|---------|
| Basic | Up to 50 | $1.99 | 2,000 | $3,980 |
| Standard | Up to 150 | $4.99 | 2,500 | $12,475 |
| Premium | Unlimited | $9.99 | 500 | $4,995 |
| **Total** | | | **5,000** | **$21,450** |

#### Option 3: Usage-Based Pricing
- **Free tier**: 10 messages/month
- **Pay-as-you-go**: $0.05 per message after free tier
- **Estimated Revenue**: $10,000-15,000/month
- **Best for**: Variable usage patterns

### Infrastructure Scaling Considerations for 5,000 Users

#### Required AWS Resources
- **DynamoDB**: ~$50-100/month (on-demand pricing)
- **S3 Storage**: ~$25-50/month 
- **OpenSearch**: ~$200-400/month (t3.medium.search instance)
- **Redis Cache**: ~$50-100/month (cache.t3.micro)
- **CloudFront CDN**: ~$50-100/month
- **Total Infrastructure**: ~$375-750/month

### Total Operating Costs (5,000 users)
- **Claude API**: $630-1,825/month
- **AWS Infrastructure**: $375-750/month
- **Total**: $1,005-2,575/month
- **Cost per user**: $0.20-0.52/month

## Conclusion

**For 5,000 Active Users** (Moderate Usage - 7 messages/day):
- Without optimizations: **$4,867/month**
- With current optimizations: **$1,825/month**
- With all recommended optimizations: **$630-973/month**

**Key Recommendations for 5,000 Users**:
1. **Implement tiered model selection immediately** - Use Haiku for 70-80% of queries
2. **Set up usage quotas** - Limit heavy users to control costs
3. **Implement subscription pricing** at $2.99-4.99/user for healthy margins
4. **Monitor per-user costs** closely - identify and manage outliers
5. **Consider bulk pricing** with AWS for volume discounts

**ROI Analysis**:
- **Total monthly costs**: $1,005-2,575
- **Recommended pricing**: $3-5/user
- **Potential revenue**: $15,000-25,000/month
- **Profit margin**: 80-90%
- **Break-even**: 335-860 paying users (7-17% conversion needed)