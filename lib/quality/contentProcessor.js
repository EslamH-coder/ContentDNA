/**
 * MAIN CONTENT PROCESSOR
 * Combines: LLM Output → Auto-Fix → Quality Score → Fallback if needed
 */

import { autoFix, autoFixTitle } from './autoFixer.js';
import { calculateQualityScore, scoreTitleQuality } from './qualityScorer.js';
import { generateFallbackTitle, generateFallbackHook } from './templateFallback.js';

// ============================================
// PROCESS TITLE
// ============================================
export function processTitle(llmTitle, extractedData, newsItem = {}) {
  if (!llmTitle || typeof llmTitle !== 'string') {
    // No title from LLM, use fallback
    const fallback = generateFallbackTitle(extractedData);
    return {
      title: fallback.title,
      quality: {
        score: 40,
        status: 'needs_improvement',
        issues: ['No title from LLM'],
        strengths: []
      },
      processing: {
        original: null,
        wasFixed: false,
        fixes: [],
        usedFallback: true
      }
    };
  }
  
  // Step 1: Auto-fix the LLM output
  const fixed = autoFixTitle(llmTitle, {
    newsSource: newsItem.source || newsItem.sourceName
  });
  
  // Step 2: Score the fixed title
  const quality = scoreTitleQuality(fixed.fixed);
  
  // Step 3: If quality is too low, use fallback
  let finalTitle = fixed.fixed;
  let usedFallback = false;
  
  if (quality.score < 30) {
    const fallback = generateFallbackTitle(extractedData);
    finalTitle = fallback.title;
    usedFallback = true;
  }
  
  // Step 4: Final quality check
  const finalQuality = scoreTitleQuality(finalTitle);
  
  return {
    title: finalTitle,
    
    // Quality info for UI
    quality: {
      score: finalQuality.score,
      status: finalQuality.status,
      issues: finalQuality.issues,
      strengths: finalQuality.strengths
    },
    
    // Processing info
    processing: {
      original: llmTitle,
      wasFixed: fixed.wasFixed,
      fixes: fixed.fixes,
      usedFallback
    }
  };
}

// ============================================
// PROCESS HOOK
// ============================================
export function processHook(llmHook, extractedData, newsItem = {}) {
  if (!llmHook || typeof llmHook !== 'string') {
    // No hook from LLM, use fallback
    const fallback = generateFallbackHook(extractedData, newsItem);
    return {
      hook: fallback.hook,
      quality: {
        score: 40,
        grade: 'D',
        color: 'yellow',
        warnings: ['No hook from LLM'],
        positives: []
      },
      processing: {
        original: null,
        wasFixed: false,
        fixes: [],
        usedFallback: true
      }
    };
  }
  
  // Step 1: Auto-fix
  const fixed = autoFix(llmHook, {
    newsSource: newsItem.source || newsItem.sourceName,
    newsDate: formatNewsDate(newsItem.date || newsItem.dateInfo?.formattedDate),
    isHook: true
  });
  
  // Step 2: Score
  const quality = calculateQualityScore(fixed.fixed);
  
  // Step 3: Fallback if needed
  let finalHook = fixed.fixed;
  let usedFallback = false;
  
  if (quality.score < 30) {
    const fallback = generateFallbackHook(extractedData, newsItem);
    finalHook = fallback.hook;
    usedFallback = true;
  }
  
  // Step 4: Final quality
  const finalQuality = calculateQualityScore(finalHook);
  
  return {
    hook: finalHook,
    
    quality: {
      score: finalQuality.score,
      grade: finalQuality.grade,
      color: finalQuality.color,
      warnings: finalQuality.warnings,
      positives: finalQuality.positives.map(p => p.description)
    },
    
    processing: {
      original: llmHook,
      wasFixed: fixed.wasFixed,
      fixes: fixed.fixes,
      usedFallback
    }
  };
}

// ============================================
// PROCESS COMPLETE CONTENT
// ============================================
export function processContent(llmOutput, extractedData, newsItem = {}) {
  const titleResult = processTitle(llmOutput.title, extractedData, newsItem);
  const hookResult = processHook(llmOutput.hook, extractedData, newsItem);
  
  // Combined quality score
  const combinedScore = Math.round((titleResult.quality.score + hookResult.quality.score) / 2);
  
  return {
    // Final content (ALWAYS present)
    title: titleResult.title,
    hook: hookResult.hook,
    
    // Overall quality
    overallQuality: {
      score: combinedScore,
      grade: combinedScore >= 70 ? 'Good' : combinedScore >= 50 ? 'OK' : 'Needs Work',
      color: combinedScore >= 70 ? 'green' : combinedScore >= 50 ? 'yellow' : 'red'
    },
    
    // Detailed quality
    titleQuality: titleResult.quality,
    hookQuality: hookResult.quality,
    
    // All warnings (for UI display)
    warnings: [
      ...titleResult.quality.issues.map(i => `Title: ${i}`),
      ...hookResult.quality.warnings
    ],
    
    // Processing details
    processing: {
      title: titleResult.processing,
      hook: hookResult.processing
    }
  };
}

function formatNewsDate(dateInput) {
  if (!dateInput) return null;
  
  // If already formatted
  if (typeof dateInput === 'string' && /\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/.test(dateInput)) {
    return dateInput;
  }
  
  // Try to parse
  try {
    const date = new Date(dateInput);
    if (!isNaN(date.getTime())) {
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
}




