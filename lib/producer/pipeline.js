/**
 * MAIN PRODUCER PIPELINE
 * The complete flow from news to content
 */

import { loadProducerContext, getProducerContext } from './contextLoader.js';
import { fetchFullArticle, extractStoryElements, buildStoryProfile } from './deepReader.js';
import { findBestAngle, scorePotential } from './producerBrain.js';
import { generateContent } from './contentGenerator.js';

// ============================================
// INITIALIZE SYSTEM
// ============================================
export async function initializeProducerSystem() {
  console.log('🚀 Initializing Producer System...');
  
  // Load all context FIRST
  await loadProducerContext();
  
  console.log('✅ Producer System Ready');
}

// ============================================
// PROCESS SINGLE NEWS ITEM
// ============================================
export async function processNewsItem(newsItem, llmClient) {
  const ctx = getProducerContext();
  
  console.log(`\n📰 Processing: ${newsItem.title?.substring(0, 50) || 'Untitled'}...`);
  
  // Step 1: Fetch full article
  console.log('   📖 Fetching full article...');
  const fullArticle = await fetchFullArticle(newsItem.link || newsItem.url);
  
  if (!fullArticle.success) {
    console.log('   ⚠️ Could not fetch article, using title/description only');
    fullArticle.content = newsItem.description || newsItem.title || '';
    fullArticle.title = newsItem.title || 'Untitled';
  }
  
  // Step 2: Extract story elements
  console.log('   🔍 Extracting story elements...');
  const elements = await extractStoryElements(fullArticle.content, llmClient);
  
  // Step 3: Build story profile
  console.log('   📊 Building story profile...');
  const profile = buildStoryProfile(fullArticle, elements);
  
  // Step 4: Find best angle (Producer thinking)
  console.log('   🧠 Finding best angle...');
  const angle = await findBestAngle(profile, llmClient);
  
  // Step 5: Score potential BEFORE generating
  console.log('   📈 Scoring potential...');
  const potential = scorePotential(profile, angle);
  
  if (potential.recommendation === 'SKIP') {
    console.log(`   ⏭️ Skipping - low potential (${potential.score})`);
    return {
      newsItem,
      status: 'SKIPPED',
      reason: 'Low potential based on behavior patterns',
      potential
    };
  }
  
  // Step 6: Generate content
  console.log('   ✍️ Generating content...');
  const content = await generateContent(profile, angle, llmClient);
  
  console.log(`   ✅ Done - Score: ${content.validation.score}`);
  
  return {
    newsItem,
    status: 'GENERATED',
    
    // The output
    title: content.title,
    hook: content.hook,
    angle: content.angle_description,
    
    // Quality info
    potential,
    validation: content.validation,
    
    // For debugging/learning
    _debug: {
      profile,
      angle,
      patterns_used: content.patterns_used
    }
  };
}

// ============================================
// PROCESS BATCH OF NEWS
// ============================================
export async function processNewsBatch(newsItems, llmClient) {
  const results = [];
  
  for (const item of newsItems) {
    const result = await processNewsItem(item, llmClient);
    results.push(result);
  }
  
  // Sort by potential
  results.sort((a, b) => 
    (b.potential?.score || 0) - (a.potential?.score || 0)
  );
  
  return results;
}




