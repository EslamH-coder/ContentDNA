import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Get the project root directory (cursor folder)
const PROJECT_ROOT = process.cwd()
const CONFIG_DIR = path.join(PROJECT_ROOT, 'scripts', 'config')

function loadJsonFile(filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      return null
    }
    const content = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Error loading ${filepath}:`, error)
    return null
  }
}

function analyzeDna(dnaData) {
  if (!dnaData || typeof dnaData !== 'object') {
    return null
  }

  const showName = 
    dnaData.channel_name ||
    dnaData.show_name ||
    dnaData.name ||
    dnaData.title ||
    'Not specified'

  const winningTopics = dnaData.winning_topics || []
  const losingTopics = dnaData.losing_topics || []
  const totalTopics = winningTopics.length + losingTopics.length

  const hookPerformance = dnaData.hook_performance || {}
  const hookPatternsCount = typeof hookPerformance === 'object' ? Object.keys(hookPerformance).length : 0

  return {
    showName,
    totalTopics,
    winningTopicsCount: winningTopics.length,
    losingTopicsCount: losingTopics.length,
    hookPatternsCount,
  }
}

function analyzeRssFeeds(rssData) {
  if (!rssData) {
    return null
  }

  let feeds = []
  if (Array.isArray(rssData)) {
    feeds = rssData
  } else if (typeof rssData === 'object') {
    feeds = rssData.feeds || rssData.sources || rssData.rss_feeds || []
  }

  if (!Array.isArray(feeds)) {
    return null
  }

  // Filter enabled feeds (skip placeholders and comments)
  const enabledFeeds = feeds.filter(feed => {
    if (!feed || typeof feed !== 'object') {
      return false
    }
    
    const name = feed.name || ''
    // Skip placeholder/comment entries
    if (name === 'placeholder' || name.startsWith('_comment') || feed._comment) {
      return false
    }
    
    // Check if enabled (default to true if not specified)
    return feed.enabled !== false
  })

  return {
    totalFeeds: feeds.length,
    enabledCount: enabledFeeds.length,
  }
}

export async function GET() {
  try {
    // Load DNA config
    const dnaFile = path.join(CONFIG_DIR, 'channel_dna.json')
    const altDnaFile = path.join(CONFIG_DIR, 'show_dna_almokhbir.json')
    
    let dnaData = null
    if (fs.existsSync(dnaFile)) {
      dnaData = loadJsonFile(dnaFile)
    } else if (fs.existsSync(altDnaFile)) {
      dnaData = loadJsonFile(altDnaFile)
    }

    // Load RSS feeds config
    const rssFile = path.join(CONFIG_DIR, 'rss_feeds.json')
    const rssData = fs.existsSync(rssFile) ? loadJsonFile(rssFile) : null

    // Analyze data
    const dnaSummary = analyzeDna(dnaData)
    const rssSummary = analyzeRssFeeds(rssData)

    // Build response
    const response = {
      status: 'ok',
      dna_loaded: dnaSummary !== null,
      show_name: dnaSummary?.showName || 'Not loaded',
      topics_count: dnaSummary?.totalTopics || 0,
      feeds_count: rssSummary?.totalFeeds || 0,
      feeds_enabled: rssSummary?.enabledCount || 0,
    }

    // Add additional details if available
    if (dnaSummary) {
      response.hook_patterns_count = dnaSummary.hookPatternsCount
      response.winning_topics_count = dnaSummary.winningTopicsCount
    }

    if (rssSummary) {
      response.feeds_total = rssSummary.totalFeeds
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Unknown error',
        dna_loaded: false,
        show_name: 'Error',
        topics_count: 0,
        feeds_count: 0,
        feeds_enabled: 0,
      },
      { status: 500 }
    )
  }
}

