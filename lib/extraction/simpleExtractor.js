/**
 * SIMPLE DATA EXTRACTION
 * Extract key data from news item for template filling
 */

export async function extractNewsData(newsItem, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    // Fallback to manual extraction
    return manualExtract(newsItem);
  }

  const prompt = `
Extract ONLY these fields from the news. Return JSON only, no explanation:

{
  "entity": "main person/company/country name in Arabic",
  "entity_title": "full title like 'الرئيس الأمريكي دونالد ترامب'",
  "action": "main action verb in Arabic",
  "number": "main number with unit like '60%' or '115 مليون دولار'",
  "date": "date in format 'DD month YYYY' in Arabic if available",
  "category": "tariffs|tech|military|oil|trade|politics",
  "source": "news source name"
}

News:
Title: ${newsItem.title || ''}
Description: ${(newsItem.description || '').substring(0, 300)}
Source: ${newsItem.source || newsItem.link || ''}
Date: ${newsItem.dateInfo?.pubDateRaw || newsItem.pubDate || ''}
`;

  try {
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.1,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    const responseText = response.content[0].text.trim();
    
    // Clean response (remove markdown if present)
    let cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON if wrapped in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    const extracted = JSON.parse(cleaned);
    
    // Merge with manual extraction for missing fields
    const manual = manualExtract(newsItem);
    return {
      ...manual,
      ...extracted,
      // Prefer LLM extraction but use manual as fallback
      entity: extracted.entity || manual.entity,
      entity_title: extracted.entity_title || manual.entity_title,
      number: extracted.number || manual.number,
      action: extracted.action || manual.action
    };
  } catch (e) {
    console.warn('LLM extraction failed, using manual extraction:', e.message);
    return manualExtract(newsItem);
  }
}

function manualExtract(newsItem) {
  const text = ((newsItem.title || '') + ' ' + (newsItem.description || '')).toLowerCase();
  
  // Extract numbers
  let number = null;
  const numberPatterns = [
    /\$?(\d+(?:\.\d+)?)\s*(million|mln)/i,
    /\$?(\d+(?:\.\d+)?)\s*(billion|bln)/i,
    /(\d+(?:\.\d+)?)\s*%/,
    /\$(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:million|mln|billion|bln)?/i
  ];
  
  for (const pattern of numberPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1].replace(/,/g, '');
      const unit = match[2]?.toLowerCase() || '';
      if (unit.includes('million') || unit === 'mln') {
        number = `${value} مليون دولار`;
      } else if (unit.includes('billion') || unit === 'bln') {
        number = `${value} مليار دولار`;
      } else if (unit === '%' || !unit) {
        number = `${value}%`;
      }
      break;
    }
  }
  
  // Extract entity
  let entity = null;
  let entity_title = null;
  if (/trump|ترامب|ترمب/i.test(text)) {
    entity = 'ترامب';
    entity_title = 'الرئيس الأمريكي دونالد ترامب';
  } else if (/biden|بايدن/i.test(text)) {
    entity = 'بايدن';
    entity_title = 'الرئيس الأمريكي جو بايدن';
  } else if (/apple|أبل|ابل/i.test(text)) {
    entity = 'أبل';
    entity_title = 'شركة أبل الأمريكية';
  } else if (/microsoft|مايكروسوفت/i.test(text)) {
    entity = 'مايكروسوفت';
    entity_title = 'شركة مايكروسوفت';
  } else if (/tesla|تسلا/i.test(text)) {
    entity = 'تسلا';
    entity_title = 'شركة تسلا';
  } else if (/musk|ماسك/i.test(text)) {
    entity = 'ماسك';
    entity_title = 'إيلون ماسك';
  } else if (/china|الصين/i.test(text)) {
    entity = 'الصين';
    entity_title = 'الصين';
  } else if (/iran|إيران|ايران/i.test(text)) {
    entity = 'إيران';
    entity_title = 'إيران';
  } else if (/usa|america|أمريكا|امريكا/i.test(text)) {
    entity = 'أمريكا';
    entity_title = 'أمريكا';
  } else if (/russia|روسيا/i.test(text)) {
    entity = 'روسيا';
    entity_title = 'روسيا';
  }
  
  // Extract action
  let action = null;
  if (/fine|غرامة|يدفع/i.test(text)) {
    action = 'يدفع غرامة';
  } else if (/raise|رفع|يرفع/i.test(text)) {
    action = 'يرفع';
  } else if (/ban|حظر|يحظر/i.test(text)) {
    action = 'يحظر';
  } else if (/announce|أعلن|يعلن/i.test(text)) {
    action = 'يعلن';
  } else if (/invest|استثمار|يستثمر/i.test(text)) {
    action = 'يستثمر';
  }
  
  // Extract category
  let category = 'trade';
  if (/tariff|رسوم|جمرك/i.test(text)) category = 'tariffs';
  else if (/tech|technology|تقنية/i.test(text)) category = 'tech';
  else if (/military|عسكري|جيش/i.test(text)) category = 'military';
  else if (/oil|نفط/i.test(text)) category = 'oil';
  else if (/politics|سياسة/i.test(text)) category = 'politics';
  
  // Use date from newsItem if available
  let date = null;
  if (newsItem.dateInfo && newsItem.dateInfo.pubDate && newsItem.dateInfo.useInHook) {
    const d = newsItem.dateInfo.pubDate;
    const monthNames = {
      1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
      5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
      9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
    };
    date = `${d.getDate()} ${monthNames[d.getMonth() + 1]} ${d.getFullYear()}`;
  } else if (newsItem.dateForHook) {
    date = newsItem.dateForHook.replace('في ', '');
  }
  
  return {
    entity,
    entity_title,
    action,
    number,
    date,
    category,
    source: newsItem.source || null
  };
}




