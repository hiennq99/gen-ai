const axios = require('axios');

// Test a single variation to debug the matching
async function testSingleVariation() {
  console.log('🧪 Testing Single Spiritual Variation\n');

  const baseURL = 'http://localhost:3000';

  // The training question and a variation that should match
  const trainingQuestion = "I feel spiritually empty. I still pray, but I feel nothing.";
  const testVariation = "I still do all my religious practices but feel nothing spiritually";

  console.log(`🎯 Training Question: "${trainingQuestion}"`);
  console.log(`🔍 Test Variation: "${testVariation}"`);
  console.log(`📊 Expected: Should find spiritual emptiness with >50% similarity\n`);

  try {
    const response = await axios.post(`${baseURL}/api/v1/chat/message`, {
      message: testVariation,
      sessionId: `single-test`,
      userId: "test-user"
    }, {
      timeout: 30000
    });

    if (response.data.metadata?.documents?.length > 0) {
      const doc = response.data.metadata.documents[0];
      console.log(`✅ FOUND MATCH:`);
      console.log(`   Title: "${doc.title}"`);
      console.log(`   Similarity: ${doc.similarityScore}`);
      console.log(`   Match Type: ${doc.matchType}`);

      if (doc.title.includes('spiritually empty')) {
        console.log(`   🎯 SUCCESS: Correctly matched spiritual emptiness!`);
      } else {
        console.log(`   ❌ WRONG: Matched different question instead of spiritual emptiness`);
      }
    } else {
      console.log(`❌ NO MATCH: No documents found`);
      console.log(`   This means similarity score was <50% or logic issue`);
    }

    console.log(`\n📄 Full response metadata:`);
    console.log(JSON.stringify(response.data.metadata, null, 2));

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`❌ Server not running`);
      return;
    }
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  console.log(`\n🔍 Check server logs for:`)
  console.log(`   - "📊 QA DEBUG: High similarity" (should show spiritual emptiness with >50%)`);
  console.log(`   - "🎯 DB DEBUG: Forcing return of 50%+ match" (should trigger)`);
  console.log(`   - "✅ DB DEBUG: Found Q&A match!" (should appear)`);
}

console.log('Starting single variation debug test...');
testSingleVariation().catch(console.error);