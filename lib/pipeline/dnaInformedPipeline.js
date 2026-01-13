import { extractNewsData } from '../extraction/simpleExtractor.js';
import { generateWithDNA } from '../llm/dnaInformedLLM.js';

/**
 * COMPLETE DNA-INFORMED PIPELINE
 * LLM has Channel DNA context → Better output
 */

export async function processNewsWithDNA(newsItem, llmClient) {
  // Step 1: Extract data
  const extractedData = await extractNewsData(newsItem, llmClient);
  
  // Step 2: Generate with DNA context
  const result = await generateWithDNA(newsItem, extractedData, llmClient);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error
    };
  }
  
  // Step 3: Return result (now includes quality info)
  return {
    success: true,
    title: result.title,
    hook: result.hook,
    used_fallback: result.used_fallback || false,
    extracted_data: extractedData,
    
    // Quality information (NEW)
    quality: result.quality || null,
    titleQuality: result.titleQuality || null,
    hookQuality: result.hookQuality || null,
    warnings: result.warnings || [],
    processing: result.processing || null,
    
    // Metadata
    metadata: {
      fallback_reason: result.rejection_reason || null,
      validation_warning: result.validation_warning || null,
      source: newsItem.source || newsItem.sourceName,
      original_title: newsItem.title
    }
  };
}

