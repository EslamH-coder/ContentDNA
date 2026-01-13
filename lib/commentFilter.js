/**
 * Comment Filter - Identifies useful vs skip comments
 * Filters out appreciation, spam, and off-topic comments
 */

// Words that indicate appreciation (not useful for topic detection)
const APPRECIATION_PATTERNS = [
  // Arabic appreciation
  'شكرا', 'شكراً', 'جزاك', 'جزاكم', 'بارك الله', 'الله يعطيك', 'الله يجزاك',
  'ممتاز', 'رائع', 'مبدع', 'أفضل قناة', 'افضل قناة', 'أفضل برنامج', 'افضل برنامج',
  'أحسنت', 'احسنت', 'تسلم', 'يسلمو', 'مشكور', 'يعطيك العافية',
  'حبيبي', 'أخي الكريم', 'استمر', 'استمروا', 'ننتظر المزيد',
  'محتوى رائع', 'محتوى ممتاز', 'قناة رائعة', 'برنامج رائع',
  
  // English appreciation  
  'thank you', 'thanks', 'amazing', 'great video', 'best channel',
  'love your', 'keep up', 'awesome', 'excellent', 'wonderful',
  
  // Emojis only or mostly emojis
  '❤️', '👍', '🔥', '💯', '👏',
];

// Words that indicate a question or request (useful!)
const QUESTION_PATTERNS = [
  // Arabic questions
  'كيف', 'لماذا', 'ما هو', 'ما هي', 'ماذا', 'متى', 'أين', 'هل',
  'ممكن حلقة', 'نريد حلقة', 'اريد حلقة', 'حلقة عن', 'فيديو عن',
  'سؤال', 'استفسار', 'أتساءل', 'اتساءل',
  'رأيك في', 'رأيكم في', 'ما رأيك', 'ما رايك',
  'اقتراح', 'أقترح', 'اتمنى', 'أتمنى', 'نتمنى',
  
  // English questions
  '?', 'how', 'why', 'what', 'when', 'where', 'can you', 'could you',
  'please make', 'video about', 'episode about',
];

// Spam patterns
const SPAM_PATTERNS = [
  'تابعوا قناتي', 'تابعو قناتي', 'اشتركو في', 'اشتركوا في',
  'subscribe to my', 'check out my', 'follow my',
  'http://', 'https://', 'www.',
  'للربح', 'فرصة استثمارية', 'أرباح مضمونة',
];

/**
 * Classify a comment
 * @returns {object} { type: 'question'|'request'|'discussion'|'skip', reason: string }
 */
export function classifyComment(text) {
  if (!text || typeof text !== 'string') {
    return { type: 'skip', reason: 'empty' };
  }

  const normalized = text.trim().toLowerCase();
  
  // Too short - skip
  if (normalized.length < 15) {
    return { type: 'skip', reason: 'too_short' };
  }

  // Check for spam first
  if (SPAM_PATTERNS.some(p => normalized.includes(p.toLowerCase()))) {
    return { type: 'skip', reason: 'spam' };
  }

  // Check for questions/requests (high value)
  const hasQuestion = QUESTION_PATTERNS.some(p => normalized.includes(p.toLowerCase()));
  const hasQuestionMark = text.includes('?') || text.includes('؟');
  
  if (hasQuestion || hasQuestionMark) {
    // But make sure it's not just "شكراً؟" or appreciation with question
    const appreciationCount = APPRECIATION_PATTERNS.filter(p => 
      normalized.includes(p.toLowerCase())
    ).length;
    
    if (appreciationCount < 2) {
      return { type: 'question', reason: 'contains_question' };
    }
  }

  // Check if mostly appreciation
  const appreciationMatches = APPRECIATION_PATTERNS.filter(p => 
    normalized.includes(p.toLowerCase())
  );
  
  // If multiple appreciation words and no substance, skip
  if (appreciationMatches.length >= 2) {
    return { type: 'skip', reason: 'appreciation_only' };
  }

  // Check comment length and substance
  const words = text.split(/\s+/).filter(w => w.length > 2);
  
  // Very short with one appreciation word - skip
  if (words.length < 10 && appreciationMatches.length >= 1) {
    return { type: 'skip', reason: 'short_appreciation' };
  }

  // Longer comment with some substance - could be discussion
  if (words.length >= 15) {
    return { type: 'discussion', reason: 'substantive_comment' };
  }

  // Default - moderate length, unclear purpose
  if (appreciationMatches.length > 0) {
    return { type: 'skip', reason: 'likely_appreciation' };
  }

  return { type: 'discussion', reason: 'general_comment' };
}

/**
 * Filter an array of comments to only useful ones
 */
export function filterUsefulComments(comments) {
  return comments.filter(comment => {
    const text = comment.text || comment.content || comment.snippet?.textDisplay;
    const classification = classifyComment(text);
    return classification.type !== 'skip';
  });
}

/**
 * Extract questions from comments
 */
export function extractQuestions(comments) {
  return comments
    .map(comment => {
      const text = comment.text || comment.content || comment.snippet?.textDisplay;
      const classification = classifyComment(text);
      return { ...comment, classification };
    })
    .filter(c => c.classification.type === 'question');
}

/**
 * Check if comment mentions a topic (for topic detection)
 */
export function extractTopicMentions(text, topicKeywords) {
  if (!text || !topicKeywords?.length) return [];
  
  const normalized = text.toLowerCase();
  
  // First check if comment is useful
  const classification = classifyComment(text);
  if (classification.type === 'skip') {
    return []; // Don't extract topics from appreciation comments
  }
  
  // Find matching keywords
  return topicKeywords.filter(keyword => 
    normalized.includes(keyword.toLowerCase())
  );
}
