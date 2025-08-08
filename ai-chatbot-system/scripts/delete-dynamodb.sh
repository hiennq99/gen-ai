#!/bin/bash

# Delete DynamoDB tables for AI Chatbot System
# Region: ap-southeast-2 (Sydney)

REGION="ap-southeast-2"

echo "WARNING: This will delete all DynamoDB tables and their data!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo "Deleting DynamoDB tables in ${REGION}..."

# Delete tables
aws dynamodb delete-table --table-name ai-chatbot-conversations --region ${REGION} 2>/dev/null && echo "Deleted ai-chatbot-conversations" || echo "Table ai-chatbot-conversations not found"
aws dynamodb delete-table --table-name ai-chatbot-documents --region ${REGION} 2>/dev/null && echo "Deleted ai-chatbot-documents" || echo "Table ai-chatbot-documents not found"
aws dynamodb delete-table --table-name ai-chatbot-users --region ${REGION} 2>/dev/null && echo "Deleted ai-chatbot-users" || echo "Table ai-chatbot-users not found"
aws dynamodb delete-table --table-name ai-chatbot-qa --region ${REGION} 2>/dev/null && echo "Deleted ai-chatbot-qa" || echo "Table ai-chatbot-qa not found"

echo "DynamoDB tables deletion initiated."