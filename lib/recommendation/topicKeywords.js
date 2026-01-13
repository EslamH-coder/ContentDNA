// Topic keywords for classification (no LLM needed)
export const TOPIC_KEYWORDS = {
  'us_china_geopolitics': {
    primary: ['china', 'us', 'america', 'trade war', 'tariff', 'الصين', 'أمريكا', 'trump china', 'beijing'],
    secondary: ['xi jinping', 'trump', 'sanctions', 'decoupling', 'washington']
  },
  'missiles_air_defense': {
    primary: ['missile', 'defense', 'صاروخ', 'دفاع جوي', 'patriot', 'iron dome', 's-400'],
    secondary: ['military', 'weapon', 'strike', 'attack', 'air defense']
  },
  'big_tech_platforms': {
    primary: ['tesla', 'google', 'apple', 'meta', 'amazon', 'microsoft', 'nvidia', 'openai'],
    secondary: ['tech giant', 'silicon valley', 'AI', 'تسلا', 'جوجل', 'أبل', 'artificial intelligence']
  },
  'logistics_supply_chain': {
    primary: ['shipping', 'supply chain', 'logistics', 'port', 'container', 'freight'],
    secondary: ['cargo', 'suez', 'red sea', 'houthi', 'maersk']
  },
  'consumer_credit_cards': {
    primary: ['credit card', 'bnpl', 'buy now pay later', 'consumer debt', 'loan default'],
    secondary: ['tabby', 'tamara', 'installment', 'debt crisis']
  },
  'currency_devaluation': {
    primary: ['currency', 'devaluation', 'exchange rate', 'dollar', 'pound crisis'],
    secondary: ['inflation', 'central bank', 'forex', 'جنيه', 'دولار', 'imf']
  },
  'energy_oil_gas_lng': {
    primary: ['oil', 'gas', 'opec', 'lng', 'energy crisis', 'نفط', 'غاز'],
    secondary: ['petroleum', 'crude', 'aramco', 'pipeline', 'oil price']
  },
  'arms_industry_exports': {
    primary: ['arms', 'weapons export', 'defense industry', 'military sale', 'arms deal'],
    secondary: ['lockheed', 'raytheon', 'boeing defense', 'سلاح', 'صفقة أسلحة']
  },
  'ai_automation_jobs': {
    primary: ['AI jobs', 'automation', 'robots replace', 'job loss', 'robotaxi', 'self-driving'],
    secondary: ['artificial intelligence', 'machine learning', 'autonomous', 'ذكاء اصطناعي', 'وظائف']
  },
  'gold_commodities': {
    primary: ['gold', 'gold price', 'central bank gold', 'ذهب', 'bullion'],
    secondary: ['commodity', 'precious metal', 'reserve']
  },
  'us_debt_treasuries': {
    primary: ['treasury', 'debt', 'bonds', 'yield', 'fed', 'interest rate'],
    secondary: ['federal reserve', 'us debt', 'government bonds', 'treasury bill']
  },
  'inflation_prices': {
    primary: ['inflation', 'prices', 'cpi', 'cost of living', 'أسعار', 'تضخم'],
    secondary: ['price increase', 'consumer price', 'inflation rate']
  }
};

// Entities to extract
export const ENTITY_LISTS = {
  companies: ['Tesla', 'Google', 'Apple', 'Meta', 'Amazon', 'Microsoft', 'Nvidia', 'Uber', 'OpenAI', 'SpaceX', 'Boeing', 'Lockheed', 'Raytheon', 'Maersk', 'Aramco'],
  people: ['Musk', 'Trump', 'Biden', 'Xi Jinping', 'إيلون ماسك', 'ترامب', 'بايدن', 'MBS', 'محمد بن سلمان', 'Elon Musk'],
  arabRegions: ['Dubai', 'Saudi', 'UAE', 'Gulf', 'Egypt', 'Qatar', 'MENA', 'Middle East', 'GCC', 'الخليج', 'السعودية', 'الإمارات', 'مصر', 'دبي', 'قطر', 'الدوحة', 'السعودية', 'الإمارات العربية المتحدة']
};

