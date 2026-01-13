import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = supabaseAdmin

// Calculate performance classification
function classifyPerformance(video, medianViews) {
  if (!medianViews || medianViews === 0) {
    return 'unknown'
  }

  const ratio = video.viewCount / medianViews

  if (ratio >= 1.5) {
    return 'over_performing'
  } else if (ratio >= 0.7) {
    return 'average'
  } else {
    return 'under_performing'
  }
}

// Calculate median views for a show's videos
async function calculateMedianViews(showId, format) {
  try {
    const { data: videos, error } = await db
      .from('videos')
      .select('view_count')
      .eq('show_id', showId)
      .eq('format', format)
      .not('view_count', 'is', null)
      .order('view_count', { ascending: true })

    if (error || !videos || videos.length === 0) {
      return null
    }

    const views = videos.map(v => v.view_count).filter(v => v > 0)
    if (views.length === 0) return null

    const sorted = views.sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  } catch (error) {
    console.error('Error calculating median:', error)
    return null
  }
}

// Update DNA based on new video performance
async function updateDNAFromVideo(showId, video) {
  // Trigger DNA recalculation after video import
  try {
    console.log(`🔄 DNA recalculation will be triggered for show ${showId} after importing video: ${video.title}`)
    // Note: DNA recalculation can be triggered manually via the DNA page or will happen on next page load
    // For now, we'll just log it - the user can click "Recalculate DNA" button on the DNA page
  } catch (error) {
    console.warn('Failed to trigger DNA recalculation (non-critical):', error)
  }
}

export async function POST(request) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    const { show_id, video } = await request.json()

    if (!show_id || !video) {
      return NextResponse.json(
        { error: 'show_id and video data are required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!video.title || !video.url || !video.viewCount) {
      return NextResponse.json(
        { error: 'title, url, and viewCount are required' },
        { status: 400 }
      )
    }

    // Parse dates
    const publishedAt = video.publishedAt 
      ? new Date(video.publishedAt).toISOString()
      : new Date().toISOString()

    // Calculate age in days
    const ageDays = Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24))

    // Determine format if not provided
    const format = video.format || (video.durationSeconds && video.durationSeconds < 60 ? 'short_form' : 'long_form')

    // Calculate median views for performance classification
    const medianViews = await calculateMedianViews(show_id, format)

    // Classify performance
    const performance = classifyPerformance(
      { viewCount: parseInt(video.viewCount) },
      medianViews
    )

    // Prepare video data
    const videoData = {
      show_id: show_id,
      title: video.title,
      url: video.url,
      view_count: parseInt(video.viewCount) || 0,
      like_count: parseInt(video.likeCount) || 0,
      comment_count: parseInt(video.commentCount) || 0,
      duration_seconds: parseInt(video.durationSeconds) || null,
      format: format,
      published_at: publishedAt,
      age_days: ageDays,
      performance_classification: performance,
      ratio_vs_median: medianViews ? (parseInt(video.viewCount) / medianViews).toFixed(2) : null,
    }

    // Insert video
    const { data: insertedVideo, error: insertError } = await db
      .from('videos')
      .insert(videoData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting video:', insertError)
      return NextResponse.json(
        { error: 'Failed to insert video', details: insertError.message },
        { status: 500 }
      )
    }

    // Trigger DNA update
    await updateDNAFromVideo(show_id, insertedVideo)

    return NextResponse.json({
      success: true,
      video: insertedVideo,
      performance: {
        classification: performance,
        ratio_vs_median: videoData.ratio_vs_median,
        median_views: medianViews,
      },
    })
  } catch (error) {
    console.error('Error importing video:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

