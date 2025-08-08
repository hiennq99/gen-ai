#!/usr/bin/env node

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const config = {
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
};

async function testDynamoDB() {
  console.log('Testing DynamoDB connection...');
  const client = new DynamoDBClient(config);
  
  try {
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    const aiTables = response.TableNames.filter(name => name.startsWith('ai-chatbot-'));
    console.log('✓ DynamoDB connected. Found tables:', aiTables);
    return true;
  } catch (error) {
    console.error('✗ DynamoDB connection failed:', error.message);
    return false;
  }
}

async function testS3() {
  console.log('\nTesting S3 connection...');
  const client = new S3Client(config);
  
  try {
    const command = new ListBucketsCommand({});
    const response = await client.send(command);
    console.log('✓ S3 connected. Found', response.Buckets.length, 'buckets');
    
    const aiBuckets = response.Buckets.filter(bucket => 
      bucket.Name.includes('ai-chatbot')
    ).map(b => b.Name);
    
    if (aiBuckets.length > 0) {
      console.log('  AI Chatbot buckets:', aiBuckets);
    } else {
      console.log('  Note: No ai-chatbot buckets found yet. You need to create them.');
    }
    return true;
  } catch (error) {
    console.error('✗ S3 connection failed:', error.message);
    return false;
  }
}

async function testBedrock() {
  console.log('\nTesting Bedrock connection...');
  const client = new BedrockRuntimeClient(config);
  
  try {
    // Test with a minimal prompt
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Hi"
        }
      ]
    };
    
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });
    
    const response = await client.send(command);
    console.log('✓ Bedrock connected. Claude model is accessible.');
    return true;
  } catch (error) {
    if (error.message.includes('throttled')) {
      console.log('⚠ Bedrock connection OK but rate limited (this is normal)');
      return true;
    } else if (error.message.includes('Could not resolve the foundation model')) {
      console.error('✗ Bedrock: Claude model not available in ap-southeast-2');
      console.log('  You may need to:');
      console.log('  1. Enable model access in AWS Bedrock console');
      console.log('  2. Check if Claude is available in ap-southeast-2');
      return false;
    } else {
      console.error('✗ Bedrock connection failed:', error.message);
      return false;
    }
  }
}

async function runTests() {
  console.log('AWS Services Connection Test');
  console.log('============================\n');
  
  const results = {
    dynamodb: await testDynamoDB(),
    s3: await testS3(),
    bedrock: await testBedrock()
  };
  
  console.log('\n============================');
  console.log('Test Results Summary:');
  console.log('DynamoDB:', results.dynamodb ? '✓ Connected' : '✗ Failed');
  console.log('S3:', results.s3 ? '✓ Connected' : '✗ Failed');
  console.log('Bedrock:', results.bedrock ? '✓ Connected' : '✗ Failed');
  
  if (Object.values(results).every(r => r)) {
    console.log('\n✓ All AWS services are properly configured!');
  } else {
    console.log('\n⚠ Some services need configuration. Check the errors above.');
  }
}

runTests().catch(console.error);