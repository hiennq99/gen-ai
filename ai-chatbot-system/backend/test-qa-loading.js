// Test script to verify Q&A data loading
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function testQALoading() {
  console.log('🧪 Testing Q&A Data Loading...\n');

  try {
    // Create NestJS application
    const app = await NestFactory.create(AppModule);

    // Get the database service
    const databaseService = app.get('DatabaseService');

    console.log('📊 Checking Q&A data in database...');

    // Get Q&A data
    const qaData = await databaseService.getQAData();

    console.log(`Found ${qaData.length} Q&A items in database:`);

    qaData.forEach((qa, index) => {
      console.log(`${index + 1}. Question: "${qa.question}"`);
      console.log(`   Answer: ${qa.answer.substring(0, 100)}...`);
      console.log(`   Emotion: ${qa.emotion}`);
      console.log(`   ID: ${qa.id}`);
      console.log('');
    });

    // Now test the search service
    console.log('🔍 Testing Search Service...');
    const searchService = app.get('SearchService');

    // Test with a similar question
    const testQuestion = "I feel like nothing I do is ever good enough";
    console.log(`\nTesting search with: "${testQuestion}"`);

    const searchResults = await searchService.searchDocuments({
      query: testQuestion,
      emotion: 'sad',
      limit: 5,
      minScore: 0.3,
      exactMatchFirst: true
    });

    console.log(`Search returned ${searchResults.length} results:`);
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. Title: "${result.title}"`);
      console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);
      console.log(`   Type: ${result.metadata?.type || 'unknown'}`);
      console.log(`   Matched Question: "${result.metadata?.matchedQuestion || 'N/A'}"`);
      console.log('');
    });

    await app.close();

  } catch (error) {
    console.error('❌ Error testing Q&A loading:', error);
  }
}

testQALoading();