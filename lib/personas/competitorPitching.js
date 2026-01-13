/**
 * COMPETITOR PITCHING
 * Uses competitors and adjacent content to find winning topics for each persona
 */

import { PERSONAS } from './personaDefinitions.js';
import { getChannelsByType, getVideos } from '../competitors/competitorStore.js';
import { getServingStatus } from './personaEngine.js';

// ============================================
// GET TOPIC PITCHES FROM COMPETITORS
// ============================================
export async function getCompetitorPitches() {
  const pitches = [];
  
  try {
    // Get all competitor channels
    const directCompetitors = await getChannelsByType('direct_competitor');
    const adjacentContent = await getChannelsByType('adjacent_content');
    
    // Get saved videos from competitors
    const allVideos = await getVideos();
    
    // Filter videos by type
    const competitorVideos = allVideos.filter(v => 
      v.contentType === 'direct_competitor' || 
      directCompetitors.some(c => c.channelId === v.channelId)
    );
    
    const adjacentVideos = allVideos.filter(v => 
      v.contentType === 'adjacent_content' ||
      adjacentContent.some(c => c.channelId === v.channelId)
    );
    
    // Analyze competitor videos
    for (const video of competitorVideos.slice(0, 20)) {
      const pitch = analyzeVideoForPitch(video, { name: video.channelName || 'Unknown' }, 'direct');
      if (pitch) pitches.push(pitch);
    }
    
    // Analyze adjacent content for crossover ideas
    for (const video of adjacentVideos.slice(0, 10)) {
      const pitch = analyzeVideoForPitch(video, { name: video.channelName || 'Unknown' }, 'adjacent');
      if (pitch) pitches.push(pitch);
    }
  } catch (e) {
    console.error('Error getting competitor pitches:', e);
  }
  
  // Match pitches to personas
  const pitchesWithPersonas = pitches.map(pitch => ({
    ...pitch,
    targetPersonas: findMatchingPersonas(pitch)
  }));
  
  // Sort by relevance
  pitchesWithPersonas.sort((a, b) => b.targetPersonas.length - a.targetPersonas.length);
  
  return pitchesWithPersonas;
}

// ============================================
// ANALYZE VIDEO FOR PITCH
// ============================================
function analyzeVideoForPitch(video, source, sourceType) {
  const title = video.title || '';
  
  // Skip non-relevant videos
  if (title.length < 20) return null;
  
  // Extract topic and angle
  const topic = extractMainTopic(title);
  const angle = extractAngle(title);
  
  if (!topic) return null;
  
  return {
    originalTitle: title,
    source: source.name,
    sourceType,
    topic,
    angle,
    
    // Pitch details
    pitch: {
      topic,
      whyItWorks: sourceType === 'direct' 
        ? `منافس مباشر يغطي هذا الموضوع`
        : `محتوى مجاور يجذب نفس الجمهور`,
      suggestedAngle: generateOurAngle(title, topic),
      differentiator: `زاوية ${PERSONAS.geopolitics?.name || 'المخبر'}: التأثير على العرب`
    },
    
    // For tracking
    fetchedAt: new Date().toISOString(),
    videoUrl: video.url || video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : null
  };
}

function extractMainTopic(title) {
  const lower = title.toLowerCase();
  
  const topics = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'china': ['china', 'الصين', 'صين'],
    'russia': ['russia', 'روسيا'],
    'iran': ['iran', 'إيران', 'ايران'],
    'oil': ['oil', 'نفط', 'النفط', 'opec', 'أوبك'],
    'dollar': ['dollar', 'دولار', 'الدولار'],
    'gold': ['gold', 'ذهب', 'الذهب'],
    'fed': ['fed', 'فيدرالي', 'الفيدرالي', 'interest rate'],
    'ai': ['ai', 'artificial intelligence', 'الذكاء الاصطناعي', 'chatgpt'],
    'crypto': ['bitcoin', 'crypto', 'بيتكوين', 'كريبتو'],
    'egypt': ['egypt', 'مصر', 'مصري'],
    'saudi': ['saudi', 'السعودية', 'سعودي']
  };
  
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(k => lower.includes(k))) {
      return topic;
    }
  }
  
  return null;
}

function extractAngle(title) {
  if (!title) return 'statement';
  if (title.includes('هل') || title.includes('?')) return 'question';
  if (title.includes('كيف') || title.includes('how')) return 'how';
  if (title.includes('لماذا') || title.includes('why')) return 'why';
  if (title.includes('vs') || title.includes('ضد')) return 'comparison';
  if (title.includes('حرب') || title.includes('war')) return 'conflict';
  return 'statement';
}

function generateOurAngle(originalTitle, topic) {
  // Generate a unique angle based on our DNA
  const angles = {
    'trump': 'تأثير قرارات ترامب على الاقتصادات العربية',
    'china': 'كيف تؤثر خطط الصين على المنطقة العربية',
    'russia': 'روسيا والعرب: ما المكاسب والخسائر؟',
    'iran': 'إيران والخليج: السيناريوهات المحتملة',
    'oil': 'ماذا يعني هذا لدول النفط العربية؟',
    'dollar': 'تأثير الدولار على الجنيه والريال',
    'gold': 'الذهب كملاذ آمن للمستثمر العربي',
    'fed': 'الفيدرالي والفائدة: ماذا يعني للعرب؟',
    'ai': 'الذكاء الاصطناعي: فرصة أم تهديد للعرب؟',
    'crypto': 'العملات الرقمية في المنطقة العربية',
    'egypt': 'تأثير X على الاقتصاد المصري',
    'saudi': 'السعودية والتحول الاقتصادي'
  };
  
  return angles[topic] || 'الزاوية العربية لهذا الموضوع';
}

// ============================================
// FIND MATCHING PERSONAS
// ============================================
function findMatchingPersonas(pitch) {
  const matches = [];
  
  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    let score = 0;
    
    // Check if topic matches persona interests
    for (const interest of persona.interests.primary) {
      if (pitch.topic && interest.toLowerCase().includes(pitch.topic)) {
        score += 2;
      }
    }
    
    // Check trigger keywords
    for (const keyword of persona.triggerKeywords) {
      if (pitch.originalTitle.toLowerCase().includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    
    if (score > 0) {
      matches.push({
        personaId,
        name: persona.name,
        icon: persona.icon,
        score
      });
    }
  }
  
  return matches.sort((a, b) => b.score - a.score);
}

// ============================================
// GET PITCHES FOR SPECIFIC PERSONA
// ============================================
export async function getPitchesForPersona(personaId) {
  const allPitches = await getCompetitorPitches();
  
  return allPitches.filter(pitch => 
    pitch.targetPersonas.some(p => p.personaId === personaId)
  );
}

// ============================================
// GET ADJACENT CONTENT INSPIRATION
// ============================================
export async function getAdjacentInspiration() {
  const adjacentChannels = await getChannelsByType('adjacent_content');
  const inspiration = [];
  
  for (const channel of adjacentChannels) {
    inspiration.push({
      channel: channel.name,
      type: channel.subType,
      reasonToWatch: channel.reasonToWatch,
      learnFrom: channel.learnFrom,
      
      // Which personas could benefit
      benefitsPersonas: findPersonasByAdjacentType(channel.subType)
    });
  }
  
  return inspiration;
}

function findPersonasByAdjacentType(subType) {
  const mapping = {
    'pop_science': ['tech_future', 'geopolitics'],
    'podcast': ['geopolitics', 'investor'],
    'documentary': ['geopolitics', 'egyptian_business'],
    'news_analysis': ['geopolitics', 'gulf_oil', 'investor'],
    'tech': ['tech_future'],
    'business_news': ['investor', 'egyptian_business', 'gulf_oil']
  };
  
  return mapping[subType] || [];
}

// ============================================
// GENERATE WEEKLY PITCH REPORT
// ============================================
export async function generateWeeklyPitchReport() {
  const pitches = await getCompetitorPitches();
  const servingStatus = await getServingStatus();
  
  const report = {
    generatedAt: new Date().toISOString(),
    
    // Pitches by persona
    byPersona: {},
    
    // Underserved personas need attention
    urgentPitches: [],
    
    // Top pitches overall
    topPitches: pitches.slice(0, 10)
  };
  
  // Group pitches by persona
  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    const personaPitches = pitches.filter(p => 
      p.targetPersonas.some(t => t.personaId === personaId)
    );
    
    report.byPersona[personaId] = {
      name: persona.name,
      icon: persona.icon,
      pitchCount: personaPitches.length,
      topPitches: personaPitches.slice(0, 3),
      servingStatus: servingStatus.personas[personaId]
    };
    
    // If persona is underserved and has pitches, mark as urgent
    if (servingStatus.personas[personaId]?.status === 'NOT_STARTED' && personaPitches.length > 0) {
      report.urgentPitches.push({
        persona: persona.name,
        icon: persona.icon,
        pitch: personaPitches[0]
      });
    }
  }
  
  return report;
}




