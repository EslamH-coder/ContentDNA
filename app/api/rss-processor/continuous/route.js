import { NextResponse } from 'next/server'
import { processRssFeedsForShow } from '../route.js'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * Continuous RSS processing endpoint
 * Processes RSS feeds in a loop with configurable intervals
 */
export async function POST(request) {
  try {
    const { 
      show_id: showId, 
      interval_minutes = 60,
      max_feeds = 50,
      items_per_feed = 5,
      priority = 'HIGH',
      min_score = 70,
      max_iterations = null  // null = run forever
    } = await request.json()

    if (!showId) {
      return NextResponse.json(
        { error: 'show_id is required' },
        { status: 400 }
      )
    }

    const intervalMs = interval_minutes * 60 * 1000
    let iteration = 0
    const results = []

    // Start continuous processing (non-blocking)
    const processLoop = async () => {
      while (max_iterations === null || iteration < max_iterations) {
        iteration++
        const startTime = Date.now()
        
        console.log(`\n🔄 Continuous RSS Processing - Iteration ${iteration} (${new Date().toISOString()})`)
        
        try {
          const result = await processRssFeedsForShow(showId, {
            maxFeeds: max_feeds,
            itemsPerFeed: items_per_feed,
            priorityFilter: priority,
            minScore: min_score
          })
          
          results.push({
            iteration,
            timestamp: new Date().toISOString(),
            ...result
          })
          
          console.log(`✅ Iteration ${iteration} complete: ${result.saved} signals saved`)
          
        } catch (error) {
          console.error(`❌ Error in iteration ${iteration}:`, error)
          results.push({
            iteration,
            timestamp: new Date().toISOString(),
            error: error.message
          })
        }
        
        // Wait for next interval
        if (max_iterations === null || iteration < max_iterations) {
          const elapsed = Date.now() - startTime
          const waitTime = Math.max(0, intervalMs - elapsed)
          console.log(`⏳ Waiting ${(waitTime / 1000 / 60).toFixed(1)} minutes until next iteration...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
      
      console.log(`\n✅ Continuous processing completed after ${iteration} iterations`)
    }

    // Start processing in background (don't block response)
    processLoop().catch(error => {
      console.error('Fatal error in continuous processing:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Continuous RSS processing started',
      config: {
        show_id: showId,
        interval_minutes,
        max_feeds,
        items_per_feed,
        priority,
        min_score,
        max_iterations: max_iterations || 'forever'
      },
      note: 'Processing runs in background. Check server logs for progress.'
    })
  } catch (error) {
    console.error('Error starting continuous processing:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start continuous processing' },
      { status: 500 }
    )
  }
}

// GET endpoint to check status (would need a status store in production)
export async function GET(request) {
  return NextResponse.json({
    message: 'Continuous RSS processor',
    note: 'Use POST to start continuous processing',
    example: {
      method: 'POST',
      body: {
        show_id: 'uuid',
        interval_minutes: 60,
        max_feeds: 50,
        items_per_feed: 5,
        priority: 'HIGH',
        min_score: 70
      }
    }
  })
}

