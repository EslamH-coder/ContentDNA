/**
 * EVIDENCE COLLECTOR
 * Finds ALL evidence for a topic from ALL data sources
 */

import { dataStore } from '../data/dataStore.js';

export async function collectEvidence(topic, description = '') {
  const data = await dataStore.load();
  
  const evidence = {
    topic,
    timestamp: new Date().toISOString(),
    
    // Evidence categories
    searchEvidence: null,
    audienceEvidence: null,
    competitorEvidence: null,
    commentEvidence: null,
    personaMatch: null,
    
    // Scores
    scores: {
      search: 0,
      audience: 0,
      competitor: 0,
      comments: 0,
      persona: 0,
      total: 0
    },
    
    // Summary
    hasEvidence: false,
    evidenceStrength: 'NONE', // NONE, WEAK, MODERATE, STRONG
    recommendationLevel: 'SKIP'
  };

  const topicKeywords = dataStore.extractKeywords(topic);
  const descKeywords = description ? dataStore.extractKeywords(description) : [];
  const allKeywords = [...new Set([...topicKeywords, ...descKeywords])];

  // ============================================
  // 1. SEARCH TERMS EVIDENCE
  // ============================================
  evidence.searchEvidence = findSearchEvidence(allKeywords, data);
  evidence.scores.search = evidence.searchEvidence.score;

  // ============================================
  // 2. AUDIENCE VIDEOS EVIDENCE
  // ============================================
  evidence.audienceEvidence = findAudienceEvidence(allKeywords, data);
  evidence.scores.audience = evidence.audienceEvidence.score;

  // ============================================
  // 3. COMPETITOR EVIDENCE
  // ============================================
  evidence.competitorEvidence = findCompetitorEvidence(allKeywords, data);
  evidence.scores.competitor = evidence.competitorEvidence.score;

  // ============================================
  // 4. COMMENT REQUESTS EVIDENCE
  // ============================================
  evidence.commentEvidence = findCommentEvidence(allKeywords, data);
  evidence.scores.comments = evidence.commentEvidence.score;

  // ============================================
  // 5. PERSONA MATCH
  // ============================================
  evidence.personaMatch = findPersonaMatch(allKeywords, data);
  evidence.scores.persona = evidence.personaMatch.score;

  // ============================================
  // CALCULATE TOTAL
  // ============================================
  evidence.scores.total = Math.min(100,
    evidence.scores.search +
    evidence.scores.audience +
    evidence.scores.competitor +
    evidence.scores.comments +
    evidence.scores.persona
  );

  // Determine evidence strength
  const totalEvidence = 
    (evidence.searchEvidence.found ? 1 : 0) +
    (evidence.audienceEvidence.found ? 1 : 0) +
    (evidence.competitorEvidence.found ? 1 : 0) +
    (evidence.commentEvidence.found ? 1 : 0);

  evidence.hasEvidence = totalEvidence > 0;
  
  // Base recommendation on BOTH evidence count AND score
  // If score is high enough, upgrade recommendation level
  if (totalEvidence >= 3 || evidence.scores.total >= 60) {
    evidence.evidenceStrength = 'STRONG';
    evidence.recommendationLevel = 'HIGHLY_RECOMMENDED';
  } else if (totalEvidence === 2 || evidence.scores.total >= 40) {
    evidence.evidenceStrength = 'MODERATE';
    evidence.recommendationLevel = 'RECOMMENDED';
  } else if (totalEvidence === 1 || evidence.scores.total >= 20) {
    evidence.evidenceStrength = 'WEAK';
    evidence.recommendationLevel = 'CONSIDER';
  } else {
    evidence.evidenceStrength = 'NONE';
    evidence.recommendationLevel = 'SKIP';
  }

  return evidence;
}

// ============================================
// SEARCH EVIDENCE
// ============================================
function findSearchEvidence(keywords, data) {
  const result = {
    found: false,
    score: 0,
    totalViews: 0,
    matchedTerms: [],
    summary: ''
  };

  for (const kw of keywords) {
    const matches = [];
    
    // Direct match
    if (data.searchTermsMap.has(kw)) {
      const term = data.searchTermsMap.get(kw);
      if (term.views) {
        matches.push(term);
      }
      // Also check related terms
      if (term.related) {
        matches.push(...term.related.filter(t => t.views > 100));
      }
    }
    
    // Partial match in terms
    for (const [key, term] of data.searchTermsMap) {
      if (key.includes(kw) && term.views > 100 && !matches.includes(term)) {
        matches.push(term);
      }
    }
    
    result.matchedTerms.push(...matches);
  }

  // Remove duplicates and sort by views
  result.matchedTerms = [...new Map(
    result.matchedTerms.map(t => [t.term, t])
  ).values()].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  // Sanitize matched terms to remove circular references
  result.matchedTerms = result.matchedTerms.map(term => ({
    term: term.term,
    views: term.views || 0
    // Explicitly exclude 'related' property to break circular references
  }));

  if (result.matchedTerms.length > 0) {
    result.found = true;
    result.totalViews = result.matchedTerms.reduce((sum, t) => sum + (t.views || 0), 0);
    
    // Score: max 30 points
    // More generous: 1 point per 50 views (was 300, too harsh)
    result.score = Math.min(30, Math.round(result.totalViews / 50));
    
    result.summary = `${result.totalViews.toLocaleString()} بحث: ${
      result.matchedTerms.slice(0, 3).map(t => `"${t.term}"`).join('، ')
    }`;
  }

  return result;
}

// ============================================
// AUDIENCE VIDEOS EVIDENCE
// ============================================
function findAudienceEvidence(keywords, data) {
  const result = {
    found: false,
    score: 0,
    matchedVideos: [],
    summary: ''
  };

  for (const kw of keywords) {
    if (data.audienceVideoKeywords.has(kw)) {
      const videos = data.audienceVideoKeywords.get(kw);
      result.matchedVideos.push(...videos);
    }
  }

  // Remove duplicates
  result.matchedVideos = [...new Map(
    result.matchedVideos.map(v => [v.id || v.title, v])
  ).values()].slice(0, 10);

  if (result.matchedVideos.length > 0) {
    result.found = true;
    
    // Score: max 25 points (2.5 per video, max 10 videos)
    result.score = Math.min(25, result.matchedVideos.length * 2.5);
    
    result.summary = `جمهورك شاهد ${result.matchedVideos.length} فيديو مشابه`;
  }

  return result;
}

// ============================================
// COMPETITOR EVIDENCE
// ============================================
function findCompetitorEvidence(keywords, data) {
  const result = {
    found: false,
    score: 0,
    matchedVideos: [],
    channels: new Set(),
    recentCoverage: false,
    summary: ''
  };

  for (const kw of keywords) {
    if (data.competitorKeywords.has(kw)) {
      const videos = data.competitorKeywords.get(kw);
      for (const video of videos) {
        result.matchedVideos.push(video);
        if (video.channel) result.channels.add(video.channel);
      }
    }
  }

  // Remove duplicates
  result.matchedVideos = [...new Map(
    result.matchedVideos.map(v => [v.id || v.title, v])
  ).values()].slice(0, 10);

  // Check if any coverage is recent (last 7 days)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  result.recentCoverage = result.matchedVideos.some(v => {
    const published = v.publishedAt || v.date;
    if (!published) return false;
    return new Date(published).getTime() > oneWeekAgo;
  });

  if (result.matchedVideos.length > 0) {
    result.found = true;
    
    // Score: max 20 points
    let score = result.matchedVideos.length * 2;
    if (result.recentCoverage) score += 5; // Bonus for recent coverage
    result.score = Math.min(20, score);
    
    const channelList = [...result.channels].slice(0, 3);
    result.summary = `${result.matchedVideos.length} فيديو من المنافسين${channelList.length > 0 ? ` (${channelList.join('، ')})` : ''}`;
    
    if (result.recentCoverage) {
      result.summary += ' - تغطية حديثة!';
    }
  }

  return result;
}

// ============================================
// COMMENT EVIDENCE
// ============================================
function findCommentEvidence(keywords, data) {
  const result = {
    found: false,
    score: 0,
    matchedRequests: [],
    summary: ''
  };

  for (const request of data.commentRequests || []) {
    const requestText = `${request.analysis?.videoIdea || ''} ${request.analysis?.extractedRequest || ''} ${request.text || ''}`.toLowerCase();
    
    for (const kw of keywords) {
      if (requestText.includes(kw.toLowerCase())) {
        result.matchedRequests.push(request);
        break;
      }
    }
  }

  // Remove duplicates
  result.matchedRequests = result.matchedRequests.slice(0, 5);

  if (result.matchedRequests.length > 0) {
    result.found = true;
    
    // Score: max 15 points
    result.score = Math.min(15, result.matchedRequests.length * 5);
    
    result.summary = `${result.matchedRequests.length} طلب من الجمهور`;
  }

  return result;
}

// ============================================
// PERSONA MATCH
// ============================================
function findPersonaMatch(keywords, data) {
  const result = {
    found: false,
    score: 0,
    primaryPersona: null,
    secondaryPersonas: [],
    summary: ''
  };

  if (!data.personas) return result;

  const personaScores = {};

  for (const [id, persona] of Object.entries(data.personas)) {
    let score = 0;
    
    const personaKeywords = persona.keywords || persona.triggerKeywords || [];
    const personaInterests = persona.interests?.primary || persona.interests || [];
    
    for (const kw of keywords) {
      // Check persona keywords
      for (const personaKw of personaKeywords) {
        if (personaKw.includes(kw) || kw.includes(personaKw)) {
          score += 3;
        }
      }
      
      // Check interests
      for (const interest of personaInterests) {
        if (interest.includes(kw) || kw.includes(interest)) {
          score += 2;
        }
      }
    }
    
    if (score > 0) {
      personaScores[id] = { persona, score };
    }
  }

  // Sort by score
  const sorted = Object.entries(personaScores)
    .sort((a, b) => b[1].score - a[1].score);

  if (sorted.length > 0) {
    result.found = true;
    result.primaryPersona = {
      id: sorted[0][0],
      ...sorted[0][1].persona,
      matchScore: sorted[0][1].score
    };
    
    result.secondaryPersonas = sorted.slice(1, 3).map(([id, data]) => ({
      id,
      name: data.persona.name || data.persona.nameEn,
      matchScore: data.score
    }));
    
    // Score: max 10 points
    result.score = Math.min(10, sorted[0][1].score);
    
    result.summary = result.primaryPersona.name || result.primaryPersona.nameEn;
  }

  return result;
}

