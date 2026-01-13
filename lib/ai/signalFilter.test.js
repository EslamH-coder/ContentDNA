/**
 * TEST CASES for Signal Filter V4.1
 */

import { filterSignal } from './signalFilter.js';

// Test 1: Should SKIP - Kraken Technologies (no relevant keywords)
const test1 = {
  title: "Origin Energy Ltd. said Kraken Technologies Ltd., a software platform that helps utilities manage the transition to cleaner energy, has been valued at $8.65 billion",
  description: "The valuation comes as part of a funding round for the UK-based energy software company.",
  source: "Bloomberg Direct"
};

// Test 2: Should PASS - China tariffs (matches: china, usa, tariffs)
const test2 = {
  title: "China retaliates with tariffs on $50 billion of US goods",
  description: "Beijing announces new tariffs in response to US trade measures.",
  source: "Reuters"
};

// Test 3: Should PASS - Tesla (matches: tesla)
const test3 = {
  title: "Tesla robotaxis now cheaper than Uber in San Francisco",
  description: "Elon Musk's autonomous taxi service launches at competitive rates.",
  source: "Bloomberg"
};

// Test 4: Should SKIP - Local town (blacklisted: town)
const test4 = {
  title: "Small Iowa town bans AI in government offices",
  description: "Local city council votes to prohibit artificial intelligence tools.",
  source: "Local News"
};

// Test 5: Should PASS - Saudi Aramco (matches: saudi, aramco)
const test5 = {
  title: "Saudi Aramco reports record profits",
  description: "The oil giant announces strong quarterly earnings.",
  source: "Financial Times"
};

// Test 6: Should SKIP - Netflix show (no relevant keywords)
const test6 = {
  title: "Netflix announces new original series",
  description: "Streaming platform reveals upcoming content lineup.",
  source: "Entertainment Weekly"
};

// Test 7: Should PASS - Gold prices (matches: gold)
const test7 = {
  title: "Gold prices surge to record high",
  description: "Precious metal reaches new peak amid economic uncertainty.",
  source: "Bloomberg"
};

function runTests() {
  console.log('\n🧪 Running Signal Filter Tests...\n');
  
  const tests = [
    { name: 'Test 1: Kraken Technologies', item: test1, expected: 'SKIP' },
    { name: 'Test 2: China Tariffs', item: test2, expected: 'PASS' },
    { name: 'Test 3: Tesla Robotaxi', item: test3, expected: 'PASS' },
    { name: 'Test 4: Iowa Town', item: test4, expected: 'SKIP' },
    { name: 'Test 5: Saudi Aramco', item: test5, expected: 'PASS' },
    { name: 'Test 6: Netflix Show', item: test6, expected: 'SKIP' },
    { name: 'Test 7: Gold Prices', item: test7, expected: 'PASS' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log(`Title: ${test.item.title.substring(0, 60)}...`);
    
    const result = filterSignal(test.item);
    
    const expectedPass = test.expected === 'PASS';
    const actualPass = result.passed;
    const testPassed = expectedPass === actualPass;
    
    if (testPassed) {
      passed++;
      console.log(`✅ PASS - Expected: ${test.expected}, Got: ${result.passed ? 'PASS' : 'SKIP'}`);
    } else {
      failed++;
      console.log(`❌ FAIL - Expected: ${test.expected}, Got: ${result.passed ? 'PASS' : 'SKIP'}`);
    }
    
    console.log(`   Reason: ${result.reason}`);
    console.log(`   Matched Keywords: ${result.matchedKeywords.slice(0, 3).join(', ') || 'none'}`);
    console.log(`   Confidence: ${result.confidence}%`);
  }
  
  console.log('\n' + '─'.repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('─'.repeat(50) + '\n');
  
  return { passed, failed, total: tests.length };
}

// Export for use in other files
export { test1, test2, test3, test4, test5, test6, test7, runTests };

// Run if executed directly (Node.js)
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}




