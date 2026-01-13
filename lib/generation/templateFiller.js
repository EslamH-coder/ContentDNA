import { 
  TITLE_TEMPLATES, 
  HOOK_TEMPLATES, 
  ENTITY_TITLES, 
  ARAB_IMPACTS,
  ARABIC_MONTHS 
} from '../templates/channelTemplates.js';

/**
 * TEMPLATE FILLER
 * Takes extracted data and fills templates - NO LLM involved
 */

// ============================================
// FORMAT DATE IN ARABIC
// ============================================
function formatArabicDate(dateObj) {
  if (!dateObj || !dateObj.day || !dateObj.month || !dateObj.year) {
    return null;
  }
  
  const month = ARABIC_MONTHS[dateObj.month];
  if (!month) return null;
  
  return `في ${dateObj.day} ${month} ${dateObj.year}`;
}

// ============================================
// GET ENTITY WITH TITLE
// ============================================
function getEntityWithTitle(entityName) {
  if (!entityName) return '[كيان]';
  
  const normalized = entityName.toLowerCase().trim();
  return ENTITY_TITLES[normalized] || entityName;
}

// ============================================
// GET ARAB IMPACT
// ============================================
function getArabImpact(topicCategory) {
  return ARAB_IMPACTS[topicCategory] || ARAB_IMPACTS['default'];
}

// ============================================
// SELECT BEST TEMPLATE
// ============================================
function selectTitleTemplate(extractedData) {
  const { date, entities, numbers, action, can_be_yes_no_question } = extractedData;
  
  // Priority 1: If has entity + action → WHY_ENTITY (best performer)
  if (entities?.length > 0 && action?.verb) {
    return TITLE_TEMPLATES.WHY_ENTITY;
  }
  
  // Priority 2: If has entity + number → ENTITY_NUMBER
  if (entities?.length > 0 && numbers?.length > 0) {
    return TITLE_TEMPLATES.ENTITY_NUMBER;
  }
  
  // Priority 3: If can be yes/no question → HOW_ENTITY
  if (entities?.length > 0) {
    return TITLE_TEMPLATES.HOW_ENTITY;
  }
  
  // Default
  return TITLE_TEMPLATES.WHY_ENTITY;
}

function selectHookTemplate(extractedData) {
  const { date, entities, numbers, source, can_be_yes_no_question, yes_no_answer } = extractedData;
  
  // Priority 1: If has date + entity → DATE_ENTITY_ACTION (best - 2.85M)
  if (date?.day && entities?.length > 0) {
    return HOOK_TEMPLATES.DATE_ENTITY_ACTION;
  }
  
  // Priority 2: If can be yes/no → QUESTION_ANSWER (2.59M)
  if (can_be_yes_no_question && yes_no_answer) {
    return HOOK_TEMPLATES.QUESTION_ANSWER;
  }
  
  // Priority 3: If has big number → NUMBER_IMPACT
  if (numbers?.length > 0) {
    return HOOK_TEMPLATES.NUMBER_IMPACT;
  }
  
  // Priority 4: If has source → NEWS_SOURCE
  if (source) {
    return HOOK_TEMPLATES.NEWS_SOURCE;
  }
  
  // Default to number impact
  return HOOK_TEMPLATES.NUMBER_IMPACT;
}

// ============================================
// FILL TITLE TEMPLATE
// ============================================
export function fillTitleTemplate(extractedData) {
  const template = selectTitleTemplate(extractedData);
  const { entities, numbers, action, topic_category } = extractedData;
  
  let title = template.template;
  
  // Get primary entity
  const primaryEntity = entities?.[0];
  const entityName = primaryEntity ? getEntityWithTitle(primaryEntity.name) : '[كيان]';
  
  // Fill template based on type
  switch (template.id) {
    case 'WHY_ENTITY':
      title = title.replace('{entity}', entityName);
      title = title.replace('{action}', action?.full || primaryEntity?.role || '[فعل]');
      break;
      
    case 'HOW_ENTITY':
      title = title.replace('{entity}', entityName);
      title = title.replace('{mechanism}', action?.full || '[آلية]');
      break;
      
    case 'ENTITY_NUMBER':
      title = title.replace('{entity}', entityName);
      title = title.replace('{action}', action?.verb || 'يعلن');
      const primaryNumber = numbers?.[0];
      const numberStr = primaryNumber ? `${primaryNumber.value}${primaryNumber.unit || ''}` : '[رقم]';
      title = title.replace('{number}', numberStr);
      title = title.replace('{question}', topic_category === 'tariffs' ? 'ماذا يعني للخليج؟' : 'لماذا؟');
      break;
      
    default:
      title = title.replace('{entity}', entityName);
      title = title.replace('{action}', action?.full || '[فعل]');
  }
  
  return {
    title,
    template_used: template.id,
    expected_views: template.views_avg
  };
}

// ============================================
// FILL HOOK TEMPLATE
// ============================================
export function fillHookTemplate(extractedData) {
  const template = selectHookTemplate(extractedData);
  const { date, entities, numbers, action, source, topic_category, can_be_yes_no_question, yes_no_answer } = extractedData;
  
  let hook = template.template;
  
  // Get primary entity with title
  const primaryEntity = entities?.[0];
  const entityWithTitle = primaryEntity ? getEntityWithTitle(primaryEntity.name) : '[كيان]';
  
  // Format date
  const arabicDate = formatArabicDate(date);
  
  // Get Arab impact
  const arabImpact = getArabImpact(topic_category);
  
  // Fill template based on type
  switch (template.id) {
    case 'DATE_ENTITY_ACTION':
      hook = hook.replace('{date}', arabicDate || '[تاريخ]');
      hook = hook.replace('{entity_with_title}', entityWithTitle);
      hook = hook.replace('{action}', action?.full || primaryEntity?.role || '[فعل]');
      hook = hook.replace('{detail}', source ? `بحسب ${source}...` : 'بحسب التقارير...');
      break;
      
    case 'QUESTION_ANSWER':
      hook = hook.replace('{question}', action?.full || '[سؤال]');
      hook = hook.replace('{answer}', yes_no_answer === 'yes' ? 'نعم' : yes_no_answer === 'no' ? 'لا' : '[إجابة]');
      hook = hook.replace('{explanation}', `${entityWithTitle} ${action?.verb || 'يستطيع'} ذلك...`);
      break;
      
    case 'NUMBER_IMPACT':
      const primaryNumber = numbers?.[0];
      const numberStr = primaryNumber ? `${primaryNumber.value}${primaryNumber.unit || ''}` : '[رقم]';
      hook = hook.replace('{number}', numberStr);
      const impactText = numbers?.[1] 
        ? `${arabImpact} ستتأثر بنسبة ${numbers[1].value}${numbers[1].unit || '%'}`
        : `${arabImpact} ستتأثر بشكل مباشر`;
      hook = hook.replace('{impact}', impactText);
      break;
      
    case 'NEWS_SOURCE':
      hook = hook.replace('{date}', arabicDate || '[تاريخ]');
      hook = hook.replace('{source}', source || '[مصدر]');
      hook = hook.replace('{surprise}', 'رسمياً');
      hook = hook.replace('{news}', action?.full || '[خبر]');
      break;
      
    default:
      // Fill any remaining placeholders
      hook = hook.replace('{date}', arabicDate || '');
      hook = hook.replace('{entity}', entityWithTitle);
      hook = hook.replace('{number}', numbers?.[0]?.value || '');
  }
  
  return {
    hook,
    template_used: template.id,
    expected_views: template.views_avg,
    expected_retention: template.retention_30s
  };
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================
export function generateFromExtractedData(extractedData) {
  const titleResult = fillTitleTemplate(extractedData);
  const hookResult = fillHookTemplate(extractedData);
  
  return {
    title: titleResult.title,
    hook: hookResult.hook,
    
    metadata: {
      title_template: titleResult.template_used,
      hook_template: hookResult.template_used,
      expected_views: Math.max(titleResult.expected_views, hookResult.expected_views),
      expected_retention: hookResult.expected_retention
    },
    
    // Data used (for debugging)
    extracted_data: extractedData
  };
}




