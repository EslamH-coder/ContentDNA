import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

// Use admin client for server-side operations
const db = supabaseAdmin

// Get the project root directory
const PROJECT_ROOT = process.cwd()
const CONFIG_DIR = path.join(PROJECT_ROOT, 'scripts', 'config')

function loadRssFeedsConfig() {
  const rssFile = path.join(CONFIG_DIR, 'rss_feeds.json')
  
  if (!fs.existsSync(rssFile)) {
    return null
  }

  try {
    const content = fs.readFileSync(rssFile, 'utf-8')
    const data = JSON.parse(content)
    
    // Extract feeds array
    const feeds = data.feeds || data.sources || data.rss_feeds || []
    
    // Filter out placeholders and disabled feeds
    return feeds.filter(feed => {
      if (!feed || typeof feed !== 'object') return false
      const name = feed.name || ''
      // Skip placeholder/comment entries
      if (name === 'placeholder' || name.startsWith('_comment') || feed._comment) {
        return false
      }
      // Only include enabled feeds (default to true)
      return feed.enabled !== false
    })
  } catch (error) {
    console.error('Error loading RSS feeds config:', error)
    return null
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

    const { show_id } = await request.json()

    if (!show_id) {
      return NextResponse.json(
        { error: 'show_id is required' },
        { status: 400 }
      )
    }

    // Load RSS feeds from config file
    const feeds = loadRssFeedsConfig()

    if (!feeds || feeds.length === 0) {
      return NextResponse.json(
        { error: 'No RSS feeds found in config file' },
        { status: 400 }
      )
    }

    console.log(`Syncing ${feeds.length} RSS feeds for show ${show_id}`)

    // Get DNA topics for this show (from signal_sources or channel_dna.json)
    let dnaTopics = []
    try {
      const { data: existingSources } = await db
        .from('signal_sources')
        .select('dna_topics')
        .eq('show_id', show_id)
        .limit(1)
        .maybeSingle()

      if (existingSources?.dna_topics) {
        dnaTopics = Array.isArray(existingSources.dna_topics) 
          ? existingSources.dna_topics 
          : []
      }
    } catch (e) {
      console.warn('Could not fetch existing DNA topics:', e)
    }

    // If no DNA topics found, try to load from channel_dna.json
    if (dnaTopics.length === 0) {
      try {
        const dnaFile = path.join(CONFIG_DIR, 'channel_dna.json')
        const altDnaFile = path.join(CONFIG_DIR, 'show_dna_almokhbir.json')
        
        let dnaData = null
        if (fs.existsSync(dnaFile)) {
          const content = fs.readFileSync(dnaFile, 'utf-8')
          dnaData = JSON.parse(content)
        } else if (fs.existsSync(altDnaFile)) {
          const content = fs.readFileSync(altDnaFile, 'utf-8')
          dnaData = JSON.parse(content)
        }

        if (dnaData?.winning_topics) {
          dnaTopics = dnaData.winning_topics.map(t => 
            typeof t === 'object' ? t.id : t
          )
        }
      } catch (e) {
        console.warn('Could not load DNA topics from config:', e)
      }
    }

    // Delete existing sources for this show
    const { error: deleteError } = await db
      .from('signal_sources')
      .delete()
      .eq('show_id', show_id)

    if (deleteError) {
      console.error('Error deleting existing sources:', deleteError)
      // Continue anyway
    }

    // Insert new sources
    const sourcesToInsert = feeds.map(feed => ({
      show_id: show_id,
      name: feed.name || 'Unnamed Feed',
      url: feed.url || '',
      enabled: feed.enabled !== false,
      item_limit: feed.item_limit || 20,
      dna_topics: dnaTopics.length > 0 ? dnaTopics : null,
    }))

    const { data: insertedSources, error: insertError } = await db
      .from('signal_sources')
      .insert(sourcesToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting sources:', insertError)
      return NextResponse.json(
        { error: 'Failed to insert RSS sources', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      synced: insertedSources.length,
      total_feeds: feeds.length,
      sources: insertedSources.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        enabled: s.enabled,
      })),
    })
  } catch (error) {
    console.error('Error syncing RSS feeds:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const showId = searchParams.get('show_id')

    if (!showId) {
      return NextResponse.json(
        { error: 'show_id parameter is required' },
        { status: 400 }
      )
    }

    // Load RSS feeds from config
    const feeds = loadRssFeedsConfig()

    if (!feeds) {
      return NextResponse.json(
        { error: 'Could not load RSS feeds config' },
        { status: 500 }
      )
    }

    // Get existing sources from database
    const { data: existingSources, error: fetchError } = await db
      .from('signal_sources')
      .select('*')
      .eq('show_id', showId)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch existing sources', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      config_feeds: feeds.length,
      database_sources: existingSources?.length || 0,
      config_feeds_list: feeds.map(f => ({ name: f.name, url: f.url, enabled: f.enabled !== false })),
      database_sources_list: existingSources || [],
    })
  } catch (error) {
    console.error('Error in GET sync-rss-feeds:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

