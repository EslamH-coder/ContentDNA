import { getDNASystemPrompt, buildDNAUserPrompt } from '../prompts/dnaPrompt.js';
import { processContent } from '../quality/contentProcessor.js';

/**
 * DNA-INFORMED LLM CALL
 * The key difference: LLM now has Channel DNA in context
 */

// Banned phrases - check output against these
const BANNED_PHRASES = [
  'هل تعلم',
  'ما لا تعرفه',
  'الحقائق المخفية',
  'السر الذي',
  'في بلدك',
  'فاتورتك',
  'أسعارك',
  'كل شيء سيتغير',
  'ومعه خطة',
  'عائد لـ',
  'عائد إلى',
  'دعني أخبرك',
  'في هذا المقال',
  'سنتعرف على',
  'اليوم سنتحدث'
];

// Validate output
function validateOutput(title, hook) {
  const content = (title + ' ' + hook).toLowerCase();
  
  for (const phrase of BANNED_PHRASES) {
    if (content.includes(phrase.toLowerCase())) {
      return {
        valid: false,
        reason: `Contains banned phrase: "${phrase}"`
      };
    }
  }
  
  // Check for English in title
  if (/[a-zA-Z]{3,}/.test(title)) {
    return {
      valid: false,
      reason: 'Title contains English words'
    };
  }
  
  // Check for required elements
  const hasNumber = /\d+(%|مليون|مليار|تريليون|دولار|ريال)/.test(content);
  
  if (!hasNumber && !/\?/.test(title)) {
    // Allow questions without numbers, but prefer numbers
    return {
      valid: true,
      warning: 'Missing specific number'
    };
  }
  
  return { valid: true };
}

// Parse LLM response
function parseResponse(response) {
  // Try different patterns
  let titleMatch = response.match(/عنوان:\s*(.+?)(?:\n|$)/i);
  let hookMatch = response.match(/هوك:\s*(.+?)(?:\n|$)/i);
  
  // If not found, try without colon
  if (!titleMatch) {
    titleMatch = response.match(/العنوان[:\s]+(.+?)(?:\n|$)/i);
  }
  if (!hookMatch) {
    hookMatch = response.match(/الهوك[:\s]+(.+?)(?:\n|$)/i);
  }
  
  // If still not found, try to extract first two lines
  if (!titleMatch || !hookMatch) {
    const lines = response.split('\n').filter(l => l.trim().length > 10);
    if (lines.length >= 2) {
      titleMatch = { 1: lines[0].replace(/^(عنوان|title)[:\s]+/i, '').trim() };
      hookMatch = { 1: lines[1].replace(/^(هوك|hook)[:\s]+/i, '').trim() };
    }
  }
  
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    hook: hookMatch ? hookMatch[1].trim() : null
  };
}

// Fallback templates when LLM fails
function buildFallbackTitle(data) {
  const entity = data.entity_title || data.entity || 'الخبر';
  const action = data.action || '';
  const number = data.number || '';
  
  if (number) {
    return `لماذا ${entity} ${action} ${number}؟`;
  }
  if (action) {
    return `لماذا ${entity} ${action}؟`;
  }
  return `لماذا ${entity}؟`;
}

function buildFallbackHook(data, newsItem) {
  const entity = data.entity_title || data.entity || '';
  const action = data.action || '';
  const number = data.number || '';
  const source = newsItem.source || 'التقارير';
  const date = data.date || newsItem.dateForHook || '';
  
  if (date && entity) {
    return `في ${date} ${entity} ${action}${number ? ' ' + number : ''}. بحسب ${source}...`;
  }
  
  if (number) {
    return `${number}... هذا يعني أن أسواق الخليج ستتأثر بشكل مباشر. بحسب ${source}...`;
  }
  
  if (entity && action) {
    return `${entity} ${action}. بحسب ${source}...`;
  }
  
  return `بحسب ${source}...`;
}

// Main function
export async function generateWithDNA(newsItem, extractedData, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    // No LLM available, use fallback
    return {
      success: true,
      title: buildFallbackTitle(extractedData),
      hook: buildFallbackHook(extractedData, newsItem),
      used_fallback: true,
      rejection_reason: 'LLM client not available'
    };
  }

  // Build prompt with DNA (load from Living DNA if available)
  const systemPrompt = await getDNASystemPrompt();
  const userPrompt = buildDNAUserPrompt(newsItem, extractedData);
  
  try {
    // Get DNA system prompt (async - loads from Living DNA)
    const systemPrompt = await getDNASystemPrompt();
    
    // Call LLM with DNA context
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,  // Lower = more consistent
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
      ]
    });
    
    const responseText = response.content[0].text.trim();
    
    // Parse response
    const { title, hook } = parseResponse(responseText);
    
    if (!title || !hook) {
      console.warn('Could not parse LLM response, using fallback');
      return {
        success: true,
        title: buildFallbackTitle(extractedData),
        hook: buildFallbackHook(extractedData, newsItem),
        used_fallback: true,
        rejection_reason: 'Could not parse LLM response',
        raw_response: responseText
      };
    }
    
    // NEW APPROACH: Auto-fix + Quality Score (never reject)
    const processed = processContent(
      { title, hook },
      extractedData,
      newsItem
    );
    
    // Log quality info
    if (processed.overallQuality.score < 50) {
      console.log(`⚠️  Low quality content (score: ${processed.overallQuality.score}), but auto-fixed and shown`);
      if (processed.warnings.length > 0) {
        console.log(`   Warnings: ${processed.warnings.join(', ')}`);
      }
    }
    
    return {
      success: true,
      title: processed.title,
      hook: processed.hook,
      used_fallback: processed.processing.title.usedFallback || processed.processing.hook.usedFallback,
      
      // Quality information
      quality: processed.overallQuality,
      titleQuality: processed.titleQuality,
      hookQuality: processed.hookQuality,
      warnings: processed.warnings,
      
      // Processing details
      processing: processed.processing,
      
      // Original LLM output (for debugging)
      llm_output: { title, hook }
    };
  } catch (e) {
    console.error('LLM call failed:', e.message);
    return {
      success: true,
      title: buildFallbackTitle(extractedData),
      hook: buildFallbackHook(extractedData, newsItem),
      used_fallback: true,
      rejection_reason: `LLM error: ${e.message}`
    };
  }
}

