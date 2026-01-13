/**
 * LLM DATA EXTRACTION
 * LLM only extracts structured data - does NOT generate titles/hooks
 */

// ============================================
// EXTRACTION PROMPT (This is what LLM does)
// ============================================
export const EXTRACTION_PROMPT = `You are a data extraction assistant. Your ONLY job is to extract structured data from news articles.

DO NOT:
- Generate titles
- Write hooks
- Be creative
- Add commentary
- Use phrases like "هل تعلم" or "ما لا تعرفه"

ONLY extract these fields as JSON:

{
  "date": {
    "day": number or null,
    "month": number (1-12) or null,
    "year": number or null,
    "full_string": "original date string from article" or null
  },
  "entities": [
    {
      "name": "entity name",
      "type": "person|company|country|organization",
      "role": "what they did in this news"
    }
  ],
  "numbers": [
    {
      "value": "the number",
      "unit": "%|billion|million|trillion|dollar|etc",
      "context": "what this number refers to"
    }
  ],
  "action": {
    "verb": "main action verb",
    "full": "full action description"
  },
  "topic_category": "tariffs|tech|military|oil|currency|trade|politics|other",
  "source": "news source name if mentioned",
  "can_be_yes_no_question": true/false,
  "yes_no_answer": "yes|no|null"
}

Extract from this article:`;

// ============================================
// CALL LLM FOR EXTRACTION
// ============================================
export async function extractDataFromNews(newsItem, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    return {
      success: false,
      error: 'LLM client not available',
      fallback: true
    };
  }

  // Extract date from RSS item (prefer parsed dateInfo if available)
  let dateString = '';
  if (newsItem.dateInfo && newsItem.dateInfo.pubDate) {
    const d = newsItem.dateInfo.pubDate;
    dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else if (newsItem.pubDate) {
    dateString = newsItem.pubDate;
  } else if (newsItem.dateInfo?.pubDateRaw) {
    dateString = newsItem.dateInfo.pubDateRaw;
  }

  const prompt = `${EXTRACTION_PROMPT}

Title: ${newsItem.title || ''}
Description: ${newsItem.description || ''}
Source: ${newsItem.source || newsItem.link || ''}
Date: ${dateString}

Return ONLY valid JSON, no other text.`;

  try {
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.1,  // Low temperature for consistent extraction
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const responseText = response.content[0].text.trim();
    
    // Try to extract JSON from response (might have markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Parse JSON response
    const extracted = JSON.parse(jsonText);
    
    return {
      success: true,
      data: extracted
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse LLM response: ${e.message}`,
      raw: responseText || 'No response'
    };
  }
}

