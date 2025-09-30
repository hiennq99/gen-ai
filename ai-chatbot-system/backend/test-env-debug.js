#!/usr/bin/env node
require('dotenv').config();

console.log('Environment Variables Debug:\n');
console.log('OPENSEARCH_NODE:', process.env.OPENSEARCH_NODE);
console.log('OPENSEARCH_USERNAME:', process.env.OPENSEARCH_USERNAME);
console.log('OPENSEARCH_PASSWORD:', process.env.OPENSEARCH_PASSWORD);
console.log('OPENSEARCH_PASSWORD (length):', process.env.OPENSEARCH_PASSWORD?.length);
console.log('OPENSEARCH_PASSWORD (hex):', Buffer.from(process.env.OPENSEARCH_PASSWORD || '').toString('hex'));

const auth = Buffer.from(`${process.env.OPENSEARCH_USERNAME}:${process.env.OPENSEARCH_PASSWORD}`).toString('base64');
console.log('\nBase64 Auth:', auth);
console.log('Expected:', 'bmlja25xOkFiY2QhQCM3ODk=');
console.log('Match:', auth === 'bmlja25xOkFiY2QhQCM3ODk=');