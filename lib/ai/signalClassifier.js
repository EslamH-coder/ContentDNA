/**
 * AI-Powered Signal Classification Service
 * Uses Claude Haiku for smart, cheap classification
 * 
 * Cost: ~$0.0003 per call (~$1/month for 3000 calls)
 */

import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple in-memory cache (use Redis in production for persistence)
const classificationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Track AI usage for monitoring
let aiCallCount = 0;

/**
 * Generate cache key from signal title
 */
function getCacheKey(title) {
  // Normalize and truncate for consistent caching
  return `classify:${(title || '').toLowerCase().trim().substring(0, 100)}`;
}

/**
 * Check if cached result is still valid
 */
function getCachedResult(cacheKey) {
  const cached = classificationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`   🎯 AI Cache HIT for classification`);
    return cached.result;
  }
  return null;
}

/**
 * Store result in cache
 */
function setCachedResult(cacheKey, result) {
  classificationCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  // Cleanup old entries (keep cache size manageable)
  if (classificationCache.size > 1000) {
    const oldestKey = classificationCache.keys().next().value;
    classificationCache.delete(oldestKey);
  }
}

/**
 * Classify a signal using Claude Haiku
 * 
 * @param {Object} signal - The signal to classify
 * @param {Array} dnaTopics - Channel's DNA topics
 * @param {Object} options - Additional options
 * @returns {Object} Classification result
 */
export async function classifySignalWithAI(signal, dnaTopics, options = {}) {
  const title = signal.title || '';
  const description = signal.description || '';
  
  // Check cache first
  const cacheKey = getCacheKey(title);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }
  
  // Format DNA topics for the prompt
  const dnaTopicsList = dnaTopics
    .slice(0, 15) // Limit to top 15 topics
    .map(t => {
      const id = t.topic_id || t.topicId || t.id;
      const name = t.topic_name_en || t.nameEn || t.name || id;
      return `- ${id}: ${name}`;
    })
    .join('\n');
  
  const prompt = `You are classifying news signals for a YouTube channel about economics and geopolitics.

SIGNAL TO CLASSIFY:
Title: "${title}"
${description ? `Description: "${description.substring(0, 200)}"` : ''}

CHANNEL DNA TOPICS (what the channel covers):
${dnaTopicsList}

TASK: Determine if this signal matches the channel's focus.

CRITICAL RULES - READ CAREFULLY:
1. Technology/AI topics: ONLY match if the signal is EXPLICITLY about:
   - Artificial intelligence, machine learning, AI companies
   - Computer chips, semiconductors, tech hardware
   - Tech companies with major economic impact (Apple, Google, Microsoft earnings, etc.)
   - NOT: Military weapons, arms deals, war technology, defense contracts
   - NOT: General "technology" mentions in non-tech contexts

2. Geopolitics/Military: Match to geopolitics topics if about:
   - Wars, conflicts, military actions
   - Arms deals, weapons sales, defense spending
   - International relations, sanctions, diplomacy
   - Examples: "Ukraine needs US arms" = GEOPOLITICS, NOT technology
   - Examples: "Russia-Ukraine war" = GEOPOLITICS, NOT technology

3. STRICT MATCHING:
   - "arms" or "weapons" = GEOPOLITICS/MILITARY, NEVER technology
   - "war" or "conflict" = GEOPOLITICS, NEVER technology
   - "AI" or "artificial intelligence" = Technology (if actually about AI)
   - If signal mentions both military AND technology, it's GEOPOLITICS (military context wins)

4. When in doubt: Set isRelevantToChannel to FALSE

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "category": "geopolitics|economics|technology|military|energy|entertainment|sports|lifestyle|other",
  "isRelevantToChannel": true or false,
  "matchedTopicId": "the DNA topic_id that best matches, or null if none",
  "matchedTopicName": "English name of matched topic, or null",
  "confidence": 0.0 to 1.0,
  "reason": "One sentence explanation"
}

EXAMPLES OF CORRECT CLASSIFICATION:
- "Ukraine needs billions in US arms" → category: "military", isRelevantToChannel: true, matchedTopicId: "ukraine_war" or "us_military_aid" (NOT "ai_technology")
- "China's robot IPOs surge" → category: "technology", isRelevantToChannel: true, matchedTopicId: "ai_technology" (if about AI/robotics)
- "US approves $10B arms deal to Taiwan" → category: "geopolitics", isRelevantToChannel: true, matchedTopicId: "us_china_relations" (NOT "ai_technology")
- "Qatar signs $2bn LNG investment in Nigeria" → category: "energy", isRelevantToChannel: true, matchedTopicId: "energy" or "qatar_energy" (NOT "ai_technology")
- "Trump's recklessness imperils Europe" → category: "geopolitics", isRelevantToChannel: true, matchedTopicId: "us_europe_relations" or "geopolitics" (NOT "middle_east_conflicts")
- "Saudi Arabia issues 2.27B riyal Sukuk bonds" → category: "economics", isRelevantToChannel: true, matchedTopicId: "debt" or "finance" or "saudi_economy" (NOT "currency_devaluation")

CRITICAL: Sukuk bonds, debt issuance, and government borrowing are about FINANCE/DEBT, NOT currency devaluation. Currency devaluation is when a currency loses value against other currencies, not when a government issues bonds.`;

  try {
    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(`   ⚠️ ANTHROPIC_API_KEY not configured - AI validation unavailable`);
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    
    console.log(`   🤖 Calling Claude Haiku for: "${title.substring(0, 40)}..."`);
    aiCallCount++;
    
    // Add timeout to prevent hanging (10 seconds max)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout after 10 seconds')), 10000);
    });
    
    const apiPromise = anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: prompt
      }]
    });
    
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    if (!response || !response.content || !response.content[0]) {
      throw new Error('Empty response from Claude API');
    }
    
    const responseText = response.content[0].text.trim();
    console.log(`   📥 AI Response received (${responseText.length} chars): ${responseText.substring(0, 100)}...`);
    
    // Parse JSON response
    let result;
    try {
      // Remove any markdown code blocks if present
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      result = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse AI response:`, responseText);
      result = {
        category: 'unknown',
        isRelevantToChannel: false,
        matchedTopicId: null,
        matchedTopicName: null,
        confidence: 0,
        reason: 'Failed to parse AI response'
      };
    }
    
    // Add metadata
    result.source = 'ai';
    result.model = 'claude-3-haiku';
    result.cached = false;
    
    // Cache the result
    setCachedResult(cacheKey, result);
    
    console.log(`   ✅ AI Classification for "${title.substring(0, 60)}...":`);
    console.log(`      Category: ${result.category}`);
    console.log(`      Relevant: ${result.isRelevantToChannel}`);
    console.log(`      Matched Topic: ${result.matchedTopicId || 'none'}`);
    if (result.reason) {
      console.log(`      Reason: ${result.reason}`);
    }
    
    // WARN if military/arms signal was matched to technology
    if (title.toLowerCase().includes('arms') || title.toLowerCase().includes('weapon') || title.toLowerCase().includes('war')) {
      if (result.matchedTopicId && result.matchedTopicId.toLowerCase().includes('ai') || result.matchedTopicId.toLowerCase().includes('tech')) {
        console.error(`   🚨 ERROR: Military/arms signal matched to technology topic! This is likely wrong.`);
        console.error(`   🚨 Signal: "${title}"`);
        console.error(`   🚨 Matched to: ${result.matchedTopicId}`);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error(`   ❌ AI Classification error:`, error.message);
    console.error(`   ❌ Error stack:`, error.stack?.substring(0, 200));
    
    // Check if it's an API key error
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      console.error(`   ⚠️ ANTHROPIC_API_KEY may be missing or invalid`);
    }
    
    // Return safe default on error - but mark as error so caller knows
    return {
      category: 'unknown',
      isRelevantToChannel: false, // Changed to false - don't match on error
      matchedTopicId: null,
      matchedTopicName: null,
      confidence: 0,
      reason: `AI error: ${error.message}`,
      source: 'ai_error',
      error: true
    };
  }
}

/**
 * Validate if a signal should be shown (combines keyword + AI)
 * This is the main function to use in your code
 * 
 * @param {Object} signal - The signal to validate
 * @param {Array} dnaTopics - Channel's DNA topics  
 * @param {Object} keywordMatch - Result from keyword matching (if any)
 * @returns {Object} Validation result
 */
export async function validateSignalRelevance(signal, dnaTopics, keywordMatch = null) {
  const title = signal.title || '';
  
  // ALWAYS use AI validation - keywords are just hints, AI makes the final decision
  // This prevents false positives from loose keyword matching
  console.log(`   🤖 AI validation required for: "${title.substring(0, 80)}..."`);
  console.log(`   📋 Full title: "${title}"`);
  
  if (keywordMatch) {
    console.log(`   📝 Keyword hint: ${keywordMatch.topicId || keywordMatch.topicName || 'none'} (confidence: ${keywordMatch.score || 0}%)`);
    console.log(`   ⚠️ WARNING: Keyword match is just a hint - AI will make final decision`);
  }
  
  // Use AI to make the final decision (AI understands context, keywords don't)
  let aiResult;
  try {
    aiResult = await classifySignalWithAI(signal, dnaTopics);
  } catch (aiError) {
    console.error(`   ❌ AI classification failed:`, aiError.message);
    // If AI fails, reject the match (don't trust keywords)
    return {
      isRelevant: false,
      matchedTopicId: null,
      matchedTopicName: null,
      confidence: 0,
      source: 'ai_error',
      reason: `AI validation failed: ${aiError.message}`,
      error: true
    };
  }
  
  // Check if AI returned an error
  if (aiResult.error) {
    console.error(`   ❌ AI returned error result: ${aiResult.reason}`);
    return {
      isRelevant: false,
      matchedTopicId: null,
      matchedTopicName: null,
      confidence: 0,
      source: 'ai_error',
      reason: aiResult.reason || 'AI validation error',
      error: true
    };
  }
  
  // AI decision is FINAL - if AI says not relevant, reject it
  if (!aiResult.isRelevantToChannel) {
    console.log(`   ❌ AI REJECTED: ${aiResult.reason || 'Not relevant to channel DNA'}`);
    return {
      isRelevant: false,
      matchedTopicId: null,
      matchedTopicName: null,
      confidence: 0,
      source: 'ai',
      reason: aiResult.reason || 'AI determined signal is not relevant to channel DNA',
      category: aiResult.category
    };
  }
  
  // AI says it's relevant - use AI's matched topic (not keyword match)
  console.log(`   ✅ AI APPROVED: ${aiResult.matchedTopicId || 'no specific topic'} - ${aiResult.reason || 'Relevant to channel'}`);
  return {
    isRelevant: true,
    matchedTopicId: aiResult.matchedTopicId, // Use AI's topic, not keyword's
    matchedTopicName: aiResult.matchedTopicName,
    confidence: aiResult.confidence,
    source: 'ai',
    reason: aiResult.reason || 'AI validated as relevant',
    category: aiResult.category
  };
}

/**
 * Batch classify multiple signals (more efficient)
 * Groups signals and makes fewer AI calls
 */
export async function batchClassifySignals(signals, dnaTopics) {
  const results = [];
  
  for (const signal of signals) {
    // Check cache first
    const cacheKey = getCacheKey(signal.title);
    const cached = getCachedResult(cacheKey);
    
    if (cached) {
      results.push({ signal, classification: cached });
    } else {
      // Classify with AI
      const classification = await classifySignalWithAI(signal, dnaTopics);
      results.push({ signal, classification });
    }
  }
  
  return results;
}

/**
 * Check if a signal is about entertainment/sports (quick check before AI)
 * This can save AI calls for obvious cases
 */
export function quickEntertainmentCheck(title) {
  const titleLower = (title || '').toLowerCase();
  
  const entertainmentKeywords = [
    'messi', 'ronaldo', 'neymar', 'mbappe', 'haaland', 'salah', 'mane', 'mané',
    'lebron', 'curry', 'swift', 'beyonce', 'kardashian', 'movie', 'film',
    'actor', 'actress', 'singer', 'grammy', 'oscar', 'emmy', 'netflix',
    'football', 'soccer', 'basketball', 'tennis', 'cricket', 'world cup',
    'ballon d\'or', 'premier league', 'champions league', 'la liga',
    'كرة القدم', 'لاعب', 'مباراة', 'فيلم', 'ممثل', 'مغني'
  ];
  
  const hasEntertainment = entertainmentKeywords.some(kw => titleLower.includes(kw));
  
  // Check if it ALSO has business/economics keywords (might be relevant)
  const businessKeywords = [
    'deal', 'contract', 'billion', 'million', 'investment', 'sponsor',
    'company', 'business', 'economy', 'market', 'stock', 'money',
    'صفقة', 'عقد', 'مليار', 'استثمار', 'شركة'
  ];
  
  const hasBusiness = businessKeywords.some(kw => titleLower.includes(kw));
  
  return {
    isLikelyEntertainment: hasEntertainment && !hasBusiness,
    hasEntertainmentKeywords: hasEntertainment,
    hasBusinessKeywords: hasBusiness
  };
}

/**
 * Export cache stats for monitoring
 */
export function getCacheStats() {
  return {
    size: classificationCache.size,
    maxSize: 1000
  };
}

/**
 * Get AI usage statistics
 */
export function getAIUsageStats() {
  const totalRequests = aiCallCount + classificationCache.size;
  const cacheHitRate = totalRequests > 0 
    ? ((classificationCache.size / totalRequests) * 100).toFixed(1)
    : '0.0';
  
  return {
    callsThisSession: aiCallCount,
    estimatedCost: (aiCallCount * 0.0003).toFixed(4),
    cacheSize: classificationCache.size,
    cacheHitRate: `${cacheHitRate}%`
  };
}
