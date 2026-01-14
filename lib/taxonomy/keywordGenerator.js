/**
 * Automatic Keyword Generator
 * Uses AI to generate keywords for topics
 */

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Generate keywords for a topic using AI
 * 
 * @param {string} topicName - Topic name (English)
 * @param {string} topicDescription - Optional topic description
 * @param {string} language - 'both', 'en', or 'ar'
 * @returns {Promise<string[]>} Array of keywords
 */
export async function generateKeywordsForTopic(topicName, topicDescription = '', language = 'both') {
  if (!openai) {
    console.warn('⚠️ OpenAI API key not configured, skipping keyword generation');
    return [];
  }

  if (!topicName || typeof topicName !== 'string') {
    console.warn('⚠️ Invalid topic name for keyword generation');
    return [];
  }

  const languageInstruction = language === 'both' 
    ? 'Include both English AND Arabic keywords (mix them in the array).'
    : language === 'ar'
    ? 'Include only Arabic keywords.'
    : 'Include only English keywords.';

  const prompt = `Generate keywords for a news/content topic.

Topic: ${topicName}
Description: ${topicDescription || 'N/A'}

Generate 15-20 relevant keywords that would help identify news articles about this topic.
Include:
- Key terms and phrases
- Related concepts
- Important entities (companies, people, organizations, countries)
- Common variations and synonyms
${languageInstruction}

Return ONLY a JSON array of strings, nothing else. No markdown, no explanation.
Example format: ["keyword1", "keyword2", "كلمة عربية", "another keyword", ...]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content || '[]';
    
    // Parse JSON, handling potential markdown code blocks
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      // Remove markdown code blocks
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Try to parse as JSON
    let keywords = [];
    try {
      keywords = JSON.parse(cleaned);
    } catch (parseError) {
      // If JSON parse fails, try to extract array from text
      const arrayMatch = cleaned.match(/\[(.*?)\]/s);
      if (arrayMatch) {
        try {
          keywords = JSON.parse(arrayMatch[0]);
        } catch (e) {
          console.warn('⚠️ Could not parse keywords from AI response:', cleaned.substring(0, 200));
          return [];
        }
      } else {
        console.warn('⚠️ No array found in AI response:', cleaned.substring(0, 200));
        return [];
      }
    }
    
    // Validate and clean keywords
    if (!Array.isArray(keywords)) {
      console.warn('⚠️ AI response is not an array:', typeof keywords);
      return [];
    }
    
    const validKeywords = keywords
      .filter(k => k && typeof k === 'string' && k.trim().length >= 2)
      .map(k => k.trim())
      .filter((k, i, arr) => arr.indexOf(k) === i); // Remove duplicates
    
    console.log(`🔑 Generated ${validKeywords.length} keywords for "${topicName}"`);
    return validKeywords;
  } catch (error) {
    console.error('❌ Error generating keywords:', error.message);
    return [];
  }
}

/**
 * Generate keywords for all topics in a show that have few keywords
 * 
 * @param {string} showId - Show ID
 * @param {Object} supabase - Optional Supabase client
 * @param {number} minKeywords - Minimum keywords threshold (default: 10)
 * @returns {Promise<Array>} Results of enrichment
 */
export async function enrichTopicsWithKeywords(showId, supabase = null, minKeywords = 10) {
  if (!showId) {
    console.warn('⚠️ No showId provided for keyword enrichment');
    return [];
  }

  // Import Supabase client if not provided
  let db = supabase;
  if (!db) {
    const { createClient } = await import('@supabase/supabase-js');
    db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  if (!db) {
    console.error('❌ Could not create Supabase client for keyword enrichment');
    return [];
  }

  try {
    // Get topics with few keywords
    const { data: topics, error } = await db
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords, description')
      .eq('show_id', showId)
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Error fetching topics:', error);
      return [];
    }
    
    if (!topics || topics.length === 0) {
      console.log('ℹ️ No topics found for enrichment');
      return [];
    }

    const results = [];
    
    for (const topic of topics) {
      const currentKeywords = Array.isArray(topic.keywords) ? topic.keywords : [];
      
      // Skip if already has enough keywords
      if (currentKeywords.length >= minKeywords) {
        console.log(`⏭️ Skipping "${topic.topic_name_en}" - already has ${currentKeywords.length} keywords`);
        continue;
      }
      
      console.log(`🔑 Generating keywords for "${topic.topic_name_en}" (currently has ${currentKeywords.length} keywords)...`);
      
      // Generate new keywords
      const newKeywords = await generateKeywordsForTopic(
        topic.topic_name_en || topic.topic_id,
        topic.description || ''
      );
      
      if (newKeywords.length === 0) {
        console.warn(`⚠️ No keywords generated for "${topic.topic_name_en}"`);
        continue;
      }
      
      // Merge with existing (avoid duplicates)
      const allKeywords = [...currentKeywords];
      for (const kw of newKeywords) {
        const kwLower = kw.toLowerCase().trim();
        const exists = allKeywords.some(existing => existing.toLowerCase().trim() === kwLower);
        if (!exists) {
          allKeywords.push(kw);
        }
      }
      
      // Limit to reasonable number (50 max)
      const mergedKeywords = allKeywords.slice(0, 50);
      
      // Update topic
      const { error: updateError } = await db
        .from('topic_definitions')
        .update({ 
          keywords: mergedKeywords,
          updated_at: new Date().toISOString()
        })
        .eq('show_id', showId)
        .eq('topic_id', topic.topic_id);
      
      if (updateError) {
        console.error(`❌ Error updating keywords for "${topic.topic_name_en}":`, updateError);
        continue;
      }
      
      const added = mergedKeywords.length - currentKeywords.length;
      results.push({
        topicId: topic.topic_id,
        topicName: topic.topic_name_en,
        before: currentKeywords.length,
        after: mergedKeywords.length,
        added: added,
        keywords: mergedKeywords.slice(currentKeywords.length) // New keywords only
      });
      
      console.log(`✅ Enriched "${topic.topic_name_en}": ${currentKeywords.length} → ${mergedKeywords.length} keywords (+${added})`);
      
      // Rate limiting (avoid hitting API limits)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    console.log(`✅ Keyword enrichment complete: ${totalAdded} keywords added across ${results.length} topics`);
    
    return results;
  } catch (error) {
    console.error('❌ Error enriching topics with keywords:', error);
    return [];
  }
}

/**
 * Generate keywords for a single topic (used during topic creation)
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {string} topicName - Topic name
 * @param {string} topicDescription - Optional description
 * @param {Object} supabase - Optional Supabase client
 * @returns {Promise<string[]>} Generated keywords
 */
export async function generateKeywordsForNewTopic(showId, topicId, topicName, topicDescription = '', supabase = null) {
  if (!showId || !topicId || !topicName) {
    console.warn('⚠️ Missing required parameters for keyword generation');
    return [];
  }

  console.log(`🔑 Generating keywords for new topic: "${topicName}" (${topicId})`);
  
  const keywords = await generateKeywordsForTopic(topicName, topicDescription);
  
  if (keywords.length > 0 && supabase) {
    // Update the topic with generated keywords
    try {
      const { error } = await supabase
        .from('topic_definitions')
        .update({ 
          keywords: keywords,
          updated_at: new Date().toISOString()
        })
        .eq('show_id', showId)
        .eq('topic_id', topicId);
      
      if (error) {
        console.error(`❌ Error saving generated keywords:`, error);
      } else {
        console.log(`✅ Saved ${keywords.length} generated keywords for "${topicName}"`);
      }
    } catch (error) {
      console.error(`❌ Exception saving keywords:`, error);
    }
  }
  
  return keywords;
}
