/**
 * TEST IDEAS FEATURE WITH REAL DATA
 * 
 * This script tests the Ideas feature with actual data from the database.
 * It simulates what the /api/signals endpoint does and shows:
 * 1. How many raw ideas came from RSS
 * 2. How many passed the filter
 * 3. The top 3 ideas with their scores and signals
 */

const { createClient } = require('@supabase/supabase-js');
const { calculateIdeaScore, getUrgencyTier } = require('../lib/scoring/multiSignalScoring');
const { getLearnedAdjustments, applyLearnedAdjustments } = require('../lib/learning/signalEffectiveness');

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    // ============================================
    // STEP 1: Get raw signals from database
    // ============================================
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
      console.log('   GET /api/rss-processor?show_id=' + showId);
      return;
    }

    // ============================================
    // STEP 2: Fetch context data
    // ============================================
    console.log('\n📊 STEP 2: Fetching context data...');

    // Competitor videos
    const { data: competitorVideos } = await supabase
      .from('competitor_videos')
      .select(`
        *,
        competitors (
          id,
          name,
          channel_name,
          youtube_channel_id
        )
      `)
      .eq('show_id', showId)
      .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('views', { ascending: false })
      .limit(200);

    const normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
      ...video,
      views: video.views || video.view_count || video.viewCount || 0,
      published_at: video.published_at || video.publishedAt || video.created_at,
      competitor_id: video.competitor_id || video.competitors?.id,
      competitors: video.competitors || {},
    }));

    console.log(`   📊 Competitor videos: ${normalizedCompetitorVideos.length}`);

    // User videos
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

    // DNA topics
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
          console.warn('   ⚠️  Failed to parse dnaTopics as JSON');
        }
      } else if (typeof showDna.topics === 'object') {
        dnaTopics = Object.values(showDna.topics).filter(Boolean);
      }
    }

    if (!Array.isArray(dnaTopics)) {
      dnaTopics = [];
    }

    console.log(`   🧬 DNA topics: ${dnaTopics.length}`);

    // Learned adjustments
    const learnedAdjustments = await getLearnedAdjustments(showId, 90);
    console.log(`   🧠 Learned adjustments: ${learnedAdjustments.feedbackCount} feedback entries`);

    // ============================================
    // STEP 3: Apply multi-signal scoring
    // ============================================
    console.log('\n🎯 STEP 3: Applying multi-signal scoring...');

    // Count similar signals for source count
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

      // Apply learned adjustments
      const ideaWithScoring = {
        ...signal,
        multi_signal_scoring: scoring,
      };
      const learnedAdjustedScore = applyLearnedAdjustments(
        scoring.score,
        ideaWithScoring,
        learnedAdjustments
      );

      return {
        ...signal,
        score: learnedAdjustedScore !== scoring.score ? learnedAdjustedScore : scoring.score,
        multi_signal_scoring: {
          ...scoring,
          base_score: scoring.score,
          learned_adjusted_score: learnedAdjustedScore,
        },
        urgency_tier: urgency,
        learned_adjustments_applied: learnedAdjustedScore !== scoring.score,
      };
    });

    // ============================================
    // STEP 4: Filter results
    // ============================================
    console.log('\n🔍 STEP 4: Filtering results...');

    const validSignals = scoredSignals.filter(signal => {
      if (signal.is_protected) return true;
      return signal.multi_signal_scoring?.isValid && signal.urgency_tier !== null;
    });

    // Sort by tier then score
    const tierOrder = { today: 0, week: 1, backlog: 2 };
    validSignals.sort((a, b) => {
      const tierA = a.urgency_tier?.tier || 'backlog';
      const tierB = b.urgency_tier?.tier || 'backlog';
      
      if (tierOrder[tierA] !== tierOrder[tierB]) {
        return tierOrder[tierA] - tierOrder[tierB];
      }
      return (b.score || 0) - (a.score || 0);
    });

    // Count by tier
    const byTier = {
      today: validSignals.filter(s => s.urgency_tier?.tier === 'today').length,
      week: validSignals.filter(s => s.urgency_tier?.tier === 'week').length,
      backlog: validSignals.filter(s => s.urgency_tier?.tier === 'backlog').length,
    };

    // ============================================
    // STEP 5: Display results
    // ============================================
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

      if (idea.learned_adjustments_applied) {
        console.log(`   🧠 Learning adjustments applied`);
      }
    });

    // Show signals that didn't pass filter
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

// Get show_id from command line or use default
const showId = process.argv[2] || process.env.TEST_SHOW_ID || 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

if (!showId) {
  console.error('❌ Please provide a show_id:');
  console.error('   node scripts/test-ideas-feature.js <show_id>');
  console.error('   or set TEST_SHOW_ID environment variable');
  process.exit(1);
}

testIdeasFeature(showId);
