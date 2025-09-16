const axios = require('axios');

// Test EXACT training questions only
async function testExactTrainingQuestions() {
  console.log('🧪 Testing EXACT Training Questions Only\n');

  const baseURL = 'http://localhost:3000';

  // The 6 exact training questions from database.service.ts
  const exactTrainingQuestions = [
    "What dhikr can i recite when i am feeling sad?",
    "Why do I feel sad even when I am trying to stay positive?",
    "What does Islam say about experiencing sadness?",
    "How can I express gratitude when feeling happy?",
    "What supplication helps with anxiety?",
    "I feel spiritually empty. I still pray, but I feel nothing."
  ];

  console.log(`Testing ${exactTrainingQuestions.length} exact training questions:\n`);

  let successCount = 0;

  for (let i = 0; i < exactTrainingQuestions.length; i++) {
    const question = exactTrainingQuestions[i];

    console.log(`${i + 1}. "${question}"`);

    try {
      const response = await axios.post(`${baseURL}/api/v1/chat/message`, {
        message: question,
        sessionId: `exact-test-${i}`,
        userId: "test-user"
      }, {
        timeout: 30000
      });

      if (response.data.metadata?.documents?.length > 0) {
        const doc = response.data.metadata.documents[0];
        const similarity = parseFloat(doc.similarityScore?.replace('%', '') || '0');

        if (doc.title === question && similarity === 100) {
          successCount++;
          console.log(`   ✅ SUCCESS: Perfect match (100.0%)`);
        } else {
          console.log(`   ❌ WRONG: Got "${doc.title}" (${doc.similarityScore})`);
        }
      } else {
        console.log(`   ❌ NO MATCH: No documents found`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`   ❌ SERVER ERROR: Server not running`);
        return;
      }
      console.log(`   ❌ ERROR: ${error.response?.data?.message || error.message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎯 EXACT MATCH RESULTS:`);
  console.log(`✅ Working: ${successCount}/${exactTrainingQuestions.length}`);
  console.log(`❌ Failing: ${exactTrainingQuestions.length - successCount}/${exactTrainingQuestions.length}`);

  if (successCount === exactTrainingQuestions.length) {
    console.log('\n🎉 All exact training questions working!');
  } else {
    console.log(`\n⚠️  Problem: ${exactTrainingQuestions.length - successCount} exact questions not working`);
    console.log('This suggests a database/training data loading issue.');
  }
}

console.log('Starting exact training questions test...');
testExactTrainingQuestions().catch(console.error);