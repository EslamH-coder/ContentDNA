/**
 * Learn from pitch outcomes
 */

import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Record user feedback on a pitch
 * Handles both UUIDs (from database) and composite IDs (from Studio)
 */
export async function recordPitchFeedback(pitchId, feedback, reason = null) {
  // Try to find pitch by ID (UUID or composite)
  let pitch = null;
  
  // First try direct lookup (UUID)
  const { data: existing } = await supabase
    .from('pitch_history')
    .select('id, show_id, pattern_id')
    .eq('id', pitchId)
    .maybeSingle();
  
  if (existing) {
    pitch = existing;
  } else {
    // Try to parse composite ID (pitch_signalId_pattern_contentType_idx)
    const parts = pitchId.split('_');
    if (parts.length >= 4 && parts[0] === 'pitch') {
      const signalId = parts[1];
      const patternId = parts[2];
      const contentType = parts.slice(3, -1).join('_');
      
      const { data: byComposite } = await supabase
        .from('pitch_history')
        .select('id, show_id, pattern_id')
        .eq('signal_id', signalId)
        .eq('pattern_id', patternId)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (byComposite) {
        pitch = byComposite;
        pitchId = byComposite.id; // Use database ID for update
      }
    }
  }
  
  if (!pitch) {
    console.warn(`Pitch ${pitchId} not found in history, skipping feedback`);
    return;
  }
  
  // Update feedback
  await supabase
    .from('pitch_history')
    .update({
      user_feedback: feedback, // 'liked', 'rejected', 'saved'
      feedback_reason: reason,
      status: feedback === 'saved' ? 'saved' : feedback === 'rejected' ? 'rejected' : 'suggested'
    })
    .eq('id', pitch.id);
  
  // Update pattern weights based on feedback
  if (pitch.pattern_id && pitch.show_id) {
    const weightChange = feedback === 'liked' || feedback === 'saved' ? 1.05 : 
                         feedback === 'rejected' ? 0.95 : 1;
    
    await updatePatternWeight(pitch.show_id, pitch.pattern_id, weightChange);
  }
}

/**
 * Mark pitch as produced (video created)
 * Handles both UUIDs and composite IDs
 */
export async function markPitchProduced(pitchId, videoId) {
  // Try to find pitch by ID (UUID or composite)
  let dbId = pitchId;
  
  // First try direct lookup (UUID)
  const { data: existing } = await supabase
    .from('pitch_history')
    .select('id')
    .eq('id', pitchId)
    .maybeSingle();
  
  if (!existing) {
    // Try to parse composite ID
    const parts = pitchId.split('_');
    if (parts.length >= 4 && parts[0] === 'pitch') {
      const signalId = parts[1];
      const patternId = parts[2];
      const contentType = parts.slice(3, -1).join('_');
      
      const { data: byComposite } = await supabase
        .from('pitch_history')
        .select('id')
        .eq('signal_id', signalId)
        .eq('pattern_id', patternId)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (byComposite) {
        dbId = byComposite.id;
      } else {
        console.warn(`Pitch ${pitchId} not found in history`);
        return;
      }
    } else {
      console.warn(`Pitch ${pitchId} not found in history`);
      return;
    }
  }
  
  await supabase
    .from('pitch_history')
    .update({
      status: 'produced',
      produced_video_id: videoId,
      produced_at: new Date().toISOString()
    })
    .eq('id', dbId);
}

/**
 * Update pitch with actual video performance
 */
export async function updatePitchPerformance(pitchId, actualViews) {
  const { data: pitch } = await supabase
    .from('pitch_history')
    .select('predicted_views, pattern_id, show_id')
    .eq('id', pitchId)
    .single();
  
  if (!pitch) return;
  
  const performanceRatio = actualViews / (pitch.predicted_views || 1);
  
  // Update pitch
  await supabase
    .from('pitch_history')
    .update({
      actual_views: actualViews,
      performance_ratio: performanceRatio,
      status: 'published'
    })
    .eq('id', pitchId);
  
  // Learn from performance
  if (pitch.pattern_id) {
    // If outperformed prediction, boost pattern
    const weightChange = performanceRatio > 1.2 ? 1.1 :
                         performanceRatio < 0.8 ? 0.95 : 1;
    
    if (weightChange !== 1) {
      await updatePatternWeight(pitch.show_id, pitch.pattern_id, weightChange);
    }
  }
}

/**
 * Update pattern weight
 */
export async function updatePatternWeight(showId, patternId, multiplier) {
  const { data: pattern } = await supabase
    .from('show_winning_patterns')
    .select('weight, confidence')
    .eq('show_id', showId)
    .eq('pattern_id', patternId)
    .single();
  
  if (pattern) {
    const newWeight = Math.max(0.5, Math.min(2, (pattern.weight || 1) * multiplier));
    
    await supabase
      .from('show_winning_patterns')
      .update({ 
        weight: newWeight,
        updated_at: new Date().toISOString()
      })
      .eq('show_id', showId)
      .eq('pattern_id', patternId);
  }
}
