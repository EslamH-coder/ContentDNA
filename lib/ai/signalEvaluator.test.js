/**
 * TEST CASES for Signal Evaluator V4
 * Run these to verify the evaluator works correctly
 */

import { evaluateSignal, processSignal } from './signalEvaluator.js';

// Test 1: Should SKIP - Local British company news
const test1 = {
  title: "Origin Energy Ltd. said Kraken Technologies Ltd., a software platform that helps utilities manage the transition to cleaner energy, has been valued at $8.65 billion",
  description: "The valuation comes as part of a funding round for the UK-based energy software company.",
  source: "Bloomberg Direct"
};

// Test 2: Should PROCEED - Global impact
const test2 = {
  title: "China retaliates with tariffs on $50 billion of US goods",
  description: "Beijing announces new tariffs in response to US trade measures, escalating trade tensions.",
  source: "Reuters"
};

// Test 3: Should PROCEED - Tech disruption
const test3 = {
  title: "Tesla robotaxis now cheaper than Uber in San Francisco",
  description: "Elon Musk's autonomous taxi service launches at competitive rates, disrupting ride-sharing market.",
  source: "Bloomberg"
};

// Test 4: Should SKIP - Too local
const test4 = {
  title: "Small Iowa town bans AI in government offices",
  description: "Local city council votes to prohibit artificial intelligence tools in municipal operations.",
  source: "Local News"
};

// Test 5: Should PROCEED - Direct Arab impact
const test5 = {
  title: "UAE signs $20 billion green energy deal with China",
  description: "Abu Dhabi announces major renewable energy partnership with Chinese companies.",
  source: "Gulf News"
};

// Test 6: Should SKIP - Corporate appointment
const test6 = {
  title: "New CEO appointed at Japanese electronics firm",
  description: "Company announces leadership change after previous CEO retirement.",
  source: "Nikkei"
};

async function runTests() {
  console.log('\n🧪 Running Signal Evaluator Tests...\n');
  
  const tests = [
    { name: 'Test 1: Local UK Company', item: test1, expected: 'SKIP' },
    { name: 'Test 2: China-US Trade War', item: test2, expected: 'PROCEED' },
    { name: 'Test 3: Tesla Robotaxi', item: test3, expected: 'PROCEED' },
    { name: 'Test 4: Local US Town', item: test4, expected: 'SKIP' },
    { name: 'Test 5: UAE-China Deal', item: test5, expected: 'PROCEED' },
    { name: 'Test 6: Japanese CEO', item: test6, expected: 'SKIP' }
  ];
  
  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log(`Title: ${test.item.title.substring(0, 60)}...`);
    
    try {
      const result = await processSignal(test.item);
      
      const passed = result.skipped === (test.expected === 'SKIP');
      const status = passed ? '✅ PASS' : '❌ FAIL';
      
      console.log(`${status} - Expected: ${test.expected}, Got: ${result.skipped ? 'SKIP' : 'PROCEED'}`);
      
      if (result.evaluation) {
        console.log(`   Confidence: ${result.evaluation.confidence}/10`);
        console.log(`   Reason: ${result.evaluation.reason}`);
        console.log(`   Relevance: ${result.evaluation.relevance_type}`);
      }
      
      if (result.pitch) {
        console.log(`   Pitch Title: ${result.pitch.title}`);
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n✅ Tests completed!\n');
}

// Export for use in other files
export { test1, test2, test3, test4, test5, test6, runTests };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}




