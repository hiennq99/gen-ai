// Test to show what document information is returned for semantic matches
console.log('📄 Document Reference Test for Semantic Matches\n');

// Simulate the response structure that will be returned
const exampleResponse = {
  id: "msg-12345",
  content: "I understand how you're feeling...\n\nWhen you're feeling sad, there are several dhikr (remembrances) and supplications you can recite to seek comfort and solace from Allah...",
  emotion: "sad",
  confidence: 78.5,
  metadata: {
    sessionId: "session-123",
    documentsUsed: 1,
    documents: [{
      title: "What dhikr can i recite when i am feeling sad?",  // The matched training question
      relevanceScore: "78.5%",
      excerpt: "When you're feeling sad, there are several dhikr (remembrances) and supplications you can recite to seek comfort and solace from Allah. Here are a few: Tasbih (SubhanAllah): Saying \"SubhanAllah\" means \"Glory be to Allah.\"...",
      matchType: "qa_semantic_medium",  // Type of semantic match
      originalQuestion: "What dhikr can i recite when i am feeling sad?",  // Original training question
      similarityScore: "78.5%",
      semanticMatch: true  // Indicates this was a semantic/meaning match
    }],
    contextInfo: {
      totalDocuments: 1,
      contextUsed: true,
      message: "Found medium semantic similarity with training question: \"What dhikr can i recite when i am feeling sad?\" (78.5% similarity)",
      qaMatch: true,
      matchedQuestion: "What dhikr can i recite when i am feeling sad?",
      semanticMatch: true,
      matchScore: "78.5%"
    },
    mode: "qa-exact-match"
  }
};

console.log('🎯 Example Response for User Question: "I feel sad and need help"');
console.log('📊 Matched Training Question: "What dhikr can i recite when i am feeling sad?"');
console.log('📈 Similarity Score: 78.5%\n');

console.log('📄 DOCUMENT INFORMATION SHOWN IN CHAT:');
console.log('=====================================');
console.log(`Title: ${exampleResponse.metadata.documents[0].title}`);
console.log(`Match Type: ${exampleResponse.metadata.documents[0].matchType}`);
console.log(`Similarity Score: ${exampleResponse.metadata.documents[0].similarityScore}`);
console.log(`Semantic Match: ${exampleResponse.metadata.documents[0].semanticMatch}`);
console.log(`Original Training Question: ${exampleResponse.metadata.documents[0].originalQuestion}`);
console.log(`\nContext Message: ${exampleResponse.metadata.contextInfo.message}`);

console.log('\n📋 DIFFERENT MATCH TYPES:');
console.log('========================');
console.log('• qa_exact_match (95%+): "Found exact match in training data"');
console.log('• qa_semantic_high (85-94%): "Found high semantic similarity with training question"');
console.log('• qa_semantic_medium (70-84%): "Found medium semantic similarity with training question"');
console.log('• qa_semantic_match (55-69%): "Found similar meaning to training question"');

console.log('\n✅ This ensures users can see:');
console.log('• Which training question was matched');
console.log('• How similar their question was to the training question');
console.log('• That the answer came from training data, not general AI');
console.log('• The confidence/relevance score of the match');

// Show the full response structure for developers
console.log('\n🔧 Full Response Structure (for developers):');
console.log('==========================================');
console.log(JSON.stringify(exampleResponse, null, 2));