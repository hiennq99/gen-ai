const fs = require('fs');

// Read the prepared QA data
const qaDataPath = '/Users/nickkk/Desktop/gen-ai/ai-chatbot-system/qa-data.json';

if (!fs.existsSync(qaDataPath)) {
    console.error('QA data file not found. Run upload-qa-data.js first.');
    process.exit(1);
}

const qaData = JSON.parse(fs.readFileSync(qaDataPath, 'utf8'));

// Generate code to insert data into the in-memory store
const insertCode = `
// Insert QA test data into database service in-memory store
const qaItems = ${JSON.stringify(qaData, null, 2)};

// Clear existing QA data
this.inMemoryStore.set('qa', []);

// Add our test data
qaItems.forEach(qaItem => {
    const qaItems = this.inMemoryStore.get('qa') || [];
    qaItems.push(qaItem);
    this.inMemoryStore.set('qa', qaItems);
});

console.log(\`Loaded \${qaItems.length} Q&A training items into in-memory store\`);
`;

// Write to a file that we can copy-paste into the database service
fs.writeFileSync('/Users/nickkk/Desktop/gen-ai/ai-chatbot-system/backend/insert-qa-code.txt', insertCode);

console.log('Generated code to insert Q&A data. Contents:');
console.log('=====================================');
console.log(insertCode);
console.log('=====================================');
console.log('\nThis code needs to be added to the database service initialization.');