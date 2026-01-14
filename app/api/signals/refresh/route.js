import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { checkQuota, incrementUsage } from '@/lib/rateLimiter';
import Parser from 'rss-parser';
import Groq from 'groq-sdk';
import { getChannelDNA } from '@/lib/contentDNA';
import { groupSignalsByStory, selectBestFromStories } from '@/lib/storySignature';
import { getShowAudienceData, calculateAudienceDemand } from '@/lib/audienceDemand';
import { getCompetitorBreakouts, calculateCompetitorBoost } from '@/lib/competitorBoost';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Create parser with increased timeout and better error handling
const parser = new Parser({
  timeout: 20000, // Increased from 10s to 20s
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader Bot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  },
  maxRedirects: 5
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Safely encode URL - only encode if it contains unescaped non-ASCII characters
 * This prevents double-encoding of already-encoded URLs
 */
function safeEncodeUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  // Check if URL contains unescaped non-ASCII characters (Arabic, etc.)
  // encodeURI() is safe - it won't double-encode already encoded parts
  // But we should check if the URL is already mostly encoded
  const hasNonAscii = /[^\x00-\x7F]/.test(url);
  
  if (hasNonAscii) {
    // Contains non-ASCII characters, encode it
    // encodeURI() handles this safely without double-encoding
    return encodeURI(url);
  }
  
  return url;
}

/**
 * Fetch RSS feed with retry logic
 * @param {string} feedUrl - The RSS feed URL
 * @param {string} feedName - Name of the feed for logging
 * @param {number} retries - Number of retry attempts (default: 2)
 * @returns {Promise<Object>} Parsed feed object or null if all retries fail
 */
async function fetchRssFeedWithRetry(feedUrl, feedName, retries = 2) {
  const encodedUrl = safeEncodeUrl(feedUrl);
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Wait before retry with exponential backoff
        const waitTime = 1000 * (attempt + 1);
        console.log(`  Retrying ${feedName} (attempt ${attempt + 1}/${retries + 1}) after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Create a new parser instance for each attempt to avoid state issues
      const attemptParser = new Parser({
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader Bot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        maxRedirects: 5
      });
      
      const feed = await attemptParser.parseURL(encodedUrl);
      return { success: true, feed, error: null };
      
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error.message || error.toString();
      
      if (isLastAttempt) {
        console.error(`  ❌ Failed to fetch ${feedName} after ${retries + 1} attempts: ${errorMessage}`);
        return { 
          success: false, 
          feed: null, 
          error: errorMessage,
          feedName: feedName,
          url: feedUrl
        };
      } else {
        console.warn(`  ⚠️ Attempt ${attempt + 1} failed for ${feedName}: ${errorMessage}`);
      }
    }
  }
  
  return { success: false, feed: null, error: 'Max retries exceeded', feedName: feedName, url: feedUrl };
}

// GET handler for testing
export async function GET(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      message: 'Signals refresh endpoint. Use POST method.',
      endpoint: '/api/signals/refresh',
      method: 'POST',
      params: 'showId (query param or body)'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const startTime = Date.now();
  console.log('🔄 POST /api/signals/refresh - Request received at', new Date().toISOString());
  
  try {
    // STEP 1: Get auth - this gives us both user and supabase client
    console.log('🔐 Getting auth user...');
    const authStartTime = Date.now();
    const { user, supabase, error: authError } = await getAuthUser(request);
    console.log(`🔐 Auth completed in ${Date.now() - authStartTime}ms:`, { hasUser: !!user, hasError: !!authError, userEmail: user?.email });
    
    if (authError || !user || !supabase) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated',
        message: 'Please log in to refresh signals'
      }, { status: 401 });
    }

    // STEP 1.5: Check rate limit
    const quota = await checkQuota(user.id, 'refresh');
    console.log('📊 Quota check result:', { 
      allowed: quota.allowed, 
      remaining: quota.remaining, 
      limit: quota.limit,
      used: quota.used 
    });
    
    if (!quota.allowed) {
      console.log(`🚫 Rate limit exceeded for user ${user.email}: refresh`);
      return NextResponse.json({ 
        success: false,
        error: 'Daily limit reached',
        message: `You've used all ${quota.limit} signal refreshes for today. Try again tomorrow.`,
        remaining: 0,
        limit: quota.limit
      }, { status: 429 });
    }

    // STEP 2: Get showId from request body
    let showId = null;
    const errors = []; // Initialize errors array at the top level
    
    // Try to get showId from URL params first
    try {
      const url = new URL(request.url);
      showId = url.searchParams.get('showId');
    } catch (e) {
      console.warn('Could not parse URL:', e.message);
    }
    
    // If not in URL, try body (read body once)
    if (!showId) {
      try {
        const body = await request.json();
        showId = body.showId;
      } catch (e) {
        // Body might not be JSON or might be empty, that's okay
        console.warn('Could not parse request body:', e.message);
      }
    }

    if (!showId) {
      return NextResponse.json({ 
        success: false,
        error: 'showId required. Provide it as a query parameter (?showId=...) or in the request body.' 
      }, { status: 400 });
    }

    // Validate showId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(showId)) {
      return NextResponse.json({ 
        success: false,
        error: `Invalid showId format. Expected UUID, got: ${showId}` 
      }, { status: 400 });
    }

    console.log(`🔄 Refresh starting for show: ${showId}, user: ${user.email} (${Date.now() - startTime}ms since request start)`);

    // Get enabled sources for this show
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from('signal_sources')
      .select('*')
      .eq('show_id', showId)
      .eq('enabled', true);

    if (sourcesError) throw sourcesError;

    if (!sources || sources.length === 0) {
      return NextResponse.json({ 
        error: 'No enabled RSS sources found for this show' 
      }, { status: 400 });
    }
    
    // ===========================================
    // RSS FEED CONFIGURATION ANALYSIS
    // ===========================================
    console.log(`\n📡 RSS FEED CONFIGURATION:`);
    console.log(`   Total enabled feeds: ${sources.length}`);
    
    // Group by source type
    const feedByType = {};
    sources.forEach(s => {
      const type = s.source_type || 'rss';
      if (!feedByType[type]) {
        feedByType[type] = [];
      }
      feedByType[type].push(s);
    });
    
    Object.entries(feedByType).forEach(([type, feeds]) => {
      console.log(`   - ${type}: ${feeds.length} feeds`);
      feeds.slice(0, 5).forEach(f => {
        console.log(`     • ${f.name} (limit: ${f.item_limit || 20})`);
      });
      if (feeds.length > 5) {
        console.log(`     ... and ${feeds.length - 5} more ${type} feeds`);
      }
    });
    
    // Check feed quality
    const googleNewsFeeds = sources.filter(s => s.url?.includes('news.google.com')).length;
    const directFeeds = sources.filter(s => 
      s.url?.includes('bloomberg.com') || 
      s.url?.includes('reuters.com') || 
      s.url?.includes('aljazeera.com') || 
      s.url?.includes('aljazeera.net') ||
      s.url?.includes('ft.com') ||
      s.url?.includes('economist.com')
    ).length;
    
    console.log(`\n📊 Feed Quality Breakdown:`);
    console.log(`   - Google News (aggregator): ${googleNewsFeeds} feeds`);
    console.log(`   - Direct high-quality feeds: ${directFeeds} feeds`);
    console.log(`   - Other feeds: ${sources.length - googleNewsFeeds - directFeeds} feeds`);
    
    if (googleNewsFeeds > directFeeds * 2) {
      console.log(`   ⚠️ WARNING: Too many Google News feeds (${googleNewsFeeds}) vs direct feeds (${directFeeds})`);
      console.log(`   💡 Recommendation: Add more direct RSS feeds (Bloomberg, Reuters, Al Jazeera)`);
    }

    // Get show's DNA configuration for rich filtering rules
    console.log(`\n🧬 Loading show's DNA configuration for filtering...`);
    
    const { data: showDna } = await supabaseAdmin
      .from('show_dna')
      .select('*')
      .eq('show_id', showId)
      .single();
    
    // Get topic definitions for this show
    const { data: topicDefs } = await supabaseAdmin
      .from('topic_definitions')
      .select('topic_id, name_ar, name, keywords')
      .eq('show_id', showId)
      .eq('is_active', true);
    
    // Get learning profile (show_learning_weights) for learned preferences
    console.log(`📚 Loading learning profile...`);
    const { data: learningProfile } = await supabaseAdmin
      .from('show_learning_weights')
      .select('dna_topic_weights, topic_weights, source_weights')
      .eq('show_id', showId)
      .single();
    
    // Get topic stats from recommendation_feedback (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentFeedback } = await supabaseAdmin
      .from('recommendation_feedback')
      .select('topic, action')
      .eq('show_id', showId)
      .gte('created_at', thirtyDaysAgo);
    
    // Calculate topic stats (like ratios)
    const topicStats = {};
    if (recentFeedback && recentFeedback.length > 0) {
      const topicGroups = {};
      for (const feedback of recentFeedback) {
        if (!feedback.topic) continue;
        if (!topicGroups[feedback.topic]) {
          topicGroups[feedback.topic] = { total: 0, liked: 0, rejected: 0 };
        }
        topicGroups[feedback.topic].total++;
        if (feedback.action === 'liked' || feedback.action === 'produced') {
          topicGroups[feedback.topic].liked++;
        } else if (feedback.action === 'rejected') {
          topicGroups[feedback.topic].rejected++;
        }
      }
      
      // Calculate like ratios
      for (const [topic, stats] of Object.entries(topicGroups)) {
        topicStats[topic] = {
          liked: stats.liked,
          rejected: stats.rejected,
          total: stats.total,
          likeRatio: stats.total > 0 ? stats.liked / stats.total : 0
        };
      }
    }
    
    if (!showDna) {
      console.warn('⚠️ No DNA found for show, using default filtering');
    } else {
      console.log(`✅ Loaded DNA configuration with ${Object.keys(showDna.scoring_keywords || {}).length} keyword categories`);
    }
    
    if (learningProfile?.dna_topic_weights) {
      console.log(`✅ Loaded DNA topic weights for ${Object.keys(learningProfile.dna_topic_weights || {}).length} topics`);
    }
    if (learningProfile?.topic_weights) {
      console.log(`✅ Loaded keyword topic weights for ${Object.keys(learningProfile.topic_weights || {}).length} keywords`);
    }
    const sourceWeights = learningProfile?.source_weights || {};
    if (sourceWeights && Object.keys(sourceWeights).length > 0) {
      console.log(`✅ Loaded source weights for ${Object.keys(sourceWeights).length} sources`);
    }
    
    if (Object.keys(topicStats).length > 0) {
      console.log(`✅ Loaded topic stats for ${Object.keys(topicStats).length} topics`);
    }
    
    // DNA scoring function using show_dna rules + learning profile
    const scoreSignalWithDNA = (signal, showDna, topicDefs, learningProfile, topicStats) => {
      const title = (signal.title || '').toLowerCase();
      const titleAr = signal.title || '';
      const content = title + ' ' + (signal.description || '').toLowerCase();
      
      let score = 50; // Base score
      let reasons = [];
      let matchedTopic = null;
      
      if (!showDna) {
        return { score: 50, reasons: ['No DNA config'], reject: false, matchedTopic: 'other_stories' };
      }
      
      const keywords = showDna.scoring_keywords || {};
      const weights = showDna.scoring_weights || {};
      
      // === ARABIC SIGNAL BOOST ===
      const isArabic = /[\u0600-\u06FF]/.test(signal.title || '');
      
      // Arabic signals from trusted sources get automatic boost
      const arabicTrustedSources = ['العربية', 'الجزيرة', 'سكاي نيوز', 'الشرق', 'بلومبرغ'];
      if (isArabic) {
        for (const source of arabicTrustedSources) {
          if ((signal.source || '').includes(source) || signal.title.includes(source)) {
            score += 30; // Boost Arabic from trusted sources
            reasons.push(`Arabic trusted source: ${source}`);
            break;
          }
        }
        // Give all Arabic signals a minimum floor
        score = Math.max(score, 40); // Arabic signals start at 40 minimum
        reasons.push('Arabic signal minimum floor');
      }
      
      // === ENGLISH KEYWORD MAPPING ===
      const englishKeywords = {
        'oil': ['نفط', 'بترول'],
        'gold': ['ذهب'],
        'china': ['الصين', 'صيني'],
        'trump': ['ترامب'],
        'tariff': ['رسوم', 'جمركية', 'تعريفات'],
        'ai': ['ذكاء اصطناعي'],
        'economy': ['اقتصاد', 'اقتصادي'],
        'crisis': ['أزمة'],
        'war': ['حرب'],
        'dollar': ['دولار'],
        'inflation': ['تضخم'],
        'saudi': ['السعودية', 'سعودي'],
        'uae': ['الإمارات', 'إماراتي'],
        'egypt': ['مصر', 'مصري'],
        'iran': ['إيران', 'إيراني'],
        'russia': ['روسيا', 'روسي'],
        'venezuela': ['فنزويلا'],
        'bitcoin': ['بيتكوين'],
        'tesla': ['تسلا'],
        'apple': ['آبل'],
        'amazon': ['أمازون'],
      };
      
      // Check English keywords and boost score
      for (const [engWord, arabicWords] of Object.entries(englishKeywords)) {
        if (title.includes(engWord)) {
          score += 15; // Boost for matching English keyword
          reasons.push(`English keyword: ${engWord}`);
          break;
        }
      }
      
      // === ENGLISH STORY PATTERNS (boost) ===
      const englishStoryPatterns = [
        /\bwhy\b/i,           // Why X happened
        /\bhow\b/i,           // How X works
        /\bsecret\b/i,        // Secret of X
        /\btruth\b/i,         // Truth about X
        /\bwar\b/i,           // Trade war, Tech war
        /\bcrisis\b/i,        // Crisis
        /\bcollapse\b/i,      // Collapse
        /\bcrash\b/i,         // Crash
        /\bbillion/i,         // Billions (big numbers)
        /\bmillion/i,         // Millions
        /\btrump\b/i,         // Trump (always newsworthy)
        /\bchina\b/i,         // China (geopolitics)
        /\brussia\b/i,        // Russia
        /\biran\b/i,          // Iran
        /vs\.?|versus/i,      // X vs Y
        /\bfuture\b/i,        // Future of X
      ];
      
      // Boost English signals with story patterns
      for (const pattern of englishStoryPatterns) {
        if (pattern.test(signal.title)) {
          score += 20;
          reasons.push(`English story pattern: ${pattern.source}`);
          break;
        }
      }
      
      // === ENGLISH REJECT PATTERNS ===
      const englishRejectPatterns = [
        /\bquarterly\b/i,
        /\bQ[1-4]\s+\d{4}/i,      // Q1 2024, Q2 2025
        /\bearnings\s+report/i,
        /\bbeats\s+estimates/i,
        /\bmisses\s+estimates/i,
        /\bstock\s+rises/i,
        /\bstock\s+falls/i,
        /\bshares\s+(up|down)/i,
        /\bmarket\s+update/i,
        /\bopening\s+trade/i,     // "The Opening Trade" videos
        /\bclosing\s+bell/i,
      ];
      
      // Reject English signals matching these
      for (const pattern of englishRejectPatterns) {
        if (pattern.test(signal.title)) {
          console.log(`  🗑️ Rejected (English no-story): ${signal.title.substring(0, 50)}`);
          return { score: 0, reasons: [`English no-story: ${pattern.source}`], reject: true, matchedTopic: 'other_stories' };
        }
      }
      
      // === CONTEXT-AWARE BLACKLIST CHECK ===
      const blacklistPatterns = [
        // Sports - reject only if clearly sports
        { words: ['team', 'coach', 'player', 'match'], requireAlso: ['football', 'soccer', 'basketball', 'game', 'league', 'championship', 'رياضة', 'كرة', 'مباراة'] },
        // Entertainment - reject only if clearly entertainment  
        { words: ['actor', 'actress', 'movie', 'film'], requireAlso: ['hollywood', 'celebrity', 'premiere', 'oscar', 'سينما', 'ممثل'] },
        // Weather
        { words: ['forecast'], requireAlso: ['weather', 'temperature', 'rain', 'storm', 'طقس', 'مطر'] },
        // US Local (always reject)
        { words: ['california', 'texas', 'florida', 'ohio'], requireAlso: [] },
      ];
      
      // Check context-aware blacklist
      for (const rule of blacklistPatterns) {
        const hasBlacklistWord = rule.words.some(w => title.includes(w));
        if (hasBlacklistWord) {
          // If requireAlso is empty, always reject
          if (rule.requireAlso.length === 0) {
            return { score: 0, reasons: [`Blacklisted: ${rule.words[0]}`], reject: true, matchedTopic: 'other_stories' };
          }
          // Otherwise, only reject if context words also present
          const hasContext = rule.requireAlso.some(w => title.includes(w) || content.includes(w));
          if (hasContext) {
            return { score: 0, reasons: [`Blacklisted: ${rule.words[0]} (with context)`], reject: true, matchedTopic: 'other_stories' };
          }
        }
      }
      
      // Also check simple blacklist from DNA config (for other words)
      const blacklist = keywords.blacklist || [];
      for (const word of blacklist) {
        // Skip words already handled by context-aware patterns
        const alreadyHandled = blacklistPatterns.some(rule => rule.words.includes(word.toLowerCase()));
        if (!alreadyHandled && content.includes(word.toLowerCase())) {
          return { score: 0, reasons: [`Blacklisted: ${word}`], reject: true, matchedTopic: 'other_stories' };
        }
      }
      
      // === NO STORY REJECT ===
      const noStoryPatterns = keywords.no_story_reject || [];
      for (const pattern of noStoryPatterns) {
        if (content.includes(pattern.toLowerCase())) {
          score += (weights.no_story_penalty || -35);
          reasons.push(`No story pattern: ${pattern}`);
        }
      }
      
      // === JUST NUMBERS REJECT ===
      const justNumbers = keywords.just_numbers_reject || [];
      for (const pattern of justNumbers) {
        if (content.includes(pattern.toLowerCase())) {
          score += (weights.just_numbers_penalty || -50);
          reasons.push(`Just numbers: ${pattern}`);
        }
      }
      
      // === HIGH ENGAGEMENT BONUS ===
      const highEngagement = keywords.high_engagement || [];
      let engagementMatches = 0;
      for (const word of highEngagement) {
        if (content.includes(word.toLowerCase())) {
          engagementMatches++;
        }
      }
      if (engagementMatches > 0) {
        score += Math.min(engagementMatches * 10, weights.high_engagement_bonus || 40);
        reasons.push(`High engagement keywords: ${engagementMatches}`);
      }
      
      // === MEDIUM ENGAGEMENT BONUS ===
      const mediumEngagement = keywords.medium_engagement || [];
      for (const word of mediumEngagement) {
        if (content.includes(word.toLowerCase())) {
          score += (weights.medium_engagement_bonus || 15);
          reasons.push(`Medium engagement: ${word}`);
          break; // Only count once
        }
      }
      
      // === ARABIC SOURCE BONUS ===
      const arabicSources = keywords.arabic_source_bonus || [];
      for (const source of arabicSources) {
        if ((signal.source || '').toLowerCase().includes(source.toLowerCase())) {
          score += (weights.arabic_source_bonus || 20);
          reasons.push(`Arabic source bonus: ${source}`);
          break;
        }
      }
      
      // === REGIONAL RELEVANCE ===
      const regional = showDna.topics?.regional || [];
      for (const region of regional) {
        if (titleAr.includes(region) || content.includes(region.toLowerCase())) {
          score += (weights.regional_relevance || 10);
          reasons.push(`Regional: ${region}`);
          break;
        }
      }
      
      // === CORE STORIES MATCH ===
      const coreStories = showDna.topics?.core_stories || [];
      for (const story of coreStories) {
        // Check if any word from core story appears in title
        const storyWords = story.split(' ').filter(w => w.length > 3);
        const matches = storyWords.filter(w => titleAr.includes(w) || content.includes(w.toLowerCase()));
        if (matches.length >= 2) {
          score += 25;
          reasons.push(`Core story match: ${story}`);
          break;
        }
      }
      
      // === TOPIC DEFINITION MATCH ===
      for (const topic of (topicDefs || [])) {
        const topicKeywords = topic.keywords || [];
        const topicNameAr = topic.name_ar || '';
        const topicName = topic.name || '';
        
        // Check topic name
        if (titleAr.includes(topicNameAr) || content.includes(topicNameAr.toLowerCase()) || 
            title.includes(topicName.toLowerCase()) || content.includes(topicName.toLowerCase())) {
          score += 20;
          matchedTopic = topic.topic_id;
          reasons.push(`Topic match: ${topicNameAr || topicName}`);
          break;
        }
        
        // Check topic keywords
        for (const kw of topicKeywords) {
          if (typeof kw === 'string' && (titleAr.includes(kw) || content.includes(kw.toLowerCase()))) {
            score += 20;
            matchedTopic = topic.topic_id;
            reasons.push(`Topic keyword match: ${topicNameAr || topicName}`);
            break;
          }
        }
        if (matchedTopic) break;
      }
      
      // === APPLY LEARNED WEIGHTS (from user feedback) ===
      // Learning weights are stored by keyword patterns (e.g., 'الصين', 'ترامب') from extractCoreTopics
      const topicWeights = learningProfile?.topic_weights || {};
      
      // Extract core topics from signal title (same logic as feedback API)
      const extractCoreTopics = (title) => {
        const patterns = [
          'الذكاء الاصطناعي', 'الصين', 'أمريكا', 'ترامب', 'النفط', 'الذهب',
          'الدولار', 'مصر', 'السعودية', 'الإمارات', 'الاستثمار', 'العملات',
          'التضخم', 'البنوك', 'الأسهم', 'العقارات', 'التكنولوجيا', 'تسلا',
          'ماسك', 'بوتين', 'روسيا', 'الحرب', 'التجارة', 'ميتا', 'AI'
        ];
        if (!title) return [];
        return patterns.filter(p => title.includes(p));
      };
      
      // Check learned weights by keyword patterns
      const coreTopics = extractCoreTopics(signal.title || '');
      for (const coreTopic of coreTopics) {
        if (topicWeights[coreTopic]) {
          const weight = topicWeights[coreTopic];
          // weight 1.5 = +10 boost, weight 0.5 = -10 penalty
          const boost = Math.round((weight - 1.0) * 20);
          score += boost;
          reasons.push(`learned_weight:${coreTopic}=${weight.toFixed(2)}`);
        }
      }
      
      // Also check by topic_id if matchedTopic exists
      if (matchedTopic && topicWeights[matchedTopic]) {
        const weight = topicWeights[matchedTopic];
        const boost = Math.round((weight - 1.0) * 20);
        score += boost;
        reasons.push(`learned_weight:topic_id:${matchedTopic}=${weight.toFixed(2)}`);
      }
      
      // Check topic stats (like ratios) for additional boost/penalty
      // Stats are keyed by signal title, so check if any core topics match
      for (const coreTopic of coreTopics) {
        if (topicStats[coreTopic]) {
          const stats = topicStats[coreTopic];
          const likeRatio = stats.likeRatio || 0;
          
          if (likeRatio > 0.6 && stats.total >= 3) {
            // User likes this topic (60%+ like rate with at least 3 interactions)
            score += 15;
            reasons.push(`user_likes:${coreTopic} (${(likeRatio * 100).toFixed(0)}% like rate)`);
          } else if (likeRatio < 0.3 && stats.total >= 3) {
            // User rejects this topic (30% or less like rate with at least 3 interactions)
            score -= 15;
            reasons.push(`user_dislikes:${coreTopic} (${(likeRatio * 100).toFixed(0)}% like rate)`);
          }
        }
      }
      
      // Also check by matchedTopic if it exists in stats
      if (matchedTopic && topicStats[matchedTopic]) {
        const stats = topicStats[matchedTopic];
        const likeRatio = stats.likeRatio || 0;
        
        if (likeRatio > 0.6 && stats.total >= 3) {
          score += 15;
          reasons.push(`user_likes:topic_id:${matchedTopic} (${(likeRatio * 100).toFixed(0)}% like rate)`);
        } else if (likeRatio < 0.3 && stats.total >= 3) {
          score -= 15;
          reasons.push(`user_dislikes:topic_id:${matchedTopic} (${(likeRatio * 100).toFixed(0)}% like rate)`);
        }
      }
      
      // === RECENCY BONUS ===
      const pubDate = new Date(signal.pubDate || signal.detected_at || signal.raw_data?.rssItem?.pubDate || Date.now());
      const hoursOld = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
      if (hoursOld <= 24) {
        score += (weights.recency_24h || 5);
        reasons.push('Fresh: <24h');
      } else if (hoursOld <= 48) {
        score += (weights.recency_48h || 2);
        reasons.push('Recent: <48h');
      }
      
      // Clamp score
      score = Math.max(0, Math.min(100, score));
      
      // Ensure matchedTopic is never null
      if (!matchedTopic) {
        matchedTopic = 'other_stories';
      }
      
      return { 
        score, 
        reasons, 
        reject: score < (showDna.benchmarks?.min_score || 35),
        matchedTopic
      };
    };

    let totalImported = 0;
    const newSignals = [];
    const allItemUrls = []; // Collect all URLs first for batch duplicate check
    const failedFeeds = []; // Track failed feeds for reporting

    // Step 1: Fetch all RSS feeds with retry logic and graceful error handling
    console.log(`Fetching ${sources.length} RSS feeds...`);
    
    // Process feeds with Promise.allSettled to handle failures gracefully
    const feedResults = await Promise.allSettled(
      sources.map(async (source) => {
        try {
          console.log(`📡 Fetching RSS feed: ${source.name}`);
          const result = await fetchRssFeedWithRetry(source.url, source.name, 2);
          
          if (result.success && result.feed) {
            // Increase item_limit for English sources (detected by 'hl=en' in URL)
            const isEnglishSource = source.url.includes('hl=en');
            const itemLimit = isEnglishSource ? 30 : (source.item_limit || 20);
            const items = result.feed.items?.slice(0, itemLimit) || [];
            
            for (const item of items) {
              if (item.link) {
                allItemUrls.push({
                  url: item.link,
                  source: source,
                  item: item
                });
              }
            }

            // Update last fetched timestamp
            await supabaseAdmin
              .from('signal_sources')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', source.id);

            console.log(`  ✅ ${source.name}: ${items.length} items${isEnglishSource ? ' (English source, limit: 30)' : ''}`);
            console.log(`📰 Fetched from ${source.name}: ${items.length} items`);
            return { success: true, source: source.name, itemCount: items.length };
          } else {
            // Feed fetch failed after retries
            const errorMsg = result.error || 'Unknown error';
            console.log(`  ❌ ${source.name}: Failed - ${errorMsg}`);
            failedFeeds.push({
              name: source.name,
              url: source.url,
              error: errorMsg
            });
            errors.push({ 
              source: source.name, 
              error: errorMsg,
              url: source.url
            });
            return { success: false, source: source.name, error: errorMsg };
          }
        } catch (feedError) {
          const errorMsg = feedError.message || feedError.toString();
          console.error(`  ❌ ${source.name}: Failed - ${errorMsg}`);
          failedFeeds.push({
            name: source.name,
            url: source.url,
            error: errorMsg
          });
          errors.push({ 
            source: source.name, 
            error: errorMsg,
            url: source.url
          });
          return { success: false, source: source.name, error: errorMsg };
        }
      })
    );

    // Log summary
    let successfulFeeds = feedResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    let failedCount = feedResults.length - successfulFeeds;
    console.log(`\n📊 Feed fetch summary: ${successfulFeeds} succeeded, ${failedCount} failed`);

    // Step 2: Process all RSS items into signals (no URL duplicate check here - will check by title later)
    console.log(`Found ${allItemUrls.length} total items from RSS feeds`);
    
    for (const { url, source, item } of allItemUrls) {
      if (!item.title) continue; // Skip items without titles
      
      // Validate showId is a UUID
      if (!showId || typeof showId !== 'string' || !showId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error(`Invalid showId: ${showId}`);
        continue;
      }
      
      // Validate source.id exists
      if (!source.id || (typeof source.id !== 'number' && typeof source.id !== 'string')) {
        console.error(`Invalid source.id for source "${source.name}": ${source.id}`);
        continue;
      }
      
      newSignals.push({
        show_id: showId,
        title: item.title,
        description: item.contentSnippet || item.content?.substring(0, 500),
        url: item.link || url,
        source_id: null,
        source: source.name,
        type: 'news',
        category: source.category || 'News',
        score: 50,
        status: 'new',
        is_visible: true,
        raw_data: {
          sourceName: source.name,
          sourceId: source.id,
          rssItem: {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            content: item.content,
            contentSnippet: item.contentSnippet
          }
        },
        detected_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    }
    
    console.log(`📥 Processed ${newSignals.length} signals from RSS feeds`);


    // Apply quality filters before inserting
    console.log(`\n🔍 Applying quality filters to ${newSignals.length} signals...`);
    
    // STEP 1: Log raw fetched signals
    console.log(`📥 STEP 1 - Raw fetched: ${newSignals.length} signals`);
    const sourceCounts = {};
    for (const signal of newSignals) {
      const sourceName = signal.source || 'Unknown';
      sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    }
    for (const [sourceName, count] of Object.entries(sourceCounts)) {
      console.log(`   - ${sourceName}: ${count} items`);
    }
    
    // ===== FILTER 1: Low Quality Source Filter =====
    // Only filter out true low quality sources: press release distributors, content farms, listicle sites
    const LOW_QUALITY_SOURCES = [
      'vocal.media',        // Content farm
      'openpr.com',         // Press release distributor
      'meyka',              // Content farm
      'prnewswire',         // Press release distributor
      'businesswire',       // Press release distributor
      'globenewswire',      // Press release distributor
      'travel and tour world', // Low quality travel content
      'accesswire',         // Press release distributor
      '24/7 wall st'        // Listicle site with no original reporting
      // Note: 'we are the mighty' removed - legitimate military analysis site
    ];
    
    const filterLowQuality = (signals) => {
      return signals.filter(signal => {
        const text = `${signal.title} ${signal.source || ''}`.toLowerCase();
        for (const bad of LOW_QUALITY_SOURCES) {
          if (text.includes(bad)) {
            console.log(`🗑️ Low quality source: ${signal.title.substring(0, 50)}`);
            return false;
          }
        }
        return true;
      });
    };
    
    let filteredSignals = filterLowQuality(newSignals);
    console.log(`  ✅ After low quality filter: ${filteredSignals.length} signals (removed ${newSignals.length - filteredSignals.length})`);
    
    // Helper function to check title similarity
    const isSimilarTitle = (title1, title2) => {
      if (!title1 || !title2) return false;
      const t1 = title1.toLowerCase().trim();
      const t2 = title2.toLowerCase().trim();
      if (t1 === t2) return true;
      // Simple similarity check - skip if first 50 chars match
      return t1.substring(0, 50) === t2.substring(0, 50);
    };

    // Filter 2: Remove old items (>48 hours) - stricter time window
    const beforeAgeFilter = filteredSignals.length;
    const ageRejections = [];
    const now = Date.now();
    filteredSignals = filteredSignals.filter(signal => {
      // Check detected_at first (primary date field), then fallback to raw_data
      const dateStr = signal.detected_at || signal.raw_data?.rssItem?.pubDate;
      if (!dateStr) {
        // If no date, check if it's a very recent creation (within last hour)
        const createdDate = new Date(signal.created_at || signal.detected_at);
        const hoursAgo = (now - createdDate.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 1) {
          ageRejections.push({ title: signal.title, reason: 'no_date_or_too_old', hoursAgo });
          return false;
        }
        return true;
      }
      try {
        const pubDate = new Date(dateStr);
        if (isNaN(pubDate.getTime())) {
          ageRejections.push({ title: signal.title, reason: 'invalid_date' });
          return false;
        }
        const hoursAgo = (now - pubDate.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 48) {
          ageRejections.push({ title: signal.title, reason: 'too_old', hoursAgo: Math.round(hoursAgo) });
          return false;
        }
        return true;
      } catch (e) {
        ageRejections.push({ title: signal.title, reason: 'date_parse_error' });
        return false;
      }
    });
    console.log(`  ✅ After age filter (≤48h): ${filteredSignals.length} signals (removed ${beforeAgeFilter - filteredSignals.length})`);
    if (ageRejections.length > 0 && ageRejections.length <= 10) {
      console.log(`   🗑️ Age rejections (sample):`);
      ageRejections.slice(0, 5).forEach(r => {
        console.log(`      - "${(r.title || '').substring(0, 50)}..." (${r.reason}${r.hoursAgo ? `, ${r.hoursAgo}h old` : ''})`);
      });
    }

    // Filter 3: Remove short titles (<40 chars) and very long titles (likely spam)
    const beforeLengthFilter = filteredSignals.length;
    const lengthRejections = [];
    filteredSignals = filteredSignals.filter(signal => {
      if (!signal.title) {
        lengthRejections.push({ title: '(no title)', reason: 'missing_title' });
        return false;
      }
      const titleLen = signal.title.trim().length;
      if (titleLen < 40) {
        lengthRejections.push({ title: signal.title, reason: 'too_short', length: titleLen });
        return false;
      }
      if (titleLen > 200) {
        lengthRejections.push({ title: signal.title, reason: 'too_long', length: titleLen });
        return false;
      }
      return true;
    });
    console.log(`  ✅ After length filter (40-200 chars): ${filteredSignals.length} signals (removed ${beforeLengthFilter - filteredSignals.length})`);
    if (lengthRejections.length > 0 && lengthRejections.length <= 10) {
      console.log(`   🗑️ Length rejections (sample):`);
      lengthRejections.slice(0, 5).forEach(r => {
        console.log(`      - "${(r.title || '').substring(0, 50)}..." (${r.reason}, ${r.length || 0} chars)`);
      });
    }

    // Filter 4: Deduplicate similar titles (basic)
    const seenTitles = new Set();
    filteredSignals = filteredSignals.filter(signal => {
      if (!signal.title) return false;
      const normalizedTitle = signal.title.toLowerCase().trim().substring(0, 50);
      
      // Check if similar to any seen title
      for (const seenTitle of seenTitles) {
        if (isSimilarTitle(normalizedTitle, seenTitle)) {
          return false; // Skip duplicate
        }
      }
      
      seenTitles.add(normalizedTitle);
      return true;
    });
    console.log(`  ✅ After deduplication: ${filteredSignals.length} signals`);

    // ===== FILTER 4.5: Quality Scoring (content-based, no AI) =====
    const calculateQualityScore = (signal) => {
      let score = 50; // Base score
      const title = signal.title || '';
      const titleLower = title.toLowerCase();
      const text = title + ' ' + (signal.description || '');
      
      // ===== BOOSTS =====
      
      // +15: Has specific numbers (great for hooks)
      if (/\$[\d,.]+|\d+%|\d+\s*(مليون|مليار|billion|million|thousand)|\d{2,}/.test(text)) {
        score += 15;
      }
      
      // +10: Question format (engagement)
      if (/\?|؟|هل |لماذا |كيف |ما الذي|why |how |what |will /i.test(title)) {
        score += 10;
      }
      
      // +10: Strong action/hook words
      if (/collapse|crash|surge|soar|plunge|record|breaking|secret|reveals|exposes|war|crisis|انهيار|صعود|انفجار|قياسي|يكشف|سري|حرب|أزمة/i.test(title)) {
        score += 10;
      }
      
      // +10: Premium sources
      if (/financial times|economist|bloomberg|reuters|wall street journal|nyt|new york times/i.test(signal.source || title)) {
        score += 10;
      }
      
      // +5: Arabic trusted sources
      if (/الجزيرة|العربية|سكاي نيوز|الشرق|بلومبرغ/.test(signal.source || title)) {
        score += 5;
      }
      
      // ===== PENALTIES =====
      
      // -20: Clickbait patterns
      if (/you won't believe|shocking truth|amazing|incredible|this is why|here's why|what happens next/i.test(title)) {
        score -= 20;
      }
      
      // -15: Too short title (incomplete)
      if (title.length < 30) {
        score -= 15;
      }
      
      // -10: Too long title (cluttered)
      if (title.length > 150) {
        score -= 10;
      }
      
      // -15: Listicles
      if (/^\d+\s+(things|ways|reasons|tips|stocks)|top \d+|best \d+|worst \d+/i.test(title)) {
        score -= 15;
      }
      
      // -10: Just price movement (no story)
      if (/stock (rises|falls|drops|surges)|shares (up|down)|price (rises|falls)/i.test(titleLower) && 
          !/why|how|because|crisis|crash|record/.test(titleLower)) {
        score -= 10;
      }
      
      // -10: Routine reports
      if (/quarterly|Q[1-4] 202|earnings report|beats estimates|misses estimates/i.test(title)) {
        score -= 10;
      }
      
      return Math.max(0, Math.min(100, score));
    };
    
    // Calculate quality score for each signal
    filteredSignals = filteredSignals.map(signal => ({
      ...signal,
      quality_score: calculateQualityScore(signal)
    }));
    
    // Filter by minimum quality (remove noise)
    const minQuality = 35;
    const beforeQualityFilter = filteredSignals.length;
    filteredSignals = filteredSignals.filter(s => s.quality_score >= minQuality);
    console.log(`  ✅ After quality filter (min ${minQuality}): ${filteredSignals.length} signals (removed ${beforeQualityFilter - filteredSignals.length})`);

    // Filter 5: DNA scoring filter (using show_dna rules + learning profile)
    const beforeDnaFilter = filteredSignals.length;
    const signalsBeforeDna = [...filteredSignals]; // Keep copy for rejection analysis
    
    // Score all signals with DNA + learning profile
    const scoredSignals = filteredSignals.map(signal => {
      const result = scoreSignalWithDNA(signal, showDna, topicDefs, learningProfile, topicStats);
      return {
        ...signal,
        relevance_score: result.score,
        matched_topic: result.matchedTopic,
        dna_reasons: result.reasons,
        _reject: result.reject
      };
    });
    
    // Filter out rejected signals
    filteredSignals = scoredSignals.filter(s => !s._reject);
    const signalsAfterDna = [...filteredSignals]; // Keep copy for rejection analysis

    // Ensure matched_topic is always a valid DNA topic or "other_stories"
    const validTopics = new Set((topicDefs || []).map(t => t.topic_id));
    filteredSignals = filteredSignals.map(s => {
      if (!s.matched_topic || !validTopics.has(s.matched_topic)) {
        return { ...s, matched_topic: 'other_stories' };
      }
      return s;
    });
    
    // Sort by score (no limit yet - will limit after deduplication and balance)
    filteredSignals = filteredSignals.sort((a, b) => b.relevance_score - a.relevance_score);
    
    console.log(`  ✅ After DNA scoring filter: ${filteredSignals.length} signals (removed ${beforeDnaFilter - filteredSignals.length})`);
    
    // ===========================================
    // DETAILED REJECTION ANALYSIS
    // ===========================================
    console.log(`\n📊 REJECTION ANALYSIS:`);
    
    // DNA Filter Rejections
    const rejectedByDna = scoredSignals.filter(s => s._reject);
    if (rejectedByDna.length > 0) {
      console.log(`\n🧬 DNA Filter rejected ${rejectedByDna.length} signals:`);
      rejectedByDna.slice(0, 15).forEach(s => {
        const minScore = showDna?.benchmarks?.min_score || 35;
        console.log(`   ❌ "${(s.title || '').substring(0, 60)}..."`);
        console.log(`      Score: ${s.relevance_score} (min: ${minScore})`);
        console.log(`      Reasons: ${(s.dna_reasons || []).join(', ') || 'N/A'}`);
        console.log(`      Matched Topic: ${s.matched_topic || 'none'}`);
        console.log(`      Source: ${s.source || 'unknown'}`);
      });
      if (rejectedByDna.length > 15) {
        console.log(`   ... and ${rejectedByDna.length - 15} more rejected by DNA filter`);
      }
    } else {
      console.log(`\n🧬 DNA Filter: No signals rejected (all passed)`);
    }
    
    // Log top matches
    if (filteredSignals.length > 0) {
      console.log(`  🎯 Top DNA matches:`);
      filteredSignals.slice(0, 3).forEach(s => {
        console.log(`     ✓ "${(s.title || '').substring(0, 50)}..." (score: ${s.relevance_score}, topic: ${s.matched_topic || 'none'})`);
      });
    }

    // Filter 6: Add negative keyword filter (exclude irrelevant content)
    const negativeKeywords = [
      'sports', 'football', 'soccer', 'basketball', 'nfl', 'nba', 'fifa',
      'celebrity', 'gossip', 'entertainment', 'movie', 'tv show', 'music',
      'weather', 'forecast', 'storm', 'hurricane', 'earthquake',
      'recipe', 'cooking', 'food', 'restaurant', 'recipe',
      'fashion', 'beauty', 'makeup', 'style',
      'horoscope', 'zodiac', 'astrology',
      'local news', 'city council', 'mayor', 'governor race',
      'crime', 'murder', 'shooting', 'arrest',
      'sport', 'رياضة', 'كرة قدم', 'مباراة', 'فريق', 'لاعب'
    ];
    
    const beforeNegativeFilter = filteredSignals.length;
    filteredSignals = filteredSignals.filter(signal => {
      if (!signal.title) return false;
      const titleLower = signal.title.toLowerCase();
      const descriptionLower = (signal.description || '').toLowerCase();
      const searchText = titleLower + ' ' + descriptionLower;
      
      // Reject if contains negative keywords
      return !negativeKeywords.some(negKeyword => searchText.includes(negKeyword));
    });
    if (beforeNegativeFilter > filteredSignals.length) {
      console.log(`  ✅ After negative keyword filter: ${filteredSignals.length} signals (removed ${beforeNegativeFilter - filteredSignals.length})`);
    }

    // Filter 7: Reject "no story" patterns (Arabic + English)
    const rejectIfContains = [
      // Arabic patterns - Aggregator metadata (MUST REJECT)
      'تم العثور على',    // "X news found about Y" - aggregator metadata, not real headlines
      'تم العثور',        // "Found" - aggregator pattern
      'أخبار \'',         // "news '" - aggregator pattern
      'على \d+ أخبار',    // "on X news" - aggregator pattern
      
      // Arabic patterns - Routine/no story
      'تكريم',           // Award ceremony
      'يواصل النمو',      // Continues to grow (routine)
      'يواصل الارتفاع',   // Continues to rise (routine)
      'يواصل التراجع',    // Continues to fall (routine)
      'يتعهدان',         // They pledge (no action)
      'تتعهد',           // Pledges (no action)
      'يتعهد',           // Pledges (no action)
      'يعدل توقعاته',     // Adjusts forecast (boring)
      'نحو تعلم',        // Towards learning (generic)
      'ارتفاع حاد لمستويات', // Sharp rise in levels (just numbers)
      'انخفاض حاد',      // Sharp drop (just numbers)
      'افتتاح',          // Opening ceremony
      'تدشين',           // Inauguration
      'يستقبل',          // Receives (meeting)
      'يلتقي',           // Meets with
      
      // Routine diplomatic news
      'يوقع اتفاقيات',     // "Signs agreements" - routine diplomatic
      'يوقع اتفاقية',      // "Signs agreement"
      'اتفاقيات جديدة',    // "New agreements"
      'يوقع مذكرة',       // "Signs memorandum"
    ];
    
    // English reject patterns (regex) - reject low quality signals
    const rejectPatterns = [
      /stock\s+(surges?|falls?|drops?|rises?)/i,
      /shares\s+(up|down|rise|fall)/i,
      /\btoday:/i,
      /approval\s+(rating|mixed)/i,
      /how\s+to\s+attract/i,
      /open\s+interest/i,
      /opening\s+trade/i,
      /closing\s+bell/i,
      /press\s+release/i,
      /openpr\.com/i,
      /\|\s*\d{1,2}\/\d{1,2}\/\d{4}/,  // "| 1/5/2026" date suffix
      /january\s+\d{1,2}:|february\s+\d{1,2}:|march\s+\d{1,2}:|april\s+\d{1,2}:|may\s+\d{1,2}:|june\s+\d{1,2}:|july\s+\d{1,2}:|august\s+\d{1,2}:|september\s+\d{1,2}:|october\s+\d{1,2}:|november\s+\d{1,2}:|december\s+\d{1,2}:/i, // Daily summaries like "January 05:"
      /new\s+world\s+order/i, // TV show titles
    ];

    const beforeNoStoryFilter = filteredSignals.length;
    const signalsBeforePattern = [...filteredSignals]; // Keep copy for rejection analysis
    const patternRejections = []; // Track what was rejected and why
    
    filteredSignals = filteredSignals.filter(signal => {
      const title = signal.title || '';
      let rejectionReason = null;
      
      // Reject titles starting with percentage increase/decrease
      if (/^بزيادة \d/.test(title) || /^بانخفاض \d/.test(title) || /^بنسبة \d/.test(title)) {
        rejectionReason = 'starts_with_percentage';
        patternRejections.push({ title, reason: rejectionReason, pattern: 'percentage prefix' });
        return false;
      }
      
      // Check string patterns - actually reject
      for (const pattern of rejectIfContains) {
        if (title.includes(pattern)) {
          rejectionReason = `arabic_pattern:${pattern}`;
          patternRejections.push({ title, reason: rejectionReason, pattern });
          return false;
        }
      }
      
      // Check regex patterns - actually reject
      for (const pattern of rejectPatterns) {
        if (pattern.test(title)) {
          rejectionReason = `regex_pattern:${pattern.source}`;
          patternRejections.push({ title, reason: rejectionReason, pattern: pattern.source });
          return false;
        }
      }
      
      return true;
    });
    const signalsAfterPattern = [...filteredSignals]; // Keep copy for rejection analysis
    
    if (beforeNoStoryFilter > filteredSignals.length) {
      console.log(`  ✅ After "no story" pattern filter: ${filteredSignals.length} signals (removed ${beforeNoStoryFilter - filteredSignals.length})`);
    }
    
    // ===========================================
    // PATTERN REJECTION ANALYSIS
    // ===========================================
    if (patternRejections.length > 0) {
      console.log(`\n🚫 Pattern Filter rejected ${patternRejections.length} signals:`);
      patternRejections.slice(0, 15).forEach(r => {
        console.log(`   ❌ "${(r.title || '').substring(0, 60)}..."`);
        console.log(`      Pattern: ${r.pattern}`);
        console.log(`      Reason: ${r.reason}`);
      });
      if (patternRejections.length > 15) {
        console.log(`   ... and ${patternRejections.length - 15} more rejected by pattern filter`);
      }
      
      // Group rejections by pattern type
      const patternGroups = {};
      patternRejections.forEach(r => {
        const patternType = r.reason.split(':')[0] || 'unknown';
        if (!patternGroups[patternType]) {
          patternGroups[patternType] = [];
        }
        patternGroups[patternType].push(r);
      });
      
      console.log(`\n📊 Pattern rejection breakdown:`);
      Object.entries(patternGroups).forEach(([type, items]) => {
        console.log(`   - ${type}: ${items.length} signals`);
      });
    } else {
      console.log(`\n🚫 Pattern Filter: No signals rejected (all passed)`);
    }
    
    // STEP 2 & 3: Log after reject patterns
    const arabicAfterReject = filteredSignals.filter(s => /[\u0600-\u06FF]/.test(s.title || '')).length;
    const englishAfterReject = filteredSignals.length - arabicAfterReject;
    console.log(`📥 STEP 2 - After Arabic reject patterns: ${filteredSignals.length} signals`);
    console.log(`📥 STEP 3 - After English reject patterns: ${filteredSignals.length} signals`);
    console.log(`   - Arabic: ${arabicAfterReject}, English: ${englishAfterReject}`);

    // Filter 8: Smart Story Deduplication (improved - catches same story from different sources)
    // Remove source suffix from title for comparison
    const extractCoreTitle = (title) => {
      return (title || '')
        .replace(/\s*[-–—|]\s*[^-–—|]+$/, '') // Remove " - Source Name"
        .replace(/\s*\([^)]+\)\s*$/, '')       // Remove "(Source)" at end
        .trim()
        .toLowerCase()
        .substring(0, 60);
    };
    
    // Check if two signals are about the same story
    const isSameStory = (title1, title2) => {
      const core1 = extractCoreTitle(title1);
      const core2 = extractCoreTitle(title2);
      
      // Exact match
      if (core1 === core2) return true;
      
      // High word overlap (70%+)
      const words1 = core1.split(/\s+/).filter(w => w.length > 3);
      const words2 = core2.split(/\s+/).filter(w => w.length > 3);
      
      if (words1.length < 3 || words2.length < 3) return false;
      
      const overlap = words1.filter(w => words2.includes(w)).length;
      const similarity = overlap / Math.min(words1.length, words2.length);
      
      return similarity >= 0.7;
    };
    
    // Deduplicate keeping highest quality version
    const deduplicateStories = (signals) => {
      const groups = [];
      
      for (const signal of signals) {
        let addedToGroup = false;
        
        for (const group of groups) {
          if (isSameStory(signal.title, group[0].title)) {
            group.push(signal);
            addedToGroup = true;
            break;
          }
        }
        
        if (!addedToGroup) {
          groups.push([signal]);
        }
      }
      
      // Keep best from each group (highest combined score)
      const deduped = groups.map(group => {
        if (group.length === 1) return group[0];
        
        // Sort by combined score, keep best
        group.sort((a, b) => {
          const scoreA = (a.quality_score || 50) + (a.relevance_score || 50);
          const scoreB = (b.quality_score || 50) + (b.relevance_score || 50);
          return scoreB - scoreA;
        });
        
        console.log(`📰 Story group: kept "${group[0].title.substring(0, 40)}..." from ${group.length} versions`);
        return group[0];
      });
      
      console.log(`🔄 Story dedup: ${signals.length} → ${deduped.length} unique stories`);
      return deduped;
    };

    // Helper: apply source-based weight to a score if we have learned source weights
    const applySourceWeight = (signal, score) => {
      const sourceName = (signal.source || '').toLowerCase().trim();
      const sourceData = sourceWeights[sourceName];
      
      if (sourceData && sourceData.weight) {
        const adjusted = score * sourceData.weight;
        if (sourceData.weight < 0.8) {
          console.log(`📉 Source penalty: "${sourceName}" (${sourceData.weight.toFixed(2)})`);
        } else if (sourceData.weight > 1.2) {
          console.log(`📈 Source boost: "${sourceName}" (${sourceData.weight.toFixed(2)})`);
        }
        return adjusted;
      }
      
      return score;
    };

    // Filter 8: Story-level deduplication with learning (after DNA scoring, before language balance)
    const beforeDupFilter = filteredSignals.length;
    
    // Calculate combined score before deduplication (so we keep best version),
    // then apply source weight if available
    filteredSignals = filteredSignals.map(s => {
      const baseCombined = ((s.quality_score || 50) * 0.4) + ((s.relevance_score || 50) * 0.6);
      const weightedCombined = applySourceWeight(s, baseCombined);
      return {
        ...s,
        combined_score: weightedCombined
      };
    });
    
    // Group signals into stories using fast keyword-based grouping
    console.log(`📰 Grouping ${filteredSignals.length} signals into stories...`);
    const storyGroups = await groupSignalsByStory(filteredSignals, 0.55, {
      maxSignals: 200,  // Process up to 200 signals
      timeoutMs: 30000, // 30 second timeout (fallback only)
      useFastGrouping: true // Use fast keyword-based grouping
    });
    
    // Convert to format expected by selectBestFromStories
    // Generate signatures for anchor signals to extract entities/action
    const { generateStorySignature } = await import('@/lib/storySignature');
    const stories = await Promise.all(
      storyGroups.map(async (group, idx) => {
        const anchor = group.representativeSignal || group.signals[0];
        // Generate signature for anchor to get entities/action
        const signature = await generateStorySignature(anchor);
        
        // Extract entities as array (legacy format expected by selectBestFromStories)
        // generateStorySignature returns: topics, people, countries as direct arrays (for backward compatibility)
        const entities = [
          ...(signature.topics || []),
          ...(signature.countries || []),
          ...(signature.people || [])
        ];
        
        return {
          id: group.id || `story_${idx}`,
          anchor: anchor,
          signals: group.signals,
          entities: entities,
          action: signature.action || 'general',
          count: group.count || group.signals.length
        };
      })
    );
    
    console.log(`📚 Found ${stories.length} unique stories`);
    
    // Log big stories (for debugging)
    const bigStories = stories.filter(s => s.signals.length > 3);
    if (bigStories.length > 0) {
      console.log(`🔥 Big stories detected:`);
      bigStories.forEach(s => {
        const entities = Array.isArray(s.entities) ? s.entities : [];
        console.log(`   - ${entities.slice(0, 3).join(', ')} (${s.action}): ${s.signals.length} signals`);
      });
    }
    
    // Select best 2-3 from each story (max 3 per story)
    const maxPerStory = 3;
    filteredSignals = selectBestFromStories(stories, maxPerStory);
    console.log(`  ✅ After story deduplication: ${filteredSignals.length} signals (removed ${beforeDupFilter - filteredSignals.length})`);
    
    // Sort by combined score after deduplication
    filteredSignals.sort((a, b) => (b.combined_score || 0) - (a.combined_score || 0));
    
    // Filter 9: Language balance (enforce 40% Arabic, 60% English, max 30 total)
    const balanceLanguages = (signals, arabicRatio = 0.4, maxTotal = 30) => {
      const arabic = signals.filter(s => /[\u0600-\u06FF]/.test(s.title));
      const english = signals.filter(s => !/[\u0600-\u06FF]/.test(s.title));
      
      // Sort by combined score
      arabic.sort((a, b) => (b.combined_score || 0) - (a.combined_score || 0));
      english.sort((a, b) => (b.combined_score || 0) - (a.combined_score || 0));
      
      // Calculate targets
      const arabicTarget = Math.ceil(maxTotal * arabicRatio); // 12 Arabic
      const englishTarget = maxTotal - arabicTarget; // 18 English
      
      const finalArabic = arabic.slice(0, arabicTarget);
      const finalEnglish = english.slice(0, englishTarget);
      
      console.log(`📊 Balance: ${finalArabic.length} Arabic, ${finalEnglish.length} English`);
      
      return [...finalArabic, ...finalEnglish]
        .sort((a, b) => (b.combined_score || 0) - (a.combined_score || 0));
    };
    
    const beforeBalance = filteredSignals.length;
    filteredSignals = balanceLanguages(filteredSignals, 0.4, 30);
    console.log(`  ✅ After language balance: ${filteredSignals.length} signals (removed ${beforeBalance - filteredSignals.length})`);
    
    // Log final language split
    const arabicCount = filteredSignals.filter(s => /[\u0600-\u06FF]/.test(s.title || '')).length;
    const englishCount = filteredSignals.length - arabicCount;
    console.log(`📊 Final language split: ${arabicCount} Arabic (${filteredSignals.length > 0 ? ((arabicCount / filteredSignals.length) * 100).toFixed(0) : 0}%), ${englishCount} English (${filteredSignals.length > 0 ? ((englishCount / filteredSignals.length) * 100).toFixed(0) : 0}%)`);

    // ===== AUDIENCE DEMAND SCORING =====
    // Calculate audience demand for each signal using show's own YouTube data
    console.log(`\n📊 Calculating audience demand scores...`);
    try {
      // Fetch show's audience data once (for performance)
      const showAudienceData = await getShowAudienceData(showId);
      console.log(`   Loaded: ${showAudienceData.videoCount} videos, ${showAudienceData.audienceQuestions.length} questions, ${showAudienceData.competitorVideos.length} competitor videos`);
      
      // Calculate audience demand for each signal
      for (const signal of filteredSignals) {
        try {
          const demand = await calculateAudienceDemand(signal, showId, showAudienceData);
          
          signal.audience_demand_score = demand.demandScore;
          signal.audience_evidence = demand.evidence;
          signal.demand_summary = demand.summary;
          
          // Add audience demand to final score
          const baseScore = signal.combined_score || signal.relevance_score || 50;
          signal.final_score = Math.min(100, baseScore + demand.demandScore);
          
          if (demand.demandScore > 0) {
            console.log(`   ✅ "${signal.title.substring(0, 40)}...": +${demand.demandScore} demand (${demand.summary})`);
          }
        } catch (demandError) {
          console.error(`   ⚠️ Error calculating demand for signal:`, demandError);
          // Continue with other signals even if one fails
          signal.audience_demand_score = 0;
          signal.audience_evidence = [];
          signal.demand_summary = 'No Data';
          signal.final_score = signal.combined_score || signal.relevance_score || 50;
        }
      }
      
      // Re-sort by final score (now includes audience demand)
      filteredSignals.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
      console.log(`   ✅ Audience demand scoring complete`);
    } catch (audienceError) {
      console.error('⚠️ Error in audience demand scoring:', audienceError);
      // Continue without audience demand if it fails
      filteredSignals.forEach(s => {
        s.audience_demand_score = 0;
        s.audience_evidence = [];
        s.demand_summary = 'No Data';
        s.final_score = s.combined_score || s.relevance_score || 50;
      });
    }

    // ============================================
    // COMPETITOR BREAKOUT BOOST
    // ============================================
    console.log('🔥 Starting competitor boost calculation...');
    try {
      const { breakouts: competitorBreakouts } = await getCompetitorBreakouts(showId);
      console.log(`🔥 Found ${competitorBreakouts.length} competitor breakouts`);

      if (competitorBreakouts.length > 0) {
        for (const signal of filteredSignals) {
          try {
            // UPDATED: calculateCompetitorBoost is now async (uses universal topic intelligence)
            const { boost, evidence } = await calculateCompetitorBoost(signal, competitorBreakouts);
            
            if (boost > 0) {
              console.log(`📊 Signal "${signal.title.substring(0, 40)}..." → Competitor boost: +${boost}`);
              signal.competitor_boost = boost;
              signal.competitor_evidence = evidence;
              
              // DON'T merge into audience_evidence - keep them separate to avoid duplicates
              
              // Add competitor boost to final score
              const currentFinal = signal.final_score || signal.combined_score || signal.relevance_score || 50;
              signal.final_score = Math.min(100, currentFinal + boost);
            } else {
              signal.competitor_boost = 0;
              signal.competitor_evidence = [];
            }
          } catch (boostError) {
            console.error(`   ⚠️ Error calculating competitor boost for signal:`, boostError);
            signal.competitor_boost = 0;
            signal.competitor_evidence = [];
          }
        }
        
        // Re-sort by final score (now includes competitor boost)
        filteredSignals.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
        console.log(`   ✅ Competitor boost calculation complete`);
      } else {
        console.log(`   ℹ️ No competitor breakouts found, skipping boost`);
        // Initialize competitor fields even if no breakouts
        filteredSignals.forEach(s => {
          s.competitor_boost = 0;
          s.competitor_evidence = [];
        });
      }
    } catch (competitorError) {
      console.error('⚠️ Error in competitor boost calculation:', competitorError);
      // Continue without competitor boost if it fails
      filteredSignals.forEach(s => {
        s.competitor_boost = 0;
        s.competitor_evidence = [];
      });
    }

    // Log top 5 signals for debugging
    if (filteredSignals.length > 0) {
      console.log(`\n🏆 Top 5 signals (with audience demand + competitor boost):`);
      filteredSignals.slice(0, 5).forEach((s, i) => {
        const demand = s.audience_demand_score || 0;
        const competitor = s.competitor_boost || 0;
        console.log(`   ${i+1}. [Q:${s.quality_score || 50} D:${s.relevance_score || 50} A:${demand} C:${competitor} F:${(s.final_score || 50).toFixed(0)}] ${s.title.substring(0, 50)}...`);
      });
    }

    // ===========================================
    // FINAL REJECTION SUMMARY
    // ===========================================
    console.log(`\n📊 FINAL REJECTION SUMMARY:`);
    console.log(`   Raw fetched: ${newSignals.length} signals`);
    console.log(`   After all filters: ${filteredSignals.length} signals`);
    console.log(`   Total rejected: ${newSignals.length - filteredSignals.length} signals`);
    console.log(`   Rejection rate: ${((newSignals.length - filteredSignals.length) / newSignals.length * 100).toFixed(1)}%`);
    
    // Show source breakdown of final signals
    const finalSourceBreakdown = {};
    filteredSignals.forEach(s => {
      const source = s.source || 'Unknown';
      finalSourceBreakdown[source] = (finalSourceBreakdown[source] || 0) + 1;
    });
    console.log(`\n📊 Final signals by source:`);
    Object.entries(finalSourceBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([source, count]) => {
        console.log(`   - ${source}: ${count} signals`);
      });
    
    console.log(`\n📊 Final result: ${newSignals.length} → ${filteredSignals.length} signals (removed ${newSignals.length - filteredSignals.length})`);

    // Insert filtered signals (without AI enrichment - can be enriched later via "Enrich" button)
    // AI enrichment is skipped during refresh to make it faster
    // Users can enrich individual signals using the "Enrich with AI" button in the UI
    console.log(`Inserting ${filteredSignals.length} filtered signals (without AI enrichment)...`);
    if (filteredSignals.length > 0) {
      // ===== IN-MEMORY DEDUPLICATION (within current batch) =====
      const deduplicateInBatch = (signals) => {
        const seen = new Set();
        return signals.filter(signal => {
          if (!signal.title) return false;
          const key = signal.title.substring(0, 50).toLowerCase().trim();
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      };
      
      const batchDeduped = deduplicateInBatch(filteredSignals);
      console.log(`🔄 Batch dedup: ${filteredSignals.length} → ${batchDeduped.length}`);
      
      // ===== DATABASE DEDUPLICATION (check against existing signals) =====
      const checkDuplicates = async (signals, showId) => {
        // Get existing signal titles from last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const { data: existingSignals, error } = await supabaseAdmin
          .from('signals')
          .select('title')
          .eq('show_id', showId)
          .gte('created_at', sevenDaysAgo);
        
        if (error) {
          console.error('Error fetching existing signals:', error);
          return signals; // Return all if check fails
        }
        
        // Create set of existing title prefixes (first 50 chars)
        const existingTitles = new Set(
          (existingSignals || []).map(s => 
            s.title?.substring(0, 50).toLowerCase().trim()
          ).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingTitles.size} existing signals in database`);
        
        // Filter out duplicates
        const uniqueSignals = signals.filter(signal => {
          if (!signal.title) return false;
          const titleKey = signal.title.substring(0, 50).toLowerCase().trim();
          if (existingTitles.has(titleKey)) {
            return false; // Skip duplicate
          }
          return true;
        });
        
        console.log(`🔄 Database dedup: ${signals.length} → ${uniqueSignals.length} new signals`);
        
        return uniqueSignals;
      };
      
      const uniqueSignals = await checkDuplicates(batchDeduped, showId);
      
      // STEP 6: Log before insert
      console.log(`📥 STEP 6 - Final before insert: ${uniqueSignals.length} signals`);
      
      // Only insert if there are new signals
      if (uniqueSignals.length === 0) {
        console.log('No new signals to add (all duplicates)');
        
        // IMPORTANT: Increment usage even if no new signals (refresh was attempted)
        console.log('🔚 Returning at point A (no new signals) - About to increment usage');
        console.log('📊 User ID:', user.id, 'Action: refresh');
        
        try {
          console.log('📊 Calling incrementUsage (no new signals path)...');
          await incrementUsage(user.id, 'refresh');
          console.log('✅ incrementUsage completed successfully (no new signals case)');
        } catch (usageError) {
          console.error('❌ Failed to increment usage (no new signals path):', usageError);
          console.error('❌ Usage error stack:', usageError.stack);
          // Don't fail the request if usage increment fails
        }
        
        return NextResponse.json({
          success: true,
          message: 'No new signals to add',
          imported: 0,
          count: 0,
          feeds: {
            total: sources.length,
            successful: successfulFeeds,
            failed: failedCount
          },
          errors: errors.length > 0 ? errors : undefined,
          quota: {
            remaining: quota.remaining - 1,
            limit: quota.limit
          }
        });
      }
      
      // Prepare signals for insert with DNA-matched fields and quality scores
      const signalsToInsert = uniqueSignals.map(signal => {
        // Base scores (may be floats)
        // Use final_score if available (includes audience demand), otherwise fall back to combined_score
        const finalScore = signal.final_score || signal.combined_score || signal.relevance_score || 50;
        const combinedScore = signal.combined_score || signal.relevance_score || 50;
        const relevanceScore = signal.relevance_score || 50;
        const qualityScore = signal.quality_score || 50;

        // Clamp to [0, 100] to satisfy signals_score_check (INTEGER 0–100)
        const safeFinal = Math.max(0, Math.min(100, finalScore));
        const safeCombined = Math.max(0, Math.min(100, combinedScore));
        const safeRelevance = Math.max(0, Math.min(100, relevanceScore));
        
        return {
          show_id: showId,
          type: signal.type || 'news',
          title: signal.title,
          description: signal.description,
          url: signal.url,
          source: signal.source || signal.raw_data?.sourceName || 'RSS',
          score: Math.round(safeFinal),        // Integer 0–100 (includes audience demand + competitor boost)
          relevance_score: Math.round(safeRelevance), // Integer 0–100
          audience_demand_score: signal.audience_demand_score || 0,
          audience_evidence: signal.audience_evidence || [],
          demand_summary: signal.demand_summary || 'No Data',
          competitor_boost: signal.competitor_boost || 0,
          competitor_evidence: signal.competitor_evidence || [],
          matched_topic: signal.matched_topic || 'other_stories', // Never null
          story_id: signal.story_id || null,      // Story cluster ID
          story_rank: signal.story_rank || null,  // Rank within story (1 = anchor)
          story_size: signal.story_size || null,  // Actual saved signals in this story (after filtering)
          // story_original_size is optional - only include if column exists
          // (migration: migrations/add_story_original_size_column.sql)
          ...(signal.story_original_size ? { story_original_size: signal.story_original_size } : {}),
          status: 'new',
          is_active: true,
          // SIMPLE RULE: is_visible = (score >= 40) && (status !== 'rejected')
          is_visible: (Math.round(safeFinal) >= 40) && (signal.status !== 'rejected'),
          detected_at: signal.detected_at || signal.raw_data?.rssItem?.pubDate || new Date().toISOString(),
          created_at: new Date().toISOString(),
          raw_data: {
            ...(signal.raw_data || {}),
            quality_score: qualityScore,      // Original float
            dna_score: relevanceScore,        // Original float DNA score
            combined_score: combinedScore,    // Original float combined score (pre-clamp)
            dna_reasons: signal.dna_reasons,
            is_story_anchor: signal.is_story_anchor || false
          }
        };
      });
      
      // STEP 6: Log final insert count
      console.log(`📥 STEP 6 - Final insert: ${signalsToInsert.length} signals`);
      
      const { error: insertError } = await supabaseAdmin
        .from('signals')
        .insert(signalsToInsert);

      if (insertError) {
        console.error('Error inserting signals:', insertError);
        throw insertError;
      }
      totalImported = uniqueSignals.length;
      console.log(`Successfully imported ${totalImported} new signals`);
    } else {
      console.log('No signals passed quality filters, nothing to insert.');
      // totalImported remains 0 in this case
    }

    // IMPORTANT: Increment usage BEFORE returning success
    // This runs regardless of whether signals were inserted or not
    console.log('🔚 Returning at point B (main success path) - About to increment usage');
    console.log('📊 User ID:', user.id, 'Action: refresh');
    console.log('📊 Total imported:', totalImported);
    
    try {
      console.log('📊 Calling incrementUsage (main path)...');
      await incrementUsage(user.id, 'refresh');
      console.log('✅ incrementUsage completed successfully (main path)');
    } catch (usageError) {
      console.error('❌ Failed to increment usage (main path):', usageError);
      console.error('❌ Usage error stack:', usageError.stack);
      // Don't fail the request if usage increment fails
    }

    // Use feed statistics already calculated earlier
    console.log('🔚 Returning success response, imported:', totalImported);
    return NextResponse.json({
      success: true,
      imported: totalImported,
      sourcesProcessed: sources.length,
      successfulFeeds: successfulFeeds,
      failedFeeds: failedCount,
      message: failedCount > 0 
        ? `Fetched ${successfulFeeds} feeds successfully, ${failedCount} failed. Added ${totalImported} new signals.`
        : `Successfully fetched all ${successfulFeeds} feeds and added ${totalImported} new signals.`,
      errors: errors.length > 0 ? errors : undefined,
      failedFeedDetails: failedFeeds.length > 0 ? failedFeeds : undefined,
      quota: {
        remaining: quota.remaining - 1,
        limit: quota.limit
      }
    });

  } catch (error) {
    console.error('❌ Refresh signals error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    console.error('❌ Full error stack:', error.stack);
    
    // Ensure we always return valid JSON
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error',
      message: 'An error occurred while refreshing signals. Please try again.',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
        name: error.name
      } : undefined
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// AI Enrichment Function
async function enrichSignalsWithAI(signals, topics) {
  const enriched = [];
  
  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < signals.length; i += 5) {
    const batch = signals.slice(i, i + 5);
    
    const enrichmentPromises = batch.map(async (signal) => {
      try {
        // Skip if Groq is not configured
        if (!process.env.GROQ_API_KEY) {
          return {
            ...signal,
            relevance_score: 50,
            hook_potential: 5,
            score: 50
          };
        }

        const prompt = `Analyze this news signal for an Arabic YouTube documentary channel.

Title: ${signal.title}
Description: ${signal.description?.substring(0, 500) || 'No description'}

Available topics: ${topics?.map(t => t.name || t.topic_id).join(', ') || 'General'}

Respond in JSON format:
{
  "relevance_score": 0-100,
  "hook_potential": 0-10,
  "matched_topic": "topic name or 'other'",
  "suggested_format": "long" or "short",
  "audience_insight": {
    "title": "عنوان قصير بالعربية - لماذا يهتم الجمهور",
    "description": "شرح قصير لماذا هذا الموضوع مهم للمشاهد العربي",
    "relevance": 0-100,
    "stats": {
      "searches": estimated monthly searches (number),
      "watch_time": "estimated avg watch time like 8:30",
      "keyword_match": number of matching keywords 1-5
    }
  },
  "audience_questions": [
    "سؤال 1 بالعربية؟",
    "سؤال 2 بالعربية؟"
  ],
  "pitch_suggestions": {
    "do": [
      "اقتراح 1 بالعربية",
      "اقتراح 2 بالعربية"
    ],
    "avoid": [
      "تجنب هذا بالعربية"
    ]
  },
  "trending_searches": ["كلمة 1", "كلمة 2", "كلمة 3"]
}

IMPORTANT: Respond ONLY with valid JSON.`;

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 800
        });

        const content = completion.choices[0]?.message?.content || '';
        
        // Parse JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const enrichment = JSON.parse(jsonMatch[0]);
          
          return {
            ...signal,
            relevance_score: enrichment.relevance_score || 50,
            hook_potential: String(enrichment.hook_potential || 5),
            matched_topic: enrichment.matched_topic || 'other',
            suggested_format: enrichment.suggested_format || 'long',
            audience_insight: enrichment.audience_insight || null,
            audience_questions: enrichment.audience_questions || null,
            pitch_suggestions: enrichment.pitch_suggestions || null,
            trending_searches: enrichment.trending_searches || null,
            score: enrichment.relevance_score || 50
          };
        }
        
        return {
          ...signal,
          relevance_score: 50,
          hook_potential: '5',
          score: 50
        };
      } catch (aiError) {
        console.error('AI enrichment error for signal:', signal.title, aiError);
        return {
          ...signal,
          relevance_score: 50,
          hook_potential: '5',
          score: 50
        };
      }
    });

    const batchResults = await Promise.all(enrichmentPromises);
    enriched.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + 5 < signals.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return enriched;
}

