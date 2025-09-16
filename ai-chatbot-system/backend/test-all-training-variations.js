const axios = require('axios');

// Test all 6 training questions with semantically similar variations
async function testAllTrainingQuestions() {
  console.log('🧪 Testing All Training Questions with Semantic Variations\n');

  const baseURL = 'http://localhost:3000';

  // All 6 training questions with their semantic variations
  const trainingTests = [
    {
      trainingQuestion: "What dhikr can i recite when i am feeling sad?",
      variations: [
        "What dhikr can i recite when i am feeling sad?", // Exact match - should be 100%
        "What dhikr should I recite when feeling sad?",
        "Which dhikr can I say when I'm sad?",
        "What remembrance of Allah helps when sad?",
        "What Islamic prayer helps with sadness?",
        "What dhikr is good for when I feel down?"
      ]
    },
    {
      trainingQuestion: "Why do I feel sad even when I am trying to stay positive?",
      variations: [
        "Why do I feel sad even when I am trying to stay positive?", // Exact match
        "Why am I sad even when trying to be positive?",
        "Why do I still feel down despite staying positive?",
        "Why does sadness persist even with positive thinking?",
        "I try to stay positive but still feel sad, why?",
        "Why can't I shake sadness despite positive attitude?"
      ]
    },
    {
      trainingQuestion: "What does Islam say about experiencing sadness?",
      variations: [
        "What does Islam say about experiencing sadness?", // Exact match
        "What is Islam's view on sadness?",
        "How does Islam view feeling sad?",
        "What does Islamic teaching say about sadness?",
        "What's the Islamic perspective on being sad?",
        "How does Islam address feelings of sadness?"
      ]
    },
    {
      trainingQuestion: "How can I express gratitude when feeling happy?",
      variations: [
        "How can I express gratitude when feeling happy?", // Exact match
        "How do I show gratitude when I'm happy?",
        "What's the best way to express thankfulness when joyful?",
        "How can I thank Allah when feeling joyful?",
        "How to show appreciation when I'm in a good mood?",
        "What should I do to express gratitude during happiness?"
      ]
    },
    {
      trainingQuestion: "What supplication helps with anxiety?",
      variations: [
        "What supplication helps with anxiety?", // Exact match
        "Which dua helps with anxiety?",
        "What prayer helps when I'm anxious?",
        "What Islamic prayer helps with worry?",
        "Which supplication is good for anxious feelings?",
        "What dua can I recite when feeling anxious?"
      ]
    },
    {
      trainingQuestion: "I feel spiritually empty. I still pray, but I feel nothing.",
      variations: [
        "I feel spiritually empty. I still pray, but I feel nothing.", // Exact match
        "I go through the motions of faith, but I feel completely hollow inside",
        "I pray every day but feel no connection to God anymore",
        "My prayers feel empty and meaningless lately",
        "I still do all my religious practices but feel nothing spiritually",
        "Even when I pray, I feel spiritually numb and empty",
        "I maintain my religious routine but feel spiritually vacant"
      ]
    }
  ];

  let totalTests = 0;
  let successfulMatches = 0;
  let exactMatches = 0;
  let semanticMatches = 0;

  for (let i = 0; i < trainingTests.length; i++) {
    const test = trainingTests[i];

    console.log(`\n🎯 Training Question ${i + 1}: "${test.trainingQuestion}"`);
    console.log(`Testing ${test.variations.length} variations:\n`);

    for (let j = 0; j < test.variations.length; j++) {
      const variation = test.variations[j];
      totalTests++;

      console.log(`  ${j + 1}. "${variation}"`);

      try {
        const response = await axios.post(`${baseURL}/api/v1/chat/message`, {
          message: variation,
          sessionId: `test-${i}-${j}`,
          userId: "test-user"
        }, {
          timeout: 30000
        });

        if (response.data.metadata?.documents?.length > 0) {
          const doc = response.data.metadata.documents[0];
          const similarity = parseFloat(doc.similarityScore?.replace('%', '') || '0');

          console.log(`     ✅ MATCHED: "${doc.title}" (${doc.similarityScore})`);

          if (doc.title === test.trainingQuestion) {
            successfulMatches++;
            if (similarity === 100) {
              exactMatches++;
              console.log(`     🎯 PERFECT: Exact match to training question`);
            } else if (similarity >= 50) {
              semanticMatches++;
              console.log(`     ✨ SEMANTIC: Good semantic match to training question`);
            }
          } else {
            console.log(`     ❌ WRONG: Got different training question instead`);
          }
        } else {
          console.log(`     ❌ NO MATCH: No training documents found`);
        }

      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log(`     ❌ SERVER ERROR: Server not running`);
          return;
        }
        console.log(`     ❌ ERROR: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 FINAL RESULTS:');
  console.log('='.repeat(80));
  console.log(`📊 Total Tests: ${totalTests}`);
  console.log(`✅ Successful Matches: ${successfulMatches} (${((successfulMatches/totalTests)*100).toFixed(1)}%)`);
  console.log(`🎯 Exact Matches: ${exactMatches}`);
  console.log(`✨ Semantic Matches: ${semanticMatches}`);
  console.log(`❌ Failed Matches: ${totalTests - successfulMatches}`);

  if (successfulMatches === totalTests) {
    console.log('\n🎉 SUCCESS: All training questions and variations working perfectly!');
  } else {
    console.log(`\n⚠️  NEEDS IMPROVEMENT: ${totalTests - successfulMatches} variations not matching correctly`);
  }
}

console.log('Starting comprehensive training questions test...');
testAllTrainingQuestions().catch(console.error);