import { validateVoice } from '../voice/voiceValidator.js';
import { scoreForAudience, AUDIENCE_DNA } from '../dna/audienceProfile.js';

/**
 * Score angles against channel DNA and for variety
 */
export function scoreAngles(angles, story, showDna, recentTitles = []) {
  return angles.map(angle => {
    let score = 50; // Base score
    const reasons = [];
    
    const text = angle.text_ar || '';
    
    // ===== AUDIENCE-BASED SCORING (NEW) =====
    const audienceScore = scoreForAudience(text, '', story?.topic || '');
    if (audienceScore.score > 0) {
      // Add audience score as bonus (0-100 scale, convert to 0-30 bonus)
      const audienceBonus = Math.floor(audienceScore.score * 0.3); // Max +30 points
      score += audienceBonus;
      reasons.push(`+${audienceBonus}: Audience fit (${audienceScore.audience_fit})`);
      if (audienceScore.reasons.length > 0) {
        reasons.push(`  ${audienceScore.reasons.slice(0, 2).join(', ')}`);
      }
    }
    
    // ===== VOICE VALIDATION (NEW) =====
    const voiceValidation = validateVoice(text);
    if (voiceValidation.valid) {
      score += 20; // Bonus for passing voice validation
      reasons.push(`+20: Passes voice validation (${voiceValidation.score}/100)`);
    } else if (voiceValidation.issues.some(i => i.severity === 'CRITICAL')) {
      score -= 50; // Heavy penalty for banned phrases
      reasons.push('-50: Contains banned phrases');
    } else {
      // Partial penalty for warnings
      const warningPenalty = Math.max(0, 100 - voiceValidation.score);
      score -= Math.floor(warningPenalty / 5); // Reduce by up to 20 points
      reasons.push(`-${Math.floor(warningPenalty / 5)}: Voice validation warnings (${voiceValidation.score}/100)`);
    }
    
    // ===== POSITIVE FACTORS =====
    
    // Has specific number
    if (/\d+/.test(text)) {
      score += 15;
      reasons.push('+15: Has number');
    }
    
    // Has Arab region (boosted for audience - Egypt/Saudi are 37% of audience)
    if (/مصر|السعودية/.test(text)) {
      score += 20; // Boosted for top 2 countries
      reasons.push('+20: Has Egypt/Saudi (37% of audience)');
    } else if (/دبي|الإمارات|قطر|الخليج|الرياض|القاهرة|المغرب|الجزائر/.test(text)) {
      score += 15;
      reasons.push('+15: Has Arab region');
    }
    
    // Has entity (company/person)
    if (story.entities?.some(e => text.includes(e))) {
      score += 10;
      reasons.push('+10: Has entity');
    }
    
    // Creates curiosity (question, reveal, countdown)
    // Boost "هل" questions (best performing question type - 1.03M avg views)
    if (/^هل\s+/.test(text)) {
      score += 20; // Boosted for "هل" (best question type)
      reasons.push('+20: Uses "هل" (1.03M avg views - best question type)');
    } else if (/^كيف\s+/.test(text)) {
      score += 15; // "كيف" is second best
      reasons.push('+15: Uses "كيف" (966K avg views)');
    } else if (/^لماذا\s+/.test(text)) {
      score += 12; // "لماذا" is third
      reasons.push('+12: Uses "لماذا" (937K avg views)');
    } else if (/\?|ليه|مين|إزاي|اللي .* مش|العد التنازلي|انكشف|السر|محدش توقع/.test(text)) {
      score += 10;
      reasons.push('+10: Creates curiosity');
    }
    
    // Boost top entities (from audience data)
    if (/ترمب|ترامب/.test(text)) {
      score += 25; // Best entity - 1.29M avg views
      reasons.push('+25: Mentions "ترمب" (1.29M avg views - best entity)');
    } else if (/الصين/.test(text)) {
      score += 20; // Second best - 1.17M avg views
      reasons.push('+20: Mentions "الصين" (1.17M avg views)');
    } else if (/أمريكا/.test(text)) {
      score += 15; // Third - 950K avg views
      reasons.push('+15: Mentions "أمريكا" (950K avg views)');
    } else if (/روسيا/.test(text)) {
      score += 12; // Fourth - 934K avg views
      reasons.push('+12: Mentions "روسيا" (934K avg views)');
    } else if (/إيران/.test(text)) {
      score += 10; // Fifth - 917K avg views
      reasons.push('+10: Mentions "إيران" (917K avg views)');
    }
    
    // Has personal element
    if (/لو أنت|عيلة|حياتك|جيبك|مستنية/.test(text)) {
      score += 8;
      reasons.push('+8: Personal element');
    }
    
    // Has conflict/drama (important for audience - they love US-China conflicts)
    if (/أمريكا.*الصين|الصين.*أمريكا|صراع.*أمريكا|صراع.*الصين/.test(text)) {
      score += 15; // Boosted - audience loves US-China conflicts
      reasons.push('+15: US-China conflict (audience favorite)');
    } else if (/vs|ضد|معركة|مين هيكسب|صراع/.test(text)) {
      score += 8;
      reasons.push('+8: Has conflict/drama');
    }
    
    // Has timeline (specificity)
    if (/202\d|سنة|شهر|أسبوع/.test(text)) {
      score += 7;
      reasons.push('+7: Has timeline');
    }
    
    // Has action verb (dynamic)
    if (/جاي|أعلنت|خسرت|يرتفع|بدأ|اتغير/.test(text)) {
      score += 5;
      reasons.push('+5: Has action verb');
    }
    
    // ===== NEGATIVE FACTORS =====
    
    // Generic patterns (PENALIZE HEAVILY)
    if (/في خطر/.test(text)) {
      score -= 20;
      reasons.push('-20: Generic "في خطر"');
    }
    
    if (/القصة الكاملة/.test(text)) {
      score -= 25;
      reasons.push('-25: Generic "القصة الكاملة"');
    }
    
    if (/التفاصيل صادمة/.test(text) && !story.elements.surprise) {
      score -= 10;
      reasons.push('-10: Empty "صادمة" without real surprise');
    }
    
    if (/ماذا يحدث|ما الذي/.test(text)) {
      score -= 15;
      reasons.push('-15: Generic question');
    }
    
    // Too vague
    if (text.length < 20) {
      score -= 10;
      reasons.push('-10: Too short/vague');
    }
    
    // ===== DIVERSITY CHECK =====
    
    // Check similarity to recent titles
    for (const recent of recentTitles) {
      const similarity = calculateSimilarity(text, recent);
      if (similarity > 0.5) {
        score -= 15;
        reasons.push('-15: Too similar to recent title');
        break;
      }
    }
    
    // Bonus for angle variety
    const angleType = angle.type;
    const recentTypes = recentTitles.map(t => {
      // Try to infer type from recent title
      if (/vs|ضد|معركة/.test(t)) return 'conflict';
      if (/جاي|أعلنت/.test(t)) return 'arrival';
      if (/\?|ليه/.test(t)) return 'why_question';
      if (/202\d/.test(t)) return 'timeline';
      return null;
    }).filter(Boolean);
    
    if (!recentTypes.includes(angleType)) {
      score += 5;
      reasons.push('+5: Fresh angle type');
    }
    
    return {
      ...angle,
      score: Math.max(0, Math.min(100, score)),
      reasons
    };
  });
}

/**
 * Simple text similarity (Jaccard-ish)
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = [...words1].filter(w => words2.has(w) && w.length > 2).length; // Only count words > 2 chars
  const union = new Set([...words1, ...words2]).size;
  
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Select best angles with diversity
 */
export function selectBestAngles(scoredAngles, count = 3) {
  if (scoredAngles.length === 0) return [];
  
  // Sort by score
  const sorted = [...scoredAngles].sort((a, b) => b.score - a.score);
  
  // Pick top angles but ensure type diversity
  const selected = [];
  const usedTypes = new Set();
  
  for (const angle of sorted) {
    if (selected.length >= count) break;
    
    // Skip if we already have this type (unless it's much better)
    if (usedTypes.has(angle.type) && selected.length > 0) {
      const lastScore = selected[selected.length - 1].score;
      if (angle.score < lastScore + 10) continue; // Not enough better to justify same type
    }
    
    selected.push(angle);
    usedTypes.add(angle.type);
  }
  
  // If we don't have enough diverse types, fill with top scores anyway
  while (selected.length < count && selected.length < sorted.length) {
    const remaining = sorted.filter(a => !selected.includes(a));
    if (remaining.length > 0) {
      selected.push(remaining[0]);
    } else {
      break;
    }
  }
  
  return selected;
}

