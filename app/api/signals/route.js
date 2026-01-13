import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { calculateIdeaScore, getUrgencyTier } from '@/lib/scoring/multiSignalScoring';
import { getLearnedAdjustments, applyLearnedAdjustments } from '@/lib/learning/signalEffectiveness';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';
import { getChannelEntities } from '@/lib/entities/channelEntities';

// Service role client for operations that need to bypass RLS
// Validate environment variables before creating client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
}

const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key'
);

export async function GET(request) {
  try {
    // Validate Supabase configuration first
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Signals API: Supabase not configured');
      return NextResponse.json(
        { 
          error: 'Server configuration error: Supabase environment variables not set',
          details: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseServiceKey
          }
        }, 
        { status: 500 }
      );
    }

    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      console.error('❌ Signals API: Authentication failed:', authError?.message || 'No user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('show_id') || searchParams.get('showId');
    const limit = parseInt(searchParams.get('limit') || '50', 10); // Default to 50, allow override

    if (!showId) {
      return NextResponse.json({ error: 'show_id is required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log('📡 Fetching signals for show:', showId);

    // 1. Get all signals (use admin client for RLS bypass)
    // Note: We fetch all signals first, then apply multi-signal scoring filter
    // The is_visible column is updated at the end based on the filter results
    let signals, error;
    try {
      console.log('   Attempting to query Supabase signals table...');
      const result = await supabaseAdmin
        .from('signals')
        .select('*')
        .eq('show_id', showId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      signals = result.data;
      error = result.error;
    } catch (fetchError) {
      console.error('❌ Exception during signals query:', fetchError);
      console.error('   Error type:', fetchError?.constructor?.name);
      console.error('   Error message:', fetchError?.message);
      console.error('   Error stack:', fetchError?.stack);
      console.error('   Error cause:', fetchError?.cause);
      
      // Check if it's a network/fetch error
      if (fetchError?.message?.includes('fetch failed') || fetchError?.name === 'TypeError') {
        console.error('   🔍 This is a fetch/network error. Possible causes:');
        console.error('      - Missing NEXT_PUBLIC_SUPABASE_URL:', !supabaseUrl ? 'YES ❌' : 'NO ✅');
        console.error('      - Missing SUPABASE_SERVICE_ROLE_KEY:', !supabaseServiceKey ? 'YES ❌' : 'NO ✅');
        console.error('      - Network connectivity issue to Supabase');
        console.error('      - Supabase project is paused or inactive');
        console.error('      - Invalid Supabase URL format');
      }
      
      throw fetchError;
    }

    if (error) {
      console.error('❌ Supabase query error:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error details:', error.details);
      console.error('   Error hint:', error.hint);
      throw error;
    }

    const rawRssItems = signals?.length || 0;
    console.log(`📰 STEP 1 - Raw RSS items from DB: ${rawRssItems} signals for show ${showId}`);

    // If no signals at all, return early
    if (!signals || signals.length === 0) {
      console.log('⚠️ No signals found in database');
      return NextResponse.json({
        success: true,
        signals: [],
        stats: {
          total: 0,
          unique_stories: 0,
          after_status_processing: 0,
          after_rejection_filter: 0,
          after_scoring: 0,
          after_validity_filter: 0,
          visible: 0,
          hidden: 0,
          rejected_count: 0,
          by_tier: { post_today: 0, this_week: 0, backlog: 0 },
          limit_applied: limit,
          per_tier_limit: { post_today: 5, this_week: 7, backlog: 15 }
        },
        learning_applied: false,
        multi_signal_scoring: true,
        message: 'No signals found. Try refreshing signals or check if RSS feeds are configured.'
      });
    }

    // ============================================
    // STEP 1: Get liked signals - these should NEVER be hidden
    // ============================================
    const { data: likedFeedback } = await supabaseAdmin
      .from('recommendation_feedback')
      .select('topic')
      .eq('show_id', showId)
      .eq('action', 'liked');

    const likedTitles = new Set(
      (likedFeedback || []).map(f => f.topic?.toLowerCase().trim()).filter(Boolean)
    );

    console.log(`💚 Found ${likedTitles.size} liked signals (protected)`);

    // Helper: Check if signal was liked
    function wasSignalLiked(signalTitle) {
      const title = signalTitle?.toLowerCase().trim() || '';
      if (!title) return false;
      
      // Exact match
      if (likedTitles.has(title)) return true;
      
      // Partial match (for truncated titles)
      for (const liked of likedTitles) {
        if (liked && title && (
          title.includes(liked.substring(0, 40)) || 
          liked.includes(title.substring(0, 40))
        )) {
          return true;
        }
      }
      
      return false;
    }

    // 2. Get rejected signal titles from feedback
    const { data: feedbacks } = await supabaseAdmin
      .from('recommendation_feedback')
      .select('topic, action, created_at')
      .eq('show_id', showId);

    const rejectedTitles = (feedbacks || [])
      .filter(f => f.action === 'rejected')
      .map(f => normalizeText(f.topic));

    console.log(`🚫 Rejected: ${rejectedTitles.length}`);

    // 3. Mark signals based on their status field (primary source of truth)
    let processedSignals = (signals || []).map(signal => {
      // Check signal status field first (this is updated by feedback API)
      // IMPORTANT: Preserve the original status from database
      const signalStatus = (signal.status || 'new').toLowerCase().trim();
      
      // Always preserve the status field - don't override it
      const result = { ...signal };
      
      // If signal has a status, use it
      if (signalStatus !== 'new' && signalStatus !== 'reviewed' && signalStatus !== 'approved') {
        // Signal has been acted upon (liked, rejected, saved, produced)
        if (signalStatus === 'liked') {
          console.log(`💚 LIKED (from status): ${signal.title?.substring(0, 50) || 'No title'}...`);
          result.status = 'liked';
          result.score = Math.max(100, signal.score || 50); // Boost to 100
          result.is_protected = true;
          result.protection_reason = 'user_liked';
        } else if (signalStatus === 'rejected') {
          // Will be filtered out later unless protected
          result.status = 'rejected';
        } else if (signalStatus === 'saved') {
          result.status = 'saved';
          console.log(`💾 SAVED (from status): ${signal.title?.substring(0, 50) || 'No title'}...`);
        } else if (signalStatus === 'produced') {
          result.status = 'produced';
        }
      }
      
      // Fallback: Check if signal was liked via feedback table (for backwards compatibility)
      if (!result.status || result.status === 'new') {
        if (wasSignalLiked(signal.title)) {
          console.log(`💚 PROTECTED (liked via feedback): ${signal.title?.substring(0, 50) || 'No title'}...`);
          result.status = 'liked'; // Update status field
          result.score = Math.max(100, signal.score || 50); // Boost to 100
          result.is_protected = true;
          result.protection_reason = 'user_liked';
        }
      }
      
      // Ensure status is always set (default to 'new' if not set)
      if (!result.status) {
        result.status = 'new';
      }
      
      return result;
    });

    // 4. Filter out rejected signals (but keep protected/liked signals)
    const afterStatusProcessing = processedSignals.length;
    console.log(`📊 STEP 2 - After status processing (liked/rejected): ${afterStatusProcessing} signals`);
    
    const visibleSignals = processedSignals.filter(signal => {
      // Always include protected signals
      if (signal.is_protected) {
        return true;
      }
      
      // Check signal status field first (primary source of truth)
      const signalStatus = signal.status?.toLowerCase().trim() || 'new';
      if (signalStatus === 'rejected') {
        console.log(`🚫 Hiding rejected (from status): "${signal.title.substring(0, 40)}..."`);
        return false;
      }
      
      const normalizedTitle = normalizeText(signal.title);
      
      // Check if rejected (fallback for backwards compatibility with feedback table)
      const isRejected = rejectedTitles.some(rejected => 
        isSimilar(normalizedTitle, rejected)
      );
      if (isRejected) {
        console.log(`🚫 Hiding rejected (from feedback): "${signal.title.substring(0, 40)}..."`);
        return false;
      }

      return true;
    });

    const afterRejectionFilter = visibleSignals.length;
    console.log(`📊 STEP 3 - After rejection filter: ${afterRejectionFilter} signals (${processedSignals.length - afterRejectionFilter} rejected)`);
    console.log(`📋 Visible: ${visibleSignals.length} / ${signals?.length || 0}`);
    
    // Debug: Log status distribution
    const statusCounts = {};
    visibleSignals.forEach(s => {
      const status = s.status || 'new';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📊 Signal status distribution:', statusCounts);

    // ============================================
    // STEP 2: Extract positive patterns from liked signals
    // ============================================
    function extractPositivePatterns(likedTitles) {
      const patterns = {
        keywords: new Set(),
        formats: new Set(),
        entities: new Set()
      };
      
      for (const title of likedTitles) {
        if (!title) continue;
        const lower = title.toLowerCase();
        
        // Extract keywords
        if (lower.match(/trade war|tariff/)) patterns.keywords.add('trade_war');
        if (lower.match(/economy|economic/)) patterns.keywords.add('economy');
        if (lower.match(/immigration|immigrant/)) patterns.keywords.add('immigration');
        if (lower.match(/war|military|weapon/)) patterns.keywords.add('military');
        if (lower.match(/tesla|ev|electric vehicle/)) patterns.keywords.add('ev_cars');
        // Fix: Use word boundaries to avoid matching "Ukrainian" as "ai"
        // Match "ai" or "artificial intelligence" as whole words, not substrings
        if (lower.match(/\bai\b|artificial intelligence/)) patterns.keywords.add('ai');
        if (lower.match(/crypto|bitcoin/)) patterns.keywords.add('crypto');
        
        // Extract formats (story patterns)
        if (lower.match(/how .+ (tackled|survived|won|beat|did)/)) patterns.formats.add('story_how');
        if (lower.match(/why .+ (failed|crashed|won|succeeded)/)) patterns.formats.add('story_why');
        if (lower.match(/what .+ (looks like|means|could)/)) patterns.formats.add('analysis');
        if (lower.match(/\d+\s*(million|billion|trillion|%)/)) patterns.formats.add('has_numbers');
        
        // Extract entities
        if (lower.match(/trump/)) patterns.entities.add('trump');
        if (lower.match(/china|chinese|beijing/)) patterns.entities.add('china');
        if (lower.match(/tesla|musk|elon/)) patterns.entities.add('tesla_musk');
        if (lower.match(/america|us |u\.s\.|united states/)) patterns.entities.add('usa');
      }
      
      return {
        keywords: [...patterns.keywords],
        formats: [...patterns.formats],
        entities: [...patterns.entities]
      };
    }

    // Calculate boost from positive patterns
    function getPositiveBoost(signalTitle, positivePatterns) {
      let boost = 1.0;
      const lower = signalTitle?.toLowerCase() || '';
      
      // Keyword match: +20% per match
      for (const keyword of positivePatterns.keywords || []) {
        const keywordPatterns = {
          'trade_war': /trade war|tariff/,
          'economy': /economy|economic/,
          'immigration': /immigration|immigrant/,
          'military': /war|military|weapon/,
          'ev_cars': /tesla|ev|electric vehicle|byd/,
          'ai': /\bai\b|artificial intelligence/,
          'crypto': /crypto|bitcoin/
        };
        if (keywordPatterns[keyword]?.test(lower)) {
          boost *= 1.2;
          console.log(`  📈 +20% boost for keyword: ${keyword}`);
        }
      }
      
      // Format match: +30% for story formats
      for (const format of positivePatterns.formats || []) {
        const formatPatterns = {
          'story_how': /how .+ (tackled|survived|won|beat|did)/,
          'story_why': /why .+ (failed|crashed|won|succeeded)/,
          'analysis': /what .+ (looks like|means|could)/,
          'has_numbers': /\d+\s*(million|billion|trillion|%)/
        };
        if (formatPatterns[format]?.test(lower)) {
          boost *= 1.3;
          console.log(`  📈 +30% boost for format: ${format}`);
        }
      }
      
      // Entity match: +15% per match
      for (const entity of positivePatterns.entities || []) {
        const entityPatterns = {
          'trump': /trump/,
          'china': /china|chinese|beijing/,
          'tesla_musk': /tesla|musk|elon/,
          'usa': /america|us |u\.s\.|united states/
        };
        if (entityPatterns[entity]?.test(lower)) {
          boost *= 1.15;
          console.log(`  📈 +15% boost for entity: ${entity}`);
        }
      }
      
      return Math.min(boost, 3.0); // Cap at 3x boost
    }

    // ============================================
    // STEP 3: Detect content angles for better scoring
    // ============================================
    function detectAngle(title) {
      const lower = title?.toLowerCase() || '';
      
      const anglePatterns = [
        // High-value angles (1.5x - 2x boost)
        { type: 'personal_story', pattern: /(shrimper|carmaker|lawyer|farmer|driver|worker).*(how|story|journey)/i, boost: 2.0 },
        { type: 'shocking_reveal', pattern: /(secret|revealed|truth|real reason|exposed|shocking)/i, boost: 1.8 },
        { type: 'big_numbers', pattern: /\d+\s*(million|billion|trillion)/i, boost: 1.5 },
        { type: 'percentage_change', pattern: /\d+\s*%/i, boost: 1.4 },
        
        // Good angles (1.2x - 1.4x boost)
        { type: 'direct_question', pattern: /^(why|how|what if|will|can|could)/i, boost: 1.4 },
        { type: 'contrast', pattern: /(but|however|despite|yet|although).*(still|actually|surprisingly)/i, boost: 1.3 },
        { type: 'prediction', pattern: /(will|could|might|expect|predict|forecast).*202[5-9]/i, boost: 1.2 },
        { type: 'comparison', pattern: /(vs|versus|compared|better than|worse than|beats)/i, boost: 1.2 },
        
        // Neutral/weak angles (0.5x - 0.8x)
        { type: 'vague_announcement', pattern: /^.*(announces|promises|plans to|says|hails)$/i, boost: 0.7 },
        { type: 'generic_update', pattern: /(update|latest|new|recent)$/i, boost: 0.8 }
      ];
      
      for (const { type, pattern, boost } of anglePatterns) {
        if (pattern.test(lower)) {
          return { type, boost, detected: true };
        }
      }
      
      return { type: 'neutral', boost: 1.0, detected: false };
    }

    // Extract patterns from liked titles
    const likedTitlesArray = [...likedTitles];
    const positivePatterns = extractPositivePatterns(likedTitlesArray);
    console.log('📊 Positive patterns:', positivePatterns);

    // 4. Get learning weights
    const { data: weights } = await supabaseAdmin
      .from('show_learning_weights')
      .select('topic_weights, format_weights, rejection_patterns')
      .eq('show_id', showId)
      .single();

    // 4.5. Get DNA data (keywords + topics) for pre-scoring and matching
    const { data: showDna } = await supabaseAdmin
      .from('show_dna')
      .select('scoring_keywords, topics')
      .eq('show_id', showId)
      .single();
    
    // ✨ NEW: Load channel entities once at start (cached)
    const channelEntities = await getChannelEntities(showId);
    console.log(`📊 Loaded ${channelEntities.entities.length} entities from DNA for scoring`);
    
    // ✨ NEW: Load excluded names (channel/source names that shouldn't count as matches)
    const { getExcludedNames } = await import('@/lib/entities/channelEntities');
    const excludedNames = await getExcludedNames(showId);
    console.log(`🚫 Loaded ${excludedNames.length} excluded names (channel/source names)`);

    // Also try to fetch topic_definitions if they exist (for better DNA matching)
    let topicDefinitions = [];
    try {
      const { data: topicDefs, error: topicDefError } = await supabaseAdmin
        .from('topic_definitions')
        .select('*')
        .eq('show_id', showId);
      
      if (topicDefError) {
        console.log('ℹ️  topic_definitions table not available or error:', topicDefError.message);
      } else if (topicDefs && Array.isArray(topicDefs)) {
        topicDefinitions = topicDefs;
        console.log(`📚 Found ${topicDefinitions.length} topic definitions`);
      }
    } catch (e) {
      // topic_definitions table might not exist, that's okay
      console.log('ℹ️  topic_definitions table not available (optional)');
    }
    
    const dnaKeywords = [];
    if (showDna?.scoring_keywords) {
      const keywords = showDna.scoring_keywords;
      if (keywords.high_engagement) dnaKeywords.push(...keywords.high_engagement);
      if (keywords.medium_engagement) dnaKeywords.push(...keywords.medium_engagement);
    }
    
    // Ensure dnaTopics is always an array
    let dnaTopics = [];
    if (showDna?.topics) {
      if (Array.isArray(showDna.topics)) {
        // Validate array structure - check if topics have proper structure
        dnaTopics = showDna.topics.filter(topic => {
          if (!topic || typeof topic !== 'object') return false;
          // Check if topic has at least topic_id OR valid keywords OR name
          const hasTopicId = !!(topic.topic_id || topic.topicId || topic.id);
          // Keywords should not just be "what if" or "ماذا لو" (these are generic/question keywords, not topic-specific)
          const hasValidKeywords = Array.isArray(topic.keywords) && topic.keywords.length > 0 &&
                                   !topic.keywords.every(kw => ['what if', 'ماذا لو'].includes(String(kw).toLowerCase()));
          const hasName = !!(topic.name || topic.topic_name) && 
                          topic.name !== 'no name' && topic.topic_name !== 'no name';
          return hasTopicId || hasValidKeywords || hasName;
        });
        
        // If all topics are invalid, log critical warning
        if (dnaTopics.length === 0 && showDna.topics.length > 0) {
          console.error('❌ CRITICAL: All DNA topics are invalid/malformed.');
          console.error('   Sample invalid topic:', showDna.topics[0]);
          console.error('   Action required: Run fix_almokhbir_dna_topics.sql to fix the show_dna.topics column');
        } else if (dnaTopics.length < showDna.topics.length) {
          console.warn(`⚠️  Filtered out ${showDna.topics.length - dnaTopics.length} invalid DNA topics (missing topic_id/keywords/name or only generic keywords)`);
        }
      } else if (typeof showDna.topics === 'string') {
        try {
          const parsed = JSON.parse(showDna.topics);
          if (Array.isArray(parsed)) {
            dnaTopics = parsed.filter(topic => {
              if (!topic || typeof topic !== 'object') return false;
              const hasTopicId = !!(topic.topic_id || topic.topicId || topic.id);
              const hasValidKeywords = Array.isArray(topic.keywords) && topic.keywords.length > 0 &&
                                       !topic.keywords.every(kw => ['what if', 'ماذا لو'].includes(String(kw).toLowerCase()));
              const hasName = !!(topic.name || topic.topic_name) && 
                              topic.name !== 'no name' && topic.topic_name !== 'no name';
              return hasTopicId || hasValidKeywords || hasName;
            });
          } else if (typeof parsed === 'object' && parsed !== null) {
            // If it's an object, try to convert to array
            dnaTopics = Object.values(parsed).filter(Boolean);
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse dnaTopics as JSON:', e);
          console.warn('   Raw topics string:', showDna.topics.substring(0, 200));
          dnaTopics = [];
        }
      } else if (typeof showDna.topics === 'object' && showDna.topics !== null) {
        // If it's an object, try to convert to array
        dnaTopics = Object.values(showDna.topics).filter(Boolean);
      }
    }
    
    // Ensure it's still an array after processing
    if (!Array.isArray(dnaTopics)) {
      console.warn('⚠️ dnaTopics is not an array, defaulting to empty array. Type:', typeof dnaTopics);
      console.warn('   showDna.topics raw value:', showDna?.topics);
      dnaTopics = [];
    }
    
    // Additional validation: Check if topics have required fields
    const validTopics = dnaTopics.filter(topic => {
      const hasTopicId = !!(topic?.topic_id || topic?.topicId || topic?.id);
      const hasKeywords = Array.isArray(topic?.keywords) && topic.keywords.length > 0;
      return hasTopicId || hasKeywords; // At least one of these should exist
    });
    
    if (validTopics.length < dnaTopics.length) {
      console.warn(`⚠️ Found ${dnaTopics.length - validTopics.length} invalid DNA topics (missing topic_id and keywords)`);
      dnaTopics = validTopics;
    }

    // DEBUG: Log DNA topics structure for debugging
    console.log(`📊 DNA Topics loaded: ${dnaTopics.length} topics`);
    if (dnaTopics.length > 0) {
      console.log('Sample DNA topic structure:', {
        first_topic: dnaTopics[0],
        has_topic_id: !!dnaTopics[0]?.topic_id,
        topic_id_value: dnaTopics[0]?.topic_id || dnaTopics[0]?.topicId || dnaTopics[0]?.id || 'undefined',
        has_keywords: Array.isArray(dnaTopics[0]?.keywords),
        keywords_count: dnaTopics[0]?.keywords?.length || 0,
        keywords_sample: Array.isArray(dnaTopics[0]?.keywords) ? dnaTopics[0].keywords.slice(0, 5) : dnaTopics[0]?.keywords,
        has_name: !!dnaTopics[0]?.name,
        name_value: dnaTopics[0]?.name || 'undefined',
        all_keys: Object.keys(dnaTopics[0] || {})
      });
    } else {
      console.warn('⚠️ No DNA topics found. Checking show_dna.topics structure:');
      console.warn('   showDna.topics type:', typeof showDna?.topics);
      console.warn('   showDna.topics value:', showDna?.topics);
      console.warn('   showDna structure:', {
        show_id: showDna?.show_id,
        has_scoring_keywords: !!showDna?.scoring_keywords,
        topics_type: typeof showDna?.topics,
        topics_value: showDna?.topics
      });
    }

    // Also try to get keywords from scoring_keywords if topics don't have keywords
    const scoringKeywords = showDna?.scoring_keywords || {};
    const allKeywords = [
      ...(scoringKeywords.high_engagement || []),
      ...(scoringKeywords.medium_engagement || [])
    ];

    console.log('🔑 Scoring keywords available:', allKeywords.length);

    // Enhance DNA topics with topic_definitions if available
    if (topicDefinitions.length > 0 && dnaTopics.length > 0) {
      // Merge topic_definitions with dnaTopics to add keywords
      const enhancedDnaTopics = dnaTopics.map(dnaTopic => {
        const topicId = dnaTopic.topic_id || dnaTopic.topicId || dnaTopic.id;
        if (!topicId) return dnaTopic;
        
        // Find matching topic definition
        const topicDef = topicDefinitions.find(td => 
          td.topic_id === topicId || td.id === topicId || td.topic === topicId
        );
        
        if (topicDef) {
          return {
            ...dnaTopic,
            topic_id: topicId,
            keywords: topicDef.keywords || dnaTopic.keywords || [],
            name: topicDef.name || topicDef.topic_name || dnaTopic.name
          };
        }
        
        return dnaTopic;
      });
      
      dnaTopics = enhancedDnaTopics;
      console.log(`✅ Enhanced ${dnaTopics.length} DNA topics with topic definitions`);
    }

    // If DNA topics don't have keywords, try to use scoring_keywords as fallback
    if (dnaTopics.length > 0 && allKeywords.length > 0) {
      const topicsWithoutKeywords = dnaTopics.filter(t => {
        const hasValidStructure = !!(t?.topic_id || t?.topicId || t?.id || t?.name || t?.topic_name);
        const hasNoValidKeywords = !t.keywords || 
                                  (Array.isArray(t.keywords) && t.keywords.length === 0) ||
                                  (Array.isArray(t.keywords) && t.keywords.every(kw => ['what if', 'ماذا لو'].includes(String(kw).toLowerCase())));
        return hasValidStructure && hasNoValidKeywords;
      });
      
      if (topicsWithoutKeywords.length > 0) {
        console.log(`⚠️  ${topicsWithoutKeywords.length} DNA topics missing valid keywords (or only generic "what if"/"ماذا لو" keywords), using scoring_keywords as fallback`);
        // Add scoring keywords to topics that don't have keywords but have valid structure
        dnaTopics = dnaTopics.map(topic => {
          const hasValidStructure = !!(topic?.topic_id || topic?.topicId || topic?.id || topic?.name || topic?.topic_name);
          const hasNoValidKeywords = !topic.keywords || 
                                    (Array.isArray(topic.keywords) && topic.keywords.length === 0) ||
                                    (Array.isArray(topic.keywords) && topic.keywords.every(kw => ['what if', 'ماذا لو'].includes(String(kw).toLowerCase())));
          
          if (hasValidStructure && hasNoValidKeywords) {
            return {
              ...topic,
              keywords: allKeywords.slice(0, 10) // Use top 10 scoring keywords as fallback
            };
          }
          return topic;
        });
      } else if (dnaTopics.length > 0 && dnaTopics.every(t => !(t?.topic_id || t?.topicId || t?.id))) {
        // All topics are missing topic_id - this is a critical issue
        console.error('❌ CRITICAL: All DNA topics are missing topic_id. Topics are malformed.');
        console.error('   Sample topic:', dnaTopics[0]);
        console.error('   Action required: Run fix_almokhbir_dna_topics.sql to fix the show_dna.topics column');
      }
    } else if (dnaTopics.length === 0 && showDna?.topics) {
      // Topics column exists but couldn't parse any valid topics
      console.error('❌ CRITICAL: show_dna.topics exists but contains no valid topics.');
      console.error('   topics type:', typeof showDna.topics);
      console.error('   topics value:', typeof showDna.topics === 'string' ? showDna.topics.substring(0, 500) : JSON.stringify(showDna.topics).substring(0, 500));
      console.error('   Action required: Run fix_almokhbir_dna_topics.sql to fix the show_dna.topics column');
    }
    
    // Helper function to calculate DNA pre-score for non-enriched signals
    function calculateDNAPreScore(signal, dnaKeywords) {
      const title = (signal.title || '').toLowerCase();
      let score = 40; // Base score
      
      // Boost for DNA keyword matches
      for (const keyword of dnaKeywords) {
        if (title.includes(keyword.toLowerCase())) {
          score += 15;
        }
      }
      
      // Boost for story angles
      if (/why|how|secret|truth|لماذا|كيف|سر|حقيقة/.test(title)) score += 10;
      if (/\$\d+|\d+%|billion|million|مليار|مليون/.test(title)) score += 10;
      if (/war|crisis|collapse|حرب|أزمة|انهيار/.test(title)) score += 10;
      
      // Boost for Arabic signals (trusted sources)
      if (/[\u0600-\u06FF]/.test(signal.title || '')) {
        score += 10; // Arabic signal boost
      }
      
      // Cap at 85 (reserve 86-100 for AI-enriched signals)
      return Math.min(score, 85);
    }

    // 5. Apply learning weights and positive patterns to each signal
    const learnedSignals = visibleSignals.map(signal => {
      // Skip if already protected (liked signals)
      if (signal.is_protected) {
        return signal;
      }
      
      // For non-enriched signals, use DNA pre-score instead of default score
      let baseScore = signal.score || 50;
      const isEnriched = !!(signal.audience_insight);
      
      if (!isEnriched) {
        // Calculate DNA pre-score for non-enriched signals
        baseScore = calculateDNAPreScore(signal, dnaKeywords);
      }
      
      let adjustedScore = baseScore;
      const title = signal.title || '';
      const adjustments = [];

      // Apply positive boost from liked patterns FIRST
      const positiveBoost = getPositiveBoost(title, positivePatterns);
      if (positiveBoost > 1.0) {
        console.log(`💚 Boosting "${title.substring(0, 40)}..." by ${positiveBoost.toFixed(2)}x`);
        adjustedScore *= positiveBoost;
        adjustments.push(`positive_pattern: ${positiveBoost.toFixed(2)}x`);
      }

      // Apply angle detection boost
      const angle = detectAngle(title);
      if (angle.detected && angle.boost !== 1.0) {
        console.log(`🎯 Angle detected: ${angle.type} (${angle.boost}x) - "${title.substring(0, 40)}..."`);
        adjustedScore *= angle.boost;
        adjustments.push(`angle: ${angle.boost.toFixed(2)}x`);
      }

      if (weights?.topic_weights) {
        // Apply topic boosts/penalties
        const topics = Object.keys(weights.topic_weights);
        for (const topic of topics) {
          if (title.includes(topic)) {
            const weight = weights.topic_weights[topic];
            adjustedScore *= weight;
            adjustments.push(`${topic}: ${weight.toFixed(2)}x`);
          }
        }
      }

      if (weights?.format_weights) {
        // Check if has specific angle
        const hasAngle = title.length > 40 || 
                        title.includes('؟') ||
                        /كيف|لماذا|ماذا|بين|مستقبل|أزمة|تأثير|يعلن|يكشف/.test(title);
        
        if (hasAngle && weights.format_weights.specific_angle) {
          adjustedScore *= weights.format_weights.specific_angle;
          adjustments.push(`angle: ${weights.format_weights.specific_angle.toFixed(2)}x`);
        } else if (!hasAngle && title.length < 30 && weights.format_weights.broad_topic) {
          adjustedScore *= weights.format_weights.broad_topic;
          adjustments.push(`broad: ${weights.format_weights.broad_topic.toFixed(2)}x`);
        }
      }

      // Apply rejection pattern penalty
      if (weights?.rejection_patterns?.angle_too_broad >= 2) {
        const isBroad = title.length < 30 && !title.includes('؟');
        if (isBroad) {
          adjustedScore *= 0.5;
          adjustments.push('rejection_penalty: 0.5x');
        }
      }

      const finalScore = Math.max(1, Math.min(100, Math.round(adjustedScore)));

      if (adjustments.length > 0) {
        console.log(`📈 "${title.substring(0, 35)}..." : ${signal.score} → ${finalScore} (${adjustments.join(', ')})`);
      }

      return {
        ...signal,
        // IMPORTANT: Preserve status field - don't let learning adjustments overwrite it
        status: signal.status || 'new',
        original_score: signal.score,
        score: finalScore,
        relevance_score: finalScore, // Also set relevance_score for consistency
        is_enriched: isEnriched, // Flag to indicate if signal was AI-enriched
        learning_applied: adjustments.length > 0,
        adjustments,
        positive_boost: positiveBoost || 1.0,
        angle_type: angle.type,
        angle_boost: angle.boost
      };
    });

    // ============================================
    // STEP 6: Apply Multi-Signal Scoring System
    // ============================================
    console.log('🎯 Applying multi-signal scoring system...');

    // Fetch competitor videos for breakout detection
    // Note: competitor_videos doesn't have show_id directly, need to join through competitors
    // First get competitor IDs for this show
    const { data: showCompetitors } = await supabaseAdmin
      .from('competitors')
      .select('id')
      .eq('show_id', showId);
    
    const competitorIds = showCompetitors?.map(c => c.id) || [];
    
    const { data: competitorVideos, error: competitorError } = await supabaseAdmin
      .from('competitor_videos')
      .select(`
        *,
        description,
        competitors!inner (
          id,
          name,
          youtube_channel_id,
          show_id,
          type
        )
      `)
      .in('competitor_id', competitorIds)
      .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('views', { ascending: false })
      .limit(200);

    if (competitorError) {
      console.warn('⚠️ Error fetching competitor videos (non-fatal):', competitorError.message);
    }

    console.log(`📊 Competitor videos fetched: ${competitorVideos?.length || 0} videos in last 7 days`);
    console.log(`📊 Competitor IDs for this show: ${competitorIds.length} competitors`);

    // Normalize competitor videos data structure
    // NOTE: competitor_videos uses 'published_at', channel_videos uses 'publish_date'
    // IMPORTANT: competitor_videos uses 'youtube_video_id' (not 'video_id')
    const normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
      ...video,
      // Ensure views field exists (try multiple possible field names)
      views: video.views || video.view_count || video.viewCount || 0,
      // Normalize date field: competitor_videos uses published_at, but add fallback for consistency
      published_at: video.published_at || video.publish_date || video.publishedAt || video.created_at,
      // Also keep publish_date for reference if it exists
      publish_date: video.publish_date || video.published_at,
      // Ensure title exists
      title: video.title || '',
      // Ensure description exists
      description: video.description || '',
      // Ensure competitor_id exists
      competitor_id: video.competitor_id || video.competitors?.id,
      // IMPORTANT: competitor_videos uses 'youtube_video_id' column
      // Map it to 'video_id' for consistency with other code
      video_id: video.youtube_video_id || video.video_id || video.id,
      // Also keep youtube_video_id for reference
      youtube_video_id: video.youtube_video_id || video.video_id || video.id,
      // Flatten competitor data for easier access
      competitors: video.competitors || {},
    }));

    console.log(`📊 Found ${normalizedCompetitorVideos.length} recent competitor videos`);

    // Fetch user's recent videos for saturation check
    // Try channel_videos first (primary table for synced videos)
    console.log(`📹 Fetching user videos for show_id: ${showId}`);
    let userVideos = [];
    let userVideosError = null;
    
    // First, try channel_videos table
    // DIAGNOSTIC: Query raw data first to check actual column values
    // NOTE: channel_videos uses 'publish_date' not 'published_at'
    console.log(`📹 DIAGNOSTIC: Checking channel_videos table structure for show_id: ${showId}`);
    const { data: channelVideosRaw, error: rawError } = await supabaseAdmin
      .from('channel_videos')
      .select('*')
      .eq('show_id', showId)
      .order('publish_date', { ascending: false })
      .limit(5);
    
    // CRITICAL: Also check what YouTube API actually returns vs what's in database
    // This will help identify if the issue is in sync job or database
    console.log(`📹 DIAGNOSTIC: Checking if we can get real titles from YouTube URLs...`);
    if (channelVideosRaw && channelVideosRaw.length > 0 && channelVideosRaw[0].youtube_url) {
      const sampleVideoId = channelVideosRaw[0].youtube_url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1] || 
                            channelVideosRaw[0].video_id;
      console.log(`   Sample video ID: ${sampleVideoId}`);
      console.log(`   If title is "شعار", we can verify by checking YouTube directly: ${channelVideosRaw[0].youtube_url}`);
    }

    if (!rawError && channelVideosRaw && channelVideosRaw.length > 0) {
      console.log(`📹 DIAGNOSTIC: Sample raw channel_videos data (first 3 videos):`);
      channelVideosRaw.slice(0, 3).forEach((video, i) => {
        console.log(`\n   📹 Video ${i + 1}/${channelVideosRaw.length}:`);
        console.log(`     - All keys: ${Object.keys(video).join(', ')}`);
        console.log(`     - id: ${video.id}`);
        console.log(`     - video_id: ${video.video_id || 'N/A'}`);
        console.log(`     - title: "${video.title || 'NULL'}"`);
        console.log(`     - title_ar: "${video.title_ar || 'N/A'}"`);
        console.log(`     - thumbnail_title: "${video.thumbnail_title || 'N/A'}"`);
        console.log(`     - thumbnail_elements: ${Array.isArray(video.thumbnail_elements) ? JSON.stringify(video.thumbnail_elements) : 'N/A'}`);
        console.log(`     - description: "${(video.description || '').substring(0, 50)}..."`);
        console.log(`     - published_at: ${video.published_at || video.publish_date || 'N/A'}`);
        console.log(`     - youtube_url: ${video.youtube_url || 'N/A'}`);
        
        // CRITICAL CHECK: Is title actually "شعار" in the database?
        if (video.title === 'شعار' || video.title === 'logo') {
          console.error(`     ⚠️ CRITICAL: Video ${i + 1} has title="${video.title}" - This is WRONG!`);
          console.error(`     🔍 Checking if thumbnail_title has real title: "${video.thumbnail_title || 'N/A'}"`);
          console.error(`     🔍 Checking if thumbnail_elements contains "شعار": ${Array.isArray(video.thumbnail_elements) && video.thumbnail_elements.includes('شعار')}`);
          console.error(`     🔍 YouTube URL for verification: ${video.youtube_url || 'N/A'}`);
          
          // If thumbnail_title has a real title, title field might have been overwritten
          if (video.thumbnail_title && video.thumbnail_title !== 'شعار' && video.thumbnail_title.length > 5) {
            console.error(`     💡 HYPOTHESIS: thumbnail_title="${video.thumbnail_title}" has real title, but title="${video.title}" is wrong.`);
            console.error(`     💡 POSSIBLE CAUSE: Title field was overwritten with thumbnail element "شعار" instead of thumbnail_title.`);
          }
        }
      });
      
      // Check how many videos have "شعار" as title
      const logoCount = channelVideosRaw.filter(v => v.title === 'شعار' || v.title === 'logo' || !v.title || v.title.trim() === '').length;
      if (logoCount > 0) {
        console.error(`\n⚠️ SUMMARY: ${logoCount}/${channelVideosRaw.length} videos have wrong titles in database.`);
        console.error(`   This is a DATA ISSUE - titles are actually "شعار" in the database.`);
        console.error(`   SOLUTION: Re-sync videos from YouTube using /api/sync-new-videos endpoint.`);
      }
    } else if (rawError) {
      console.error(`❌ DIAGNOSTIC: Error querying raw channel_videos:`, rawError);
    } else {
      console.error(`❌ DIAGNOSTIC: No raw channel_videos found for show_id: ${showId}`);
    }

    // Now do the actual query
    // NOTE: channel_videos table uses 'publish_date' not 'published_at'
    const { data: channelVideos, error: channelVideosError } = await supabaseAdmin
      .from('channel_videos')
      .select('id, video_id, title, description, publish_date, topic_id, youtube_url')
      .eq('show_id', showId)
      .order('publish_date', { ascending: false })
      .limit(100);

    if (channelVideosError) {
      console.error('❌ Error fetching from channel_videos:', channelVideosError);
    }

    console.log(`📹 channel_videos query result: ${channelVideos?.length || 0} videos`);
    
    // DIAGNOSTIC: Check if titles are all "شعار" (log issue)
    if (channelVideos && channelVideos.length > 0) {
      const titlesWithLogo = channelVideos.filter(v => v.title === 'شعار' || v.title === 'logo' || !v.title || v.title.trim() === '').length;
      if (titlesWithLogo > 0) {
        console.error(`⚠️ WARNING: ${titlesWithLogo}/${channelVideos.length} videos have empty/wrong title ("شعار" or empty)`);
        console.error(`   This indicates a data issue. Expected real titles like "كيف تخطط فنزويلا..."`);
        console.error(`   Sample problematic titles:`, channelVideos.slice(0, 5).map(v => `"${v.title}"`).join(', '));
      }
    }
    
    if (channelVideos && channelVideos.length > 0) {
      userVideos = channelVideos;
      userVideosError = null;
    } else {
      // Fallback: Try videos table (for imported videos)
      console.log(`⚠️ No videos found in channel_videos, trying videos table...`);
      const { data: videosTable, error: videosTableError } = await supabaseAdmin
        .from('videos')
        .select('id, title, published_at, topic_id')
        .eq('show_id', showId)
        .order('published_at', { ascending: false })
        .limit(100);

      if (videosTableError) {
        console.error('❌ Error fetching from videos table:', videosTableError);
        userVideosError = videosTableError;
      } else {
        console.log(`📹 videos table query result: ${videosTable?.length || 0} videos`);
        if (videosTable && videosTable.length > 0) {
          // VALIDATION: Skip fallback if too many placeholder titles
          const placeholderCount = videosTable.filter(v => 
            v.title === 'شعار' || 
            v.title === 'logo' || 
            !v.title || 
            v.title.trim() === '' || 
            v.title.length < 3
          ).length;
          
          const placeholderRatio = placeholderCount / videosTable.length;
          
          if (placeholderRatio > 0.5) {
            console.warn(`⚠️ Fallback videos table has too many placeholder titles (${placeholderCount}/${videosTable.length} = ${(placeholderRatio * 100).toFixed(1)}%)`);
            console.warn(`   Skipping fallback to videos table - would cause matching issues`);
            console.warn(`   This is expected if videos table contains old/placeholder data`);
            userVideos = [];
            userVideosError = new Error('Fallback table has too many placeholder titles');
          } else {
            // Map videos table structure to match channel_videos structure
            userVideos = videosTable.map(v => ({
              ...v,
              description: v.description || '', // videos table might not have description
              // Normalize: videos table uses published_at, but we'll map to publish_date for consistency
              publish_date: v.published_at || v.publish_date,
            }));
            console.log(`✅ Found ${videosTable.length} videos in videos table (using as fallback, ${placeholderCount} placeholders filtered)`);
          }
        } else {
          // Diagnostic: Check if videos exist at all (without show_id filter)
          console.error(`⚠️ No videos found in either channel_videos or videos table for show_id: ${showId}`);
          console.error(`   Diagnostic: Checking if ANY videos exist...`);
          
          const { data: anyChannelVideos, count: channelCount } = await supabaseAdmin
            .from('channel_videos')
            .select('id, show_id, title', { count: 'exact', head: true })
            .limit(5);
          
          const { data: anyVideos, count: videosCount } = await supabaseAdmin
            .from('videos')
            .select('id, show_id, title', { count: 'exact', head: true })
            .limit(5);
          
          console.error(`   channel_videos table: ${channelCount || 0} total rows`);
          console.error(`   videos table: ${videosCount || 0} total rows`);
          if (anyChannelVideos && anyChannelVideos.length > 0) {
            console.error(`   Sample channel_videos show_ids:`, anyChannelVideos.map(v => ({ id: v.id, show_id: v.show_id, title: v.title?.substring(0, 40) })));
          }
          if (anyVideos && anyVideos.length > 0) {
            console.error(`   Sample videos show_ids:`, anyVideos.map(v => ({ id: v.id, show_id: v.show_id, title: v.title?.substring(0, 40) })));
          }
          
          userVideosError = new Error('No videos found in any table');
        }
      }
    }

    if (userVideos && userVideos.length > 0) {
      // Normalize date field for logging (channel_videos uses publish_date, videos uses published_at)
      const sampleDate = userVideos[0].publish_date || userVideos[0].published_at;
      console.log(`📹 Sample user video structure:`, {
        hasTitle: !!userVideos[0].title,
        hasDescription: !!userVideos[0].description,
        hasPublishDate: !!userVideos[0].publish_date,
        hasPublishedAt: !!userVideos[0].published_at,
        hasTopicId: !!userVideos[0].topic_id,
        sampleTitle: userVideos[0].title?.substring(0, 60),
        sampleDescription: userVideos[0].description?.substring(0, 60),
        samplePublishedAt: sampleDate,
      });
      
      // Log sample titles to verify data
      console.log(`📹 Sample user video titles (first 5):`);
      userVideos.slice(0, 5).forEach((v, i) => {
        // Normalize date field (channel_videos uses publish_date, videos uses published_at)
        const videoDate = v.publish_date || v.published_at;
        console.log(`     ${i + 1}. "${v.title?.substring(0, 80)}" (published: ${videoDate || 'N/A'})`);
      });
    } else {
      console.error(`❌ CRITICAL: No user videos found for show_id: ${showId}`);
      console.error(`   This will cause all ideas to show "You haven't covered this topic"`);
      console.error(`   Please verify:`);
      console.error(`   1. Videos exist in channel_videos or videos table`);
      console.error(`   2. show_id ${showId} is correct`);
      console.error(`   3. Videos have the correct show_id`);
    }

    // Normalize user videos data structure
    // CRITICAL: Fix title field - check multiple possible column names
    // CRITICAL: channel_videos uses 'publish_date', videos table uses 'published_at'
    // Normalize both to 'published_at' for consistency in scoring functions
    const normalizedUserVideos = (userVideos || []).map(video => {
      // Try multiple possible title fields (title_ar, title_en, title)
      const actualTitle = video.title_ar || video.title_en || video.title || '';
      
      // If title is "شعار" (logo placeholder), log warning
      if (actualTitle === 'شعار' || actualTitle === 'logo' || actualTitle.trim() === '') {
        console.warn(`⚠️ Video ${video.id || video.video_id || 'unknown'} has placeholder title: "${actualTitle}"`);
        // Try to get from youtube_url or other fields
        // For now, keep the placeholder but log it
      }
      
      // Normalize date field: channel_videos uses 'publish_date', videos table uses 'published_at'
      // Map both to 'published_at' for consistency
      const normalizedDate = video.publish_date || video.published_at || video.publishedAt || video.created_at || video.upload_date;
      
      return {
        ...video,
        // Use actual title (from any source)
        title: actualTitle,
        // Normalize: always use 'published_at' regardless of source table column name
        published_at: normalizedDate,
        // Also keep original for reference
        publish_date: normalizedDate,
        // Ensure description exists (try multiple field names)
        description: video.description || video.desc || '',
        // Ensure topic_id exists (could be null)
        topic_id: video.topic_id || video.topic || null,
        // Include video_id and youtube_url for evidence
        video_id: video.video_id || video.id,
        youtube_url: video.youtube_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null),
      };
    });

    console.log(`📹 Normalized user videos: ${normalizedUserVideos.length} videos`);
    console.log(`🧬 Using ${dnaTopics.length} DNA topics (already fetched)`);

    // ============================================
    // STEP 6.5: Get Behavior Patterns (for pattern matching like "Matches Money & Wealth Stories pattern")
    // ============================================
    console.log('🎯 Fetching behavior patterns for pattern matching...');
    let behaviorPatterns = {};
    let patternLearnedWeights = {};
    try {
      behaviorPatterns = await getShowPatterns(showId);
      console.log(`✅ Loaded ${Object.keys(behaviorPatterns).length} behavior patterns`);
      
      // Get learned pattern weights from user feedback
      try {
        const { data: learningData } = await supabaseAdmin
          .from('show_learning_weights')
          .select('pattern_weights')
          .eq('show_id', showId)
          .maybeSingle();
        
        patternLearnedWeights = learningData?.pattern_weights || {};
        if (Object.keys(patternLearnedWeights).length > 0) {
          console.log(`🧠 Loaded ${Object.keys(patternLearnedWeights).length} learned pattern weights`);
        }
      } catch (weightError) {
        console.warn('⚠️ Could not fetch pattern weights (non-fatal):', weightError.message);
      }
    } catch (patternError) {
      console.warn('⚠️ Could not fetch behavior patterns (non-fatal):', patternError.message);
      // Continue without pattern matching - it's optional
    }

    // ============================================
    // STEP 6.6: Get Learned Adjustments
    // ============================================
    console.log('🧠 Fetching learned adjustments from feedback...');
    const learnedAdjustments = await getLearnedAdjustments(showId, 90);
    console.log(`📊 Learned adjustments: ${learnedAdjustments.feedbackCount} feedback entries analyzed`);

    // Count similar signals (for source count)
    const signalTitleMap = new Map();
    for (const signal of learnedSignals) {
      const normalized = normalizeText(signal.title || '');
      if (!signalTitleMap.has(normalized)) {
        signalTitleMap.set(normalized, []);
      }
      signalTitleMap.get(normalized).push(signal);
    }

    // Count unique stories (deduplication check)
    const uniqueStories = new Set(learnedSignals.map(s => normalizeText(s.title || ''))).size;
    console.log(`📊 STEP 4 - After learning adjustments: ${learnedSignals.length} signals (${uniqueStories} unique stories)`);
    
    // Apply multi-signal scoring to each signal
    const multiSignalScored = await Promise.all(learnedSignals.map(async signal => {
      const normalizedTitle = normalizeText(signal.title || '');
      const similarSignals = signalTitleMap.get(normalizedTitle) || [signal];
      const sourceCount = similarSignals.length;

      // DEBUG: Log data for specific ideas
      const isDebugIdea = signal.title && (
        (signal.title.includes('ترامب') && signal.title.includes('الصين')) ||
        signal.title.toLowerCase().includes('venezuela') || 
        signal.title.toLowerCase().includes('oil') || 
        signal.title.toLowerCase().includes('tanker')
      );
      
      if (isDebugIdea) {
        console.log('\n🔍 ===== DEBUG IDEA =====');
        console.log('Title:', signal.title);
        console.log('Description:', signal.description?.substring(0, 200) || signal.raw_data?.description?.substring(0, 200) || 'N/A');
        console.log('Topic ID:', signal.topic_id || 'N/A');
        console.log('User videos available:', normalizedUserVideos.length);
        console.log('Competitor videos available:', normalizedCompetitorVideos.length);
        console.log('Competitor video types:', {
          direct: normalizedCompetitorVideos.filter(v => v.competitors?.type === 'direct').length,
          indirect: normalizedCompetitorVideos.filter(v => v.competitors?.type === 'indirect').length,
          trendsetter: normalizedCompetitorVideos.filter(v => v.competitors?.type === 'trendsetter').length,
          unknown: normalizedCompetitorVideos.filter(v => !v.competitors?.type).length
        });
        
        // Log sample user videos for Venezuela/oil ideas
        if (signal.title.toLowerCase().includes('venezuela') || signal.title.toLowerCase().includes('oil') || signal.title.toLowerCase().includes('tanker')) {
          console.log('📹 Sample user videos (first 5):');
          normalizedUserVideos.slice(0, 5).forEach((v, i) => {
            console.log(`     ${i + 1}. "${v.title?.substring(0, 80)}"`);
            console.log(`        Description: "${(v.description || '').substring(0, 100)}"`);
            console.log(`        Published: ${v.published_at || 'N/A'}, Topic ID: ${v.topic_id || 'N/A'}`);
          });
        }
        
        console.log('Sample competitor videos (first 5):', normalizedCompetitorVideos.slice(0, 5).map(v => ({
          title: v.title?.substring(0, 60),
          type: v.competitors?.type || 'unknown',
          channel: v.competitors?.name || 'unknown',
          views: v.views,
          published_at: v.published_at,
          days_ago: Math.floor((Date.now() - new Date(v.published_at || Date.now())) / (1000 * 60 * 60 * 24))
        })));
      }

      // Extract source information for evidence
      const sourceUrl = signal.url || signal.raw_data?.url || signal.raw_data?.link || null;
      const sourceTitle = signal.raw_data?.sourceName || signal.source || signal.raw_data?.source_name || null;
      
      // DEBUG: Log source URL for Ukraine/Russia ideas
      const isUkraineIdea = signal.title && (
        signal.title.toLowerCase().includes('ukraine') ||
        signal.title.toLowerCase().includes('ukrainian') ||
        signal.title.toLowerCase().includes('kyiv') ||
        signal.title.toLowerCase().includes('russia') ||
        signal.title.toLowerCase().includes('russian')
      );
      if (isUkraineIdea) {
        console.log(`\n🔍 ===== DEBUG Source URL for Ukraine/Russia idea =====`);
        console.log(`   Signal title:`, signal.title);
        console.log(`   signal.url:`, signal.url || 'null');
        console.log(`   signal.raw_data?.url:`, signal.raw_data?.url || 'null');
        console.log(`   signal.raw_data?.link:`, signal.raw_data?.link || 'null');
        console.log(`   Final sourceUrl:`, sourceUrl);
        console.log(`   sourceTitle:`, sourceTitle);
      }
      
      const scoring = await calculateIdeaScore(signal, {
        competitorVideos: normalizedCompetitorVideos,
        userVideos: normalizedUserVideos,
        dnaTopics,
        signalTitle: signal.title,
        signalDescription: signal.description || signal.raw_data?.description || '', // Include description for keyword matching
        signalPublishedAt: signal.published_at || signal.created_at,
        signalTopicId: signal.topic_id,
        sourceUrl,
        sourceTitle,
        sourceCount,
      }, excludedNames); // Pass excluded names to filter out channel/source names
      
      // ============================================
      // ADD BEHAVIOR PATTERN MATCHING
      // ============================================
      let patternMatches = [];
      if (Object.keys(behaviorPatterns).length > 0) {
        try {
          const patternScore = await scoreSignalByPatterns(signal, behaviorPatterns, patternLearnedWeights);
          if (patternScore.matches && patternScore.matches.length > 0) {
            patternMatches = patternScore.matches.map(match => ({
              patternId: match.patternId,
              patternName: match.patternName,
              patternNameAr: match.patternNameAr,
              evidence: match.evidence, // e.g., "Matches 'Money & Wealth Stories' pattern..."
              boost: match.boost,
              source: match.source, // 'videos', 'comments', or 'competitors'
              confidence: match.confidence,
              isLearned: match.isLearned
            }));
            
            if (isDebugIdea) {
              console.log('   Pattern matches:', patternMatches.map(m => ({
                name: m.patternName,
                evidence: m.evidence,
                boost: m.boost
              })));
            }
          }
        } catch (patternError) {
          console.warn('⚠️ Error calculating pattern matches for signal (non-fatal):', patternError.message);
        }
      }

      // DEBUG: Log scoring results for specific ideas
      if (isDebugIdea) {
        console.log('\n📊 Scoring result for:', signal.title);
        console.log('   Score:', scoring.score);
        console.log('   Signal count:', scoring.signalCount);
        console.log('   Signals:', scoring.signals.map(s => ({
          type: s.type,
          icon: s.icon,
          text: s.text,
          weight: s.weight
        })));
        console.log('   Competitor breakout:', scoring.signals.find(s => s.type?.includes('competitor_breakout'))?.data || null);
        console.log('   Competitor counts:', scoring.competitorBreakdown || null);
        console.log('   DNA match:', scoring.signals.find(s => s.type === 'dna_match')?.data?.topics || []);
        console.log('===== END DEBUG =====\n');
      }

      const urgency = getUrgencyTier(scoring, signal);

      // Apply learned adjustments to the score
      const ideaWithScoring = {
        ...signal,
        multi_signal_scoring: scoring,
      };
      const learnedAdjustedScore = await applyLearnedAdjustments(
        scoring.score,
        ideaWithScoring,
        learnedAdjustments
      );

      const result = {
        ...signal,
        // Use learned-adjusted score if different, otherwise use multi-signal score
        score: learnedAdjustedScore !== scoring.score ? learnedAdjustedScore : scoring.score,
        final_score: learnedAdjustedScore !== scoring.score ? learnedAdjustedScore : scoring.score,
        relevance_score: learnedAdjustedScore !== scoring.score ? learnedAdjustedScore : scoring.score,
        // Add new fields
        multi_signal_scoring: {
          ...scoring,
          base_score: scoring.score,
          learned_adjusted_score: learnedAdjustedScore,
        },
        urgency_tier: urgency,
        // Add behavior pattern matches (for displaying "Matches Money & Wealth Stories pattern")
        behavior_patterns: patternMatches.length > 0 ? patternMatches : undefined,
        // Keep learning adjustments for reference
        original_learning_score: signal.score,
        learned_adjustments_applied: learnedAdjustedScore !== scoring.score,
      };

      // Debug: Log why signals are being filtered
      if (!scoring.isValid || !urgency) {
        console.log(`⚠️ Signal filtered: "${signal.title?.substring(0, 50)}..." - isValid: ${scoring.isValid}, urgency: ${urgency ? urgency.tier : 'null'}, score: ${scoring.score}, signalCount: ${scoring.signalCount}`);
      }

      return result;
    }));

    const afterScoring = multiSignalScored.length;
    console.log(`📊 STEP 5 - After multi-signal scoring: ${afterScoring} signals scored`);

    // Filter: Only show signals with valid multi-signal scoring
    // BUT: If no signals pass, show top signals anyway (fallback for new channels)
    const validSignals = multiSignalScored.map(signal => {
      // Always show protected (liked) signals
      if (signal.is_protected) {
        // Ensure it has a tier
        if (!signal.urgency_tier) {
          signal.urgency_tier = {
            tier: 'backlog',
            label: 'Backlog',
            color: 'green',
            icon: '🟢',
            reason: 'Protected signal',
          };
        }
        return signal;
      }
      
      // Must have valid scoring (at least 1 positive signal OR score >= 30)
      const isValid = signal.multi_signal_scoring?.isValid;
      const hasTier = signal.urgency_tier !== null;
      
      // If valid but no tier, assign default backlog tier
      if (isValid && !hasTier) {
        signal.urgency_tier = {
          tier: 'backlog',
          label: 'Backlog',
          color: 'green',
          icon: '🟢',
          reason: 'Potential opportunity',
        };
        return signal;
      }
      
      // Return signal if valid and has tier, otherwise null (will be filtered)
      return (isValid && hasTier) ? signal : null;
    }).filter(Boolean); // Remove nulls

    const afterFilter = validSignals.length;
    console.log(`📊 STEP 6 - After validity filter: ${afterFilter} valid signals (${multiSignalScored.length - afterFilter} filtered out)`);
    
    // Debug: Show breakdown of why signals were filtered
    const filteredOut = multiSignalScored.filter(signal => {
      if (signal.is_protected) return false;
      const isValid = signal.multi_signal_scoring?.isValid;
      const hasTier = signal.urgency_tier !== null;
      return !(isValid && hasTier);
    });
    
    if (filteredOut.length > 0) {
      console.log(`🔍 Filtered out ${filteredOut.length} signals:`);
      filteredOut.slice(0, 5).forEach(s => {
        console.log(`  - "${s.title?.substring(0, 50)}..." - isValid: ${s.multi_signal_scoring?.isValid}, hasTier: ${s.urgency_tier !== null}, score: ${s.multi_signal_scoring?.score}, signalCount: ${s.multi_signal_scoring?.signalCount}`);
      });
    }

    // Fallback: If no signals pass the filter, show top signals anyway (for new channels without data)
    let signalsToShow = validSignals;
    if (validSignals.length === 0 && multiSignalScored.length > 0) {
      console.log('⚠️ No signals passed filter, showing top signals as fallback');
      // Show top 10 signals by score, even if they don't have 2+ signals
      signalsToShow = multiSignalScored
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 10)
        .map(signal => ({
          ...signal,
          // Add default urgency tier if missing
          urgency_tier: signal.urgency_tier || {
            tier: 'backlog',
            label: 'Backlog',
            color: 'green',
            icon: '🟢',
            reason: 'Good topic, not urgent'
          },
          // Ensure multi_signal_scoring exists
          multi_signal_scoring: signal.multi_signal_scoring || {
            score: signal.score || 50,
            signals: [],
            signalCount: 0,
            isValid: false
          }
        }));
    }

    // 7. Sort by urgency tier then score
    // Normalize tier names for backwards compatibility (today -> post_today, week -> this_week, evergreen -> backlog)
    signalsToShow.forEach(signal => {
      if (signal.urgency_tier?.tier === 'today') {
        signal.urgency_tier.tier = 'post_today';
      } else if (signal.urgency_tier?.tier === 'week') {
        signal.urgency_tier.tier = 'this_week';
      } else if (signal.urgency_tier?.tier === 'evergreen') {
        // Keep evergreen tier name but include it in backlog category for filtering
        // Don't change the tier name, just ensure it's included in backlog filter
      }
    });
    
    const tierOrder = { post_today: 0, this_week: 1, backlog: 2, evergreen: 2, today: 0, week: 1 }; // Support both old and new names, evergreen = backlog
    signalsToShow.sort((a, b) => {
      const tierA = a.urgency_tier?.tier || 'backlog';
      const tierB = b.urgency_tier?.tier || 'backlog';
      
      // Normalize old tier names for sorting (evergreen counts as backlog)
      const normalizedTierA = tierA === 'today' ? 'post_today' : tierA === 'week' ? 'this_week' : tierA === 'evergreen' ? 'backlog' : tierA;
      const normalizedTierB = tierB === 'today' ? 'post_today' : tierB === 'week' ? 'this_week' : tierB === 'evergreen' ? 'backlog' : tierB;
      
      if (tierOrder[normalizedTierA] !== tierOrder[normalizedTierB]) {
        return (tierOrder[normalizedTierA] ?? 2) - (tierOrder[normalizedTierB] ?? 2);
      }
      
      return (b.multi_signal_scoring?.score || b.score || 0) - (a.multi_signal_scoring?.score || a.score || 0);
    });

    // Limit to top signals per tier (time-sensitivity based limits)
    const TIER_LIMITS = {
      post_today: 5,    // Max 5 urgent items
      this_week: 7,     // Max 7 planned items
      backlog: 15       // Max 15 library items
    };
    
    const tieredSignals = {
      post_today: signalsToShow.filter(s => s.urgency_tier?.tier === 'post_today' || s.urgency_tier?.tier === 'today').slice(0, TIER_LIMITS.post_today),
      this_week: signalsToShow.filter(s => s.urgency_tier?.tier === 'this_week' || s.urgency_tier?.tier === 'week').slice(0, TIER_LIMITS.this_week),
      backlog: signalsToShow.filter(s => s.urgency_tier?.tier === 'backlog' || s.urgency_tier?.tier === 'evergreen').slice(0, TIER_LIMITS.backlog),
    };

    const finalSignalsList = [
      ...tieredSignals.post_today,
      ...tieredSignals.this_week,
      ...tieredSignals.backlog,
    ].slice(0, limit); // Max limit total

    // PROTECTION: Always include high-score signals (score >= 70) in visible list
    // This ensures quality signals aren't hidden by tier limits
    const highScoreSignals = (signals || []).filter(s => {
      const score = s.multi_signal_scoring?.score || s.score || 0;
      return score >= 70 && !finalSignalsList.find(fs => fs.id === s.id);
    });
    
    // Add high-score signals to final list (they're already sorted by score)
    if (highScoreSignals.length > 0) {
      console.log(`⭐ PROTECTING ${highScoreSignals.length} high-score signals (score >= 70) from being hidden`);
      highScoreSignals.forEach(s => {
        const score = s.multi_signal_scoring?.score || s.score || 0;
        console.log(`   - "${s.title?.substring(0, 50)}" (score: ${score})`);
      });
      finalSignalsList.push(...highScoreSignals);
    }

    const finalDisplayed = finalSignalsList.length;
    console.log(`📊 STEP 7 - Final displayed: ${finalDisplayed} signals`);
    console.log(`   - Post Today: ${tieredSignals.post_today.length}, This Week: ${tieredSignals.this_week.length}, Backlog: ${tieredSignals.backlog.length}`);
    if (highScoreSignals.length > 0) {
      console.log(`   - High-Score Protected: ${highScoreSignals.length}`);
    }
    
    // Summary log for easy debugging
    console.log(`\n📈 SIGNAL COUNT SUMMARY:`);
    console.log(`   Raw RSS items: ${rawRssItems}`);
    console.log(`   After status processing: ${afterStatusProcessing}`);
    console.log(`   After rejection filter: ${afterRejectionFilter}`);
    console.log(`   After learning adjustments: ${learnedSignals.length} (${uniqueStories} unique stories)`);
    console.log(`   After scoring: ${afterScoring}`);
    console.log(`   After validity filter: ${afterFilter}`);
    console.log(`   Final displayed: ${finalDisplayed} (${highScoreSignals.length} high-score protected)`);
    console.log(`   Limit applied: ${limit} (per-tier limits: Post Today=${TIER_LIMITS.post_today}, This Week=${TIER_LIMITS.this_week}, Backlog=${TIER_LIMITS.backlog})\n`);

    // 8. Update is_visible column in database based on filtering
    try {
      const visibleIds = finalSignalsList.map(s => s.id).filter(Boolean);
      const allSignalIds = (signals || []).map(s => s.id).filter(Boolean);
      
      // PROTECTION: Never hide high-score signals (score >= 70)
      const highScoreIds = (signals || [])
        .filter(s => {
          const score = s.multi_signal_scoring?.score || s.score || 0;
          return score >= 70;
        })
        .map(s => s.id)
        .filter(Boolean);
      
      // Ensure all high-score signals are in visible list
      const protectedVisibleIds = [...new Set([...visibleIds, ...highScoreIds])];
      
      // Only hide signals that are NOT in visible list AND NOT high-score
      const hiddenIds = allSignalIds.filter(id => 
        !protectedVisibleIds.includes(id)
      );
      
      // Log which signals are being hidden and why
      if (hiddenIds.length > 0) {
        const hiddenSignals = (signals || []).filter(s => hiddenIds.includes(s.id));
        console.log(`👁️ Hiding ${hiddenIds.length} signals:`);
        hiddenSignals.forEach(s => {
          const score = s.multi_signal_scoring?.score || s.score || 0;
          // Verify no high-score signals are being hidden (should never happen due to protection)
          if (score >= 70) {
            console.error(`⚠️ ERROR: Attempted to hide high-score signal (${score})! This should never happen.`);
            console.error(`   Signal: "${s.title?.substring(0, 50)}"`);
          } else {
            console.log(`   - "${s.title?.substring(0, 50)}" | Score: ${score} | Reason: Tier limit or low score`);
          }
        });
      }
      
      // Mark visible signals as visible (including protected high-score signals)
      if (protectedVisibleIds.length > 0) {
        await supabaseAdmin
          .from('signals')
          .update({ is_visible: true })
          .eq('show_id', showId)
          .in('id', protectedVisibleIds);
      }
      
      // Mark hidden signals as not visible (but never hide high-score signals)
      if (hiddenIds.length > 0) {
        await supabaseAdmin
          .from('signals')
          .update({ is_visible: false })
          .eq('show_id', showId)
          .in('id', hiddenIds);
      }
      
      const highScoreHiddenCount = hiddenIds.filter(id => highScoreIds.includes(id)).length;
      if (highScoreHiddenCount > 0) {
        console.error(`⚠️ ERROR: ${highScoreHiddenCount} high-score signals were incorrectly marked as hidden!`);
      }
      console.log(`✅ Updated is_visible: ${protectedVisibleIds.length} visible (${highScoreIds.length} high-score protected), ${hiddenIds.length} hidden`);
    } catch (updateError) {
      console.error('⚠️ Error updating is_visible column:', updateError);
      // Don't fail the request if visibility update fails
    }

    return NextResponse.json({
      success: true,
      signals: finalSignalsList,
      stats: {
        total: signals?.length || 0,
        unique_stories: uniqueStories,
        after_status_processing: afterStatusProcessing,
        after_rejection_filter: afterRejectionFilter,
        after_scoring: afterScoring,
        after_validity_filter: afterFilter,
        visible: finalSignalsList.length,
        hidden: (signals?.length || 0) - finalSignalsList.length,
        rejected_count: rejectedTitles.length,
        by_tier: {
          post_today: tieredSignals.post_today.length,
          this_week: tieredSignals.this_week.length,
          backlog: tieredSignals.backlog.length,
        },
        limit_applied: limit,
        per_tier_limit: TIER_LIMITS
      },
      learning_applied: !!weights,
      multi_signal_scoring: true
    });

  } catch (error) {
    console.error('❌ Signals API error:', error);
    console.error('   Error type:', error?.constructor?.name || typeof error);
    console.error('   Error message:', error?.message || String(error));
    console.error('   Error stack:', error?.stack || 'No stack trace');
    
    // Check if it's a fetch/network error
    if (error?.message?.includes('fetch failed') || error?.name === 'TypeError' || error?.message?.includes('fetch')) {
      console.error('   🔍 FETCH FAILED - This is likely a Supabase connection issue:');
      console.error('      - NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` : '❌ MISSING');
      console.error('      - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...` : '❌ MISSING');
      console.error('      - Check if .env.local file exists and has correct values');
      console.error('      - Check if Supabase project is active (not paused)');
      console.error('      - Check network connectivity to Supabase');
      console.error('      - Verify Supabase URL format is correct');
      
      return NextResponse.json(
        { 
          error: 'Database connection failed',
          type: 'TypeError',
          message: error?.message || 'fetch failed',
          details: 'This is likely a Supabase configuration issue. Check your .env.local file for NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
          troubleshooting: {
            checkEnvFile: 'Verify .env.local exists with correct Supabase credentials',
            checkSupabaseProject: 'Verify Supabase project is active and not paused',
            checkNetwork: 'Check network connectivity to Supabase',
            hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
          }
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: error?.message || 'Internal server error',
        type: error?.constructor?.name || typeof error,
        details: error?.details || error?.hint || undefined
      }, 
      { status: 500 }
    );
  }
}

// Helper functions

/**
 * Normalize Arabic text (remove diacritics, normalize alef/ya variations)
 */
function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  return text
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variations (أ, إ, آ, ا) to ا
    .replace(/[أإآ]/g, 'ا')
    // Normalize ya variations (ي, ى) to ي
    .replace(/ى/g, 'ي')
    // Normalize ta marbuta (ة) to ه
    .replace(/ة/g, 'ه')
    .trim();
}

function normalizeText(text) {
  const normalized = normalizeArabicText(text || '');
  return normalized
    .replace(/[-–—]/g, ' ')
    .replace(/[؟?!.,:;'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSimilar(str1, str2) {
  if (!str1 || !str2) return false;
  if (str1 === str2) return true;
  
  const words1 = str1.split(' ').filter(w => w.length > 2);
  const words2 = str2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  let matches = 0;
  words1.forEach(w => {
    if (words2.some(w2 => w2.includes(w) || w.includes(w2))) matches++;
  });
  
  return matches / Math.max(words1.length, words2.length) > 0.5;
}
