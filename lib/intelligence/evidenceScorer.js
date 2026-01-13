/**
 * EVIDENCE-BASED SCORER V2
 * Combines data matching + Groq AI for smart scoring
 * NOW USES TOPIC INTELLIGENCE for evidence collection
 */

import fs from 'fs/promises';
import path from 'path';
import { analyzeTopic, generatePitch } from './topicAnalyzer.js';
import { PERSONAS } from './personas.js';
import { generateTopicFingerprint, isRelevantCompetitorVideo, compareTopics } from '../topicIntelligence.js';

// ============================================
// MAIN SCORING FUNCTION
// ============================================
export async function scoreWithEvidence(topic, options = {}) {
  const {
    sourceType = 'unknown',
    useAI = true,
    generatePitchText = true
  } = options;

  console.log(`\n📊 Scoring: "${topic.substring(0, 50)}..."`);

  // Initialize result
  const result = {
    topic,
    sourceType,
    timestamp: new Date().toISOString(),
    
    // Scores
    dataScore: 0,      // From your data (search, comments, etc.)
    aiScore: 0,        // From Groq analysis
    totalScore: 0,
    
    // Personas
    primaryPersona: null,
    secondaryPersonas: [],
    
    // Evidence (with proof!)
    evidence: [],
    
    // AI Analysis
    aiAnalysis: null,
    
    // Final outputs
    recommendation: 'SKIP',
    suggestedAngle: null,
    pitch: null,
    urgency: 'evergreen'
  };

  // ============================================
  // STEP 1: DATA-BASED SCORING (FREE)
  // ============================================
  const data = await loadAllData();
  
  // Check search terms
  const searchMatch = matchSearchTerms(topic, data.searchTerms);
  if (searchMatch.matched) {
    result.dataScore += searchMatch.points;
    result.evidence.push({
      type: '🔍 SEARCH_DATA',
      summary: `${searchMatch.totalViews.toLocaleString()} بحث`,
      detail: searchMatch.matchedTerms.map(t => `"${t.term}" = ${t.views}`).join(', '),
      points: searchMatch.points
    });
  }

  // Check comments (already filtered by AI)
  const commentMatch = matchComments(topic, data.comments);
  if (commentMatch.matched) {
    result.dataScore += commentMatch.points;
    result.evidence.push({
      type: '💬 AUDIENCE_REQUEST',
      summary: `${commentMatch.count} طلب من الجمهور`,
      detail: commentMatch.requests.slice(0, 2).join(' | '),
      points: commentMatch.points
    });
  }

  // Check audience videos
  const videoMatch = matchAudienceVideos(topic, data.audienceVideos);
  if (videoMatch.matched) {
    result.dataScore += videoMatch.points;
    result.evidence.push({
      type: '📺 AUDIENCE_WATCHES',
      summary: `جمهورك يشاهد ${videoMatch.count} فيديو مشابه`,
      detail: videoMatch.titles.slice(0, 2).join(' | '),
      points: videoMatch.points
    });
  }

  // Check manual trends
  const manualMatch = matchManualTrends(topic, data.manualTrends);
  if (manualMatch.matched) {
    result.dataScore += manualMatch.points;
    result.evidence.push({
      type: '👀 MANUAL_SIGNAL',
      summary: 'أنت رصدت هذا الـ Trend',
      detail: manualMatch.note,
      points: manualMatch.points
    });
    result.urgency = 'this_week';
  }

  // ============================================
  // STEP 2: AI-BASED SCORING (CHEAP)
  // ============================================
  if (useAI) {
    const aiResult = await analyzeTopic(topic, { source: sourceType });
    
    if (aiResult.success && aiResult.analysis) {
      result.aiAnalysis = aiResult.analysis;
      
      // AI relevance score
      result.aiScore = Math.round(aiResult.analysis.relevanceScore * 0.3);
      
      // Set personas from AI
      result.primaryPersona = {
        id: aiResult.analysis.primaryPersona,
        name: PERSONAS[aiResult.analysis.primaryPersona]?.name || 'Unknown',
        reason: aiResult.analysis.personaReasons?.[aiResult.analysis.primaryPersona] || ''
      };
      
      result.secondaryPersonas = (aiResult.analysis.secondaryPersonas || [])
        .map(id => ({
          id,
          name: PERSONAS[id]?.name || 'Unknown'
        }));
      
      // Add AI evidence
      result.evidence.push({
        type: '🤖 AI_ANALYSIS',
        summary: `يخدم ${result.primaryPersona.name}`,
        detail: aiResult.analysis.whyRelevant,
        points: result.aiScore
      });
      
      // Set suggested angle from AI
      result.suggestedAngle = aiResult.analysis.suggestedAngle;
      result.urgency = aiResult.analysis.urgency || 'evergreen';
    }
  }

  // ============================================
  // STEP 3: CALCULATE FINAL SCORE
  // ============================================
  result.totalScore = Math.min(100, result.dataScore + result.aiScore);
  
  // Determine recommendation
  if (result.totalScore >= 70) {
    result.recommendation = 'HIGHLY_RECOMMENDED';
  } else if (result.totalScore >= 50) {
    result.recommendation = 'RECOMMENDED';
  } else if (result.totalScore >= 30) {
    result.recommendation = 'CONSIDER';
  } else {
    result.recommendation = 'SKIP';
  }

  // ============================================
  // STEP 4: GENERATE PITCH (Optional)
  // ============================================
  if (generatePitchText && result.recommendation !== 'SKIP' && result.primaryPersona) {
    const evidenceStrings = result.evidence.map(e => e.summary);
    const pitchResult = await generatePitch(
      topic,
      result.primaryPersona.id,
      evidenceStrings
    );
    
    if (pitchResult.success) {
      result.pitch = pitchResult.pitch;
    }
  }

  console.log(`   Score: ${result.totalScore}/100 → ${result.recommendation}`);
  
  return result;
}

// Export alias for backward compatibility
export async function scoreTopicWithEvidence(topic, sourceType = 'unknown') {
  return scoreWithEvidence(topic, { sourceType, useAI: true });
}

// ============================================
// DATA MATCHING FUNCTIONS
// ============================================
function matchSearchTerms(topic, searchData) {
  if (!searchData?.terms) return { matched: false };
  
  const topicLower = topic.toLowerCase();
  const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2);
  
  const matched = searchData.terms.filter(t => {
    const termLower = t.term.toLowerCase();
    return topicWords.some(w => termLower.includes(w)) ||
           topicLower.includes(termLower);
  });
  
  if (matched.length === 0) return { matched: false };
  
  const totalViews = matched.reduce((sum, t) => sum + (t.views || 0), 0);
  
  return {
    matched: true,
    points: Math.min(35, Math.round(totalViews / 400)),
    totalViews,
    matchedTerms: matched.slice(0, 5)
  };
}

function matchComments(topic, commentsData) {
  if (!commentsData?.actionable) return { matched: false };
  
  const topicLower = topic.toLowerCase();
  const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2);
  
  const matched = commentsData.actionable.filter(c => {
    const idea = (c.analysis?.videoIdea || '').toLowerCase();
    const request = (c.analysis?.extractedRequest || '').toLowerCase();
    return topicWords.some(w => idea.includes(w) || request.includes(w));
  });
  
  if (matched.length === 0) return { matched: false };
  
  return {
    matched: true,
    points: Math.min(30, 10 + matched.length * 5),
    count: matched.length,
    requests: matched.map(c => c.analysis?.videoIdea || c.analysis?.extractedRequest).slice(0, 3)
  };
}

function matchAudienceVideos(topic, videosData) {
  if (!videosData?.videos) return { matched: false };
  
  const topicLower = topic.toLowerCase();
  const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2);
  
  const matched = videosData.videos.filter(v => {
    const title = (v.title || '').toLowerCase();
    return topicWords.some(w => title.includes(w));
  });
  
  if (matched.length === 0) return { matched: false };
  
  return {
    matched: true,
    points: Math.min(20, matched.length * 4),
    count: matched.length,
    titles: matched.map(v => v.title.substring(0, 50)).slice(0, 3)
  };
}

function matchManualTrends(topic, trends) {
  if (!trends || trends.length === 0) return { matched: false };
  
  const topicLower = topic.toLowerCase();
  
  const matched = trends.find(t => {
    const trendTopic = (t.topic || '').toLowerCase();
    const trendNote = (t.note || '').toLowerCase();
    return topicLower.includes(trendTopic) || 
           trendTopic.includes(topicLower) ||
           topicLower.split(/\s+/).some(w => trendNote.includes(w));
  });
  
  if (!matched) return { matched: false };
  
  return {
    matched: true,
    points: 15,
    note: matched.note || matched.topic
  };
}

// ============================================
// LOAD DATA
// ============================================
async function loadAllData() {
  const data = {};
  
  const basePath = process.cwd();
  const files = {
    searchTerms: path.join(basePath, 'data/processed/search_terms.json'),
    comments: path.join(basePath, 'data/processed/smart_comments.json'), // AI-filtered comments
    audienceVideos: path.join(basePath, 'data/processed/audience_videos.json'),
    manualTrends: path.join(basePath, 'data/manual_trends.json')
  };
  
  for (const [key, filePath] of Object.entries(files)) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      data[key] = JSON.parse(content);
    } catch (e) {
      // File doesn't exist or invalid JSON - that's okay
      data[key] = null;
    }
  }
  
  return data;
}

// ============================================
// TOPIC INTELLIGENCE-BASED EVIDENCE COLLECTION (NEW)
// ============================================

/**
 * Collect evidence for a signal using Topic Intelligence
 * Uses entity extraction and semantic matching
 */
export async function collectEvidence(signal, showData = {}) {
  const evidence = [];
  
  // Generate fingerprint
  const fingerprint = await generateTopicFingerprint({
    title: typeof signal === 'string' ? signal : (signal.title || signal.topic || ''),
    description: typeof signal === 'string' ? '' : (signal.description || ''),
    id: typeof signal === 'string' ? undefined : signal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for speed
  });
  
  // === ENTITY EVIDENCE ===
  if (fingerprint.entities.people.length > 0) {
    evidence.push({
      type: 'entities',
      category: 'people',
      icon: '👤',
      text: `People: ${fingerprint.entities.people.join(', ')}`,
      items: fingerprint.entities.people
    });
  }
  
  if (fingerprint.entities.countries.length > 0) {
    evidence.push({
      type: 'entities',
      category: 'countries',
      icon: '🌍',
      text: `Countries: ${fingerprint.entities.countries.join(', ')}`,
      items: fingerprint.entities.countries
    });
  }
  
  if (fingerprint.entities.topics.length > 0) {
    evidence.push({
      type: 'entities',
      category: 'topics',
      icon: '📌',
      text: `Topics: ${fingerprint.entities.topics.join(', ')}`,
      items: fingerprint.entities.topics
    });
  }
  
  if (fingerprint.entities.organizations && fingerprint.entities.organizations.length > 0) {
    evidence.push({
      type: 'entities',
      category: 'organizations',
      icon: '🏢',
      text: `Organizations: ${fingerprint.entities.organizations.join(', ')}`,
      items: fingerprint.entities.organizations
    });
  }
  
  // === CATEGORY EVIDENCE ===
  evidence.push({
    type: 'category',
    icon: '🏷️',
    text: `Category: ${fingerprint.topicCategory}`,
    category: fingerprint.topicCategory
  });
  
  // === COMPETITOR COVERAGE EVIDENCE ===
  if (showData.competitorVideos) {
    const matchingVideos = [];
    
    for (const video of showData.competitorVideos.slice(0, 30)) {
      const match = await isRelevantCompetitorVideo(
        { title: typeof signal === 'string' ? signal : signal.title, fingerprint },
        { title: video.title }
      );
      
      if (match.relevant) {
        matchingVideos.push({
          title: video.title,
          channel: video.channelName || video.channel,
          views: video.views,
          confidence: match.confidence
        });
      }
    }
    
    if (matchingVideos.length > 0) {
      evidence.push({
        type: 'competitor_coverage',
        icon: '📺',
        text: `${matchingVideos.length} competitor(s) covered this topic`,
        videos: matchingVideos
      });
    }
  }
  
  // === YOUR COVERAGE EVIDENCE ===
  if (showData.yourVideos) {
    const coveredBefore = [];
    
    for (const video of showData.yourVideos.slice(0, 50)) {
      const match = await compareTopics(
        { title: typeof signal === 'string' ? signal : signal.title, fingerprint },
        { title: video.title },
        { requireSameStory: false }
      );
      
      if (match.relationship === 'same_story' || 
          (match.relationship === 'related' && match.confidence >= 0.7)) {
        coveredBefore.push({
          title: video.title,
          views: video.views,
          publishedAt: video.publishedAt,
          relationship: match.relationship,
          confidence: match.confidence
        });
      }
    }
    
    if (coveredBefore.length > 0) {
      evidence.push({
        type: 'your_coverage',
        icon: '🎥',
        text: `You've covered similar: ${coveredBefore[0].title.substring(0, 40)}...`,
        videos: coveredBefore,
        hasCovered: true
      });
    } else {
      evidence.push({
        type: 'your_coverage',
        icon: '✨',
        text: `You haven't covered this topic`,
        hasCovered: false
      });
    }
  }
  
  // === SOURCE EVIDENCE ===
  if (signal.source) {
    evidence.push({
      type: 'source',
      icon: '📰',
      text: `Source: ${signal.source}`,
      source: signal.source,
      sourceUrl: signal.sourceUrl || signal.url
    });
  }
  
  // === TIMING EVIDENCE ===
  const publishedAt = signal.publishedAt || signal.published_at;
  if (publishedAt) {
    const hoursAgo = (new Date() - new Date(publishedAt)) / (1000 * 60 * 60);
    let freshness = 'old';
    if (hoursAgo < 4) freshness = 'breaking';
    else if (hoursAgo < 12) freshness = 'fresh';
    else if (hoursAgo < 24) freshness = 'recent';
    else if (hoursAgo < 48) freshness = 'today';
    
    evidence.push({
      type: 'timing',
      icon: '⏰',
      text: `Published ${Math.round(hoursAgo)} hours ago`,
      hoursAgo: Math.round(hoursAgo),
      freshness
    });
  }
  
  return {
    evidence,
    fingerprint,
    summary: {
      entityCount: fingerprint.entities.people.length + 
                   fingerprint.entities.countries.length + 
                   fingerprint.entities.topics.length,
      category: fingerprint.topicCategory,
      evidenceCount: evidence.length
    }
  };
}
