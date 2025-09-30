import pdfParse from 'pdf-parse';
import * as fs from 'fs';

async function debugChapters() {
  const pdfPath = '/Users/nick/Desktop/gen-ai/ai-chatbot-system/639155964-Ibn-Daud-A-Handbook-of-Spiritual-Medicine.pdf';
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);

  // Split by CHAPTER
  const sections = data.text.split(/\n(?=CHAPTER\s+\d+)/);

  console.log(`Total sections: ${sections.length}\n`);

  // Show first 500 chars of each section
  sections.slice(0, 10).forEach((section, idx) => {
    console.log(`\n========== SECTION ${idx} ==========`);
    console.log(section.substring(0, 600));
    console.log('...\n');
  });
}

debugChapters();