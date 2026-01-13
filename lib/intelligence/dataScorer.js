/**
 * DATA SCORER
 * Scores topics based on audience data (search, comments, videos)
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================
// SCORE WITH DATA
// ============================================
export async function scoreWithData(topic) {
  const data = await loadAllData();
  
  const result = {
    score: 0,
    evidence: [],
    topPersona: null
  };
  
  // Check search terms
  const searchMatch = matchSearchTerms(topic, data.searchTerms);
  if (searchMatch.matched) {
    result.score += searchMatch.points;
    result.evidence.push({
      type: '🔍 SEARCH_DATA',
      summary: `${searchMatch.totalViews.toLocaleString()} بحث`,
      points: searchMatch.points
    });
  }
  
  // Check comments
  const commentMatch = matchComments(topic, data.comments);
  if (commentMatch.matched) {
    result.score += commentMatch.points;
    result.evidence.push({
      type: '💬 AUDIENCE_REQUEST',
      summary: `${commentMatch.count} طلب من الجمهور`,
      points: commentMatch.points
    });
  }
  
  // Check audience videos
  const videoMatch = matchAudienceVideos(topic, data.audienceVideos);
  if (videoMatch.matched) {
    result.score += videoMatch.points;
    result.evidence.push({
      type: '📺 AUDIENCE_WATCHES',
      summary: `جمهورك يشاهد ${videoMatch.count} فيديو مشابه`,
      points: videoMatch.points
    });
  }
  
  return result;
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

// ============================================
// LOAD DATA
// ============================================
async function loadAllData() {
  const data = {};
  
  const basePath = process.cwd();
  const files = {
    searchTerms: path.join(basePath, 'data/processed/search_terms.json'),
    comments: path.join(basePath, 'data/processed/smart_comments.json'),
    audienceVideos: path.join(basePath, 'data/processed/audience_videos.json')
  };
  
  for (const [key, filePath] of Object.entries(files)) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      data[key] = JSON.parse(content);
    } catch (e) {
      data[key] = null;
    }
  }
  
  return data;
}




