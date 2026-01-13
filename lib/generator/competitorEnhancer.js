/**
 * COMPETITOR ENHANCER
 * Uses competitor data to improve content
 */

import { getChannelsByType, getVideos } from '../competitors/competitorStore.js';

// ============================================
// GET COMPETITOR CONTEXT
// ============================================
export async function getCompetitorContext(topic) {
  const context = {
    directCompetitors: [],
    adjacentIdeas: [],
    formatInspiration: [],
    gaps: []
  };
  
  try {
    // Get all channel types
    const direct = await getChannelsByType('direct_competitor');
    const adjacent = await getChannelsByType('adjacent_content');
    const format = await getChannelsByType('format_inspiration');
    
    // Analyze direct competitors
    for (const channel of direct) {
      if (channel.insights?.length > 0) {
        context.directCompetitors.push({
          name: channel.name,
          insights: channel.insights
        });
      }
    }
    
    // Get adjacent content ideas
    for (const channel of adjacent) {
      if (channel.learnFrom?.length > 0) {
        context.adjacentIdeas.push({
          name: channel.name,
          type: channel.subType,
          learnFrom: channel.learnFrom
        });
      }
    }
    
    // Get format inspiration
    for (const channel of format) {
      context.formatInspiration.push({
        name: channel.name,
        format: channel.formatType,
        reasonToWatch: channel.reasonToWatch
      });
    }
    
    // Get saved videos related to topic
    const savedVideos = await getVideos();
    const relevantVideos = savedVideos.filter(v => 
      v.tags?.some(t => topic.toLowerCase().includes(t.toLowerCase())) ||
      v.title?.toLowerCase().includes(topic.toLowerCase())
    );
    
    if (relevantVideos.length > 0) {
      context.savedVideoInsights = relevantVideos.map(v => ({
        title: v.title,
        reason: v.reason,
        learnPoints: v.learnPoints
      }));
    }
  } catch (e) {
    console.warn('Error loading competitor context:', e.message);
  }
  
  return context;
}

// ============================================
// FIND CONTENT GAPS
// ============================================
export async function findContentGaps(topic, competitorVideos) {
  const angles = new Set();
  
  // Collect all angles competitors used
  for (const video of competitorVideos) {
    const angle = extractAngle(video.title);
    if (angle) angles.add(angle);
  }
  
  // Common angles that might be missing
  const possibleAngles = [
    'تأثير على مصر',
    'تأثير على السعودية',
    'تأثير على الخليج',
    'المقارنة التاريخية',
    'السيناريوهات المحتملة',
    'من المستفيد؟',
    'من المتضرر؟',
    'الجانب الخفي',
    'ماذا لو؟'
  ];
  
  // Find gaps
  const gaps = possibleAngles.filter(angle => 
    !Array.from(angles).some(a => a.includes(angle))
  );
  
  return gaps;
}

function extractAngle(title) {
  if (!title) return null;
  // Simple angle extraction
  if (title.includes('هل')) return 'سؤال';
  if (title.includes('كيف')) return 'شرح';
  if (title.includes('لماذا')) return 'تحليل';
  if (title.includes('vs') || title.includes('ضد')) return 'مقارنة';
  return null;
}

// ============================================
// ENHANCE CONTENT WITH COMPETITOR INSIGHTS
// ============================================
export async function enhanceWithCompetitorInsights(generatedContent, topic, groqClient) {
  const context = await getCompetitorContext(topic);
  
  if (!context.directCompetitors.length && !context.adjacentIdeas.length) {
    return generatedContent; // No competitor data to use
  }
  
  const prompt = `
لديك محتوى مُولَّد وبيانات عن المنافسين. حسّن المحتوى:

## المحتوى الحالي:
العنوان: ${generatedContent.title}
الـ Hook: ${generatedContent.hook}

## ما يفعله المنافسون المباشرون:
${context.directCompetitors.map(c => `- ${c.name}: ${c.insights?.join(', ') || 'لا توجد رؤى'}`).join('\n') || 'لا توجد بيانات'}

## أفكار من المحتوى المجاور:
${context.adjacentIdeas.map(c => `- ${c.name} (${c.type}): ${c.learnFrom?.join(', ') || ''}`).join('\n') || 'لا توجد بيانات'}

## فيديوهات محفوظة للإلهام:
${context.savedVideoInsights?.map(v => `- "${v.title}": ${v.reason || ''}`).join('\n') || 'لا توجد'}

## المطلوب:
1. هل يمكن تحسين العنوان بناءً على ما ينجح مع المنافسين؟
2. هل هناك زاوية فريدة يمكن إضافتها؟
3. هل يمكن دمج أسلوب من المحتوى المجاور؟

أجب بـ JSON:
{
  "enhanced_title": "العنوان المحسن (أو null إذا لا تحسين)",
  "enhanced_hook": "الـ Hook المحسن (أو null إذا لا تحسين)",
  "enhancements_made": ["قائمة التحسينات"],
  "competitor_insight_used": "الرؤية المستخدمة من المنافسين"
}
`;

  try {
    const response = await groqClient.complete({
      prompt,
      temperature: 0.5,
      model: 'fast'
    });
    
    let jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const enhanced = JSON.parse(jsonStr);
    
    return {
      ...generatedContent,
      title: enhanced.enhanced_title || generatedContent.title,
      hook: enhanced.enhanced_hook || generatedContent.hook,
      competitorEnhancement: {
        enhancements: enhanced.enhancements_made || [],
        insightUsed: enhanced.competitor_insight_used || ''
      }
    };
  } catch (e) {
    console.error('Competitor enhancement failed:', e);
    return generatedContent;
  }
}




