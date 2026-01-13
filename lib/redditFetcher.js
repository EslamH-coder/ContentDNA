/**
 * Reddit Fetcher - Gets top posts from subreddits
 * Uses public JSON API (no auth required)
 */

// Words that indicate low-quality posts
const BLOCKLIST = [
  'meme', 'shitpost', 'joke', 'funny', 'lol', 'mfw', 'mrw',
  'upvote', 'downvote', 'karma', 'cake day', 'first post',
  'ama', 'weekly thread', 'daily thread', 'megathread'
];

// Words that indicate questions (high value)
const QUESTION_INDICATORS = [
  '?', 'why', 'how', 'what', 'when', 'where', 'who',
  'explain', 'help', 'should i', 'is it', 'can i',
  'لماذا', 'كيف', 'ما هو', 'هل'
];

/**
 * Fetch top posts from a subreddit
 */
export async function fetchSubreddit(subreddit, options = {}) {
  const {
    timeFilter = 'month',
    limit = 100,
    minScore = 100,
    minComments = 10,
  } = options;

  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeFilter}&limit=${limit}`;
  
  console.log(`📥 Fetching r/${subreddit} (top ${timeFilter})...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ContentDNA/1.0 (content research tool)',
      },
    });

    if (!response.ok) {
      console.error(`❌ Reddit API error for r/${subreddit}:`, response.status);
      return [];
    }

    const data = await response.json();
    const posts = data?.data?.children || [];

    console.log(`📥 Got ${posts.length} posts from r/${subreddit}`);

    // Filter and transform posts
    const filtered = posts
      .map(p => p.data)
      .filter(post => {
        // Minimum score
        if (post.score < minScore) return false;
        
        // Minimum comments
        if (post.num_comments < minComments) return false;
        
        // Upvote ratio (quality indicator)
        if (post.upvote_ratio < 0.7) return false;
        
        // Not in blocklist
        const titleLower = post.title.toLowerCase();
        if (BLOCKLIST.some(word => titleLower.includes(word))) return false;
        
        // Not a link-only post (we want discussions)
        if (post.is_video || post.is_gallery) return false;
        
        return true;
      })
      .map(post => ({
        title: post.title,
        description: post.selftext?.substring(0, 500) || '',
        url: `https://reddit.com${post.permalink}`,
        redditUrl: `https://reddit.com${post.permalink}`,
        subreddit: post.subreddit,
        score: post.score,
        comments: post.num_comments,
        upvoteRatio: post.upvote_ratio,
        createdAt: new Date(post.created_utc * 1000),
        flair: post.link_flair_text,
        isQuestion: isQuestion(post.title),
        author: post.author,
      }));

    console.log(`✅ Filtered to ${filtered.length} quality posts from r/${subreddit}`);
    
    return filtered;
  } catch (error) {
    console.error(`❌ Error fetching r/${subreddit}:`, error.message);
    return [];
  }
}

/**
 * Check if title is a question (high value for content)
 */
function isQuestion(title) {
  const lower = title.toLowerCase();
  return QUESTION_INDICATORS.some(q => lower.includes(q));
}

/**
 * Calculate quality score for a Reddit post
 */
export function calculateRedditScore(post, dnaKeywords = []) {
  let score = 0;

  // Base score from upvotes (logarithmic scale)
  score += Math.min(Math.log10(post.score) * 20, 50);

  // Bonus for questions (natural hooks)
  if (post.isQuestion) {
    score += 20;
  }

  // Bonus for high engagement (comments)
  if (post.comments > 100) {
    score += 15;
  } else if (post.comments > 50) {
    score += 10;
  }

  // Bonus for high upvote ratio
  if (post.upvoteRatio > 0.9) {
    score += 10;
  }

  // Bonus for DNA keyword match
  const titleLower = post.title.toLowerCase();
  const matchedKeywords = dnaKeywords.filter(k => 
    titleLower.includes(k.toLowerCase())
  );
  if (matchedKeywords.length > 0) {
    score += matchedKeywords.length * 10;
  }

  // Penalty for old posts (decay)
  const ageInDays = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays > 30) {
    score -= Math.min((ageInDays - 30) * 0.5, 20);
  }

  // Cap final score at 100 (database constraint)
  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Check title similarity (simple Levenshtein-based)
 */
export function isSimilarTitle(title1, title2, threshold = 0.7) {
  const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '');
  const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Simple word overlap check
  const words1 = new Set(t1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(t2.split(/\s+/).filter(w => w.length > 3));
  
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.length / union.size;
  return similarity >= threshold;
}

export default {
  fetchSubreddit,
  calculateRedditScore,
  isSimilarTitle,
};

