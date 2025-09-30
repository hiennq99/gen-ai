import pdfParse from 'pdf-parse';
import * as fs from 'fs';

async function testChapterSplit() {
  const pdfPath = '/Users/nick/Desktop/gen-ai/ai-chatbot-system/639155964-Ibn-Daud-A-Handbook-of-Spiritual-Medicine.pdf';
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);

  console.log('Total text length:', data.text.length);
  console.log('Contains "CHAPTER":', data.text.includes('CHAPTER'));
  console.log('Count of "CHAPTER":', (data.text.match(/CHAPTER/g) || []).length);
  console.log('Count of "Anger":', (data.text.match(/Anger/g) || []).length);

  // Find first occurrence of CHAPTER
  const chapterIndex = data.text.indexOf('CHAPTER');
  if (chapterIndex !== -1) {
    console.log('\nFirst CHAPTER found at position:', chapterIndex);
    console.log('Context:');
    console.log(data.text.substring(chapterIndex - 100, chapterIndex + 300));
  } else {
    console.log('\nNo CHAPTER found. Looking for numbered sections...');

    // Look for pattern like "1. Anger", "2. Antipathy"
    const numberedPattern = data.text.match(/\n\d+\.\s+[A-Z][a-z]+/g);
    if (numberedPattern) {
      console.log('\nFound numbered sections:', numberedPattern.length);
      console.log('First 5:', numberedPattern.slice(0, 5));
    }
  }

  // Test splitting by CHAPTER
  const sections = data.text.split(/\n(?=CHAPTER\s+\d+)/);
  console.log('\nSplit by CHAPTER pattern:', sections.length, 'sections');

  // Try alternative: Split by numbered diseases "1. Anger"
  const numberedSections = data.text.split(/\n(?=\d+\.\s+[A-Z])/);
  console.log('Split by numbered pattern:', numberedSections.length, 'sections');

  if (numberedSections.length > 1) {
    console.log('\nFirst 3 section titles:');
    numberedSections.slice(0, 4).forEach((section, idx) => {
      const firstLine = section.split('\n')[0];
      console.log(`${idx}: "${firstLine.substring(0, 50)}"`);
    });
  }
}

testChapterSplit();