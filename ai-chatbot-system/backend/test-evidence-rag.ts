/**
 * Test Evidence-Based RAG System
 *
 * This script tests the new evidence-only retrieval system
 * that returns ONLY Qur'anic, Prophetic & Scholarly Evidence
 */

import { EvidenceParserService } from './src/modules/spiritual-guidance/evidence-parser.service';
import { EvidenceChunkService } from './src/modules/spiritual-guidance/evidence-chunk.service';

// Sample handbook text (from "A Handbook of Spiritual Medicine")
const SAMPLE_HANDBOOK_TEXT = `
# Anger

الغضب

## Signs & Symptoms

- Rising Tempers: You become furious and may act irrationally
- Rage & Hatred: Due to your anger, and that of another, a quarrel is stirred and heated to the point of conflict
- Loss of Control: Unable to control emotions and actions

## Qur'ānic, Prophetic & Scholarly Evidence

Allāh says, "Be moderate in your pace. And lower your voice, for the ugliest of all voices is certainly the braying of donkeys" [Luqman 31:19-20]

The Prophet ﷺ said, "Do not become angry" [Sahih Al-Bukhari 6116]

Imām Al-Ghazālī said, "Do not argue with anyone regarding any issue, insofar as you are able, since there is much that is harmful in it" [Letter to a Disciple, p.42-43]

## Academic Treatment

You repel or keep your anger under control by recognising that nothing takes place without the leave of Allah. (THIS SHOULD NOT BE RETURNED)
`;

async function testEvidenceParser() {
  console.log('🧪 Testing Evidence Parser Service\n');
  console.log('='.repeat(60));

  const parser = new EvidenceParserService();

  // Extract evidence section
  const evidenceText = parser.extractEvidenceOnly(SAMPLE_HANDBOOK_TEXT);
  console.log('\n📝 Extracted Evidence Text:');
  console.log(evidenceText);

  // Parse evidence
  const evidences = parser.parseEvidence(evidenceText, 'Anger');
  console.log(`\n✅ Parsed ${evidences.length} evidence items:\n`);

  evidences.forEach((evidence, index) => {
    console.log(`${index + 1}. Type: ${evidence.type}`);
    console.log(`   Text: "${evidence.text.substring(0, 80)}..."`);
    console.log(`   Reference: [${evidence.reference}]`);
    if (evidence.scholar) {
      console.log(`   Scholar: ${evidence.scholar}`);
    }
    console.log('');
  });

  // Format for display
  console.log('📋 Formatted Output (Vietnamese):\n');
  console.log(parser.formatEvidence(evidences, 'vi'));

  console.log('\n' + '='.repeat(60));
}

async function testEvidenceChunking() {
  console.log('\n🧪 Testing Evidence Chunk Service\n');
  console.log('='.repeat(60));

  const parser = new EvidenceParserService();
  const chunkService = new EvidenceChunkService(parser);

  // Create evidence chunks
  const chunks = await chunkService.createEvidenceChunks(
    SAMPLE_HANDBOOK_TEXT,
    'handbook-spiritual-medicine.pdf'
  );

  console.log(`\n✅ Created ${chunks.length} evidence chunks\n`);

  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}:`);
    console.log(`  Disease: ${chunk.disease}`);
    console.log(`  Arabic: ${chunk.arabicName || 'N/A'}`);
    console.log(`  Evidence Items: ${chunk.structuredEvidence.length}`);
    console.log(`  Search Text Length: ${chunk.searchText.length} chars`);
    console.log('');

    console.log('  📥 Search Text (what gets embedded):');
    console.log('  ' + chunk.searchText.split('\n')[0].substring(0, 80) + '...\n');

    console.log('  📤 Evidence Text (what gets returned):');
    console.log('  ' + chunk.evidenceText.split('\n').slice(0, 3).join('\n  '));
    console.log('');
  });

  console.log('='.repeat(60));
}

async function testSearchScenario() {
  console.log('\n🧪 Testing Search Scenario\n');
  console.log('='.repeat(60));

  const parser = new EvidenceParserService();
  const chunkService = new EvidenceChunkService(parser);

  // Create chunks
  const chunks = await chunkService.createEvidenceChunks(
    SAMPLE_HANDBOOK_TEXT,
    'handbook-spiritual-medicine.pdf'
  );

  // Simulate user query
  const userQuery = "Is there a quick way to control anger?";
  console.log(`\n❓ User Question: "${userQuery}"\n`);

  // In real system, this would be vector search
  // For demo, we just show what would be returned
  const matchedChunk = chunks[0]; // Assume first chunk matched

  console.log('🎯 Retrieved Evidence:\n');
  console.log(chunkService.formatEvidenceForDisplay(matchedChunk, 'vi'));

  console.log('\n✅ CRITICAL CHECKS:');
  console.log(`  ✓ Contains Symptoms? ${matchedChunk.evidenceText.includes('Rising Tempers') ? '❌ FAIL' : '✅ PASS'}`);
  console.log(`  ✓ Contains Treatment? ${matchedChunk.evidenceText.includes('recognising that nothing') ? '❌ FAIL' : '✅ PASS'}`);
  console.log(`  ✓ Contains Quran? ${matchedChunk.evidenceText.includes('Qur\'an') ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ✓ Contains Hadith? ${matchedChunk.evidenceText.includes('Hadith') ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  ✓ Contains References? ${matchedChunk.evidenceText.includes('[') ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n' + '='.repeat(60));
}

async function testIntegrationFormat() {
  console.log('\n🧪 Testing Integration Format\n');
  console.log('='.repeat(60));

  const parser = new EvidenceParserService();
  const chunkService = new EvidenceChunkService(parser);

  const chunks = await chunkService.createEvidenceChunks(
    SAMPLE_HANDBOOK_TEXT,
    'handbook-spiritual-medicine.pdf'
  );

  const chunk = chunks[0];

  // Format for database storage
  const storageFormat = chunkService.formatForStorage(chunk);

  console.log('\n💾 Storage Format (what goes into vector DB):\n');
  console.log('Document to Index:');
  console.log(JSON.stringify({
    id: storageFormat.id,
    content: storageFormat.content.substring(0, 100) + '...', // Truncated for display
    text: storageFormat.text.substring(0, 100) + '...',
    metadata: {
      ...storageFormat.metadata,
      structuredEvidence: '[truncated]',
      evidenceText: storageFormat.metadata.evidenceText.substring(0, 100) + '...',
    }
  }, null, 2));

  // Reconstruct from storage
  const reconstructed = chunkService.reconstructFromStorage(storageFormat);

  console.log('\n♻️  Reconstructed Chunk:');
  console.log(`  Disease: ${reconstructed.disease}`);
  console.log(`  Evidence Count: ${reconstructed.structuredEvidence.length}`);
  console.log(`  Has Quran: ${storageFormat.metadata.hasQuran}`);
  console.log(`  Has Hadith: ${storageFormat.metadata.hasHadith}`);

  console.log('\n' + '='.repeat(60));
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 EVIDENCE-BASED RAG SYSTEM TEST SUITE\n');
  console.log('Testing the refactored system that returns ONLY evidence\n');

  try {
    await testEvidenceParser();
    await testEvidenceChunking();
    await testSearchScenario();
    await testIntegrationFormat();

    console.log('\n✅ All tests completed successfully!\n');
    console.log('📚 Next Steps:');
    console.log('  1. Integrate with existing SearchService');
    console.log('  2. Update chat service to use evidence-only results');
    console.log('  3. Process full handbook PDF with new chunking');
    console.log('  4. Re-index all documents with evidence chunks');
    console.log('  5. Test with real user queries\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runAllTests();
}

export { testEvidenceParser, testEvidenceChunking, testSearchScenario };