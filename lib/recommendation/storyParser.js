import { detectStoryType } from './storyTypes.js';

/**
 * Parse RSS item into story elements
 * This is the foundation - understand the STORY, not just topic
 */
export function parseStory(item) {
  const content = `${item.title || ''} ${item.description || ''}`;
  
  // Detect story type first
  const storyType = detectStoryType(content);
  
  const story = {
    raw: content,
    type: storyType,  // Story type detection
    elements: {
      actor: null,      // WHO is doing something
      action: null,     // WHAT they're doing
      affected: null,   // WHO is affected
      location: null,   // WHERE
      timeline: null,   // WHEN
      stakes: null,     // WHY it matters
      surprise: null    // WHAT'S unexpected
    },
    numbers: [],
    entities: []
  };
  
  // Extract ACTORS (companies, people)
  const actors = [];
  const actorPatterns = [
    /\b(Tesla|Google|Apple|Meta|Amazon|Microsoft|OpenAI|Uber|SpaceX|Nvidia|Boeing|Lockheed|Raytheon|Maersk|Aramco)\b/gi,
    /\b(Musk|Trump|Biden|إيلون ماسك|ترامب|بايدن|MBS|محمد بن سلمان)\b/gi,
    /\b(Fed|Federal Reserve|ECB|OPEC|IMF|Central Bank)\b/gi
  ];
  for (const pattern of actorPatterns) {
    const matches = content.match(pattern);
    if (matches) actors.push(...matches);
  }
  story.elements.actor = actors[0] || null;
  story.entities = [...new Set(actors)];
  
  // Extract AFFECTED parties
  const affectedPatterns = [
    /(\d+[\d,]*)\s*(drivers?|workers?|jobs?|employees?|people|سواق|وظيفة|عامل|عاملين)/gi,
    /(drivers?|workers?|consumers?|investors?|families|سواقين|المستثمرين|العمال|العائلات)/gi
  ];
  for (const pattern of affectedPatterns) {
    const match = content.match(pattern);
    if (match) {
      story.elements.affected = match[0];
      break;
    }
  }
  
  // Extract LOCATION (prioritize Arab locations)
  const locationPatterns = [
    /\b(Dubai|UAE|Saudi|Riyadh|Egypt|Cairo|Qatar|Doha|Gulf|MENA|دبي|الإمارات|السعودية|مصر|قطر|الخليج|الرياض)\b/gi,
    /\b(China|US|USA|America|Europe|Asia|Beijing|Washington)\b/gi
  ];
  for (const pattern of locationPatterns) {
    const match = content.match(pattern);
    if (match) {
      story.elements.location = match[0];
      break;
    }
  }
  
  // Extract TIMELINE
  // First, try to use actual publication date from RSS (if available and fresh)
  if (item.dateInfo && item.dateInfo.useInHook && item.dateInfo.pubDate) {
    // Use the actual publication date for timeline
    const pubDate = item.dateInfo.pubDate;
    const day = pubDate.getDate();
    const monthNames = {
      1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
      5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
      9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
    };
    const month = monthNames[pubDate.getMonth() + 1];
    const year = pubDate.getFullYear();
    story.elements.timeline = `في ${day} ${month} ${year}`;
  } else {
    // Fallback to pattern matching in content
    const timelinePatterns = [
      /\b(202[4-9]|203[0-9])\b/g,  // Years
      /\b(\d+)\s*(months?|years?|days?|weeks?)\s*(ago|from now|later)?\b/gi,
      /\b(by|before|until|within)\s+(\d+|next|this)\s*(month|year|week)?\b/gi,
      /\b(next|this)\s+(year|month|week|quarter)\b/gi
    ];
    for (const pattern of timelinePatterns) {
      const match = content.match(pattern);
      if (match) {
        story.elements.timeline = match[0];
        break;
      }
    }
  }
  
  // Extract NUMBERS
  const numberPattern = /\$?\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:billion|million|trillion|thousand|%|B|M|K|مليار|مليون))?/gi;
  const numberMatches = content.match(numberPattern);
  if (numberMatches) {
    story.numbers = numberMatches;
  }
  
  // Detect SURPRISE elements
  const surprisePatterns = [
    /\b(first|record|biggest|largest|never before|unprecedented|secret|hidden|exclusive)\b/gi,
    /\b(أول|أكبر|سر|خفي|قياسي|تاريخي|استثنائي)\b/gi
  ];
  for (const pattern of surprisePatterns) {
    const match = content.match(pattern);
    if (match) {
      story.elements.surprise = match[0];
      break;
    }
  }
  
  // Detect ACTION type
  if (/launch|announce|start|begin|introduce|unveil/i.test(content)) {
    story.elements.action = 'launch';
  } else if (/ban|block|stop|end|cancel|halt/i.test(content)) {
    story.elements.action = 'block';
  } else if (/buy|acquire|invest|deal|purchase/i.test(content)) {
    story.elements.action = 'invest';
  } else if (/lose|lost|cut|drop|fall|crash|decline|decrease/i.test(content)) {
    story.elements.action = 'loss';
  } else if (/rise|grow|increase|surge|jump|soar|climb/i.test(content)) {
    story.elements.action = 'growth';
  } else if (/strike|attack|war|conflict|tension/i.test(content)) {
    story.elements.action = 'conflict';
  }
  
  // Detect STAKES
  if (story.elements.affected && story.numbers.length > 0) {
    story.elements.stakes = `${story.numbers[0]} ${story.elements.affected}`;
  } else if (story.elements.affected) {
    story.elements.stakes = story.elements.affected;
  }
  
  return story;
}

/**
 * Check if location is Arab region
 */
export function isArabLocation(location) {
  if (!location) return false;
  const arabLocations = ['dubai', 'uae', 'saudi', 'riyadh', 'egypt', 'cairo', 'qatar', 'doha', 'gulf', 'mena', 'دبي', 'الإمارات', 'السعودية', 'مصر', 'قطر', 'الخليج', 'الرياض'];
  return arabLocations.some(l => location.toLowerCase().includes(l.toLowerCase()));
}

