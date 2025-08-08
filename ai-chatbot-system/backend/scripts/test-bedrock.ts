import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

async function testBedrockConnection() {
  console.log('🔧 Testing AWS Bedrock Connection...\n');
  
  // Check required environment variables
  const requiredVars = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'BEDROCK_MODEL_ID'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('\nPlease ensure your .env file contains:');
    requiredVars.forEach(v => console.log(`  ${v}=your_value_here`));
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');
  console.log(`   Region: ${process.env.AWS_REGION}`);
  console.log(`   Model: ${process.env.BEDROCK_MODEL_ID}\n`);

  // Initialize Bedrock client
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    console.log('📡 Sending test message to Claude...\n');
    
    const prompt = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Hello! Please respond with a simple greeting to confirm the connection is working.',
      }],
      temperature: 0.7,
    };

    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(prompt),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('✅ Successfully connected to AWS Bedrock!');
    console.log('\n📝 Claude\'s response:');
    console.log('   ', responseBody.content[0].text);
    
    if (responseBody.usage) {
      console.log('\n📊 Token usage:');
      console.log(`   Input tokens: ${responseBody.usage.input_tokens}`);
      console.log(`   Output tokens: ${responseBody.usage.output_tokens}`);
    }
    
    console.log('\n🎉 Bedrock integration test completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Failed to connect to AWS Bedrock:\n');
    
    if (error.name === 'AccessDeniedException') {
      console.error('   Access Denied: Check your AWS credentials and Bedrock permissions');
      console.error('   Make sure your AWS account has access to the Claude model');
    } else if (error.name === 'ResourceNotFoundException') {
      console.error('   Model not found: Check the BEDROCK_MODEL_ID in your .env file');
      console.error('   Available Claude models:');
      console.error('   - anthropic.claude-3-sonnet-20240229-v1:0');
      console.error('   - anthropic.claude-3-haiku-20240307-v1:0');
      console.error('   - anthropic.claude-instant-v1');
    } else if (error.name === 'ValidationException') {
      console.error('   Validation error:', error.message);
      console.error('   Check your request format and parameters');
    } else {
      console.error('   Error:', error.message || error);
    }
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Verify your AWS credentials are correct');
    console.log('   2. Ensure your AWS account has Bedrock access enabled');
    console.log('   3. Check that the model ID is correct for your region');
    console.log('   4. Verify your IAM user/role has the bedrock:InvokeModel permission');
    
    process.exit(1);
  }
}

// Run the test
testBedrockConnection().catch(console.error);