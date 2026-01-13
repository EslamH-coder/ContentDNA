import { YoutubeTranscript } from 'youtube-transcript';

export async function getTranscript(videoId) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    // Get first 15 seconds for hook
    const hookSegments = transcript.filter(t => t.offset < 15000);
    const hook = hookSegments.map(t => t.text).join(' ').trim();
    
    // Get full transcript
    const fullText = transcript.map(t => t.text).join(' ').trim();
    
    // Detect language (simple check)
    const arabicRegex = /[\u0600-\u06FF]/;
    const language = arabicRegex.test(fullText) ? 'ar' : 'en';
    
    return {
      hook: hook.substring(0, 500),
      fullText: fullText.substring(0, 50000), // Limit size
      language,
      available: true
    };
  } catch (error) {
    console.log(`No transcript for ${videoId}:`, error.message);
    return { hook: null, fullText: null, language: null, available: false };
  }
}

export async function getBatchTranscripts(videoIds, onProgress) {
  const results = [];
  
  for (let i = 0; i < videoIds.length; i++) {
    const transcript = await getTranscript(videoIds[i]);
    results.push({ videoId: videoIds[i], ...transcript });
    
    if (onProgress) {
      onProgress(Math.round((i + 1) / videoIds.length * 100));
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  
  return results;
}



