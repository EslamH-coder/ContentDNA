/**
 * PERSONA TRACKER
 * Tracks which personas are being served
 */

import fs from 'fs/promises';
import path from 'path';

const TRACKING_FILE = path.join(process.cwd(), 'data/persona_tracking.json');

// ============================================
// INITIALIZE TRACKING
// ============================================
export async function initializeTracking() {
  const initialData = {
    lastReset: new Date().toISOString(),
    weekStart: getWeekStart(),
    
    personas: {
      geopolitics: { target: 3, served: 0, approved: [] },
      investor: { target: 2, served: 0, approved: [] },
      tech_future: { target: 1, served: 0, approved: [] },
      egyptian_business: { target: 2, served: 0, approved: [] },
      gulf_oil: { target: 2, served: 0, approved: [] },
      curious_learner: { target: 1, served: 0, approved: [] },
      employee: { target: 2, served: 0, approved: [] },
      student_entrepreneur: { target: 1, served: 0, approved: [] }
    },
    
    history: []
  };

  await saveTracking(initialData);
  return initialData;
}

// ============================================
// GET CURRENT STATUS
// ============================================
export async function getPersonaStatus() {
  let data = await loadTracking();
  
  // Check if we need to reset for new week
  const currentWeekStart = getWeekStart();
  if (data.weekStart !== currentWeekStart) {
    console.log('📅 New week - resetting persona tracking...');
    data = await initializeTracking();
  }
  
  // Calculate percentages
  const status = {};
  for (const [id, info] of Object.entries(data.personas)) {
    status[id] = {
      ...info,
      percentage: info.target > 0 ? Math.round((info.served / info.target) * 100) : 0,
      remaining: Math.max(0, info.target - info.served)
    };
  }
  
  return {
    weekStart: data.weekStart,
    personas: status,
    totalServed: Object.values(data.personas).reduce((sum, p) => sum + p.served, 0),
    totalTarget: Object.values(data.personas).reduce((sum, p) => sum + p.target, 0)
  };
}

// ============================================
// RECORD APPROVAL (THIS IS THE KEY FIX!)
// ============================================
export async function recordApproval(signalId, personaId, topicTitle) {
  const data = await loadTracking();
  
  if (!data.personas[personaId]) {
    console.warn(`Unknown persona: ${personaId}`);
    return false;
  }
  
  // Update persona count
  data.personas[personaId].served += 1;
  data.personas[personaId].approved.push({
    signalId,
    title: topicTitle,
    approvedAt: new Date().toISOString()
  });
  
  // Add to history
  data.history.push({
    action: 'approval',
    signalId,
    personaId,
    topicTitle,
    timestamp: new Date().toISOString()
  });
  
  await saveTracking(data);
  
  console.log(`✅ Recorded approval for ${personaId}: "${topicTitle}"`);
  
  return true;
}

// ============================================
// RECORD REJECTION
// ============================================
export async function recordRejection(signalId, reason = '') {
  const data = await loadTracking();
  
  data.history.push({
    action: 'rejection',
    signalId,
    reason,
    timestamp: new Date().toISOString()
  });
  
  await saveTracking(data);
  return true;
}

// ============================================
// GET UNDERSERVED PERSONAS
// ============================================
export async function getUnderservedPersonas() {
  const status = await getPersonaStatus();
  
  return Object.entries(status.personas)
    .filter(([id, info]) => info.percentage < 100)
    .sort((a, b) => a[1].percentage - b[1].percentage)
    .map(([id, info]) => ({
      id,
      ...info,
      priority: info.percentage < 50 ? 'HIGH' : 'MEDIUM'
    }));
}

// ============================================
// GET PERSONA SUGGESTIONS
// ============================================
export async function getPersonaSuggestions() {
  const underserved = await getUnderservedPersonas();
  
  const suggestions = [];
  
  for (const persona of underserved.slice(0, 3)) {
    suggestions.push({
      persona: persona.id,
      message: `${persona.id} needs ${persona.remaining} more videos this week`,
      priority: persona.priority,
      suggestedTopics: getTopicSuggestionsForPersona(persona.id)
    });
  }
  
  return suggestions;
}

// ============================================
// TOPIC SUGGESTIONS PER PERSONA
// ============================================
function getTopicSuggestionsForPersona(personaId) {
  const suggestions = {
    geopolitics: [
      'التوترات في بحر الصين الجنوبي',
      'مستقبل العلاقات الأمريكية الصينية',
      'الصراع على القطب الشمالي'
    ],
    investor: [
      'توقعات الذهب 2025',
      'أفضل استثمار في وقت التضخم',
      'هل البيتكوين فقاعة؟'
    ],
    tech_future: [
      'حرب الرقائق الإلكترونية',
      'مستقبل الذكاء الاصطناعي',
      'هل ستحل الروبوتات محل البشر؟'
    ],
    egyptian_business: [
      'مستقبل الجنيه المصري',
      'فرص الاستثمار في مصر 2025',
      'قناة السويس والتحديات الجديدة'
    ],
    gulf_oil: [
      'مستقبل النفط في عصر الطاقة النظيفة',
      'رؤية السعودية 2030',
      'اقتصاد الإمارات بعد النفط'
    ],
    curious_learner: [
      'كيف أصبحت سنغافورة غنية؟',
      'لماذا فشلت فنزويلا اقتصادياً؟',
      'سر نجاح الاقتصاد الألماني'
    ],
    employee: [
      'كيف تدخر من راتبك الشهري؟',
      'الاقتصاد السلوكي وعاداتك المالية',
      'خطة التقاعد المبكر'
    ],
    student_entrepreneur: [
      'كيف تبدأ مشروعك بدون رأس مال؟',
      'قصص نجاح startups عربية',
      'أخطاء رواد الأعمال المبتدئين'
    ]
  };
  
  return suggestions[personaId] || [];
}

// ============================================
// HELPERS
// ============================================
function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

async function loadTracking() {
  try {
    const content = await fs.readFile(TRACKING_FILE, 'utf-8');
    const data = JSON.parse(content);
    console.log('📊 Loaded persona tracking data');
    return data;
  } catch (e) {
    console.log('📊 No tracking file found, initializing...');
    return await initializeTracking();
  }
}

async function saveTracking(data) {
  try {
    await fs.mkdir(path.dirname(TRACKING_FILE), { recursive: true });
    await fs.writeFile(TRACKING_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Saved persona tracking data to:', TRACKING_FILE);
  } catch (e) {
    console.error('❌ Failed to save tracking data:', e.message);
    throw e;
  }
}

