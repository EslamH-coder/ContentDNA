/**
 * CONVERT LIVING DNA TO LLM PROMPT
 * Generates context for LLM based on current DNA state
 */

import { getAudienceContext } from './audienceProfile.js';

export function generateDNAPrompt(dna) {
    const audienceContext = getAudienceContext();
    
    return `
  # Channel DNA - المُخبر الاقتصادي+
  آخر تحديث: ${dna.metadata.last_updated || 'لم يتم التحديث بعد'}
  عدد الفيديوهات المحللة: ${dna.metadata.total_videos_analyzed}
  
  ${audienceContext}
  
  ## أداء المواضيع (من الأفضل للأسوأ):
  ${generateTopicsSection(dna.topics)}
  
  ## أنماط الهوك الناجحة:
  ${generateHooksSection(dna.hooks)}
  
  ## سلوك الجمهور - ملاحظات مهمة:
  ${generateAudienceSection(dna.audience)}
  
  ## آخر الملاحظات والتعلم:
  ${generateInsightsSection(dna.insights)}
  
  ## ⛔ ممنوع نهائياً:
  ${dna.banned.phrases.map(p => `- "${p}"`).join('\n')}
  
  ## المواضيع الضعيفة (تجنبها):
  ${dna.banned.weak_topics.length > 0 ? dna.banned.weak_topics.map(t => `- ${t}`).join('\n') : '- لا يوجد حالياً'}
  
  ## الصيغة الأمثل:
  - مدة الفيديو الطويل: ${dna.format.optimal_duration.long_form.min}-${dna.format.optimal_duration.long_form.max} دقيقة
  - مدة الشورت: ${dna.format.optimal_duration.shorts.min}-${dna.format.optimal_duration.shorts.max} ثانية
  `;
  }

function generateTopicsSection(topics) {
  const sorted = Object.entries(topics)
    .filter(([_, data]) => data.videos_count >= 2)
    .sort((a, b) => b[1].avg_views - a[1].avg_views);
  
  if (sorted.length === 0) return '- لا توجد بيانات كافية بعد';
  
  return sorted.slice(0, 10).map(([topic, data]) => {
    const trend = data.trend === 'rising' ? '📈' : data.trend === 'falling' ? '📉' : '➡️';
    return `${trend} **${topic}**: ${data.avg_views.toLocaleString()} مشاهدة، ${data.avg_retention_30s}% retention (${data.videos_count} فيديو)`;
  }).join('\n');
}

function generateHooksSection(hooks) {
  const sorted = Object.entries(hooks.patterns)
    .filter(([_, data]) => data.usage_count >= 2)
    .sort((a, b) => parseFloat(b[1].avg_retention_30s) - parseFloat(a[1].avg_retention_30s));
  
  if (sorted.length === 0) return '- لا توجد بيانات كافية بعد';
  
  let output = '';
  
  sorted.slice(0, 5).forEach(([pattern, data]) => {
    output += `\n### ${pattern} (${data.avg_retention_30s}% retention)\n`;
    if (data.best_example) {
      output += `مثال: "${data.best_example.hook.substring(0, 100)}..."\n`;
      output += `المشاهدات: ${data.best_example.views.toLocaleString()}\n`;
    }
  });
  
  if (hooks.effective_phrases.length > 0) {
    output += `\n### عبارات فعالة:\n${hooks.effective_phrases.slice(0, 10).map(p => `- "${p}"`).join('\n')}`;
  }
  
  return output;
}

function generateAudienceSection(audience) {
  let output = '';
  
  if (audience.traps && audience.traps.length > 0) {
    output += '\n### ⚠️ فخاخ (Retention عالي لكن مشاهدات منخفضة):\n';
    output += audience.traps.slice(0, 3).map(t => 
      `- "${t.video}": ${t.retention}% retention لكن ${t.views.toLocaleString()} مشاهدة فقط`
    ).join('\n');
  }
  
  if (audience.share_triggers && audience.share_triggers.length > 0) {
    output += '\n### 🚀 محفزات الانتشار:\n';
    output += audience.share_triggers.slice(0, 3).map(t => 
      `- "${t.video}": ${t.views.toLocaleString()} مشاهدة`
    ).join('\n');
  }
  
  return output || '- لا توجد ملاحظات بعد';
}

function generateInsightsSection(insights) {
  if (!insights.recent || insights.recent.length === 0) return '- لا توجد ملاحظات بعد';
  
  let output = '';
  
  // Last 3 insights
  insights.recent.slice(0, 3).forEach(insight => {
    output += `\n**${insight.video_title}** (${insight.performance}):\n`;
    if (insight.observations && insight.observations.length > 0) {
      insight.observations.forEach(obs => {
        output += `- ${obs}\n`;
      });
    }
  });
  
  // Warnings
  if (insights.warnings && insights.warnings.length > 0) {
    output += '\n### ⚠️ تحذيرات:\n';
    insights.warnings.slice(0, 3).forEach(w => {
      output += `- ${w.warning}\n`;
    });
  }
  
  return output;
}

