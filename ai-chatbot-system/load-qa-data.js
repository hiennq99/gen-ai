const fs = require('fs');

// Read the test QA data
const qaText = fs.readFileSync('/Users/nickkk/Desktop/gen-ai/ai-chatbot-system/test-qa.txt', 'utf8');

// Parse the QA pairs
const qaData = [];
const lines = qaText.split('\n').filter(line => line.trim());

let currentQuestion = '';
let currentAnswer = '';
let emotion = '';

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^\d+\./)) {
        // Save previous Q&A if it exists
        if (currentQuestion && currentAnswer) {
            qaData.push({
                question: currentQuestion,
                answer: currentAnswer.trim(),
                emotion: emotion || 'neutral'
            });
        }

        // Extract question and emotion
        const match = line.match(/^\d+\.\s*\(([^)]+)\)\s*(.+)/);
        if (match) {
            emotion = match[1].toLowerCase();
            currentQuestion = match[2];
            currentAnswer = '';
        }
    } else if (currentQuestion && line) {
        // Continue building the answer
        currentAnswer += (currentAnswer ? ' ' : '') + line;
    }
}

// Add the last Q&A pair
if (currentQuestion && currentAnswer) {
    qaData.push({
        question: currentQuestion,
        answer: currentAnswer.trim(),
        emotion: emotion || 'neutral'
    });
}

// Create CSV content
let csvContent = 'question,answer,emotion\n';
qaData.forEach(qa => {
    // Escape quotes and wrap in quotes to handle commas and newlines
    const question = `"${qa.question.replace(/"/g, '""')}"`;
    const answer = `"${qa.answer.replace(/"/g, '""')}"`;
    const emotion = qa.emotion;

    csvContent += `${question},${answer},${emotion}\n`;
});

// Write CSV file
fs.writeFileSync('/Users/nickkk/Desktop/gen-ai/ai-chatbot-system/qa-training.csv', csvContent);

console.log(`Converted ${qaData.length} Q&A pairs to CSV format`);
console.log('Sample data:');
qaData.slice(0, 2).forEach((qa, i) => {
    console.log(`${i + 1}. Question: ${qa.question}`);
    console.log(`   Answer: ${qa.answer.substring(0, 100)}...`);
    console.log(`   Emotion: ${qa.emotion}`);
    console.log('');
});