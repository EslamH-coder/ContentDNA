import { NextResponse } from 'next/server';
import { buildDNAFromVideos } from '@/lib/dna/dnaBuilder.js';
import { saveDNA } from '@/lib/dna/dnaStorage.js';

// Try to import PapaParse if available
let Papa = null;
try {
  Papa = require('papaparse');
} catch (e) {
  console.log('PapaParse not available, using custom CSV parser');
}

// Simple CSV parser fallback
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length === 0 || values.every(v => !v)) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'CSV file is required' },
        { status: 400 }
      );
    }

    // Read CSV file
    const content = await file.text();

    // Parse CSV
    let rows = [];
    if (Papa) {
      try {
        const parseResult = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.toLowerCase().trim().replace(/"/g, ''),
          transform: (value) => value ? String(value).trim() : '',
        });
        
        if (parseResult.errors && parseResult.errors.length > 0) {
          console.warn('PapaParse warnings:', parseResult.errors.slice(0, 5));
        }
        
        rows = parseResult.data || [];
      } catch (parseError) {
        console.warn('PapaParse failed, using custom parser:', parseError.message);
        rows = parseCSV(content);
      }
    } else {
      rows = parseCSV(content);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }

    // Filter out empty rows
    const validVideos = rows.filter(v => v.title && v.views);

    if (validVideos.length === 0) {
      return NextResponse.json(
        { error: 'No valid videos found in CSV. Make sure CSV has "title" and "views" columns.' },
        { status: 400 }
      );
    }

    console.log(`Building DNA from ${validVideos.length} videos...`);

    // Build DNA from videos
    const dna = await buildDNAFromVideos(validVideos);

    // Save DNA
    const saved = await saveDNA(dna);

    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save DNA' },
        { status: 500 }
      );
    }

    // Prepare summary
    const topTopics = Object.entries(dna.topics)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.avg_views - a.avg_views)
      .slice(0, 10);

    const topHooks = Object.entries(dna.hooks.patterns)
      .map(([pattern, data]) => ({ 
        pattern, 
        avg_retention_30s: data.avg_retention_30s,
        avg_views: data.avg_views,
        usage_count: data.usage_count
      }))
      .sort((a, b) => parseFloat(b.avg_retention_30s || 0) - parseFloat(a.avg_retention_30s || 0))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      dna,
      topTopics,
      topHooks,
      message: `Successfully imported ${validVideos.length} videos and built DNA`,
      summary: {
        videos_imported: validVideos.length,
        topics_detected: Object.keys(dna.topics).length,
        hook_patterns: Object.keys(dna.hooks.patterns).length,
        effective_phrases: dna.hooks.effective_phrases.length,
        weak_topics: dna.banned.weak_topics.length
      }
    });

  } catch (error) {
    console.error('DNA import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import DNA' },
      { status: 500 }
    );
  }
}




