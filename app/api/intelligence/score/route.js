/**
 * SCORE SINGLE TOPIC API
 * Supports both old (evidence-based) and new (interest-based) scoring
 */

import { NextResponse } from 'next/server';
import { collectEvidence } from '@/lib/intelligence/evidenceCollector.js';
import { generatePitch } from '@/lib/ai/claudePitcher.js';
import { scoreTopicEnhanced, scoreRSSFeed } from '@/lib/intelligence/enhancedScoring.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      topic, 
      topics, // For batch scoring
      description = '', 
      generateFullPitch = true,
      useEnhanced = true // Use new interest-based scoring by default
    } = body;

    // Batch scoring with enhanced system
    if (topics && Array.isArray(topics) && useEnhanced) {
      console.log(`\n📊 Batch scoring ${topics.length} topics with enhanced system...`);
      const result = await scoreRSSFeed(topics);
      return NextResponse.json({ success: true, ...result });
    }

    // Single topic scoring
    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' },
        { status: 400 }
      );
    }

    // Use enhanced scoring if requested
    if (useEnhanced) {
      console.log(`\n📊 Scoring topic with enhanced system: "${typeof topic === 'string' ? topic.substring(0, 50) : topic.title?.substring(0, 50) || '...'}..."`);
      
      const result = await scoreTopicEnhanced(topic, null);
      
      // Generate pitch if requested
      let pitch = null;
      if (generateFullPitch && result.scores.total >= 40) {
        try {
          const pitchResult = await generatePitch(result.title, {
            searchEvidence: result.evidence.search,
            competitorEvidence: result.evidence.competitor,
            scores: result.scores
          });
          if (pitchResult.success) {
            pitch = pitchResult.pitch;
          }
        } catch (e) {
          console.warn('Pitch generation failed:', e.message);
        }
      }

      return NextResponse.json({
        success: true,
        ...result,
        pitch
      });
    }

    // Legacy evidence-based scoring
    console.log(`\n📊 Scoring topic (legacy): "${topic.substring(0, 50)}..."`);

    const evidence = await collectEvidence(topic, description);

    // Generate pitch if requested and has evidence
    let pitch = null;
    if (generateFullPitch && evidence.hasEvidence) {
      const pitchResult = await generatePitch(topic, evidence);
      if (pitchResult.success) {
        pitch = pitchResult.pitch;
      }
    }

    return NextResponse.json({
      success: true,
      topic,
      score: evidence.scores.total,
      recommendationLevel: evidence.recommendationLevel,
      evidenceStrength: evidence.evidenceStrength,
      evidence: {
        search: evidence.searchEvidence,
        audience: evidence.audienceEvidence,
        competitor: evidence.competitorEvidence,
        comments: evidence.commentEvidence,
        scores: evidence.scores
      },
      persona: evidence.personaMatch?.primaryPersona || null,
      pitch
    });

  } catch (error) {
    console.error('Score error:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

