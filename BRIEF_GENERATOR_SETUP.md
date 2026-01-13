# Brief Generator Setup

## Overview
The Brief Generator uses Claude API (Anthropic) to generate Arabic content briefs from RSS signals.

## Setup Steps

### 1. Get Anthropic API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

### 2. Add to Environment Variables
Add this to your `.env.local` file:

```bash
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

### 3. Restart Dev Server
After adding the key, restart your Next.js dev server:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

## Usage

1. Go to `http://localhost:3000/signals`
2. Click "Generate Brief" button on any signal
3. Wait for the brief to be generated (takes 5-10 seconds)
4. The brief will appear in an alert/modal with:
   - Title (Arabic)
   - Hook (opening line)
   - Angle (approach)
   - Why Now (timing)
   - Target Audience
   - Key Points
   - Practical Outcome

## API Endpoint

The API route is at: `/api/generate-brief`

**Request:**
```json
POST /api/generate-brief
{
  "signal": {
    "id": "...",
    "title": "...",
    "description": "...",
    "url": "...",
    "score": 7.5,
    "hook_potential": 8.0,
    "type": "news",
    "raw_data": {
      "sourceName": "Bloomberg",
      "scoring": {
        "topicId": "us_china_geopolitics"
      }
    }
  },
  "showDna": ["us_china_geopolitics", "currency_devaluation"]
}
```

**Response:**
```json
{
  "success": true,
  "brief": {
    "title_ar": "...",
    "hook_ar": "...",
    "angle_ar": "...",
    "why_now_ar": "...",
    "target_audience_ar": "...",
    "key_points_ar": ["...", "..."],
    "practical_outcome_ar": "..."
  }
}
```

## Model Used
- **Model**: `claude-sonnet-4-20250514`
- **Max Tokens**: 2000
- **Language**: Arabic (Modern Standard Arabic)

## Cost
- Claude Sonnet 4 pricing: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- Each brief generation uses ~500-1000 tokens
- Estimated cost: ~$0.01-0.02 per brief

## Troubleshooting

### Error: "ANTHROPIC_API_KEY not configured"
- Make sure you added the key to `.env.local`
- Restart the dev server after adding the key
- Check that the key starts with `sk-ant-`

### Error: "Failed to generate brief"
- Check your API key is valid
- Check your Anthropic account has credits
- Check the browser console for detailed error messages

### Brief is in English or wrong format
- The prompt is configured for Arabic content
- If you see English, check the API response in browser console
- The model should return JSON with Arabic fields

