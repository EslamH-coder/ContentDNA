export function buildGenerationPrompt(enrichedItem) {
  const { classification, decisions, original } = enrichedItem;
  
  const systemPrompt = `أنت كاتب عناوين يوتيوب لقناة المُخبر الاقتصادي+ (اقتصاد وجيوبوليتيك).

## القواعد الصارمة:

### نوع الـ Hook: ${decisions.hook.type}
القالب: ${decisions.hook.template}
متوسط المشاهدات: ${decisions.hook.avg_views?.toLocaleString()}

### المحفزات المطلوبة:
${decisions.triggers.map(t => `- ${t.trigger}: ${t.instruction}`).join('\n')}

### ممنوع:
❌ عنوان الخبر الأصلي كما هو
❌ "القصة الكاملة" أو عناوين عامة
❌ أسئلة بدون stakes
❌ اختراع أرقام

### الإخراج (JSON فقط):
{
  "title_ar": "العنوان بالعربي",
  "hook_script_ar": "أول 15 ثانية",
  "thumbnail_text_ar": "2-4 كلمات",
  "arab_angle": "الزاوية العربية"
}`;

  const userPrompt = `الخبر: ${original.title || 'No title'}
${original.description || ''}

الموضوع: ${classification.topic.primary_topic} (${(classification.topic.confidence * 100).toFixed(0)}%)
الأرقام: ${classification.entities.numbers.join(', ') || 'لا يوجد'}
المناطق: ${classification.entities.regions.join(', ') || 'يجب إضافة زاوية عربية'}
الكيانات: ${[...classification.entities.companies, ...classification.entities.people].join(', ') || 'لا يوجد'}

Hook المطلوب: ${decisions.hook.type}
القالب: ${decisions.hook.template}

أكتب JSON فقط:`;

  return { systemPrompt, userPrompt };
}

// Fallback when LLM fails
export function generateFallbackTitle(enrichedItem) {
  const { classification, decisions } = enrichedItem;
  const number = classification.entities.numbers[0] || '';
  const entity = classification.entities.companies[0] || classification.entities.people[0] || '';
  const region = classification.entities.regions[0] || 'المنطقة';
  
  const templates = {
    'Threat Claim': `${number ? number + ' | ' : ''}${entity || region} في خطر... التفاصيل صادمة!`,
    'Reveal': `اللي ${entity || 'الشركات'} مش بتقولهولك عن ${classification.topic.primary_topic?.replace(/_/g, ' ') || 'الأزمة'}`,
    'Fact Anchor': `${number ? 'في ' + number + '، ' : ''}${entity || region} غيّر كل القواعد`,
    'Stakes': `${entity || region} هتخسر ${number || 'كتير'} لو الأزمة استمرت`
  };
  
  return {
    title_ar: templates[decisions.hook.type] || templates['Threat Claim'],
    hook_script_ar: '',
    thumbnail_text_ar: number || entity || '',
    arab_angle: region,
    is_fallback: true
  };
}

