/**
 * MAIN PROCESSOR - Combines Filter + Pitcher
 */

import { filterSignal, filterSignals } from './signalFilter.js';
import { generatePitch } from './signalPitcher.js';

// ============================================================
// PROCESS SINGLE SIGNAL
// ============================================================
export async function processSignal(rssItem, options = {}) {
  console.log(`\n📰 Processing: "${(rssItem.title || rssItem.topic || '').substring(0, 50)}..."`);
  
  // Step 1: Filter
  const filterResult = filterSignal(rssItem);
  console.log(`   Filter: ${filterResult.passed ? '✅ PASSED' : '❌ SKIPPED'}`);
  console.log(`   Reason: ${filterResult.reason}`);
  
  if (!filterResult.passed) {
    return {
      success: true,
      skipped: true,
      filter: filterResult,
      rssItem
    };
  }
  
  // Step 2: Generate pitch (only if passed filter)
  const pitchResult = await generatePitch(rssItem, filterResult, options);
  
  return {
    success: pitchResult.success,
    skipped: false,
    filter: filterResult,
    pitch: pitchResult.pitch,
    rssItem
  };
}

// ============================================================
// PROCESS MULTIPLE SIGNALS
// ============================================================
export async function processAllSignals(rssItems, options = {}) {
  console.log('\n' + '═'.repeat(50));
  console.log('🎯 SIGNAL PROCESSOR V4.1');
  console.log('═'.repeat(50));
  
  const results = {
    processed: [],
    skipped: [],
    errors: [],
    summary: {}
  };
  
  // Step 1: Filter all items first (fast)
  console.log('\n📋 Step 1: Filtering...');
  const filterResults = filterSignals(rssItems);
  console.log(`   Passed: ${filterResults.passed.length}`);
  console.log(`   Skipped: ${filterResults.skipped.length}`);
  
  // Add skipped items to results
  results.skipped = filterResults.skipped.map(s => ({
    skipped: true,
    filter: s.filter,
    rssItem: s.item
  }));
  
  // Step 2: Generate pitches only for passed items
  console.log('\n📝 Step 2: Generating pitches...');
  for (const { item, filter } of filterResults.passed) {
    try {
      const pitchResult = await generatePitch(item, filter, options);
      
      if (pitchResult.success) {
        results.processed.push({
          skipped: false,
          filter,
          pitch: pitchResult.pitch,
          rssItem: item
        });
        console.log(`   ✅ "${(item.title || item.topic || '').substring(0, 40)}..."`);
      } else {
        results.errors.push({
          rssItem: item,
          error: pitchResult.error
        });
        console.log(`   ⚠️ Error: "${(item.title || item.topic || '').substring(0, 40)}..."`);
      }
    } catch (error) {
      results.errors.push({ rssItem: item, error: error.message });
      console.log(`   ⚠️ Exception: ${error.message}`);
    }
  }
  
  // Summary
  results.summary = {
    total: rssItems.length,
    processed: results.processed.length,
    skipped: results.skipped.length,
    errors: results.errors.length,
    passRate: Math.round((results.processed.length / rssItems.length) * 100) + '%'
  };
  
  console.log('\n' + '─'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('─'.repeat(50));
  console.log(`   Total Items: ${results.summary.total}`);
  console.log(`   ✅ Processed: ${results.summary.processed}`);
  console.log(`   ❌ Skipped: ${results.summary.skipped}`);
  console.log(`   ⚠️ Errors: ${results.summary.errors}`);
  console.log(`   Pass Rate: ${results.summary.passRate}`);
  
  return results;
}




