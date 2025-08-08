#!/usr/bin/env node

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const config = {
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
};

// Models available in ap-southeast-2 to test
const modelsToTest = [
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-3-5-sonnet-20240620-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'anthropic.claude-sonnet-4-20250514-v1:0'
];

async function testModel(modelId) {
  const client = new BedrockRuntimeClient(config);
  console.log(`\nTesting ${modelId}...`);
  
  try {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: "Say 'Hello! I am working.' in exactly 4 words."
        }
      ]
    };
    
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log(`✓ SUCCESS - Model responded: "${responseBody.content[0].text.trim()}"`);
    return { model: modelId, success: true, response: responseBody.content[0].text };
    
  } catch (error) {
    if (error.message.includes("You don't have access")) {
      console.log(`✗ NO ACCESS - You need to request access to this model`);
    } else if (error.message.includes("inference profile")) {
      console.log(`✗ INFERENCE PROFILE REQUIRED - This model needs an inference profile`);
    } else if (error.message.includes("throttled")) {
      console.log(`✓ SUCCESS (rate limited) - Model is accessible`);
      return { model: modelId, success: true, response: 'Rate limited but accessible' };
    } else {
      console.log(`✗ ERROR - ${error.message.substring(0, 80)}...`);
    }
    return { model: modelId, success: false, error: error.message };
  }
}

async function runTests() {
  console.log('Testing Claude Model Access in ap-southeast-2');
  console.log('==============================================');
  
  const results = [];
  
  for (const model of modelsToTest) {
    const result = await testModel(model);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n==============================================');
  console.log('SUMMARY:');
  console.log('==============================================');
  
  const successfulModels = results.filter(r => r.success);
  
  if (successfulModels.length > 0) {
    console.log('\n✓ Models you can use:');
    successfulModels.forEach(r => {
      console.log(`  - ${r.model}`);
    });
    
    console.log('\n✓ Recommended model for your .env file:');
    console.log(`  BEDROCK_MODEL_ID=${successfulModels[0].model}`);
  } else {
    console.log('\n✗ No models are currently accessible.');
    console.log('\nTo fix this:');
    console.log('1. Go to AWS Bedrock Console');
    console.log('2. Navigate to Model Access');
    console.log('3. Request access to Claude models');
    console.log('4. Wait for approval (usually instant)');
    console.log('5. Run this script again');
  }
}

runTests().catch(console.error);