# Ideas Feature - Current State Analysis & Implementation Plan

## Answers to Your Questions

### 1. Data Access

**Current Ideas Component Location:**
- **File:** `/app/studio/page.jsx` (Studio Ideas page)
- **API Endpoint:** `/api/signals?show_id={showId}&limit=20`
- **Framework:** Next.js with React (client component)
- **Styling:** Tailwind CSS

**Current Data Structure (Signal/Idea Object):**
```typescript
interface Signal {
  id: string;
  title: string;
  source: string; // RSS source name
  source_url?: string;
  published_at?: string;
  created_at: string;
  
  // Scoring (current)
  score?: number; // 0-100
  relevance_score?: number;
  hook_score?: number;
  final_score?: number;
  
  // Status
  status: 'new' | 'reviewed' | 'liked' | 'rejected' | 'saved' | 'produced';
  
  // Flags
  is_evergreen?: boolean;
  competitor_boost?: number; // Currently exists but not well utilized
  
  // Learning adjustments (from API)
  original_score?: number;
  learning_applied?: boolean;
  adjustments?: string[];
  positive_boost?: number;
  angle_type?: string;
  angle_boost?: number;
  
  // Enrichment (if AI-enriched)
  audience_insight?: string;
  hook_potential?: number;
  
  // Topic (if available)
  topic_id?: string;
}
```

**What Data is Available:**
- ✅ **RSS Signals:** Yes, from `signals` table
- ✅ **DNA Topics:** Yes, from `show_dna` table (via `topic_id` field)
- ⚠️ **Competitor Videos:** Partially - stored in `competitor_videos` table but not currently joined to signals
- ⚠️ **User's Recent Posts:** Not directly - would need to query `channel_videos` table
- ✅ **Learning/Feedback:** Yes, via `recommendation_feedback` table and `show_learning_weights` table

### 2. Component Location

**Main Component:**
- `/app/studio/page.jsx` - Studio Ideas page (lines 1-442)
- Uses simple card layout with score badges
- Has pitch generation modal
- Has feedback buttons (thumbs up/down)

**Related Components:**
- `/components/FeedbackButtons.jsx` - Feedback UI component
- `/components/LearningStats.jsx` - Learning stats display

### 3. Existing Systems

**Learning/Feedback System:**
- **Table:** `recommendation_feedback` (stores user feedback)
- **Table:** `show_learning_weights` (stores learned preferences)
- **API:** `/api/feedback` (POST) - Records feedback
- **API:** `/api/learning-stats` (GET) - Gets learning statistics
- **Location:** `/app/api/signals/route.js` applies learning weights to signals

**Current Scoring:**
- **Location:** `/app/api/signals/route.js` (lines 364-456)
- Applies learning weights, positive patterns, angle detection
- Uses DNA keywords for pre-scoring non-enriched signals
- Already has some competitor boost logic (line 295) but not fully utilized

**User Interactions Tracked:**
- `liked` - Thumbs up
- `rejected` - Thumbs down (with rejection reasons)
- `saved` - Save for later
- `produced` - Mark as produced
- Stored in `recommendation_feedback` table

### 4. Backend

**RSS/Trends Data:**
- **Source:** `signals` table (populated by `/api/rss-processor`)
- **API:** `/api/signals/refresh` - Refreshes signals from RSS feeds
- **API:** `/api/signals` - GET endpoint returns signals with learning applied

**Competitor Data:**
- **Table:** `competitor_videos` - Stores competitor videos
- **Table:** `competitors` - Stores competitor channel info
- **API:** `/api/competitors/videos?showId={showId}` - Gets competitor videos
- **API:** `/api/competitors?showId={showId}` - Gets competitors list

**DNA Data:**
- **Table:** `show_dna` - Stores channel DNA (topics, keywords)
- **Table:** `topic_definitions` - Stores topic definitions
- **API:** `/api/content-dna?showId={showId}` - Gets DNA data

**User Videos:**
- **Table:** `channel_videos` - Stores user's own videos
- Can query to check if user posted about a topic recently

**Can We Add New Fields?**
- ✅ Yes, we can add computed fields to the API response (no DB migration needed)
- ✅ We can join competitor_videos and channel_videos in the API
- ✅ We can calculate breakout videos, DNA matches, etc. server-side

---

## Implementation Plan

### Phase 1: Enhanced Scoring Logic

**File:** `/app/api/signals/route.js`

**Changes Needed:**
1. Join `competitor_videos` table to find competitor breakouts
2. Join `channel_videos` to check user's recent posts
3. Calculate DNA match from `topic_id` and `show_dna.topics`
4. Implement new multi-signal scoring function
5. Add urgency tier calculation

### Phase 2: UI Components

**Files to Create/Update:**
1. `/app/studio/page.jsx` - Update to use new scoring and display signals
2. `/components/IdeaCard.jsx` - New component (or update existing card)
3. `/components/IdeasList.jsx` - New component for grouped display

**Changes:**
- Display urgency tiers (Post Today / This Week / Backlog)
- Show "WHY NOW" signals section
- Group by tier
- Better visual hierarchy

### Phase 3: Learning Integration

**Files:**
- `/app/api/feedback/route.js` - Already exists, may need updates
- `/app/api/signals/route.js` - Already applies learning, needs enhancement

**Changes:**
- Track signal effectiveness (which signals led to pitches/productions)
- Adjust signal weights based on user behavior
- Store topic preferences from feedback

### Phase 4: Data Pipeline

**Files:**
- `/app/api/signals/route.js` - Main endpoint to enhance
- May need new helper functions in `/lib/` directory

**Changes:**
- Ensure competitor data is joined
- Ensure DNA match is calculated
- Ensure user's recent posts are checked
- Aggregate RSS sources per topic

---

## Next Steps

1. **Start with Phase 1** - Enhance the `/api/signals` endpoint to calculate new scores
2. **Test scoring logic** - Verify signals are properly scored and filtered
3. **Update UI** - Update `/app/studio/page.jsx` to display new structure
4. **Add learning** - Enhance learning system to track signal effectiveness

Would you like me to start implementing Phase 1 (Enhanced Scoring Logic) now?
