/**
 * AI Validation for Post Today Decisions
 * Ensures high-stakes decisions are correct
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Validate if a signal truly deserves "Post Today" status
 * This is called for signals that score 85+ to confirm urgency
 */
export async function validatePostTodayDecision(signal, scoringResult, channelContext) {
  const { score, signals: scoringSignals } = scoringResult;
  
  // Only validate high-scoring signals
  if (score < 85) {
    return { validated: true, reason: 'Score below threshold, no validation needed' };
  }
  
  const prompt = `You are validating if a news signal should be marked as "POST TODAY" (urgent) for a YouTube channel.

CHANNEL CONTEXT:
- Name: ${channelContext.name || 'Economics & Geopolitics Channel'}
- Focus: ${channelContext.description || 'Global economics, geopolitics, finance'}
- Language: Arabic

SIGNAL TO VALIDATE:
- Title: "${signal.title}"
- Source: ${signal.source || 'Unknown'}
- Score: ${score}/100

SCORING SIGNALS DETECTED:
${scoringSignals.map(s => `- ${s.type}: ${s.text || s.subtext || ''}`).join('\n')}

QUESTION: Should this be marked as "POST TODAY" (meaning the channel should cover this IMMEDIATELY)?

Consider:
1. Is this breaking news that will lose relevance quickly?
2. Are competitors actively covering this RIGHT NOW?
3. Does this match the channel's core topics?
4. Is there genuine urgency, or is the score inflated?

Respond with ONLY valid JSON:
{
  "shouldPostToday": true or false,
  "confidence": 0.0 to 1.0,
  "urgencyLevel": "critical|high|medium|low",
  "reason": "One sentence explanation",
  "suggestedTier": "post_today|this_week|backlog"
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    });
    
    const cleanJson = response.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const result = JSON.parse(cleanJson);
    
    console.log(`   🤖 Post Today validation: ${result.shouldPostToday ? '✅ CONFIRMED' : '❌ REJECTED'} - ${result.reason}`);
    
    return {
      validated: result.shouldPostToday,
      suggestedTier: result.suggestedTier,
      confidence: result.confidence,
      urgencyLevel: result.urgencyLevel,
      reason: result.reason
    };
    
  } catch (error) {
    console.error(`   ❌ Post Today validation error:`, error.message);
    // On error, trust the original scoring
    return { validated: true, reason: 'Validation error, trusting original score' };
  }
}