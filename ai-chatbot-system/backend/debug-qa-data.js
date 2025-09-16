// Simple debug script to check Q&A data without NestJS
console.log('🧪 Debugging Q&A Data Issues...\n');

// Check if the test data is still in our database service file
const fs = require('fs');
const path = require('path');

const databaseServicePath = path.join(__dirname, 'src/modules/database/database.service.ts');

console.log('📁 Checking database service file for Q&A data...');

if (fs.existsSync(databaseServicePath)) {
  const content = fs.readFileSync(databaseServicePath, 'utf8');

  // Check if loadTestQAData method exists
  if (content.includes('loadTestQAData')) {
    console.log('✅ Found loadTestQAData method in database service');

    // Check if it's being called
    if (content.includes('this.loadTestQAData()')) {
      console.log('✅ loadTestQAData is being called in constructor');
    } else {
      console.log('❌ loadTestQAData is NOT being called in constructor');
    }

    // Count Q&A items
    const qaItems = content.match(/\{\s*"id":\s*"[^"]+",\s*"question":/g);
    if (qaItems) {
      console.log(`✅ Found ${qaItems.length} Q&A items in the method`);
    } else {
      console.log('❌ No Q&A items found in loadTestQAData method');
    }

  } else {
    console.log('❌ loadTestQAData method NOT found in database service');
  }

} else {
  console.log('❌ Database service file not found');
}

console.log('\n🔍 Checking search service for similarity calculation...');

const searchServicePath = path.join(__dirname, 'src/modules/search/search.service.ts');

if (fs.existsSync(searchServicePath)) {
  const content = fs.readFileSync(searchServicePath, 'utf8');

  if (content.includes('calculateSemanticCoreMatch')) {
    console.log('✅ Enhanced semantic matching methods found');
  } else {
    console.log('❌ Enhanced semantic matching methods NOT found');
  }

  if (content.includes('threshold = 0.55')) {
    console.log('✅ Lowered threshold (0.55) found');
  } else {
    console.log('❌ Threshold not lowered properly');
  }

} else {
  console.log('❌ Search service file not found');
}

console.log('\n💡 Next steps to debug:');
console.log('1. Start the backend server: npm run dev');
console.log('2. Make a test API call to /chat with a sad question');
console.log('3. Check the server logs for search results and matches');
console.log('4. Verify the Q&A data is loaded during startup');

console.log('\n📝 Test question to try:');
console.log('POST /chat');
console.log('Body: {"message": "I feel like nothing I do is ever good enough", "sessionId": "test-123"}');