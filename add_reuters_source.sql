-- Add Reuters RSS feed (good economics/geopolitics coverage)
-- Replace the show_id with your actual UUID

INSERT INTO signal_sources (show_id, name, url, enabled, item_limit, dna_topics)
VALUES (
  '00000000-0000-0000-0000-000000000004',  -- Replace with your show UUID
  'Reuters - Top News',
  'https://feeds.reuters.com/reuters/topNews',
  true,
  20,
  '["us_china_geopolitics", "currency_devaluation", "sanctions_econ_war", "energy_oil_gas_lng", "inflation_prices", "us_debt_treasuries"]'::jsonb
);

-- Verify it was added
SELECT id, name, url, enabled, dna_topics 
FROM signal_sources 
WHERE show_id = '00000000-0000-0000-0000-000000000004';

