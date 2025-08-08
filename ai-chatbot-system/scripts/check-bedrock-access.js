#!/usr/bin/env node

const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');

const regions = ['ap-southeast-2', 'us-east-1', 'us-west-2'];

async function checkRegion(region) {
  console.log(`\nChecking ${region}:`);
  console.log('=' . repeat(40));
  
  const client = new BedrockClient({
    region: region,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    } : undefined
  });
  
  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    
    const claudeModels = response.modelSummaries
      .filter(model => model.modelId.includes('claude'))
      .map(model => ({
        id: model.modelId,
        name: model.modelName,
        provider: model.providerName
      }));
    
    if (claudeModels.length > 0) {
      console.log('Available Claude models:');
      claudeModels.forEach(model => {
        console.log(`  - ${model.id}`);
        console.log(`    Name: ${model.name}`);
      });
    } else {
      console.log('No Claude models available in this region');
    }
    
    return claudeModels;
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return [];
  }
}

async function checkAllRegions() {
  console.log('AWS Bedrock Claude Model Availability Check');
  console.log('============================================');
  
  const results = {};
  for (const region of regions) {
    results[region] = await checkRegion(region);
  }
  
  console.log('\n============================================');
  console.log('Summary:');
  
  let hasAccess = false;
  for (const [region, models] of Object.entries(results)) {
    if (models.length > 0) {
      console.log(`✓ ${region}: ${models.length} Claude model(s) available`);
      hasAccess = true;
    } else {
      console.log(`✗ ${region}: No Claude models available`);
    }
  }
  
  if (!hasAccess) {
    console.log('\n⚠️  No Claude models found. This could mean:');
    console.log('1. Model access request is still being processed (wait a few minutes)');
    console.log('2. You need to accept the End User License Agreement (EULA) in the console');
    console.log('3. Models are not available in these regions for your account');
    console.log('\nPlease check the AWS Bedrock console and ensure you have:');
    console.log('1. Submitted the model access request');
    console.log('2. Received approval confirmation');
    console.log('3. Accepted any required agreements');
  }
}

checkAllRegions().catch(console.error);