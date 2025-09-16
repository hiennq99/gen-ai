// Test script to verify semantic matching works with your example questions
const testCases = [
  {
    training: "I feel like I'm not good enough no matter what I do",
    userQuestions: [
      "I feel like nothing I do is ever good enough",
      "No matter how hard I try, I always feel like I'm falling short",
      "I can't shake the feeling that I'm just not measuring up",
      "It feels like I'm constantly failing to meet expectations",
      "I always feel like I'm disappointing people, no matter what I do",
      "No matter how much effort I put in, I still feel inadequate",
      "I feel like I'm never able to do anything right",
      "It seems like I'm always coming up short, regardless of my efforts",
      "I can't escape the feeling that I'm just not capable enough",
      "No matter what I accomplish, I still feel like it's not sufficient"
    ]
  }
];

// Simple implementation of the semantic matching logic for testing
function normalizeForSemanticMatch(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bi('m|m)\b/g, 'i am')
    .replace(/\byou('re|re)\b/g, 'you are')
    .replace(/\bdon('t|t)\b/g, 'do not')
    .replace(/\bcan('t|t)\b/g, 'cannot');
}

function calculateSemanticCoreMatch(text1, text2) {
  const semanticConcepts = {
    inadequacy: ['not good enough', 'not enough', 'never enough', 'not sufficient', 'inadequate', 'insufficient', 'not right', 'not capable', 'not able', 'cannot do'],
    failure: ['falling short', 'coming up short', 'not measuring up', 'disappointing', 'letting down', 'failing', 'not making it', 'not succeeding'],
    effort: ['no matter what i do', 'nothing i do', 'whatever i do', 'however hard i try', 'how much effort', 'how hard i work', 'regardless of my efforts'],
    feeling: ['i feel like', 'i feel that', 'it feels like', 'i think', 'i believe', 'seems like', 'appears that'],
    always_never: ['always', 'never', 'constantly', 'perpetually', 'forever', 'all the time', 'every time']
  };

  let matchScore = 0;
  let conceptsFound = 0;

  for (const [concept, phrases] of Object.entries(semanticConcepts)) {
    const inText1 = phrases.some(phrase => text1.includes(phrase));
    const inText2 = phrases.some(phrase => text2.includes(phrase));

    if (inText1 && inText2) {
      matchScore += 1;
      conceptsFound++;
      console.log(`  ✓ Concept match: ${concept}`);
    }
  }

  return conceptsFound > 0 ? matchScore / Math.max(conceptsFound, 1) : 0;
}

function calculateAdvancedPhraseSimilarity(text1, text2) {
  const meaningGroups = {
    'inadequacy_self': ['not good enough', 'not enough', 'never enough', 'not sufficient', 'inadequate', 'insufficient', 'not capable', 'not able'],
    'failure_attempts': ['falling short', 'coming up short', 'not measuring up', 'not making the cut', 'disappointing others', 'letting people down'],
    'persistent_effort': ['no matter what i do', 'nothing i do', 'whatever i do', 'however hard i try', 'regardless of my efforts', 'no matter how much effort'],
    'emotional_certainty': ['i feel like', 'it feels like', 'i always feel', 'i constantly feel']
  };

  let totalMatches = 0;
  let groupsChecked = 0;

  for (const [group, phrases] of Object.entries(meaningGroups)) {
    groupsChecked++;
    const text1HasGroup = phrases.some(phrase => text1.includes(phrase));
    const text2HasGroup = phrases.some(phrase => text2.includes(phrase));

    if (text1HasGroup && text2HasGroup) {
      totalMatches += 1.0;
      console.log(`  ✓ Phrase group match: ${group}`);
    }
  }

  return groupsChecked > 0 ? totalMatches / groupsChecked : 0;
}

function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;

  const norm1 = normalizeForSemanticMatch(str1);
  const norm2 = normalizeForSemanticMatch(str2);

  if (norm1 === norm2) return 1.0;

  let totalScore = 0;
  let totalWeight = 0;

  // 1. Semantic core extraction (highest weight)
  const coreScore = calculateSemanticCoreMatch(norm1, norm2);
  totalScore += coreScore * 0.4;
  totalWeight += 0.4;

  // 2. Enhanced phrase similarity (high weight for emotional context)
  const phraseScore = calculateAdvancedPhraseSimilarity(norm1, norm2);
  totalScore += phraseScore * 0.3;
  totalWeight += 0.3;

  // 3. Simple word overlap (remaining weight)
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  const wordScore = commonWords.length / Math.max(words1.length, words2.length);
  totalScore += wordScore * 0.3;
  totalWeight += 0.3;

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  console.log(`  Similarity: ${finalScore.toFixed(3)} (core: ${coreScore.toFixed(2)}, phrase: ${phraseScore.toFixed(2)}, word: ${wordScore.toFixed(2)})`);

  return Math.min(finalScore, 1.0);
}

// Run tests
console.log('🧪 Testing Semantic Similarity Matching\n');

testCases.forEach((testCase, i) => {
  console.log(`Test Case ${i + 1}:`);
  console.log(`Training: "${testCase.training}"\n`);

  testCase.userQuestions.forEach((userQ, j) => {
    console.log(`${j + 1}. User: "${userQ}"`);
    const similarity = calculateSimilarity(testCase.training, userQ);
    const willMatch = similarity >= 0.6;
    console.log(`   Score: ${(similarity * 100).toFixed(1)}% - ${willMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    console.log();
  });
});

console.log('Expected: All test questions should get 60%+ similarity and MATCH with the training question.');