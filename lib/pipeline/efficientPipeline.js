/**
 * EFFICIENT PIPELINE
 * DNA Filter → Groq → Only best stories get full processing
 */

import { dnaFilterBatch, dnaFilter } from '../filter/dnaFilter.js';
import { getGroqClient } from '../llm/groqClient.js';
import { loadProducerContext, generateProducerSystemPrompt } from '../producer/contextLoader.js';

// ============================================
// MAIN EFFICIENT PIPELINE
// ============================================
export async function processNewsEfficiently(newsItems) {
  console.log(`\n📰 Processing ${newsItems.length} news items efficiently...\n`);
  
  // ============================================
  // STAGE 1: DNA FILTER (FREE - No API calls)
  // ============================================
  console.log('🧬 Stage 1: DNA Filtering (FREE)...');
  const filterStart = Date.now();
  
  const filterResults = dnaFilterBatch(newsItems);
  
  console.log(`   ✅ Filtered in ${Date.now() - filterStart}ms`);
  console.log(`   📊 Results:`);
  console.log(`      - Total: ${filterResults.stats.total}`);
  console.log(`      - Passed DNA: ${filterResults.stats.passed} (${filterResults.stats.passRate})`);
  console.log(`      - High Priority: ${filterResults.stats.highPriority}`);
  console.log(`      - 💰 Savings: ${filterResults.stats.estimatedSavings}`);
  
  // Show top rejection reasons
  if (filterResults.stats.rejectionReasons && filterResults.stats.rejectionReasons.length > 0) {
    console.log(`   📋 Top rejection reasons:`);
    filterResults.stats.rejectionReasons.slice(0, 5).forEach(([reason, count]) => {
      console.log(`      - ${reason}: ${count}`);
    });
  }
  
  if (filterResults.toProcess.length === 0) {
    console.log('   ⚠️ No items passed DNA filter');
    return {
      results: [],
      stats: filterResults.stats
    };
  }
  
  // ============================================
  // STAGE 2: DEEP ANALYSIS WITH GROQ (FREE)
  // ============================================
  console.log(`\n🧠 Stage 2: Deep analysis with Groq (${filterResults.toProcess.length} items)...`);
  
  let groq;
  try {
    groq = getGroqClient();
    if (!groq.apiKey) {
      console.log('   ⚠️ Groq not configured, skipping deep analysis');
      return {
        results: filterResults.toProcess.map(f => ({
          newsItem: f.newsItem,
          dnaFilterScore: f.score,
          title: f.newsItem.title,
          hook: f.newsItem.description?.substring(0, 200) || '',
          finalScore: f.score,
          status: 'DNA_FILTER_ONLY'
        })),
        stats: filterResults.stats
      };
    }
  } catch (error) {
    console.error('   ❌ Failed to initialize Groq:', error.message);
    return {
      results: [],
      stats: filterResults.stats,
      error: error.message
    };
  }
  
  const ctx = await loadProducerContext().catch(() => null);
  const systemPrompt = ctx ? generateProducerSystemPrompt() : null;
  
  const results = [];
  
  for (const filtered of filterResults.toProcess) {
    const item = filtered.newsItem;
    console.log(`\n   📖 Processing: ${item.title?.substring(0, 50) || 'Untitled'}...`);
      console.log(`      DNA Filter score: ${filtered.score} (${filtered.pass ? 'PASS' : 'FAIL'})`);
    
    try {
      // Get article content (use description if no full article)
      const content = item.fullContent || item.description || item.title;
      
      // Extract elements with Groq
      console.log('      🔍 Extracting elements...');
      const elements = await groq.extractStoryElements(content);
      
      if (!elements) {
        console.log('      ⚠️ Failed to extract elements, skipping');
        continue;
      }
      
      // Find angle with Groq
      console.log('      🎯 Finding angle...');
      const angle = await groq.findAngle(elements, ctx);
      
      if (!angle || angle.confidence < 5) {
        console.log(`      ⚠️ Low confidence angle (${angle?.confidence || 0}), skipping`);
        continue;
      }
      
      // Generate content with Groq
      console.log('      ✍️ Generating content...');
      const generated = await groq.generateContent(angle, elements, systemPrompt);
      
      if (!generated) {
        console.log('      ⚠️ Failed to generate content');
        continue;
      }
      
      // Validate output
      const validation = validateOutput(generated, ctx);
      
      results.push({
        // Original
        newsItem: item,
        dnaFilterScore: filtered.score,
        
        // Generated
        title: generated.title,
        hook: generated.hook,
        angle: angle.angle,
        
        // Quality
        confidence: angle.confidence,
        validation,
        finalScore: calculateFinalScore(filtered.score, angle.confidence, validation),
        
        // Details
        elements,
        patterns_used: generated.patterns_used
      });
      
      console.log(`      ✅ Done - Final score: ${results[results.length - 1].finalScore}`);
      
    } catch (error) {
      console.error(`      ❌ Error: ${error.message}`);
    }
  }
  
  // Sort by final score
  results.sort((a, b) => b.finalScore - a.finalScore);
  
  console.log(`\n✅ Pipeline complete!`);
  console.log(`   Processed: ${results.length}/${filterResults.toProcess.length}`);
  console.log(`   API calls used: ~${results.length * 3} (vs ${newsItems.length * 3} without filter)`);
  
  return {
    results,
    stats: {
      ...filterResults.stats,
      processed: results.length,
      apiCallsUsed: results.length * 3,
      apiCallsSaved: (newsItems.length - results.length) * 3
    },
    skipped: filterResults.skipped
  };
}

// ============================================
// VALIDATE OUTPUT
// ============================================
function validateOutput(generated, ctx) {
  const issues = [];
  const passed = [];
  
  const title = generated.title || '';
  const hook = generated.hook || '';
  
  // Check banned phrases
  const bannedPhrases = [
    'هل تعلم', 'هل تعرف', 'ما لا تعرفه', 'الحقائق المخفية',
    'في بلدك', 'فاتورتك', 'أسعارك'
  ];
  
  for (const phrase of bannedPhrases) {
    if (title.includes(phrase) || hook.includes(phrase)) {
      issues.push(`Contains banned phrase: ${phrase}`);
    }
  }
  
  // Check question start
  if (/^(هل|كيف|لماذا)/.test(title)) {
    passed.push('Starts with question');
  } else {
    issues.push('Does not start with question');
  }
  
  // Check title length
  if (title.length >= 30 && title.length <= 80) {
    passed.push('Good title length');
  } else {
    issues.push('Title length issue');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    passed,
    score: Math.max(0, 100 - (issues.length * 25))
  };
}

// ============================================
// CALCULATE FINAL SCORE
// ============================================
function calculateFinalScore(dnaFilterScore, confidence, validation) {
  // Weighted average
  const score = (
    preFilterScore * 0.3 +
    confidence * 10 * 0.3 +
    validation.score * 0.4
  );
  
  return Math.round(score);
}

// ============================================
// QUICK PROCESS (Single item)
// ============================================
export async function processNewsItemQuick(newsItem) {
      // DNA Filter first
      const filtered = dnaFilter(newsItem);
  
  if (!filtered.pass) {
    return {
      processed: false,
      reason: 'Did not pass pre-filter',
      score: filtered.score,
      newsItem
    };
  }
  
  // Process with Groq
  const results = await processNewsEfficiently([newsItem]);
  
  return results.results[0] || {
    processed: false,
    reason: 'Processing failed',
    newsItem
  };
}

