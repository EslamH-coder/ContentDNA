/**
 * Wikipedia Trends Fetcher
 * Uses Wikimedia REST API (free, no auth)
 * https://wikimedia.org/api/rest_v1/
 */

const BLOCKLIST = [
  // System pages
  'Main_Page', 'Special:', 'Wikipedia:', 'File:', 'Help:',
  'Portal:', 'Category:', 'Template:', 'Module:',
  
  // Recurring lists
  'Deaths_in_', 'List_of_',
  
  // Adult content
  'XXX', 'Pornhub', 'PornHub', '.xxx',
  
  // Entertainment (usually not relevant for news/economics shows)
  'film)', 'TV_series)', 'album)', 'song)', 'band)',
  'season_', 'episode_',
  
  // Sports (unless DNA includes sports)
  'footballer', 'cricketer', 'basketball', 'NFL', 'NBA',
];

/**
 * Get most viewed Wikipedia articles for a date
 * @param {string} language - 'en' or 'ar'
 * @param {Date} date - Date to fetch (defaults to yesterday)
 */
export async function fetchWikipediaTrends(language = 'en', date = null) {
  // Wikipedia API returns data for previous day, so use yesterday
  const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${language}.wikipedia/all-access/${year}/${month}/${day}`;
  
  console.log(`📚 Fetching Wikipedia trends for ${language} on ${year}-${month}-${day}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ContentDNA/1.0 (content research tool)',
      },
    });

    if (!response.ok) {
      console.error('Wikipedia API error:', response.status);
      return [];
    }

    const data = await response.json();
    const articles = data?.items?.[0]?.articles || [];

    // Filter and transform
    const filtered = articles
      .filter(article => {
        const title = article.article;
        // Skip blocklisted articles
        if (BLOCKLIST.some(blocked => title.includes(blocked))) return false;
        // Skip very short titles (likely not content)
        if (title.length < 3) return false;
        return true;
      })
      .slice(0, 100) // Top 100
      .map(article => ({
        title: article.article.replace(/_/g, ' '),
        titleRaw: article.article,
        views: article.views,
        rank: article.rank,
        url: `https://${language}.wikipedia.org/wiki/${article.article}`,
        language,
      }));

    console.log(`✅ Got ${filtered.length} trending Wikipedia articles`);
    
    return filtered;
  } catch (error) {
    console.error('Wikipedia fetch error:', error.message);
    return [];
  }
}

/**
 * Get article summary from Wikipedia
 */
export async function getArticleSummary(title, language = 'en') {
  const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ContentDNA/1.0' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      title: data.title,
      description: data.description,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Calculate relevance score for a Wikipedia trend
 */
export function calculateWikipediaScore(article, dnaKeywords = []) {
  let score = 0;

  // Base score from views (logarithmic)
  score += Math.min(Math.log10(article.views) * 10, 40);

  // Bonus for high rank
  if (article.rank <= 10) score += 20;
  else if (article.rank <= 25) score += 15;
  else if (article.rank <= 50) score += 10;

  // Bonus for DNA keyword match
  const titleLower = article.title.toLowerCase();
  const matched = dnaKeywords.filter(k => 
    titleLower.includes(k.toLowerCase())
  );
  score += matched.length * 15;

  // Cap at 100
  return Math.round(Math.min(score, 100));
}

export default {
  fetchWikipediaTrends,
  getArticleSummary,
  calculateWikipediaScore,
};

