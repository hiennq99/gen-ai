#!/bin/bash

# Setup DynamoDB tables for AI Chatbot System
# Region: ap-southeast-2 (Sydney)

REGION="ap-southeast-2"

echo "Creating DynamoDB tables in ${REGION}..."

# 1. Create Conversations Table
echo "Creating ai-chatbot-conversations table..."
aws dynamodb create-table \
    --table-name ai-chatbot-conversations \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=userId,AttributeType=S \
        AttributeName=createdAt,AttributeType=N \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=UserIdIndex,Keys=[{AttributeName=userId,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

# 2. Create Documents Table
echo "Creating ai-chatbot-documents table..."
aws dynamodb create-table \
    --table-name ai-chatbot-documents \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=type,AttributeType=S \
        AttributeName=createdAt,AttributeType=N \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=TypeIndex,Keys=[{AttributeName=type,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

# 3. Create Users Table
echo "Creating ai-chatbot-users table..."
aws dynamodb create-table \
    --table-name ai-chatbot-users \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=email,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=EmailIndex,Keys=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

# 4. Create Q&A Table
echo "Creating ai-chatbot-qa table..."
aws dynamodb create-table \
    --table-name ai-chatbot-qa \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=category,AttributeType=S \
        AttributeName=createdAt,AttributeType=N \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=CategoryIndex,Keys=[{AttributeName=category,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

echo "Waiting for tables to be created..."

# Wait for tables to be active
aws dynamodb wait table-exists --table-name ai-chatbot-conversations --region ${REGION}
aws dynamodb wait table-exists --table-name ai-chatbot-documents --region ${REGION}
aws dynamodb wait table-exists --table-name ai-chatbot-users --region ${REGION}
aws dynamodb wait table-exists --table-name ai-chatbot-qa --region ${REGION}

echo "All DynamoDB tables created successfully!"

# List all tables to verify
echo -e "\nVerifying tables:"
aws dynamodb list-tables --region ${REGION} | grep -E "ai-chatbot-" || true