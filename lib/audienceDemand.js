/**
 * Audience Demand Scoring System
 * GENERIC - Works for ANY show using their own data
 * No hardcoded keywords - learns from show's DNA and content
 */

import { createClient } from '@supabase/supabase-js';
import { getShowPatterns, scoreSignalByPatterns } from './behaviorPatterns';
import { filterUsefulComments, extractQuestions } from './commentFilter.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Calculate audience demand score for a signal
 * GENERIC - uses show's own data for matching
 */
export async function calculateAudienceDemand(signal, showId, showData = null) {
  if (!showData) {
    showData = await getShowAudienceData(showId);
  }

  const evidence = [];
  let demandScore = 0;

  // 1. TOPIC PERFORMANCE BOOST
  const topicBoost = getTopicPerformanceBoost(
    signal.matched_topic,
    showData.topicPerformance,
    showData.avgViews
  );
  
  if (topicBoost.boost > 0) {
    demandScore += topicBoost.boost;
    evidence.push({
      type: 'topic_performance',
      icon: '📊',
      text: `Your "${signal.matched_topic}" videos avg ${formatNumber(topicBoost.avgViews)} views (${topicBoost.multiplier}x your average)`,
      boost: topicBoost.boost
    });
  }

  // 2. AUDIENCE QUESTIONS BOOST (using show's DNA keywords)
  const questionBoost = getAudienceQuestionBoost(
    signal,
    showData.audienceQuestions,
    showData.topicKeywordMap,
    showData.learnedKeywords
  );
  
  if (questionBoost.boost > 0) {
    demandScore += questionBoost.boost;
    evidence.push({
      type: 'audience_questions',
      icon: '💬',
      text: `${questionBoost.count} audience questions match this topic`,
      questions: questionBoost.questions.slice(0, 3),
      boost: questionBoost.boost
    });
  }

  // 3. COMPETITOR COVERAGE BOOST
  const competitorBoost = getCompetitorBoost(
    signal,
    showData.competitorVideos,
    showData.topicKeywordMap
  );
  
  if (competitorBoost.boost > 0) {
    demandScore += competitorBoost.boost;
    evidence.push({
      type: 'competitor_coverage',
      icon: '👥',
      text: `${competitorBoost.count} competitors covered similar topic`,
      videos: competitorBoost.videos.slice(0, 2),
      boost: competitorBoost.boost
    });
  }

  // 4. CONTENT GAP BONUS
  const contentGap = detectContentGap(
    signal.matched_topic,
    showData.audienceQuestions,
    showData.coveredTopics
  );
  
  if (contentGap.isGap) {
    demandScore += contentGap.boost;
    evidence.push({
      type: 'content_gap',
      icon: '🎯',
      text: `Content gap: Audience interested but not covered recently`,
      boost: contentGap.boost
    });
  }

  // 5. BEHAVIOR PATTERN SCORING (NEW)
  try {
    const patterns = await getShowPatterns(showId);
    
    // Get learned pattern weights from user feedback
    let learnedWeights = {};
    try {
      const { data: learningData } = await supabase
        .from('show_learning_weights')
        .select('pattern_weights')
        .eq('show_id', showId)
        .maybeSingle();
      
      learnedWeights = learningData?.pattern_weights || {};
    } catch (weightError) {
      console.warn('Could not fetch pattern weights:', weightError);
      // Continue without learned weights
    }
    
    const patternScore = await scoreSignalByPatterns(signal, patterns, learnedWeights);
    
    if (patternScore.totalBoost > 0) {
      demandScore += patternScore.totalBoost;
      
      for (const match of patternScore.matches) {
        evidence.push({
          type: 'behavior_pattern',
          icon: match.source === 'videos' ? '📊' : match.source === 'comments' ? '💬' : '👥',
          text: match.evidence,
          patternName: match.patternName,
          patternNameAr: match.patternNameAr,
          boost: match.boost,
          originalBoost: match.originalBoost,
          learnedWeight: match.learnedWeight,
          confidence: match.confidence,
          isLearned: match.isLearned
        });
      }
    }
  } catch (patternError) {
    console.error('Error calculating behavior patterns:', patternError);
    // Don't fail the whole function if pattern matching fails
  }

  return {
    demandScore,
    evidence,
    summary: generateDemandSummary(demandScore)
  };
}

/**
 * Fetch all audience data for a show (cache-friendly)
 * GENERIC - uses show's own data, no hardcoding
 */
export async function getShowAudienceData(showId) {
  // 1. Get show's DNA topics (their defined keywords)
  const { data: dnaTopics } = await supabase
    .from('topic_definitions')
    .select('topic_id, topic_name_en, topic_name_ar, keywords_en, keywords_ar')
    .eq('show_id', showId)
    .eq('is_active', true);

  // Build topic keyword map from show's OWN DNA
  const topicKeywordMap = {};
  (dnaTopics || []).forEach(topic => {
    const keywords = [
      ...(Array.isArray(topic.keywords_en) ? topic.keywords_en : (topic.keywords_en ? topic.keywords_en.split(',').map(k => k.trim()) : [])),
      ...(Array.isArray(topic.keywords_ar) ? topic.keywords_ar : (topic.keywords_ar ? topic.keywords_ar.split(',').map(k => k.trim()) : [])),
      topic.topic_name_en?.toLowerCase(),
      topic.topic_name_ar
    ].filter(Boolean).map(k => k.toLowerCase());
    
    topicKeywordMap[topic.topic_id] = keywords;
  });

  // 2. Get topic performance from channel_videos
  const { data: videos } = await supabase
    .from('channel_videos')
    .select('topic_id, views, title, format')
    .eq('show_id', showId)
    .eq('format', 'Long') // Only long-form videos
    .gt('views', 0);

  // Calculate topic performance
  const topicPerformance = {};
  let totalViews = 0;
  let videoCount = 0;

  (videos || []).forEach(video => {
    if (video.topic_id) {
      if (!topicPerformance[video.topic_id]) {
        topicPerformance[video.topic_id] = { totalViews: 0, count: 0, titles: [] };
      }
      topicPerformance[video.topic_id].totalViews += video.views;
      topicPerformance[video.topic_id].count += 1;
      topicPerformance[video.topic_id].titles.push(video.title);
    }
    totalViews += video.views;
    videoCount += 1;
  });

  // Calculate averages
  const avgViews = videoCount > 0 ? totalViews / videoCount : 0;
  
  Object.keys(topicPerformance).forEach(topic => {
    const tp = topicPerformance[topic];
    tp.avgViews = tp.count > 0 ? tp.totalViews / tp.count : 0;
    tp.multiplier = avgViews > 0 ? tp.avgViews / avgViews : 1;
  });

  // 3. Get audience questions/comments
  const { data: comments } = await supabase
    .from('audience_comments')
    .select('text, question, topic, is_actionable, likes')
    .eq('show_id', showId)
    .order('likes', { ascending: false })
    .limit(500);

  // Filter for useful questions (skip appreciation comments)
  // First filter out appreciation/spam comments
  const usefulComments = filterUsefulComments(comments || []);
  
  // Then extract actual questions
  const questionComments = extractQuestions(usefulComments);
  
  // Also include pre-marked actionable comments
  const audienceQuestions = [
    ...questionComments.map(c => ({
      text: c.text || c.content || c.snippet?.textDisplay || c.question,
      question: c.text || c.content || c.snippet?.textDisplay || c.question,
      topic: c.topic,
      is_actionable: true,
      likes: c.likes || 0
    })),
    ...usefulComments.filter(c => c.is_actionable || c.question).map(c => ({
      text: c.text || c.question,
      question: c.question || c.text,
      topic: c.topic,
      is_actionable: c.is_actionable,
      likes: c.likes || 0
    }))
  ];

  // 4. Get competitor videos
  const { data: competitorVideos } = await supabase
    .from('competitor_videos')
    .select('title, views, topic_id, channel_name')
    .eq('show_id', showId)
    .order('views', { ascending: false })
    .limit(100);

  // 5. Get recently covered topics (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const { data: recentVideos } = await supabase
    .from('channel_videos')
    .select('topic_id')
    .eq('show_id', showId)
    .gte('publish_date', ninetyDaysAgo.toISOString());

  const coveredTopics = new Set((recentVideos || []).map(v => v.topic_id).filter(Boolean));

  // 6. Learn keywords from show's successful videos
  const learnedKeywords = extractKeywordsFromVideos(videos || [], avgViews);

  return {
    topicPerformance,
    topicKeywordMap,      // From DNA - show's own topic keywords
    learnedKeywords,      // From videos - what works for this show
    avgViews,
    audienceQuestions: audienceQuestions || [],
    competitorVideos: competitorVideos || [],
    coveredTopics,
    videoCount
  };
}

/**
 * Extract keywords from show's successful videos
 * LEARNS from what works for THIS show
 */
function extractKeywordsFromVideos(videos, avgViews) {
  const keywordCounts = {};
  
  // Focus on above-average performing videos
  const successfulVideos = videos.filter(v => v.views > avgViews);
  
  for (const video of successfulVideos) {
    const words = extractCleanKeywords(video.title || '');
    words.forEach(word => {
      keywordCounts[word] = (keywordCounts[word] || 0) + 1;
    });
  }
  
  // Return keywords that appear in multiple successful videos
  return Object.entries(keywordCounts)
    .filter(([_, count]) => count >= 2)
    .map(([word]) => word);
}

/**
 * Extract clean keywords from text
 * Generic stop words only - no topic-specific filtering
 */
function extractCleanKeywords(text) {
  // Universal stop words (work for any language/show)
  const stopWords = new Set([
    // English function words
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'after',
    'before', 'between', 'under', 'over', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'says', 'said', 'new',
    // Arabic function words
    'من', 'في', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي',
    'هل', 'ما', 'كيف', 'لماذا', 'متى', 'أين', 'كل', 'بعض', 'أن', 'إن',
    'لا', 'كان', 'كانت', 'يكون', 'هو', 'هي', 'هم', 'نحن', 'أنا', 'أنت',
    'ذلك', 'تلك', 'هنا', 'هناك', 'حيث', 'بين', 'حول', 'خلال', 'بعد',
    'قبل', 'عند', 'منذ', 'حتى', 'لكن', 'أو', 'ثم', 'أيضا', 'فقط',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !stopWords.has(word));
}

/**
 * Smart question matching using show's OWN topic keywords
 */
function getAudienceQuestionBoost(signal, audienceQuestions, topicKeywordMap, learnedKeywords) {
  const signalTopic = signal.matched_topic || '';
  const signalTitle = (signal.title || '').toLowerCase();
  
  // Get keywords for this signal's topic FROM THE SHOW'S DNA
  const topicKeywords = topicKeywordMap[signalTopic] || [];
  
  // Extract keywords from signal title
  const titleKeywords = extractCleanKeywords(signalTitle);
  
  // Combine: DNA keywords + title keywords + learned keywords
  const allRelevantKeywords = [...new Set([
    ...topicKeywords,
    ...titleKeywords,
    ...learnedKeywords.filter(k => signalTitle.includes(k))
  ])];

  const matchingQuestions = [];

  for (const question of audienceQuestions) {
    const questionText = (question.text || question.question || '').toLowerCase();
    
    // Skip short comments
    if (questionText.length < 30) continue;
    
    let matchScore = 0;
    
    // METHOD 1: Same topic tag (strongest)
    if (signalTopic && question.topic === signalTopic) {
      matchScore += 4;
    }
    
    // METHOD 2: Topic keywords from DNA appear in question
    const dnaKeywordMatches = topicKeywords.filter(kw => 
      questionText.includes(kw.toLowerCase())
    ).length;
    if (dnaKeywordMatches >= 2) {
      matchScore += 3;
    } else if (dnaKeywordMatches >= 1) {
      matchScore += 1;
    }
    
    // METHOD 3: Title keywords appear in question
    const titleKeywordMatches = titleKeywords.filter(kw => 
      questionText.includes(kw)
    ).length;
    if (titleKeywordMatches >= 3) {
      matchScore += 2;
    }
    
    // METHOD 4: Learned keywords (from successful videos) match
    const learnedMatches = learnedKeywords.filter(kw =>
      questionText.includes(kw) && signalTitle.includes(kw)
    ).length;
    if (learnedMatches >= 1) {
      matchScore += 2;
    }

    // Require minimum score of 3 (quality threshold)
    if (matchScore >= 3) {
      matchingQuestions.push({
        text: question.text || question.question,
        score: matchScore,
        likes: question.likes || 0
      });
    }
  }

  // Sort by quality then likes
  matchingQuestions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.likes - a.likes;
  });

  const count = matchingQuestions.length;
  
  // Boost: +4 per quality match, cap at 25
  const boost = Math.min(count * 4, 25);

  return {
    boost,
    count,
    questions: matchingQuestions.slice(0, 5).map(q => q.text)
  };
}

/**
 * Competitor boost using show's topic keywords
 */
function getCompetitorBoost(signal, competitorVideos, topicKeywordMap) {
  const signalTopic = signal.matched_topic || '';
  const topicKeywords = topicKeywordMap[signalTopic] || [];
  const titleKeywords = extractCleanKeywords(signal.title || '');

  const matchingVideos = competitorVideos.filter(v => {
    // Match by topic
    if (v.topic_id && v.topic_id === signalTopic) return true;
    
    const videoTitle = (v.title || '').toLowerCase();
    
    // Match by DNA keywords
    const dnaMatches = topicKeywords.filter(kw => videoTitle.includes(kw.toLowerCase())).length;
    if (dnaMatches >= 2) return true;
    
    // Match by title keywords
    const titleMatches = titleKeywords.filter(kw => videoTitle.includes(kw)).length;
    if (titleMatches >= 3) return true;
    
    return false;
  });

  const count = matchingVideos.length;
  const boost = Math.min(count * 5, 15);

  return {
    boost,
    count,
    videos: matchingVideos.map(v => ({
      title: v.title,
      channel: v.channel_name,
      views: v.views
    }))
  };
}

/**
 * Topic performance boost
 */
function getTopicPerformanceBoost(topicId, topicPerformance, showAvgViews) {
  if (!topicId || topicId === 'other_stories' || !topicPerformance[topicId]) {
    return { boost: 0, multiplier: 1, avgViews: 0 };
  }

  const tp = topicPerformance[topicId];
  const multiplier = tp.multiplier || 1;

  let boost = 0;
  if (multiplier >= 2.0) boost = 30;
  else if (multiplier >= 1.5) boost = 20;
  else if (multiplier >= 1.2) boost = 10;
  else if (multiplier < 0.5) boost = -10;

  return {
    boost,
    multiplier: Math.round(multiplier * 10) / 10,
    avgViews: Math.round(tp.avgViews),
    videoCount: tp.count
  };
}

/**
 * Detect content gaps
 */
function detectContentGap(topicId, audienceQuestions, coveredTopics) {
  if (!topicId || topicId === 'other_stories') {
    return { isGap: false, boost: 0 };
  }

  const recentlyCovered = coveredTopics.has(topicId);
  const topicQuestions = audienceQuestions.filter(q => q.topic === topicId);
  const questionCount = topicQuestions.length;

  const isGap = !recentlyCovered && questionCount >= 3;
  
  return {
    isGap,
    boost: isGap ? 15 : 0,
    questionCount,
    recentlyCovered
  };
}

/**
 * Format number for display
 */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

/**
 * Generate demand summary
 */
function generateDemandSummary(score) {
  if (score >= 40) return 'Very High Demand';
  if (score >= 25) return 'High Demand';
  if (score >= 15) return 'Moderate Demand';
  if (score > 0) return 'Some Interest';
  return 'No Data';
}

export default {
  calculateAudienceDemand,
  getShowAudienceData
};
