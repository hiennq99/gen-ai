#!/usr/bin/env node

const { S3Client, CreateBucketCommand, PutBucketCorsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const config = {
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
};

const client = new S3Client(config);

const buckets = [
  'ai-chatbot-documents-a354f3e7',
  'ai-chatbot-media-a354f3e7'
];

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000
    }
  ]
};

async function bucketExists(bucketName) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function createBucket(bucketName) {
  try {
    // Check if bucket exists
    const exists = await bucketExists(bucketName);
    if (exists) {
      console.log(`✓ Bucket ${bucketName} already exists`);
      return;
    }

    // Create bucket with location constraint for ap-southeast-2
    console.log(`Creating bucket ${bucketName}...`);
    await client.send(new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration: {
        LocationConstraint: 'ap-southeast-2'
      }
    }));
    console.log(`✓ Bucket ${bucketName} created`);

    // Set CORS configuration
    console.log(`Setting CORS for ${bucketName}...`);
    await client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration
    }));
    console.log(`✓ CORS configured for ${bucketName}`);

  } catch (error) {
    if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`✓ Bucket ${bucketName} already exists`);
    } else {
      console.error(`✗ Error creating bucket ${bucketName}:`, error.message);
      throw error;
    }
  }
}

async function setupS3() {
  console.log('Setting up S3 buckets in ap-southeast-2...\n');
  
  try {
    for (const bucketName of buckets) {
      await createBucket(bucketName);
    }
    
    console.log('\n✓ All S3 buckets setup completed!');
    
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }
}

setupS3();