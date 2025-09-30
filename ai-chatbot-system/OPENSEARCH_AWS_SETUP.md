# AWS OpenSearch Setup Guide

## 1. Create OpenSearch Domain via AWS Console

### Step 1: Navigate to OpenSearch Service
1. Log in to AWS Console
2. Search for "OpenSearch Service" or go to: https://console.aws.amazon.com/aos/
3. Click **"Create domain"**

### Step 2: Configure Domain
```
Domain name: ai-chatbot-opensearch
Deployment type: Development and testing (for dev) or Production (for prod)
Version: OpenSearch 2.11 (or latest)
```

### Step 3: Choose Instance Configuration

**For Development/Testing:**
```
Instance type: t3.small.search (1 vCPU, 2 GiB RAM)
Number of nodes: 1
Storage: 10 GB EBS (gp3)
```

**For Production:**
```
Instance type: t3.medium.search or r6g.large.search
Number of nodes: 3 (for high availability)
Dedicated master nodes: 3 x t3.small.search
Storage: 50-100 GB EBS (gp3)
Enable Multi-AZ: Yes
```

### Step 4: Configure Network

**Option A: Public Access (Easier for Development)**
```
Network: Public access
Access policy: Custom access policy (see below)
```

**Option B: VPC Access (Recommended for Production)**
```
Network: VPC access
VPC: Select your VPC
Subnets: Select subnets in different AZs
Security groups: Create new or use existing
```

### Step 5: Fine-grained Access Control
```
☑ Enable fine-grained access control
Master username: admin
Master password: <create-strong-password>
```

### Step 6: Access Policy

**For Public Access (Development):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:REGION:ACCOUNT_ID:domain/ai-chatbot-opensearch/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": [
            "YOUR_IP_ADDRESS/32",
            "YOUR_EC2_IP/32"
          ]
        }
      }
    }
  ]
}
```

**For VPC Access (Production):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:REGION:ACCOUNT_ID:domain/ai-chatbot-opensearch/*"
    }
  ]
}
```

### Step 7: Additional Settings
```
Encryption at rest: Enable
Node-to-node encryption: Enable
Require HTTPS: Enable
Auto-Tune: Enable (optional)
```

### Step 8: Create Domain
- Review settings
- Click **"Create"**
- Wait 15-30 minutes for domain creation

---

## 2. Get OpenSearch Endpoint

After domain is created:
1. Go to OpenSearch Service → Domains
2. Click on your domain name
3. Copy the **Domain endpoint** (looks like: `https://search-ai-chatbot-opensearch-xxxxx.region.es.amazonaws.com`)

---

## 3. Configure Application Environment Variables

### Backend `.env` file:

```bash
# OpenSearch Configuration
OPENSEARCH_NODE=https://search-ai-chatbot-opensearch-xxxxx.ap-southeast-2.es.amazonaws.com
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-master-password
OPENSEARCH_DOCUMENTS_INDEX=ai-chatbot-documents
OPENSEARCH_CONVERSATIONS_INDEX=ai-chatbot-conversations

# AWS Credentials (if using VPC or programmatic access)
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

---

## 4. Test Connection

### Method 1: Using curl
```bash
curl -XGET "https://search-ai-chatbot-opensearch-xxxxx.region.es.amazonaws.com/_cluster/health" \
  -u "admin:your-password"
```

### Method 2: Using your application
```bash
# Start backend
npm run dev

# Check logs for:
# [SearchService] info: Created index: ai-chatbot-documents
# [SearchService] info: Created index: ai-chatbot-conversations
```

### Method 3: Test endpoint
```bash
curl http://localhost:3000/api/health
```

---

## 5. Create Indices Manually (Optional)

If auto-creation doesn't work, create indices manually:

```bash
# Create documents index
curl -XPUT "https://your-domain.region.es.amazonaws.com/ai-chatbot-documents" \
  -u "admin:password" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "documentId": { "type": "keyword" },
        "content": { "type": "text" },
        "text": { "type": "text" },
        "title": { "type": "text" },
        "embedding": {
          "type": "dense_vector",
          "dims": 1536,
          "index": true,
          "similarity": "cosine"
        },
        "metadata": {
          "type": "object",
          "properties": {
            "type": { "type": "keyword" },
            "question": { "type": "text" },
            "answer": { "type": "text" },
            "emotion": { "type": "keyword" },
            "category": { "type": "keyword" },
            "sourceFile": { "type": "keyword" },
            "sourceType": { "type": "keyword" },
            "pageNumber": { "type": "integer" },
            "chunkIndex": { "type": "integer" }
          }
        },
        "createdAt": { "type": "date" }
      }
    }
  }'

# Create conversations index
curl -XPUT "https://your-domain.region.es.amazonaws.com/ai-chatbot-conversations" \
  -u "admin:password" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "sessionId": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "message": { "type": "text" },
        "response": { "type": "text" },
        "emotion": { "type": "keyword" },
        "timestamp": { "type": "date" }
      }
    }
  }'
```

---

## 6. Security Best Practices

### For Development:
- ✅ Use IP-based access control
- ✅ Strong master password
- ✅ Enable HTTPS

### For Production:
- ✅ Use VPC access (no public endpoint)
- ✅ Enable fine-grained access control
- ✅ Use IAM roles instead of username/password
- ✅ Enable encryption at rest and in transit
- ✅ Set up CloudWatch alarms
- ✅ Enable audit logs
- ✅ Use AWS Secrets Manager for credentials

---

## 7. IAM Role Setup (Production - Recommended)

### Create IAM Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "es:ESHttpGet",
        "es:ESHttpPost",
        "es:ESHttpPut",
        "es:ESHttpDelete",
        "es:ESHttpHead"
      ],
      "Resource": "arn:aws:es:REGION:ACCOUNT_ID:domain/ai-chatbot-opensearch/*"
    }
  ]
}
```

### Attach to EC2 Role or ECS Task Role:
1. Go to IAM → Roles
2. Find your EC2/ECS role
3. Attach the policy created above

### Update Domain Access Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:role/YOUR_EC2_ROLE"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:REGION:ACCOUNT_ID:domain/ai-chatbot-opensearch/*"
    }
  ]
}
```

---

## 8. Monitoring and Maintenance

### CloudWatch Metrics to Monitor:
- `ClusterStatus.red` - Should be 0
- `ClusterStatus.yellow` - Monitor
- `SearchableDocuments` - Track document count
- `FreeStorageSpace` - Set alarm at 20% threshold
- `CPUUtilization` - Set alarm at 80%
- `JVMMemoryPressure` - Set alarm at 80%

### Enable Logs:
```
Error logs: Enable
Search slow logs: Enable (threshold: 5s)
Index slow logs: Enable (threshold: 10s)
Audit logs: Enable (production)
```

---

## 9. Cost Optimization

### Development:
- Use t3.small.search (single node)
- 10 GB storage
- **Estimated cost: ~$30-40/month**

### Production:
- Use reserved instances (save 30-50%)
- Right-size based on usage
- Set up auto-scaling
- Delete old indices regularly

---

## 10. Troubleshooting

### Connection Issues:
```bash
# Check domain status
aws opensearch describe-domain --domain-name ai-chatbot-opensearch

# Test from EC2/local
curl -v https://your-domain.region.es.amazonaws.com/_cluster/health \
  -u "admin:password"

# Check backend logs
docker logs ai-chatbot-backend | grep OpenSearch
```

### Common Errors:
1. **403 Forbidden** → Check access policy and IP whitelist
2. **Connection timeout** → Check security group / VPC settings
3. **503 Service Unavailable** → Domain is still initializing
4. **Red cluster status** → Check node health, storage space

---

## 11. Next Steps

After OpenSearch is configured:

1. ✅ Upload training documents via Admin CMS
2. ✅ Verify indices are created
3. ✅ Test document search: `http://localhost:3000/api/documents/search?q=test`
4. ✅ Monitor CloudWatch metrics
5. ✅ Set up automated backups (snapshots)

---

## Quick Setup Script

```bash
#!/bin/bash
# Quick OpenSearch domain creation using AWS CLI

DOMAIN_NAME="ai-chatbot-opensearch"
REGION="ap-southeast-2"
INSTANCE_TYPE="t3.small.search"
VOLUME_SIZE=10

aws opensearch create-domain \
  --domain-name $DOMAIN_NAME \
  --engine-version "OpenSearch_2.11" \
  --cluster-config \
    InstanceType=$INSTANCE_TYPE,InstanceCount=1 \
  --ebs-options \
    EBSEnabled=true,VolumeType=gp3,VolumeSize=$VOLUME_SIZE \
  --access-policies '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "*"},
      "Action": "es:*",
      "Resource": "arn:aws:es:'$REGION':*:domain/'$DOMAIN_NAME'/*"
    }]
  }' \
  --advanced-security-options \
    Enabled=true,InternalUserDatabaseEnabled=true,MasterUserOptions={MasterUserName=admin,MasterUserPassword=YourPassword123!} \
  --node-to-node-encryption-options Enabled=true \
  --encryption-at-rest-options Enabled=true \
  --domain-endpoint-options EnforceHTTPS=true \
  --region $REGION

echo "Domain creation started. Check status with:"
echo "aws opensearch describe-domain --domain-name $DOMAIN_NAME --region $REGION"
```

---

## Support

- 📚 AWS OpenSearch Documentation: https://docs.aws.amazon.com/opensearch-service/
- 💬 OpenSearch Forums: https://forum.opensearch.org/
- 🐛 Issues: Check backend logs and CloudWatch