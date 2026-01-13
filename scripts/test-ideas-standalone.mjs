/**
 * STANDALONE IDEAS FEATURE TEST
 * 
 * This version works around the module loading issue by creating its own Supabase client
 * and implementing a simplified learning system.
 * 
 * Run with: node scripts/test-ideas-standalone.mjs <show_id>
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { calculateIdeaScore, getUrgencyTier } from '../lib/scoring/multiSignalScoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local or .env file manually
function loadEnv() {
  const envFiles = [join(__dirname, '../.env.local'), join(__dirname, '../.env')];
  for (const envFile of envFiles) {
    try {
      const content = readFileSync(envFile, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^#=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      });
    } catch (e) {
      // File doesn't exist, continue
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Tip: Make sure your .env.local file exists and has these values');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified learning adjustments (without importing the module)
async function getLearnedAdjustmentsSimple(showId, days = 90) {
  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: feedbacks } = await supabase
      .from('recommendation_feedback')
      .select('*')
      .eq('show_id', showId)
      .gte('created_at', sinceDate.toISOString());

    return {
      topicScores: {},
      signalEffectiveness: {},
      formatPreferences: {},
      feedbackCount: feedbacks?.length || 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return {
      topicScores: {},
      signalEffectiveness: {},
      formatPreferences: {},
      feedbackCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

function applyLearnedAdjustmentsSimple(baseScore, idea, learned) {
  // Simplified version - just return base score for now
  return baseScore;
}

// Helper function to normalize text
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ');
}

async function testIdeasFeature(showId) {
  console.log('\n🧪 TESTING IDEAS FEATURE WITH REAL DATA\n');
  console.log('='.repeat(60));
  console.log(`Show ID: ${showId}`);
  console.log('='.repeat(60));

  try {
    // STEP 1: Get raw signals
    console.log('\n📰 STEP 1: Fetching raw signals from database...');
    
    const { data: rawSignals, error: signalsError } = await supabase
      .from('signals')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (signalsError) {
      console.error('❌ Error fetching signals:', signalsError);
      return;
    }

    console.log(`✅ Found ${rawSignals?.length || 0} raw signals in database`);
    
    if (!rawSignals || rawSignals.length === 0) {
      console.log('\n⚠️  No signals found. Please run RSS processor first:');
      console.log(`   GET /api/rss-processor?show_id=${showId}`);
      console.log(`   Or visit: http://localhost:3000/api/rss-processor?show_id=${showId}`);
      return;
    }

    // STEP 2: Fetch context data
    console.log('\n📊 STEP 2: Fetching context data...');

    // Fix: competitor_videos doesn't have show_id, need to join through competitors
    // First get competitor IDs for this show
    const { data: showCompetitors } = await supabase
      .from('competitors')
      .select('id')
      .eq('show_id', showId);
    
    const competitorIds = showCompetitors?.map(c => c.id) || [];
    console.log(`   📋 Found ${competitorIds.length} competitors for this show`);
    
    // Get competitor videos (competitors table has 'name' not 'channel_name')
    // Try without join first (more reliable)
    const { data: videosNoJoin, error: noJoinError } = await supabase
      .from('competitor_videos')
      .select('*')
      .in('competitor_id', competitorIds)
      .order('published_at', { ascending: false })
      .limit(200);
    
    let competitorVideos = [];
    
    if (noJoinError) {
      console.error('   ❌ Error fetching competitor videos:', noJoinError);
    } else if (videosNoJoin) {
      // Fetch competitor data separately
      const { data: compData } = await supabase
        .from('competitors')
        .select('id, name, youtube_channel_id, show_id')
        .in('id', competitorIds);
      
      const compMap = new Map(compData?.map(c => [c.id, c]) || []);
      
      competitorVideos = videosNoJoin.map(v => ({
        ...v,
        competitors: compMap.get(v.competitor_id) || { id: v.competitor_id, name: 'Unknown' }
      }));
      
      console.log(`   📊 Total competitor videos: ${competitorVideos.length}`);
      
      // Filter to last 7 days for display
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const recentVideos = competitorVideos.filter(v => v.published_at >= sevenDaysAgo);
      console.log(`   📊 Recent videos (last 7 days): ${recentVideos.length}`);
    }

    const normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
      ...video,
      views: video.views || video.view_count || video.viewCount || 0,
      published_at: video.published_at || video.publishedAt || video.created_at,
      competitor_id: video.competitor_id || video.competitors?.id,
      competitors: video.competitors || {},
    }));

    console.log(`   📊 Competitor videos: ${normalizedCompetitorVideos.length}`);

    const { data: userVideos } = await supabase
      .from('channel_videos')
      .select('id, title, published_at, topic_id')
      .eq('show_id', showId)
      .order('published_at', { ascending: false })
      .limit(100);

    const normalizedUserVideos = (userVideos || []).map(video => ({
      ...video,
      published_at: video.published_at || video.publishedAt || video.created_at,
      title: video.title || '',
    }));

    console.log(`   📹 User videos: ${normalizedUserVideos.length}`);

    const { data: showDna } = await supabase
      .from('show_dna')
      .select('topics')
      .eq('show_id', showId)
      .single();

    let dnaTopics = [];
    if (showDna?.topics) {
      if (Array.isArray(showDna.topics)) {
        dnaTopics = showDna.topics;
      } else if (typeof showDna.topics === 'string') {
        try {
          dnaTopics = JSON.parse(showDna.topics);
        } catch (e) {
          // Ignore
        }
      } else if (typeof showDna.topics === 'object') {
        dnaTopics = Object.values(showDna.topics).filter(Boolean);
      }
    }

    if (!Array.isArray(dnaTopics)) {
      dnaTopics = [];
    }

    console.log(`   🧬 DNA topics: ${dnaTopics.length}`);

    const learnedAdjustments = await getLearnedAdjustmentsSimple(showId, 90);
    console.log(`   🧠 Learned adjustments: ${learnedAdjustments.feedbackCount} feedback entries`);

    // STEP 3: Apply scoring
    console.log('\n🎯 STEP 3: Applying multi-signal scoring...');

    const signalTitleMap = new Map();
    for (const signal of rawSignals) {
      const normalized = normalizeText(signal.title || '');
      if (!signalTitleMap.has(normalized)) {
        signalTitleMap.set(normalized, []);
      }
      signalTitleMap.get(normalized).push(signal);
    }

    const scoredSignals = rawSignals.map(signal => {
      const normalizedTitle = normalizeText(signal.title || '');
      const similarSignals = signalTitleMap.get(normalizedTitle) || [signal];
      const sourceCount = similarSignals.length;

      const scoring = calculateIdeaScore(signal, {
        competitorVideos: normalizedCompetitorVideos,
        userVideos: normalizedUserVideos,
        dnaTopics,
        signalTitle: signal.title,
        signalPublishedAt: signal.published_at || signal.created_at,
        signalTopicId: signal.topic_id,
        sourceCount,
      });

      const urgency = getUrgencyTier(scoring, signal);

      const ideaWithScoring = {
        ...signal,
        multi_signal_scoring: scoring,
      };
      const learnedAdjustedScore = applyLearnedAdjustmentsSimple(
        scoring.score,
        ideaWithScoring,
        learnedAdjustments
      );

      return {
        ...signal,
        score: learnedAdjustedScore,
        multi_signal_scoring: {
          ...scoring,
          base_score: scoring.score,
          learned_adjusted_score: learnedAdjustedScore,
        },
        urgency_tier: urgency,
        learned_adjustments_applied: learnedAdjustedScore !== scoring.score,
      };
    });

    // STEP 4: Filter
    console.log('\n🔍 STEP 4: Filtering results...');

    const validSignals = scoredSignals.filter(signal => {
      if (signal.is_protected) return true;
      return signal.multi_signal_scoring?.isValid && signal.urgency_tier !== null;
    });

    const tierOrder = { today: 0, week: 1, backlog: 2 };
    validSignals.sort((a, b) => {
      const tierA = a.urgency_tier?.tier || 'backlog';
      const tierB = b.urgency_tier?.tier || 'backlog';
      
      if (tierOrder[tierA] !== tierOrder[tierB]) {
        return tierOrder[tierA] - tierOrder[tierB];
      }
      return (b.score || 0) - (a.score || 0);
    });

    const byTier = {
      today: validSignals.filter(s => s.urgency_tier?.tier === 'today').length,
      week: validSignals.filter(s => s.urgency_tier?.tier === 'week').length,
      backlog: validSignals.filter(s => s.urgency_tier?.tier === 'backlog').length,
    };

    // STEP 5: Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n1. Raw ideas from RSS: ${rawSignals.length}`);
    console.log(`2. Passing filter: ${validSignals.length}`);
    console.log(`\n   Breakdown by tier:`);
    console.log(`   🔴 Post Today: ${byTier.today}`);
    console.log(`   🟡 This Week: ${byTier.week}`);
    console.log(`   🟢 Backlog: ${byTier.backlog}`);

    // Show top 3 ideas
    console.log('\n' + '='.repeat(60));
    console.log('🏆 TOP 3 IDEAS');
    console.log('='.repeat(60));

    const top3 = validSignals.slice(0, 3);

    if (top3.length === 0) {
      console.log('\n⚠️  No ideas passed the filter.');
      console.log('\nThis could mean:');
      console.log('  - No signals have 1+ positive signal OR score >= 30');
      console.log('  - No urgency tier could be assigned');
      console.log('  - Check your competitor videos, user videos, and DNA data');
    } else {
    top3.forEach((idea, index) => {
      const tier = idea.urgency_tier;
      const scoring = idea.multi_signal_scoring;
      const signals = scoring?.signals || [];

      console.log(`\n${index + 1}. ${idea.title || 'Untitled'}`);
      console.log(`   Source: ${idea.source || 'Unknown'}`);
      console.log(`   Score: ${idea.score}/100`);
      console.log(`   Tier: ${tier?.icon} ${tier?.label || 'Unknown'}`);
      console.log(`   Signals (${signals.length}):`);
      
      signals.forEach((signal, idx) => {
        const weight = signal.weight === 'negative' ? '⚠️  ' : '   ';
        console.log(`   ${weight}${signal.icon} ${signal.text}`);
      });

      // For Venezuela/oil ideas, show detailed breakdown
      if (idea.title && (idea.title.toLowerCase().includes('venezuela') || 
                         idea.title.toLowerCase().includes('oil') || 
                         idea.title.toLowerCase().includes('tanker'))) {
        const competitorBreakout = signals.find(s => s.type === 'competitor_breakout')?.data || null;
        const competitorCount = signals.find(s => s.type === 'competitor_volume')?.data?.count || 0;
        const dnaMatch = signals.find(s => s.type === 'dna_match')?.data?.topics || [];
        
        console.log(`\n   🔍 DETAILED BREAKDOWN (Venezuela/Oil):`);
        console.log(`   {`);
        console.log(`     competitorBreakout: ${competitorBreakout ? JSON.stringify(competitorBreakout, null, 8).split('\n').map(l => '     ' + l).join('\n') : 'null'}`);
        console.log(`     competitorCount: ${competitorCount}`);
        console.log(`     dnaMatch: ${JSON.stringify(dnaMatch)}`);
        console.log(`     score: ${idea.score}`);
        console.log(`     signals: ${JSON.stringify(signals.map(s => ({ type: s.type, icon: s.icon, text: s.text })), null, 8).split('\n').map(l => '     ' + l).join('\n')}`);
        console.log(`   }`);
      }

      if (idea.learned_adjustments_applied) {
        console.log(`   🧠 Learning adjustments applied`);
      }
    });
    }

    // Show filtered out signals
    const filteredOut = scoredSignals.length - validSignals.length;
    if (filteredOut > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`⚠️  FILTERED OUT: ${filteredOut} signals`);
      console.log('='.repeat(60));
      
      const invalidSignals = scoredSignals.filter(s => {
        if (s.is_protected) return false;
        return !s.multi_signal_scoring?.isValid || s.urgency_tier === null;
      }).slice(0, 5);

      invalidSignals.forEach((signal, index) => {
        console.log(`\n${index + 1}. ${signal.title?.substring(0, 50) || 'Untitled'}...`);
        console.log(`   Score: ${signal.score || 0}/100`);
        console.log(`   Valid: ${signal.multi_signal_scoring?.isValid ? 'Yes' : 'No'}`);
        console.log(`   Signals: ${signal.multi_signal_scoring?.signalCount || 0}`);
        console.log(`   Urgency: ${signal.urgency_tier ? signal.urgency_tier.label : 'None'}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  }
}

const showId = process.argv[2] || process.env.TEST_SHOW_ID || 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

if (!showId) {
  console.error('❌ Please provide a show_id:');
  console.error('   node scripts/test-ideas-standalone.mjs <show_id>');
  process.exit(1);
}

testIdeasFeature(showId);
