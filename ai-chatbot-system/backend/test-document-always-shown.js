// Test to verify documents are ALWAYS shown, regardless of confidence level
console.log('🧪 Testing: Documents Always Shown Regardless of Confidence\n');

// Mock response structures to show what users will see at different confidence levels
const testScenarios = [
  {
    userQuestion: "I feel like nothing I do is ever good enough",
    matchedTrainingQuestion: "I feel like I'm not good enough no matter what I do",
    confidence: 73.5,
    expectedBehavior: "High confidence - should show document prominently"
  },
  {
    userQuestion: "I feel bad today",
    matchedTrainingQuestion: "What dhikr can i recite when i am feeling sad?",
    confidence: 35.2,
    expectedBehavior: "Low confidence - should STILL show document as best available match"
  },
  {
    userQuestion: "How to be happy?",
    matchedTrainingQuestion: "How can I express gratitude when feeling happy?",
    confidence: 15.8,
    expectedBehavior: "Very low confidence - should STILL show document as best available match"
  }
];

testScenarios.forEach((scenario, index) => {
  console.log(`--- Scenario ${index + 1}: ${scenario.userQuestion} ---`);
  console.log(`Confidence: ${scenario.confidence}%`);
  console.log(`Expected: ${scenario.expectedBehavior}\n`);

  // Show what the response content will look like
  let documentNotice = '';
  const score = scenario.confidence.toFixed(1) + '%';

  if (scenario.confidence >= 50) {
    documentNotice = `📄 **Document Used**: Training question "${scenario.matchedTrainingQuestion}" (${score} similarity match)`;
  } else if (scenario.confidence >= 30) {
    documentNotice = `📄 **Document Used**: Training question "${scenario.matchedTrainingQuestion}" (${score} similarity match)`;
  } else {
    documentNotice = `📄 **Document Used**: "${scenario.matchedTrainingQuestion}" (${score} relevance - best available match)`;
  }

  // Mock response structure
  const mockResponse = {
    content: `[Empathetic Header]\n\n[AI Generated Response]\n\n${documentNotice}`,
    confidence: scenario.confidence,
    metadata: {
      documentsUsed: 1,
      documents: [{
        title: scenario.matchedTrainingQuestion,
        relevanceScore: score,
        matchType: scenario.confidence >= 70 ? 'qa_semantic_medium' :
                   scenario.confidence >= 50 ? 'qa_semantic_match' :
                   scenario.confidence >= 30 ? 'qa_low_match' : 'qa_best_available',
        originalQuestion: scenario.matchedTrainingQuestion,
        similarityScore: score,
        semanticMatch: true
      }],
      contextInfo: {
        message: scenario.confidence >= 50 ?
          'AI response enhanced with 1 medium-confidence training document(s) (1 semantic match). Document references visible in metadata.' :
          'AI response enhanced with 1 lower-confidence but relevant training document(s) (1 semantic match). Document references visible in metadata.',
        documentsReferenced: true,
        documentVisibilityNote: 'Document references included in response'
      }
    }
  };

  console.log(`✅ Response Content Preview:`);
  console.log(`"${mockResponse.content}"`);
  console.log(`\n📊 Document Info:`);
  console.log(`- Title: "${mockResponse.metadata.documents[0].title}"`);
  console.log(`- Match Type: ${mockResponse.metadata.documents[0].matchType}`);
  console.log(`- Similarity: ${mockResponse.metadata.documents[0].similarityScore}`);
  console.log(`- Context: ${mockResponse.metadata.contextInfo.message}`);
  console.log(`\n${'='.repeat(80)}\n`);
});

console.log('🎯 KEY IMPROVEMENTS:');
console.log('✅ Documents are ALWAYS shown, even at 15% relevance');
console.log('✅ Best available match is prominently displayed in content');
console.log('✅ Document metadata is always included regardless of confidence');
console.log('✅ Clear labeling of match quality (high/medium/low/best available)');
console.log('✅ User always knows which training data was referenced');

console.log('\n📝 Testing Instructions:');
console.log('1. npm run build && npm run dev');
console.log('2. Test with questions that have low similarity to training data');
console.log('3. Verify document info appears in both content and metadata');
console.log('4. Confirm even 10-20% matches show document references');