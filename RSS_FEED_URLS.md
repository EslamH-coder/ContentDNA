# RSS Feed URLs for News Sources

## Verified RSS Feed URLs

### Major News Sources

**New York Times**
- World: `https://rss.nytimes.com/services/xml/rss/nyt/World.xml`
- Business: `https://rss.nytimes.com/services/xml/rss/nyt/Business.xml`
- Technology: `https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml`

**Financial Times**
- Home: `https://www.ft.com/?format=rss`
- World: `https://www.ft.com/world?format=rss`
- Companies: `https://www.ft.com/companies?format=rss`
- Markets: `https://www.ft.com/markets?format=rss`

**Reuters**
- Top News: `https://feeds.reuters.com/reuters/topNews`
- World News: `https://feeds.reuters.com/reuters/worldNews`
- Business: `https://feeds.reuters.com/reuters/businessNews`
- Technology: `https://feeds.reuters.com/reuters/technologyNews`

**Washington Post**
- World: `https://feeds.washingtonpost.com/rss/world`
- Politics: `https://feeds.washingtonpost.com/rss/politics`
- Business: `https://feeds.washingtonpost.com/rss/business`

**Haaretz**
- News: `https://www.haaretz.com/rss`
- Israel News: `https://www.haaretz.com/rss/news/israel-news`

**Wall Street Journal**
- World News: `https://feeds.a.dj.com/rss/RSSWorldNews.xml`
- Business: `https://feeds.a.dj.com/rss/RSSMarketsMain.xml`
- Opinion: `https://feeds.a.dj.com/rss/RSSOpinion.xml`

**Foreign Policy**
- All Articles: `https://foreignpolicy.com/feed/`
- Latest: `https://foreignpolicy.com/feed/?post_type=article`

**Bloomberg**
- Top Stories: `https://feeds.bloomberg.com/markets/news.rss`
- Politics: `https://feeds.bloomberg.com/politics/news.rss`
- Technology: `https://feeds.bloomberg.com/technology/news.rss`

**The Atlantic**
- All: `https://www.theatlantic.com/feed/all/`
- Politics: `https://www.theatlantic.com/feed/channel/politics/`

**The Guardian**
- World: `https://www.theguardian.com/world/rss`
- US News: `https://www.theguardian.com/us-news/rss`
- Business: `https://www.theguardian.com/business/rss`

**Politico (EU)**
- All: `https://www.politico.eu/feed/`
- News: `https://www.politico.eu/news/feed/`

**AP News**
- Top News: `https://apnews.com/apf-topnews`
- World: `https://apnews.com/apf-worldnews`
- Politics: `https://apnews.com/apf-politics`

**The New Yorker**
- News: `https://www.newyorker.com/feed/news`
- Politics: `https://www.newyorker.com/feed/politics`

**Foreign Affairs**
- All: `https://www.foreignaffairs.com/rss.xml`
- Articles: `https://www.foreignaffairs.com/articles/rss.xml`

**Politico (US)**
- All: `https://www.politico.com/rss/politicopicks.xml`
- Congress: `https://www.politico.com/rss/congress.xml`

**Ipsos**
- News: `https://www.ipsos.com/en/rss/news` (if available)
- Note: May require checking their actual RSS endpoints

**Goodreads**
- New Releases: `https://www.goodreads.com/review/list_rss/` (requires user ID)
- Note: Goodreads RSS is user-specific, not general news feed

**Oxford Academic**
- Latest Articles: `https://academic.oup.com/rss/site_5515/` (varies by journal)
- Note: Each journal has its own RSS feed

**The Independent**
- World: `https://www.independent.co.uk/news/world/rss`
- UK News: `https://www.independent.co.uk/news/uk/rss`

**White House**
- Briefings: `https://www.whitehouse.gov/briefing-room/feed/`
- Statements: `https://www.whitehouse.gov/briefing-room/statements-releases/feed/`

**Al Jazeera**
- News Sitemap: `https://www.aljazeera.com/news-sitemap.xml` (sitemap format)
- RSS: `https://www.aljazeera.com/xml/rss/all.xml` (if available)

## Google News RSS Feeds (Alternative)

You can also use Google News RSS feeds which aggregate from multiple sources:

- World: `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en&topic=w`
- Business: `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en&topic=b`
- Technology: `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en&topic=tc`
- Politics: `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en&topic=p`

## Usage

To add these to your database:

```sql
-- Example: Add Reuters Top News
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'your-show-uuid-here',
  'Reuters Top News',
  'https://feeds.reuters.com/reuters/topNews',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices"]'::jsonb
);
```

## Notes

- Some feeds may require authentication or have rate limits
- Feed URLs may change over time - verify periodically
- Some sites may block automated access - use proper User-Agent headers
- Sitemap formats (like Al Jazeera) are supported but have less metadata than RSS

