/**
 * UNIFIED RECOMMENDATION ENGINE
 * Combines ALL data sources for intelligent recommendations
 */

import { loadUnifiedData } from '../data/dataImporter.js';
import { analyzeOtherChannels, analyzeOtherVideos } from '../analysis/audienceAnalyzer.js';
import { getTopQuestions, getVideoIdeasFromComments } from '../analysis/commentAnalyzer.js';
import { analyzeVideoPatterns } from '../analysis/videoPatternAnalyzer.js';
import { matchNewsToPersona, getServingStatus } from '../personas/personaEngine.js';
import { getCompetitorPitches } from '../personas/competitorPitching.js';
import { PERSONAS } from '../personas/personaDefinitions.js';

// ============================================
// GET COMPREHENSIVE RECOMMENDATIONS
// ============================================
export async function getRecommendations() {
  console.log('🧠 Generating comprehensive recommendations...\n');
  
  // Load all analyses
  const [
    unifiedData,
    channelAnalysis,
    videoAnalysis,
    topQuestions,
    commentIdeas,
    videoPatterns,
    servingStatus,
    competitorPitches
  ] = await Promise.all([
    loadUnifiedData(),
    analyzeOtherChannels().catch(() => ({ error: 'Failed to analyze channels' })),
    analyzeOtherVideos().catch(() => ({ error: 'Failed to analyze videos' })),
    getTopQuestions(10).catch(() => []),
    getVideoIdeasFromComments(10).catch(() => []),
    analyzeVideoPatterns().catch(() => ({ error: 'Failed to analyze patterns' })),
    getServingStatus().catch(() => ({ needsAttention: [] })),
    getCompetitorPitches().catch(() => [])
  ]);
  
  const recommendations = {
    // Priority 1: Urgent persona needs
    urgentPersonaNeeds: getUrgentPersonaRecommendations(servingStatus),
    
    // Priority 2: Questions from audience
    audienceQuestions: formatQuestionRecommendations(topQuestions),
    
    // Priority 3: Topic opportunities from "other videos"
    topicOpportunities: formatTopicOpportunities(videoAnalysis),
    
    // Priority 4: Competitor pitches
    competitorInspiration: formatCompetitorPitches(competitorPitches),
    
    // Priority 5: Ideas from comments
    commentIdeas: formatCommentIdeas(commentIdeas),
    
    // Insights from all data
    insights: {
      audienceProfile: formatAudienceProfile(channelAnalysis),
      performancePatterns: formatPerformancePatterns(videoPatterns),
      growingPersonas: getGrowingPersonas(unifiedData)
    },
    
    // Summary
    summary: generateSummary(servingStatus, videoAnalysis, competitorPitches)
  };
  
  return recommendations;
}

// ============================================
// URGENT PERSONA RECOMMENDATIONS
// ============================================
function getUrgentPersonaRecommendations(servingStatus) {
  const urgent = [];
  
  if (!servingStatus || !servingStatus.needsAttention) return urgent;
  
  for (const persona of servingStatus.needsAttention || []) {
    const personaDef = PERSONAS[persona.id || persona];
    
    urgent.push({
      persona: persona.name || personaDef?.name || persona,
      icon: personaDef?.icon || '👤',
      reason: `لم يتم تقديم محتوى لهذا الجمهور هذا الأسبوع`,
      suggestedTopics: personaDef?.winningTopics?.slice(0, 3) || [],
      triggerKeywords: personaDef?.triggerKeywords?.slice(0, 5) || [],
      priority: 'URGENT'
    });
  }
  
  return urgent;
}

// ============================================
// FORMAT QUESTION RECOMMENDATIONS
// ============================================
function formatQuestionRecommendations(questions) {
  if (!Array.isArray(questions)) return [];
  
  return questions.map(q => ({
    question: q.question || q,
    source: 'من تعليقات الجمهور',
    likes: q.likes || 0,
    recommendation: `اصنع فيديو يجيب على: "${q.question || q}"`,
    priority: (q.likes || 0) > 10 ? 'HIGH' : 'MEDIUM'
  }));
}

// ============================================
// FORMAT TOPIC OPPORTUNITIES
// ============================================
function formatTopicOpportunities(videoAnalysis) {
  if (!videoAnalysis?.opportunities) return [];
  
  return videoAnalysis.opportunities.map(opp => ({
    topic: opp.topic,
    audienceInterest: opp.audienceInterest || opp.count,
    source: 'من "Other videos your audience watches"',
    recommendation: opp.recommendation || `جمهورك مهتم بـ "${opp.topic}"`,
    priority: (opp.audienceInterest || opp.count) > 5 ? 'HIGH' : 'MEDIUM'
  }));
}

// ============================================
// FORMAT COMPETITOR PITCHES
// ============================================
function formatCompetitorPitches(pitches) {
  if (!Array.isArray(pitches)) return [];
  
  return pitches.slice(0, 10).map(pitch => ({
    originalTitle: pitch.originalTitle || pitch.title,
    source: pitch.source || pitch.sourceName,
    sourceType: pitch.sourceType === 'direct' ? 'منافس مباشر' : 'محتوى مجاور',
    ourAngle: pitch.pitch?.suggestedAngle || pitch.suggestedAngle,
    targetPersonas: pitch.targetPersonas?.map(p => p.icon || p).join(' ') || '',
    priority: (pitch.targetPersonas?.length || 0) > 2 ? 'HIGH' : 'MEDIUM'
  }));
}

// ============================================
// FORMAT COMMENT IDEAS
// ============================================
function formatCommentIdeas(ideas) {
  if (!Array.isArray(ideas)) return [];
  
  return ideas.map(idea => ({
    idea: idea.idea || idea.question || idea.request,
    fromComment: idea.fromComment || idea.originalComment,
    likes: idea.likes || 0,
    source: 'اقتراح من التعليقات',
    priority: (idea.likes || 0) > 5 ? 'HIGH' : 'MEDIUM'
  }));
}

// ============================================
// FORMAT AUDIENCE PROFILE
// ============================================
function formatAudienceProfile(channelAnalysis) {
  if (!channelAnalysis || channelAnalysis.error) return null;
  
  return {
    discoveredPersonas: channelAnalysis.personaInsights || [],
    topChannelCategories: channelAnalysis.summary?.topCategories || [],
    insights: (channelAnalysis.personaInsights || []).map(p => p.recommendation)
  };
}

// ============================================
// FORMAT PERFORMANCE PATTERNS
// ============================================
function formatPerformancePatterns(patterns) {
  if (!patterns || patterns.error) return null;
  
  return {
    recommendations: patterns.recommendations || [],
    winningTopics: patterns.patterns?.topicPatterns?.winningTopics?.slice(0, 5) || [],
    bestPublishDays: patterns.patterns?.publishPatterns?.bestDays || [],
    avgCTR: patterns.patterns?.ctrPatterns?.avgCTR
  };
}

// ============================================
// GET GROWING PERSONAS
// ============================================
function getGrowingPersonas(unifiedData) {
  // Check for growing countries/segments
  const growing = [];
  
  if (unifiedData?.audience?.demographics?.countries) {
    for (const country of unifiedData.audience.demographics.countries) {
      if (country.trend === 'growing' || country.growth > 20) {
        growing.push({
          type: 'country',
          name: country.name,
          percentage: country.percentage,
          growth: country.growth,
          recommendation: `جمهور ${country.name} ينمو - زيادة المحتوى المناسب لهم`
        });
      }
    }
  }
  
  // Check persona report for strong personas
  if (unifiedData?.personaReport?.personas) {
    const topPersonas = unifiedData.personaReport.personas
      .filter(p => p.strength > 50)
      .slice(0, 3);
    
    topPersonas.forEach(p => {
      growing.push({
        type: 'persona',
        name: p.name,
        strength: p.strength,
        recommendation: `${p.name} - قوة: ${p.strength}%`
      });
    });
  }
  
  return growing;
}

// ============================================
// GENERATE SUMMARY
// ============================================
function generateSummary(servingStatus, videoAnalysis, pitches) {
  const summary = {
    personasNeedingAttention: (servingStatus?.needsAttention?.length || 0),
    topicOpportunities: (videoAnalysis?.opportunities?.length || 0),
    competitorPitches: (pitches?.length || 0),
    
    topRecommendation: null
  };
  
  // Pick top recommendation
  if (servingStatus?.needsAttention?.length > 0) {
    const persona = servingStatus.needsAttention[0];
    const personaDef = PERSONAS[persona.id || persona];
    summary.topRecommendation = {
      type: 'persona',
      message: `الأولوية: محتوى لـ ${personaDef?.name || persona.name || persona} - لم يُخدم هذا الأسبوع`,
      action: personaDef?.winningTopics?.[0] || 'راجع المواضيع المقترحة'
    };
  } else if (videoAnalysis?.opportunities?.length > 0) {
    summary.topRecommendation = {
      type: 'opportunity',
      message: `فرصة: "${videoAnalysis.opportunities[0].topic}" - جمهورك مهتم لكنك لم تغطيه`,
      action: 'اصنع فيديو عن هذا الموضوع'
    };
  }
  
  return summary;
}

// ============================================
// SCORE NEWS WITH ALL DATA
// ============================================
export async function scoreNewsWithAllData(newsItem) {
  const unifiedData = await loadUnifiedData();
  
  let score = 0;
  const factors = [];
  
  // 1. Persona match
  const personaMatch = matchNewsToPersona(newsItem);
  if (personaMatch.primaryPersona) {
    score += personaMatch.primaryPersona.score;
    factors.push({
      factor: 'persona_match',
      score: personaMatch.primaryPersona.score,
      detail: `يخدم ${personaMatch.primaryPersona.personaName}`
    });
  }
  
  // 2. Check if topic is in audience's "other videos"
  if (unifiedData?.audience?.otherVideos) {
    const topic = extractTopic(newsItem.title);
    const inOtherVideos = unifiedData.audience.otherVideos.some(
      v => {
        const videoTitle = v.videoTitle || v.title || '';
        return extractTopic(videoTitle) === topic;
      }
    );
    if (inOtherVideos) {
      score += 20;
      factors.push({
        factor: 'audience_interest',
        score: 20,
        detail: 'موضوع يشاهده جمهورك في قنوات أخرى'
      });
    }
  }
  
  // 3. Check if matches top questions
  if (unifiedData?.commentInsights?.topQuestions) {
    const matchesQuestion = unifiedData.commentInsights.topQuestions.some(
      q => {
        const question = (q.question || '').toLowerCase();
        const title = (newsItem.title || '').toLowerCase();
        return title.includes(question.substring(0, 20));
      }
    );
    if (matchesQuestion) {
      score += 25;
      factors.push({
        factor: 'answers_question',
        score: 25,
        detail: 'يجيب على سؤال من الجمهور'
      });
    }
  }
  
  // 4. Check winning topics
  if (unifiedData?.videoPatterns?.winningTopics) {
    const topic = extractTopic(newsItem.title);
    const isWinningTopic = unifiedData.videoPatterns.winningTopics.includes(topic);
    if (isWinningTopic) {
      score += 15;
      factors.push({
        factor: 'winning_topic',
        score: 15,
        detail: 'موضوع يحقق نتائج جيدة تاريخياً'
      });
    }
  }
  
  // 5. Check if competitor covered it
  if (unifiedData?.competitors) {
    const competitorCovered = unifiedData.competitors.some(c => {
      const recentVideos = c.recentVideos || [];
      return recentVideos.some(v => {
        const compTitle = (v.title || '').toLowerCase();
        const newsTitle = (newsItem.title || '').toLowerCase();
        return compTitle.includes(newsTitle.substring(0, 30)) || 
               newsTitle.includes(compTitle.substring(0, 30));
      });
    });
    if (competitorCovered) {
      score += 10;
      factors.push({
        factor: 'competitor_covered',
        score: 10,
        detail: 'المنافسون يغطون هذا الموضوع'
      });
    }
  }
  
  // 6. Check search terms
  if (unifiedData?.searchTerms?.terms) {
    const newsTitle = (newsItem.title || '').toLowerCase();
    const matchingSearch = unifiedData.searchTerms.terms.find(term => {
      const searchTerm = (term.term || '').toLowerCase();
      return newsTitle.includes(searchTerm) || searchTerm.includes(newsTitle.substring(0, 20));
    });
    if (matchingSearch && matchingSearch.views > 500) {
      score += 15;
      factors.push({
        factor: 'search_opportunity',
        score: 15,
        detail: `موضوع يبحث عنه الجمهور (${matchingSearch.views} views)`
      });
    }
  }
  
  return {
    newsItem,
    totalScore: score,
    factors,
    recommendation: score >= 50 ? 'HIGHLY_RECOMMENDED' : score >= 30 ? 'RECOMMENDED' : 'OPTIONAL'
  };
}

function extractTopic(title) {
  const lower = (title || '').toLowerCase();
  
  const topics = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'china': ['china', 'الصين', 'صين'],
    'russia': ['russia', 'روسيا', 'بوتين'],
    'oil': ['oil', 'نفط', 'النفط'],
    'dollar': ['dollar', 'دولار', 'الدولار'],
    'gold': ['gold', 'ذهب', 'الذهب'],
    'iran': ['iran', 'إيران', 'ايران'],
    'egypt': ['egypt', 'مصر'],
    'saudi': ['saudi', 'السعودية'],
    'war': ['war', 'حرب', 'صراع'],
    'economy': ['economy', 'اقتصاد']
  };
  
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(k => lower.includes(k))) {
      return topic;
    }
  }
  
  return null;
}




