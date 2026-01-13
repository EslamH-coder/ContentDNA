# Grounded Generation + Competitor Intelligence System

## Overview

This system prevents hallucination, exaggeration, and uses all available intelligence to generate high-quality content.

## Architecture

```
News Article
    ↓
🧬 DNA Filter (reject irrelevant)
    ↓
📋 Fact Extraction (what's ACTUALLY in the article)
    ↓
✍️ Grounded Generation (use ONLY extracted facts)
    ↓
🔍 Validation (check for banned phrases, invented numbers, exaggeration)
    ↓
🔧 Auto-Fix (if issues found)
    ↓
🎯 Competitor Enhancement (improve using competitor insights)
    ↓
✅ Final Output (clean, grounded, enhanced)
```

## Files Created

### 1. `lib/intelligence/intelligenceLoader.js`
- Loads Channel DNA (banned phrases, winning patterns, top topics)
- Loads Competitor Intelligence (recent videos, hot topics)
- Loads Saved Videos (for reference/inspiration)
- Loads Insights (actionable learnings)

### 2. `lib/generator/factExtractor.js`
- Extracts ONLY verifiable facts from articles
- No inference, no invention
- Validates claims against extracted facts

### 3. `lib/generator/groundedGenerator.js`
- Generates content based ONLY on extracted facts
- Strict validation against banned phrases
- Auto-fixes issues automatically

### 4. `lib/generator/competitorEnhancer.js`
- Uses competitor data to improve content
- Finds content gaps
- Enhances with competitor insights

### 5. `lib/pipeline/fullGroundedPipeline.js`
- Full pipeline combining all components
- Processes items through DNA filter → Grounded Generation → Competitor Enhancement

## Usage

### Basic Usage

```javascript
import { runGroundedPipeline } from '@/lib/pipeline/fullGroundedPipeline.js';

const newsItems = [
  { title: 'China pledges to broaden fiscal spending', description: '...', ... }
];

const result = await runGroundedPipeline(newsItems);

// Result contains:
// - results: Array of generated content with validation
// - stats: Processing statistics
```

### Integration with RSS Processor

The grounded pipeline can be integrated into the RSS processor to replace the current generation system.

## Features

### ✅ Prevents Hallucination
- No invented numbers
- No invented quotes
- Only uses facts from source

### ✅ Prevents Exaggeration
- Checks source tone
- Validates superlatives
- Matches source language

### ✅ Enforces Banned Phrases
- Strict validation
- Auto-fix removes banned phrases
- Multiple validation layers

### ✅ Uses Competitor Intelligence
- Loads competitor recent videos
- Identifies hot topics
- Enhances content with insights

### ✅ Uses Saved Videos
- References successful formats
- Learns from saved videos
- Applies proven patterns

## Example Output

### ❌ Before (Hallucination):
```
Title: "الصين ترفع إنفاقها 15%: هل تعرف أن هذه أكبر خطة في التاريخ؟"
                    ↑                ↑                    ↑
              invented number    banned phrase      exaggeration
```

### ✅ After (Grounded):
```
Title: "هل تستطيع الصين تحدي أمريكا اقتصادياً بخطتها الجديدة؟"
                                                    ↑
                                              matches source
```

## Validation

The system validates:
1. **Banned Phrases**: Checks against comprehensive banned phrases list
2. **Invented Numbers**: Verifies all numbers exist in source
3. **Exaggeration**: Checks if superlatives are in source
4. **Quality Score**: Assigns score based on validation results

## Auto-Fix

If validation fails, the system automatically:
1. Removes banned phrases
2. Removes invented numbers
3. Reduces exaggeration
4. Re-validates output

## Competitor Enhancement

The system enhances content by:
1. Analyzing what competitors are covering
2. Identifying content gaps
3. Applying successful patterns
4. Learning from saved videos

## Configuration

### Banned Phrases
Located in: `lib/voice/bannedPhrases.js`

### DNA Configuration
Loaded from: `data/living_dna.json`

### Competitor Data
Loaded from: `data/competitors.json`

## Next Steps

1. Integrate into RSS processor
2. Test with real news articles
3. Monitor validation scores
4. Refine banned phrases list
5. Add more competitor intelligence sources




