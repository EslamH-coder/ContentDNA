import { validateVoice, suggestFixes } from './voiceValidator.js';
import { HOOK_PATTERNS, TITLE_PATTERNS } from './channelPatterns.js';

/**
 * GENERATE CONTENT IN CHANNEL VOICE
 */

export function generateHook(newsItem, extractedData) {
  // Determine best pattern based on available data
  const pattern = selectPattern(extractedData);
  
  if (!pattern) {
    return {
      error: 'Insufficient data for channel-voice hook',
      required: 'Need: full date + entity, OR question + answer, OR product + number'
    };
  }
  
  // Generate using pattern
  const hook = fillPattern(pattern, extractedData);
  
  // Validate
  const validation = validateVoice(hook);
  
  // If not valid, try to fix
  if (!validation.valid) {
    return {
      hook,
      validation,
      fixes: suggestFixes(hook, validation),
      status: 'NEEDS_FIXES'
    };
  }
  
  return {
    hook,
    pattern: pattern.id,
    validation,
    status: 'APPROVED'
  };
}

function selectPattern(data) {
  // Priority 1: Date + Entity (best performer)
  if (data.full_date && data.entity_with_title && data.action) {
    return HOOK_PATTERNS.DATE_ANCHOR;
  }
  
  // Priority 2: Question + Answer
  if (data.question && data.answer) {
    return HOOK_PATTERNS.QUESTION_ANSWER;
  }
  
  // Priority 3: Product + Number
  if (data.product && data.big_number) {
    return HOOK_PATTERNS.PRODUCT_SCALE;
  }
  
  // Priority 4: News + Source
  if (data.official_source && data.news) {
    return HOOK_PATTERNS.NEWS_SOURCE;
  }
  
  return null;
}

function fillPattern(pattern, data) {
  let result = pattern.template;
  
  // Replace all placeholders
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  
  // Clean up unfilled placeholders
  result = result.replace(/\{[^}]+\}/g, '').trim();
  
  return result;
}

export function generateTitle(newsItem, extractedData) {
  const titles = [];
  
  // Try WHY pattern
  if (extractedData.entity && extractedData.action) {
    const whyTitle = `لماذا ${extractedData.entity} ${extractedData.action}؟`;
    const whyValidation = validateVoice(whyTitle);
    
    if (whyValidation.valid || whyValidation.score >= 70) {
      titles.push({
        title: whyTitle,
        pattern: 'WHY_ENTITY',
        validation: whyValidation
      });
    }
  }
  
  // Try HOW pattern
  if (extractedData.entity && extractedData.mechanism) {
    const howTitle = `كيف ${extractedData.entity} ${extractedData.mechanism}؟`;
    const howValidation = validateVoice(howTitle);
    
    if (howValidation.valid || howValidation.score >= 70) {
      titles.push({
        title: howTitle,
        pattern: 'HOW_ENTITY',
        validation: howValidation
      });
    }
  }
  
  // Sort by validation score
  titles.sort((a, b) => b.validation.score - a.validation.score);
  
  return {
    best: titles[0] || null,
    alternatives: titles.slice(1),
    warning: titles.length === 0 ? 'Could not generate valid title' : null
  };
}

