const axios = require('axios');

// Test spiritual emptiness variations against the training question
async function testSpiritualEmptiness() {
  console.log('🧪 Testing Spiritual Emptiness Semantic Matching\n');

  const baseURL = 'http://localhost:3000';

  // Your training question
  const trainingQuestion = "I feel spiritually empty. I still pray, but I feel nothing.";

  // Client variations that should match semantically
  const clientVariations = [
    "I go through the motions of faith, but I feel completely hollow inside",
    "I pray every day but feel no connection to God anymore",
    "My prayers feel empty and meaningless lately",
    "I still do all my religious practices but feel nothing spiritually",
    "I feel disconnected from my faith even though I keep praying",
    "My spiritual life feels dead even though I go through all the rituals",
    "I practice my religion but feel no spiritual fulfillment",
    "I feel like my prayers bounce off the ceiling - no spiritual connection",
    "Even when I pray, I feel spiritually numb and empty",
    "I maintain my religious routine but feel spiritually vacant"
  ];

  console.log(`🎯 Training Question: "${trainingQuestion}"\n`);
  console.log('Testing semantic variations:\n');

  for (let i = 0; i < clientVariations.length; i++) {
    const question = clientVariations[i];

    console.log(`--- Test ${i + 1}: "${question}" ---`);

    try {
      const response = await axios.post(`${baseURL}/api/v1/chat/message`, {
        message: question,
        sessionId: `spiritual-test-${i + 1}`,
        userId: "test-user"
      }, {
        timeout: 30000
      });

      console.log(`✅ Response received`);
      console.log(`📊 Confidence: ${response.data.confidence}%`);

      if (response.data.metadata?.documents?.length > 0) {
        const doc = response.data.metadata.documents[0];
        console.log(`📚 Document Found: "${doc.title}"`);
        console.log(`🎯 Similarity: ${doc.similarityScore || doc.relevanceScore}`);
        console.log(`📄 Match Type: ${doc.matchType}`);

        // Check if it matched the spiritual emptiness training question
        if (doc.title.includes('spiritually empty') || doc.originalQuestion?.includes('spiritually empty')) {
          console.log(`✅ CORRECT MATCH: Found spiritual emptiness training question!`);
        } else {
          console.log(`❌ WRONG MATCH: Got "${doc.title}" instead of spiritual emptiness`);
        }
      } else {
        console.log(`❌ NO DOCUMENTS: No training documents matched at all`);
      }

      // Show snippet of response content
      if (response.data.content) {
        const preview = response.data.content.substring(0, 150);
        console.log(`💬 Response preview: "${preview}..."`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Server not running. Please start with: npm run dev`);
        return;
      }
      console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
    }

    console.log(''); // Empty line between tests
  }

  console.log('\n🔍 Analysis Notes:');
  console.log('- All variations should match the spiritual emptiness training question');
  console.log('- Similarity scores should be >50% to trigger responses');
  console.log('- Look for semantic concepts: empty, hollow, nothing, disconnected, dead, vacant, numb');
  console.log('- Faith/prayer/spiritual context should boost relevance');
}

console.log('Starting spiritual emptiness semantic matching test...');
testSpiritualEmptiness().catch(console.error);