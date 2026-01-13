/**
 * SOURCE CONFIGURATION
 * All the sources that bring winner content
 * Based on what works for المخبر الاقتصادي+
 */

export const SOURCE_CONFIG = {
  
  // ============================================
  // 1. SPECIALIZED RSS FEEDS
  // ============================================
  rss: {
    // Tier 1: High-value sources (geopolitics, economy)
    tier1: [
      {
        name: 'Reuters World',
        url: 'https://www.reutersagency.com/feed/?best-regions=middle-east&post_type=best',
        category: 'geopolitics',
        language: 'en',
        quality: 9,
        refreshMinutes: 30
      },
      {
        name: 'Al Jazeera English',
        url: 'https://www.aljazeera.com/xml/rss/all.xml',
        category: 'geopolitics',
        language: 'en',
        quality: 9,
        refreshMinutes: 30
      },
      {
        name: 'Financial Times World',
        url: 'https://www.ft.com/world?format=rss',
        category: 'economy',
        language: 'en',
        quality: 9,
        refreshMinutes: 60
      },
      {
        name: 'Bloomberg Markets',
        url: 'https://feeds.bloomberg.com/markets/news.rss',
        category: 'economy',
        language: 'en',
        quality: 9,
        refreshMinutes: 30
      },
      {
        name: 'The Economist',
        url: 'https://www.economist.com/international/rss.xml',
        category: 'analysis',
        language: 'en',
        quality: 10,
        refreshMinutes: 120
      },
      {
        name: 'Foreign Policy',
        url: 'https://foreignpolicy.com/feed/',
        category: 'geopolitics',
        language: 'en',
        quality: 9,
        refreshMinutes: 60
      }
    ],
    
    // Tier 2: Regional focus (Middle East, Arab world)
    tier2: [
      {
        name: 'Middle East Eye',
        url: 'https://www.middleeasteye.net/rss',
        category: 'middle_east',
        language: 'en',
        quality: 8,
        refreshMinutes: 30
      },
      {
        name: 'Al-Monitor',
        url: 'https://www.al-monitor.com/rss',
        category: 'middle_east',
        language: 'en',
        quality: 8,
        refreshMinutes: 30
      },
      {
        name: 'Arab News',
        url: 'https://www.arabnews.com/rss.xml',
        category: 'arab_world',
        language: 'en',
        quality: 7,
        refreshMinutes: 30
      },
      {
        name: 'Gulf News',
        url: 'https://gulfnews.com/rss',
        category: 'gulf',
        language: 'en',
        quality: 7,
        refreshMinutes: 30
      }
    ],
    
    // Tier 3: Specialized (Tech, Energy, Trade)
    tier3: [
      {
        name: 'CNBC Economy',
        url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
        category: 'economy',
        language: 'en',
        quality: 7,
        refreshMinutes: 30
      },
      {
        name: 'OilPrice.com',
        url: 'https://oilprice.com/rss/main',
        category: 'energy',
        language: 'en',
        quality: 8,
        refreshMinutes: 60
      },
      {
        name: 'TechCrunch',
        url: 'https://techcrunch.com/feed/',
        category: 'tech',
        language: 'en',
        quality: 7,
        refreshMinutes: 30
      }
    ]
  },
  
  // ============================================
  // 2. GOOGLE NEWS CUSTOM QUERIES
  // Based on what works (from channel data)
  // ============================================
  googleNews: {
    // Power Players (highest performing)
    powerPlayers: [
      {
        name: 'Trump News',
        query: 'trump',
        expectedScore: 85,
        refreshMinutes: 15
      },
      {
        name: 'Trump Trade War',
        query: 'trump tariffs OR trump trade war OR trump china',
        expectedScore: 90,
        refreshMinutes: 15
      },
      {
        name: 'Elon Musk',
        query: 'elon musk',
        expectedScore: 75,
        refreshMinutes: 30
      },
      {
        name: 'Putin',
        query: 'putin russia',
        expectedScore: 75,
        refreshMinutes: 30
      },
      {
        name: 'Xi Jinping',
        query: 'xi jinping china',
        expectedScore: 75,
        refreshMinutes: 30
      }
    ],
    
    // Conflicts (high engagement)
    conflicts: [
      {
        name: 'US China',
        query: 'us china conflict OR us china trade war OR us china tensions',
        expectedScore: 85,
        refreshMinutes: 30
      },
      {
        name: 'US Russia',
        query: 'us russia sanctions OR us russia conflict',
        expectedScore: 80,
        refreshMinutes: 30
      },
      {
        name: 'Iran Nuclear',
        query: 'iran nuclear OR iran sanctions OR iran us',
        expectedScore: 80,
        refreshMinutes: 30
      }
    ],
    
    // Economy (consistent performer)
    economy: [
      {
        name: 'Federal Reserve',
        query: 'federal reserve interest rate OR fed rate decision',
        expectedScore: 75,
        refreshMinutes: 60
      },
      {
        name: 'Oil Prices',
        query: 'oil prices opec OR crude oil',
        expectedScore: 70,
        refreshMinutes: 60
      },
      {
        name: 'Dollar',
        query: 'dollar currency OR dollar crisis OR dollar collapse',
        expectedScore: 70,
        refreshMinutes: 60
      }
    ],
    
    // Arab Region (audience relevance)
    arabRegion: [
      {
        name: 'Saudi Economy',
        query: 'saudi arabia economy OR saudi vision 2030 OR aramco',
        expectedScore: 80,
        refreshMinutes: 60
      },
      {
        name: 'Egypt Economy',
        query: 'egypt economy OR egyptian pound OR egypt imf',
        expectedScore: 80,
        refreshMinutes: 60
      },
      {
        name: 'UAE Business',
        query: 'uae economy OR dubai business OR abu dhabi investment',
        expectedScore: 70,
        refreshMinutes: 60
      },
      {
        name: 'Suez Canal',
        query: 'suez canal',
        expectedScore: 85,
        refreshMinutes: 60
      }
    ],
    
    // Tech Giants (good for variety)
    tech: [
      {
        name: 'AI',
        query: 'artificial intelligence regulation OR chatgpt OR openai',
        expectedScore: 70,
        refreshMinutes: 60
      },
      {
        name: 'Tech War',
        query: 'chip war OR semiconductor china OR nvidia china',
        expectedScore: 75,
        refreshMinutes: 60
      }
    ]
  },
  
  // ============================================
  // 3. GOOGLE TRENDS TOPICS
  // ============================================
  googleTrends: {
    // Regions to monitor
    regions: ['EG', 'SA', 'AE', 'US'],
    
    // Keywords to track
    trackedKeywords: [
      'ترامب', 'trump',
      'الدولار', 'dollar',
      'النفط', 'oil',
      'الصين', 'china',
      'حرب', 'war'
    ]
  }
};

// ============================================
// SOURCE QUALITY MULTIPLIER
// ============================================
export const SOURCE_QUALITY = {
  'The Economist': 1.3,
  'Financial Times World': 1.2,
  'Reuters World': 1.2,
  'Bloomberg Markets': 1.2,
  'Foreign Policy': 1.2,
  'Al Jazeera English': 1.1,
  'Middle East Eye': 1.1,
  'Google News': 1.0,
  'default': 1.0
};




