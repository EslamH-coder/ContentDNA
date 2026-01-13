-- Remove Al Jazeera RSS source
DELETE FROM signal_sources 
WHERE url LIKE '%aljazeera%' OR name LIKE '%Al Jazeera%';

