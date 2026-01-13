# Data Converter System

Complete system to convert your CSV data files into structured JSON for the recommendation engine.

## Quick Start

### 1. Create Directories

```bash
mkdir -p data/raw
mkdir -p data/processed
```

### 2. Copy Your CSV Files

Place your CSV files in `data/raw/`:

- `kibreet_also_watch_channel.csv` - Channels your audience watches (Tubular Labs)
- `kibreet_audiene_watch_videos.csv` - Videos your audience watches (Tubular Labs)
- `Table_data.csv` - Search terms from YouTube Studio
- `Comments_*.csv` - Comment files from TheYouTubeTool (any number of files)

### 3. Run the Converter

```bash
node scripts/masterConverter.js
```

### 4. Output Files

All converted data will be in `data/processed/`:

- `channels.json` - Converted channels with personas and insights
- `audience_videos.json` - Converted videos with topic analysis
- `search_terms.json` - Converted search terms with opportunities
- `comments.json` - Converted comments with questions/requests
- `unified_insights.json` - Combined insights and opportunities
- `persona_report.json` - Persona strength analysis

The system also updates `data/unified_data.json` which is used by the recommendation engine.

## File Structure

```
data/
├── raw/                          ← Put your CSV files here
│   ├── kibreet_also_watch_channel.csv
│   ├── kibreet_audiene_watch_videos.csv
│   ├── Table_data.csv
│   └── Comments_*.csv
│
└── processed/                    ← Output goes here
    ├── channels.json
    ├── audience_videos.json
    ├── search_terms.json
    ├── comments.json
    ├── unified_insights.json
    └── persona_report.json
```

## What Gets Converted

### Channels (`kibreet_also_watch_channel.csv`)
- Categorizes channels (news, politics, business, etc.)
- Identifies direct competitors
- Maps to personas
- Calculates relevance scores

### Videos (`kibreet_audiene_watch_videos.csv`)
- Extracts topics from titles
- Identifies relevant videos
- Maps to personas
- Finds topic opportunities

### Search Terms (`Table_data.csv`)
- Filters YT_SEARCH entries
- Detects topics and intent
- Identifies branded vs non-branded
- Finds high-opportunity searches

### Comments (`Comments_*.csv`)
- Detects questions and requests
- Analyzes sentiment
- Extracts video ideas
- Identifies actionable content

## Integration with Recommendation Engine

The converted data is automatically integrated:

1. **Unified Data** (`data/unified_data.json`) is used by:
   - `lib/data/dataImporter.js` - Loads all data
   - `lib/analysis/audienceAnalyzer.js` - Analyzes audience
   - `lib/analysis/commentAnalyzer.js` - Analyzes comments
   - `lib/recommendations/unifiedRecommender.js` - Generates recommendations

2. **Persona Report** is used by:
   - Persona matching in recommendations
   - Content scoring
   - Topic suggestions

3. **Unified Insights** provides:
   - Top opportunities
   - Audience voice (questions/requests)
   - Search opportunities

## Example Output

### Unified Insights
```json
{
  "opportunities": [
    {
      "type": "SEARCH",
      "priority": "HIGH",
      "title": "\"الصين\" - 10847 views",
      "action": "اصنع فيديو عن \"الصين\""
    }
  ],
  "audienceVoice": {
    "topQuestions": [...],
    "topRequests": [...]
  }
}
```

### Persona Report
```json
{
  "personas": [
    {
      "id": "geopolitics",
      "name": "🌍 المحلل الجيوسياسي",
      "strength": 85,
      "signals": [...]
    }
  ]
}
```

## Troubleshooting

### "File not found" errors
- Make sure CSV files are in `data/raw/`
- Check file names match exactly (case-sensitive)

### "No data converted" 
- Check CSV format (should have headers)
- Verify files aren't empty
- Check for encoding issues (should be UTF-8)

### Column name mismatches
- The converters try multiple column name variations
- If your CSV has different headers, update the converter files

## Next Steps

After conversion:

1. **Review Insights**: Check `data/processed/unified_insights.json` for opportunities
2. **Check Personas**: Review `data/processed/persona_report.json` for persona strength
3. **Use in Recommendations**: The data is automatically used by the recommendation engine
4. **Update Regularly**: Re-run converter when you get new data

## Manual Column Mapping

If your CSV files have different column names, update these files:

- `lib/data/converters/channelsConverter.js` - Channel columns
- `lib/data/converters/videosConverter.js` - Video columns
- `lib/data/converters/searchConverter.js` - Search term columns
- `lib/data/converters/commentsConverter.js` - Comment columns

The converters already try multiple common variations, but you can add more if needed.




