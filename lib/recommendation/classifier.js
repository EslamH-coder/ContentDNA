import { TOPIC_KEYWORDS, ENTITY_LISTS } from './topicKeywords.js';

export function classifyTopic(item) {
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  const scores = {};
  
  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    
    for (const kw of keywords.primary) {
      if (content.includes(kw.toLowerCase())) score += 10;
    }
    for (const kw of keywords.secondary) {
      if (content.includes(kw.toLowerCase())) score += 3;
    }
    
    if (score > 0) scores[topicId] = score;
  }
  
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  
  if (sorted.length === 0) {
    return { primary_topic: null, confidence: 0, all_matches: [] };
  }
  
  return {
    primary_topic: sorted[0][0],
    primary_score: sorted[0][1],
    confidence: Math.min(sorted[0][1] / 30, 1),
    all_matches: sorted.slice(0, 3).map(([t, s]) => ({ topic: t, score: s }))
  };
}

export function extractEntities(item) {
  const content = `${item.title || ''} ${item.description || ''}`;
  
  const entities = {
    companies: [],
    people: [],
    regions: [],
    numbers: []
  };
  
  for (const c of ENTITY_LISTS.companies) {
    if (content.toLowerCase().includes(c.toLowerCase())) entities.companies.push(c);
  }
  
  for (const p of ENTITY_LISTS.people) {
    if (content.includes(p)) entities.people.push(p);
  }
  
  for (const r of ENTITY_LISTS.arabRegions) {
    if (content.toLowerCase().includes(r.toLowerCase())) entities.regions.push(r);
  }
  
  const numberPattern = /\$?\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:billion|million|trillion|thousand|%|B|M|K|مليار|مليون))?/gi;
  const matches = content.match(numberPattern);
  if (matches) {
    entities.numbers = matches;
  }
  
  return entities;
}

export function detectSignals(item) {
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  
  return {
    is_threat: /threat|danger|crisis|risk|warning|lose|lost|collapse|خطر|تهديد|أزمة|انهيار/.test(content),
    is_reveal: /secret|hidden|reveal|exposed|truth|سر|خفي|كشف|الحقيقة/.test(content),
    is_milestone: /first|record|biggest|largest|unprecedented|historic|أول|أكبر|قياسي|تاريخي/.test(content),
    is_question: /\?|why|how|what|لماذا|كيف|ماذا/.test(content)
  };
}

export function classifyItem(item) {
  const topic = classifyTopic(item);
  const entities = extractEntities(item);
  const signals = detectSignals(item);
  
  return {
    item_id: item.id || item.guid || item.link || Math.random().toString(36).substr(2, 9),
    original: item,
    classification: {
      topic,
      entities,
      signals,
      has_arab_region: entities.regions.length > 0,
      has_numbers: entities.numbers.length > 0,
      has_major_entity: entities.companies.length > 0 || entities.people.length > 0
    }
  };
}

