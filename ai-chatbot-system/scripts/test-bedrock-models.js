#!/usr/bin/env node

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const config = {
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
};

// Different Claude model IDs to test
const models = [
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-instant-v1',
  'anthropic.claude-v2:1',
  'anthropic.claude-v2'
];

async function testModel(modelId) {
  const client = new BedrockRuntimeClient(config);
  
  try {
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
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });
    
    await client.send(command);
    console.log(`✓ ${modelId} - Available`);
    return true;
  } catch (error) {
    if (error.message.includes('throttled')) {
      console.log(`✓ ${modelId} - Available (rate limited)`);
      return true;
    } else {
      console.log(`✗ ${modelId} - ${error.message.substring(0, 50)}...`);
      return false;
    }
  }
}

async function checkCrossRegion() {
  console.log('\nTesting US East 1 region (cross-region inference):');
  const usClient = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: config.credentials
  });
  
  try {
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
    
    const response = await usClient.send(command);
    console.log('✓ Claude 3 Sonnet available in us-east-1');
    
    // Parse and show response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log('✓ Model responded successfully');
    return true;
  } catch (error) {
    console.log(`✗ US East 1: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Testing Bedrock Model Availability');
  console.log('===================================\n');
  console.log('Testing in ap-southeast-2:');
  
  let anyAvailable = false;
  for (const model of models) {
    const available = await testModel(model);
    if (available) anyAvailable = true;
  }
  
  if (!anyAvailable) {
    console.log('\nNo models available in ap-southeast-2.');
    await checkCrossRegion();
  }
  
  console.log('\n===================================');
  console.log('Note: If models are not available in ap-southeast-2,');
  console.log('you may need to use us-east-1 or another region where');
  console.log('Claude models are available.');
}

runTests().catch(console.error);