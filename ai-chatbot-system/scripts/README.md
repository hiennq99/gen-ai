# DynamoDB Setup Scripts

## Setup Tables

To create all required DynamoDB tables in ap-southeast-2 region:

```bash
./setup-dynamodb.sh
```

This will create the following tables:
- `ai-chatbot-conversations` - Stores chat conversations
- `ai-chatbot-documents` - Stores document metadata
- `ai-chatbot-users` - Stores user information
- `ai-chatbot-qa` - Stores Q&A pairs

Each table is configured with:
- Pay-per-request billing mode (no need to manage capacity)
- Global Secondary Indexes for efficient queries
- Appropriate partition and sort keys

## Manual Setup (Alternative)

If you prefer to set up tables manually or one at a time:

### 1. Conversations Table
```bash
aws dynamodb create-table \
    --table-name ai-chatbot-conversations \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-2
```

### 2. Documents Table
```bash
aws dynamodb create-table \
    --table-name ai-chatbot-documents \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-2
```

### 3. Users Table
```bash
aws dynamodb create-table \
    --table-name ai-chatbot-users \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-2
```

### 4. Q&A Table
```bash
aws dynamodb create-table \
    --table-name ai-chatbot-qa \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-2
```

## Verify Tables

To check if tables were created successfully:

```bash
aws dynamodb list-tables --region ap-southeast-2
```

To describe a specific table:

```bash
aws dynamodb describe-table \
    --table-name ai-chatbot-conversations \
    --region ap-southeast-2
```

## Delete Tables

To delete all tables (WARNING: This will delete all data):

```bash
./delete-dynamodb.sh
```

## AWS Console Alternative

You can also create tables through the AWS Console:

1. Go to [DynamoDB Console](https://ap-southeast-2.console.aws.amazon.com/dynamodbv2/)
2. Click "Create table"
3. For each table:
   - Enter the table name
   - Set partition key as `id` (String)
   - Choose "On-demand" for capacity mode
   - Click "Create table"

## Cost Considerations

Using PAY_PER_REQUEST (On-demand) billing mode:
- No upfront costs
- Pay only for the reads/writes you use
- Automatically scales up and down
- Good for unpredictable workloads

Pricing (Sydney region):
- Write requests: $1.525 per million writes
- Read requests: $0.305 per million reads
- Storage: $0.305 per GB per month

## Troubleshooting

### Permission Denied
Make sure your AWS credentials have the following permissions:
- `dynamodb:CreateTable`
- `dynamodb:DescribeTable`
- `dynamodb:ListTables`
- `dynamodb:DeleteTable` (for cleanup)

### Table Already Exists
If you get an error that table already exists, you can:
1. Use a different table name (update .env file)
2. Delete the existing table first (use delete script)
3. Use the existing table as-is

### Region Issues
Ensure your AWS CLI is configured for ap-southeast-2:
```bash
aws configure get region
# Should output: ap-southeast-2

# To set region:
aws configure set region ap-southeast-2
```