/**
 * Smart Pitch Generator
 * Generates channel-specific pitches for signals
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { generateTopicFingerprint, compareTopics } from './topicIntelligence.js';
import { getShowWinningPatterns, analyzeShowPatterns } from './patternAnalysis.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use service role key for server-side operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate smart pitches for a signal
 * @param {Object} signal - The news signal
 * @param {string} showId - The show ID
 * @param {Object} options - Options
 */
export async function generateSmartPitches(signal, showId, options = {}) {
  const {
    maxPitches = 2, // REDUCED: Default to 2 pitches per signal (1 long, 1 short)
    includeShortForm = true,
    includeLongForm = true,
    patternUsage = {}, // Track pattern usage for variety
    maxPerPattern = 2 // Max uses per pattern
  } = options;
  
  console.log(`🎯 Generating smart pitches for: ${signal.title?.substring(0, 50)}...`);
  
  // 1. Get signal fingerprint
  const fingerprint = await generateTopicFingerprint({
    title: signal.title,
    description: signal.description,
    skipEmbedding: true
  });
  
  // 2. Get show data
  const showData = await getShowData(showId);
  
  // 3. Get winning patterns for this show
  let patterns = await getShowWinningPatterns(showId);
  
  // If no patterns, analyze first
  if (patterns.length === 0) {
    console.log('No patterns found, analyzing show...');
    const analysis = await analyzeShowPatterns(showId);
    patterns = analysis.patterns;
  }
  
  // 4. Find similar successful videos
  const similarVideos = await findSimilarSuccessfulVideos(
    fingerprint,
    showId,
    showData.avgViews
  );
  
  // 5. Determine urgency
  const urgency = determineUrgency(signal);
  
  // 6. Generate pitches for each applicable pattern
  // FIXED: Use different patterns for different signals (pattern variety)
  const pitches = [];
  
  // Sort patterns by success rate
  const sortedPatterns = patterns
    .sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0));
  
  // Get patterns that aren't overused (for variety)
  const availablePatterns = sortedPatterns.filter(p => {
    const usage = patternUsage[p.pattern_id] || 0;
    return usage < maxPerPattern;
  });
  
  // If all patterns used, reset counts (allow reuse)
  const patternsToUse = availablePatterns.length > 0 ? availablePatterns : sortedPatterns;
  
  // Select best pattern for THIS signal (not always the top one)
  const selectedPattern = selectBestPatternForSignal(signal, patternsToUse, fingerprint);
  
  // Track pattern usage
  if (selectedPattern) {
    patternUsage[selectedPattern.pattern_id] = (patternUsage[selectedPattern.pattern_id] || 0) + 1;
    console.log(`🎯 Selected pattern "${selectedPattern.pattern_name}" for signal: "${signal.title?.substring(0, 40)}..." (usage: ${patternUsage[selectedPattern.pattern_id]}/${maxPerPattern})`);
  } else {
    console.warn(`⚠️ No pattern selected for signal: "${signal.title?.substring(0, 40)}..."`);
  }
  
  // OPTIMIZATION: If both long and short form are requested, generate both in ONE AI call
  if (includeLongForm && includeShortForm && selectedPattern) {
    // Generate both pitches in a single AI call (reduces API calls by 50%)
    const batchedPitches = await generateBatchedPitches(
      signal,
      selectedPattern,
      fingerprint,
      similarVideos,
      showData
    );
    
    if (batchedPitches.longForm) pitches.push(batchedPitches.longForm);
    if (batchedPitches.shortForm) pitches.push(batchedPitches.shortForm);
    
    // Fallback to individual calls if batched failed
    if (!batchedPitches.longForm && includeLongForm) {
      const pitch = await generatePitchForPattern(
        signal,
        selectedPattern,
        fingerprint,
        similarVideos,
        showData,
        'long_form'
      );
      if (pitch) pitches.push(pitch);
    }
    
    if (!batchedPitches.shortForm && includeShortForm && pitches.length < maxPitches) {
      const pitch = await generatePitchForPattern(
        signal,
        selectedPattern,
        fingerprint,
        similarVideos,
        showData,
        'short_form'
      );
      if (pitch) pitches.push(pitch);
    }
  } else {
    // Fallback to individual generation if only one type requested
    if (includeLongForm && selectedPattern) {
      const pitch = await generatePitchForPattern(
        signal,
        selectedPattern,
        fingerprint,
        similarVideos,
        showData,
        'long_form'
      );
      if (pitch) pitches.push(pitch);
    }
    
    if (includeShortForm && pitches.length < maxPitches && selectedPattern) {
      const pitch = await generatePitchForPattern(
        signal,
        selectedPattern,
        fingerprint,
        similarVideos,
        showData,
        'short_form'
      );
      if (pitch) pitches.push(pitch);
    }
  }
  
  // 7. Rank pitches
  const rankedPitches = rankPitches(pitches, showData);
  
  // 8. Save pitch history and attach database IDs
  const pitchesWithIds = [];
  for (const pitch of rankedPitches.slice(0, maxPitches)) {
    const dbId = await savePitchHistory(showId, signal, pitch);
    pitchesWithIds.push({
      ...pitch,
      id: dbId || `pitch_${signal.id}_${pitch.pattern?.id || 'default'}_${pitch.contentType}_${Date.now()}`
    });
  }
  
  return {
    signal: {
      title: signal.title,
      fingerprint: fingerprint.fingerprint,
      category: fingerprint.topicCategory
    },
    urgency,
    pitches: pitchesWithIds,
    similarSuccesses: similarVideos.slice(0, 3),
    showStats: {
      avgViews: showData.avgViews,
      topPattern: patterns[0]?.pattern_name
    }
  };
}

/**
 * Generate a pitch using a specific pattern
 */
async function generatePitchForPattern(signal, pattern, fingerprint, similarVideos, showData, contentType) {
  try {
    // Find best similar video for this pattern
    const patternSimilarVideo = similarVideos.find(v => 
      v.matchedPatterns?.includes(pattern.pattern_id)
    ) || similarVideos[0];
    
    // Build prompt
    const prompt = buildPitchPrompt(signal, pattern, patternSimilarVideo, showData, contentType);
    
    // Generate with AI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300
    });
    
    const generatedContent = response.choices[0].message.content.trim();
    
    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🤖 AI Response for "${signal.title?.substring(0, 30)}...":`, generatedContent.substring(0, 100));
    }
    
    // Parse response
    const pitch = parsePitchResponse(generatedContent, pattern, contentType);
    
    // Validate that we got a proper title (not the signal title or a fallback)
    if (!pitch.title || pitch.title === signal.title || pitch.title.includes('[AI Generation Failed')) {
      console.error('⚠️ Pitch generation failed or returned signal title:', {
        signalTitle: signal.title,
        generatedTitle: pitch.title,
        aiResponse: generatedContent.substring(0, 150)
      });
      // Return null to skip this pitch rather than showing raw signal
      return null;
    }
    
    // Calculate predicted views and confidence
    const signalScore = signal.score || signal.multi_signal_scoring?.score || 50;
    const predictedViews = predictViews(pattern, fingerprint, showData, patternSimilarVideo, signalScore, signal);
    const predictionConfidence = calculateConfidence(pattern, signalScore, patternSimilarVideo, signal);
    
    // Extract evidence from signal
    const evidence = extractEvidenceFromSignal(signal, pattern);
    // Add similar video to evidence
    if (patternSimilarVideo) {
      evidence.similarVideo = {
        title: patternSimilarVideo.title,
        views: patternSimilarVideo.views,
        similarity: patternSimilarVideo.similarity || 0.8
      };
    }
    
    return {
      title: pitch.title,
      title_ar: pitch.title,
      angle: pattern.formula,
      reasoning: pitch.reasoning || `Based on "${pattern.pattern_name}" pattern`,
      
      // Classification
      contentType,
      shortFormType: contentType === 'short_form' ? pattern.short_form_subtype : null,
      
      // Pattern info
      pattern: {
        id: pattern.pattern_id,
        name: pattern.pattern_name,
        name_ar: pattern.pattern_name_ar,
        successRate: pattern.success_rate,
        avgViews: pattern.avg_views
      },
      
      // Prediction
      predictedViews,
      predictionConfidence,
      
      // Similar success (kept for backward compatibility)
      similarVideo: patternSimilarVideo ? {
        title: patternSimilarVideo.title,
        views: patternSimilarVideo.views
      } : null,
      
      // Evidence object (new)
      evidence,
      
      // Why this works
      whyThisWorks: generateWhyThisWorks(pattern, fingerprint, showData)
    };
  } catch (error) {
    console.error('Error generating pitch:', error);
    console.error('Error details:', {
      signalTitle: signal.title?.substring(0, 50),
      patternName: pattern.pattern_name,
      errorMessage: error.message
    });
    return null;
  }
}

/**
 * Generate both long and short form pitches in a single AI call (optimization)
 */
async function generateBatchedPitches(signal, pattern, fingerprint, similarVideos, showData) {
  const signalScore = signal.score || signal.multi_signal_scoring?.score || 50;
  try {
    const patternSimilarVideo = similarVideos.find(v => 
      v.matchedPatterns?.includes(pattern.pattern_id)
    ) || similarVideos[0];
    
    const prompt = buildBatchedPitchPrompt(signal, pattern, patternSimilarVideo, showData);
    
    // Single AI call for both pitches
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 400 // More tokens for 2 pitches
    });
    
    const generatedContent = response.choices[0].message.content.trim();
    
    // Parse both pitches from response
    const parsed = parseBatchedPitchResponse(generatedContent, pattern);
    
    if (!parsed.longForm && !parsed.shortForm) {
      console.warn('⚠️ Batched pitch generation failed, falling back to individual calls');
      return { longForm: null, shortForm: null };
    }
    
    const signalScore = signal.score || signal.multi_signal_scoring?.score || 50;
    const predictedViews = predictViews(pattern, fingerprint, showData, patternSimilarVideo, signalScore, signal);
    const predictionConfidence = calculateConfidence(pattern, signalScore, patternSimilarVideo, signal);
    
    // Extract evidence from signal
    const evidence = extractEvidenceFromSignal(signal, pattern);
    // Add similar video to evidence
    if (patternSimilarVideo) {
      evidence.similarVideo = {
        title: patternSimilarVideo.title,
        views: patternSimilarVideo.views,
        similarity: patternSimilarVideo.similarity || 0.8
      };
    }
    
    const result = {
      longForm: null,
      shortForm: null
    };
    
    // Build long form pitch if generated
    if (parsed.longForm) {
      result.longForm = {
        title: parsed.longForm.title,
        title_ar: parsed.longForm.title,
        angle: pattern.formula,
        reasoning: parsed.longForm.reasoning || `Based on "${pattern.pattern_name}" pattern`,
        contentType: 'long_form',
        shortFormType: null,
        pattern: {
          id: pattern.pattern_id,
          name: pattern.pattern_name,
          name_ar: pattern.pattern_name_ar,
          successRate: pattern.success_rate,
          avgViews: pattern.avg_views
        },
        predictedViews,
        predictionConfidence,
        similarVideo: patternSimilarVideo ? {
          title: patternSimilarVideo.title,
          views: patternSimilarVideo.views
        } : null,
        evidence, // Add evidence object
        whyThisWorks: generateWhyThisWorks(pattern, fingerprint, showData)
      };
    }
    
    // Build short form pitch if generated
    if (parsed.shortForm) {
      result.shortForm = {
        title: parsed.shortForm.title,
        title_ar: parsed.shortForm.title,
        angle: pattern.formula,
        reasoning: parsed.shortForm.reasoning || `Based on "${pattern.pattern_name}" pattern`,
        contentType: 'short_form',
        shortFormType: pattern.short_form_subtype || 'micro',
        pattern: {
          id: pattern.pattern_id,
          name: pattern.pattern_name,
          name_ar: pattern.pattern_name_ar,
          successRate: pattern.success_rate,
          avgViews: pattern.avg_views
        },
        predictedViews,
        predictionConfidence,
        similarVideo: patternSimilarVideo ? {
          title: patternSimilarVideo.title,
          views: patternSimilarVideo.views
        } : null,
        evidence, // Add evidence object
        whyThisWorks: generateWhyThisWorks(pattern, fingerprint, showData)
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in batched pitch generation:', error);
    return { longForm: null, shortForm: null };
  }
}

/**
 * Build prompt for generating both long and short form pitches in one call
 */
function buildBatchedPitchPrompt(signal, pattern, similarVideo, showData) {
  return `You are a content strategist for an Arabic YouTube channel.

CHANNEL: ${showData.name || 'Economic/Political Analysis'}
LANGUAGE: Arabic (Modern Standard Arabic)

TRENDING TOPIC:
${signal.title}
${signal.description || ''}

WINNING PATTERN TO USE: "${pattern.pattern_name}"
Pattern Formula: ${pattern.formula}
${pattern.example_titles?.length > 0 ? `
Examples of successful videos using this pattern:
${pattern.example_titles.slice(0, 2).map(t => `- ${t}`).join('\n')}
` : ''}

${similarVideo ? `
REFERENCE SUCCESS:
"${similarVideo.title}" got ${formatViews(similarVideo.views)} views
` : ''}

TASK:
Generate TWO video titles in Arabic for this topic:

1. LONG FORM (10-30 minutes, analytical):
   - Creates curiosity and promises deep insight (max 15 words)
   - Analytical angle for Arab viewers interested in geopolitics & economics

2. SHORT FORM (up to 3 minutes, punchy):
   - Is punchy and creates immediate curiosity (max 10 words)
   - Quick hook for social media sharing

Both should apply the "${pattern.pattern_name}" pattern.

RESPOND WITH ONLY:
LONG: [Your Arabic long-form title here]
LONG_HOOK: [One sentence explaining the angle]
SHORT: [Your Arabic short-form title here]
SHORT_HOOK: [One sentence explaining the angle]`;
}

/**
 * Parse batched AI response (both long and short form)
 */
function parseBatchedPitchResponse(content, pattern) {
  const lines = content.split('\n').filter(l => l.trim());
  
  let longTitle = '';
  let longReasoning = '';
  let shortTitle = '';
  let shortReasoning = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.match(/^LONG\s*:/i)) {
      longTitle = line.replace(/^LONG\s*:/i, '').trim();
    } else if (line.match(/^LONG_HOOK\s*:/i)) {
      longReasoning = line.replace(/^LONG_HOOK\s*:/i, '').trim();
    } else if (line.match(/^SHORT\s*:/i)) {
      shortTitle = line.replace(/^SHORT\s*:/i, '').trim();
    } else if (line.match(/^SHORT_HOOK\s*:/i)) {
      shortReasoning = line.replace(/^SHORT_HOOK\s*:/i, '').trim();
    }
  }
  
  // Fallback parsing if format doesn't match
  if (!longTitle && lines.length > 0) {
    const firstLine = lines[0].trim();
    if (!firstLine.match(/^(LONG|SHORT|LONG_HOOK|SHORT_HOOK)\s*:/i)) {
      longTitle = firstLine;
    }
  }
  
  if (!shortTitle && lines.length > 1) {
    const secondLine = lines[1].trim();
    if (!secondLine.match(/^(LONG|SHORT|LONG_HOOK|SHORT_HOOK)\s*:/i)) {
      shortTitle = secondLine;
    }
  }
  
  return {
    longForm: longTitle && longTitle.length >= 5 ? { title: longTitle, reasoning: longReasoning } : null,
    shortForm: shortTitle && shortTitle.length >= 5 ? { title: shortTitle, reasoning: shortReasoning } : null
  };
}

/**
 * Build the AI prompt for pitch generation
 */
function buildPitchPrompt(signal, pattern, similarVideo, showData, contentType) {
  const isShortForm = contentType === 'short_form';
  
  return `You are a content strategist for an Arabic YouTube channel.

CHANNEL: ${showData.name || 'Economic/Political Analysis'}
LANGUAGE: Arabic (Modern Standard Arabic)
CONTENT TYPE: ${isShortForm ? 'SHORT FORM (up to 3 minutes)' : 'LONG FORM (10-30 minutes)'}

TRENDING TOPIC:
${signal.title}
${signal.description || ''}

WINNING PATTERN TO USE: "${pattern.pattern_name}"
Pattern Formula: ${pattern.formula}
${pattern.example_titles?.length > 0 ? `
Examples of successful videos using this pattern:
${pattern.example_titles.slice(0, 2).map(t => `- ${t}`).join('\n')}
` : ''}

${similarVideo ? `
REFERENCE SUCCESS:
"${similarVideo.title}" got ${formatViews(similarVideo.views)} views
` : ''}

TASK:
Generate a VIDEO TITLE in Arabic that:
1. Applies the "${pattern.pattern_name}" pattern to this trending topic
2. ${isShortForm ? 'Is punchy and creates immediate curiosity (max 10 words)' : 'Creates curiosity and promises deep insight (max 15 words)'}
3. Would appeal to Arab viewers interested in geopolitics & economics

RESPOND WITH ONLY:
TITLE: [Your Arabic title here]
HOOK: [One sentence explaining the angle]`;
}

/**
 * Parse AI response into structured pitch
 */
function parsePitchResponse(content, pattern, contentType) {
  const lines = content.split('\n').filter(l => l.trim());
  
  let title = '';
  let reasoning = '';
  
  // Try multiple parsing strategies
  for (const line of lines) {
    // Check for TITLE: prefix (English)
    if (line.match(/^TITLE\s*:/i)) {
      title = line.replace(/^TITLE\s*:/i, '').trim();
    }
    // Check for Arabic title prefix
    else if (line.match(/^(العنوان|عنوان)\s*:/i)) {
      title = line.replace(/^(العنوان|عنوان)\s*:/i, '').trim();
    }
    // Check for HOOK: prefix
    else if (line.match(/^HOOK\s*:/i)) {
      reasoning = line.replace(/^HOOK\s*:/i, '').trim();
    }
    // Check for Arabic hook prefix
    else if (line.match(/^(الخطاف|الزاوية|السبب)\s*:/i)) {
      reasoning = line.replace(/^(الخطاف|الزاوية|السبب)\s*:/i, '').trim();
    }
  }
  
  // If no title found, try to extract from first line (might be title without prefix)
  if (!title && lines.length > 0) {
    const firstLine = lines[0].trim();
    // If first line doesn't look like a label, assume it's the title
    if (!firstLine.match(/^(TITLE|HOOK|العنوان|الخطاف|الزاوية|السبب)\s*:/i)) {
      title = firstLine;
    }
  }
  
  // Final fallback - use first non-empty line as title
  if (!title) {
    title = lines.find(l => l.trim() && !l.match(/^(TITLE|HOOK|العنوان|الخطاف|الزاوية|السبب)\s*:/i))?.trim() || content.trim();
  }
  
  // Ensure we have a title (should never be empty, but safety check)
  if (!title || title.length < 5) {
    console.warn('⚠️ Failed to parse pitch title from AI response:', content.substring(0, 100));
    // Don't return null - return a fallback that indicates parsing failed
    title = `[AI Generation Failed - Check Pattern: ${pattern.pattern_name}]`;
  }
  
  return { title, reasoning };
}

/**
 * Predict views based on pattern and similar videos
 * ENHANCED: More varied predictions based on multiple factors
 */
function predictViews(pattern, fingerprint, showData, similarVideo, signalScore = 50, signal = null) {
  // Base: channel average
  const channelAvg = showData?.avgViews || 600000;
  let predicted = channelAvg;
  
  // Factor 1: Pattern success rate (0.8x - 1.5x)
  const patternMultiplier = pattern.success_rate || 1;
  predicted *= patternMultiplier;
  
  // Factor 2: Signal quality score (0.7x - 1.3x)
  const scoreMultiplier = 0.7 + (signalScore / 100) * 0.6;
  predicted *= scoreMultiplier;
  
  // Factor 3: Competitor validation (+10-20%)
  if (signal) {
    const competitorBoost = signal.competitor_boost || 
                            (signal.multi_signal_scoring?.signals?.filter(s => 
                              s.type?.includes('competitor_breakout')
                            ).length || 0);
    if (competitorBoost > 20) {
      predicted *= 1.2; // 20% boost for strong competitor validation
    } else if (competitorBoost > 10) {
      predicted *= 1.1; // 10% boost
    }
  }
  
  // Factor 4: Similar video performance (blend 30%)
  if (similarVideo?.views) {
    predicted = (predicted * 0.7) + (similarVideo.views * 0.3);
  }
  
  // Factor 5: Audience demand (+5-15%)
  if (signal) {
    const audienceDemand = signal.audience_demand_score || 
                          Math.max(0, (signalScore - 50) * 0.5);
    if (audienceDemand > 20) {
      predicted *= 1.15; // 15% boost
    } else if (audienceDemand > 10) {
      predicted *= 1.08; // 8% boost
    }
  }
  
  // Cap at reasonable range (0.4x - 2.5x channel avg)
  predicted = Math.max(predicted, channelAvg * 0.4);
  predicted = Math.min(predicted, channelAvg * 2.5);
  
  // Round to nice number (nearest 10K)
  predicted = Math.round(predicted / 10000) * 10000;
  
  return predicted;
}

/**
 * Calculate prediction confidence
 * ENHANCED: More varied confidence based on data quality
 */
function calculateConfidence(pattern, signalScore = 50, similarVideo, signal = null) {
  let confidence = 0.45; // Base 45%
  
  // Pattern has good sample size
  if (pattern.video_count >= 15) confidence += 0.18;
  else if (pattern.video_count >= 8) confidence += 0.12;
  else if (pattern.video_count >= 4) confidence += 0.06;
  
  // Signal quality
  if (signalScore >= 90) confidence += 0.15;
  else if (signalScore >= 70) confidence += 0.10;
  else if (signalScore >= 50) confidence += 0.05;
  
  // Competitor validation
  if (signal) {
    const competitorBoost = signal.competitor_boost || 
                            (signal.multi_signal_scoring?.signals?.filter(s => 
                              s.type?.includes('competitor_breakout')
                            ).length || 0);
    if (competitorBoost > 15) confidence += 0.12;
    else if (competitorBoost > 0) confidence += 0.06;
  }
  
  // Found similar successful video
  if (similarVideo) confidence += 0.10;
  
  // Audience demand exists
  if (signal) {
    const audienceDemand = signal.audience_demand_score || 
                          Math.max(0, (signalScore - 50) * 0.5);
    if (audienceDemand > 0) confidence += 0.05;
  }
  
  // Cap between 40% and 95%
  return Math.min(Math.max(confidence, 0.40), 0.95);
}

/**
 * Extract evidence from signal scoring data
 * ENHANCED: Structured evidence with all details for display
 */
function extractEvidenceFromSignal(signal, pattern) {
  const signalScore = signal.score || signal.multi_signal_scoring?.score || 0;
  const avgViews = pattern.avg_views || 0;
  const successRate = pattern.success_rate || 1;
  
  // Extract competitor breakouts
  const competitors = [];
  let competitorBoost = 0;
  
  if (signal.multi_signal_scoring?.signals) {
    const scoringSignals = signal.multi_signal_scoring.signals;
    const competitorSignals = scoringSignals.filter(s => 
      s.type?.includes('competitor_breakout')
    );
    
    competitorSignals.forEach(signalData => {
      if (signalData.evidence) {
        competitors.push({
          channel: signalData.evidence.channelName || signalData.evidence.channel_name || 'Competitor',
          views: signalData.evidence.views || 0,
          multiplier: signalData.evidence.multiplier || 1,
          title: signalData.evidence.title?.substring(0, 50) || signal.title?.substring(0, 50),
          hoursAgo: signalData.evidence.hoursAgo,
          type: signalData.type?.includes('direct') ? 'direct' : 'trendsetter'
        });
      }
    });
    
    competitorBoost = competitorSignals.length;
  }
  
  // Extract audience demand
  let audienceDemand = null;
  if (signal.audience_demand_score) {
    audienceDemand = {
      score: signal.audience_demand_score,
      comments: signal.audience_evidence?.comment_count || 0
    };
  } else if (signal.multi_signal_scoring?.signals) {
    const audienceSignals = signal.multi_signal_scoring.signals.filter(s => 
      s.type?.includes('audience') || s.type?.includes('comment')
    );
    if (audienceSignals.length > 0) {
      const totalScore = audienceSignals.reduce((sum, s) => sum + (s.score || 0), 0);
      audienceDemand = {
        score: totalScore,
        comments: audienceSignals.reduce((sum, s) => sum + (s.evidence?.comment_count || 0), 0)
      };
    }
  }
  
  return {
    // Source signal
    signal: {
      title: signal.title,
      score: signalScore,
      source: signal.source || signal.source_name || 'Unknown'
    },
    
    // Pattern reasoning
    pattern: {
      reason: `"${pattern.pattern_name}" performs ${successRate.toFixed(2)}x your channel average`,
      avgViews: avgViews,
      videoCount: pattern.video_count || 0,
      successRate: successRate
    },
    
    // Competitor proof
    competitors: competitors.slice(0, 2),
    competitorBoost: competitorBoost,
    
    // Audience demand
    audienceDemand: audienceDemand,
    
    // Similar video will be added separately
    similarVideo: null
  };
}

/**
 * Generate "Why This Works" explanation
 */
function generateWhyThisWorks(pattern, fingerprint, showData) {
  const reasons = [];
  
  if (pattern.success_rate > 1.2) {
    reasons.push(`✓ "${pattern.pattern_name}" pattern performs ${Math.round((pattern.success_rate - 1) * 100)}% above your average`);
  }
  
  if (pattern.video_count >= 5) {
    reasons.push(`✓ Proven pattern with ${pattern.video_count} successful videos`);
  }
  
  if (fingerprint.topicCategory && pattern.trigger_entities?.topics) {
    reasons.push(`✓ Topic "${fingerprint.topicCategory}" matches your audience interests`);
  }
  
  return reasons;
}

/**
 * Find similar successful videos
 */
async function findSimilarSuccessfulVideos(fingerprint, showId, avgViews) {
  const { data: videos } = await supabase
    .from('channel_videos')
    .select('id, title, views, entities, matched_patterns')
    .eq('show_id', showId)
    .gt('views', avgViews * 0.8) // Above 80% of average
    .order('views', { ascending: false })
    .limit(50);
  
  if (!videos || videos.length === 0) return [];
  
  // Compare each video to the signal
  const similarities = [];
  
  for (const video of videos) {
    const comparison = await compareTopics(
      { title: fingerprint.title, fingerprint },
      { title: video.title },
      { skipEmbedding: true }
    );
    
    if (comparison.confidence > 0.3 || comparison.semanticSimilarity > 0.5) {
      similarities.push({
        ...video,
        similarity: comparison.confidence,
        semanticSimilarity: comparison.semanticSimilarity,
        entityOverlap: comparison.entityOverlap
      });
    }
  }
  
  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
}

/**
 * Determine urgency of signal
 * FIXED: Score-based classification (score >= 90 → Post Today, 50-89 → This Week, < 50 → Evergreen)
 */
export function determineUrgency(signal) {
  // Check if explicitly marked as evergreen
  if (signal.is_evergreen === true) {
    return 'evergreen';
  }
  
  // Get signal score
  const signalScore = signal.score || signal.multi_signal_scoring?.score || 0;
  
  // Get signal age in hours (for logging only, not used for classification)
  const createdAt = signal.created_at || signal.createdAt || signal.published_at || signal.publishedAt;
  const hoursAgo = createdAt 
    ? (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
    : 0;
  
  // Debug logging
  console.log(`🏷️ Classifying: "${signal.title?.substring(0, 30)}..." | Score: ${signalScore} | Hours old: ${hoursAgo.toFixed(1)}`);
  
  // POST TODAY: Score >= 90
  if (signalScore >= 90) {
    console.log(`   → POST TODAY (score: ${signalScore} >= 90)`);
    return 'post_today';
  }
  
  // THIS WEEK: Score 50-89
  if (signalScore >= 50) {
    console.log(`   → THIS WEEK (score: ${signalScore}, range: 50-89)`);
    return 'this_week';
  }
  
  // EVERGREEN: Score < 50
  console.log(`   → EVERGREEN (score: ${signalScore} < 50)`);
  return 'evergreen';
}

/**
 * Check if signal is evergreen (timeless content)
 * ENHANCED: Better detection of evergreen topics
 */
function isEvergreen(signal) {
  const title = (signal.title || '').toLowerCase();
  
  // Check for date references (makes it time-sensitive, not evergreen)
  const hasDateReference = /2024|2025|2026|today|yesterday|اليوم|أمس|غدا|tomorrow|هذا الأسبوع|الآن|now/i.test(title);
  
  if (hasDateReference) return false;
  
  // Evergreen patterns (timeless content)
  const evergreenPatterns = [
    /how .* works/i,
    /كيف .* يعمل/i,
    /how does/i,
    /كيف يعمل/i,
    /history of/i,
    /تاريخ/i,
    /guide to/i,
    /دليل/i,
    /what is/i,
    /ما هو/i,
    /من .* إلى/i,  // "from X to Y" stories
    /wall street/i,
    /وول ستريت/i,
    /stock market/i,
    /سوق الأسهم/i,
    /investment/i,
    /استثمار/i,
    /explained/i,
    /شرح/i,
    /understanding/i,
    /فهم/i,
    /why .* matters/i,
    /لماذا .* مهم/i,
    /fundamentals/i,
    /أساسيات/i,
    /principles/i,
    /مبادئ/i,
    /قصة/i,  // Story
    /story of/i
  ];
  
  return evergreenPatterns.some(p => p.test(title));
}

/**
 * Rank pitches by predicted performance
 */
function rankPitches(pitches, showData) {
  return pitches
    .filter(p => p !== null)
    .sort((a, b) => {
      // Score = predicted views * confidence
      const scoreA = a.predictedViews * a.predictionConfidence;
      const scoreB = b.predictedViews * b.predictionConfidence;
      return scoreB - scoreA;
    });
}

/**
 * Get show data
 */
async function getShowData(showId) {
  const { data: show } = await supabase
    .from('shows')
    .select('*')
    .eq('id', showId)
    .single();
  
  const { data: videos } = await supabase
    .from('channel_videos')
    .select('views')
    .eq('show_id', showId);
  
  const totalViews = videos?.reduce((sum, v) => sum + (v.views || 0), 0) || 0;
  const avgViews = videos?.length > 0 ? Math.round(totalViews / videos.length) : 100000;
  
  return {
    ...show,
    avgViews,
    videoCount: videos?.length || 0
  };
}

/**
 * Save pitch to history
 * Returns the database ID for the saved pitch
 */
async function savePitchHistory(showId, signal, pitch) {
  try {
    const { data, error } = await supabase
      .from('pitch_history')
      .insert({
        show_id: showId,
        signal_id: signal.id,
        signal_title: signal.title,
        pitch_title: pitch.title,
        pitch_title_ar: pitch.title_ar,
        pitch_angle: pitch.angle,
        pitch_reasoning: pitch.reasoning,
        urgency: signal.urgency || 'this_week',
        content_type: pitch.contentType,
        short_form_subtype: pitch.shortFormType,
        pattern_id: pitch.pattern?.id,
        pattern_name: pitch.pattern?.name,
        predicted_views: pitch.predictedViews,
        prediction_confidence: pitch.predictionConfidence,
        similar_video_title: pitch.similarVideo?.title,
        similar_video_views: pitch.similarVideo?.views,
        status: 'suggested'
      })
      .select('id')
      .single();
    
    if (error) {
      // If duplicate, try to find existing entry
      if (error.code === '23505') { // Unique violation
        const { data: existing } = await supabase
          .from('pitch_history')
          .select('id')
          .eq('show_id', showId)
          .eq('signal_id', signal.id)
          .eq('pattern_id', pitch.pattern?.id)
          .eq('content_type', pitch.contentType)
          .maybeSingle();
        
        if (existing) {
          return existing.id;
        }
      }
      console.error('Error saving pitch history:', error);
      return null;
    }
    
    return data?.id || null;
  } catch (error) {
    console.error('Error saving pitch history:', error);
    return null;
  }
}

/**
 * Format views for display
 */
function formatViews(views) {
  if (!views) return '0';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${Math.round(views / 1000)}K`;
  return views.toString();
}

/**
 * Select best pattern for a signal based on signal characteristics
 * FIXED: Ensures pattern variety instead of always using top pattern
 */
function selectBestPatternForSignal(signal, patterns, fingerprint) {
  if (!patterns || patterns.length === 0) return null;
  
  const signalText = ((signal.title || '') + ' ' + (signal.description || '')).toLowerCase();
  
  // Score each pattern for this signal
  const scored = patterns.map(p => {
    let score = p.success_rate || 1;
    
    // Bonus if signal matches pattern keywords/triggers
    if (p.trigger_keywords && Array.isArray(p.trigger_keywords)) {
      const matchingKeywords = p.trigger_keywords.filter(kw => 
        signalText.includes(kw.toLowerCase())
      ).length;
      score += matchingKeywords * 0.15; // Increased from 0.1
    }
    
    // Pattern-specific bonuses (increased to make matching more decisive)
    if (p.pattern_id === 'question_hook' && /[؟?]/.test(signalText)) {
      score += 0.6; // Increased from 0.5
    }
    if (p.pattern_id === 'superpower_competition') {
      // Only match if MULTIPLE superpowers mentioned (not just one)
      const superpowerCount = ['china', 'russia', 'usa', 'america', 'الصين', 'روسيا', 'أمريكا'].filter(s => 
        signalText.includes(s)
      ).length;
      if (superpowerCount >= 2) {
        score += 0.5; // Strong match
      } else if (superpowerCount === 1) {
        score += 0.1; // Weak match - prefer other patterns
      }
    }
    if (p.pattern_id === 'economic_stakes' && 
        (/\d+.*(?:مليار|مليون|billion|million)/i.test(signalText) || 
         signalText.includes('$') || signalText.includes('نفط') || signalText.includes('oil'))) {
      score += 0.5; // Increased from 0.3
    }
    if (p.pattern_id === 'hidden_truth' && 
        (signalText.includes('لماذا') || signalText.includes('why') || 
         signalText.includes('لعنة') || signalText.includes('خطأ') || 
         signalText.includes('secret') || signalText.includes('سر'))) {
      score += 0.5; // Increased from 0.3
    }
    if (p.pattern_id === 'strategic_howto' && 
        (signalText.includes('كيف') || signalText.includes('how') || 
         signalText.includes('خطة') || signalText.includes('plan'))) {
      score += 0.5; // Increased from 0.3
    }
    
    // Entity matching bonus
    if (fingerprint && p.trigger_entities) {
      const signalEntities = fingerprint.entities || {};
      if (p.trigger_entities.countries) {
        const matchingCountries = p.trigger_entities.countries.filter(c => 
          (signalEntities.countries || []).some(sc => 
            sc.toLowerCase().includes(c.toLowerCase()) || 
            c.toLowerCase().includes(sc.toLowerCase())
          )
        ).length;
        score += matchingCountries * 0.3; // Increased from 0.2
      }
      if (p.trigger_entities.topics) {
        const matchingTopics = p.trigger_entities.topics.filter(t => 
          (signalEntities.topics || []).some(st => 
            st.toLowerCase().includes(t.toLowerCase()) || 
            t.toLowerCase().includes(st.toLowerCase())
          )
        ).length;
        score += matchingTopics * 0.3; // Increased from 0.2
      }
    }
    
    return { pattern: p, score };
  });
  
  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);
  
  // Log top 3 patterns for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 Pattern scores for "${signal.title?.substring(0, 30)}...":`, 
      scored.slice(0, 3).map(s => `${s.pattern.pattern_name}: ${s.score.toFixed(2)}`).join(', '));
  }
  
  return scored[0]?.pattern || patterns[0];
}

export { formatViews };
