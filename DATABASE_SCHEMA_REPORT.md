# Database Schema Report for Smart Pitch System

This report documents the database schema based on codebase analysis. Generated from Supabase queries found in the codebase.

---

## 1. CHANNEL VIDEOS (Your Channel's Videos)

### Table: `channel_videos`

**Purpose**: Stores videos published by shows/channels

**Key Columns** (from codebase usage):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to shows
- `video_id` (text) - YouTube video ID
- `title` (text) - Video title
- `description` (text, optional) - Video description
- `views` (integer/bigint) - View count
- `publish_date` (timestamptz) - When video was published
- `youtube_url` (text, optional) - YouTube video URL
- `format` (text) - Video format (e.g., 'Long', 'Short')
- `topic_id` (uuid/text) - Associated topic ID
- `hook_text` (text, optional) - Hook/opening text
- `created_at` (timestamptz) - Record creation time

**Note**: There is also a `videos` table (legacy/fallback), but `channel_videos` is the primary table used by the system.

**Sample Query** (from `audienceDemand.js`):
```javascript
const { data: videos } = await supabase
  .from('channel_videos')
  .select('topic_id, views, title, format')
  .eq('show_id', showId)
  .eq('format', 'Long')
  .gt('views', 0)
  .order('views', { ascending: false });
```

**Sample Query** (from `behaviorPatterns.js`):
```javascript
const { data: videos } = await supabase
  .from('channel_videos')
  .select('title, views, topic_id, format, hook_text, publish_date')
  .eq('show_id', showId)
  .eq('format', 'Long')
  .gt('views', 0)
  .order('views', { ascending: false });
```

**Useful Queries**:
```sql
-- Get top 50 videos for a show
SELECT title, views, publish_date, format, topic_id, hook_text
FROM channel_videos
WHERE show_id = $1
  AND format = 'Long'
  AND views > 0
ORDER BY views DESC
LIMIT 50;

-- Get videos by topic
SELECT title, views, publish_date
FROM channel_videos
WHERE show_id = $1
  AND topic_id = $2
ORDER BY views DESC;
```

**Notes**:
- Primary table for your channel's videos
- Only 'Long' format videos are typically queried for analysis
- Videos with 0 views are filtered out
- Used to calculate topic performance, learn patterns, extract keywords
- **Note**: There is also a `videos` table (legacy/fallback) - code tries `channel_videos` first, falls back to `videos` if needed

---

## 2. SHOWS (Channels)

### Table: `shows`

**Purpose**: Stores show/channel metadata

**Key Columns** (from `supabase_schema.sql`):
- `id` (bigserial/uuid) - Primary key (shown as `show_id` in other tables)
- `name` (text) - Show name
- `channel_id` (text) - YouTube channel ID (unique)
- `created_at` (timestamptz) - When show was created
- `updated_at` (timestamptz) - When show was updated

**Sample Query**:
```sql
-- Get all shows
SELECT id, name, channel_id
FROM shows;

-- Get show by ID
SELECT * FROM shows WHERE id = $1;
```

**How Shows are Identified**:
- Shows are referenced by `show_id` in all related tables
- `channel_id` is unique (YouTube channel identifier)
- Primary table that other tables reference

**Related Tables**:
- `show_dna` - DNA/profile per show
- `show_learning_weights` - Learning data per show
- `topic_definitions` - Topic definitions per show
- `user_shows` - User-show access mapping

---

## 3. SHOW DNA (Channel Profile)

### Table: `show_dna`

**Purpose**: Stores DNA/profile data for each show

**Key Columns** (from `intelligenceEngine.js`):
- `show_id` (uuid) - Foreign key
- (Other columns inferred from usage - structure not fully visible)

**Sample Query**:
```javascript
const { data: dna, error: dnaError } = await this.supabase
  .from('show_dna')
  .select('*')
  .eq('show_id', this.showId)
  .single();
```

**Related Data**:
- DNA topics are stored in `topic_definitions` table
- Learning weights stored in `show_learning_weights`

---

## 4. TOPIC DEFINITIONS (Show DNA Topics)

### Table: `topic_definitions`

**Purpose**: Stores topic definitions/keywords for each show's DNA

**Key Columns** (from `audienceDemand.js`):
- `show_id` (uuid) - Foreign key
- `topic_id` (uuid/text) - Topic identifier
- `topic_name_en` (text) - English topic name
- `topic_name_ar` (text) - Arabic topic name
- `keywords_en` (text/array) - English keywords
- `keywords_ar` (text/array) - Arabic keywords
- `is_active` (boolean) - Whether topic is active

**Sample Query**:
```javascript
const { data: dnaTopics } = await supabase
  .from('topic_definitions')
  .select('topic_id, topic_name_en, topic_name_ar, keywords_en, keywords_ar')
  .eq('show_id', showId)
  .eq('is_active', true);
```

**Useful Queries**:
```sql
-- Get all active topics for a show
SELECT topic_id, topic_name_en, topic_name_ar, keywords_en, keywords_ar
FROM topic_definitions
WHERE show_id = $1
  AND is_active = true;

-- Build topic keyword map
SELECT topic_id, 
       topic_name_en, 
       topic_name_ar,
       keywords_en,
       keywords_ar
FROM topic_definitions
WHERE show_id = $1
  AND is_active = true;
```

**Notes**:
- Keywords can be stored as comma-separated strings or arrays
- Used to build `topicKeywordMap` for matching

---

## 5. COMPETITOR VIDEOS

### Table: `competitor_videos`

**Purpose**: Stores competitor video data for analysis

**Key Columns** (from `audienceDemand.js`, `intelligenceEngine.js`):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Which show this competitor data belongs to
- `title` (text) - Video title
- `views` (integer) - View count
- `topic_id` (uuid/text) - Associated topic
- `channel_name` (text) - Competitor channel name
- `channel_id` (uuid, optional) - Competitor channel ID
- (Other fields inferred: `is_success`, `is_failure` for performance tracking)

**Sample Query**:
```javascript
const { data: competitorVideos } = await supabase
  .from('competitor_videos')
  .select('title, views, topic_id, channel_name')
  .eq('show_id', showId)
  .order('views', { ascending: false })
  .limit(100);
```

**Sample Query with Relations** (from `intelligenceEngine.js`):
```javascript
const { data: competitorVideos } = await this.supabase
  .from('competitor_videos')
  .select('*, competitors(name, channel_id)')
  .order('views', { ascending: false })
  .limit(200);
```

**Related Table**: `competitors`
- Stores competitor channel metadata
- Has `name` and `channel_id` fields
- Linked via foreign key relationship

**Useful Queries**:
```sql
-- Get competitor videos for a show
SELECT title, views, topic_id, channel_name
FROM competitor_videos
WHERE show_id = $1
ORDER BY views DESC
LIMIT 100;

-- Get competitor videos with channel info
SELECT cv.*, c.name, c.channel_id
FROM competitor_videos cv
LEFT JOIN competitors c ON cv.channel_id = c.channel_id
WHERE cv.show_id = $1
ORDER BY cv.views DESC;
```

---

## 6. COMPETITORS (Competitor Channels)

### Table: `competitors`

**Purpose**: Stores competitor channel metadata

**Key Columns** (inferred):
- `id` (uuid) - Primary key
- `channel_id` (text/uuid) - YouTube channel ID
- `name` (text) - Channel name
- (Other fields not visible in codebase)

**Relationships**:
- One-to-many with `competitor_videos`

---

## 7. AUDIENCE COMMENTS

### Table: `audience_comments`

**Purpose**: Stores audience comments/questions/engagement

**Key Columns** (from `audienceDemand.js`, `behaviorPatterns.js`):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key
- `text` (text) - Comment text
- `question` (text, optional) - Extracted question
- `topic` (text/uuid, optional) - Associated topic
- `likes` (integer) - Like count
- `is_actionable` (boolean) - Whether comment is actionable
- `created_at` (timestamp) - When comment was created

**Sample Query**:
```javascript
const { data: comments } = await supabase
  .from('audience_comments')
  .select('text, question, topic, is_actionable, likes')
  .eq('show_id', showId)
  .order('likes', { ascending: false })
  .limit(500);
```

**Useful Queries**:
```sql
-- Get top audience questions
SELECT text, question, topic, likes, is_actionable
FROM audience_comments
WHERE show_id = $1
  AND is_actionable = true
ORDER BY likes DESC
LIMIT 500;

-- Get comments by topic
SELECT text, question, likes
FROM audience_comments
WHERE show_id = $1
  AND topic = $2
ORDER BY likes DESC;
```

---

## 8. SHOW LEARNING WEIGHTS

### Table: `show_learning_weights`

**Purpose**: Stores learned weights/patterns from user feedback

**Key Columns** (from `signalEffectiveness.js`, `audienceDemand.js`):
- `show_id` (uuid) - Primary key (unique per show)
- `topic_weights` (jsonb) - Learned topic weights
  ```json
  {
    "country_china": { "liked": 5, "rejected": 1, "weight": 1.4 },
    "topic_tariffs": { "liked": 3, "rejected": 0, "weight": 1.3 }
  }
  ```
- `category_weights` (jsonb) - Learned category weights
  ```json
  {
    "us_china_trade": { "liked": 5, "rejected": 1, "weight": 1.4 },
    "us_domestic_finance": { "liked": 3, "rejected": 0, "weight": 1.3 }
  }
  ```
- `pattern_weights` (jsonb) - Learned behavior pattern weights
- `source_weights` (jsonb, optional) - Learned source weights
- `updated_at` (timestamp) - Last update time

**Sample Query**:
```javascript
const { data: learningData } = await supabase
  .from('show_learning_weights')
  .select('topic_weights, category_weights, pattern_weights, source_weights')
  .eq('show_id', showId)
  .single();
```

**Sample Upsert**:
```javascript
await supabase
  .from('show_learning_weights')
  .upsert({
    show_id: showId,
    topic_weights: topicWeights,
    category_weights: categoryWeights,
    pattern_weights: patternWeights,
    updated_at: new Date().toISOString()
  }, { onConflict: 'show_id' });
```

**Useful Queries**:
```sql
-- Get learning weights for a show
SELECT topic_weights, category_weights, pattern_weights, source_weights
FROM show_learning_weights
WHERE show_id = $1;

-- Get top learned categories
SELECT 
  jsonb_object_keys(category_weights) as category,
  category_weights->jsonb_object_keys(category_weights)->>'liked' as liked,
  category_weights->jsonb_object_keys(category_weights)->>'weight' as weight
FROM show_learning_weights
WHERE show_id = $1
ORDER BY (category_weights->jsonb_object_keys(category_weights)->>'weight')::float DESC;
```

**Notes**:
- Uses JSONB for flexible weight storage
- Weights are numeric (1.0 = neutral, >1.0 = positive, <1.0 = negative)
- Tracks `liked`, `rejected` counts per entity/category/pattern

---

## 9. RECOMMENDATION FEEDBACK

### Table: `recommendation_feedback`

**Purpose**: Stores user feedback on recommendations (likes, rejects, etc.)

**Key Columns** (from `signalEffectiveness.js`):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key
- `signal_id` (uuid, optional) - Associated signal/idea
- `action` (text) - Action taken: 'liked', 'rejected', 'ignored', 'generate_pitch', 'saved', 'produced'
- `evidence_summary` (jsonb) - Summary of evidence
  - `idea_data` (object) - Idea/signal data
    - `topic` (text)
    - `score` (number)
  - `format` (text) - Format: 'news', 'long', 'short'
- `created_at` (timestamp) - When feedback was given

**Sample Query**:
```javascript
const { data: feedbacks } = await supabaseAdmin
  .from('recommendation_feedback')
  .select('*')
  .eq('show_id', showId)
  .gte('created_at', sinceDate.toISOString())
  .order('created_at', { ascending: false });
```

**Useful Queries**:
```sql
-- Get recent feedback for a show
SELECT action, signal_id, evidence_summary, created_at
FROM recommendation_feedback
WHERE show_id = $1
  AND created_at >= NOW() - INTERVAL '90 days'
ORDER BY created_at DESC;

-- Get feedback by action type
SELECT COUNT(*) as count, action
FROM recommendation_feedback
WHERE show_id = $1
GROUP BY action;
```

**Notes**:
- Used to calculate learning weights
- Tracks which signals/ideas users liked/rejected
- `evidence_summary` contains rich context about the recommendation

---

## 10. SIGNALS (News Items/Ideas)

### Table: `signals`

**Purpose**: Stores RSS/news signals/ideas

**Key Columns** (from codebase usage):
- `id` (uuid/bigserial) - Primary key
- `show_id` (uuid/bigint) - Associated show
- `title` (text) - Signal title
- `description` (text, optional) - Signal description
- `source` (text) - Source name
- `source_url` (text, optional) - Source URL
- `url` (text, optional) - Signal URL
- `published_at` (timestamp) - Publication date
- `score` (integer/float) - Calculated score
- `status` (text) - Status: 'new', 'reviewed', 'approved', 'rejected'
- `is_visible` (boolean) - Whether signal is visible in UI
- `matched_topic` (uuid/text, optional) - Matched topic ID
- `raw_data` (jsonb, optional) - Raw signal data, evidence, recommendations
- `created_at` (timestamp) - When signal was created
- `updated_at` (timestamp) - When signal was updated

**Sample Query**:
```javascript
const { data: signals } = await supabase
  .from('signals')
  .select('*')
  .eq('show_id', showId)
  .order('created_at', { ascending: false })
  .limit(100);
```

**Useful Queries**:
```sql
-- Get recent signals for a show
SELECT id, title, score, status, created_at
FROM signals
WHERE show_id = $1
  AND is_visible = true
ORDER BY created_at DESC
LIMIT 100;

-- Get high-scoring signals
SELECT id, title, score, source
FROM signals
WHERE show_id = $1
  AND score >= 70
ORDER BY score DESC;
```

**Notes**:
- Primary table for storing RSS/news items
- `raw_data` JSONB column stores evidence, recommendations, pitch data
- `status` field tracks signal lifecycle
- `is_visible` controls UI visibility

---

## 11. TOPIC CLUSTERS (Clustered Signals)

### Table: `topic_clusters`

**Purpose**: Stores topic clusters (grouped related signals)

**Key Columns** (from `clusterEngine.js`):
- `id` (uuid) - Primary key
- `show_id` (uuid, optional) - Associated show
- `cluster_name` (text) - Cluster name
- `cluster_name_ar` (text) - Arabic cluster name
- `created_at` (timestamp)

**Sample Query**:
```javascript
const { data: clusters } = await supabase
  .from('topic_clusters')
  .select('id, cluster_name, cluster_name_ar')
  .eq('show_id', showId)
  .order('created_at', { ascending: false })
  .limit(100);
```

**Related Tables**:
- `cluster_items` - Items in each cluster
- `cluster_keywords` - Keywords for clusters

---

## 12. CLUSTER ITEMS

### Table: `cluster_items`

**Purpose**: Links signals to topic clusters

**Key Columns** (inferred):
- `id` (uuid) - Primary key
- `cluster_id` (uuid) - Foreign key to topic_clusters
- `signal_id` (uuid) - Foreign key to signals
- `created_at` (timestamp)

---

## 13. CLUSTER KEYWORDS

### Table: `cluster_keywords`

**Purpose**: Stores keywords for topic clusters

**Key Columns** (from `clusterEngine.js`):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to shows
- `cluster_key` (text) - Cluster key identifier
- `keyword` (text) - Keyword
- `language` (text) - Language (e.g., 'ar', 'en')
- `weight` (float, optional) - Keyword weight

**Sample Query**:
```javascript
const { data: keywords } = await supabase
  .from('cluster_keywords')
  .select('cluster_key, keyword, language, weight')
  .eq('show_id', showId);
```

---

## 15. SHOW BEHAVIOR PATTERNS

### Table: `show_behavior_patterns`

**Purpose**: Stores learned behavior patterns per show

**Key Columns** (from `behaviorPatterns.js`, migration file):
- `show_id` (uuid) - Primary key (unique per show)
- `patterns` (jsonb) - Learned behavior patterns
- `learned_at` (timestamptz) - When patterns were learned
- `video_count` (integer, optional) - Count of videos analyzed
- `comment_count` (integer, optional) - Count of comments analyzed
- `competitor_video_count` (integer, optional) - Count of competitor videos analyzed

**Sample Query**:
```javascript
const { data: patternsData } = await supabase
  .from('show_behavior_patterns')
  .select('patterns, learned_at')
  .eq('show_id', showId)
  .maybeSingle();
```

**Sample Upsert**:
```javascript
await supabase
  .from('show_behavior_patterns')
  .upsert({
    show_id: showId,
    patterns: patterns,
    learned_at: new Date().toISOString(),
    video_count: Object.values(patterns).filter(p => p.source === 'videos').length,
    comment_count: Object.values(patterns).filter(p => p.source === 'comments').length,
    competitor_video_count: Object.values(patterns).filter(p => p.source === 'competitors').length
  }, { onConflict: 'show_id' });
```

**Notes**:
- Stores learned patterns from video analysis, comments, and competitor videos
- Patterns are JSONB for flexible structure
- Used by `scoreSignalByPatterns()` for pattern-based scoring

---

## 16. PITCHES

### Table: `pitches`

**Purpose**: Caches generated pitches to avoid regeneration and save tokens

**Key Columns** (from `create_pitches_table.sql`):
- `id` (uuid) - Primary key
- `signal_id` (uuid) - Foreign key to signals (unique)
- `show_id` (uuid) - Foreign key to shows
- `pitch_type` (text) - Pitch type: 'news', 'long', 'short'
- `content` (text) - Pitch content/text
- `tokens_used` (integer) - Tokens used for generation
- `created_at` (timestamptz) - When pitch was created
- `updated_at` (timestamptz) - When pitch was updated

**Sample Query**:
```javascript
const { data: pitch } = await supabase
  .from('pitches')
  .select('*')
  .eq('signal_id', signalId)
  .maybeSingle();
```

**Notes**:
- One pitch per signal (unique constraint on `signal_id`)
- Used for caching to avoid regenerating pitches
- Saves API tokens by reusing existing pitches

---

## 17. SEARCH TERMS (Database Table)

**Note**: Search terms are stored in BOTH:
1. **Database table**: `search_terms` (primary, used by systems)
2. **JSON files**: `data/processed/search_terms.json` (legacy/import source)

The database table is the primary source used by intelligence systems.

---

## 14. SEARCH TERMS

### Table: `search_terms`

**Purpose**: Stores search terms that the audience uses on YouTube

**Key Columns** (from `Create_Import_Tables_SQL.sql`):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to shows
- `term` (text) - Search query text
- `views` (bigint) - Total views for videos matching this search
- `watch_time_hours` (numeric) - Total watch time
- `avg_view_duration` (text) - Average view duration
- `topic` (text) - Category (channel, economy, politics, etc.)
- `intent` (text) - Search intent (informational, etc.)
- `personas` (jsonb) - Array of persona IDs that search for this
- `is_branded` (boolean) - Whether it's a branded search (channel name)
- `is_opportunity` (boolean) - Whether this is an opportunity to create content
- `created_at` (timestamptz) - When record was created
- `updated_at` (timestamptz) - When record was updated

**Sample Query**:
```javascript
const { data: searchTerms } = await supabase
  .from('search_terms')
  .select('*')
  .eq('show_id', showId)
  .eq('is_branded', false)
  .order('views', { ascending: false })
  .limit(100);
```

**Useful Queries**:
```sql
-- Get top search terms for a show
SELECT term, views, topic, is_opportunity
FROM search_terms
WHERE show_id = $1
  AND is_branded = false
ORDER BY views DESC
LIMIT 50;

-- Get opportunity search terms
SELECT term, views, topic
FROM search_terms
WHERE show_id = $1
  AND is_opportunity = true
ORDER BY views DESC;
```

**Notes**:
- Used by intelligence systems for audience demand analysis
- Non-branded terms are preferred for content opportunities
- High-view terms indicate audience interest

---

## KEY RELATIONSHIPS

```
shows (1) ────< (many) channel_videos
shows (1) ────< (many) videos (fallback/legacy)
shows (1) ────< (1) show_dna
shows (1) ────< (many) topic_definitions
shows (1) ────< (1) show_learning_weights
shows (1) ────< (1) show_behavior_patterns
shows (1) ────< (many) competitor_videos
shows (1) ────< (many) audience_comments
shows (1) ────< (many) audience_videos
shows (1) ────< (many) search_terms
shows (1) ────< (many) recommendation_feedback
shows (1) ────< (many) topic_clusters
shows (1) ────< (many) signals

topic_clusters (1) ────< (many) cluster_items
topic_clusters (1) ────< (many) cluster_keywords

competitors (1) ────< (many) competitor_videos

signals (1) ────< (1) pitches (unique)
signals (1) ────< (many) cluster_items
```

---

## USEFUL QUERIES FOR SMART PITCH SYSTEM

### Get Top Performing Videos for Pattern Analysis

```sql
-- Get top 50 videos for a show (for pattern learning)
SELECT 
  id,
  title,
  views,
  publish_date,
  format,
  topic_id,
  hook_text
FROM channel_videos
WHERE show_id = $1
  AND format = 'Long'
  AND views > 0
ORDER BY views DESC
LIMIT 50;
```

### Get Show DNA/Topics

```sql
-- Get all active topics for a show
SELECT 
  topic_id,
  topic_name_en,
  topic_name_ar,
  keywords_en,
  keywords_ar
FROM topic_definitions
WHERE show_id = $1
  AND is_active = true;
```

### Get Learning Weights

```sql
-- Get learned weights for a show
SELECT 
  topic_weights,
  category_weights,
  pattern_weights,
  source_weights,
  updated_at
FROM show_learning_weights
WHERE show_id = $1;
```

### Get Topic Performance

```sql
-- Calculate topic performance (avg views per topic)
SELECT 
  topic_id,
  COUNT(*) as video_count,
  AVG(views) as avg_views,
  SUM(views) as total_views,
  MAX(views) as max_views
FROM channel_videos
WHERE show_id = $1
  AND format = 'Long'
  AND views > 0
  AND topic_id IS NOT NULL
GROUP BY topic_id
ORDER BY avg_views DESC;
```

### Get Competitor Videos for a Topic

```sql
-- Get competitor videos matching a topic
SELECT 
  title,
  views,
  channel_name,
  topic_id
FROM competitor_videos
WHERE show_id = $1
  AND topic_id = $2
ORDER BY views DESC
LIMIT 20;
```

### Get Audience Questions for a Topic

```sql
-- Get audience questions/comments for a topic
SELECT 
  text,
  question,
  likes,
  is_actionable
FROM audience_comments
WHERE show_id = $1
  AND topic = $2
  AND is_actionable = true
ORDER BY likes DESC
LIMIT 50;
```

---

## WHAT'S MISSING / UNCERTAIN

### Not Found in Codebase:

1. **Video Performance Metrics**:
   - CTR (Click-through rate)
   - Average view duration
   - Retention metrics
   - Engagement metrics (likes, comments count on videos)
   - **Suggestion**: Add columns to `channel_videos` or create `video_metrics` table

2. **Video Entities**:
   - Extracted entities (people, countries, topics) per video
   - **Suggestion**: Add JSONB column `entities` to `channel_videos` or create `video_entities` table

3. **Video Categories/Tags**:
   - Category classification per video
   - Tags/keywords per video
   - **Suggestion**: Add `category` and `tags` columns to `channel_videos`

4. **Pitch Tracking**:
   - Which pitches/recommendations became videos
   - Link between signals/ideas and produced videos
   - **Suggestion**: Create `pitch_videos` junction table or add `source_signal_id` to `channel_videos`

5. **Behavior Patterns Storage**:
   - ✅ `show_behavior_patterns` table EXISTS
   - Stores learned patterns per show
   - Patterns are calculated and cached in database

6. **Shows Table**:
   - ✅ `shows` table EXISTS
   - Structure: `id`, `name`, `channel_id`, `created_at`, `updated_at`
   - Primary table referenced by all other tables via `show_id`

### Recommendations for Smart Pitch System:

1. **Add Video Entities Column**:
   ```sql
   ALTER TABLE channel_videos
   ADD COLUMN entities JSONB DEFAULT '{}';
   -- Stores: { "people": [], "countries": [], "topics": [], "organizations": [] }
   ```

2. **Add Video Category Column**:
   ```sql
   ALTER TABLE channel_videos
   ADD COLUMN category TEXT;
   -- Stores topic category (e.g., "us_china_trade")
   ```

3. **Create Pitch Tracking Table**:
   ```sql
   CREATE TABLE pitch_videos (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     signal_id UUID REFERENCES signals(id),
     video_id UUID REFERENCES channel_videos(id),
     show_id UUID,
     pitch_text TEXT,
     predicted_views INTEGER,
     actual_views INTEGER,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **Behavior Patterns Table** (✅ Already exists):
   - Table: `show_behavior_patterns`
   - Stores learned patterns per show
   - Already integrated with `behaviorPatterns.js`

5. **Add Video Metrics Table** (optional):
   ```sql
   CREATE TABLE video_metrics (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     video_id UUID REFERENCES channel_videos(id),
     ctr FLOAT,
     avg_view_duration INTEGER,
     retention_30s FLOAT,
     likes INTEGER,
     comments_count INTEGER,
     collected_at TIMESTAMP DEFAULT NOW()
   );
   ```

---

## SAMPLE DATA STRUCTURE

### channel_videos (Sample Row)

```json
{
  "id": "uuid-here",
  "show_id": "show-uuid",
  "title": "لماذا قد يصبح بترول فنزويلا لعنة؟",
  "views": 594000,
  "publish_date": "2024-01-15T10:00:00Z",
  "format": "Long",
  "topic_id": "us_latin_america",
  "hook_text": "في هذا الفيديو سنكشف..."
}
```

### show_learning_weights (Sample Row)

```json
{
  "show_id": "show-uuid",
  "topic_weights": {
    "country_china": { "liked": 8, "rejected": 2, "weight": 1.4 },
    "topic_tariffs": { "liked": 5, "rejected": 1, "weight": 1.35 }
  },
  "category_weights": {
    "us_china_trade": { "liked": 10, "rejected": 2, "weight": 1.5 },
    "us_domestic_finance": { "liked": 6, "rejected": 1, "weight": 1.4 }
  },
  "pattern_weights": {
    "superpower_tension": { "liked": 7, "rejected": 1, "weight": 1.4 }
  },
  "updated_at": "2024-01-20T12:00:00Z"
}
```

### topic_definitions (Sample Row)

```json
{
  "show_id": "show-uuid",
  "topic_id": "us_china_trade",
  "topic_name_en": "US-China Trade",
  "topic_name_ar": "التجارة الأمريكية الصينية",
  "keywords_en": ["trade", "tariffs", "china", "usa"],
  "keywords_ar": ["تجارة", "رسوم جمركية", "الصين", "أمريكا"],
  "is_active": true
}
```

---

## ADDITIONAL TABLES

### 18. USER SHOWS (User-Show Access)

### Table: `user_shows`

**Purpose**: Maps users to shows they have access to

**Key Columns** (inferred):
- `user_id` (uuid) - Foreign key to auth.users
- `show_id` (uuid/bigint) - Foreign key to shows
- (Other fields not visible in codebase)

**Notes**:
- Used for access control
- Determines which shows a user can access

---

### 19. SIGNAL SOURCES (RSS Feeds)

### Table: `signal_sources`

**Purpose**: Stores RSS feeds/sources to monitor

**Key Columns** (from `supabase_schema.sql`):
- `id` (bigserial) - Primary key
- `show_id` (bigint) - Foreign key to shows
- `name` (text) - Source name
- `url` (text) - RSS feed URL
- `enabled` (boolean) - Whether feed is enabled
- `item_limit` (integer) - Max items to process per feed
- `dna_topics` (jsonb) - Array of topic IDs that match show's DNA
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Notes**:
- Used by RSS processor to fetch signals
- Each show can have multiple RSS sources

---

### 20. MANUAL TRENDS

### Table: `manual_trends`

**Purpose**: Stores manually entered trends/topics

**Key Columns** (inferred from code):
- `id` (uuid) - Primary key
- `show_id` (uuid) - Foreign key to shows
- `active` (boolean) - Whether trend is active
- (Other fields not fully visible)

**Notes**:
- Used for manually tracked trends
- Referenced by intelligence systems

---

### 21. TOPIC FINGERPRINTS

### Table: `topic_fingerprints`

**Purpose**: Caches topic fingerprints for performance

**Key Columns** (inferred from `topicIntelligence.js`):
- `id` (uuid) - Primary key
- `fingerprint_hash` (text, unique) - Hash of content
- `fingerprint_data` (jsonb) - Cached fingerprint data
- `created_at` (timestamptz)

**Notes**:
- Used by Topic Intelligence system for caching
- Improves performance by avoiding duplicate fingerprint generation

---

## NEXT STEPS FOR SMART PITCH SYSTEM

1. **Verify Schema**: Run actual queries to confirm table structures (especially `channel_videos` exact columns)
2. **Add Missing Columns**: Add entities, categories to `channel_videos` table
3. **Create Tracking Tables**: Pitch-video tracking table (link pitches to produced videos)
4. **Build Query Layer**: Create utility functions for common queries
5. **Test Data Access**: Verify all required data is accessible
6. **Check for `videos` table**: Verify if `videos` table exists alongside `channel_videos` (appears to be legacy/fallback)
