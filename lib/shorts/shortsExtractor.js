import { SHORTS_TOPICS } from './shortsAnalyzer.js';

/**
 * EXTRACT SHORTS FROM LONG-FORM
 * Find the best 30-60 second clips
 */

// ============================================
// SHORTS EXTRACTION PATTERNS
// ============================================
export const SHORTS_EXTRACTION_PATTERNS = {
  // Pattern 1: The Shocking Number
  shocking_number: {
    name: "الرقم الصادم",
    structure: "Number + Context + Implication",
    duration: "30-45 sec",
    where_to_find: "Usually in Chapter 3 (Data section)",
    example: "15.2 مليار دولار... ده أكبر من ميزانية [X] بالكامل!"
  },
  
  // Pattern 2: The Reveal
  reveal: {
    name: "الكشف المفاجئ",
    structure: "Setup + Surprising Fact",
    duration: "30-45 sec",
    where_to_find: "Chapter 1 (Hook) or Chapter 3",
    example: "اللي محدش بيقوله: [الحقيقة الصادمة]"
  },
  
  // Pattern 3: The Conflict Moment
  conflict: {
    name: "لحظة الصراع",
    structure: "Entity A vs Entity B + Stakes",
    duration: "45-60 sec",
    where_to_find: "Chapter 2 (Key Players) or Chapter 3",
    example: "ترامب vs الصين... والخسران هو [X]"
  },
  
  // Pattern 4: The Arab Angle
  arab_angle: {
    name: "الزاوية العربية",
    structure: "Global Event + Arab Impact",
    duration: "30-45 sec",
    where_to_find: "Chapter 3 (Regional Impact beat)",
    example: "طيب ده يعني إيه للخليج؟ [التأثير]"
  },
  
  // Pattern 5: The Question Hook
  question_hook: {
    name: "السؤال الصادم",
    structure: "Provocative Question + Quick Answer",
    duration: "30-40 sec",
    where_to_find: "Chapter 1 (Central Question)",
    example: "هل [X]؟ الإجابة هي [صادمة]"
  }
};

// ============================================
// GENERATE SHORTS IDEAS FROM BRIEF
// ============================================
export function extractShortsFromBrief(brief, analysis) {
  const shortsIdeas = [];
  
  // Extract from Chapter 1: Hook/Question
  if (brief.chapters && brief.chapters[0]) {
    const questionBeat = brief.chapters[0].beats.find(b => b.beat && b.beat.includes('سؤال'));
    if (questionBeat) {
      shortsIdeas.push({
        pattern: 'question_hook',
        source_chapter: 1,
        source_beat: 'سؤال الحلقة',
        content_hint: questionBeat.content,
        suggested_duration: 35,
        priority: 1
      });
    }
  }
  
  // Extract from Chapter 3: Data
  if (brief.chapters && brief.chapters[2]) {
    const dataBeat = brief.chapters[2].beats.find(b => b.beat && b.beat.includes('البيانات'));
    if (dataBeat) {
      shortsIdeas.push({
        pattern: 'shocking_number',
        source_chapter: 3,
        source_beat: 'البيانات والأرقام',
        content_hint: `Focus on the MOST shocking number from: ${dataBeat.content}`,
        suggested_duration: 40,
        priority: 2
      });
    }
    
    // Regional impact
    const regionalBeat = brief.chapters[2].beats.find(b => b.beat && b.beat.includes('التأثير'));
    if (regionalBeat) {
      shortsIdeas.push({
        pattern: 'arab_angle',
        source_chapter: 3,
        source_beat: 'التأثير الإقليمي',
        content_hint: regionalBeat.content,
        suggested_duration: 45,
        priority: 3
      });
    }
  }
  
  // Add topic-specific recommendation
  const topic = analysis.topic;
  const viralTopic = SHORTS_TOPICS.viral.find(t => t.topic_id === topic);
  
  if (viralTopic) {
    shortsIdeas.forEach(idea => {
      idea.viral_potential = 'HIGH';
      idea.expected_views = viralTopic.avg_views;
    });
  }
  
  return {
    shorts_ideas: shortsIdeas.slice(0, 3),  // Top 3
    topic_shorts_potential: viralTopic ? 'HIGH' : 'MEDIUM',
    recommendation: viralTopic 
      ? 'DEFINITELY extract shorts - topic goes viral'
      : 'Optional shorts - test one and measure'
  };
}

