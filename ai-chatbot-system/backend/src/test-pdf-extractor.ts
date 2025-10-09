import { AdvancedTableExtractor } from './modules/documents/advanced-table-extractor.service';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

async function testAdvancedExtractor() {
  console.log('🚀 Testing Advanced PDF Extractor...\n');

  const extractor = new AdvancedTableExtractor();

  // For testing, we'll create a sample buffer with the pattern we expect
  const testPdfText = `
1

ANXIETY

SIGNS & SYMPTOMS

Excessive worry about everyday matters
Difficulty sleeping and concentrating
Physical symptoms like rapid heartbeat
Restlessness and feeling on edge

Qur'ānic, Prophetic & Scholarly Evidence

Allāh says: "And whoever relies upon Allāh - then He is sufficient for him. Indeed, Allāh will accomplish His purpose." [At-Talāq 65:3]

The Prophet (peace be upon him) said: "Remember often the destroyer of pleasures: death." [At-Tirmidhi 2307]

Imām Al-Ghazālī said: "Anxiety comes from forgetting that Allāh is in control of all affairs."

TREATMENTS

Regular remembrance of Allāh
Seeking refuge in prayer
Consulting qualified scholars

2

DEPRESSION

SIGNS & SYMPTOMS

Persistent sadness and hopelessness
Loss of interest in daily activities
Changes in appetite and sleep patterns
Feelings of worthlessness

Qur'ānic, Prophetic & Scholarly Evidence

Allāh says: "And give good tidings to the patient, Who, when disaster strikes them, say, 'Indeed we belong to Allāh, and indeed to Him we will return.'" [Al-Baqarah 2:155-156]

The Prophet (peace be upon him) said: "No fatigue, nor disease, nor sorrow, nor sadness, nor hurt, nor distress befalls a Muslim, even if it were the prick he receives from a thorn, but that Allāh expiates some of his sins for that." [Bukhari 5641]

TREATMENTS

Seeking knowledge of the religion
Community support and counseling
`;

  try {
    // Mock PDF parsing by directly using our parser on the text
    const qaList = (extractor as any).parseStructuredTables(testPdfText);

    console.log('═'.repeat(70));
    console.log('📊 TEST RESULTS');
    console.log('═'.repeat(70));
    console.log(`Total Q&A pairs extracted: ${qaList.length}\n`);

    // Show results
    qaList.forEach((item: any, idx: number) => {
      console.log(`Entry ${idx + 1}:`);
      console.log(`Disease: ${item.disease}`);
      console.log(`Question: ${item.question.substring(0, 100)}...`);
      console.log(`Answer Type: ${item.answer.type}`);
      console.log(`Answer: ${item.answer.text ? item.answer.text.substring(0, 100) + '...' : 'N/A'}`);
      console.log(`Reference: ${item.answer.reference || 'N/A'}`);
      console.log(`Metadata:`, item.metadata);
      console.log('─'.repeat(70) + '\n');
    });

    // Test export functions
    const textOutput = extractor.convertQAToText(qaList);
    console.log('✅ Text conversion successful');

    const jsonOutput = extractor.exportAsJSON(qaList);
    console.log('✅ JSON export successful');

    const csvOutput = extractor.exportAsCSV(qaList);
    console.log('✅ CSV export successful');

    // Save sample outputs
    writeFileSync('/tmp/test_qa_output.txt', textOutput);
    writeFileSync('/tmp/test_qa_output.json', jsonOutput);
    writeFileSync('/tmp/test_qa_output.csv', csvOutput);

    console.log('\n💾 Sample outputs saved to:');
    console.log('  - /tmp/test_qa_output.txt');
    console.log('  - /tmp/test_qa_output.json');
    console.log('  - /tmp/test_qa_output.csv');

    console.log('\n✅ All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdvancedExtractor();