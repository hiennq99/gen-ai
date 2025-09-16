const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Read the CSV data we just created
const csvContent = fs.readFileSync('/Users/nickkk/Desktop/gen-ai/ai-chatbot-system/qa-training.csv', 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Skip header line
const headers = lines[0].split(',');
const qaData = [];

// Parse CSV data
for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV line handling quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
                current += '"';
                j++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current); // Add the last field

    if (values.length >= 3) {
        qaData.push({
            id: uuidv4(),
            question: values[0],
            answer: values[1],
            emotion: values[2],
            metadata: {
                source: 'test_data_upload',
                uploadedAt: new Date().toISOString()
            },
            createdAt: new Date().toISOString()
        });
    }
}

// Write the QA data as JSON for direct database insertion
fs.writeFileSync('/Users/nickkk/Desktop/gen-ai/ai-chatbot-system/qa-data.json', JSON.stringify(qaData, null, 2));

console.log(`Prepared ${qaData.length} Q&A pairs for database insertion`);
qaData.forEach((qa, i) => {
    console.log(`${i + 1}. Question: ${qa.question}`);
    console.log(`   Answer: ${qa.answer.substring(0, 100)}...`);
    console.log(`   Emotion: ${qa.emotion}`);
    console.log(`   ID: ${qa.id}`);
    console.log('');
});