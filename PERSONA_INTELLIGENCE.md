# Persona Intelligence System

## Overview

The Persona Intelligence System matches content to specific audience personas, tracks content serving, monitors growth, and uses competitors as topic sources.

## Architecture

```
News Items
    ↓
🧬 DNA Filter (reject irrelevant)
    ↓
👥 Match to Personas (who is this for?)
    ↓
📊 Check Serving Status (who needs content?)
    ↓
⚡ Prioritize Underserved
    ↓
✍️ Generate Grounded Content
    ↓
🎯 Track Serving
```

## The 6 Personas

| Icon | Persona | Key Interests |
|------|---------|---------------|
| 🇪🇬 | رجل الأعمال المصري | الجنيه، السويس، الاستثمار |
| 🛢️ | متابع النفط الخليجي | أوبك، أرامكو، رؤية 2030 |
| 🌍 | المحلل الجيوسياسي | ترامب، الصين، الصراعات |
| 💻 | متابع التقنية | AI، ماسك، حرب الرقائق |
| 📊 | المستثمر الفردي | الذهب، الدولار، الفيدرالي |
| 🇲🇦 | المشاهد المغاربي | أوروبا، الهجرة، فرنسا |

## Files Created

### 1. `lib/personas/personaDefinitions.js`
- Defines 6 personas based on channel data
- Includes demographics, interests, trigger keywords
- Defines serving goals (weekly/monthly)

### 2. `lib/personas/personaEngine.js`
- Matches news items to personas
- Tracks serving history per persona
- Checks serving status
- Provides persona suggestions

### 3. `lib/personas/growthMonitor.js`
- Analyzes YouTube data for growth signals
- Detects new countries
- Identifies trending topics
- Suggests new personas

### 4. `lib/personas/competitorPitching.js`
- Gets topic pitches from competitors
- Analyzes adjacent content for inspiration
- Matches pitches to personas
- Generates weekly pitch reports

### 5. `lib/pipeline/personaAwarePipeline.js`
- Full pipeline with persona matching
- Prioritizes underserved personas
- Integrates with grounded generation

### 6. `app/api/personas/route.js`
- API endpoints for persona operations
- Serving status, pitches, growth signals

## Usage

### Match News to Personas

```javascript
import { matchNewsToPersona } from '@/lib/personas/personaEngine.js';

const match = matchNewsToPersona(newsItem);
// Returns: { primaryPersona, secondaryPersonas, allMatches }
```

### Check Serving Status

```javascript
import { getServingStatus } from '@/lib/personas/personaEngine.js';

const status = await getServingStatus();
// Returns: { week, personas: {...}, needsAttention: [...] }
```

### Get Competitor Pitches

```javascript
import { getCompetitorPitches } from '@/lib/personas/competitorPitching.js';

const pitches = await getCompetitorPitches();
// Returns: Array of pitches with target personas
```

### Run Persona-Aware Pipeline

```javascript
import { runPersonaAwarePipeline } from '@/lib/pipeline/personaAwarePipeline.js';

const result = await runPersonaAwarePipeline(newsItems);
// Returns: { results: [...], stats: {...} }
```

## API Endpoints

### GET `/api/personas?action=list`
Returns all personas

### GET `/api/personas?action=serving-status`
Returns current serving status for all personas

### GET `/api/personas?action=pitches`
Returns competitor pitches

### GET `/api/personas?action=pitch-report`
Returns weekly pitch report

### POST `/api/personas` with `action: 'match'`
Matches a news item to personas

### POST `/api/personas` with `action: 'track-serving'`
Tracks that a persona was served

## Features

### ✅ Content Matching
- Each news item matched to best persona(s)
- Score-based matching with keywords and interests
- Supports multiple personas per item

### ✅ Serving Tracking
- Tracks content per persona per week
- Weekly goals for each persona
- Alerts for underserved personas

### ✅ Competitor Intelligence
- Gets topic ideas from direct competitors
- Learns from adjacent content
- Matches pitches to personas

### ✅ Growth Monitoring
- Detects new countries in audience
- Identifies trending topics
- Suggests new personas when needed

### ✅ Prioritization
- Prioritizes content for underserved personas
- Ensures balanced serving across all personas
- Focuses on personas with no content this week

## Integration

The persona system integrates with:
- DNA Filter (filters irrelevant content first)
- Grounded Generator (generates content for matched personas)
- Competitor Store (gets competitor videos)
- Growth Monitor (tracks audience changes)

## Next Steps

1. Create UI dashboard for persona management
2. Integrate with RSS processor
3. Add persona-based content recommendations
4. Monitor and adjust serving goals
5. Create new personas based on growth signals




