import { NextResponse } from 'next/server';
import { updateDNAFromVideo } from '@/lib/dna/dnaUpdater.js';
import { loadDNA, saveDNA } from '@/lib/dna/dnaStorage.js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * API Endpoint: Update DNA from new video performance data
 * POST /api/dna/update
 */
export async function POST(request) {
  try {
    const videoData = await request.json();
    
    // Validate required fields
    if (!videoData.title || !videoData.topic || typeof videoData.views !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: title, topic, views' },
        { status: 400 }
      );
    }
    
    // Load current DNA
    const currentDNA = await loadDNA();
    
    // Initialize LLM client if available
    let llmClient = null;
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      llmClient = {
        messages: {
          create: async (params) => {
            return await anthropicClient.messages.create(params);
          }
        }
      };
    }
    
    // Update with new video
    const updatedDNA = await updateDNAFromVideo(currentDNA, videoData, llmClient);
    
    // Save updated DNA
    const saved = await saveDNA(updatedDNA);
    
    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save DNA' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'DNA updated successfully',
      insights: updatedDNA.insights.recent[0] || null,
      metadata: {
        total_videos: updatedDNA.metadata.total_videos_analyzed,
        last_updated: updatedDNA.metadata.last_updated
      }
    });
  } catch (error) {
    console.error('Error updating DNA:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update DNA' },
      { status: 500 }
    );
  }
}




