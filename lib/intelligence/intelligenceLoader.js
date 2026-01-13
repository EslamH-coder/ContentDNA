/**
 * INTELLIGENCE LOADER
 * Loads all available intelligence before generation
 */

import { getChannels, getVideos, getInsights } from '../competitors/competitorStore.js';
import { loadDNA } from '../dna/dnaStorage.js';
import { BANNED_PHRASES } from '../voice/bannedPhrases.js';

// ============================================
// LOAD ALL INTELLIGENCE
// ============================================
export async function loadIntelligence() {
  console.log('🧠 Loading intelligence...');
  
  const intelligence = {
    // Channel DNA
    dna: await loadChannelDNA(),
    
    // Competitor data
    competitors: await loadCompetitorIntelligence(),
    
    // Saved videos for reference
    savedVideos: await loadSavedVideos(),
    
    // Insights discovered
    insights: await loadInsightsData(),
    
    // Timestamp
    loadedAt: new Date().toISOString()
  };
  
  console.log(`   ✅ Loaded intelligence:`);
  console.log(`      - ${intelligence.competitors.recentVideos.length} competitor videos`);
  console.log(`      - ${intelligence.savedVideos.length} saved reference videos`);
  console.log(`      - ${intelligence.insights.length} insights`);
  
  return intelligence;
}

// ============================================
// LOAD CHANNEL DNA
// ============================================
async function loadChannelDNA() {
  try {
    const dna = await loadDNA();
    
    return {
      // Banned phrases - CRITICAL
      bannedPhrases: BANNED_PHRASES,
      
      // Exaggeration words to avoid unless in source
      exaggerationWords: [
        'أكبر في التاريخ',
        'الأكبر على الإطلاق',
        'لأول مرة في التاريخ',
        'غير مسبوق',
        'تاريخي',
        'كارثي',
        'مدمر',
        'ساحق',
        'هائل',
        'ضخم جداً'
      ],
      
      // Winning patterns from top videos
      winningPatterns: {
        questionStarters: ['هل', 'كيف', 'لماذا', 'ماذا لو'],
        bestPerformer: 'هل', // 1.03M avg
        
        // Good title structures
        titleStructures: [
          'هل + [entity] + [action] + [consequence]?',
          'كيف + [entity] + [action]?',
          'لماذا + [entity] + [action]?',
          '[entity] vs [entity]: [question]'
        ]
      },
      
      // Top performing topics from DNA
      topTopics: dna?.topics ? Object.entries(dna.topics)
        .sort((a, b) => (b[1]?.avg_views || 0) - (a[1]?.avg_views || 0))
        .slice(0, 10)
        .map(([topic, data]) => ({
          topic,
          avgViews: data.avg_views || 0,
          notes: data.notes || []
        })) : [],
      
      // Top performing hooks from DNA
      topHooks: dna?.hooks?.patterns ? Object.entries(dna.hooks.patterns)
        .sort((a, b) => (b[1]?.avg_views || 0) - (a[1]?.avg_views || 0))
        .slice(0, 5)
        .map(([pattern, data]) => ({
          pattern,
          avgViews: data.avg_views || 0,
          bestExample: data.best_example || null
        })) : []
    };
  } catch (e) {
    console.warn('   ⚠️ Could not load DNA, using defaults');
    return {
      bannedPhrases: BANNED_PHRASES,
      exaggerationWords: [],
      winningPatterns: {
        questionStarters: ['هل', 'كيف', 'لماذا'],
        bestPerformer: 'هل',
        titleStructures: []
      },
      topTopics: [],
      topHooks: []
    };
  }
}

// ============================================
// LOAD COMPETITOR INTELLIGENCE
// ============================================
async function loadCompetitorIntelligence() {
  try {
    const channels = await getChannels();
    const activeChannels = channels.filter(c => c.monitor === true);
    
    // Get recent videos from competitors (from stored data)
    const recentVideos = [];
    const topicsCovered = {};
    
    // Get videos from stored competitor data
    const allVideos = await getVideos();
    
    // Get recent videos (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    allVideos
      .filter(v => {
        if (!v.pubDate) return false;
        return new Date(v.pubDate) >= thirtyDaysAgo;
      })
      .slice(0, 50) // Limit to 50 most recent
      .forEach(video => {
        recentVideos.push({
          title: video.title,
          channel: video.channelName || 'Unknown',
          type: video.contentType || 'direct_competitor',
          pubDate: video.pubDate
        });
        
        // Track topics
        const topics = extractTopics(video.title);
        topics.forEach(topic => {
          topicsCovered[topic] = (topicsCovered[topic] || 0) + 1;
        });
      });
    
    return {
      activeChannels: activeChannels.length,
      recentVideos,
      topicsCovered: Object.entries(topicsCovered)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      
      // What competitors are covering NOW
      hotTopics: Object.entries(topicsCovered)
        .filter(([_, count]) => count >= 2)
        .map(([topic]) => topic)
    };
  } catch (e) {
    console.warn('   ⚠️ Could not load competitor intelligence:', e.message);
    return {
      activeChannels: 0,
      recentVideos: [],
      topicsCovered: [],
      hotTopics: []
    };
  }
}

function extractTopics(title) {
  const topics = [];
  const lower = title.toLowerCase();
  
  const topicKeywords = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'china': ['china', 'الصين', 'صين'],
    'russia': ['russia', 'روسيا'],
    'iran': ['iran', 'إيران', 'ايران'],
    'oil': ['oil', 'نفط', 'النفط'],
    'dollar': ['dollar', 'دولار', 'الدولار'],
    'fed': ['fed', 'فيدرالي', 'الفيدرالي'],
    'ai': ['ai', 'الذكاء الاصطناعي'],
    'saudi': ['saudi', 'السعودية', 'سعودي'],
    'egypt': ['egypt', 'مصر', 'مصري']
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => lower.includes(k))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

// ============================================
// LOAD SAVED VIDEOS (For reference/inspiration)
// ============================================
async function loadSavedVideos() {
  try {
    const videos = await getVideos();
    
    return videos.map(v => ({
      title: v.title,
      reason: v.reason || '',
      learnPoints: v.learnPoints || [],
      contentType: v.contentType || 'unknown',
      tags: v.tags || []
    }));
  } catch (e) {
    console.warn('   ⚠️ Could not load saved videos:', e.message);
    return [];
  }
}

// ============================================
// LOAD INSIGHTS
// ============================================
async function loadInsightsData() {
  try {
    const insights = await getInsights({ status: 'new' });
    
    return insights
      .filter(i => i.actionable)
      .map(i => ({
        type: i.type || 'general',
        title: i.title || '',
        action: i.action || ''
      }));
  } catch (e) {
    console.warn('   ⚠️ Could not load insights:', e.message);
    return [];
  }
}

