# ChannelBrain - Universal Topic Intelligence System
## Complete Project Documentation

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [AI/LLM Usage](#aillm-usage)
5. [Core Systems](#core-systems)
6. [Key Files & Architecture](#key-files--architecture)
7. [API Endpoints](#api-endpoints)
8. [Data Flow](#data-flow)
9. [Environment Variables](#environment-variables)

---

## 🎯 PROJECT OVERVIEW

**ChannelBrain** is an intelligent content recommendation and pitch generation system for YouTube content creators. It analyzes RSS feeds, competitor content, audience behavior, and channel performance to recommend high-quality content ideas with AI-generated pitches.

### Key Features:
- **Multi-Signal Scoring**: Scores content ideas based on competitor breakouts, DNA matches, recency, and audience interest
- **AI-Powered Entity Extraction**: Uses OpenAI GPT-4o-mini to extract entities (people, countries, organizations, topics) from content
- **Bilingual Keyword Matching**: Matches English and Arabic content using translation dictionaries
- **Pattern Learning**: Learns behavior patterns from successful videos and user feedback
- **DNA Matching**: Matches content to channel's DNA topics
- **Smart Pitch Generation**: Uses Claude Sonnet 4 to generate high-quality Arabic pitches
- **Studio UI**: Real-time dashboard showing prioritized content ideas with rich evidence

### Target Audience:
- Arabic YouTube content creators (specifically "المخبر الاقتصادي+" channel)
- Content creators who want data-driven content recommendations
- Channels covering economics, geopolitics, and international news

---

## 🛠 TECHNOLOGY STACK

### Frontend:
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Lucide React** (Icons)

### Backend:
- **Next.js API Routes** (Server-side)
- **Supabase** (PostgreSQL database + Auth)
- **Node.js**

### AI/LLM Services:
- **Anthropic Claude** (`claude-sonnet-4-20250514`, `claude-haiku-4-20250514`)
- **OpenAI** (`gpt-4o-mini`, `text-embedding-3-small`)
- **Groq** (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`)

### Key Libraries:
- `@supabase/supabase-js` - Database client
- `@anthropic-ai/sdk` - Claude API
- `openai` - OpenAI API
- `groq-sdk` - Groq API
- `rss-parser` - RSS feed parsing

---

## 🗄 DATABASE SCHEMA

### Core Tables

#### 1. `shows`
**Purpose**: Stores channel/show metadata

**Columns**:
- `id` (uuid) - Primary key
- `name` (text) - Show name
- `channel_id` (text) - YouTube channel ID (unique)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Relationships**: Referenced by all other tables via `show_id`

---

#### 2. `signals`
**Purpose**: Stores RSS/news items/content ideas

**Key Columns**:
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to `shows`
- `title` (text) - Signal title (original language)
- `description` (text) - Signal description
- `source` (text) - Source name (e.g., "r/worldnews", "الجزيرة نت")
- `source_url` (text) - RSS feed URL
- `url` (text) - Article URL
- `published_at` (timestamptz) - Publication date
- `created_at` (timestamptz) - When signal was created
- `score` (integer) - Calculated score (0-100) - **NOTE: Reddit signals default to 100 (fake score)**
- `topic_id` (uuid/text) - Matched topic ID
- `status` (text) - 'new', 'reviewed', 'approved', 'rejected'
- `is_visible` (boolean) - UI visibility flag
- `raw_data` (jsonb) - Stores evidence, recommendations, pitch data

**Important Notes**:
- Reddit signals have `score=100` by default (fake score)
- Real scores are calculated using `calculateIdeaScore()` function
- `raw_data` contains rich evidence from scoring system

---

#### 3. `channel_videos`
**Purpose**: Stores videos published by the channel

**Key Columns**:
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to `shows`
- `video_id` (text) - YouTube video ID
- `title` (text) - Video title (original language)
- `description` (text) - Video description
- `views` (bigint) - View count
- `publish_date` (timestamptz) - Publication date
- `format` (text) - 'Long' or 'Short'
- `topic_id` (uuid/text) - Associated topic
- `hook_text` (text) - Opening hook text
- `youtube_url` (text) - YouTube URL

**Note**: There's also a legacy `videos` table used as fallback

---

#### 4. `competitor_videos`
**Purpose**: Stores competitor video data for analysis

**Key Columns**:
- `id` (uuid) - Primary key
- `competitor_id` (uuid) - Foreign key to `competitors`
- `title` (text) - Video title
- `description` (text) - Video description
- `youtube_video_id` (text) - YouTube video ID
- `views` (bigint) - View count
- `published_at` (timestamptz) - Publication date
- `performance_ratio` (float) - Views vs competitor average
- `is_success` (boolean) - Whether video exceeded average
- `type` (text) - From joined `competitors` table: 'direct', 'indirect', 'trendsetter'

**Relationships**: 
- Joins with `competitors` table to get `name`, `type`, `show_id`

---

#### 5. `competitors`
**Purpose**: Stores competitor channel metadata

**Key Columns**:
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to `shows`
- `name` (text) - Channel name
- `type` (text) - 'direct', 'indirect', 'trendsetter', 'news'
- `channel_id` (text) - YouTube channel ID

---

#### 6. `show_dna`
**Purpose**: Stores DNA/profile data for each show

**Key Columns**:
- `show_id` (uuid) - Primary key (unique per show)
- `topics` (jsonb/array) - Array of DNA topic IDs or objects

**Usage**: Used for DNA matching in scoring system

---

#### 7. `topic_definitions`
**Purpose**: Stores topic definitions/keywords for show DNA

**Key Columns**:
- `show_id` (uuid) - Foreign key to `shows`
- `topic_id` (uuid/text) - Topic identifier
- `topic_name_en` (text) - English topic name
- `topic_name_ar` (text) - Arabic topic name
- `keywords_en` (text/array) - English keywords
- `keywords_ar` (text/array) - Arabic keywords
- `is_active` (boolean) - Whether topic is active

---

#### 8. `show_learning_weights`
**Purpose**: Stores learned weights from user feedback

**Key Columns**:
- `show_id` (uuid) - Primary key (unique per show)
- `topic_weights` (jsonb) - Learned topic weights
  ```json
  {
    "country_china": { "liked": 5, "rejected": 1, "weight": 1.4 },
    "topic_tariffs": { "liked": 3, "rejected": 0, "weight": 1.3 }
  }
  ```
- `category_weights` (jsonb) - Learned category weights
- `pattern_weights` (jsonb) - Learned behavior pattern weights
- `source_weights` (jsonb) - Learned source weights
- `updated_at` (timestamptz)

---

#### 9. `show_behavior_patterns`
**Purpose**: Stores learned behavior patterns per show

**Key Columns**:
- `show_id` (uuid) - Primary key (unique per show)
- `patterns` (jsonb) - Learned behavior patterns
  ```json
  {
    "resource_control": {
      "id": "resource_control",
      "name": "Resource Control / Geopolitics",
      "source": "videos",
      "videoCount": 5,
      "avgViews": 824000,
      "multiplier": 1.03,
      "detector": function
    }
  }
  ```
- `learned_at` (timestamptz)
- `video_count` (integer)
- `comment_count` (integer)
- `competitor_video_count` (integer)

---

#### 10. `recommendation_feedback`
**Purpose**: Stores user feedback on recommendations

**Key Columns**:
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to `shows`
- `signal_id` (uuid) - Associated signal
- `action` (text) - 'liked', 'rejected', 'ignored', 'generate_pitch', 'saved', 'produced'
- `evidence_summary` (jsonb) - Summary of evidence
- `created_at` (timestamptz)

**Usage**: Used to calculate learning weights

---

#### 11. `audience_comments`
**Purpose**: Stores audience comments/questions

**Key Columns**:
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to `shows`
- `text` (text) - Comment text
- `question` (text) - Extracted question
- `topic` (text/uuid) - Associated topic
- `likes` (integer) - Like count
- `is_actionable` (boolean) - Whether comment is actionable

---

#### 12. `search_terms`
**Purpose**: Stores search terms that audience uses on YouTube

**Key Columns**:
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to `shows`
- `term` (text) - Search query text
- `views` (bigint) - Total views
- `watch_time_hours` (numeric) - Total watch time
- `avg_view_duration` (text) - Average view duration
- `topic` (text) - Category
- `intent` (text) - Search intent
- `personas` (jsonb) - Array of persona IDs
- `is_branded` (boolean) - Whether it's a branded search
- `is_opportunity` (boolean) - Whether this is an opportunity

---

#### 13. `topic_fingerprints`
**Purpose**: Caches topic fingerprints for performance

**Key Columns**:
- `id` (uuid) - Primary key
- `fingerprint_hash` (text, unique) - Hash of content
- `fingerprint_data` (jsonb) - Cached fingerprint data
  ```json
  {
    "title": "...",
    "entities": {
      "people": [],
      "countries": [],
      "organizations": [],
      "topics": []
    },
    "topicCategory": "us_china_trade",
    "language": "en",
    "extractionMethod": "ai|regex|cached"
  }
  ```
- `created_at` (timestamptz)

---

#### 14. `pitches`
**Purpose**: Caches generated pitches to save tokens

**Key Columns**:
- `id` (uuid) - Primary key
- `signal_id` (uuid) - Foreign key to `signals` (unique)
- `show_id` (uuid) - Foreign key to `shows`
- `pitch_type` (text) - 'news', 'long', 'short'
- `content` (text) - Pitch content/text
- `tokens_used` (integer) - Tokens used for generation
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

#### 15. `signal_sources`
**Purpose**: Stores RSS feeds/sources to monitor

**Key Columns**:
- `id` (bigserial) - Primary key
- `show_id` (bigint) - Foreign key to `shows`
- `name` (text) - Source name
- `url` (text) - RSS feed URL
- `enabled` (boolean) - Whether feed is enabled
- `item_limit` (integer) - Max items to process per feed
- `dna_topics` (jsonb) - Array of topic IDs
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

#### 16. `user_shows`
**Purpose**: Maps users to shows they have access to

**Key Columns**:
- `user_id` (uuid) - Foreign key to auth.users
- `show_id` (uuid) - Foreign key to `shows`

---

### Database Relationships

```
shows (1) ────< (many) channel_videos
shows (1) ────< (many) signals
shows (1) ────< (1) show_dna
shows (1) ────< (many) topic_definitions
shows (1) ────< (1) show_learning_weights
shows (1) ────< (1) show_behavior_patterns
shows (1) ────< (many) competitor_videos (via competitors)
shows (1) ────< (many) audience_comments
shows (1) ────< (many) search_terms
shows (1) ────< (many) recommendation_feedback
shows (1) ────< (many) signal_sources

competitors (1) ────< (many) competitor_videos

signals (1) ────< (1) pitches (unique)
```

---

## 🤖 AI/LLM USAGE

### 1. **Claude (Anthropic)** - Primary LLM for Pitch Generation

**Models Used**:
- `claude-sonnet-4-20250514` - Main model for pitch generation
- `claude-haiku-4-20250514` - Faster, cheaper alternative

**Usage**:
- **Pitch Generation**: Generates Arabic titles and hooks for content ideas
- **Location**: `lib/ai/claudePitcher.js`
- **API Endpoint**: `/app/api/signals/[id]/generate-pitch/route.js`

**Key Features**:
- Culturally-aware Arabic content generation
- DNA-informed prompts (includes channel DNA context)
- Banned phrase detection
- Quality validation

**Example Usage**:
```javascript
import { generatePitch } from '@/lib/ai/claudePitcher.js';

const pitchResult = await generatePitch(
  signal.title,
  evidence,
  { format: 'long' } // 'long' or 'short'
);
```

---

### 2. **OpenAI** - Entity Extraction & Embeddings

**Models Used**:
- `gpt-4o-mini` - Entity extraction (cheapest, works well)
- `text-embedding-3-small` - Embeddings for similarity matching

**Usage**:
- **Entity Extraction**: Extracts people, countries, organizations, topics from content
- **Location**: `lib/topicIntelligence.js` → `extractEntitiesWithAI()`
- **Embeddings**: Generates embeddings for topic similarity matching
- **When Used**: Only when regex extraction finds < 2 meaningful entities (cost optimization)

**Key Features**:
- Bilingual entity extraction (English + Arabic)
- Caching to avoid redundant API calls
- Fallback to regex if AI unavailable

**Example Usage**:
```javascript
import { generateTopicFingerprint } from '@/lib/topicIntelligence.js';

const fingerprint = await generateTopicFingerprint({
  title: signal.title,
  description: signal.description,
  id: signal.id,
  type: 'signal'
}, {
  skipEmbedding: true, // Skip embedding for performance
  skipCache: false // Use cache
});
```

**Returns**:
```javascript
{
  title: "...",
  entities: {
    people: ["Trump", "Putin"],
    countries: ["USA", "China"],
    organizations: ["NATO", "OPEC"],
    topics: ["tariffs", "oil"]
  },
  topicCategory: "us_china_trade",
  language: "en",
  extractionMethod: "ai|regex|cached"
}
```

---

### 3. **Groq** - Fast Filtering & Data Extraction

**Models Used**:
- `llama-3.1-8b-instant` - Fast filtering ($0.05/1M tokens)
- `llama-3.3-70b-versatile` - Smarter analysis ($0.59/1M tokens)

**Usage**:
- **Data Extraction**: Extracts structured data from news articles
- **Location**: `lib/extraction/dataExtractor.js`
- **Fact Extraction**: Extracts verifiable facts from articles
- **Location**: `lib/generator/factExtractor.js`

**Key Features**:
- Very fast response times
- Low cost
- Used for preprocessing before Claude pitch generation

---

### 4. **Topic Classification (Claude)**

**Usage**:
- **Video Classification**: Classifies videos into topics
- **Location**: `lib/ai/topic-classifier.js`
- **Function**: `classifyVideo()`, `batchClassifyVideos()`

**Example**:
```javascript
import { classifyVideo } from '@/lib/ai/topic-classifier.js';

const classification = await classifyVideo(video, topics);
// Returns: { topic_id, confidence, entities, key_numbers, content_archetype }
```

---

## 🧠 CORE SYSTEMS

### 1. **Multi-Signal Scoring System**

**Location**: `lib/scoring/multiSignalScoring.js`

**Purpose**: Calculates real quality scores for signals (replaces fake DB scores)

**Key Function**: `calculateIdeaScore(signal, context, excludedNames)`

**Scoring Signals**:
- **Competitor Breakout** (up to 30 points): Direct competitor got 2x+ average views
- **Multiple Competitors** (up to 20 points): 2+ competitors covering topic
- **DNA Match** (20 points): Topic matches channel's DNA
- **Recency** (15 points): Signal is < 48 hours old
- **Freshness** (15 points): User hasn't covered this recently
- **Saturation Penalty** (-30 points): User covered this < 3 days ago

**Returns**:
```javascript
{
  score: 0-100, // Real calculated score
  signals: [...], // Array of scoring signals with evidence
  strategicLabel: { text, icon, color }, // "TREND FORMING", etc.
  competitorBreakdown: {
    direct: count,
    indirect: count,
    trendsetter: count,
    total: count,
    hasDirectBreakout: boolean,
    hasTrendsetterSignal: boolean
  }
}
```

**Important**: Reddit signals have `score=100` in database (fake). This function calculates the real score.

---

### 2. **Bilingual Keyword Matching System**

**Location**: `lib/scoring/multiSignalScoring.js`, `lib/scoring/keywordWeights.js`

**Purpose**: Matches English and Arabic content using translation dictionaries

**Key Functions**:
- `extractKeywords(text)` - Extracts keywords from text
- `expandKeywordsWithTranslations(keywords)` - Expands with translations
- `normalizeArabicText(text)` - Normalizes Arabic spelling variations
- `calculateMatchScore(keywords, [])` - Validates if match is meaningful
- `hasValidKeywordMatch(keywords)` - Checks if match passes quality threshold

**Translation Dictionary**: `KEYWORD_TRANSLATIONS` in `multiSignalScoring.js`
```javascript
{
  "oil": ["نفط", "بترول", "petroleum", "crude"],
  "sanctions": ["عقوبات", "حظر"],
  "china": ["الصين", "صين", "chinese", "beijing"],
  // ... many more
}
```

**Usage**: Enables English Reddit signals to match Arabic competitor videos

---

### 3. **Topic Intelligence System**

**Location**: `lib/topicIntelligence.js`

**Purpose**: Generates topic fingerprints with AI entity extraction

**Key Function**: `generateTopicFingerprint(content, options)`

**Process**:
1. Try regex extraction first (free)
2. If < 2 meaningful entities found, use OpenAI GPT-4o-mini
3. Classify entities (people, countries, organizations, topics)
4. Determine topic category (e.g., "us_china_trade", "energy")
5. Generate embedding (optional, for similarity matching)
6. Cache result in `topic_fingerprints` table

**Returns**:
```javascript
{
  title: "...",
  entities: {
    people: [],
    countries: [],
    organizations: [],
    topics: []
  },
  topicCategory: "us_china_trade",
  language: "en|ar",
  extractionMethod: "ai|regex|cached",
  fingerprint: "category|person1|person2|topic1|topic2|topic3"
}
```

---

### 4. **Behavior Pattern Learning System**

**Location**: `lib/behaviorPatterns.js`

**Purpose**: Learns what patterns engage each show's audience

**Key Functions**:
- `learnBehaviorPatterns(showId)` - Analyzes videos, comments, competitors
- `getShowPatterns(showId)` - Gets cached patterns
- `scoreSignalByPatterns(signal, patterns, learnedWeights)` - Scores signal against patterns

**Pattern Types**:
1. **Video Patterns**: Detected from top-performing videos
   - Examples: "Resource Control / Geopolitics", "Superpower Tension"
   - Shows: avg views, multiplier vs average
2. **Audience Interest Patterns**: Detected from comments
   - Examples: "Audience Interest: china", "Audience Interest: ai"
   - Shows: mention count, total likes
3. **Competitor Patterns**: Detected from competitor videos
   - Shows: trending status, video count

**Storage**: Cached in `show_behavior_patterns` table

---

### 5. **Signal Effectiveness Learning System**

**Location**: `lib/learning/signalEffectiveness.js`

**Purpose**: Analyzes user feedback to determine which signals work best

**Key Functions**:
- `getLearnedAdjustments(showId, days)` - Gets learned weights from feedback
- `applyLearnedAdjustments(signal, learned)` - Applies learned weights to scoring

**Tracks**:
- Topic weights: Which topics user likes/rejects
- Category weights: Which categories user prefers
- Pattern weights: Which patterns user engages with
- Source weights: Which sources user trusts

**Storage**: `show_learning_weights` table

**Example**:
```javascript
{
  pattern_weights: {
    "resource_control": { liked: 2, rejected: 0, weight: 1.4 }
  }
}
```

---

### 6. **DNA Matching System**

**Location**: `lib/scoring/multiSignalScoring.js` → `findDnaMatch()`

**Purpose**: Matches signals to channel's DNA topics

**Process**:
1. Check by `topic_id` match
2. Check AI-extracted topics against DNA topic keywords
3. Check AI-extracted entities (countries, organizations) against DNA keywords
4. Fallback to rule-based keyword matching

**Returns**: Array of matched topic IDs

---

### 7. **Competitor Breakout Detection**

**Location**: `lib/scoring/multiSignalScoring.js` → `findCompetitorBreakout()`

**Purpose**: Finds competitor videos that exceeded their average performance

**Process**:
1. Calculate competitor's average views
2. Find videos with 2x+ average views
3. Match signal keywords to video keywords (bilingual)
4. Validate match using `calculateMatchScore()` (filters generic words)
5. Return breakout video with evidence

**Returns**:
```javascript
{
  videoTitle: "...",
  videoUrl: "...",
  channelName: "...",
  multiplier: 2.5,
  views: 50000,
  averageViews: 20000,
  matchedKeywords: ["oil", "نفط"],
  type: "direct|indirect|trendsetter"
}
```

---

### 8. **Last Covered Detection**

**Location**: `lib/scoring/multiSignalScoring.js` → `findDaysSinceLastPost()`

**Purpose**: Finds when user last covered this topic

**Process**:
1. Extract keywords from signal
2. Match against user's video titles/descriptions (bilingual)
3. Find most recent matching video
4. Calculate days since publication

**Returns**:
```javascript
{
  daysSinceLastPost: 42,
  matchedVideo: "Video title",
  videoUrl: "https://youtube.com/...",
  matchedKeywords: ["oil", "نفط"],
  matchType: "strong|moderate|weak"
}
```

---

## 📁 KEY FILES & ARCHITECTURE

### API Routes

#### `/app/api/studio/signals/route.js`
**Purpose**: Main API for Studio UI - fetches and processes signals

**Process**:
1. Fetches signals (last 14 days, up to 100)
2. Fetches DNA topics
3. Fetches competitor videos (last 7 days)
4. Fetches user videos (for saturation check)
5. Ensures source diversity (round-robin selection)
6. For each signal:
   - Generates AI topic fingerprint (with timeout)
   - Calculates real score using `calculateIdeaScore()`
   - Matches competitors (using scoring evidence or fallback)
   - Matches DNA (using AI entities or fallback)
   - Scores against behavior patterns
7. Filters by real score >= 20
8. Groups into tiers: `postToday`, `thisWeek`, `evergreen`

**Returns**:
```javascript
{
  success: true,
  data: {
    postToday: [...], // score >= 90 && < 48h old (max 5)
    thisWeek: [...], // score >= 70 || < 7 days old (max 7)
    evergreen: [...] // everything else (max 5)
  },
  meta: {
    totalSignals: number,
    sources: {...},
    dnaTopics: [...],
    competitorVideosCount: number
  }
}
```

**Signal Object Structure**:
```javascript
{
  id: uuid,
  title: string, // Original language
  description: string,
  source: string,
  sourceUrl: string,
  score: number, // Real calculated score
  dbScore: number, // Original DB score (for reference)
  tier: "post_today|this_week|evergreen",
  hoursOld: number,
  competitors: [...], // Matched competitor videos
  dnaMatch: string, // English topic name
  dnaMatchId: string, // Topic ID
  scoringSignals: [...], // What contributed to score
  strategicLabel: { text, icon, color },
  competitorBreakout: {...}, // Breakout video details
  competitorBreakdown: {...}, // Counts by type
  lastCoveredVideo: { title, url, daysAgo },
  daysSinceLastPost: number,
  matchedKeywords: [...], // Rule-based + AI keywords
  aiEntities: { people, countries, organizations, topics },
  aiExtractionMethod: "ai|regex|cached",
  patternMatches: [...], // Matched behavior patterns
  patternBoost: number // Total boost from patterns
}
```

---

#### `/app/api/signals/route.js`
**Purpose**: Main signals API (used by Ideas page)

**Similar to Studio API but different response format**

---

#### `/app/api/rss-processor/route.js`
**Purpose**: Processes RSS feeds and saves signals to database

**Process**:
1. Fetches RSS feeds from `signal_sources` table
2. Parses RSS items
3. Scores each item using recommendation engine
4. Saves to `signals` table with score and evidence

---

#### `/app/api/signals/[id]/generate-pitch/route.js`
**Purpose**: On-demand pitch generation (only when user clicks button)

**Process**:
1. Fetches signal from database
2. Builds evidence from signal data
3. Calls `generatePitch()` from `claudePitcher.js`
4. Returns pitch (title, hook, angle, points)

**Uses**: Claude Sonnet 4

---

### Core Library Files

#### `/lib/scoring/multiSignalScoring.js`
**Purpose**: Multi-signal scoring system

**Key Exports**:
- `calculateIdeaScore()` - Main scoring function
- `extractKeywords()` - Keyword extraction
- `expandKeywordsWithTranslations()` - Bilingual expansion
- `normalizeArabicText()` - Arabic normalization
- `KEYWORD_TRANSLATIONS` - Translation dictionary
- `findCompetitorBreakout()` - Competitor breakout detection
- `findDaysSinceLastPost()` - Last covered detection
- `findDnaMatch()` - DNA matching

**Size**: ~2800 lines

---

#### `/lib/topicIntelligence.js`
**Purpose**: Topic fingerprint generation with AI

**Key Exports**:
- `generateTopicFingerprint()` - Main function
- `compareTopics()` - Topic similarity comparison
- `isSameStory()` - Same story detection
- `isRelevantCompetitorVideo()` - Competitor relevance check

**AI Usage**:
- Uses OpenAI GPT-4o-mini for entity extraction
- Uses OpenAI embeddings for similarity matching
- Caches results in `topic_fingerprints` table

---

#### `/lib/behaviorPatterns.js`
**Purpose**: Behavior pattern learning and matching

**Key Exports**:
- `learnBehaviorPatterns(showId)` - Learn patterns from data
- `getShowPatterns(showId)` - Get cached patterns
- `scoreSignalByPatterns(signal, patterns, learnedWeights)` - Score signal

**Pattern Sources**:
- Video patterns: From top-performing videos
- Comment patterns: From audience comments
- Competitor patterns: From competitor videos

---

#### `/lib/learning/signalEffectiveness.js`
**Purpose**: Learning from user feedback

**Key Exports**:
- `getLearnedAdjustments(showId, days)` - Get learned weights
- `applyLearnedAdjustments(signal, learned)` - Apply weights

**Tracks**: Topic, category, pattern, and source preferences

---

#### `/lib/scoring/keywordWeights.js`
**Purpose**: Keyword matching validation

**Key Exports**:
- `calculateMatchScore(keywords, [])` - Validates match quality
- `hasValidKeywordMatch(keywords)` - Checks if match passes threshold
- `filterValuableKeywords(keywords)` - Filters generic words

**Purpose**: Prevents false matches on generic words like "says", "about", "week"

---

#### `/lib/ai/claudePitcher.js`
**Purpose**: Claude pitch generation

**Key Exports**:
- `generatePitch(topic, evidence, options)` - Generate pitch

**Uses**: Claude Sonnet 4 with DNA-informed prompts

---

#### `/lib/ai/clients.js`
**Purpose**: AI client wrappers

**Exports**:
- `groqComplete()` - Groq API wrapper
- `claudeComplete()` - Claude API wrapper
- `GROQ_MODELS` - Model constants
- `CLAUDE_MODELS` - Model constants

---

#### `/lib/extraction/dataExtractor.js`
**Purpose**: LLM data extraction from news articles

**Uses**: Groq or Claude for structured data extraction

**Extracts**:
- Date information
- Entities (people, companies, countries, organizations)
- Numbers and statistics
- Action verbs
- Topic category
- Yes/no question potential

---

### Frontend Components

#### `/app/studio/page.jsx`
**Purpose**: Main Studio UI page

**Features**:
- Displays signals in tiers: Post Today, This Week, Evergreen
- Refresh button
- Real-time data fetching

---

#### `/components/studio/StudioCard.jsx`
**Purpose**: Individual pitch card component

**Displays**:
- Title (original language, RTL for Arabic)
- Score badge
- Tier badge
- Strategic label banner ("TREND FORMING")
- "WHY NOW" section (yellow background):
  - Trendsetter breakout
  - Competitors covering this
  - DNA matches (English)
  - Trending info
  - Source link
  - Last covered
  - Pattern matches (English)
- Action buttons: Like, Reject, Save, Generate Script
- Expandable Score Breakdown

---

#### `/components/studio/TierSection.jsx`
**Purpose**: Section component for each tier

---

## 🔄 DATA FLOW

### Signal Processing Flow

1. **RSS Processing** (`/app/api/rss-processor/route.js`)
   - Fetches RSS feeds
   - Parses items
   - Scores using recommendation engine
   - Saves to `signals` table

2. **Studio API** (`/app/api/studio/signals/route.js`)
   - Fetches signals from database
   - For each signal:
     - **AI Fingerprint**: Generates topic fingerprint (with 2s timeout)
     - **Real Score**: Calculates using `calculateIdeaScore()`
     - **Competitor Matching**: Uses scoring evidence or fallback
     - **DNA Matching**: Uses AI entities or fallback
     - **Pattern Matching**: Scores against behavior patterns
   - Filters by real score >= 20
   - Groups into tiers

3. **Frontend** (`/app/studio/page.jsx`)
   - Fetches from Studio API
   - Displays in tier sections
   - User interactions (Like, Reject, Save, Generate Script)

4. **Pitch Generation** (`/app/api/signals/[id]/generate-pitch/route.js`)
   - User clicks "Generate Script"
   - Calls Claude API
   - Returns pitch (title, hook, angle, points)

---

### Scoring Flow

```
Signal → AI Fingerprint → calculateIdeaScore() → Real Score
                              ↓
                    Scoring Signals Array
                              ↓
        [competitor_breakout, competitor_volume, dna_match, 
         recency, freshness, saturated, ...]
                              ↓
                    Extract Evidence
                              ↓
        [competitors, dnaMatch, lastCoveredVideo, 
         strategicLabel, patternMatches]
```

---

## 🌐 API ENDPOINTS

### Studio API

#### `GET /api/studio/signals?showId={uuid}`
**Purpose**: Main API for Studio UI

**Query Parameters**:
- `showId` (required) - Show/channel UUID

**Response**:
```javascript
{
  success: true,
  data: {
    postToday: [...], // Max 5 signals
    thisWeek: [...],  // Max 7 signals
    evergreen: [...]  // Max 5 signals
  },
  meta: {
    totalSignals: number,
    diverseSignalsCount: number,
    sources: {...},
    finalSourceDistribution: {...},
    dnaTopics: [...],
    competitorVideosCount: number
  }
}
```

**Features**:
- Real score calculation (replaces fake DB scores)
- AI entity extraction (with 2s timeout)
- Pattern matching
- Source diversity
- Quality filtering (score >= 20)

---

### Signals API

#### `GET /api/signals?showId={uuid}`
**Purpose**: Main signals API (used by Ideas page)

**Similar to Studio API but different response format**

---

#### `POST /api/signals/[id]/generate-pitch`
**Purpose**: On-demand pitch generation

**Body**:
```javascript
{
  type: "long" | "short" // Video format
}
```

**Response**:
```javascript
{
  success: true,
  pitch: {
    title: "...",
    hook: "...",
    angle: "...",
    mainPoints: [...],
    cta: "..."
  }
}
```

**Uses**: Claude Sonnet 4

---

### RSS Processing

#### `POST /api/rss-processor/route`
**Purpose**: Processes RSS feeds and saves signals

**Body**:
```javascript
{
  showId: uuid,
  options: {...}
}
```

**Process**: Fetches RSS, scores items, saves to `signals` table

---

### Feedback API

#### `POST /api/feedback`
**Purpose**: Records user feedback (like, reject, save, etc.)

**Body**:
```javascript
{
  showId: uuid,
  signalId: uuid,
  action: "liked" | "rejected" | "saved" | "generate_pitch",
  evidenceSummary: {...}
}
```

**Updates**: `recommendation_feedback` table and `show_learning_weights`

---

### Other Key Endpoints

- `GET /api/shows` - Get all shows
- `GET /api/shows/current` - Get current user's show
- `GET /api/competitors/videos` - Get competitor videos
- `GET /api/dna/dashboard` - Get DNA dashboard data
- `POST /api/learning/reset` - Reset learning weights
- `GET /api/learning-stats` - Get learning statistics

---

## 🔑 ENVIRONMENT VARIABLES

### Required:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Services
ANTHROPIC_API_KEY=your-anthropic-key  # For Claude
OPENAI_API_KEY=your-openai-key        # For GPT-4o-mini & embeddings
GROQ_API_KEY=your-groq-key            # For Groq (optional)
```

### Optional:

```bash
NODE_ENV=development|production
```

---

## 📊 KEY METRICS & THRESHOLDS

### Scoring Thresholds:
- **Post Today**: score >= 90 AND < 48 hours old (max 5)
- **This Week**: score >= 70 OR < 7 days old (max 7)
- **Evergreen**: Everything else (max 5)
- **Quality Filter**: Real score >= 20 (filters out low-quality signals)

### Competitor Breakout:
- **Multiplier**: 2x+ average views = breakout
- **Types**: 'direct' (30 points), 'indirect' (15 points), 'trendsetter' (30 points)

### DNA Matching:
- **Points**: 20 points for DNA match
- **Methods**: topic_id match, AI topic match, AI entity match, keyword match

### Pattern Matching:
- **Max Boost**: 50 points total
- **Sources**: Videos (highest weight), Comments (medium), Competitors (lowest)

---

## 🎨 UI LANGUAGE POLICY

**All system labels in English**:
- Pattern names: English only
- DNA topic names: English only
- All UI labels: English
- Evidence text: English

**Original language preserved**:
- Video titles: Original language (Arabic/English)
- RSS article titles: Original language
- Competitor video titles: Original language

---

## 🔍 DEBUGGING & LOGGING

### Console Logs:
- `📊 Score: "..." [source] DB: X → Real: Y (N signals)`
- `🤖 AI extracted for "...": { topics, countries, organizations }`
- `✅ DNA match (AI topic): "..." → DNA topic "..."`
- `🎯 Pattern matches: N patterns (X boost)`
- `🔗 Found N competitor matches for "..."`

### Error Handling:
- AI fingerprint generation: 2s timeout, fallback to rule-based
- Score calculation: Falls back to DB score on error
- Pattern matching: Continues without patterns on error

---

## 📝 IMPORTANT NOTES

1. **Reddit Score Problem**: All Reddit signals have `score=100` in database (fake). Real scores are calculated using `calculateIdeaScore()`.

2. **AI Cost Optimization**: 
   - AI entity extraction only used when regex finds < 2 meaningful entities
   - Embeddings skipped for pattern matching (not needed)
   - Results cached in `topic_fingerprints` table

3. **Bilingual Matching**: System uses translation dictionaries to match English and Arabic content.

4. **Pattern Learning**: Patterns are learned from videos, comments, and competitors, then cached in database.

5. **Learning System**: User feedback (likes, rejects) is analyzed to learn preferences, stored in `show_learning_weights`.

6. **Source Diversity**: Studio API ensures diverse sources (round-robin selection, max 2 per source initially).

---

## 🚀 QUICK START

1. **Set Environment Variables** (see above)
2. **Run Database Migrations** (in Supabase SQL Editor)
3. **Start Dev Server**: `npm run dev`
4. **Access Studio**: `/studio` page
5. **Process RSS Feeds**: Call `/api/rss-processor` endpoint

---

## 📚 ADDITIONAL RESOURCES

- **Database Schema**: See `DATABASE_SCHEMA_REPORT.md`
- **360 Intelligence**: See `360_INTELLIGENCE_V3_README.md`
- **DNA System**: See `DNA_INFORMED_LLM.md`
- **Behavior Patterns**: See `BEHAVIOR_PATTERNS_INTEGRATION.md`
- **Audience Integration**: See `AUDIENCE_INTEGRATION.md`

---

**Last Updated**: Based on current codebase state
**Version**: Studio API with AI integration, pattern matching, and learning systems

---

## 🔧 CONFIGURATION & CONSTANTS

### AI Model Configuration

**Claude Models** (`lib/ai/clients.js`):
- `claude-sonnet-4-20250514` - Main model for pitch generation
- `claude-haiku-4-20250514` - Faster alternative

**OpenAI Models** (`lib/topicIntelligence.js`):
- `gpt-4o-mini` - Entity extraction (cheapest)
- `text-embedding-3-small` - Embeddings

**Groq Models** (`lib/ai/clients.js`):
- `llama-3.1-8b-instant` - Fast filtering ($0.05/1M tokens)
- `llama-3.3-70b-versatile` - Smarter analysis ($0.59/1M tokens)

### Topic Intelligence Configuration

**Location**: `lib/topicIntelligence.js`

```javascript
const CONFIG = {
  MIN_ENTITIES_BEFORE_AI: 2,        // Use AI if regex finds < 2 entities
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EXTRACTION_MODEL: 'gpt-4o-mini',
  CACHE_HOURS: 24,
  SAME_STORY_THRESHOLD: 0.80,
  RELATED_THRESHOLD: 0.65,
  CROSS_LANG_SAME_STORY_THRESHOLD: 0.55
};
```

### Scoring Configuration

**Location**: `lib/scoring/multiSignalScoring.js`

**Signal Weights**:
- Competitor Breakout (direct): 30 points
- Competitor Breakout (indirect): 15 points
- Competitor Breakout (trendsetter): 30 points
- Multiple Competitors (2+): 20 points
- DNA Match: 20 points
- Recency (< 48h): 15 points
- Freshness (not covered recently): 15 points
- Saturation Penalty (covered < 3 days ago): -30 points

**Tier Thresholds**:
- Post Today: score >= 90 AND < 48 hours old
- This Week: score >= 70 OR < 7 days old
- Evergreen: Everything else

**Quality Filter**: Real score >= 20

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: All scores showing 57 or 50
**Cause**: AI fingerprint generation blocking or `calculateIdeaScore` returning default values
**Solution**: Check console logs for score calculation errors, verify AI API keys

### Issue: "normalizedCompetitorVideos is not defined"
**Cause**: Variable scope issue in Promise.all callback
**Solution**: Variable is defined at line 111, ensure it's accessible in callback

### Issue: "signalTopicId is not defined" in findDnaMatch
**Cause**: Variable shadowing in function
**Solution**: Fixed - parameter renamed to `signalTopicId`, local variable to `dnaTopicId`

### Issue: Same video showing for all "Last covered"
**Cause**: Incorrect extraction from scoring signals
**Solution**: Fixed - now extracts from `evidence` field of freshness/saturated signals

### Issue: Duplicate sections in UI
**Cause**: Same evidence shown in "WHY NOW" and "Score Breakdown"
**Solution**: Score Breakdown filters out signals already shown in WHY NOW

### Issue: Pattern names in Arabic
**Cause**: Frontend using `patternNameAr` instead of `patternName`
**Solution**: Fixed - now uses English `patternName` only

### Issue: DNA matches in Arabic
**Cause**: Scoring system preferring `topic_name_ar` over `topic_name_en`
**Solution**: Fixed - now prefers English names for all system labels

---

## 📖 ADDITIONAL DOCUMENTATION FILES

- `DATABASE_SCHEMA_REPORT.md` - Detailed database schema
- `360_INTELLIGENCE_V3_README.md` - Intelligence system v3
- `DNA_INFORMED_LLM.md` - DNA-informed LLM system
- `BEHAVIOR_PATTERNS_INTEGRATION.md` - Pattern learning system
- `AUDIENCE_INTEGRATION.md` - Audience profile integration
- `PRODUCER_MODE_INTEGRATION.md` - Producer mode features

---

## 🎓 LEARNING RESOURCES

### Key Concepts to Understand:

1. **Multi-Signal Scoring**: How signals are scored using multiple factors
2. **Bilingual Matching**: How English and Arabic content are matched
3. **AI Entity Extraction**: When and how AI is used for entity extraction
4. **Pattern Learning**: How behavior patterns are learned and applied
5. **DNA Matching**: How content is matched to channel DNA
6. **Competitor Breakout**: How competitor performance is analyzed
7. **Learning System**: How user feedback improves recommendations

### Code Flow Examples:

**Signal Processing**:
```
RSS Item → Signal (DB) → AI Fingerprint → calculateIdeaScore() → 
Real Score → Pattern Matching → Tier Assignment → Studio UI
```

**Pitch Generation**:
```
Signal → Evidence Collection → Claude API → Pitch (title, hook, angle)
```

**Pattern Learning**:
```
Videos/Comments/Competitors → Pattern Detection → Pattern Storage → 
Pattern Matching → Score Boost
```

---

**Documentation Complete** ✅
