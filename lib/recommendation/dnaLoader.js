import path from 'path';
import { promises as fs } from 'fs';

/**
 * Load DNA config and format it for the recommendation engine
 */
export async function loadShowDna(showId = null) {
  const projectRoot = process.cwd();
  const configDir = path.join(projectRoot, 'scripts', 'config');
  
  let dnaConfig = null;
  try {
    const dnaFile = path.join(configDir, 'channel_dna.json');
    const altDnaFile = path.join(configDir, 'show_dna_almokhbir.json');
    
    if (await fs.access(dnaFile).then(() => true).catch(() => false)) {
      const content = await fs.readFile(dnaFile, 'utf8');
      dnaConfig = JSON.parse(content);
    } else if (await fs.access(altDnaFile).then(() => true).catch(() => false)) {
      const content = await fs.readFile(altDnaFile, 'utf8');
      dnaConfig = JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading DNA config:', error);
    return null;
  }
  
  if (!dnaConfig) {
    return null;
  }
  
  // If showId is provided, try to fetch video-based DNA and scoring_keywords from database
  // Note: In server-side context, we can calculate DNA directly
  let videoBasedDna = null;
  let dbScoringKeywords = null;
  let dbScoringWeights = null;
  
  if (showId) {
    try {
      // Try to load from Supabase directly (server-side)
      const { supabaseAdmin } = await import('@/lib/supabase');
      const db = supabaseAdmin;
      
      if (db) {
        // Load scoring_keywords and scoring_weights from show_dna table
        const { data: showDnaData, error: showDnaError } = await db
          .from('show_dna')
          .select('scoring_keywords, scoring_weights')
          .eq('show_id', showId)
          .single();
        
        if (!showDnaError && showDnaData) {
          dbScoringKeywords = showDnaData.scoring_keywords || null;
          dbScoringWeights = showDnaData.scoring_weights || null;
          console.log(`📊 Loaded scoring_keywords from show_dna table for show ${showId}`);
          if (dbScoringKeywords) {
            console.log(`📊 DNA loaded:`, Object.keys(dbScoringKeywords));
            console.log(`   - just_numbers_reject: ${dbScoringKeywords.just_numbers_reject?.length || 0} patterns`);
            console.log(`   - no_story_reject: ${dbScoringKeywords.no_story_reject?.length || 0} patterns`);
            console.log(`   - blacklist: ${dbScoringKeywords.blacklist?.length || 0} words`);
            console.log(`   - high_engagement: ${dbScoringKeywords.high_engagement?.length || 0} words`);
            console.log(`   - low_engagement_penalty: ${dbScoringKeywords.low_engagement_penalty?.length || 0} words`);
          }
        }
        
        // Load video-based DNA
        const { data: videos, error } = await db
          .from('videos')
          .select('*')
          .eq('show_id', showId)
          .order('published_at', { ascending: false });
        
        if (!error && videos && videos.length > 0) {
          // Calculate DNA from videos (copy logic from recalculate route)
          const topicStats = {};
          
          videos.forEach(video => {
            const topicId = video.topic_id || 'unknown';
            if (!topicStats[topicId]) {
              topicStats[topicId] = {
                total: 0,
                overPerforming: 0,
                totalViews: 0,
              };
            }
            topicStats[topicId].total++;
            topicStats[topicId].totalViews += video.view_count || 0;
            if (video.performance_classification === 'over_performing') {
              topicStats[topicId].overPerforming++;
            }
          });
          
          const topics = Object.entries(topicStats)
            .filter(([topicId]) => topicId !== 'unknown')
            .map(([topicId, stats]) => ({
              topicId,
              topic_id: topicId,
              successRate: stats.total > 0 ? (stats.overPerforming / stats.total) * 100 : 0,
              success_rate: stats.total > 0 ? (stats.overPerforming / stats.total) * 100 : 0,
              avgViews: stats.total > 0 ? Math.round(stats.totalViews / stats.total) : 0,
              avg_views: stats.total > 0 ? Math.round(stats.totalViews / stats.total) : 0,
            }));
          
          // Simple hook patterns (can be enhanced)
          const hookPatterns = [
            { hook_type: 'Threat Claim', pattern: 'Threat Claim', avgViews: 5600000, template: '[رقم] في خطر... [السبب]!' },
            { hook_type: 'Reveal', pattern: 'Reveal', avgViews: 5500000, template: 'اللي [الكيان] مش بتقولهولك...' },
            { hook_type: 'Fact Anchor', pattern: 'Fact Anchor', avgViews: 3500000, template: '[رقم] | [حقيقة]' }
          ];
          
          videoBasedDna = {
            topics,
            hook_patterns: hookPatterns,
            audience_triggers: []
          };
        }
      }
    } catch (error) {
      console.warn('Could not load video-based DNA or scoring_keywords, using static config:', error.message);
    }
  }
  
  // Format DNA for recommendation engine
  const showDna = {
    // Topics from video-based DNA or static config
    topics: videoBasedDna?.topics || dnaConfig.winning_topics?.map(t => ({
      topicId: t.id || t.topic_id,
      topic_id: t.id || t.topic_id,
      successRate: videoBasedDna ? undefined : 75, // Default if not from videos
      success_rate: videoBasedDna ? undefined : 75,
      avgViews: videoBasedDna ? undefined : 5000000,
      avg_views: videoBasedDna ? undefined : 5000000,
      status: 'winning' // From static config
    })) || [],
    
    // Hook patterns from video-based DNA or static config
    hook_patterns: videoBasedDna?.hook_patterns || Object.entries(dnaConfig.hook_performance || {}).map(([hookType, data]) => ({
      hook_type: hookType,
      pattern: hookType,
      avgViews: data.avg_views || 5000000,
      avg_views: data.avg_views || 5000000,
      template: data.template || `[${hookType} template]`
    })) || [],
    
    // Audience triggers
    audience_triggers: videoBasedDna?.audience_triggers || [],
    
    // Scoring keywords from database (or fallback to config file)
    scoring_keywords: dbScoringKeywords || dnaConfig.scoring_keywords || {
      just_numbers_reject: [],
      no_story_reject: [],
      blacklist: [],
      high_engagement: [],
      low_engagement_penalty: []
    },
    
    // Scoring weights from database (or fallback to config file)
    scoring_weights: dbScoringWeights || dnaConfig.scoring_weights || {
      high_engagement_bonus: 25,
      low_engagement_penalty: 20
    }
  };
  
  return showDna;
}

