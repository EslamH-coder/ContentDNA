/**
 * AI-Enhanced Competitor Matching
 * Uses keywords first, AI for validation when confidence is uncertain
 * Results are cached in the database to avoid repeated API calls
 */

import { extractKeywords, normalizeArabicText } from './multiSignalScoring';
import { calculateMatchScore } from './keywordWeights';

/**
 * Validate if a competitor video matches a signal using AI
 * @param {Object} signal - The signal object
 * @param {Object} competitorVideo - The competitor video object
 * @param {Object} options - Options including aiFingerprint, supabase client
 * @returns {Promise<Object>} Match result with isMatch, confidence, reason
 */
export async function validateCompetitorMatchWithAI(signal, competitorVideo, options = {}) {
  const { 
    aiFingerprint = null, 
    supabase = null,
    skipCache = false 
  } = options;

  const signalId = signal.id;
  const videoId = competitorVideo.id || competitorVideo.youtube_video_id || competitorVideo.video_id;
  
  // ============================================
  // STEP 1: Check cache first (if supabase provided)
  // ============================================
  if (supabase && !skipCache && signalId && videoId) {
    try {
      const { data: cached } = await supabase
        .from('competitor_match_cache')
        .select('*')
        .eq('signal_id', signalId)
        .eq('video_id', videoId)
        .single();
      
      if (cached && cached.validated_at) {
        // Cache is valid for 7 days
        const cacheAge = Date.now() - new Date(cached.validated_at).getTime();
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          console.log(`   💾 Using cached competitor match: ${cached.is_match ? '✅' : '❌'}`);
          return {
            isMatch: cached.is_match,
            confidence: cached.confidence,
            matchedKeywords: cached.matched_keywords || [],
            source: 'cached',
            reason: cached.reason || 'Cached result'
          };
        }
      }
    } catch (cacheErr) {
      // Cache miss or error - continue with fresh validation
    }
  }

  // ============================================
  // STEP 2: Quick keyword matching (FREE)
  // ============================================
  const signalTitle = (signal.title || '').toLowerCase();
  const videoTitle = (competitorVideo.title || '').toLowerCase();
  const videoDescription = (competitorVideo.description || '').substring(0, 500).toLowerCase();

  // Extract keywords from signal
  let signalKeywords = extractKeywords(signal.title || '');
  
  // Add AI-extracted entities if available
  if (aiFingerprint?.entities) {
    const aiKeywords = [
      ...(aiFingerprint.entities.topics || []),
      ...(aiFingerprint.entities.countries || []),
      ...(aiFingerprint.entities.organizations || []),
      ...(aiFingerprint.entities.people || [])
    ].filter(k => k && k.length > 2);
    signalKeywords = [...new Set([...signalKeywords, ...aiKeywords])];
  }

  // Find matching keywords in video
  const matchedKeywords = [];
  for (const kw of signalKeywords) {
    const normalizedKw = normalizeArabicText(kw).toLowerCase();
    if (normalizedKw.length < 3) continue;
    
    if (videoTitle.includes(normalizedKw) || videoDescription.includes(normalizedKw)) {
      matchedKeywords.push(kw);
    }
  }

  // Calculate keyword match score
  const matchResult = calculateMatchScore(matchedKeywords, []);
  
  // ============================================
  // STEP 3: Determine confidence level
  // ============================================
  let confidence = 0;
  let needsAIValidation = false;

  if (matchedKeywords.length >= 3 && matchResult.isValidMatch) {
    confidence = 90; // High confidence - multiple meaningful keywords
  } else if (matchedKeywords.length >= 2 && matchResult.isValidMatch) {
    confidence = 75; // Medium-high confidence
  } else if (matchedKeywords.length >= 2) {
    confidence = 55; // Medium confidence - needs AI validation
    needsAIValidation = true;
  } else if (matchedKeywords.length >= 1) {
    confidence = 40; // Low confidence - needs AI validation
    needsAIValidation = true;
  }

  // ============================================
  // STEP 4: AI validation for uncertain cases (40-70 confidence)
  // ============================================
  let aiResult = null;
  if (needsAIValidation && confidence >= 40 && confidence < 75) {
    try {
      aiResult = await callAIForCompetitorValidation(signal, competitorVideo, matchedKeywords);
      
      if (aiResult) {
        confidence = aiResult.isRelevant ? 85 : 20;
        console.log(`   🤖 AI competitor validation: ${aiResult.isRelevant ? '✅ Match' : '❌ No match'} - ${aiResult.reason}`);
      }
    } catch (aiErr) {
      console.warn(`   ⚠️ AI competitor validation failed:`, aiErr.message);
      // Continue with keyword-only result
    }
  }

  // ============================================
  // STEP 5: Determine final result
  // ============================================
  const isMatch = confidence >= 50 && (matchResult.isValidMatch || (aiResult && aiResult.isRelevant));
  const reason = aiResult?.reason || 
    (isMatch ? `${matchedKeywords.length} keyword matches` : 'Insufficient match confidence');

  const result = {
    isMatch,
    confidence,
    matchedKeywords,
    source: aiResult ? 'ai' : 'keywords',
    reason
  };

  // ============================================
  // STEP 6: Save to cache (if supabase provided)
  // ============================================
  console.log(`   🔍 Cache check: supabase=${!!supabase}, signalId=${!!signalId} (${signalId}), videoId=${!!videoId} (${videoId})`);
if (supabase && signalId && videoId) {
    try {
      await supabase
        .from('competitor_match_cache')
        .upsert({
          signal_id: signalId,
          video_id: videoId,
          is_match: result.isMatch,
          confidence: result.confidence,
          matched_keywords: result.matchedKeywords,
          source: result.source,
          reason: result.reason,
          validated_at: new Date().toISOString()
        }, {
          onConflict: 'signal_id,video_id'
        });
      console.log(`   💾 Saved competitor match to cache`);
    } catch (saveErr) {
      console.warn(`   ⚠️ Failed to save competitor match cache:`, saveErr.message);
    }
  }

  return result;
}

/**
 * Call AI to validate if signal and competitor video are about the same topic
 */
async function callAIForCompetitorValidation(signal, competitorVideo, matchedKeywords) {
  try {
    // Use Claude Haiku for fast, cheap validation
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Are these about the SAME news story/topic? Answer only with JSON.

Signal: "${signal.title}"
Video: "${competitorVideo.title}"
Shared keywords: ${matchedKeywords.join(', ')}

Consider: Are they covering the same event, issue, or story? Not just sharing common words.

Respond ONLY with JSON:
{"isRelevant": true/false, "reason": "brief explanation"}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (err) {
    console.error('AI competitor validation error:', err.message);
    return null;
  }
}

/**
 * Batch validate multiple competitor videos for a signal
 * More efficient than validating one at a time
 */
export async function findValidatedCompetitors(signal, competitorVideos, options = {}) {
  const { 
    aiFingerprint = null, 
    supabase = null,
    maxResults = 10,
    minConfidence = 50
  } = options;

  const validatedMatches = [];
  let aiCallCount = 0;
  const MAX_AI_CALLS = 5; // Limit AI calls per signal

  for (const video of competitorVideos) {
    if (validatedMatches.length >= maxResults) break;

    // Only call AI for first 5 uncertain matches
    const shouldUseAI = aiCallCount < MAX_AI_CALLS;
    
    const result = await validateCompetitorMatchWithAI(signal, video, {
      aiFingerprint,
      supabase,
      skipCache: false
    });

    if (result.source === 'ai') {
      aiCallCount++;
    }

    if (result.isMatch && result.confidence >= minConfidence) {
      validatedMatches.push({
        ...video,
        matchConfidence: result.confidence,
        matchedKeywords: result.matchedKeywords,
        matchSource: result.source,
        matchReason: result.reason
      });
    } else if (result.confidence >= 40 && result.confidence < minConfidence) {
      console.log(`   ⚠️ Low confidence match rejected: "${video.title?.substring(0, 40)}..." (${result.confidence}%)`);
    }
  }

  // Sort by confidence (highest first)
  return validatedMatches.sort((a, b) => b.matchConfidence - a.matchConfidence);
}