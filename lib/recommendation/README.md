# Topic Recommendation Engine

DNA-based pipeline for generating topic recommendations from RSS items.

## Architecture

5-stage pipeline:
1. **CLASSIFY** - Match to DNA topic, extract entities
2. **FILTER** - Apply DNA gates (reject bad fits)
3. **ENRICH** - Make DNA-based decisions (hook, format, triggers)
4. **GENERATE** - Constrained LLM call
5. **OUTPUT** - Structured recommendation with confidence

## Usage

### Basic Usage

```javascript
import { recommendBatch } from '@/lib/recommendation/pipeline.js';
import { loadShowDna } from '@/lib/recommendation/dnaLoader.js';

const showDna = await loadShowDna(showId);
const recommendations = await recommendBatch(rssItems, showDna, llmClient);

console.log(`Recommended: ${recommendations.recommended.length}`);
console.log(`Rejected: ${recommendations.stats.rejected}`);
```

### API Endpoint

```bash
POST /api/recommendations
{
  "rssItems": [...],
  "showId": "uuid"
}
```

### Test Endpoint

```bash
GET /api/recommendations?show_id=uuid
```

## Integration with RSS Processor

Replace generic angle generation in `app/api/rss-processor/route.js`:

```javascript
import { recommendBatch } from '@/lib/recommendation/pipeline.js';
import { loadShowDna } from '@/lib/recommendation/dnaLoader.js';

// In processRssFeedsForShow:
const showDna = await loadShowDna(showId);
const recommendations = await recommendBatch(items, showDna, anthropicClient);

// Only process high/medium priority recommendations
const highQualityItems = recommendations.recommended
  .filter(r => r.priority === 'HIGH' || r.priority === 'MEDIUM')
  .map(r => ({
    ...r.original,
    recommended_title: r.summary.title,
    recommended_hook: r.output.hook_script_ar,
    confidence: r.summary.confidence
  }));
```

## Files

- `topicKeywords.js` - Topic classification keywords
- `classifier.js` - Classification logic
- `filter.js` - DNA-based filtering
- `enricher.js` - DNA-based enrichment
- `generator.js` - LLM prompt building
- `pipeline.js` - Main orchestrator
- `dnaLoader.js` - DNA data loader

