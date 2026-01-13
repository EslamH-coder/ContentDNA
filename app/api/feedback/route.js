/**
 * FEEDBACK API
 * Tracks user feedback on signals/ideas to improve recommendations
 * Supports both explicit and implicit feedback
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';
import { generateTopicFingerprint } from '@/lib/topicIntelligence.js';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns.js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/feedback
 * Records user feedback on a signal/idea
 * 
 * Body:
 * - show_id: Show ID
 * - signal_id: Signal ID (optional, for signal-based feedback)
 * - recommendation_id: Recommendation ID (optional, for recommendation-based feedback)
 * - action: 'liked' | 'rejected' | 'saved' | 'generate_pitch' | 'ignored' | 'card_expanded' | 'hovered_5s' | 'clicked_source'
 * - topic: Topic/title of the signal
 * - signal_data: Full signal data (optional, for learning)
 * - scoring_data: Scoring data from multi-signal system (optional)
 * - urgency_tier: Urgency tier if applicable (optional)
 */
export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      show_id,
      signal_id,
      recommendation_id,
      action,
      topic,
      signal_data,
      scoring_data,
      urgency_tier,
      rejection_reason,
      session_id,
    } = body;

    if (!show_id || !action) {
      return NextResponse.json(
        { error: 'show_id and action are required' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = [
      'liked',
      'rejected',
      'saved',
      'generate_pitch',
      'ignored',
      'card_expanded',
      'hovered_5s',
      'clicked_source',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Extract signal context for learning
    const ideaData = {
      topic: topic || signal_data?.title || '',
      dnaMatch: scoring_data?.signals?.filter(s => s.type === 'dna_match').map(s => s.text) || [],
      signals: scoring_data?.signals?.map(s => s.type) || [],
      score: scoring_data?.score || signal_data?.score || 0,
      tier: urgency_tier || scoring_data?.urgency_tier || null,
      competitorBreakout: scoring_data?.signals?.find(s => s.type === 'competitor_breakout')?.data || null,
      competitorCount: scoring_data?.signals?.find(s => s.type === 'competitor_volume')?.text || null,
    };

    // Insert feedback record
    const { data: feedback, error } = await supabaseAdmin
      .from('recommendation_feedback')
      .insert({
        show_id,
        recommendation_id: recommendation_id || signal_id || `signal_${Date.now()}`,
        topic: topic || signal_data?.title || '',
        action,
        rejection_reason,
        evidence_summary: {
          signal_id,
          idea_data: ideaData,
          scoring_data,
          urgency_tier,
        },
        shown_at: new Date().toISOString(),
        session_id: session_id || `session_${Date.now()}`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving feedback:', error);
      return NextResponse.json(
        { error: 'Failed to save feedback', details: error.message },
        { status: 500 }
      );
    }

    // Update signal status if applicable
    if (signal_id && (action === 'liked' || action === 'saved' || action === 'generate_pitch')) {
      try {
        const statusUpdate = action === 'liked' ? 'approved' : action === 'saved' ? 'saved' : 'reviewed';
        await supabaseAdmin
          .from('signals')
          .update({ 
            status: statusUpdate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', signal_id);
      } catch (statusError) {
        console.warn('⚠️ Failed to update signal status (non-fatal):', statusError);
      }
    }

    console.log(`✅ Feedback recorded: ${action} for signal ${signal_id || recommendation_id}`);

    // === ENHANCED LEARNING WITH TOPIC INTELLIGENCE ===
    try {
      // Generate fingerprint for the signal (for learning from categories/entities)
      const signalTitle = topic || signal_data?.title || '';
      const signalDescription = signal_data?.description || '';
      
      if (signalTitle) {
        const fingerprint = await generateTopicFingerprint({
          title: signalTitle,
          description: signalDescription,
          id: signal_id,
          type: 'signal',
          skipEmbedding: true, // Skip embedding for learning (not needed)
          skipCache: false // Use cache for performance
        });
        
        // Get current learning weights
        const { data: learningData } = await supabaseAdmin
          .from('show_learning_weights')
          .select('topic_weights, source_weights, pattern_weights, category_weights')
          .eq('show_id', showId)
          .maybeSingle();
        
        let topicWeights = learningData?.topic_weights || {};
        let categoryWeights = learningData?.category_weights || {};
        let patternWeights = learningData?.pattern_weights || {};
        
        // === LEARN FROM TOPIC CATEGORY ===
        const category = fingerprint.topicCategory;
        if (category && category !== 'general') {
          if (!categoryWeights[category]) {
            categoryWeights[category] = { liked: 0, rejected: 0, weight: 1.0 };
          }
          
          if (action === 'liked' || action === 'saved' || action === 'produced') {
            categoryWeights[category].liked += 1;
            categoryWeights[category].weight *= 1.1; // 10% boost
            console.log(`📈 Category "${category}" boosted (liked: ${categoryWeights[category].liked})`);
          } else if (action === 'rejected') {
            categoryWeights[category].rejected += 1;
            categoryWeights[category].weight *= 0.95; // 5% penalty
            console.log(`📉 Category "${category}" penalized (rejected: ${categoryWeights[category].rejected})`);
          }
        }
        
        // === LEARN FROM ENTITIES ===
        const entities = fingerprint.entities;
        
        // Learn from countries
        for (const country of entities.countries) {
          const key = `country_${country.toLowerCase()}`;
          if (!topicWeights[key]) {
            topicWeights[key] = { liked: 0, rejected: 0, weight: 1.0 };
          }
          
          if (action === 'liked' || action === 'saved' || action === 'produced') {
            topicWeights[key].liked += 1;
            topicWeights[key].weight *= 1.08;
          } else if (action === 'rejected') {
            topicWeights[key].rejected += 1;
            topicWeights[key].weight *= 0.95;
          }
        }
        
        // Learn from topics
        for (const topicEntity of entities.topics) {
          const key = `topic_${topicEntity.toLowerCase()}`;
          if (!topicWeights[key]) {
            topicWeights[key] = { liked: 0, rejected: 0, weight: 1.0 };
          }
          
          if (action === 'liked' || action === 'saved' || action === 'produced') {
            topicWeights[key].liked += 1;
            topicWeights[key].weight *= 1.08;
          } else if (action === 'rejected') {
            topicWeights[key].rejected += 1;
            topicWeights[key].weight *= 0.95;
          }
        }
        
        // Learn from people (lower weight to avoid over-learning)
        for (const person of entities.people) {
          const key = `person_${person.toLowerCase()}`;
          if (!topicWeights[key]) {
            topicWeights[key] = { liked: 0, rejected: 0, weight: 1.0 };
          }
          
          if (action === 'liked' || action === 'saved' || action === 'produced') {
            topicWeights[key].liked += 1;
            topicWeights[key].weight *= 1.05; // Lower weight for people (avoid over-learning)
          } else if (action === 'rejected') {
            topicWeights[key].rejected += 1;
            topicWeights[key].weight *= 0.97;
          }
        }
        
        // === LEARN FROM PATTERN MATCHES ===
        const patterns = await getShowPatterns(showId);
        const patternScore = await scoreSignalByPatterns(signal_data || { title: signalTitle, description: signalDescription }, patterns);
        
        for (const match of patternScore.matches || []) {
          const patternId = match.patternId;
          
          if (!patternWeights[patternId]) {
            patternWeights[patternId] = { liked: 0, rejected: 0, weight: 1.0 };
          }
          
          if (action === 'liked' || action === 'saved' || action === 'produced') {
            patternWeights[patternId].liked += 1;
            patternWeights[patternId].weight *= 1.1;
          } else if (action === 'rejected') {
            patternWeights[patternId].rejected += 1;
            patternWeights[patternId].weight *= 0.95;
          }
        }
        
        // === SAVE UPDATED WEIGHTS ===
        await supabaseAdmin
          .from('show_learning_weights')
          .upsert({
            show_id: showId,
            topic_weights: topicWeights,
            category_weights: categoryWeights,
            pattern_weights: patternWeights,
            updated_at: new Date().toISOString()
          }, { onConflict: 'show_id' });
        
        console.log('🧠 Learning updated:', {
          category,
          entities: {
            countries: entities.countries.length,
            topics: entities.topics.length,
            people: entities.people.length
          },
          patterns: patternScore.matches?.length || 0
        });
        
      }
    } catch (learningError) {
      console.error('Learning error:', learningError);
      // Don't fail the request if learning fails
    }

    return NextResponse.json({
      success: true,
      feedback,
    });

  } catch (error) {
    console.error('❌ Feedback API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback
 * Retrieves feedback history for learning
 * 
 * Query params:
 * - show_id: Show ID (required)
 * - days: Number of days to look back (default: 90)
 * - action: Filter by action type (optional)
 */
export async function GET(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('show_id') || searchParams.get('showId');
    const days = parseInt(searchParams.get('days') || '90');
    const action = searchParams.get('action');

    if (!showId) {
      return NextResponse.json(
        { error: 'show_id is required' },
        { status: 400 }
      );
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    let query = supabaseAdmin
      .from('recommendation_feedback')
      .select('*')
      .eq('show_id', showId)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false });

    if (action) {
      query = query.eq('action', action);
    }

    const { data: feedbacks, error } = await query;

    if (error) {
      console.error('❌ Error fetching feedback:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedbacks: feedbacks || [],
      count: feedbacks?.length || 0,
    });

  } catch (error) {
    console.error('❌ Feedback GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
