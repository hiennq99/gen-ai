import pdfParse from 'pdf-parse';
import * as fs from 'fs';

async function testPDFStructure() {
  const pdfPath = '/Users/nick/Desktop/gen-ai/ai-chatbot-system/639155964-Ibn-Daud-A-Handbook-of-Spiritual-Medicine.pdf';
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);

  console.log('Total pages:', data.numpages);
  console.log('Total text length:', data.text.length);
  console.log('\n=== Finding Anger section ===\n');

  // Find page 30 content (Anger starts on page 30)
  const lines = data.text.split('\n');
  let foundAnger = false;
  let angerLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for "Anger" or "ANGER" as a standalone heading
    if (line === 'Anger' || line === 'ANGER' || line.match(/^\d+\.\s*Anger/)) {
      console.log(`Found Anger at line ${i}: "${line}"`);
      foundAnger = true;
      // Get next 100 lines
      angerLines = lines.slice(i, i + 100);
      break;
    }
  }

  if (foundAnger) {
    console.log('\n=== ANGER SECTION (first 100 lines) ===\n');
    angerLines.forEach((line, idx) => {
      console.log(`${idx}: ${line}`);
    });
  } else {
    console.log('Could not find Anger section');
    console.log('\n=== Searching for keywords ===');
    console.log('Contains "Signs & Symptoms"?', data.text.includes('Signs & Symptoms'));
    console.log('Contains "Evidence"?', data.text.includes('Evidence'));
    console.log('Contains "Quranic"?', data.text.includes('Quranic'));
    console.log('Contains "Prophetic"?', data.text.includes('Prophetic'));

    // Show lines 500-600
    console.log('\n=== Sample lines 500-600 ===\n');
    lines.slice(500, 600).forEach((line, idx) => {
      console.log(`${500 + idx}: ${line}`);
    });
  }
}

testPDFStructure();