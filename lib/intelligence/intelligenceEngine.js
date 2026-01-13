/**
 * Intelligence Engine V2
 * Connects multiple data sources to generate smart recommendations
 * NOW USES TOPIC INTELLIGENCE for accurate topic extraction
 */

import { generateTopicFingerprint, compareTopics } from '../topicIntelligence.js';

// Data Source Weights
const SOURCE_WEIGHTS = {
  competitor_videos: 0.35,  // 35% - What people actually watch
  search_terms: 0.25,       // 25% - What people want to know
  rss_signals: 0.20,        // 20% - Current events / timing
  comments: 0.10,           // 10% - Audience requests (mostly thanks)
  manual_trends: 0.10       // 10% - Your ideas
};

// Format Definitions
const CONTENT_FORMATS = {
  long_form: {
    id: 'long_form',
    name: 'فيديو طويل',
    name_en: 'Long-Form Video',
    duration: '20-35 minutes',
    icon: '🎬',
    best_for: [
      'شرح معمق لموضوع معقد',
      'تحليل شامل مع أمثلة',
      'قصص طويلة مع سياق',
      'مقارنات متعددة الأبعاد'
    ],
    requirements: {
      min_search_volume: 5000,
      min_competitor_success: 100000, // views
      complexity: 'high',
      depth_needed: true
    }
  },
  short_form: {
    id: 'short_form',
    name: 'فيديو قصير',
    name_en: 'Short-Form Video',
    duration: '45-90 seconds',
    icon: '📱',
    best_for: [
      'خبر عاجل أو مفاجئ',
      'رقم أو إحصائية صادمة',
      'نصيحة سريعة',
      'تعليق على حدث'
    ],
    requirements: {
      min_search_volume: 1000,
      trending: true,
      simplicity: 'high',
      hook_strength: 'very_high'
    }
  },
  podcast: {
    id: 'podcast',
    name: 'بودكاست',
    name_en: 'Podcast',
    duration: '45-90 minutes',
    icon: '🎙️',
    best_for: [
      'نقاش مع ضيف خبير',
      'تحليل عميق جداً',
      'قصة شخصية طويلة',
      'موضوع يحتاج آراء متعددة'
    ],
    requirements: {
      min_search_volume: 3000,
      expert_available: true,
      discussion_worthy: true,
      multiple_perspectives: true
    }
  }
};

// Ignore Patterns (Low Value Content)
const IGNORE_PATTERNS = {
  // Channel names - don't recommend making videos about yourself
  channel_names: [
    'المخبر الاقتصادي', 'المخبر', 'الدحيح', 'كبريت', 'إيجيكولوجي',
    'مخبر اقتصادي', 'الخبير الاقتصادي', 'المخبر الاقتصادي بلس',
    'اقتصاد الشرق', 'قناة العربية', 'الجزيرة'
  ],
  
  // Generic comments (thanks, prayers, praise)
  generic_comments: [
    'شكرا', 'شكراً', 'جزاك الله', 'جزاكم الله', 'ممتاز', 'رائع',
    'استمر', 'استمروا', 'الله يوفقك', 'الله يعطيك العافية',
    'محتوى جميل', 'محتوى رائع', 'أحسنت', 'بارك الله',
    'ماشاء الله', 'تبارك الله', 'الله يحفظك',
    '❤️', '🔥', '👍', '👏', '💪', '🙏'
  ],
  
  // Single words without context
  min_words: 3,
  
  // Very short search terms
  min_search_term_length: 5
};

/**
 * Main Intelligence Engine Class
 */
class IntelligenceEngine {
  constructor(supabase, showId) {
    this.supabase = supabase;
    this.showId = showId;
    this.showDna = null;
  }

  /**
   * Load all data sources
   */
  async loadDataSources() {
    console.log('📊 Loading data sources...');
    
    // Load Show DNA
    try {
      const { data: dna, error: dnaError } = await this.supabase
        .from('show_dna')
        .select('*')
        .eq('show_id', this.showId)
        .single();
      
      if (!dnaError && dna) {
        this.showDna = dna;
      }
    } catch (error) {
      console.warn('Could not load show DNA:', error.message);
    }

    // Load Search Terms
    const { data: searchTerms } = await this.supabase
      .from('search_terms')
      .select('*')
      .order('volume', { ascending: false })
      .limit(100)
      .then(result => ({ data: result.data || [], error: result.error }))
      .catch(() => ({ data: [], error: null }));

    // Load Competitor Videos
    const { data: competitorVideos } = await this.supabase
      .from('competitor_videos')
      .select('*, competitors(name, channel_id)')
      .order('views', { ascending: false })
      .limit(200)
      .then(result => ({ data: result.data || [], error: result.error }))
      .catch(() => ({ data: [], error: null }));

    // Load Comments
    const { data: comments } = await this.supabase
      .from('comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(result => ({ data: result.data || [], error: result.error }))
      .catch(() => ({ data: [], error: null }));

    // Load RSS Signals (recent, high score)
    const { data: signals } = await this.supabase
      .from('signals')
      .select('*')
      .eq('show_id', this.showId)
      .gte('score', 40)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(result => ({ data: result.data || [], error: result.error }))
      .catch(() => ({ data: [], error: null }));

    // Load Manual Trends
    const { data: manualTrends } = await this.supabase
      .from('manual_trends')
      .select('*')
      .eq('show_id', this.showId)
      .eq('active', true)
      .then(result => ({ data: result.data || [], error: result.error }))
      .catch(() => ({ data: [], error: null }));

    return {
      searchTerms: this.filterSearchTerms(searchTerms.data || []),
      competitorVideos: this.analyzeCompetitorVideos(competitorVideos.data || []),
      comments: this.filterComments(comments.data || []),
      signals: signals.data || [],
      manualTrends: manualTrends.data || []
    };
  }

  /**
   * Filter out low-value search terms
   */
  filterSearchTerms(terms) {
    return terms.filter(term => {
      const text = term.term?.toLowerCase() || '';
      
      // Skip channel names
      if (IGNORE_PATTERNS.channel_names.some(name => 
        text.includes(name.toLowerCase())
      )) {
        return false;
      }
      
      // Skip very short terms
      if (text.length < IGNORE_PATTERNS.min_search_term_length) {
        return false;
      }
      
      // Skip single words
      if (text.split(' ').length < IGNORE_PATTERNS.min_words) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Filter out generic comments
   */
  filterComments(comments) {
    return comments.filter(comment => {
      const text = comment.text?.toLowerCase() || '';
      
      // Skip generic thanks/prayers
      if (IGNORE_PATTERNS.generic_comments.some(pattern => 
        text.includes(pattern.toLowerCase())
      )) {
        return false;
      }
      
      // Skip very short comments
      if (text.length < 20) {
        return false;
      }
      
      // Skip emoji-only comments
      if (text.replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim().length < 10) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Analyze competitor videos for success/failure patterns
   */
  analyzeCompetitorVideos(videos) {
    // Group by channel
    const channelAverages = new Map();
    
    videos.forEach(video => {
      const channelId = video.competitors?.channel_id || video.channel_id || 'unknown';
      if (!channelAverages.has(channelId)) {
        const channelVideos = videos.filter(v => 
          (v.competitors?.channel_id || v.channel_id) === channelId
        );
        const avg = channelVideos.length > 0
          ? channelVideos.reduce((sum, v) => sum + (v.views || 0), 0) / channelVideos.length
          : 1;
        channelAverages.set(channelId, avg);
      }
    });
    
    return videos.map(video => {
      const channelId = video.competitors?.channel_id || video.channel_id || 'unknown';
      const avgViews = channelAverages.get(channelId) || 1;
      const performance = (video.views || 0) / avgViews;
      
      return {
        ...video,
        performance_ratio: performance,
        performance_label: performance > 1.5 ? 'SUCCESS' : 
                          performance < 0.5 ? 'FAILURE' : 'AVERAGE',
        is_success: performance > 1.5,
        is_failure: performance < 0.5
      };
    });
  }

  /**
   * Extract topics from all sources
   */
  extractTopics(data) {
    const topicMap = new Map();

    // From Search Terms (weight: 25%)
    data.searchTerms.forEach(term => {
      const topic = this.normalizeTopic(term.term);
      if (!topic || topic.length < 3) return;
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, this.createTopicEntry(topic));
      }
      const entry = topicMap.get(topic);
      entry.search_volume += term.volume || 0;
      entry.sources.search_terms.push(term);
    });

    // From Competitor Videos (weight: 35%)
    data.competitorVideos.forEach(video => {
      const topic = this.extractTopicFromTitle(video.title);
      if (!topic) return;
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, this.createTopicEntry(topic));
      }
      const entry = topicMap.get(topic);
      entry.competitor_videos.push(video);
      entry.sources.competitor_videos.push(video);
      
      if (video.is_success) entry.competitor_success_count++;
      if (video.is_failure) entry.competitor_failure_count++;
      entry.total_competitor_views += video.views || 0;
    });

    // From Comments (weight: 10%)
    data.comments.forEach(comment => {
      const topics = this.extractTopicsFromComment(comment.text);
      topics.forEach(topic => {
        if (!topic || topic.length < 3) return;
        
        if (!topicMap.has(topic)) {
          topicMap.set(topic, this.createTopicEntry(topic));
        }
        const entry = topicMap.get(topic);
        entry.comment_mentions++;
        entry.sources.comments.push(comment);
      });
    });

    // From RSS Signals (weight: 20%)
    data.signals.forEach(signal => {
      const topic = this.extractTopicFromTitle(signal.title || signal.topic);
      if (!topic) return;
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, this.createTopicEntry(topic));
      }
      const entry = topicMap.get(topic);
      entry.has_current_event = true;
      entry.current_events.push(signal);
      entry.sources.signals.push(signal);
    });

    // From Manual Trends (weight: 10%)
    data.manualTrends.forEach(trend => {
      const topic = this.normalizeTopic(trend.topic);
      if (!topic || topic.length < 3) return;
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, this.createTopicEntry(topic));
      }
      const entry = topicMap.get(topic);
      entry.is_manual_trend = true;
      entry.manual_priority = trend.priority || 'medium';
      entry.sources.manual_trends.push(trend);
    });

    return topicMap;
  }

  /**
   * Create empty topic entry
   */
  createTopicEntry(topic) {
    return {
      topic,
      search_volume: 0,
      competitor_videos: [],
      competitor_success_count: 0,
      competitor_failure_count: 0,
      total_competitor_views: 0,
      comment_mentions: 0,
      has_current_event: false,
      current_events: [],
      is_manual_trend: false,
      manual_priority: null,
      sources: {
        search_terms: [],
        competitor_videos: [],
        comments: [],
        signals: [],
        manual_trends: []
      }
    };
  }

  /**
   * Score topics and generate recommendations
   */
  scoreTopics(topicMap) {
    const scoredTopics = [];

    topicMap.forEach((data, topic) => {
      // Calculate component scores
      const searchScore = this.calculateSearchScore(data);
      const competitorScore = this.calculateCompetitorScore(data);
      const currentEventScore = this.calculateCurrentEventScore(data);
      const commentScore = this.calculateCommentScore(data);
      const manualScore = this.calculateManualScore(data);

      // Weighted total
      const totalScore = 
        (searchScore * SOURCE_WEIGHTS.search_terms) +
        (competitorScore * SOURCE_WEIGHTS.competitor_videos) +
        (currentEventScore * SOURCE_WEIGHTS.rss_signals) +
        (commentScore * SOURCE_WEIGHTS.comments) +
        (manualScore * SOURCE_WEIGHTS.manual_trends);

      // Determine best format
      const formatAnalysis = this.analyzeFormatSuitability(data, totalScore);

      // Find content gaps
      const gaps = this.findContentGaps(data);

      // Generate suggested angle
      const suggestedAngle = this.generateSuggestedAngle(data, gaps);

      scoredTopics.push({
        topic,
        score: Math.round(totalScore),
        level: this.getRecommendationLevel(totalScore),
        
        // Component scores
        scores: {
          search: Math.round(searchScore),
          competitor: Math.round(competitorScore),
          current_event: Math.round(currentEventScore),
          comment: Math.round(commentScore),
          manual: Math.round(manualScore)
        },
        
        // Format recommendation
        recommended_format: formatAnalysis.best_format,
        format_scores: formatAnalysis.scores,
        format_reasoning: formatAnalysis.reasoning,
        
        // Evidence
        evidence: {
          search_volume: data.search_volume,
          competitor_videos: data.competitor_videos.length,
          competitor_success: data.competitor_success_count,
          competitor_failure: data.competitor_failure_count,
          total_views: data.total_competitor_views,
          comment_mentions: data.comment_mentions,
          has_current_event: data.has_current_event,
          current_events: data.current_events.slice(0, 3),
          is_manual_trend: data.is_manual_trend
        },
        
        // Insights
        gaps,
        suggested_angle: suggestedAngle,
        
        // Raw sources for debugging
        sources: data.sources
      });
    });

    // Sort by score
    return scoredTopics.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate search score (0-100)
   */
  calculateSearchScore(data) {
    const volume = data.search_volume;
    if (volume >= 20000) return 100;
    if (volume >= 10000) return 80;
    if (volume >= 5000) return 60;
    if (volume >= 2000) return 40;
    if (volume >= 500) return 20;
    return 0;
  }

  /**
   * Calculate competitor score (0-100)
   */
  calculateCompetitorScore(data) {
    let score = 0;
    
    // Has successful videos on this topic
    if (data.competitor_success_count > 0) {
      score += 40;
    }
    
    // High total views
    if (data.total_competitor_views > 1000000) score += 30;
    else if (data.total_competitor_views > 500000) score += 20;
    else if (data.total_competitor_views > 100000) score += 10;
    
    // Gap opportunity (competitors failed or didn't cover)
    if (data.competitor_failure_count > data.competitor_success_count) {
      score += 20; // Opportunity to do better
    }
    if (data.competitor_videos.length === 0) {
      score += 10; // Untapped topic
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate current event score (0-100)
   */
  calculateCurrentEventScore(data) {
    if (!data.has_current_event) return 0;
    
    let score = 50; // Base score for having current event
    
    // Multiple current events = trending topic
    score += Math.min(data.current_events.length * 10, 30);
    
    // Check recency
    const recentEvents = data.current_events.filter(e => {
      const age = Date.now() - new Date(e.created_at).getTime();
      return age < 24 * 60 * 60 * 1000; // Less than 24 hours
    });
    if (recentEvents.length > 0) score += 20;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate comment score (0-100)
   */
  calculateCommentScore(data) {
    const mentions = data.comment_mentions;
    if (mentions >= 10) return 100;
    if (mentions >= 5) return 70;
    if (mentions >= 3) return 50;
    if (mentions >= 1) return 30;
    return 0;
  }

  /**
   * Calculate manual trend score (0-100)
   */
  calculateManualScore(data) {
    if (!data.is_manual_trend) return 0;
    
    switch (data.manual_priority) {
      case 'high': return 100;
      case 'medium': return 70;
      case 'low': return 40;
      default: return 50;
    }
  }

  /**
   * Analyze format suitability
   */
  analyzeFormatSuitability(data, totalScore) {
    const scores = {
      long_form: 0,
      short_form: 0,
      podcast: 0
    };
    
    const reasoning = [];

    // Long-form indicators
    if (data.search_volume >= 5000) {
      scores.long_form += 30;
      reasoning.push('High search volume supports deep-dive content');
    }
    if (data.competitor_success_count > 0 && data.total_competitor_views > 500000) {
      scores.long_form += 25;
      reasoning.push('Proven success with long-form on this topic');
    }
    if (data.current_events.length > 1) {
      scores.long_form += 15;
      reasoning.push('Multiple angles available for comprehensive coverage');
    }

    // Short-form indicators
    if (data.has_current_event && data.current_events.some(e => {
      const age = Date.now() - new Date(e.created_at).getTime();
      return age < 24 * 60 * 60 * 1000;
    })) {
      scores.short_form += 40;
      reasoning.push('Breaking/recent news - good for quick coverage');
    }
    if (data.search_volume >= 1000 && data.search_volume < 5000) {
      scores.short_form += 20;
      reasoning.push('Moderate interest - test with short content first');
    }

    // Podcast indicators
    if (data.comment_mentions >= 5) {
      scores.podcast += 25;
      reasoning.push('High audience interest - worth deep discussion');
    }
    if (data.competitor_videos.length > 5) {
      scores.podcast += 20;
      reasoning.push('Well-covered topic - differentiate with discussion format');
    }
    if (data.search_volume >= 10000) {
      scores.podcast += 15;
      reasoning.push('Very high interest supports long-form discussion');
    }

    // Determine best format
    const best_format = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      best_format,
      scores,
      reasoning
    };
  }

  /**
   * Find content gaps
   */
  findContentGaps(data) {
    const gaps = [];

    // No competitor coverage
    if (data.competitor_videos.length === 0 && data.search_volume > 2000) {
      gaps.push({
        type: 'untapped_topic',
        description: 'موضوع عليه طلب لكن المنافسين ما غطوه',
        opportunity: 'high'
      });
    }

    // Competitors failed
    if (data.competitor_failure_count > data.competitor_success_count) {
      gaps.push({
        type: 'execution_gap',
        description: 'المنافسين حاولوا بس ما نجحوا - فرصة لتقديم محتوى أفضل',
        opportunity: 'high'
      });
    }

    // Current event not covered by competitors
    if (data.has_current_event && data.competitor_videos.length === 0) {
      gaps.push({
        type: 'timing_gap',
        description: 'حدث جاري ومحدش غطاه بعد',
        opportunity: 'very_high'
      });
    }

    // Audience asking but no content
    if (data.comment_mentions >= 3 && data.competitor_videos.length === 0) {
      gaps.push({
        type: 'demand_gap',
        description: 'الجمهور طالب الموضوع ده ومحدش قدمه',
        opportunity: 'high'
      });
    }

    return gaps;
  }

  /**
   * Generate suggested angle
   */
  generateSuggestedAngle(data, gaps) {
    // If there's a timing gap
    if (gaps.some(g => g.type === 'timing_gap')) {
      return `تغطية سريعة للحدث الجاري مع تحليل للتأثيرات المحتملة`;
    }

    // If there's an execution gap
    if (gaps.some(g => g.type === 'execution_gap')) {
      return `نفس الموضوع لكن بزاوية مختلفة وتحليل أعمق`;
    }

    // If audience is asking
    if (gaps.some(g => g.type === 'demand_gap')) {
      return `إجابة مباشرة على أسئلة الجمهور حول الموضوع`;
    }

    // Default
    return `تحليل شامل مع ربط بالواقع العربي`;
  }

  /**
   * Get recommendation level
   */
  getRecommendationLevel(score) {
    if (score >= 80) return 'HIGHLY_RECOMMENDED';
    if (score >= 60) return 'RECOMMENDED';
    if (score >= 40) return 'CONSIDER';
    return 'SKIP';
  }

  /**
   * Normalize topic text
   */
  normalizeTopic(text) {
    return text?.toLowerCase().trim() || '';
  }

  /**
   * Extract topic from video title
   */
  extractTopicFromTitle(title) {
    if (!title) return null;
    
    // Remove common prefixes/suffixes
    let topic = title
      .replace(/\|.*$/, '')
      .replace(/-.*$/, '')
      .replace(/[!?].*$/, '')
      .trim();
    
    return topic.length > 5 ? topic : null;
  }

  /**
   * Extract topics from comment
   */
  extractTopicsFromComment(text) {
    if (!text) return [];
    
    // Simple keyword extraction
    // In production, use NLP
    const topics = [];
    
    const keywords = [
      'ترامب', 'الصين', 'أمريكا', 'النفط', 'الذهب', 'الدولار',
      'السعودية', 'الإمارات', 'مصر', 'الذكاء الاصطناعي',
      'العملات الرقمية', 'بيتكوين', 'تسلا', 'إيلون ماسك'
    ];
    
    keywords.forEach(kw => {
      if (text.includes(kw)) {
        topics.push(kw);
      }
    });
    
    return topics;
  }

  /**
   * Main run method
   */
  async run() {
    console.log('🧠 Starting Intelligence Engine V2...');
    
    // Load all data
    const data = await this.loadDataSources();
    console.log(`📊 Loaded: ${data.searchTerms.length} search terms, ${data.competitorVideos.length} videos, ${data.comments.length} comments, ${data.signals.length} signals`);
    
    // Extract and merge topics
    const topicMap = this.extractTopics(data);
    console.log(`🔍 Extracted ${topicMap.size} unique topics`);
    
    // Score and rank
    const recommendations = this.scoreTopics(topicMap);
    console.log(`✅ Generated ${recommendations.length} recommendations`);
    
    // Return top recommendations
    return {
      success: true,
      recommendations: recommendations.filter(r => r.level !== 'SKIP').slice(0, 20),
      skipped: recommendations.filter(r => r.level === 'SKIP').slice(0, 10),
      summary: {
        total: recommendations.length,
        highly_recommended: recommendations.filter(r => r.level === 'HIGHLY_RECOMMENDED').length,
        recommended: recommendations.filter(r => r.level === 'RECOMMENDED').length,
        consider: recommendations.filter(r => r.level === 'CONSIDER').length,
        skipped: recommendations.filter(r => r.level === 'SKIP').length
      },
      data_sources: {
        search_terms: data.searchTerms.length,
        competitor_videos: data.competitorVideos.length,
        comments: data.comments.length,
        signals: data.signals.length,
        manual_trends: data.manualTrends.length
      }
    };
  }
}

export default IntelligenceEngine;
export { CONTENT_FORMATS, SOURCE_WEIGHTS, IGNORE_PATTERNS };

// ============================================
// TOPIC INTELLIGENCE-BASED FUNCTIONS (NEW)
// ============================================

/**
 * Extract intelligence from a signal using Topic Intelligence
 * Replaces manual keyword extraction
 */
export async function extractIntelligence(signal) {
  const fingerprint = await generateTopicFingerprint({
    title: typeof signal === 'string' ? signal : (signal.title || signal.topic || ''),
    description: typeof signal === 'string' ? '' : (signal.description || ''),
    id: typeof signal === 'string' ? undefined : signal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for speed
  });
  
  return {
    // Core intelligence
    category: fingerprint.topicCategory,
    entities: fingerprint.entities,
    language: fingerprint.language,
    
    // Extracted data
    people: fingerprint.entities.people,
    countries: fingerprint.entities.countries,
    organizations: fingerprint.entities.organizations || [],
    topics: fingerprint.entities.topics,
    
    // Fingerprint for matching
    fingerprint: fingerprint.fingerprint,
    
    // Legacy compatibility
    keywords: [
      ...fingerprint.entities.topics,
      ...fingerprint.entities.countries,
      ...fingerprint.entities.people,
      ...(fingerprint.entities.organizations || [])
    ],
    mainTopic: fingerprint.topicCategory,
    
    // Metadata
    extractionMethod: fingerprint.extractionMethod || 'topic_intelligence',
    extractedAt: new Date().toISOString()
  };
}

/**
 * Batch extract intelligence from multiple signals
 */
export async function extractIntelligenceBatch(signals, options = {}) {
  const { concurrency = 5 } = options;
  
  console.log(`🧠 Extracting intelligence from ${signals.length} signals...`);
  
  const results = [];
  
  // Process in batches for efficiency
  for (let i = 0; i < signals.length; i += concurrency) {
    const batch = signals.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (signal) => {
        try {
          const intelligence = await extractIntelligence(signal);
          return { signal, intelligence, success: true };
        } catch (error) {
          console.error(`Error extracting intelligence for signal ${signal.id}:`, error);
          return { signal, intelligence: null, success: false, error: error.message };
        }
      })
    );
    results.push(...batchResults);
  }
  
  const successful = results.filter(r => r.success);
  console.log(`🧠 Extracted intelligence: ${successful.length}/${signals.length} successful`);
  
  return results;
}

/**
 * Enrich a signal with intelligence data
 */
export async function enrichSignal(signal) {
  const intelligence = await extractIntelligence(signal);
  
  return {
    ...signal,
    // Add intelligence data
    intelligence,
    category: intelligence.category,
    entities: intelligence.entities,
    // Flatten for easy access
    people: intelligence.people,
    countries: intelligence.countries,
    topics: intelligence.topics,
    organizations: intelligence.organizations,
    // Mark as enriched
    isEnriched: true,
    enrichedAt: new Date().toISOString()
  };
}

/**
 * Get topic summary for a collection of signals
 */
export async function getTopicSummary(signals) {
  const categoryCounts = {};
  const entityCounts = { people: {}, countries: {}, topics: {}, organizations: {} };
  
  for (const signal of signals) {
    // Get or extract intelligence
    const intel = signal.intelligence || await extractIntelligence(signal);
    
    // Count categories
    const cat = intel.category || 'general';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    
    // Count entities
    for (const person of intel.people || []) {
      entityCounts.people[person] = (entityCounts.people[person] || 0) + 1;
    }
    for (const country of intel.countries || []) {
      entityCounts.countries[country] = (entityCounts.countries[country] || 0) + 1;
    }
    for (const topic of intel.topics || []) {
      entityCounts.topics[topic] = (entityCounts.topics[topic] || 0) + 1;
    }
    for (const org of intel.organizations || []) {
      entityCounts.organizations[org] = (entityCounts.organizations[org] || 0) + 1;
    }
  }
  
  // Sort by count
  const sortByCount = (obj) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  
  return {
    totalSignals: signals.length,
    categories: sortByCount(categoryCounts),
    topPeople: sortByCount(entityCounts.people).slice(0, 10),
    topCountries: sortByCount(entityCounts.countries).slice(0, 10),
    topTopics: sortByCount(entityCounts.topics).slice(0, 10),
    topOrganizations: sortByCount(entityCounts.organizations).slice(0, 10)
  };
}




