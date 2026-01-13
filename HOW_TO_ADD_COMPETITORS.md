# How to Add Competitors & Videos

## Quick Access

**Go to:** `/competitors` page (or click "🎯 Competitors" in the navigation)

## Adding a Channel

1. **Click the "➕ Add Channel" button** on the competitors page
2. **Select the type** by clicking on the appropriate tab:
   - 🎯 **Direct Competitor** - Same niche, same topics
   - 🔗 **Adjacent Content** - Different topics, same audience
   - ✨ **Format Inspiration** - Great presentation styles
3. **Fill in the form:**
   - **YouTube URL** (required) - e.g., `https://youtube.com/@channel`
   - **Channel Name** (optional) - Will be auto-detected if not provided
   - **Content Category** (for Adjacent Content) - Pop Science, Podcast, etc.
   - **Format Type** (for Format Inspiration) - Explainer, Storytelling, etc.
   - **Why watching** - Notes about what to learn
   - **What to learn** - Checkboxes for specific learning points
4. **Click "Add Channel"**

## Adding a Video

1. **Click the "📹 Add Video" button** on the competitors page
2. **Fill in the form:**
   - **YouTube Video URL** (required) - e.g., `https://youtube.com/watch?v=...`
   - **Video Title** (optional)
   - **Channel** (optional) - Link to an existing tracked channel
   - **Content Type** - Direct Competitor, Adjacent Content, or Format Inspiration
   - **Why save this video** - Notes about what to learn
3. **Click "Add Video"**

## Managing Channels

- **Visit Channel:** Click "🔗 Visit" to open the channel on YouTube
- **Pause/Resume Monitoring:** Click "⏸️ Pause" or "▶️ Resume"
- **Delete Channel:** Click "🗑️ Delete" (with confirmation)

## Example: Adding a Direct Competitor

1. Go to `/competitors`
2. Click on "🎯 منافس مباشر" tab
3. Click "➕ Add Channel"
4. Enter:
   - URL: `https://youtube.com/@visualpolitik`
   - Name: `Visualpolitik AR`
   - Reason: `Same niche - geopolitics in Arabic`
   - Check: "Topics they cover", "Angles they use"
5. Click "Add Channel"

## Example: Adding Adjacent Content

1. Go to `/competitors`
2. Click on "🔗 محتوى مجاور" tab
3. Click "➕ Add Channel"
4. Enter:
   - URL: `https://youtube.com/@kurzgesagt`
   - Name: `Kurzgesagt`
   - Category: `Pop Science`
   - Reason: `Great at simplifying complex topics - learn visual style`
   - Check: "Tone and style preferences", "Content formats they enjoy"
5. Click "Add Channel"

## Example: Adding Format Inspiration

1. Go to `/competitors`
2. Click on "✨ إلهام للشكل" tab
3. Click "➕ Add Channel"
4. Enter:
   - URL: `https://youtube.com/@vox`
   - Name: `Vox`
   - Format Type: `Explainer`
   - Reason: `Excellent explainer format - learn storytelling techniques`
   - Check: "Storytelling techniques", "Hook strategies"
5. Click "Add Channel"

## Data Storage

All competitors and videos are stored in:
- **File:** `data/competitors.json`
- **Location:** `/Users/Hassanes_1/Documents/channelbrain/cursor/data/competitors.json`

## API Endpoints

You can also add competitors/videos programmatically:

### Add Channel
```javascript
POST /api/competitors/channels
{
  "url": "https://youtube.com/@channel",
  "name": "Channel Name",
  "type": "direct_competitor",
  "subType": "pop_science",  // For adjacent_content
  "formatType": "explainer",  // For format_inspiration
  "reasonToWatch": "Why tracking",
  "learnFrom": ["Item 1", "Item 2"]
}
```

### Add Video
```javascript
POST /api/competitors/videos
{
  "url": "https://youtube.com/watch?v=...",
  "title": "Video Title",
  "channelId": "channel-id",
  "contentType": "direct_competitor",
  "reason": "Why save this"
}
```

## Next Steps

After adding competitors:
1. **Analyze adjacent content** - Use the analyzer to find crossover opportunities
2. **Extract format lessons** - Learn presentation techniques
3. **Track insights** - Save discoveries about what works

The system is ready to use! 🚀




