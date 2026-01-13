import { NextResponse } from 'next/server'
import { supabaseAdmin as db, isSupabaseConfigured } from '@/lib/supabase'
import path from 'path'
import { promises as fs } from 'fs'

// Load DNA config file
async function loadDnaConfig() {
  const projectRoot = process.cwd()
  const configDir = path.join(projectRoot, 'scripts', 'config')
  
  let dnaConfig = null
  try {
    const dnaFile = path.join(configDir, 'channel_dna.json')
    const altDnaFile = path.join(configDir, 'show_dna_almokhbir.json')
    
    if (await fs.access(dnaFile).then(() => true).catch(() => false)) {
      const content = await fs.readFile(dnaFile, 'utf8')
      dnaConfig = JSON.parse(content)
    } else if (await fs.access(altDnaFile).then(() => true).catch(() => false)) {
      const content = await fs.readFile(altDnaFile, 'utf8')
      dnaConfig = JSON.parse(content)
    }
  } catch (error) {
    console.error('Error loading DNA config:', error)
  }
  
  return dnaConfig
}

// Calculate topic success rates from videos
function calculateTopicSuccessRates(videos) {
  const topicStats = {}
  
  console.log(`📊 Analyzing ${videos.length} videos for topics...`)
  console.log(`Sample video keys:`, videos[0] ? Object.keys(videos[0]) : 'No videos')
  console.log(`Sample video topic_id:`, videos[0]?.topic_id || 'NOT FOUND')
  
  videos.forEach((video, index) => {
    // Get topic_id from video (stored in topic_id column or raw_data)
    const topicId = video.topic_id || video.raw_data?.topic_id || 'unknown'
    
    // Debug first few videos
    if (index < 3) {
      console.log(`Video ${index + 1}: topic_id = "${topicId}" (from video.topic_id: ${video.topic_id}, raw_data: ${video.raw_data?.topic_id || 'N/A'})`)
    }
    
    if (!topicStats[topicId]) {
      topicStats[topicId] = {
        total: 0,
        overPerforming: 0,
        average: 0,
        underPerforming: 0,
        totalViews: 0,
        avgViews: 0,
      }
    }
    
    const stats = topicStats[topicId]
    stats.total++
    stats.totalViews += video.view_count || 0
    
    // Count by performance classification
    if (video.performance_classification === 'over_performing') {
      stats.overPerforming++
    } else if (video.performance_classification === 'average') {
      stats.average++
    } else if (video.performance_classification === 'under_performing') {
      stats.underPerforming++
    }
  })
  
  // Calculate success rates and averages
  console.log(`📈 Topic stats:`, Object.keys(topicStats))
  console.log(`📈 Unknown topics count:`, topicStats['unknown']?.total || 0)
  
  const topicRates = Object.entries(topicStats)
    .map(([topicId, stats]) => {
      const successRate = stats.total > 0 
        ? (stats.overPerforming / stats.total) * 100 
        : 0
      const avgViews = stats.total > 0 
        ? Math.round(stats.totalViews / stats.total) 
        : 0
      
      return {
        topicId,
        topicName: topicId.replace(/_/g, ' '),
        successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
        avgViews,
        total: stats.total,
        overPerforming: stats.overPerforming,
        average: stats.average,
        underPerforming: stats.underPerforming,
      }
    })
    .filter(t => t.topicId !== 'unknown') // Filter out unknown topics
    .sort((a, b) => b.successRate - a.successRate) // Sort by success rate
  
  console.log(`✅ Found ${topicRates.length} topics (excluding 'unknown')`)
  
  return topicRates
}

// Analyze hook patterns from videos
function analyzeHookPatterns(videos) {
  // Group videos by hook_text (first few words as pattern identifier)
  const hookGroups = {}
  
  videos
    .filter(v => v.hook_text && v.hook_text.trim())
    .forEach(video => {
      // Extract hook pattern (first 5-10 words or question mark pattern)
      const hookText = video.hook_text.trim()
      let pattern = 'Other'
      
      // Detect common hook patterns
      if (hookText.includes('؟') || hookText.includes('?')) {
        pattern = 'Question Hook'
      } else if (/^\d+/.test(hookText) || /\d+%/.test(hookText) || /\d+ مليار/.test(hookText) || /\d+ مليون/.test(hookText)) {
        pattern = 'Number-Driven Hook'
      } else if (/هل تعرف|هل تعلم|هل تعرفين/.test(hookText)) {
        pattern = 'Reveal Hook'
      } else if (/تحذير|خطر|تهديد|أزمة/.test(hookText)) {
        pattern = 'Threat Hook'
      } else if (/ماذا|كيف|لماذا/.test(hookText)) {
        pattern = 'Question Hook'
      } else {
        // Use first 3-5 words as pattern name
        const words = hookText.split(/\s+/).slice(0, 5)
        pattern = words.join(' ') + (words.length < hookText.split(/\s+/).length ? '...' : '')
      }
      
      if (!hookGroups[pattern]) {
        hookGroups[pattern] = {
          videos: [],
          totalViews: 0,
          avgViews: 0,
          overPerforming: 0,
        }
      }
      
      hookGroups[pattern].videos.push(video)
      hookGroups[pattern].totalViews += video.view_count || 0
      if (video.performance_classification === 'over_performing') {
        hookGroups[pattern].overPerforming++
      }
    })
  
  // Calculate averages and sort
  const hookPatterns = Object.entries(hookGroups)
    .map(([pattern, data]) => ({
      pattern,
      avgViews: data.videos.length > 0 
        ? Math.round(data.totalViews / data.videos.length) 
        : 0,
      count: data.videos.length,
      successRate: data.videos.length > 0
        ? Math.round((data.overPerforming / data.videos.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.avgViews - a.avgViews) // Sort by average views
  
  return hookPatterns
}

// Analyze audience behavior triggers
function analyzeAudienceTriggers(videos) {
  const triggers = {
    'High Engagement (Likes/Comments)': {
      count: 0,
      totalViews: 0,
    },
    'Over-Performing Videos': {
      count: 0,
      totalViews: 0,
    },
    'Recent Videos (Last 30 days)': {
      count: 0,
      totalViews: 0,
    },
    'Long-Form Content': {
      count: 0,
      totalViews: 0,
    },
    'Short-Form Content': {
      count: 0,
      totalViews: 0,
    },
  }
  
  const now = Date.now()
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)
  
  videos.forEach(video => {
    // High engagement
    const totalEngagement = (video.like_count || 0) + (video.comment_count || 0)
    const engagementRate = video.view_count > 0 
      ? (totalEngagement / video.view_count) * 100 
      : 0
    
    if (engagementRate > 2) { // > 2% engagement rate
      triggers['High Engagement (Likes/Comments)'].count++
      triggers['High Engagement (Likes/Comments)'].totalViews += video.view_count || 0
    }
    
    // Over-performing
    if (video.performance_classification === 'over_performing') {
      triggers['Over-Performing Videos'].count++
      triggers['Over-Performing Videos'].totalViews += video.view_count || 0
    }
    
    // Recent videos
    const publishedAt = new Date(video.published_at).getTime()
    if (publishedAt >= thirtyDaysAgo) {
      triggers['Recent Videos (Last 30 days)'].count++
      triggers['Recent Videos (Last 30 days)'].totalViews += video.view_count || 0
    }
    
    // Format-based
    if (video.format === 'long_form') {
      triggers['Long-Form Content'].count++
      triggers['Long-Form Content'].totalViews += video.view_count || 0
    } else if (video.format === 'short_form') {
      triggers['Short-Form Content'].count++
      triggers['Short-Form Content'].totalViews += video.view_count || 0
    }
  })
  
  // Calculate engagement percentages
  const totalVideos = videos.length
  const audienceTriggers = Object.entries(triggers)
    .map(([trigger, data]) => ({
      trigger,
      engagement: totalVideos > 0 
        ? Math.round((data.count / totalVideos) * 100) 
        : 0,
      count: data.count,
      avgViews: data.count > 0 
        ? Math.round(data.totalViews / data.count) 
        : 0,
    }))
    .sort((a, b) => b.engagement - a.engagement)
  
  return audienceTriggers
}

export async function POST(request) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    const { show_id: showId } = await request.json()

    if (!showId) {
      return NextResponse.json(
        { error: 'show_id is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 Recalculating DNA for show: ${showId}`)

    // Fetch all videos for this show
    const { data: videos, error: videosError } = await db
      .from('videos')
      .select('*')
      .eq('show_id', showId)
      .order('published_at', { ascending: false })

    if (videosError) {
      console.error('Error fetching videos:', videosError)
      return NextResponse.json(
        { error: 'Failed to fetch videos', details: videosError.message },
        { status: 500 }
      )
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { 
          error: 'No videos found for this show',
          message: 'Please import videos first before recalculating DNA'
        },
        { status: 400 }
      )
    }

    console.log(`📊 Analyzing ${videos.length} videos...`)

    // Calculate DNA metrics from videos
    const topicSuccessRates = calculateTopicSuccessRates(videos)
    const hookPatterns = analyzeHookPatterns(videos)
    const audienceTriggers = analyzeAudienceTriggers(videos)

    // Load DNA config to update it (optional - you might want to store in database instead)
    const dnaConfig = await loadDnaConfig()

    // Prepare DNA update summary
    const dnaUpdate = {
      show_id: showId,
      videos_analyzed: videos.length,
      topics: topicSuccessRates,
      hook_patterns: hookPatterns,
      audience_triggers: audienceTriggers,
      calculated_at: new Date().toISOString(),
    }

    console.log(`✅ DNA recalculation complete:`)
    console.log(`   - ${topicSuccessRates.length} topics analyzed`)
    console.log(`   - ${hookPatterns.length} hook patterns identified`)
    console.log(`   - ${audienceTriggers.length} audience triggers calculated`)

    // TODO: Store DNA update in database (create a dna_updates table or update shows.dna_data)
    // For now, we'll return the calculated DNA data

    return NextResponse.json({
      success: true,
      dna: dnaUpdate,
      summary: {
        videos_analyzed: videos.length,
        topics_count: topicSuccessRates.length,
        hook_patterns_count: hookPatterns.length,
        audience_triggers_count: audienceTriggers.length,
      },
    })
  } catch (error) {
    console.error('Error recalculating DNA:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to recalculate DNA',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch current DNA data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const showId = searchParams.get('show_id')

    if (!showId) {
      return NextResponse.json(
        { error: 'show_id is required' },
        { status: 400 }
      )
    }

    // Fetch videos and calculate DNA
    const { data: videos, error: videosError } = await db
      .from('videos')
      .select('*')
      .eq('show_id', showId)
      .order('published_at', { ascending: false })

    if (videosError) {
      return NextResponse.json(
        { error: 'Failed to fetch videos', details: videosError.message },
        { status: 500 }
      )
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({
        success: true,
        dna: {
          videos_analyzed: 0,
          topics: [],
          hook_patterns: [],
          audience_triggers: [],
        },
      })
    }

    const topicSuccessRates = calculateTopicSuccessRates(videos)
    const hookPatterns = analyzeHookPatterns(videos)
    const audienceTriggers = analyzeAudienceTriggers(videos)

    return NextResponse.json({
      success: true,
      dna: {
        show_id: showId,
        videos_analyzed: videos.length,
        topics: topicSuccessRates,
        hook_patterns: hookPatterns,
        audience_triggers: audienceTriggers,
      },
    })
  } catch (error) {
    console.error('Error fetching DNA data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch DNA data' },
      { status: 500 }
    )
  }
}

