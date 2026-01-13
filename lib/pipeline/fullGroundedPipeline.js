/**
 * FULL GROUNDED PIPELINE
 * Combines DNA filter + Grounded Generation + Competitor Intelligence
 */

import { dnaFilterBatch } from '../filter/dnaFilter.js';
import { generateGroundedContent } from '../generator/groundedGenerator.js';
import { enhanceWithCompetitorInsights } from '../generator/competitorEnhancer.js';
import { getGroqClient } from '../llm/groqClient.js';

// ============================================
// FULL PIPELINE
// ============================================
export async function runGroundedPipeline(newsItems) {
  console.log('\n🚀 GROUNDED PIPELINE\n');
  console.log('='.repeat(50));
  
  let groq;
  try {
    groq = getGroqClient();
  } catch (e) {
    console.error('❌ Groq not configured:', e.message);
    return { results: [], stats: { error: 'Groq not configured' } };
  }
  
  const results = [];
  
  // Step 1: DNA Filter
  console.log('\n🧬 Step 1: DNA Filtering...');
  const filtered = dnaFilterBatch(newsItems);
  console.log(`   Passed: ${filtered.stats.passed}/${filtered.stats.total}`);
  
  if (filtered.passed.length === 0) {
    return { results: [], stats: filtered.stats };
  }
  
  // Step 2: Process each passed item
  console.log('\n✍️ Step 2: Grounded Generation...');
  
  for (const item of filtered.passed.slice(0, 10)) { // Limit to 10
    const newsItem = item.newsItem;
    console.log(`\n   📰 Processing: ${newsItem.title?.substring(0, 50) || 'No title'}...`);
    
    try {
      // Get article content
      const content = newsItem.fullContent || newsItem.description || newsItem.title || '';
      
      // Generate grounded content
      const generated = await generateGroundedContent(content, newsItem, groq);
      
      if (!generated.success) {
        console.log(`   ❌ Generation failed: ${generated.error}`);
        continue;
      }
      
      // Enhance with competitor insights
      const topic = extractMainTopic(newsItem.title || '');
      const enhanced = await enhanceWithCompetitorInsights(
        generated.output,
        topic,
        groq
      );
      
      results.push({
        newsItem,
        dnaScore: item.score,
        output: enhanced,
        facts: generated.facts,
        validation: generated.validation,
        wasFixed: generated.wasFixed
      });
      
      console.log(`   ✅ Done - Valid: ${generated.validation.valid}, Fixed: ${generated.wasFixed}`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Sort by quality
  results.sort((a, b) => (b.validation?.score || 0) - (a.validation?.score || 0));
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Pipeline complete: ${results.length} items processed`);
  
  return {
    results,
    stats: {
      ...filtered.stats,
      processed: results.length,
      withFixes: results.filter(r => r.wasFixed).length,
      avgValidationScore: results.length > 0
        ? (results.reduce((sum, r) => sum + (r.validation?.score || 0), 0) / results.length).toFixed(1)
        : 0
    }
  };
}

function extractMainTopic(title) {
  if (!title) return 'general';
  const lower = title.toLowerCase();
  
  if (lower.includes('trump') || lower.includes('ترامب')) return 'trump';
  if (lower.includes('china') || lower.includes('الصين')) return 'china';
  if (lower.includes('russia') || lower.includes('روسيا')) return 'russia';
  if (lower.includes('oil') || lower.includes('نفط')) return 'oil';
  if (lower.includes('dollar') || lower.includes('دولار')) return 'dollar';
  
  return 'general';
}




