import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { scoreRssItemAgainstDna } from '@/lib/dna-scoring'
import { recommendBatch } from '@/lib/recommendation/pipeline.js'
import { loadShowDna } from '@/lib/recommendation/dnaLoader.js'
import { makeDecisions } from '@/lib/decisions/decisionEngine.js'
import { classifyItem } from '@/lib/recommendation/classifier.js'
import { detectStoryType } from '@/lib/recommendation/storyTypes.js'
import { gate_CeilingDetection } from '@/lib/gates/retentionGates.js'
import { findBestHookPattern } from '@/lib/hooks/hookMatcher.js'
import { predictShortsSuccess, applyShortsGates } from '@/lib/shorts/shortsAnalyzer.js'
import { analyzeItemBehaviors, generateOptimizedAngle } from '@/lib/behaviors/behaviorPredictor.js'
import { parseRssItemDate, formatDateForHook, filterByFreshness } from '@/lib/utils/dateParser.js'
import { filterRSSByChannelEntities } from '@/lib/rss/rssEntityFilter'
import Anthropic from '@anthropic-ai/sdk'

// Use admin client for server-side operations (bypasses RLS)
// Fall back to regular client if admin is not available
const db = supabaseAdmin || supabase

// Log which client we're using
if (supabaseAdmin) {
  console.log('✅ Using admin client (service_role key) - RLS bypassed')
} else {
  console.warn('⚠️  Admin client not available - using anon key. Inserts may fail due to RLS.')
  console.warn('   Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart server')
}

// Debug: Log Supabase config status (remove in production)
console.log('Supabase Config Check:', {
  hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  urlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) || 'missing',
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  anonKeyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) || 'missing',
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  serviceRoleKeyPreview: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'missing',
  isConfigured: isSupabaseConfigured,
  usingAdminClient: !!supabaseAdmin,
})

// Dynamic import for rss-parser (CommonJS module)
let Parser
async function getParser() {
  if (!Parser) {
    const rssParser = await import('rss-parser')
    Parser = rssParser.default || rssParser
  }
  return Parser
}

/**
 * Parse sitemap XML (for news sitemaps)
 */
function parseSitemapXml(text, limit = 20) {
  const items = []
  try {
    // Match complete <url> blocks that contain <news:news>
    const urlBlocks = text.match(/<url>[\s\S]*?<\/url>/gi) || []
    
    for (const urlBlock of urlBlocks.slice(0, limit)) {
      // Extract URL location
      const locMatch = urlBlock.match(/<loc>([\s\S]*?)<\/loc>/i)
      const link = locMatch ? locMatch[1].trim() : ''
      
      // Extract news title
      const titleMatch = urlBlock.match(/<news:title>([\s\S]*?)<\/news:title>/i)
      const title = titleMatch 
        ? titleMatch[1]
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
            .replace(/&#039;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .trim()
        : ''
      
      // Extract publication date
      const dateMatch = urlBlock.match(/<news:publication_date>([\s\S]*?)<\/news:publication_date>/i)
      const pubDate = dateMatch ? dateMatch[1].trim() : ''
      
      // Extract last modified as fallback
      const lastmodMatch = urlBlock.match(/<lastmod>([\s\S]*?)<\/lastmod>/i)
      const lastmod = lastmodMatch ? lastmodMatch[1].trim() : ''
      
      if (title && link) {
        const rssItem = {
          title: title,
          description: '', // Sitemaps don't have descriptions
          link: link,
          pubDate: pubDate || lastmod,
          categories: [],
          guid: link,
        };
        
        // Parse and validate the publication date
        const dateInfo = parseRssItemDate(rssItem);
        rssItem.dateInfo = dateInfo;
        
        // Add formatted date for hook generation
        if (dateInfo.useInHook && dateInfo.pubDate) {
          rssItem.dateForHook = formatDateForHook(dateInfo.pubDate);
        }
        
        items.push(rssItem);
      }
    }
  } catch (error) {
    console.error('Error parsing sitemap:', error)
  }
  
  return items
}

/**
 * Fetch and parse RSS feed or sitemap
 */
async function fetchRssFeed(url, limit = 20) {
  try {
    console.log(`Attempting to fetch feed from: ${url}`)
    
    // First, try to fetch the URL to check if it's accessible
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChannelBrain/1.0)',
      },
    })
    
    if (!response.ok) {
      console.error(`Feed returned status ${response.status}: ${response.statusText}`)
      return []
    }
    
    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    
    console.log(`Feed response: ${response.status}, Content-Type: ${contentType}, Length: ${text.length}`)
    
    // Check if it's a sitemap (news sitemap)
    if (text.includes('<urlset') && text.includes('<news:news>')) {
      console.log('Detected news sitemap format, parsing...')
      const items = parseSitemapXml(text, limit)
      console.log(`Successfully parsed ${items.length} items from sitemap`)
      return items
    }
    
    // Check if it's RSS/Atom feed
    if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<?xml')) {
      console.warn(`URL doesn't appear to be RSS/XML. Content starts with: ${text.substring(0, 200)}`)
      return []
    }
    
    // Parse as RSS/Atom feed
    const ParserClass = await getParser()
    const parser = new ParserClass({
      customFields: {
        item: ['description', 'content:encoded', 'pubDate', 'published'],
      },
    })
    
    const feed = await parser.parseString(text)
    const items = (feed.items || []).slice(0, limit).map((item) => {
      const rssItem = {
        title: item.title || '',
        description: item.contentSnippet || item.content || item.description || '',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || item.published || '',
        categories: item.categories || [],
        guid: item.guid || item.id || item.link || '',
      };
      
      // Parse and validate the publication date
      const dateInfo = parseRssItemDate(rssItem);
      rssItem.dateInfo = dateInfo;
      
      // Add formatted date for hook generation
      if (dateInfo.useInHook && dateInfo.pubDate) {
        rssItem.dateForHook = formatDateForHook(dateInfo.pubDate);
      }
      
      return rssItem;
    })
    
    console.log(`Successfully parsed ${items.length} items from RSS feed`)
    return items
  } catch (error) {
    console.error(`Error fetching feed ${url}:`, error.message)
    console.error('Error details:', error)
    return []
  }
}

/**
 * Process RSS feeds for a show and score items against DNA
 * @param {string} showId - Show UUID
 * @param {object} options - Processing options
 * @param {number} options.maxFeeds - Maximum number of feeds to process (for selectivity)
 * @param {number} options.itemsPerFeed - Items to fetch per feed (default: 5 for 300+ feeds, 20 for fewer)
 * @param {string} options.priorityFilter - Only save items with this priority or higher ('HIGH', 'MEDIUM', 'LOW')
 * @param {number} options.minScore - Minimum score threshold (0-100)
 */
export async function processRssFeedsForShow(showId, options = {}) {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured', processed: 0, saved: 0 }
  }

  const {
    maxFeeds = null,  // null = process all, or set limit for selectivity
    itemsPerFeed = null,  // null = auto-detect based on feed count
    priorityFilter = 'MEDIUM',  // Changed to MEDIUM for testing (was HIGH - too strict)
    minScore = 70  // Minimum score threshold (0-100)
  } = options

  try {
    // Fetch signal sources for this show
    const { data: sources, error: sourcesError } = await db
      .from('signal_sources')
      .select('*')
      .eq('show_id', showId)
      .eq('enabled', true)

    if (sourcesError) throw sourcesError
    if (!sources || sources.length === 0) {
      return { error: 'No enabled RSS sources found for this show', processed: 0, saved: 0, showId }
    }
    
    console.log(`Found ${sources.length} RSS source(s) for show ${showId}`)
    
    // Auto-adjust selectivity based on feed count (AGGRESSIVE for 300+ feeds)
    const feedCount = sources.length
    const autoItemsPerFeed = itemsPerFeed !== null ? itemsPerFeed : (
      feedCount > 300 ? 3 :  // Very aggressive: only 3 items per feed
      feedCount > 200 ? 5 :  // Aggressive: 5 items per feed
      feedCount > 100 ? 10 : // Moderate: 10 items per feed
      feedCount > 50 ? 15 :  // Normal: 15 items per feed
      20  // Default: 20 items per feed
    )
    const autoMaxFeeds = maxFeeds !== null ? maxFeeds : (
      feedCount > 300 ? 30 :  // Process only top 30 feeds
      feedCount > 200 ? 50 :  // Process top 50 feeds
      feedCount > 100 ? 75 :  // Process top 75 feeds
      null  // Process all feeds
    )
    
    // Select feeds to process with smart prioritization
    let feedsToProcess = sources
    if (autoMaxFeeds && feedsToProcess.length > autoMaxFeeds) {
      // Multi-factor prioritization:
      // 1. Feeds with DNA topics configured (highest priority)
      // 2. Feeds with recent successful signals (active feeds)
      // 3. Alphabetical (for consistency)
      
      // First, try to get recent signal counts per feed (if possible)
      const feedPriorities = await Promise.all(
        feedsToProcess.map(async (feed) => {
          let priority = 1000 // Default (lower = higher priority)
          
          // Priority 1: Has DNA topics configured
          if (feed.dna_topics && Array.isArray(feed.dna_topics) && feed.dna_topics.length > 0) {
            priority = 1
          } else {
            // Priority 2: Check if feed has recent signals (active feed)
            try {
              const { count } = await db
                .from('signals')
                .select('*', { count: 'exact', head: true })
                .eq('show_id', showId)
                .eq('raw_data->>sourceName', feed.name)
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
              
              if (count > 0) {
                priority = 2 + (100 - Math.min(count, 100)) // More signals = higher priority (lower number)
              } else {
                priority = 500 // No recent signals
              }
            } catch (e) {
              // If query fails, use default priority
              priority = 500
            }
          }
          
          return { ...feed, priority }
        })
      )
      
      // Sort by priority (lower = better), then by name for consistency
      feedsToProcess = feedPriorities
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority
          return (a.name || '').localeCompare(b.name || '')
        })
        .slice(0, autoMaxFeeds)
      
      const skippedCount = feedCount - feedsToProcess.length
      console.log(`📊 Selectivity: Processing ${autoMaxFeeds} of ${feedCount} feeds`)
      console.log(`   - ${feedsToProcess.filter(f => f.priority === 1).length} feeds with DNA topics`)
      console.log(`   - ${feedsToProcess.filter(f => f.priority > 1 && f.priority < 500).length} active feeds (recent signals)`)
      console.log(`   - ${skippedCount} feeds skipped (lower priority)`)
    } else {
      console.log(`📊 Processing all ${feedCount} feeds`)
    }
    
    console.log(`⚙️  Processing settings: ${autoItemsPerFeed} items/feed, min priority: ${priorityFilter}, min score: ${minScore}`)

    let totalProcessed = 0
    let totalSaved = 0
    const results = []
    let scoreStats = { min: 10, max: 0, sum: 0, count: 0 }  // Move outside loop
    let feedsProcessed = 0
    let feedsSkipped = 0

    // Load DNA once for all feeds (more efficient)
    const showDna = await loadShowDna(showId)
    if (!showDna) {
      console.warn(`⚠️  Could not load DNA for show ${showId}`)
      console.warn(`   This means strict quality gates and recommendation engine won't work`)
      console.warn(`   Falling back to old scoring method (will be very strict)`)
    } else {
      console.log(`✅ DNA loaded: ${showDna.topics?.length || 0} topics, ${showDna.hook_patterns?.length || 0} hook patterns`)
    }

    // Initialize Anthropic client once (if available)
    let anthropicClient = null
    if (process.env.ANTHROPIC_API_KEY) {
      anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    }

    const llmClient = anthropicClient ? {
      messages: {
        create: async (params) => {
          return await anthropicClient.messages.create(params)
        }
      }
    } : null

    // Process each RSS source (with early exit if we have enough signals)
    const MAX_SIGNALS_TO_SAVE = 10  // Stop after saving this many signals (STRICT: only top 10)
    for (const source of feedsToProcess) {
      // Early exit if we've saved enough high-quality signals
      if (totalSaved >= MAX_SIGNALS_TO_SAVE) {
        console.log(`\n✅ Early exit: Saved ${totalSaved} signals (max: ${MAX_SIGNALS_TO_SAVE})`)
        console.log(`   Processed ${feedsProcessed} feeds before reaching limit`)
        break
      }
      
      const url = source.url
      // Ensure dnaTopics is an array (parse JSONB if needed)
      let dnaTopics = source.dna_topics || []
      if (typeof dnaTopics === 'string') {
        try {
          dnaTopics = JSON.parse(dnaTopics)
        } catch (e) {
          console.warn(`Failed to parse dna_topics for ${source.name}:`, e)
          dnaTopics = []
        }
      }
      if (!Array.isArray(dnaTopics)) {
        dnaTopics = []
      }
      // Use auto-detected limit or source's configured limit
      const limit = autoItemsPerFeed || source.item_limit || 20

      console.log(`Processing RSS feed: ${source.name} (${url})`)

      // Fetch RSS items
      let rssItems = await fetchRssFeed(url, limit)
      console.log(`Fetched ${rssItems.length} items from ${source.name} (${url})`)
      
      if (rssItems.length === 0) {
        console.warn(`No items fetched from ${source.name}. Check if the RSS URL is valid and accessible.`)
        feedsSkipped++
        continue
      }
      
      // Filter by freshness (remove articles older than 7 days by default)
      const originalCount = rssItems.length
      rssItems = filterByFreshness(rssItems, { 
        maxAgeDays: 7,  // Filter out articles older than 7 days
        allowStale: false  // Don't allow stale articles
      })
      
      if (rssItems.length < originalCount) {
        const filteredCount = originalCount - rssItems.length
        console.log(`🗑️  Filtered out ${filteredCount} old article(s) from ${source.name} (keeping only fresh articles < 7 days)`)
      }
      
      // ✨ NEW: Filter by channel entities before processing
      if (rssItems.length > 0) {
        const beforeEntityFilter = rssItems.length
        rssItems = await filterRSSByChannelEntities(rssItems, showId)
        const afterEntityFilter = rssItems.length
        if (beforeEntityFilter > afterEntityFilter) {
          console.log(`   🎯 Entity filter: ${afterEntityFilter}/${beforeEntityFilter} items relevant to channel`)
        }
      }
      
      // Log date info for first few items
      if (rssItems.length > 0) {
        const sampleItem = rssItems[0]
        if (sampleItem.dateInfo) {
          const dateInfo = sampleItem.dateInfo
          console.log(`   📅 Sample item date: ${dateInfo.pubDate ? dateInfo.pubDate.toISOString().split('T')[0] : 'unknown'} (${dateInfo.freshness}, ${dateInfo.ageInDays ? Math.floor(dateInfo.ageInDays) : '?'} days old)`)
          if (dateInfo.dateWarning) {
            console.log(`   ⚠️  ${dateInfo.dateWarning}`)
          }
        }
      }
      
      if (rssItems.length === 0) {
        console.warn(`No fresh items (< 7 days) from ${source.name} after filtering`)
        feedsSkipped++
        continue
      }
      
      feedsProcessed++
      totalProcessed += rssItems.length

      // Use recommendation engine if DNA is loaded, otherwise fall back to old scoring
      let recommendations = null
      if (showDna && showDna.topics && showDna.topics.length > 0) {
        try {
          console.log(`🎯 Using recommendation engine for ${rssItems.length} items from ${source.name}...`)
          console.log(`   DNA loaded: ${showDna.topics.length} topics, ${showDna.hook_patterns?.length || 0} hook patterns`)
          // Apply strict quality gates for quality filtering
          // TESTING: Lower thresholds significantly to allow signals through
          // Scores are very low (0.90-9.50 avg 4.39), so we need very lenient thresholds
          const batchMinScore = Math.min(minScore || 30, 30)  // Lowered to 30 for testing (was 50)
          const batchMaxResults = 20  // Increased to 20 per feed for testing
          console.log(`   🎯 TEST MODE: Using thresholds: minScore=${batchMinScore}, maxResults=${batchMaxResults}`)
          recommendations = await recommendBatch(rssItems, showDna, llmClient, {
            useStrictGates: true,  // Always enabled for quality
            maxResults: batchMaxResults,
            minScore: batchMinScore
          })
          console.log(`✅ ${source.name}: ${recommendations.recommended.length} recommended, ${recommendations.stats.rejected} rejected`)
          console.log(`   Priority breakdown: HIGH: ${recommendations.stats.high}, MEDIUM: ${recommendations.stats.medium}, LOW: ${recommendations.stats.low}`)
          console.log(`   ⚠️  Priority filter: ${priorityFilter} (only ${priorityFilter}+ will be saved)`)
          if (recommendations.filter_summary) {
            console.log(`   🎯 Filter: ${recommendations.filter_summary.message}`)
            console.log(`   📊 Filter funnel:`)
            recommendations.filter_summary.funnel.forEach(f => {
              console.log(`      ${f.gate}: ${f.passed} passed, ${f.rejected} rejected`)
            })
          }
        } catch (error) {
          console.error(`❌ Error in recommendation engine for ${source.name}, falling back to old scoring:`, error)
          console.error(`   Error details:`, error.message, error.stack)
          recommendations = null
        }
      } else {
        console.warn(`⚠️  DNA not loaded or empty for ${source.name}`)
        console.warn(`   showDna exists: ${!!showDna}, topics: ${showDna?.topics?.length || 0}`)
        console.warn(`   Falling back to old scoring (will be very strict)`)
      }

      // Score each item (using recommendations if available, otherwise old scoring)
      const sourceScoreStats = { min: 10, max: 0, sum: 0, count: 0, saved: 0 }  // Per-source stats
      
      // Process recommended items from recommendation engine
      if (recommendations && recommendations.recommended && recommendations.recommended.length > 0) {
        console.log(`📊 Processing ${recommendations.recommended.length} recommended items...`)
        console.log(`🔍 DEBUG: Priority filter = ${priorityFilter}, minScore = ${minScore}`)
        
        let itemsChecked = 0;
        let itemsPassedPriority = 0;
        let itemsPassedScore = 0;
        let itemsSaved = 0;
        
        for (const rec of recommendations.recommended) {
          itemsChecked++;
          // ===== ENHANCED DNA: CEILING DETECTION (Check ALL items) =====
          const topicId = rec.topic;
          if (topicId) {
            const ceilingCheck = gate_CeilingDetection(topicId);
            if (ceilingCheck.has_ceiling) {
              rec.ceiling_detected = true;
              rec.ceiling_reason = ceilingCheck.reason;
              console.log(`  ⛔ CEILING TOPIC DETECTED: "${(rec.recommended?.title_ar || rec.summary?.title || 'No title').substring(0, 50)}..."`)
              console.log(`     Topic: ${topicId}`)
              console.log(`     Reason: ${ceilingCheck.reason}`)
              console.log(`     Metrics: ${JSON.stringify(ceilingCheck.metrics)}`)
              console.log(`     Recommendation: SKIP for long-form (has ceiling)`)
            } else {
              // Log when topic is checked but no ceiling (for debugging)
              if (recommendations.recommended.indexOf(rec) < 3) {
                console.log(`  ✓ Topic ${topicId} checked - no ceiling (viral_potential: ${ceilingCheck.viral_potential || 'UNKNOWN'})`)
              }
            }
          } else {
            if (recommendations.recommended.indexOf(rec) < 3) {
              console.log(`  ⚠️  No topic ID for ceiling check: "${(rec.recommended?.title_ar || rec.summary?.title || 'No title').substring(0, 40)}..."`)
            }
          }
          
          // Apply priority filter (MEDIUM for testing - allows HIGH and MEDIUM)
          if (priorityFilter === 'HIGH' && rec.priority !== 'HIGH') {
            if (itemsChecked <= 5) {
              console.log(`  ⏭️  [${itemsChecked}] Priority filter: ${rec.priority} < ${priorityFilter}, skipping`)
            }
            continue
          } else if (priorityFilter === 'MEDIUM' && rec.priority === 'LOW') {
            if (itemsChecked <= 5) {
              console.log(`  ⏭️  [${itemsChecked}] Priority filter: ${rec.priority} < ${priorityFilter}, skipping`)
            }
            continue
          }
          itemsPassedPriority++;
          
          // Apply minimum score threshold (lowered for testing)
          const score = rec.recommended?.score || rec.filter?.final_score || rec.filter_score || rec.summary?.confidence || 0
          // Lower threshold since scores are very low
          const testMinScore = Math.min(minScore || 30, 30)  // Lowered to 30 for testing
          if (score < testMinScore) {
            if (itemsChecked <= 10) {
              console.log(`  → [${itemsChecked}] Below score threshold (${score.toFixed(1)} < ${testMinScore}): "${(rec.recommended?.title_ar || rec.summary?.title || 'No title').substring(0, 40)}..."`)
              console.log(`     Priority: ${rec.priority}, Topic: ${rec.topic}, Filter score: ${rec.filter_score}`)
            }
            continue
          }
          itemsPassedScore++;
          
          // ===== ENHANCED DNA: HOOK PATTERN MATCHING =====
          const hookAnalysis = findBestHookPattern(rec.original || rec.item || { title: rec.recommended?.title_ar || '', description: '' });
          if (hookAnalysis.best_pattern) {
            rec.hook_pattern = {
              name: hookAnalysis.best_pattern.name,
              expected_retention: hookAnalysis.best_pattern.expected_retention,
              match_score: hookAnalysis.best_pattern.match_score,
              template: hookAnalysis.hook_template
            };
          }
          
          // ===== ENHANCED DNA: SHORTS ANALYSIS =====
          if (rec.topic) {
            const shortsPrediction = predictShortsSuccess(rec.original || rec.item, rec.topic, 60); // Default 60s
            const shortsGates = applyShortsGates(rec.original || rec.item, rec.topic, 60);
            rec.shorts_analysis = {
              predicted_success: shortsPrediction.predicted_success,
              predicted_views: shortsPrediction.predicted_views,
              predicted_viewed_pct: shortsPrediction.predicted_viewed_pct,
              score: shortsPrediction.score,
              factors: shortsPrediction.factors,
              warnings: shortsPrediction.warnings,
              recommendations: shortsPrediction.recommendations,
              gates: shortsGates
            };
          }
          
          // Log first few that pass (with enhanced DNA info)
          if (recommendations.recommended.indexOf(rec) < 5) {
            console.log(`  ✅ PASSED: Score ${score.toFixed(1)} >= ${testMinScore}, Priority: ${rec.priority}, Topic: ${rec.topic}`)
            if (rec.ceiling_detected) {
              console.log(`     ⛔ CEILING TOPIC - Skip long-form`)
            }
            if (rec.hook_pattern) {
              console.log(`     🎣 Hook Pattern: ${rec.hook_pattern.name} (${rec.hook_pattern.expected_retention}% retention)`)
            }
            if (rec.shorts_analysis) {
              const sa = rec.shorts_analysis;
              console.log(`     📱 Shorts: ${sa.predicted_success} success (${sa.predicted_views} views, ${sa.predicted_viewed_pct}% viewed)`)
              if (sa.predicted_success === 'HIGH') {
                console.log(`     ⚡ PRIORITY: Make shorts! This topic goes VIRAL`)
              }
            }
            if (rec.behavior_analysis) {
              const ba = rec.behavior_analysis;
              console.log(`     🎯 Behavior Score: ${ba.score}/100 (${ba.prediction}, ${ba.expected_views} views)`)
              if (ba.score < 50 && rec.behavior_optimized_angle) {
                console.log(`     💡 Optimized Angle: "${rec.behavior_optimized_angle.optimized.substring(0, 50)}..."`)
              }
            }
          }

          try {
            const item = rec.original
            const score = rec.recommended?.score || rec.filter?.final_score || rec.summary?.confidence || 0
            
            // Track score statistics
            sourceScoreStats.min = Math.min(sourceScoreStats.min, score)
            sourceScoreStats.max = Math.max(sourceScoreStats.max, score)
            sourceScoreStats.sum += score
            sourceScoreStats.count++
            
            scoreStats.min = Math.min(scoreStats.min, score)
            scoreStats.max = Math.max(scoreStats.max, score)
            scoreStats.sum += score
            scoreStats.count++

            // Log first few recommendations
            if (recommendations.recommended.indexOf(rec) < 5) {
              const title = rec.recommended?.title_ar || rec.summary?.title || 'No title'
              const angleType = rec.recommended?.type || 'unknown'
              console.log(`✅ Recommended: "${title.substring(0, 50)}..." | Priority: ${rec.priority} | Score: ${score.toFixed(1)} | Angle: ${angleType} | Topic: ${rec.topic || 'N/A'}`)
              if (rec.angle_options && rec.angle_options.length > 1) {
                console.log(`   📋 ${rec.angle_options.length} angle options available`)
              }
            }
            
            // Use recommended title (from smart pipeline) or fallback to original
            const itemTitle = rec.recommended?.title_ar || rec.summary?.title || item.title || ''
            if (!itemTitle.trim()) {
              console.warn(`  → Skipping item with empty title`)
              continue
            }
            
            // Try to find existing signal (dedupe by title)
            const { data: existing, error: checkError } = await db
              .from('signals')
              .select('id')
              .eq('show_id', showId)
              .eq('title', itemTitle)
              .limit(1)
              .maybeSingle()

            if (checkError) {
              console.error('❌ Error checking for existing signal:', checkError)
            }

            if (existing) {
              if (recommendations.recommended.indexOf(rec) < 3) {
                console.log(`  → Item already exists, skipping: "${itemTitle.substring(0, 40)}..."`)
              }
            } else {
              // Insert new signal with smart recommendation data
              const signalType = rec.topic ? 'trend' : 'news'
              
              // Calculate hook_potential (0-10 scale) before creating signalData object
              // hook_potential should be 0-10 scale, not the score (0-100)
              // Use hook pattern match score (0-100) converted to 0-10, or behavior score / 10
              // If neither available, use filter_score / 10 as fallback
              let hookPotentialValue = 0;
              if (rec.hook_pattern?.match_score) {
                // Hook pattern match score is 0-100, convert to 0-10
                hookPotentialValue = Math.min(10, Math.max(0, rec.hook_pattern.match_score / 10));
                if (recommendations.recommended.indexOf(rec) < 3) {
                  console.log(`  🎣 Hook Potential (Engine): ${rec.hook_pattern.match_score}/100 → ${hookPotentialValue.toFixed(1)}/10 (from hook pattern)`);
                }
              } else if (rec.behavior_analysis?.score) {
                // Behavior score is 0-100, convert to 0-10
                hookPotentialValue = Math.min(10, Math.max(0, rec.behavior_analysis.score / 10));
                if (recommendations.recommended.indexOf(rec) < 3) {
                  console.log(`  🎯 Hook Potential (Engine): ${rec.behavior_analysis.score}/100 → ${hookPotentialValue.toFixed(1)}/10 (from behavior)`);
                }
              } else if (rec.filter_score) {
                // Filter score is 0-100, convert to 0-10
                hookPotentialValue = Math.min(10, Math.max(0, rec.filter_score / 10));
                if (recommendations.recommended.indexOf(rec) < 3) {
                  console.log(`  📊 Hook Potential (Engine): ${rec.filter_score}/100 → ${hookPotentialValue.toFixed(1)}/10 (from filter score)`);
                }
              } else {
                if (recommendations.recommended.indexOf(rec) < 3) {
                  console.log(`  ⚠️  Hook Potential (Engine): 0/10 (no data available)`);
                }
              }
              
              const signalData = {
                show_id: showId,
                source_id: null,
                title: itemTitle,  // Use smart story-based title
                description: (item.description || '').toString().trim(),
                url: (item.link || item.url || '').toString().trim(),
                type: signalType,
                score: Math.round(score),  // Use confidence score (0-100)
                hook_potential: String(hookPotentialValue.toFixed(1)),
                raw_data: {
                  rssItem: item,
                  recommendation: {
                    priority: rec.priority,
                    topic: rec.topic,
                    hook_type: rec.hook_type,
                    format: rec.format,
                    confidence: rec.filter_score,
                    story: rec.story,  // Story elements
                    angle_options: rec.angle_options,  // Multiple angle options
                    recommended: rec.recommended,  // Final recommended title
                    classification: rec.classification || {},
                    decisions: rec.decisions || {},
                    triggers: rec.triggers || [],
                    timing_format: rec.timing_format || {},  // Timing + format decisions
                    // Enhanced DNA data
                    ceiling_detected: rec.ceiling_detected || false,
                    ceiling_reason: rec.ceiling_reason || null,
                    hook_pattern: rec.hook_pattern || null,  // Hook pattern match
                    shorts_analysis: rec.shorts_analysis || null,  // Shorts success prediction
                    behavior_analysis: rec.behavior_analysis || null,  // Behavior-based scoring
                    behavior_optimized_angle: rec.behavior_optimized_angle || null  // Optimized angle if low score
                  },
                  sourceName: source.name,
                  sourceId: source.id,
                  topicId: rec.topic,
                },
                status: 'new',
                detected_at: new Date().toISOString(),
              }

              const { data: insertedSignal, error: insertError } = await db
                .from('signals')
                .insert(signalData)
                .select()
                .single()

              if (insertError) {
                console.error(`❌ Error inserting signal:`, insertError)
                console.error(`  Item title: ${itemTitle.substring(0, 50)}...`)
                console.error(`  Error code: ${insertError.code}`)
                console.error(`  Error message: ${insertError.message}`)
              } else {
                totalSaved++
                sourceScoreStats.saved++
                results.push({
                  title: itemTitle,
                  score: score,
                  topicId: rec.topic,
                  priority: rec.priority,
                  recommended_title: rec.recommended?.title_ar || itemTitle,
                  angle_type: rec.recommended?.type,
                  angle_options_count: rec.angle_options?.length || 0
                })
                
                if (totalSaved <= 5) {
                  console.log(`  ✅ Saved: "${itemTitle.substring(0, 40)}..." (Priority: ${rec.priority}, Score: ${score.toFixed(1)})`)
                }
              }
            }
          } catch (itemError) {
            console.error(`Error processing recommended item:`, itemError)
            continue
          }
        }
      } else {
        // Fallback to old scoring method if recommendation engine is not available
        // TESTING: Temporarily bypass strict gates in fallback to see if items can be saved
        console.log(`⚠️  Using old scoring method (recommendation engine not available or no recommendations)`)
        console.log(`   🧪 TEST MODE: Bypassing strict gates in fallback path to test scoring`)
        
        // TEMPORARILY DISABLED: Apply strict gates to fallback items too
        // This was filtering out all items before they could be scored
        const BYPASS_STRICT_GATES_IN_FALLBACK = true;  // Set to false to re-enable strict gates
        
        if (showDna && !BYPASS_STRICT_GATES_IN_FALLBACK) {
          try {
            const { strictFilter, getFilterSummary } = await import('@/lib/filters/strictPipeline.js');
            const fallbackMinScore = Math.min(minScore || 50, 50)  // Lowered to 50 for testing
            const filtered = await strictFilter(rssItems, showDna, { maxResults: 20, minScore: fallbackMinScore });
            
            console.log(`🎯 STRICT GATES (Fallback): ${filtered.stats.total} → ${filtered.stats.final} items`);
            console.log(`   Using minScore: ${fallbackMinScore}, maxResults: 20`);
            const summary = getFilterSummary(filtered);
            summary.funnel.forEach(f => {
              console.log(`   ${f.gate}: ${f.passed} passed, ${f.rejected} rejected`);
            });
            
            // Only process items that passed strict gates
            rssItems = filtered.passed.map(r => r.item);
            
            console.log(`   📊 After strict gates: ${rssItems.length} items to process (from ${filtered.stats.total} total)`);
            if (rssItems.length === 0) {
              console.log(`   ⚠️  No items passed strict gates in fallback mode`);
              console.log(`   💡 This means all items were rejected by quality gates`);
              continue; // Skip this feed
            }
          } catch (gateError) {
            console.error(`❌ Error applying strict gates in fallback:`, gateError);
            // Continue with old scoring but with higher threshold
          }
        } else {
          console.log(`   ⚠️  Strict gates ${showDna ? 'bypassed' : 'skipped (no DNA)'} - processing all ${rssItems.length} items with old scoring`)
        }
        
        for (const item of rssItems) {
          try {
            const scoring = scoreRssItemAgainstDna(item, dnaTopics)
            
            // Ensure score is a valid number
            const score = Number(scoring?.score) || 0
            if (isNaN(score) || !isFinite(score)) {
              console.warn(`Invalid score for item: "${(item?.title || '').toString().substring(0, 50)}..." - skipping`)
              continue
            }
          
          // Track score statistics (both per-source and overall)
          sourceScoreStats.min = Math.min(sourceScoreStats.min, score)
          sourceScoreStats.max = Math.max(sourceScoreStats.max, score)
          sourceScoreStats.sum += score
          sourceScoreStats.count++
          
          scoreStats.min = Math.min(scoreStats.min, score)
          scoreStats.max = Math.max(scoreStats.max, score)
          scoreStats.sum += score
          scoreStats.count++

          // Log scoring for debugging (first 5 items)
          if (rssItems.indexOf(item) < 5) {
            console.log(`Item: "${item.title.substring(0, 50)}..." | Score: ${score} | Topic: ${scoring.topicId} | DNA Match: ${scoring.dnaMatchScore} | Recency: ${scoring.recency} | Quality: ${scoring.contentQuality}`)
          }
          
          // Convert old 0-10 scale to 0-100 scale for comparison
          let score100 = score * 10  // Convert 0-10 to 0-100
          
          // Add behavior score boost to old scoring
          let behaviorBoost = 0;
          try {
            const behaviorAnalysis = analyzeItemBehaviors(item);
            const behaviorScore = behaviorAnalysis.behavior_analysis.score;
            // Boost old score by 20% of behavior score (max +20 points)
            behaviorBoost = Math.min(20, behaviorScore * 0.2);
            score100 = score100 + behaviorBoost;  // Use boosted score
            
            if (rssItems.indexOf(item) < 3) {
              console.log(`  🎯 Behavior boost: ${behaviorScore}/100 → +${behaviorBoost.toFixed(1)} = ${score100.toFixed(1)}/100`);
            }
          } catch (behaviorError) {
            // If behavior analysis fails, use original score (no boost)
            if (rssItems.indexOf(item) < 3) {
              console.log(`  ⚠️  Behavior analysis failed: ${behaviorError.message}`);
            }
          }
          
          // Lower threshold for testing - scores are very low (0.90-9.50 avg 4.39)
          // This suggests old scoring is being used, so we need to be more lenient
          const SCORE_THRESHOLD = 30  // 3.0/10 = 30/100 (lowered to allow more items through for testing)
          
          // Log first few items for debugging
          if (rssItems.indexOf(item) < 5) {
            console.log(`  🔍 Checking: "${item.title.substring(0, 50)}..." | Score: ${score} (${score100.toFixed(1)}/100) | Threshold: ${SCORE_THRESHOLD}`)
          }
          
          if (score100 >= SCORE_THRESHOLD) {
            // Validate required fields first
            const itemTitle = (item.title || '').toString().trim()
            if (!itemTitle) {
              console.warn(`  → Skipping item with empty title`)
              continue
            }
            
            // Try to find existing signal (dedupe by title)
            const { data: existing, error: checkError } = await db
              .from('signals')
              .select('id')
              .eq('show_id', showId)
              .eq('title', itemTitle)
              .limit(1)
              .maybeSingle()

            if (checkError) {
              console.error('❌ Error checking for existing signal:', checkError)
            }

            if (existing) {
              if (rssItems.indexOf(item) < 5) {
                console.log(`  ⏭️  Item already exists, skipping: "${itemTitle.substring(0, 40)}..."`)
              }
              sourceScoreStats.saved++  // Count as "processed" even if skipped
              } else {
              // Insert new signal - matching actual table structure
              const signalType = (scoring.topicId && scoring.dnaMatchScore > 0.7) ? 'trend' : 'news'
              
              // Generate timing/format decisions for fallback path
              let timingFormatDecisions = null;
              let ceilingDetected = false;
              let ceilingReason = null;
              let hookPatternData = null;
              let behaviorAnalysisData = null;
              
              if (showDna) {
                try {
                  const classification = classifyItem(item);
                  const content = `${item.title || ''} ${item.description || ''}`;
                  const storyType = detectStoryType(content);
                  timingFormatDecisions = makeDecisions(item, storyType, classification.classification, showDna);
                  
                  // Enhanced DNA: Ceiling detection
                  const topicId = classification.classification?.topic?.primary_topic;
                  if (topicId) {
                    const ceilingCheck = gate_CeilingDetection(topicId);
                    if (ceilingCheck.has_ceiling) {
                      ceilingDetected = true;
                      ceilingReason = ceilingCheck.reason;
                      if (rssItems.indexOf(item) < 3) {
                        console.log(`  ⛔ CEILING TOPIC (Fallback): "${itemTitle.substring(0, 40)}..." - ${ceilingReason}`);
                      }
                    }
                  }
                  
                  // Enhanced DNA: Hook pattern matching
                  const hookAnalysis = findBestHookPattern(item);
                  if (hookAnalysis.best_pattern) {
                    hookPatternData = {
                      name: hookAnalysis.best_pattern.name,
                      expected_retention: hookAnalysis.best_pattern.expected_retention,
                      match_score: hookAnalysis.best_pattern.match_score,
                      template: hookAnalysis.hook_template
                    };
                    if (rssItems.indexOf(item) < 3) {
                      console.log(`  🎣 Hook Pattern (Fallback): ${hookPatternData.name} (${hookPatternData.expected_retention}% retention)`);
                    }
                  }
                  
                  // Behavior analysis
                  try {
                    behaviorAnalysisData = analyzeItemBehaviors(item);
                  } catch (behaviorError) {
                    // Behavior analysis failed, continue without it
                  }
                  
                  // Enhanced DNA: Shorts analysis
                  let shortsAnalysisData = null;
                  if (topicId) {
                    const shortsPrediction = predictShortsSuccess(item, topicId, 60);
                    const shortsGates = applyShortsGates(item, topicId, 60);
                    shortsAnalysisData = {
                      predicted_success: shortsPrediction.predicted_success,
                      predicted_views: shortsPrediction.predicted_views,
                      predicted_viewed_pct: shortsPrediction.predicted_viewed_pct,
                      score: shortsPrediction.score,
                      gates: shortsGates
                    };
                    if (rssItems.indexOf(item) < 3 && shortsPrediction.predicted_success === 'HIGH') {
                      console.log(`  📱 Shorts (Fallback): ${shortsPrediction.predicted_success} success (${shortsPrediction.predicted_views} views)`);
                    }
                  }
                } catch (decisionError) {
                  console.warn('⚠️  Could not generate enhanced DNA decisions:', decisionError.message);
                }
              }
              
              // Calculate hook_potential (0-10 scale) for fallback path
              // Priority: hook pattern match_score (0-100) > behavior score (0-100) > old scoring hook_potential (0-10)
              let hookPotentialValue = 0;
              if (hookPatternData?.match_score) {
                // Hook pattern match score is 0-100, convert to 0-10
                hookPotentialValue = Math.min(10, Math.max(0, hookPatternData.match_score / 10));
                if (rssItems.indexOf(item) < 3) {
                  console.log(`  🎣 Hook Potential (Fallback): ${hookPatternData.match_score}/100 → ${hookPotentialValue.toFixed(1)}/10 (from hook pattern)`);
                }
              } else if (behaviorAnalysisData?.behavior_analysis?.score) {
                // Behavior score is 0-100, convert to 0-10
                hookPotentialValue = Math.min(10, Math.max(0, behaviorAnalysisData.behavior_analysis.score / 10));
                if (rssItems.indexOf(item) < 3) {
                  console.log(`  🎯 Hook Potential (Fallback): ${behaviorAnalysisData.behavior_analysis.score}/100 → ${hookPotentialValue.toFixed(1)}/10 (from behavior)`);
                }
              } else {
                // Fallback to old scoring hook_potential (already 0-10 scale)
                hookPotentialValue = Math.min(10, Math.max(0, Number(scoring.hook_potential) || 0));
                if (rssItems.indexOf(item) < 3) {
                  console.log(`  📊 Hook Potential (Fallback): ${scoring.hook_potential} → ${hookPotentialValue.toFixed(1)}/10 (from old scoring)`);
                }
              }
              
              const signalData = {
                show_id: showId,
                source_id: null,
                title: itemTitle,
                description: (item.description || '').toString().trim(),
                url: (item.link || '').toString().trim(),
                type: signalType,
                score: Math.round(score100),  // Use 0-100 scale
                hook_potential: String(hookPotentialValue.toFixed(1)),
                raw_data: {
                  rssItem: item,
                  scoring: scoring,
                  sourceName: source.name,
                  sourceId: source.id,
                  topicId: scoring.topicId,
                  // Add recommendation structure for consistency with recommendation engine
                  recommendation: timingFormatDecisions ? {
                    timing_format: timingFormatDecisions,
                    topic: scoring.topicId,
                    priority: timingFormatDecisions.action?.priority || 'MEDIUM',
                    filter_score: score100,
                    // Enhanced DNA data
                    ceiling_detected: ceilingDetected,
                    ceiling_reason: ceilingReason,
                    hook_pattern: hookPatternData,
                    shorts_analysis: shortsAnalysisData,
                    behavior_analysis: behaviorAnalysisData
                  } : null
                },
                status: 'new',
                detected_at: new Date().toISOString(),
              }
              
              const { data: insertedData, error: insertError } = await db
                .from('signals')
                .insert(signalData)
                .select()

              if (insertError) {
                console.error('❌ Error inserting signal:', insertError)
                console.error('   Signal data:', JSON.stringify(signalData, null, 2))
              } else if (insertedData && insertedData.length > 0) {
                totalSaved++
                sourceScoreStats.saved++
                results.push({
                  title: itemTitle,
                  score: score,
                  topicId: scoring.topicId,
                })
                console.log(`  ✅ SAVED: "${itemTitle.substring(0, 50)}..." (score: ${score.toFixed(1)} = ${score100}/100)`)
              } else {
                console.warn(`  ⚠️  Insert succeeded but no data returned for: "${itemTitle.substring(0, 40)}..."`)
              }
            }
            } else {
              // Log when item is below threshold
              if (rssItems.indexOf(item) < 3) {
                console.log(`  → Below threshold (${score100.toFixed(0)} < ${SCORE_THRESHOLD}): "${item.title.substring(0, 40)}..."`)
              }
            }
          } catch (itemError) {
            console.error(`Error processing item:`, itemError)
            continue
          }
        }
      }
      
      // Log score statistics for this source
      if (sourceScoreStats.count > 0) {
        const avgScore = (sourceScoreStats.sum / sourceScoreStats.count).toFixed(2)
        console.log(`📊 ${source.name}: Min: ${sourceScoreStats.min.toFixed(2)}, Max: ${sourceScoreStats.max.toFixed(2)}, Avg: ${avgScore}, Saved: ${sourceScoreStats.saved || 0}`)
      } else {
        console.log(`📊 ${source.name}: No items passed filters (priority: ${priorityFilter}, min score: ${minScore})`)
        feedsSkipped++
      }
    }
    
    // Final summary with selectivity info
    console.log(`\n📈 Summary:`)
    console.log(`   Processed ${feedsProcessed} feeds, skipped ${feedsSkipped} feeds with no matches`)
    console.log(`   Total items processed: ${totalProcessed}, Total saved: ${totalSaved}`)
    console.log(`   Selectivity: ${priorityFilter} priority only, min score: ${minScore}`)
    if (autoMaxFeeds && feedCount > autoMaxFeeds) {
      console.log(`   Feed selectivity: ${autoMaxFeeds} of ${feedCount} feeds processed (${((autoMaxFeeds / feedCount) * 100).toFixed(1)}%)`)
    }
    if (totalSaved >= MAX_SIGNALS_TO_SAVE) {
      console.log(`   ⚡ Early exit: Reached max signals limit (${MAX_SIGNALS_TO_SAVE})`)
    }

    return {
      success: true,
      processed: totalProcessed,
      saved: totalSaved,
      results,
      feeds_processed: feedsProcessed,
      feeds_skipped: feedsSkipped,
      feeds_total: feedCount,
      selectivity: {
        max_feeds: autoMaxFeeds,
        items_per_feed: autoItemsPerFeed,
        priority_filter: priorityFilter,
        min_score: minScore,
        feeds_selected: feedsToProcess.length,
        feeds_total: feedCount,
        early_exit: totalSaved >= MAX_SIGNALS_TO_SAVE
      },
      scoreStats: scoreStats.count > 0 ? {
        min: scoreStats.min.toFixed(2),
        max: scoreStats.max.toFixed(2),
        avg: (scoreStats.sum / scoreStats.count).toFixed(2),
      } : null,
    }
  } catch (error) {
    console.error('Error processing RSS feeds:', error)
    return {
      error: error.message,
      processed: 0,
      saved: 0,
    }
  }
}

/**
 * Process all shows or a specific show
 */
async function processAllShows() {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured', processed: 0, saved: 0 }
  }

  try {
    const { data: shows, error: showsError } = await db
      .from('shows')
      .select('id')

    if (showsError) throw showsError

    let totalProcessed = 0
    let totalSaved = 0
    const showResults = []

    for (const show of shows || []) {
      const result = await processRssFeedsForShow(show.id)
      totalProcessed += result.processed || 0
      totalSaved += result.saved || 0
      showResults.push({
        showId: show.id,
        ...result,
      })
    }

    return {
      success: true,
      totalProcessed,
      totalSaved,
      showResults,
    }
  } catch (error) {
    console.error('Error processing all shows:', error)
    return {
      error: error.message,
      processed: 0,
      saved: 0,
    }
  }
}

/**
 * API Route Handler
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const showId = searchParams.get('show_id')
  const processAll = searchParams.get('all') === 'true'
  const continuous = searchParams.get('continuous') === 'true'
  const maxFeeds = searchParams.get('max_feeds') ? parseInt(searchParams.get('max_feeds')) : null
  const itemsPerFeed = searchParams.get('items_per_feed') ? parseInt(searchParams.get('items_per_feed')) : null
  const priorityFilter = searchParams.get('priority') || 'MEDIUM'  // Changed to MEDIUM for testing (was HIGH)
  const minScore = searchParams.get('min_score') ? parseFloat(searchParams.get('min_score')) : 70

  try {
    if (continuous && showId) {
      // Continuous mode - process in a loop
      return NextResponse.json({
        message: 'Continuous mode started',
        showId,
        note: 'This endpoint will process RSS feeds continuously. Use POST /api/rss-processor/continuous for background processing.'
      })
    } else if (processAll) {
      const result = await processAllShows()
      return NextResponse.json(result)
    } else if (showId) {
      const options = {
        maxFeeds,
        itemsPerFeed,
        priorityFilter,
        minScore
      }
      const result = await processRssFeedsForShow(showId, options)
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { error: 'Please provide show_id parameter or ?all=true' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST handler for manual triggers
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const showId = body.show_id
    const processAll = body.all === true

    if (processAll) {
      const result = await processAllShows()
      return NextResponse.json(result)
    } else if (showId) {
      const result = await processRssFeedsForShow(showId)  // UUID string, not number
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { error: 'Please provide show_id in body or set all: true' },
        { status: 400 }
      )
      }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

