/**
 * ADJACENT CONTENT ANALYZER
 * Discovers insights from adjacent content
 */

import { getGroqClient } from '../llm/groqClient.js';

// ============================================
// ANALYZE ADJACENT CONTENT
// ============================================
export async function analyzeAdjacentContent(channels) {
  // Filter to adjacent content channels
  const adjacentChannels = channels.filter(c => c.type === 'adjacent_content');
  
  if (adjacentChannels.length === 0) {
    return [];
  }
  
  let groq;
  try {
    groq = getGroqClient();
    if (!groq.apiKey) {
      console.warn('Groq not configured, skipping adjacent content analysis');
      return [];
    }
  } catch (error) {
    console.error('Failed to initialize Groq:', error);
    return [];
  }
  
  const insights = [];
  
  // Group by subType
  const bySubType = {};
  for (const channel of adjacentChannels) {
    const subType = channel.subType || 'other';
    if (!bySubType[subType]) bySubType[subType] = [];
    bySubType[subType].push(channel);
  }
  
  // Analyze each group
  for (const [subType, typeChannels] of Object.entries(bySubType)) {
    const channelNames = typeChannels.map(c => c.name).join(', ');
    
    const prompt = `
جمهور قناة "المخبر الاقتصادي+" (اقتصاد وجيوسياسة) يشاهد أيضاً هذه القنوات من نوع "${subType}":
${channelNames}

بناءً على هذا، أجب:

1. لماذا برأيك جمهور الاقتصاد والجيوسياسة يشاهد هذا النوع من المحتوى؟
2. ما الحاجة التي يلبيها هذا المحتوى؟
3. كيف يمكن لقناة اقتصادية أن تستفيد من هذا؟
4. هل هناك فرصة لـ crossover content؟

أجب بصيغة JSON:
{
  "why_they_watch": "...",
  "need_fulfilled": "...",
  "opportunity": "...",
  "crossover_ideas": ["idea1", "idea2"],
  "format_lessons": ["lesson1", "lesson2"]
}
`;

    try {
      const response = await groq.complete({ prompt, temperature: 0.5 });
      let content = response.content;
      
      // Clean JSON
      content = content.replace(/```json|```/g, '').trim();
      
      const analysis = JSON.parse(content);
      
      insights.push({
        type: 'adjacent_analysis',
        subType,
        channels: channelNames,
        analysis,
        actionable: analysis.crossover_ideas?.length > 0
      });
    } catch (e) {
      console.error(`Failed to analyze ${subType}:`, e);
    }
  }
  
  return insights;
}

// ============================================
// DISCOVER CROSSOVER OPPORTUNITIES
// ============================================
export async function discoverCrossoverOpportunities(channels) {
  const adjacent = channels.filter(c => c.type === 'adjacent_content');
  
  if (adjacent.length === 0) {
    return [];
  }
  
  let groq;
  try {
    groq = getGroqClient();
    if (!groq.apiKey) {
      return [];
    }
  } catch (error) {
    return [];
  }
  
  const prompt = `
أنت منتج محتوى لقناة "المخبر الاقتصادي+" (اقتصاد وجيوسياسة، جمهور عربي).

جمهورك يشاهد أيضاً:
${adjacent.map(c => `- ${c.name} (${c.subType || 'N/A'}): ${c.reasonToWatch || 'N/A'}`).join('\n')}

اقترح 5 أفكار لـ crossover content تجمع بين:
- اهتمامات الجمهور المتنوعة
- موضوعات قناتك (اقتصاد، جيوسياسة)

لكل فكرة:
{
  "title": "عنوان مقترح",
  "concept": "الفكرة",
  "combines": ["topic1", "topic2"],
  "why_works": "لماذا ستنجح",
  "example": "مثال على المحتوى"
}

أجب كـ JSON array.
`;

  try {
    const response = await groq.complete({ prompt, temperature: 0.7 });
    let content = response.content.replace(/```json|```/g, '').trim();
    
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to discover crossover opportunities:', e);
    return [];
  }
}

// ============================================
// EXTRACT FORMAT LESSONS
// ============================================
export async function extractFormatLessons(channels) {
  const formatChannels = channels.filter(c => c.type === 'format_inspiration');
  
  if (formatChannels.length === 0) {
    return [];
  }
  
  let groq;
  try {
    groq = getGroqClient();
    if (!groq.apiKey) {
      return [];
    }
  } catch (error) {
    return [];
  }
  
  // Group by format type
  const byFormat = {};
  for (const channel of formatChannels) {
    const format = channel.formatType || 'other';
    if (!byFormat[format]) byFormat[format] = [];
    byFormat[format].push(channel);
  }
  
  const lessons = [];
  
  for (const [format, formatChannelsList] of Object.entries(byFormat)) {
    const prompt = `
هذه قنوات تستخدم format "${format}" بشكل ممتاز:
${formatChannelsList.map(c => `- ${c.name}`).join('\n')}

استخرج أهم الدروس التي يمكن لقناة اقتصاد وجيوسياسة عربية أن تتعلمها:

1. كيف يبنون الـ hook؟
2. كيف يحافظون على الانتباه؟
3. ما العناصر البصرية المميزة؟
4. كيف يبسطون المعلومات المعقدة؟

أجب بصيغة JSON:
{
  "hook_technique": "...",
  "retention_secrets": ["...", "..."],
  "visual_elements": ["...", "..."],
  "simplification_methods": ["...", "..."],
  "applicable_to_economics": "كيف نطبقها على محتوى اقتصادي"
}
`;

    try {
      const response = await groq.complete({ prompt, temperature: 0.4 });
      let content = response.content.replace(/```json|```/g, '').trim();
      
      const analysis = JSON.parse(content);
      
      lessons.push({
        format,
        channels: formatChannelsList.map(c => c.name),
        lessons: analysis
      });
    } catch (e) {
      console.error(`Failed to analyze format ${format}:`, e);
    }
  }
  
  return lessons;
}




