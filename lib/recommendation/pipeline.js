import { classifyItem } from './classifier.js';
import { filterWithDna } from './filter.js';
import { enrichWithDna } from './enricher.js';
import { buildGenerationPrompt, generateFallbackTitle } from './generator.js';
import { smartRecommendBatch } from './smartPipeline.js';

export async function recommendTopic(rssItem, showDna, llmClient = null) {
  // Stage 1: Classify
  const classified = classifyItem(rssItem);
  
  // Stage 2: Filter
  const filterResult = filterWithDna(classified, showDna);
  
  if (!filterResult.passed) {
    return {
      status: 'REJECTED',
      item_id: classified.item_id,
      title: rssItem.title || 'No title',
      reasons: filterResult.rejections,
      score: filterResult.final_score || 0
    };
  }
  
  // Stage 3: Enrich
  const enriched = enrichWithDna(classified, filterResult, showDna);
  
  // Stage 4: Generate
  let output;
  
  if (enriched.decisions.confidence.level !== 'LOW' && llmClient) {
    try {
      const { systemPrompt, userPrompt } = buildGenerationPrompt(enriched);
      
      // Call LLM (Anthropic-style client)
      let response;
      if (llmClient && llmClient.messages && typeof llmClient.messages.create === 'function') {
        const message = await llmClient.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
          ]
        });
        response = message.content[0].text;
      } else if (typeof llmClient === 'function') {
        response = await llmClient(systemPrompt, userPrompt);
      } else {
        throw new Error('Invalid LLM client');
      }
      
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        output = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('LLM failed, using fallback:', e.message);
      output = generateFallbackTitle(enriched);
    }
  } else {
    output = generateFallbackTitle(enriched);
  }
  
  return {
    status: 'RECOMMENDED',
    priority: filterResult.priority,
    
    // Summary
    summary: {
      title: output.title_ar,
      topic: classified.classification.topic.primary_topic,
      hook_type: enriched.decisions.hook.type,
      format: enriched.decisions.format.recommended,
      confidence: enriched.decisions.confidence.score,
      arab_angle: output.arab_angle
    },
    
    // Full details
    classification: classified.classification,
    filter: filterResult,
    decisions: enriched.decisions,
    output,
    
    // Original
    original: rssItem
  };
}

// Process batch of RSS items
// Now uses smart story-based pipeline instead of template-based
export async function recommendBatch(rssItems, showDna, llmClient = null, options = {}) {
  // Use smart pipeline (story-based, multiple angles)
  return await smartRecommendBatch(rssItems, showDna, llmClient, options);
}

