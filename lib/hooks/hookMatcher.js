import { ENHANCED_DNA } from '../dna/enhancedDna.js';

/**
 * HOOK PATTERN MATCHER
 * Match content to best hook patterns from actual transcript data
 */

// ============================================
// Extract elements from content
// ============================================
function extractHookElements(item) {
  const content = `${item.title || ''} ${item.description || ''}`;
  
  return {
    // Dates
    has_specific_date: /\b(20\d{2}|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\b/i.test(content),
    dates_found: content.match(/\b\d{1,2}\s*(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*20\d{2}\b/gi) || [],
    
    // Numbers
    has_big_number: /\b\d+\s*(تريليون|مليار|مليون|billion|million|trillion)\b/i.test(content),
    numbers_found: content.match(/\$?\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:تريليون|مليار|مليون|billion|million|trillion|%|B|M))?/gi) || [],
    
    // Entities
    has_major_entity: /\b(ترامب|ترمب|Trump|بايدن|Biden|ماسك|Musk|أبل|Apple|تسلا|Tesla|مايكروسوفت|Microsoft|الصين|China|أمريكا|إيران|روسيا)\b/i.test(content),
    entities_found: content.match(/\b(ترامب|ترمب|Trump|بايدن|Biden|ماسك|Musk|أبل|Apple|تسلا|Tesla|مايكروسوفت|Microsoft|جوجل|Google|أمازون|Amazon)\b/gi) || [],
    
    // Questions
    has_question: /\?|هل\s|لماذا\s|كيف\s|ما\s|ماذا\s/i.test(content),
    
    // Official sources
    has_official_source: /\b(رويترز|Reuters|بلومبرج|Bloomberg|الحكومة|التلفزيون|وزارة|official|government)\b/i.test(content),
    
    // Viewer address
    has_viewer_address: /\b(برأيك|رأيك|أنت|إنت|لك|عليك)\b/i.test(content),
    
    // Content for pattern matching
    content: content
  };
}

// ============================================
// Calculate pattern match score
// ============================================
function calculatePatternMatch(elements, pattern) {
  let matchScore = 0;
  const matchedElements = [];
  const missingElements = [];
  
  // Check required elements for each pattern
  switch (pattern.pattern_id) {
    case 'date_anchor_entity':
      if (elements.has_specific_date) { matchScore += 40; matchedElements.push('specific_date'); }
      else { missingElements.push('specific_date'); }
      
      if (elements.has_major_entity) { matchScore += 40; matchedElements.push('major_entity'); }
      else { missingElements.push('major_entity'); }
      
      // Bonus for having both
      if (elements.has_specific_date && elements.has_major_entity) matchScore += 20;
      break;
      
    case 'date_anchor_number':
      if (elements.has_specific_date || elements.dates_found.length > 0) { 
        matchScore += 30; matchedElements.push('date'); 
      } else { missingElements.push('date'); }
      
      if (elements.has_big_number) { matchScore += 50; matchedElements.push('big_number'); }
      else { missingElements.push('big_number'); }
      
      if (elements.has_major_entity) { matchScore += 20; matchedElements.push('entity'); }
      break;
      
    case 'direct_question_answer':
      if (elements.has_question) { matchScore += 50; matchedElements.push('question'); }
      else { missingElements.push('question'); }
      
      // Check if answer is implied (definitive words)
      if (/\b(نعم|لا|الإجابة|الجواب|yes|no|answer)\b/i.test(elements.content)) {
        matchScore += 30; matchedElements.push('answer');
      }
      
      if (elements.has_major_entity) { matchScore += 20; matchedElements.push('entity'); }
      break;
      
    case 'shocking_news_date':
      if (elements.has_specific_date) { matchScore += 35; matchedElements.push('date'); }
      else { missingElements.push('date'); }
      
      if (elements.has_official_source) { matchScore += 35; matchedElements.push('official_source'); }
      else { missingElements.push('official_source'); }
      
      // Check for surprise words
      if (/\b(فجأة|صادم|غريب|مفاجئ|shocking|surprising|suddenly)\b/i.test(elements.content)) {
        matchScore += 30; matchedElements.push('surprise');
      }
      break;
      
    case 'viewer_question':
      if (elements.has_viewer_address) { matchScore += 50; matchedElements.push('viewer_address'); }
      else { missingElements.push('viewer_address'); }
      
      if (elements.has_question) { matchScore += 30; matchedElements.push('question'); }
      else { missingElements.push('question'); }
      
      // Relatable topic bonus
      if (/\b(بلدك|حياتك|شغلك|فلوسك|your country|your life|your money)\b/i.test(elements.content)) {
        matchScore += 20; matchedElements.push('relatable');
      }
      break;
  }
  
  return {
    score: matchScore,
    matched: matchedElements,
    missing: missingElements
  };
}

// ============================================
// Find best hook pattern for content
// ============================================
export function findBestHookPattern(item) {
  const elements = extractHookElements(item);
  
  const results = ENHANCED_DNA.hook_patterns.map(pattern => {
    const match = calculatePatternMatch(elements, pattern);
    
    return {
      pattern_id: pattern.pattern_id,
      name: pattern.name,
      rank: pattern.rank,
      match_score: match.score,
      matched_elements: match.matched,
      missing_elements: match.missing,
      expected_views: pattern.metrics.views_avg,
      expected_retention: pattern.metrics.retention_30s,
      structure: pattern.structure,
      example: pattern.example,
      why_works: pattern.why_works
    };
  });
  
  // Sort by match score
  results.sort((a, b) => b.match_score - a.match_score);
  
  // Get best match (minimum 50 score to be valid)
  const bestMatch = results[0];
  const isStrongMatch = bestMatch.match_score >= 50;
  
  return {
    best_pattern: isStrongMatch ? bestMatch : null,
    all_patterns: results,
    elements_extracted: elements,
    recommendation: isStrongMatch 
      ? `Use "${bestMatch.name}" hook pattern`
      : 'No strong pattern match - consider restructuring angle',
    
    // Hook generation template
    hook_template: isStrongMatch ? {
      structure_ar: bestMatch.structure.arabic,
      example: bestMatch.example,
      fill_with: {
        date: elements.dates_found[0] || '[ADD DATE]',
        entity: elements.entities_found[0] || '[ADD ENTITY]',
        number: elements.numbers_found[0] || '[ADD NUMBER]'
      }
    } : null
  };
}

// ============================================
// Generate hook text using pattern
// ============================================
export function generateHookText(item, pattern, extracted) {
  if (!pattern) return null;
  
  const templates = {
    'date_anchor_entity': (data) => 
      `في ${data.date || '[تاريخ]'} ${data.entity || '[شخصية]'} ${data.action || '[فعل صادم]'}...`,
    
    'date_anchor_number': (data) =>
      `${data.product || '[منتج/شركة]'}... اللي قيمتها ${data.number || '[رقم ضخم]'}`,
    
    'direct_question_answer': (data) =>
      `هل ${data.question || '[سؤال]'}؟ الإجابة هي ${data.answer || '[نعم/لا]'}...`,
    
    'shocking_news_date': (data) =>
      `في ${data.date || '[تاريخ]'} ${data.source || '[مصدر رسمي]'} نشر ${data.news || '[خبر صادم]'}...`,
    
    'viewer_question': (data) =>
      `برأيك ${data.question || '[سؤال للمشاهد]'}؟`
  };
  
  const template = templates[pattern.pattern_id];
  if (!template) return null;
  
  return {
    hook_text: template(extracted),
    pattern_used: pattern.name,
    expected_retention: pattern.expected_retention
  };
}

