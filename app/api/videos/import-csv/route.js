import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = supabaseAdmin

// Try to import PapaParse if available, otherwise use custom parser
let Papa = null
try {
  Papa = require('papaparse')
} catch (e) {
  console.log('PapaParse not available, using custom CSV parser')
}

// Parse CSV line
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

// Parse CSV content - handle both comma and tab-separated files
function parseCSV(content) {
  // Detect delimiter - check first line for tabs vs commas
  const firstLine = content.split('\n')[0] || ''
  const hasTabs = firstLine.includes('\t')
  const delimiter = hasTabs ? '\t' : ','
  
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedContent.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) return []

  // Parse headers
  const headerLine = lines[0]
  let headers
  if (delimiter === '\t') {
    // Tab-separated - split by tabs
    headers = headerLine.split('\t').map(h => h.toLowerCase().replace(/"/g, '').trim())
  } else {
    // Comma-separated - use existing parser
    headers = parseCSVLine(headerLine).map(h => h.toLowerCase().replace(/"/g, '').trim())
  }
  
  console.log(`Detected delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`)
  console.log(`Found ${headers.length} columns:`, headers.slice(0, 10).join(', '), headers.length > 10 ? '...' : '')
  
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    let values
    if (delimiter === '\t') {
      // Tab-separated - split by tabs
      values = lines[i].split('\t').map(v => v.replace(/^"|"$/g, '').trim())
    } else {
      // Comma-separated - use existing parser
      values = parseCSVLine(lines[i])
    }
    
    if (values.length === 0 || values.every(v => !v.trim())) continue

    const row = {}
    headers.forEach((header, index) => {
      const value = values[index] || ''
      // Remove quotes and trim
      row[header] = value.replace(/^"|"$/g, '').trim()
    })
    rows.push(row)
  }

  return rows
}

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

// Calculate median views
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

export async function POST(request) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const showId = formData.get('show_id')

    if (!file || !showId) {
      return NextResponse.json(
        { error: 'File and show_id are required' },
        { status: 400 }
      )
    }

    // Read CSV file
    const content = await file.text()
    
    // Try using PapaParse first (more robust), fallback to custom parser
    let rows = []
    if (Papa) {
      try {
        // Use PapaParse for better CSV handling
        const parseResult = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.toLowerCase().trim().replace(/"/g, ''),
          transform: (value) => value ? String(value).trim() : '',
          delimiter: '', // Auto-detect delimiter
          newline: '', // Auto-detect newline
        })
        
        if (parseResult.errors && parseResult.errors.length > 0) {
          console.warn('PapaParse warnings:', parseResult.errors.slice(0, 5))
        }
        
        rows = parseResult.data || []
        console.log(`PapaParse: Parsed ${rows.length} rows with ${Object.keys(rows[0] || {}).length} columns`)
      } catch (parseError) {
        console.warn('PapaParse failed, using custom parser:', parseError.message)
        rows = parseCSV(content)
      }
    } else {
      // Use custom parser
      rows = parseCSV(content)
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      )
    }

    // Log first row to help debug column names
    if (rows.length > 0) {
      const firstRowKeys = Object.keys(rows[0] || {})
      console.log('=== CSV PARSING DEBUG ===')
      console.log('Total columns found:', firstRowKeys.length)
      console.log('All column names:', firstRowKeys)
      console.log('First row sample (first 5 columns):')
      firstRowKeys.slice(0, 5).forEach(key => {
        const value = rows[0][key]
        console.log(`  "${key}": "${String(value).substring(0, 50)}${value.length > 50 ? '...' : ''}"`)
      })
      console.log('Looking for required columns:')
      console.log('  - title:', rows[0]['title'] ? `✓ Found: "${rows[0]['title'].substring(0, 30)}..."` : '✗ Missing')
      console.log('  - youtube url:', rows[0]['youtube url'] ? `✓ Found: "${rows[0]['youtube url'].substring(0, 50)}..."` : '✗ Missing')
      console.log('  - views:', rows[0]['views'] ? `✓ Found: "${rows[0]['views']}"` : '✗ Missing')
      console.log('  - comments:', rows[0]['comments'] ? `✓ Found: "${rows[0]['comments']}"` : '✗ Missing')
      console.log('  - likes:', rows[0]['likes'] ? `✓ Found: "${rows[0]['likes']}"` : '✗ Missing')
      console.log('  - publish date:', rows[0]['publish date'] ? `✓ Found: "${rows[0]['publish date']}"` : '✗ Missing')
      console.log('  - duration:', rows[0]['duration'] ? `✓ Found: "${rows[0]['duration']}"` : '✗ Missing')
      console.log('  - format:', rows[0]['format'] ? `✓ Found: "${rows[0]['format']}"` : '✗ Missing')
      console.log('========================')
    }

    console.log(`Parsed ${rows.length} rows from CSV`)

    // Process each row
    const imported = []
    const errors = []
    const skipped = [] // Rows skipped due to missing data (normal)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      try {
        // Map CSV columns to video data - try multiple column name variations
        // Also try with trimmed keys and case-insensitive matching
        const getValue = (variations) => {
          // First try exact matches
          for (const key of variations) {
            const value = row[key]
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return String(value).trim()
            }
          }
          // Then try case-insensitive and trimmed matches
          const rowKeys = Object.keys(row)
          for (const key of variations) {
            for (const rowKey of rowKeys) {
              if (rowKey.toLowerCase().trim() === key.toLowerCase().trim()) {
                const value = row[rowKey]
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                  return String(value).trim()
                }
              }
            }
          }
          return ''
        }

        const getNumericValue = (variations, defaultValue = 0) => {
          // First try exact matches
          for (const key of variations) {
            const value = row[key]
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              const parsed = parseInt(String(value).replace(/[^0-9]/g, ''))
              if (!isNaN(parsed) && parsed > 0) return parsed
            }
          }
          // Then try case-insensitive and trimmed matches
          const rowKeys = Object.keys(row)
          for (const key of variations) {
            for (const rowKey of rowKeys) {
              if (rowKey.toLowerCase().trim() === key.toLowerCase().trim()) {
                const value = row[rowKey]
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                  const parsed = parseInt(String(value).replace(/[^0-9]/g, ''))
                  if (!isNaN(parsed) && parsed > 0) return parsed
                }
              }
            }
          }
          return defaultValue
        }

        // Extract YouTube video ID from URL or thumbnail URL
        const extractYouTubeVideoId = (urlString) => {
          if (!urlString) return null
          
          // Try to extract from various YouTube URL formats
          const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
            /img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/,
            /([a-zA-Z0-9_-]{11})/ // Fallback: just look for 11-char video ID
          ]
          
          for (const pattern of patterns) {
            const match = urlString.match(pattern)
            if (match && match[1]) {
              return match[1]
            }
          }
          
          return null
        }
        
        // Get raw URL value
        const rawUrl = getValue([
          'youtube url', 'youtube_url', 'youtube url', 
          'url', 'link', 'video_url', 'video url', 
          'video_link', 'video link', 'Link', 'URL'
        ])
        
        // If URL looks like it contains the whole row (has commas and multiple fields), try to extract video ID
        let videoUrl = rawUrl
        if (rawUrl && rawUrl.includes(',') && rawUrl.length > 100) {
          // Likely malformed - try to extract YouTube video ID from the string
          const videoId = extractYouTubeVideoId(rawUrl)
          if (videoId) {
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`
            console.log(`Row ${i + 2}: Extracted video ID ${videoId} from malformed URL field`)
          } else {
            // If we can't extract, try to find a URL pattern in the string
            const urlPattern = /https?:\/\/[^\s,]+/g
            const urls = rawUrl.match(urlPattern)
            if (urls && urls.length > 0) {
              // Use the first URL found, but convert thumbnail URL to watch URL if needed
              const foundUrl = urls[0]
              const extractedId = extractYouTubeVideoId(foundUrl)
              if (extractedId) {
                videoUrl = `https://www.youtube.com/watch?v=${extractedId}`
                console.log(`Row ${i + 2}: Extracted video ID ${extractedId} from URL in malformed field`)
              } else {
                videoUrl = foundUrl
              }
            }
          }
        } else if (rawUrl) {
          // Normal URL - but check if it's a thumbnail URL and convert it
          const videoId = extractYouTubeVideoId(rawUrl)
          if (videoId && rawUrl.includes('img.youtube.com')) {
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`
            console.log(`Row ${i + 2}: Converted thumbnail URL to watch URL`)
          }
        }

        const video = {
          title: getValue(['title', 'name', 'video_title', 'video title', 'عنوان', 'Title']),
          url: videoUrl,
          viewCount: getNumericValue([
            'views', 'viewcount', 'view_count', 'view count', 
            'viewcounts', 'view_counts', 'Views', 'View Count'
          ]),
          likeCount: getNumericValue([
            'likes', 'likecount', 'like_count', 'like count', 
            'Like Count', 'Likes'
          ], 0),
          commentCount: getNumericValue([
            'comments', 'commentcount', 'comment_count', 'comment count', 
            'Comment Count', 'Comments'
          ], 0),
          publishedAt: getValue([
            'publish date', 'publish_date', 'publishdate',
            'publishedat', 'published_at', 'published at', 
            'date', 'published', 'publish_date', 'publish date', 
            'Date', 'Published At'
          ]),
          durationSeconds: getNumericValue([
            'duration', 'durationseconds', 'duration_seconds', 
            'duration seconds', 'Duration', 'Duration Seconds'
          ], null),
          ageDays: getNumericValue([
            'agedays', 'age_days', 'age days', 'Age Days', 'ageDays'
          ], null),
          format: (getValue([
            'format', 'Format', 'video_format', 'video format'
          ]) || 'long_form').toLowerCase(),
        }

        // Skip rows that are completely empty (normal - not an error)
        const hasAnyData = Object.values(row).some(v => v && String(v).trim() !== '')
        if (!hasAnyData) {
          skipped.push({ row: i + 2, reason: 'Completely empty row' })
          continue
        }

        // Skip rows missing required fields (normal - not an error)
        // These are expected in CSV files with incomplete data
        // Debug first few rows to see what's happening
        if (i < 5) {
          console.log(`\n=== Row ${i + 2} Debug ===`)
          console.log('Available columns:', Object.keys(row))
          console.log('Raw row values (first 5):', Object.entries(row).slice(0, 5).map(([k, v]) => `${k}: "${String(v).substring(0, 30)}"`))
          console.log('Extracted values:')
          console.log('  - title:', video.title ? `"${video.title.substring(0, 40)}"` : 'EMPTY')
          console.log('  - url:', video.url ? `"${video.url.substring(0, 50)}"` : 'EMPTY')
          console.log('  - viewCount:', video.viewCount)
          console.log('Raw column checks:')
          console.log('  - row["title"]:', row['title'] ? `"${String(row['title']).substring(0, 30)}"` : 'NOT FOUND')
          console.log('  - row["youtube url"]:', row['youtube url'] ? `"${String(row['youtube url']).substring(0, 30)}"` : 'NOT FOUND')
          console.log('  - row["views"]:', row['views'] ? `"${row['views']}"` : 'NOT FOUND')
        }
        
        if (!video.title || video.title.trim() === '') {
          skipped.push({ 
            row: i + 2, 
            reason: 'Missing title',
            debug: { 
              availableColumns: Object.keys(row).slice(0, 10),
              titleColumnValue: row['title'] || 'N/A',
              allTitleVariations: ['title', 'Title', 'TITLE'].map(k => ({ key: k, value: row[k] || 'NOT FOUND' }))
            }
          })
          continue
        }
        if (!video.url || video.url.trim() === '') {
          skipped.push({ 
            row: i + 2, 
            reason: 'Missing URL',
            debug: { 
              availableColumns: Object.keys(row).slice(0, 10),
              urlColumnValue: row['youtube url'] || row['url'] || 'N/A'
            }
          })
          continue
        }
        if (video.viewCount === 0 || isNaN(video.viewCount) || video.viewCount < 0) {
          skipped.push({ 
            row: i + 2, 
            reason: 'Missing or invalid views',
            debug: { 
              availableColumns: Object.keys(row).slice(0, 10),
              viewsColumnValue: row['views'] || 'N/A',
              parsedValue: video.viewCount
            }
          })
          continue
        }

        // Parse date - handle multiple formats
        let publishedAt = new Date().toISOString() // Default to now
        
        if (video.publishedAt && video.publishedAt.trim() !== '') {
          const dateStr = video.publishedAt.trim()
          
          // Try different date formats
          // Format 1: DD/MM/YYYY (e.g., "11/01/2025")
          const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          if (ddmmyyyy) {
            const [, day, month, year] = ddmmyyyy
            publishedAt = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).toISOString()
          }
          // Format 2: YYYY-MM-DD
          else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            publishedAt = new Date(dateStr).toISOString()
          }
          // Format 3: MM/DD/YYYY (US format)
          else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const parts = dateStr.split('/')
            publishedAt = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`).toISOString()
          }
          // Format 4: Try standard Date parsing
          else {
            const parsed = new Date(dateStr)
            if (!isNaN(parsed.getTime())) {
              publishedAt = parsed.toISOString()
            } else {
              console.warn(`Row ${i + 2}: Could not parse date "${dateStr}", using current date`)
            }
          }
        }

        // Use ageDays from CSV if available, otherwise calculate
        const ageDays = video.ageDays !== null && !isNaN(video.ageDays)
          ? Math.floor(video.ageDays)
          : Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24))

        // Determine format
        const format = video.format === 'short_form' || (video.durationSeconds && video.durationSeconds < 60)
          ? 'short_form'
          : 'long_form'

        // Calculate median and performance
        const medianViews = await calculateMedianViews(showId, format)
        const performance = classifyPerformance(video, medianViews)

        // Extract DNA-related fields from CSV BEFORE creating videoData
        // Try multiple column name variations (case-insensitive, with/without spaces)
        const getDnaValue = (variations) => {
          for (const key of variations) {
            const value = row[key]
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return String(value).trim()
            }
          }
          // Try case-insensitive and trimmed matches
          const rowKeys = Object.keys(row)
          for (const key of variations) {
            for (const rowKey of rowKeys) {
              if (rowKey.toLowerCase().trim() === key.toLowerCase().trim()) {
                const value = row[rowKey]
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                  return String(value).trim()
                }
              }
            }
          }
          return null
        }
        
        // Extract topic_id from CSV
        const topicId = getDnaValue(['topic id', 'topic_id', 'topicid', 'Topic ID', 'Topic Id'])
        
        // Extract hook_text from CSV
        const hookText = getDnaValue([
          'hook_first_15s_text', 'hook first 15s text', 'hook_first_15s', 
          'hook text', 'hook_text', 'hooktext', 'Hook Text', 'Hook First 15s Text'
        ])
        
        // Extract performance_hint from CSV
        const performanceHint = getDnaValue([
          'performance hint', 'performance_hint', 'performancehint', 
          'Performance Hint', 'Performance Hint'
        ])

        // Insert video - start with only required columns
        // Some Supabase instances may have different schemas, so we'll add optional columns conditionally
        // Try different column name variations for url
        const videoData = {
          show_id: showId,
          title: video.title,
          view_count: video.viewCount,
          format: format,
          published_at: publishedAt,
        }
        
        // Add URL - try different column name variations
        // Some databases might use 'video_url', 'youtube_url', or 'link' instead of 'url'
        if (video.url && video.url.trim() !== '') {
          videoData.url = video.url.trim()
          // Extract YouTube video ID for youtube_video_id field if it exists
          const videoIdMatch = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|img\.youtube\.com\/vi\/)([a-zA-Z0-9_-]{11})/)
          if (videoIdMatch && videoIdMatch[1]) {
            videoData.youtube_video_id = videoIdMatch[1]
          }
        }
        
        // Add optional columns only if they have valid values
        // This makes the code more resilient to schema differences
        if (video.likeCount > 0) {
          videoData.like_count = video.likeCount
        }
        if (video.commentCount > 0) {
          videoData.comment_count = video.commentCount
        }
        if (video.durationSeconds && video.durationSeconds > 0) {
          videoData.duration_seconds = video.durationSeconds
        }
        if (performance && performance !== 'unknown') {
          videoData.performance_classification = performance
        }
        if (medianViews && medianViews > 0) {
          videoData.ratio_vs_median = parseFloat((video.viewCount / medianViews).toFixed(2))
        }
        // Only include age_days if it's a valid number (some schemas may not have this column)
        if (ageDays !== null && !isNaN(ageDays) && ageDays >= 0) {
          videoData.age_days = Math.floor(ageDays)
        }
        
        // Add DNA-related fields if they exist
        if (topicId) {
          videoData.topic_id = topicId
        }
        if (hookText) {
          videoData.hook_text = hookText
        }
        if (performanceHint) {
          videoData.performance_hint = performanceHint
        }

        let insertedVideo = null
        let insertError = null
        let retryCount = 0
        const maxRetries = 3
        
        // Try inserting, removing problematic columns if we get schema errors
        while (retryCount <= maxRetries) {
          const result = await db
            .from('videos')
            .insert(videoData)
            .select()
            .single()
          
          insertError = result.error
          insertedVideo = result.data
          
          // If no error, we're done
          if (!insertError) {
            break
          }
          
          // If error is about a column not found (PGRST204), try to fix it
          if (insertError && insertError.code === 'PGRST204') {
            const errorMsg = insertError.message || ''
            let columnToFix = null
            let alternativeColumnName = null
            
            // Extract column name from error message and try alternatives
            let columnToRemove = null
            if (errorMsg.includes("'url'")) {
              columnToFix = 'url'
              // Try alternative column names
              alternativeColumnName = 'video_url'
            } else if (errorMsg.includes("'video_url'")) {
              columnToFix = 'video_url'
              alternativeColumnName = 'url'
            } else if (errorMsg.includes("'view_count'")) {
              // view_count is required - this is a critical error
              console.error(`Row ${i + 2}: CRITICAL - 'view_count' column missing from database. Please run fix_videos_table_schema.sql`)
              break // Can't continue without this required column
            } else if (errorMsg.includes("'title'")) {
              // title is required - this is a critical error
              console.error(`Row ${i + 2}: CRITICAL - 'title' column missing from database. Please run fix_videos_table_schema.sql`)
              break
            } else if (errorMsg.includes("'format'")) {
              // format is required - this is a critical error
              console.error(`Row ${i + 2}: CRITICAL - 'format' column missing from database. Please run fix_videos_table_schema.sql`)
              break
            } else if (errorMsg.includes("'published_at'")) {
              // published_at is required - this is a critical error
              console.error(`Row ${i + 2}: CRITICAL - 'published_at' column missing from database. Please run fix_videos_table_schema.sql`)
              break
            } else if (errorMsg.includes('age_days')) {
              columnToRemove = 'age_days'
            } else if (errorMsg.includes('comment_count')) {
              columnToRemove = 'comment_count'
            } else if (errorMsg.includes('like_count')) {
              columnToRemove = 'like_count'
            } else if (errorMsg.includes('duration_seconds')) {
              columnToRemove = 'duration_seconds'
            } else if (errorMsg.includes('performance_classification')) {
              columnToRemove = 'performance_classification'
            } else if (errorMsg.includes('ratio_vs_median')) {
              columnToRemove = 'ratio_vs_median'
            }
            
            // If it's a URL column issue, try renaming it to alternatives
            if (columnToFix === 'url' && videoData.url) {
              // Try different column name variations
              const urlAlternatives = ['video_url', 'youtube_url', 'link', 'video_link']
              if (retryCount < urlAlternatives.length) {
                const altName = urlAlternatives[retryCount]
                console.log(`Row ${i + 2}: 'url' column not found, trying '${altName}' instead (attempt ${retryCount + 1})`)
                videoData[altName] = videoData.url
                delete videoData.url
                retryCount++
                continue
              } else {
                // If all alternatives failed, this is a critical error
                console.error(`Row ${i + 2}: All URL column name variations failed. Database may not have a URL column.`)
                break
              }
            }
            
            // For other columns, just remove them
            if (columnToRemove && videoData.hasOwnProperty(columnToRemove)) {
              console.log(`Row ${i + 2}: ${columnToRemove} column not found, retrying without it`)
              delete videoData[columnToRemove]
              retryCount++
              continue
            }
          }
          
          // If we get here, it's a different error or we can't identify the column
          break
        }

        if (insertError) {
          // This is an actual error (database issue, not missing data)
          errors.push({ 
            row: i + 2, 
            error: insertError.message, 
            title: video.title,
            code: insertError.code
          })
        } else {
          imported.push(insertedVideo)
          
          // ✅ Extract and store DNA fields if present in CSV (update after insert if needed)
          // Note: These should already be in videoData, but we'll update them if they weren't included in the insert
          const updates = {}
          
          // Update topic_id if it wasn't included in the insert
          if (topicId && !insertedVideo.topic_id) {
            updates.topic_id = topicId
          }
          
          // Update hook_text if it wasn't included in the insert
          if (hookText && !insertedVideo.hook_text) {
            updates.hook_text = hookText
          }
          
          // Update performance_hint if it wasn't included in the insert
          if (performanceHint && !insertedVideo.performance_hint) {
            updates.performance_hint = performanceHint
          }
          
          // Apply updates if any
          if (Object.keys(updates).length > 0) {
            await db
              .from('videos')
              .update(updates)
              .eq('id', insertedVideo.id)
              .then(() => {
                console.log(`✅ Updated DNA fields for video ${insertedVideo.id}:`, Object.keys(updates))
              })
              .catch(err => {
                console.warn(`⚠️ Failed to update DNA fields for video ${insertedVideo.id}:`, err.message)
              })
          }
        }
      } catch (error) {
        // This is an actual error (parsing issue, not missing data)
        errors.push({ 
          row: i + 2, 
          error: error.message, 
          title: row.title || 'Unknown',
          type: 'processing_error'
        })
      }
    }

    // Summary statistics
    const validRows = rows.length - skipped.length
    const summary = {
      total_rows: rows.length,
      imported: imported.length,
      skipped: skipped.length, // Rows with missing data (normal)
      errors: errors.length, // Actual errors (database/parsing issues)
      valid_rows_processed: validRows,
      success_rate: validRows > 0 ? ((imported.length / validRows) * 100).toFixed(1) + '%' : '0%'
    }

    // Add parsing diagnostics to help debug
    const diagnostics = {
      totalRowsParsed: rows.length,
      columnsFound: rows.length > 0 ? Object.keys(rows[0] || {}).length : 0,
      columnNames: rows.length > 0 ? Object.keys(rows[0] || {}).slice(0, 30) : [],
      firstRowSample: rows.length > 0 ? {
        title: rows[0]['title'] || rows[0]['Title'] || rows[0]['TITLE'] || 'NOT FOUND',
        url: rows[0]['youtube url'] || rows[0]['url'] || rows[0]['URL'] || 'NOT FOUND',
        views: rows[0]['views'] || rows[0]['Views'] || rows[0]['VIEWS'] || 'NOT FOUND',
        availableKeys: Object.keys(rows[0] || {}).slice(0, 10)
      } : null,
      skippedReasons: {
        missingTitle: skipped.filter(s => s.reason === 'Missing title').length,
        missingUrl: skipped.filter(s => s.reason === 'Missing URL').length,
        missingViews: skipped.filter(s => s.reason === 'Missing or invalid views').length,
        emptyRows: skipped.filter(s => s.reason === 'Completely empty row').length
      }
    }

    // Trigger DNA recalculation after successful import (fire and forget)
    // Note: This is done asynchronously and won't block the response
    if (imported.length > 0) {
      console.log(`🔄 DNA recalculation will be triggered for show ${showId} after importing ${imported.length} videos`)
      // Note: DNA recalculation can be triggered manually via the DNA page or will happen on next page load
      // For now, we'll just log it - the user can click "Recalculate DNA" button on the DNA page
    }

    return NextResponse.json({
      success: imported.length > 0 || errors.length === 0,
      imported: imported.length,
      total: rows.length,
      skipped: skipped.length, // Normal - rows with missing data
      errors: errors.length, // Actual errors only
      summary: summary,
      diagnostics: diagnostics, // Parsing diagnostics
      skipped_samples: skipped.slice(0, 10), // First 10 skipped rows with debug info
      error_details: errors.slice(0, 10), // First 10 actual errors
      videos: imported.slice(0, 5), // First 5 imported videos
      message: imported.length > 0 
        ? `✅ Successfully imported ${imported.length} videos. ${skipped.length} rows skipped (missing data - normal). ${errors.length} actual errors. Visit the DNA page to recalculate DNA from these videos.`
        : `⚠️ No videos imported. ${skipped.length} rows skipped (missing data - normal). ${errors.length} actual errors. Check diagnostics and skipped_samples for details.`
    })
  } catch (error) {
    console.error('Error importing CSV:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

