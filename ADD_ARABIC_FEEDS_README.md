# 📡 Adding Arabic RSS Feeds - Instructions

## ✅ File Created

**File:** `add_arabic_rss_feeds.sql`

This file contains **30 Arabic RSS feeds** organized into 3 categories:

1. **Google News by Topic** (15 feeds) - Topic-based searches
2. **Google News by Source** (12 feeds) - Source-specific searches  
3. **Direct RSS Feeds** (3 feeds) - Direct RSS URLs

---

## 🚀 How to Add These Feeds

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### Step 2: Update Show ID

**IMPORTANT:** Before running the SQL, replace the show_id:

```sql
-- Find this line in the SQL file:
'00000000-0000-0000-0000-000000000004'

-- Replace with your actual show UUID
-- You can find it by running:
SELECT id, name FROM shows;
```

### Step 3: Run the SQL File

1. Copy the entire contents of `add_arabic_rss_feeds.sql`
2. Paste into Supabase SQL Editor
3. Replace all instances of `'00000000-0000-0000-0000-000000000004'` with your actual show_id
4. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Step 4: Verify Feeds Were Added

The SQL file includes verification queries at the end. You should see:
- 30 new feeds added
- All feeds with `enabled = true`

---

## 📊 What Feeds Are Added?

### Google News by Topic (15 feeds):
- اقتصاد عربي (Arabic Economy)
- النفط والطاقة (Oil & Energy)
- الذهب والاستثمار (Gold & Investment)
- السعودية اقتصاد (Saudi Economy)
- الإمارات اقتصاد (UAE Economy)
- مصر اقتصاد (Egypt Economy)
- الصين وأمريكا (China & USA)
- ترامب (Trump)
- الذكاء الاصطناعي (AI)
- تسلا وماسك (Tesla & Musk)
- العملات الرقمية (Cryptocurrency)
- أزمات اقتصادية (Economic Crises)
- البنوك المركزية (Central Banks)
- التضخم والأسعار (Inflation & Prices)
- رواد الأعمال (Entrepreneurs)

### Google News by Source (12 feeds):
- الجزيرة نت - اقتصاد (Al Jazeera Economy)
- الجزيرة نت - سياسة (Al Jazeera Politics)
- العربية - اقتصاد (Al Arabiya Economy)
- الشرق بلومبرج (Asharq Bloomberg)
- سكاي نيوز عربية - اقتصاد (Sky News Arabia Economy)
- CNN عربي - اقتصاد (CNN Arabic Economy)
- BBC عربي - اقتصاد (BBC Arabic Economy)
- الشرق الأوسط (Asharq Al-Awsat)
- فرانس 24 عربي (France 24 Arabic)
- الاقتصادية (Al-Eqtisadiah)
- أرقام (Argaam)
- مباشر (Mubasher)

### Direct RSS Feeds (3 feeds):
- Sky News Arabia (Direct RSS)
- Al Jazeera English (Direct RSS)
- Arab News (Direct RSS)

---

## 🎯 Expected Results

After adding these feeds and running RSS Update:

| Before | After |
|--------|-------|
| ~46 items processed | **200+ items processed** |
| 1-2 signals saved | **15-30 signals saved** |
| English only | **Arabic + English** |
| Limited sources | **30+ Arabic sources** |

---

## ⚠️ Important Notes

### 1. Show ID Format
- The SQL uses UUID format: `'00000000-0000-0000-0000-000000000004'`
- If your `show_id` column is BIGINT, you may need to:
  - Find the numeric ID: `SELECT id FROM shows WHERE name = 'Your Show Name';`
  - Replace UUID strings with numeric IDs in the SQL

### 2. DNA Topics
- Each feed has `dna_topics` configured based on its category
- You can update these later if needed:
  ```sql
  UPDATE signal_sources 
  SET dna_topics = '["new_topic_id"]'::jsonb
  WHERE name = 'Feed Name';
  ```

### 3. Feed Limits
- All feeds are set to `item_limit = 20` (fetches 20 items per feed)
- You can adjust this per feed if needed

### 4. Enabled Status
- All feeds are set to `enabled = true` by default
- To disable a feed: `UPDATE signal_sources SET enabled = false WHERE name = 'Feed Name';`

---

## 🔧 Troubleshooting

### Issue: "ERROR: invalid input syntax for type bigint"
**Solution:** Your `show_id` column is BIGINT, not UUID. You need to:
1. Find your numeric show_id: `SELECT id FROM shows;`
2. Replace all UUID strings in the SQL with the numeric ID

### Issue: "ERROR: duplicate key value violates unique constraint"
**Solution:** Some feeds might already exist. The SQL doesn't use `ON CONFLICT`, so you'll need to:
1. Check existing feeds: `SELECT name FROM signal_sources WHERE show_id = 'YOUR_SHOW_ID';`
2. Remove duplicate INSERT statements from the SQL file

### Issue: "ERROR: relation 'signal_sources' does not exist"
**Solution:** The table might have a different name. Check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%source%' OR table_name LIKE '%feed%';
```

---

## 📝 Next Steps

1. ✅ Run the SQL file in Supabase
2. ✅ Verify feeds were added (use the verification queries at the end of the SQL file)
3. ✅ Go to Signals page in your app
4. ✅ Click "Update RSS Feeds"
5. ✅ Check that new Arabic items are being processed
6. ✅ Verify signals are being saved with Arabic content

---

## 🎉 Success Indicators

You'll know it worked when:
- ✅ RSS Update processes 200+ items (instead of ~46)
- ✅ Signals page shows Arabic titles
- ✅ More signals are saved (15-30 instead of 1-2)
- ✅ Server logs show feeds like "الجزيرة نت - اقتصاد" being processed

---

## 📞 Need Help?

If feeds aren't working:
1. Check server console logs during RSS Update
2. Verify feeds are enabled: `SELECT name, enabled FROM signal_sources WHERE show_id = 'YOUR_SHOW_ID';`
3. Test a feed URL manually in a browser to ensure it's accessible
4. Check if RSS parser is handling Arabic characters correctly




