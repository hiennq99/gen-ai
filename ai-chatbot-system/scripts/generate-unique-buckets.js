#!/usr/bin/env node

const crypto = require('crypto');

// Generate a unique suffix based on AWS account ID hash
const accountId = 'AKIAZOV4ATWPQAKLVCVF';
const suffix = crypto.createHash('md5').update(accountId).digest('hex').substring(0, 8);

const bucketNames = {
  documents: `ai-chatbot-documents-${suffix}`,
  media: `ai-chatbot-media-${suffix}`
};

console.log('Generated unique bucket names:');
console.log('============================');
console.log(`Documents: ${bucketNames.documents}`);
console.log(`Media: ${bucketNames.media}`);
console.log('\nUpdate your .env files with these bucket names.');