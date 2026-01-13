/**
 * PERSONA-AWARE PIPELINE
 * Filters and generates content with persona matching
 */

import { dnaFilterBatch } from '../filter/dnaFilter.js';
import { matchBatchToPersonas, getServingStatus } from '../personas/personaEngine.js';
import { generateGroundedContent } from '../generator/groundedGenerator.js';
import { getGroqClient } from '../llm/groqClient.js';

export async function runPersonaAwarePipeline(newsItems) {
  console.log('\n🎯 PERSONA-AWARE PIPELINE\n');
  
  let groq;
  try {
    groq = getGroqClient();
  } catch (e) {
    console.error('❌ Groq not configured:', e.message);
    return { results: [], stats: { error: 'Groq not configured' } };
  }
  
  // Step 1: DNA Filter
  console.log('🧬 Step 1: DNA Filtering...');
  const filtered = dnaFilterBatch(newsItems);
  console.log(`   Passed: ${filtered.passed.length}/${filtered.stats.total}`);
  
  if (filtered.passed.length === 0) {
    return { results: [], stats: filtered.stats };
  }
  
  // Step 2: Match to Personas
  console.log('\n👥 Step 2: Matching to Personas...');
  const matched = matchBatchToPersonas(filtered.passed.map(f => f.newsItem));
  
  console.log('   Persona distribution:');
  for (const [persona, count] of Object.entries(matched.stats.personaCounts)) {
    if (count > 0) {
      console.log(`      ${persona}: ${count}`);
    }
  }
  
  // Step 3: Check serving status
  const servingStatus = await getServingStatus();
  const underservedPersonas = servingStatus.needsAttention.map(p => p.id);
  
  console.log(`\n⚠️ Underserved personas: ${underservedPersonas.join(', ') || 'None'}`);
  
  // Step 4: Prioritize content for underserved personas
  const prioritized = prioritizeByPersona(matched.results, underservedPersonas);
  
  // Step 5: Generate content
  console.log('\n✍️ Step 3: Generating content...');
  const results = [];
  
  for (const item of prioritized.slice(0, 10)) {
    try {
      const content = item.newsItem.fullContent || item.newsItem.description || item.newsItem.title || '';
      const generated = await generateGroundedContent(content, item.newsItem, groq);
      
      if (generated.success) {
        results.push({
          ...generated,
          persona: item.primaryPersona,
          allPersonas: item.allMatches
        });
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 SUMMARY:');
  console.log(`   Total processed: ${results.length}`);
  const personasServed = [...new Set(results.map(r => r.persona?.personaId).filter(Boolean))];
  console.log(`   Personas served: ${personasServed.join(', ') || 'None'}`);
  
  return {
    results,
    stats: {
      ...matched.stats,
      servingStatus,
      underservedPersonas
    }
  };
}

function prioritizeByPersona(results, underservedPersonas) {
  // Sort: underserved personas first, then by match score
  return results.sort((a, b) => {
    const aUnderserved = underservedPersonas.includes(a.primaryPersona?.personaId) ? 1 : 0;
    const bUnderserved = underservedPersonas.includes(b.primaryPersona?.personaId) ? 1 : 0;
    
    if (aUnderserved !== bUnderserved) {
      return bUnderserved - aUnderserved; // Underserved first
    }
    
    return (b.primaryPersona?.score || 0) - (a.primaryPersona?.score || 0);
  });
}




