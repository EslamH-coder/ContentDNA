import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeThumbnail(thumbnailUrl, videoTitle) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this YouTube thumbnail image. Return a JSON object with:
1. "thumbnail_title": Any text visible on the thumbnail (OCR), in the original language
2. "elements": Array of visual elements present (in Arabic), choose from: وجه, شعار, خريطة, علم, سهم, رسم بياني, نص, سلاح, سفينة, طائرة, نقود, مبنى, شخصية معروفة, منتج, أرقام
3. "colors": Array of 2-3 dominant colors in English (e.g., "red", "blue", "black")
4. "has_face": boolean - is there a human face prominently displayed?
5. "has_text": boolean - is there text overlay on the thumbnail?

Video title for context: "${videoTitle}"

Return ONLY valid JSON, no markdown or explanation.`
            },
            {
              type: 'image_url',
              image_url: { url: thumbnailUrl }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Parse JSON, handling potential markdown code blocks
    let parsed;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = {
        thumbnail_title: '',
        elements: [],
        colors: [],
        has_face: false,
        has_text: false
      };
    }

    return {
      success: true,
      thumbnail_title: parsed.thumbnail_title || '',
      elements: parsed.elements || [],
      colors: parsed.colors || [],
      has_face: parsed.has_face || false,
      has_text: parsed.has_text || false
    };
  } catch (error) {
    console.error('Thumbnail analysis error:', error.message);
    return {
      success: false,
      thumbnail_title: '',
      elements: [],
      colors: [],
      has_face: false,
      has_text: false,
      error: error.message
    };
  }
}

export async function batchAnalyzeThumbnails(videos, onProgress) {
  const results = [];
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    
    if (video.thumbnail_url) {
      const analysis = await analyzeThumbnail(video.thumbnail_url, video.title);
      results.push({
        video_id: video.video_id,
        ...analysis
      });
    } else {
      results.push({
        video_id: video.video_id,
        success: false,
        error: 'No thumbnail URL'
      });
    }
    
    if (onProgress) {
      onProgress(Math.round((i + 1) / videos.length * 100), i + 1, videos.length);
    }
    
    // Rate limiting - avoid hitting OpenAI limits
    await new Promise(r => setTimeout(r, 300));
  }
  
  return results;
}



