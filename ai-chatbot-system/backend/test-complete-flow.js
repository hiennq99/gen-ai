const axios = require('axios');

// Test the complete chat flow with debug logging
async function testChatFlow() {
  console.log('🧪 Testing Complete Chat Flow with Debug Logging\n');

  const baseURL = 'http://localhost:3000';

  // Test cases based on your training data
  const testCases = [
    {
      message: "What dhikr can i recite when i am feeling sad?",
      expected: "Should match exactly",
      expectMatch: true
    },
    {
      message: "I feel like nothing I do is ever good enough",
      expected: "Should match with semantic similarity to inadequacy training question",
      expectMatch: true
    },
    {
      message: "I feel sad and need help",
      expected: "Should match dhikr question with emotion similarity",
      expectMatch: true
    },
    {
      message: "How do I pray?",
      expected: "Should not match any training question",
      expectMatch: false
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];

    console.log(`\n--- Test ${i + 1}: ${testCase.message} ---`);
    console.log(`Expected: ${testCase.expected}`);

    try {
      const response = await axios.post(`${baseURL}/chat`, {
        message: testCase.message,
        sessionId: `test-session-${i + 1}`,
        userId: "test-user"
      }, {
        timeout: 30000
      });

      console.log(`✅ Response received:`);
      console.log(`📄 Content: ${response.data.content?.substring(0, 200)}...`);
      console.log(`📊 Confidence: ${response.data.confidence}`);
      console.log(`🔧 Mode: ${response.data.metadata?.mode}`);

      if (response.data.metadata?.documents?.length > 0) {
        console.log(`📚 Documents used: ${response.data.metadata.documents.length}`);
        response.data.metadata.documents.forEach((doc, idx) => {
          console.log(`  ${idx + 1}. "${doc.title}" (${doc.similarityScore || doc.relevanceScore})`);
          if (doc.originalQuestion) {
            console.log(`     Original: "${doc.originalQuestion}"`);
          }
        });
      } else {
        console.log(`❌ No documents referenced!`);
      }

      if (response.data.metadata?.contextInfo?.message) {
        console.log(`💬 Context: ${response.data.metadata.contextInfo.message}`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Server not running. Please start with: npm run dev`);
        return;
      }

      console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
    }
  }

  console.log('\n🎯 To see debug logs, check the server console where you ran "npm run dev"');
  console.log('Look for lines containing "🔍 SEARCH DEBUG", "🔍 DB DEBUG", "🔍 QA DEBUG"');
}

// Check if server is running
console.log('Checking if server is running...');
testChatFlow().catch(console.error);