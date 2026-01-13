# Quick Start: Data Converter

## Step 1: Place Your Files

Copy your CSV files to `data/raw/`:

```bash
cp kibreet_also_watch_channel.csv data/raw/
cp kibreet_audiene_watch_videos.csv data/raw/
cp Table_data.csv data/raw/
cp Comments_*.csv data/raw/
```

## Step 2: Run Converter

```bash
node scripts/masterConverter.js
```

## Step 3: Check Results

```bash
ls -lh data/processed/
```

You should see:
- `channels.json`
- `audience_videos.json`
- `search_terms.json`
- `comments.json`
- `unified_insights.json`
- `persona_report.json`

## Step 4: Use in Recommendations

The data is automatically loaded by:
- `lib/data/dataImporter.js` → `loadUnifiedData()`
- `lib/recommendations/unifiedRecommender.js` → Uses all data

## Expected Output

### Top Opportunities (from unified_insights.json)
- Search terms with high views
- Audience requests from comments
- Topic opportunities from videos

### Persona Strength (from persona_report.json)
- Which personas are strongest
- Evidence from channels, searches, videos

### Audience Voice (from comments.json)
- Top questions
- Top requests
- Video ideas

## Troubleshooting

**"Cannot find module"**
- Make sure you're in the `cursor/` directory
- Check that all converter files exist in `lib/data/converters/`

**"File not found"**
- Verify CSV files are in `data/raw/`
- Check file names match exactly

**"No data converted"**
- Check CSV has headers
- Verify file encoding is UTF-8
- Check for empty files




