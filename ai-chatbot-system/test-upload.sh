#!/bin/bash

echo "Testing Document Upload"
echo "====================="

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

echo "Got token: ${TOKEN:0:20}..."

# Create a test text file
echo "This is a test document for the AI chatbot system.
It contains sample content to test the document upload functionality.
The system should be able to process this text file." > test-document.txt

# Upload the document
echo -e "\nUploading test document..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.txt" \
  -F 'title=Test Document' \
  -F 'metadata={"category":"test","tags":["sample","test"]}')

echo "Response:"
echo "$RESPONSE" | jq .

# Clean up
rm test-document.txt

echo -e "\nTest complete!"