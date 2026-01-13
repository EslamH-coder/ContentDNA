import { extractDataFromNews } from '../extraction/dataExtractor.js';
import { generateFromExtractedData } from '../generation/templateFiller.js';

/**
 * TEMPLATE-BASED PIPELINE
 * LLM extracts → Templates fill → Output
 * NO LLM creativity in title/hook generation
 */

export async function processNewsItemWithTemplates(newsItem, llmClient) {
  // ============================================
  // STEP 1: LLM EXTRACTS DATA (Only job for LLM)
  // ============================================
  const extraction = await extractDataFromNews(newsItem, llmClient);
  
  if (!extraction.success) {
    // If LLM extraction fails, try fallback extraction from existing parsers
    return {
      success: false,
      error: extraction.error,
      raw_extraction: extraction.raw,
      fallback: extraction.fallback || false
    };
  }
  
  // ============================================
  // STEP 2: ENRICH WITH RSS DATE INFO (if available)
  // ============================================
  const data = extraction.data;
  
  // Use RSS dateInfo if available (more reliable than LLM extraction)
  if (newsItem.dateInfo && newsItem.dateInfo.pubDate && newsItem.dateInfo.useInHook) {
    const pubDate = newsItem.dateInfo.pubDate;
    data.date = {
      day: pubDate.getDate(),
      month: pubDate.getMonth() + 1,
      year: pubDate.getFullYear(),
      full_string: newsItem.dateInfo.pubDateRaw || pubDate.toISOString()
    };
  }
  
  // ============================================
  // STEP 3: VALIDATE EXTRACTED DATA
  // ============================================
  
  // Must have at least entity OR number
  if (!data.entities?.length && !data.numbers?.length) {
    return {
      success: false,
      error: 'Could not extract entity or number from news',
      extracted: data
    };
  }
  
  // ============================================
  // STEP 3: FILL TEMPLATES (No LLM - just code)
  // ============================================
  const result = generateFromExtractedData(data);
  
  // ============================================
  // STEP 4: FINAL VALIDATION
  // ============================================
  // Check for any remaining placeholders
  if (result.title.includes('[') || result.hook.includes('[')) {
    return {
      success: false,
      error: 'Template has unfilled placeholders',
      result,
      extracted: data
    };
  }
  
  return {
    success: true,
    title: result.title,
    hook: result.hook,
    metadata: result.metadata,
    extracted_data: data
  };
}

// ============================================
// BATCH PROCESSING
// ============================================
export async function processNewsBatchWithTemplates(newsItems, llmClient) {
  const results = {
    successful: [],
    failed: []
  };
  
  for (const item of newsItems) {
    const result = await processNewsItemWithTemplates(item, llmClient);
    
    if (result.success) {
      results.successful.push({
        original: item,
        generated: result
      });
    } else {
      results.failed.push({
        original: item,
        error: result.error,
        details: result
      });
    }
  }
  
  return results;
}

