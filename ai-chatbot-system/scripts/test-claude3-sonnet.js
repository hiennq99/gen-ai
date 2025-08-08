#!/usr/bin/env node

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

async function testClaude3Sonnet() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'ap-southeast-2',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
  });

  console.log('Testing Claude 3 Sonnet in ap-southeast-2...\n');

  try {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Hello! Please respond with 'Working!' if you can hear me."
        }
      ],
      temperature: 0.5
    };

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    console.log('Sending request to Claude 3 Sonnet...');
    const response = await client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log('\n✅ SUCCESS! Claude 3 Sonnet is working!');
    console.log('Response:', responseBody.content[0].text);
    console.log('\nModel configuration for your .env:');
    console.log('BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0');
    
    return true;
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    
    if (error.message.includes("You don't have access")) {
      console.log('\nTroubleshooting steps:');
      console.log('1. Go to: https://ap-southeast-2.console.aws.amazon.com/bedrock/home?region=ap-southeast-2#/modelaccess');
      console.log('2. Check if Claude 3 Sonnet shows "Access granted"');
      console.log('3. If it shows "Available to request", click it and request access');
      console.log('4. The approval is usually instant, but may take up to 5 minutes');
      console.log('5. Try running this script again after approval');
      
      // Try other regions
      console.log('\nChecking other regions...');
      await testInOtherRegions();
    }
    
    return false;
  }
}

async function testInOtherRegions() {
  const regions = ['us-east-1', 'us-west-2'];
  
  for (const region of regions) {
    console.log(`\nTesting in ${region}...`);
    
    const client = new BedrockRuntimeClient({
      region: region,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      } : undefined
    });
    
    try {
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }]
      };
      
      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });
      
      await client.send(command);
      console.log(`✅ Claude 3 Sonnet works in ${region}!`);
      console.log(`You could change AWS_REGION to ${region} in your .env file`);
      return true;
    } catch (error) {
      console.log(`❌ ${region}: ${error.message.substring(0, 50)}...`);
    }
  }
}

testClaude3Sonnet();