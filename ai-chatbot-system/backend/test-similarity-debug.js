const axios = require('axios');

// Test a few key spiritual emptiness variations to see exact similarity scores
async function testSimilarityScores() {
  console.log('🔍 Testing Similarity Scores for Spiritual Emptiness Variations\n');

  const baseURL = 'http://localhost:3000';

  // The training question
  const trainingQuestion = "I feel spiritually empty. I still pray, but I feel nothing.";

  // Test the most obvious semantic matches
  const testQuestions = [
    "I feel spiritually empty. I still pray, but I feel nothing.", // Should be 100%
    "I feel spiritually empty but still pray", // Very close match
    "Even when I pray, I feel spiritually numb and empty", // Contains "empty" and spiritual/pray
    "I go through the motions of faith, but I feel completely hollow inside", // Semantic equivalent
    "My prayers feel empty and meaningless lately" // Contains "empty" and prayers
  ];

  console.log(`🎯 Training Question: "${trainingQuestion}"\n`);

  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];

    console.log(`--- Test ${i + 1}: "${question}" ---`);

    try {
      const response = await axios.post(`${baseURL}/api/v1/chat/message`, {
        message: question,
        sessionId: `similarity-test-${i + 1}`,
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
          console.log(`✅ CORRECT: Matched spiritual emptiness training question!`);
        } else {
          console.log(`❌ WRONG: Got "${doc.title}" instead`);
        }
      } else {
        console.log(`❌ NO MATCH: No training documents matched`);
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

  console.log('🔍 Check the server logs for "📊 QA DEBUG: High similarity" messages');
  console.log('to see the actual similarity percentages being calculated.');
}

console.log('Starting similarity score debugging...');
testSimilarityScores().catch(console.error);