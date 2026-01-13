-- Recommended RSS feeds for Economics/Geopolitics DNA
-- These sources better match topics like: us_china_geopolitics, currency_devaluation, inflation_prices, etc.
-- Replace 'YOUR_SHOW_UUID' with your actual show UUID

-- Reuters - Top News (Good for geopolitics + economics)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Reuters - Top News',
  'https://feeds.reuters.com/reuters/topNews',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "sanctions_econ_war", "energy_oil_gas_lng"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Reuters - Business News (Economics focus)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Reuters - Business',
  'https://feeds.reuters.com/reuters/businessNews',
  true,
  20,
  '["currency_devaluation", "inflation_prices", "us_debt_treasuries", "consumer_credit_cards"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Financial Times - World (Economics + Geopolitics)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Financial Times - World',
  'https://www.ft.com/world?format=rss',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Financial Times - Markets (Economics focus)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Financial Times - Markets',
  'https://www.ft.com/markets?format=rss',
  true,
  20,
  '["currency_devaluation", "us_debt_treasuries", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Bloomberg - Markets (Strong economics focus)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Bloomberg - Markets',
  'https://feeds.bloomberg.com/markets/news.rss',
  true,
  20,
  '["currency_devaluation", "us_debt_treasuries", "inflation_prices", "energy_oil_gas_lng"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Wall Street Journal - World News (Economics + Geopolitics)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'WSJ - World News',
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "us_debt_treasuries", "sanctions_econ_war"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- AP News - Top News (Good mix)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'AP News - Top News',
  'https://apnews.com/apf-topnews',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "sanctions_econ_war"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Foreign Policy (Geopolitics focus)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Foreign Policy',
  'https://foreignpolicy.com/feed/',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "logistics_supply_chain"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Foreign Affairs (Deep geopolitics + economics)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'Foreign Affairs',
  'https://www.foreignaffairs.com/rss.xml',
  true,
  20,
  '["us_china_geopolitics", "sanctions_econ_war", "logistics_supply_chain", "currency_devaluation"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- New York Times - World (Good balance)
INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  'YOUR_SHOW_UUID',
  'NY Times - World',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "inflation_prices", "sanctions_econ_war"]'::jsonb
)
ON CONFLICT DO NOTHING;

