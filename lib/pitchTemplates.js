/**
 * Pitch Templates - Universal for any channel
 * NO hardcoded audience references - learns from show profile only
 */

/**
 * Build system prompt - English for better AI, output in channel language
 */
export function buildSystemPrompt(show, pitchType, outputLanguage = 'ar') {
  const languageInstruction = outputLanguage === 'ar' 
    ? 'Write your ENTIRE response in Arabic (العربية).'
    : outputLanguage === 'en'
    ? 'Write your entire response in English.'
    : 'Write in the language most appropriate for the content.';

  const wordLimit = pitchType === 'news' ? 250 : 400;

  // Build audience context ONLY if show has it defined
  let audienceContext = '';
  if (show?.target_audience) {
    audienceContext = `Target Audience: ${show.target_audience}`;
  }
  if (show?.content_style) {
    audienceContext += `\nContent Style: ${show.content_style}`;
  }

  return `You are a video pitch writer.

## Channel: ${show?.name || 'YouTube Channel'}
${show?.description ? `Description: ${show.description}` : ''}
${audienceContext}

## Language:
${languageInstruction}

## Rules:
1. ONLY use information from the provided source - NEVER invent facts or numbers
2. Maximum ${wordLimit} words
3. If information is missing, say so - don't make things up
4. Learn title/hook style from the channel's top videos (if provided)
5. DO NOT force any specific audience angle unless the show profile specifies it

## Additional Rules:
- Do NOT mention the channel name in the pitch
- Vary the hook style - don't always use "هل تعلم" or "هل تدرك"
- Hook alternatives: Start with a surprising fact, a bold statement, a contradiction, or a "what if" scenario
- Only mention regional impact if it's directly relevant to the source content

## Hook Rules:
- Hook must be DIFFERENT from title
- Start with surprising fact, question, or contradiction
- Create curiosity
- Vary your approach - use different hook styles (surprising fact, bold statement, contradiction, "what if" scenario)
- Avoid repetitive patterns like always starting with "هل تعلم" or "هل تدرك"

## Title Rules:
- Create curiosity gap
- Use numbers if in source
- Match style of channel's successful titles

${buildOutputFormat(pitchType, outputLanguage)}
`;
}

function buildOutputFormat(pitchType, language) {
  const labels = language === 'ar' ? {
    summary: '📰 ملخص',
    title: '🎬 العنوان',
    titles: '🎬 عناوين مقترحة',
    hook: '🎣 الهوك',
    keyPoints: '📝 النقاط الرئيسية',
    sections: '📝 المحاور',
    whyNow: '⚡ لماذا الآن؟',
    uniqueAngle: '🔍 الزاوية',
    thumbnail: '🖼️ الثمبنيل',
    duration: '⏱️ المدة',
  } : {
    summary: '📰 Summary',
    title: '🎬 Title',
    titles: '🎬 Suggested Titles',
    hook: '🎣 Hook',
    keyPoints: '📝 Key Points',
    sections: '📝 Sections',
    whyNow: '⚡ Why Now?',
    uniqueAngle: '🔍 Angle',
    thumbnail: '🖼️ Thumbnail',
    duration: '⏱️ Duration',
  };

  if (pitchType === 'news') {
    return `
## Format:

${labels.summary}
[2 sentences - facts only from source]

${labels.title}
[One curiosity-driven title]

${labels.hook} (10 sec)
[Surprising opening - NOT restating title]

${labels.keyPoints}
1. [Fact from source]
2. [Fact from source]
3. [Why it matters]

${labels.whyNow}
[One sentence]

${labels.thumbnail}
[Visual concept]

${labels.duration}: 5-8 min
`;
  }

  return `
## Format:

${labels.summary}
[2-3 sentences - topic and importance]

${labels.titles}
- [Question title]
- [Revelation title]

${labels.hook} (15 sec)
[Question or contradiction - NOT restating title]

${labels.sections}
1. [What happened]
2. [Why / How]
3. [What it means]

${labels.uniqueAngle}
[Your unique take]

${labels.thumbnail}
[Visual concept]

${labels.duration}: 10-15 min
`;
}

/**
 * Build user prompt
 */
export function buildUserPrompt(signal, topics, topVideos, show) {
  if (!signal) {
    return 'No source material available';
  }

  const title = signal.title || signal.title_ar || 'Untitled';
  const description = signal.description || 'No additional content';
  const source = signal.source || 'Unknown';

  let prompt = `
## SOURCE:
Title: ${title}

Content:
${description}

Source: ${source}
${signal.url ? `URL: ${signal.url}` : ''}
`;

  if (signal.reddit_score) {
    prompt += `\nReddit: ${signal.reddit_score.toLocaleString()} upvotes, ${signal.reddit_comments || 0} comments`;
  }

  if (signal.wikipedia_views) {
    prompt += `\nWikipedia: ${signal.wikipedia_views.toLocaleString()} views`;
  }

  // Add channel topics if available
  if (topics?.length) {
    const topicList = topics.map(t => t.topic_name_en || t.topic_name_ar).filter(Boolean).join(', ');
    prompt += `\n\n## CHANNEL FOCUS:\n${topicList}`;
  }

  // Add top videos if available
  if (topVideos?.length) {
    const titles = topVideos
      .slice(0, 5)
      .map((v, i) => `${i + 1}. "${v.title}"`)
      .join('\n');
    
    prompt += `\n\n## TOP PERFORMING VIDEOS (match this style):\n${titles}`;
  }

  prompt += `\n\n## IMPORTANT:
- Only use facts from source above
- Don't invent numbers or quotes
- Hook must differ from title`;

  return prompt;
}

/**
 * Build short form pitch prompt - for 30-60 second videos
 */
export function buildShortFormPrompt(show, outputLanguage = 'ar') {
  const languageInstruction = outputLanguage === 'ar' 
    ? 'Write your ENTIRE response in Arabic (العربية).'
    : outputLanguage === 'en'
    ? 'Write your entire response in English.'
    : 'Write in the language most appropriate for the content.';

  // Build audience context ONLY if show has it defined
  let audienceContext = '';
  if (show?.target_audience) {
    audienceContext = `Target Audience: ${show.target_audience}`;
  }
  if (show?.content_style) {
    audienceContext += `\nContent Style: ${show.content_style}`;
  }

  return `You are writing a pitch for a SHORT FORM video (30-60 seconds) for YouTube Shorts, TikTok, or Instagram Reels.

## Channel: ${show?.name || 'YouTube Channel'}
${show?.description ? `Description: ${show.description}` : ''}
${audienceContext}

## Language:
${languageInstruction}

## Rules:
- Maximum 80 words total
- ONE key insight only - no fluff
- Punchy, scroll-stopping opening
- Get straight to the point
- End with intrigue or call-to-action
- Do NOT mention the channel name in the pitch
- Vary the hook style - don't always use "هل تعلم" or "هل تدرك"

## Format:

🎣 Hook (3 sec)
[One shocking/surprising line to stop the scroll - NOT a question like "هل تعلم"]

💡 Key Point
[The ONE thing viewers will learn - 2 sentences max]

🎬 Visual
[What to show on screen]

📢 Ending
[Cliffhanger or CTA]
`;
}
