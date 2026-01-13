# DNA Import Guide

## Overview

The DNA Import system allows you to build the Living DNA from your existing video performance data (CSV file). This DNA will then be used by the LLM to generate better titles and hooks.

## How It Works

1. **Upload CSV** → Parse video data
2. **Build DNA** → Analyze topics, hooks, patterns
3. **Save DNA** → Store in `data/living_dna.json`
4. **LLM Uses DNA** → All content generation now includes DNA context

## CSV Format

Your CSV file should include these columns:

### Required Columns:
- `title` - Video title
- `views` - View count (number)

### Recommended Columns:
- `topic_1`, `topic_2`, `topic_3` - Topics covered in the video
- `hook_first_15s_text` - The hook text (first 15 seconds)
- `%Audience retention at 30s Longform` - Retention percentage
- `%CTR` - Click-through rate
- `Average % viewed long_form` - Average percentage viewed
- `duration` - Video duration (minutes)
- `format` - `long_form` or `short_form`

### Optional Columns:
- `%Retention 3 seconds #Shorts` - For shorts
- `% Viewed vs Swiped away short_form` - For shorts
- `chapters/beats` - Chapter structure

## Column Name Variations

The system tries multiple column name variations (case-insensitive):
- `topic_1`, `topic 1`, `Topic 1`
- `hook_first_15s_text`, `hook first 15s text`, `Hook First 15s Text`
- `%Audience retention at 30s Longform`, `retention_30s`, `retention at 30s`
- `%CTR`, `ctr`, `CTR`
- `duration`, `duration_minutes`, `duration minutes`

## Usage

### Step 1: Prepare Your CSV

Make sure your CSV has at least:
- `title` column
- `views` column

### Step 2: Import DNA

1. Go to `/dna/import` page
2. Upload your CSV file
3. Click "Import & Build DNA"

### Step 3: Verify DNA

1. Go to `/dna` page to see DNA visualization
2. Check `/api/dna/dashboard` for DNA summary
3. Check `/api/dna/prompt` to see DNA prompt format

## What Gets Built

The DNA builder analyzes:

1. **Topics** - Performance by topic (avg views, retention, CTR)
2. **Hook Patterns** - Which hook patterns work best
3. **Format Insights** - Optimal video duration
4. **Audience Behavior** - Click triggers, retention triggers, traps
5. **Banned Content** - Weak topics and failed patterns

## Example CSV

```csv
title,views,topic_1,topic_2,hook_first_15s_text,%Audience retention at 30s Longform,%CTR,duration,format
"لماذا يدعم ترمب المشروع المنافس لقناة السويس؟",2851313,us_china_geopolitics,logistics_supply_chain,"في 13 فبراير 2025 الرئيس الأمريكي دونالد ترامب استقبل في البيت الأبيض رئيس الوزراء الهندي...",76,5.4,25,long_form
"كيف سيدمر ترمب اقتصاد أمريكا قريباً؟",2688507,us_china_trade,currency_devaluation,"جهاز الآيفون اللي بتنتجه شركة أبل هو المسؤول عن الجزء الأكبر من إيرادات الشركة اللي قيمتها، تحديداً في 1 أبريل 2025، كانت بتقترب من 3.4 تريليون دولار",74,6.2,27,long_form
```

## Result

After import, the LLM will see:

```
# Channel DNA - المُخبر الاقتصادي+
آخر تحديث: 2025-12-28
إجمالي الفيديوهات المحللة: 12

## 📊 أداء المواضيع:
- us_china_geopolitics: 2,851,313 مشاهدة، 76% retention (5 فيديو)
- logistics_supply_chain: 2,100,000 مشاهدة، 74% retention (3 فيديو)

## 🎣 أنماط Hook الناجحة:
### date_entity_action (76% retention)
مثال: "في 13 فبراير 2025 الرئيس الأمريكي..."

## 🚫 ممنوع استخدامها نهائياً:
- "هل تعلم أن"
- "ما لا تعرفه"
- "الحقائق المخفية"
```

## Next Steps

1. **Import DNA** - Use `/dna/import` to build initial DNA
2. **Update DNA** - Use `/api/dna/update` to add new videos as they perform
3. **View DNA** - Use `/dna` page to visualize DNA
4. **Generate Content** - LLM automatically uses DNA for all content generation

## Troubleshooting

### "No valid videos found"
- Make sure CSV has `title` and `views` columns
- Check that views column has numeric values

### "Failed to parse CSV"
- Try saving CSV as UTF-8 encoding
- Check for special characters in column names
- Make sure CSV uses commas (not semicolons) as delimiters

### "DNA not showing in LLM"
- Check `/api/dna/prompt` to verify DNA is loaded
- Check `/api/dna/dashboard` to see DNA summary
- Make sure DNA file exists at `data/living_dna.json`




