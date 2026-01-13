-- SQL script to add RSS feed sources for major news outlets
-- Replace 'YOUR_SHOW_UUID' with your actual show UUID

-- New York Times
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'NY Times - World',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "sanctions_econ_war"]'::jsonb
);

-- Financial Times
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Financial Times - World',
  'https://www.ft.com/world?format=rss',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
);

-- Reuters
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Reuters - Top News',
  'https://feeds.reuters.com/reuters/topNews',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "sanctions_econ_war", "energy_oil_gas_lng"]'::jsonb
);

-- Washington Post
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Washington Post - World',
  'https://feeds.washingtonpost.com/rss/world',
  true,
  20,
  '["us_china_geopolitics", "us_debt_treasuries", "sanctions_econ_war"]'::jsonb
);

-- Haaretz
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Haaretz - News',
  'https://www.haaretz.com/rss',
  true,
  20,
  '["sanctions_econ_war", "us_china_geopolitics"]'::jsonb
);

-- Wall Street Journal
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'WSJ - World News',
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "us_debt_treasuries", "inflation_prices"]'::jsonb
);

-- Foreign Policy
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Foreign Policy',
  'https://foreignpolicy.com/feed/',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "logistics_supply_chain"]'::jsonb
);

-- Bloomberg
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Bloomberg - Top Stories',
  'https://feeds.bloomberg.com/markets/news.rss',
  true,
  20,
  '["currency_devaluation", "us_debt_treasuries", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
);

-- The Atlantic
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'The Atlantic - All',
  'https://www.theatlantic.com/feed/all/',
  true,
  20,
  '["us_china_geopolitics", "consumer_credit_cards"]'::jsonb
);

-- The Guardian
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'The Guardian - World',
  'https://www.theguardian.com/world/rss',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "currency_devaluation"]'::jsonb
);

-- Politico EU
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Politico EU',
  'https://www.politico.eu/feed/',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "logistics_supply_chain"]'::jsonb
);

-- AP News
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'AP News - Top News',
  'https://apnews.com/apf-topnews',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "currency_devaluation"]'::jsonb
);

-- The New Yorker
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'The New Yorker - News',
  'https://www.newyorker.com/feed/news',
  true,
  20,
  '["us_china_geopolitics", "consumer_credit_cards"]'::jsonb
);

-- Foreign Affairs
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Foreign Affairs',
  'https://www.foreignaffairs.com/rss.xml',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "logistics_supply_chain"]'::jsonb
);

-- Politico US
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Politico US',
  'https://www.politico.com/rss/politicopicks.xml',
  true,
  20,
  '["us_debt_treasuries", "us_china_geopolitics"]'::jsonb
);

-- The Independent
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'The Independent - World',
  'https://www.independent.co.uk/news/world/rss',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "currency_devaluation"]'::jsonb
);

-- White House
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'White House - Briefings',
  'https://www.whitehouse.gov/briefing-room/feed/',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "us_debt_treasuries"]'::jsonb
);

-- Al Jazeera (Sitemap format - already supported)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Al Jazeera - News',
  'https://www.aljazeera.com/news-sitemap.xml',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "currency_devaluation"]'::jsonb
);

-- Google News - World (Alternative aggregator)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Google News - World',
  'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en&topic=w',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "sanctions_econ_war", "inflation_prices"]'::jsonb
);

