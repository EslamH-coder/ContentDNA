/**
 * DNA Matching System
 * Matches signals to DNA topics using keyword and entity matching
 */

// Generic keywords that appear in many contexts (low value)
const GENERIC_KEYWORDS = new Set([
  'war', 'economy', 'economic', 'economics', 'market', 'markets', 'trade', 
  'business', 'finance', 'financial', 'money', 'investment', 'investments',
  'crisis', 'conflict', 'politics', 'political', 'government', 'policy',
  'news', 'report', 'analysis', 'update', 'global', 'world', 'international',
  'president', 'leader', 'minister', 'official', 'country', 'nation',
  'حرب', 'اقتصاد', 'اقتصادي', 'سوق', 'تجارة', 'مال', 'استثمار', 'أزمة',
  'سياسة', 'سياسي', 'حكومة', 'رئيس', 'وزير', 'دولة', 'عالمي', 'دولي'
]);

// High-value keywords that indicate specific, meaningful topics
const HIGH_VALUE_KEYWORDS = new Set([
  'china', 'الصين', 'iran', 'إيران', 'russia', 'روسيا', 'israel', 'إسرائيل',
  'saudi', 'السعودية', 'qatar', 'قطر', 'yemen', 'يمن', 'syria', 'سوريا',
  'ukraine', 'أوكرانيا', 'turkey', 'تركيا', 'egypt', 'مصر', 'europe', 'أوروبا',
  'tariff', 'tariffs', 'تعريفة', 'رسوم جمركية', 'sanctions', 'عقوبات',
  'oil', 'نفط', 'lng', 'gas', 'غاز', 'nuclear', 'نووي',
  'bitcoin', 'بتكوين', 'crypto', 'blockchain',
  'tesla', 'تسلا', 'nvidia', 'openai', 'chatgpt',
  'missile', 'صاروخ', 'drone', 'مسيرة', 'greenland', 'غرينلاند',
  'houthi', 'حوثي', 'hezbollah', 'حزب الله', 'hamas', 'حماس'
]);

/**
 * Get the best DNA match for a signal
 * 
 * @param {Object} signal - Signal object with title, description
 * @param {Array} dnaTopics - Array of DNA topics from loadTopics()
 * @param {Object} options - Options including entities from AI fingerprint
 * @returns {Object|null} Best matching topic or null
 */
export function getBestDnaMatch(signal, dnaTopics = [], options = {}) {
  if (!signal || !dnaTopics || dnaTopics.length === 0) {
    return null;
  }

  const { entities = {} } = options;
  const title = (signal.title || '').toLowerCase();
  const description = (signal.description || '').toLowerCase();
  const fullText = `${title} ${description}`;

  let bestMatch = null;
  let bestScore = 0;

  for (const topic of dnaTopics) {
    let score = 0;
    const matchedKeywords = [];
    const matchedHighValueKeywords = [];
    const matchedGenericKeywords = [];

    // Get all keywords (regular + learned)
    const allKeywords = [
      ...(Array.isArray(topic.keywords) ? topic.keywords : []),
      ...(Array.isArray(topic.learned_keywords) ? topic.learned_keywords : [])
    ].filter(Boolean);

    // Method 1: Keyword matching with weighted scoring
    for (const keyword of allKeywords) {
      if (!keyword || typeof keyword !== 'string' || keyword.length < 3) continue;
      
      const keywordLower = keyword.toLowerCase();
      if (fullText.includes(keywordLower)) {
        // Check if it's a high-value keyword
        if (HIGH_VALUE_KEYWORDS.has(keywordLower)) {
          score += 25;
          matchedHighValueKeywords.push(keyword);
        }
        // Check if it's a generic keyword
        else if (GENERIC_KEYWORDS.has(keywordLower)) {
          score += 3;
          matchedGenericKeywords.push(keyword);
        }
        // Regular keyword
        else {
          score += 10;
        }
        matchedKeywords.push(keyword);
      }
    }

    // Penalty: If ONLY generic keywords matched, reduce score by 70%
    if (matchedKeywords.length > 0 && matchedHighValueKeywords.length === 0 && matchedKeywords.length === matchedGenericKeywords.length) {
      score = Math.floor(score * 0.3); // Reduce by 70%
    }

    // Bonus for multiple keyword matches (only if we have high-value or regular keywords)
    if (matchedHighValueKeywords.length > 0 || (matchedKeywords.length - matchedGenericKeywords.length) > 0) {
      if (matchedKeywords.length >= 2) {
        score += 10;
      }
      if (matchedKeywords.length >= 3) {
        score += 15;
      }
    }

    // Method 2: Entity matching (from AI fingerprint)
    if (entities) {
      const entityText = [
        ...(entities.countries || []),
        ...(entities.people || []),
        ...(entities.organizations || []),
        ...(entities.topics || [])
      ].join(' ').toLowerCase();

      for (const keyword of allKeywords) {
        if (!keyword || typeof keyword !== 'string') continue;
        const keywordLower = keyword.toLowerCase();
        if (entityText.includes(keywordLower) || keywordLower.includes(entityText)) {
          score += 20; // Higher weight for entity matches
        }
      }
    }

    // Method 3: Topic name matching
    const topicNameEn = (topic.topic_name_en || '').toLowerCase();
    const topicNameAr = (topic.topic_name_ar || '').toLowerCase();
    
    if (fullText.includes(topicNameEn) || fullText.includes(topicNameAr)) {
      score += 25;
    }

    // Update best match if this score is higher
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        topicId: topic.topic_id,
        topicName: topic.topic_name_en || topic.topic_id,
        topicNameAr: topic.topic_name_ar,
        score: bestScore,
        matchedKeywords,
        matchedHighValueKeywords,
        matchedGenericKeywords,
        confidence: bestScore >= 40 ? 'high' : bestScore >= 25 ? 'medium' : 'low'
      };
    }
  }

  // Require score >= 25 AND (high-value match OR 2+ keywords)
  const hasHighValueMatch = bestMatch?.matchedHighValueKeywords?.length > 0;
  const hasMultipleKeywords = bestMatch?.matchedKeywords?.length >= 2;
  
  if (bestScore >= 25 && (hasHighValueMatch || hasMultipleKeywords)) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Find DNA match using keyword matching (for hybrid system)
 * This is a simplified version that returns topic IDs
 */
export function findDnaMatch(signalTopicId, signalTitle, dnaTopics, aiFingerprint = null) {
  if (!signalTitle || !dnaTopics || dnaTopics.length === 0) {
    return [];
  }

  // Direct topic_id match (highest priority)
  if (signalTopicId) {
    const directMatch = dnaTopics.find(t => {
      const tId = t?.topic_id || t?.topicId || t?.id;
      return tId === signalTopicId;
    });
    if (directMatch) {
      const topicId = directMatch.topic_id || directMatch.topicId || directMatch.id;
      return [topicId];
    }
  }

  // Use getBestDnaMatch for keyword/entity matching
  const bestMatch = getBestDnaMatch(
    { title: signalTitle },
    dnaTopics,
    { entities: aiFingerprint?.entities || {} }
  );

  if (bestMatch && bestMatch.topicId) {
    return [bestMatch.topicId];
  }

  return [];
}

/**
 * HYBRID DNA MATCHING
 * Uses keywords first, AI for edge cases
 * 
 * @param {string} signalTopicId - Topic ID from signal (if available)
 * @param {string} signalTitle - Signal title
 * @param {Array} dnaTopics - Channel's DNA topics
 * @param {Object} aiFingerprint - AI-extracted entities (optional)
 * @returns {Object} { matches: string[], source: string, confidence: number, reason: string }
 */
export async function findDnaMatchHybrid(signalTopicId, signalTitle, dnaTopics, aiFingerprint = null) {
  // Try to import signalClassifier dynamically (may not exist)
  let validateSignalRelevance = null;
  let quickEntertainmentCheck = null;
  
  try {
    const signalClassifier = await import('@/lib/ai/signalClassifier.js');
    validateSignalRelevance = signalClassifier.validateSignalRelevance;
    quickEntertainmentCheck = signalClassifier.quickEntertainmentCheck;
  } catch (importError) {
    console.warn(`   ⚠️ signalClassifier.js not available, using keyword-only matching:`, importError.message);
  }
  
  // 1. Quick entertainment check (saves AI calls) - optional
  if (quickEntertainmentCheck && typeof quickEntertainmentCheck === 'function') {
    try {
      const quickCheck = quickEntertainmentCheck(signalTitle);
      if (quickCheck && quickCheck.isLikelyEntertainment) {
        console.log(`   ⚡ Quick filter: "${signalTitle.substring(0, 40)}..." is entertainment, skipping`);
        return {
          matches: [],
          source: 'quick_filter',
          reason: 'Entertainment/sports content'
        };
      }
    } catch (err) {
      console.warn(`   ⚠️ Quick entertainment check failed (non-fatal):`, err.message);
    }
  }
  
  // 2. Try keyword matching first (FREE)
  const keywordMatches = findDnaMatch(signalTopicId, signalTitle, dnaTopics, aiFingerprint);
  
  // 3. SANITY CHECK: Reject obviously wrong keyword matches
  const titleLower = (signalTitle || '').toLowerCase();
  let keywordConfidence = 0;
  
  if (keywordMatches && keywordMatches.length > 0) {
    // Check if keyword match makes semantic sense
    const firstMatch = keywordMatches[0];
    const matchedTopicId = firstMatch?.toLowerCase() || '';
   // Reject if signal is clearly about one domain but matched to another
    // NOTE: Keep this minimal - AI makes the final decision
    const domainMismatches = [
        // Only reject obvious entertainment -> geopolitics mismatches
        {
          signalKeywords: ['movie', 'film', 'actor', 'actress', 'netflix', 'hollywood', 'celebrity', 'فيلم', 'ممثل'],
          wrongTopics: ['us_china', 'russia_ukraine', 'middle_east', 'iran', 'sanctions'],
          reason: 'Entertainment signal matched to geopolitics'
        },
        // Sports -> geopolitics  
        {
          signalKeywords: ['football', 'soccer', 'nba', 'nfl', 'world cup', 'كرة القدم', 'مباراة'],
          wrongTopics: ['us_china', 'russia_ukraine', 'middle_east', 'iran', 'sanctions', 'war'],
          reason: 'Sports signal matched to geopolitics'
        }
      ];
    
    let hasMismatch = false;
    for (const mismatch of domainMismatches) {
      const hasSignalKeyword = mismatch.signalKeywords.some(kw => titleLower.includes(kw.toLowerCase()));
      const hasWrongTopic = mismatch.wrongTopics.some(topic => matchedTopicId.includes(topic.toLowerCase()));
      
      if (hasSignalKeyword && hasWrongTopic) {
        console.log(`   🚫 SANITY CHECK FAILED: ${mismatch.reason}`);
        console.log(`   🚫 Signal: "${signalTitle.substring(0, 60)}..."`);
        console.log(`   🚫 Matched to: ${firstMatch}`);
        console.log(`   🚫 Rejecting keyword match - will use AI only`);
        keywordMatches.length = 0; // Clear the match
        hasMismatch = true;
        break;
      }
    }
    
    if (!hasMismatch && keywordMatches.length > 0) {
      // Higher confidence if matched by AI fingerprint entities
      keywordConfidence = aiFingerprint?.entities ? 80 : 60;
      
      // If we have multiple matches, lower confidence (keyword matching is loose)
      if (keywordMatches.length > 1) {
        keywordConfidence = Math.max(50, keywordConfidence - (keywordMatches.length - 1) * 10);
      }
      
      // Check for generic words that need context (like "war", "conflict", "crisis")
      // These should always be validated by AI even if keyword confidence is high
      const genericWords = ['war', 'حرب', 'conflict', 'صراع', 'crisis', 'أزمة', 'market', 'سوق', 'economy', 'اقتصاد', 'investment', 'استثمار'];
      const hasGenericWord = genericWords.some(word => {
        const wordLower = word.toLowerCase();
        return titleLower.includes(wordLower);
      });
      
      // If signal contains generic words, always validate with AI (don't trust keyword match alone)
      if (hasGenericWord) {
        keywordConfidence = Math.min(keywordConfidence, 70); // Force AI validation
        console.log(`   ⚠️ Generic word detected, requiring AI validation (confidence lowered to ${keywordConfidence})`);
      }
    }
  }
  
  // 4. Only skip AI validation if VERY confident (90+) and no generic words
  // This prevents false positives from generic keywords like "war" matching "Middle East"
  if (keywordConfidence >= 90 && keywordMatches.length === 1) {
    return {
      matches: keywordMatches.slice(0, 1), // Return only best match
      source: 'keywords',
      confidence: keywordConfidence,
      reason: 'Very high confidence keyword match (AI fingerprint + single match)'
    };
  }
  
  // 5. ALWAYS use AI for validation/classification (AI makes final decision)
  if (validateSignalRelevance && typeof validateSignalRelevance === 'function') {
    try {
      const signal = { title: signalTitle };
      const aiValidation = await validateSignalRelevance(signal, dnaTopics, {
        topicId: keywordMatches?.[0],
        topicName: keywordMatches?.[0],
        score: keywordConfidence
      });
      
      // AI decision is FINAL - trust AI, not keywords
      if (aiValidation && aiValidation.isRelevant && aiValidation.matchedTopicId) {
        console.log(`   ✅ AI MATCH: ${aiValidation.matchedTopicId} - ${aiValidation.reason || 'AI validated'}`);
        return {
          matches: [aiValidation.matchedTopicId], // Use AI's topic, not keyword's
          source: aiValidation.source || 'ai',
          confidence: (aiValidation.confidence || 0.8) * 100,
          reason: aiValidation.reason || 'AI validated match',
          aiCategory: aiValidation.category
        };
      }
      
      // AI rejected the match - return empty (don't fall back to keywords)
      console.log(`   ❌ AI REJECTED: ${aiValidation?.reason || 'Not relevant to DNA'}`);
      return {
        matches: [],
        source: aiValidation?.source || 'ai',
        confidence: 0,
        reason: aiValidation?.reason || 'AI rejected: not relevant to DNA'
      };
    } catch (aiError) {
      console.error(`   ❌ AI validation ERROR:`, aiError.message);
      // Only fall back to keywords if AI completely fails (API error, etc.)
      // But warn that this is unreliable
      if (keywordMatches && keywordMatches.length > 0) {
        console.warn(`   ⚠️ FALLBACK: Using keyword match due to AI error (unreliable)`);
        return {
          matches: keywordMatches.slice(0, 1),
          source: 'keywords_fallback',
          confidence: Math.min(keywordConfidence, 50), // Lower confidence for fallback
          reason: `Keyword match (AI unavailable: ${aiError.message})`
        };
      }
      // No keywords either - return no match
      return {
        matches: [],
        source: 'ai_error',
        confidence: 0,
        reason: `AI validation failed: ${aiError.message}`
      };
    }
  }
  
  // 7. AI validation not available - this should rarely happen
  console.warn(`   ⚠️ AI validation function not available - using keyword fallback (unreliable)`);
  if (keywordMatches && keywordMatches.length > 0) {
    return {
      matches: keywordMatches.slice(0, 1),
      source: 'keywords_fallback',
      confidence: Math.min(keywordConfidence, 50), // Lower confidence when AI unavailable
      reason: 'Keyword match (AI validation unavailable - may be inaccurate)'
    };
  }
  
  // 8. No match
  return {
    matches: [],
    source: 'keywords',
    confidence: 0,
    reason: 'No DNA match found'
  };
}
