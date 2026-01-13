import { containsBannedPhrase, validateNeedsNumber } from './bannedPhrases.js';
import { HOOK_PATTERNS } from './channelPatterns.js';

/**
 * VALIDATE CONTENT AGAINST CHANNEL VOICE
 */

export function validateVoice(content) {
  const result = {
    valid: true,
    score: 100,
    issues: [],
    warnings: [],
    suggestions: []
  };
  
  // ============================================
  // CHECK 1: Banned Phrases (Instant Fail)
  // ============================================
  const bannedCheck = containsBannedPhrase(content);
  if (bannedCheck.hasBanned) {
    result.valid = false;
    result.score -= 50;
    result.issues.push({
      type: 'BANNED_PHRASE',
      severity: 'CRITICAL',
      message: `Contains banned phrases: ${bannedCheck.banned.join(', ')}`,
      fix: 'Remove all generic AI language'
    });
  }
  
  // ============================================
  // CHECK 2: Needs Number Validation
  // ============================================
  const numberIssues = validateNeedsNumber(content);
  if (numberIssues.length > 0) {
    result.score -= 20 * numberIssues.length;
    numberIssues.forEach(issue => {
      result.issues.push({
        type: 'MISSING_NUMBER',
        severity: 'HIGH',
        message: issue.problem,
        fix: issue.fix
      });
    });
  }
  
  // ============================================
  // CHECK 3: Has Specific Date
  // ============================================
  const hasFullDate = /في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4}/.test(content);
  
  if (!hasFullDate) {
    result.score -= 15;
    result.warnings.push({
      type: 'NO_FULL_DATE',
      message: 'Missing specific date',
      suggestion: 'Add: في [day] [month] [year]'
    });
  }
  
  // ============================================
  // CHECK 4: Has Entity with Title
  // ============================================
  const hasEntityWithTitle = /(الرئيس|رئيس الوزراء|الشركة|وزير|المدير)\s+\w+/.test(content);
  
  if (!hasEntityWithTitle) {
    result.score -= 10;
    result.warnings.push({
      type: 'NO_ENTITY_TITLE',
      message: 'Entity without title',
      suggestion: 'Add title: الرئيس ترامب, شركة أبل'
    });
  }
  
  // ============================================
  // CHECK 5: Has Credibility Marker
  // ============================================
  const hasCredibility = /(تحديداً|بحسب|على لسان|رسمياً|بالأرقام|وفقاً لـ)/.test(content);
  
  if (!hasCredibility) {
    result.score -= 10;
    result.warnings.push({
      type: 'NO_CREDIBILITY',
      message: 'Missing credibility marker',
      suggestion: 'Add: تحديداً, بحسب [source], رسمياً'
    });
  }
  
  // ============================================
  // CHECK 6: Not Generic Statement
  // ============================================
  const isGenericStatement = !/(؟|كيف|لماذا|هل|ما|من)/.test(content.substring(0, 100));
  
  if (isGenericStatement) {
    result.score -= 15;
    result.warnings.push({
      type: 'GENERIC_STATEMENT',
      message: 'Hook is a statement, not a hook',
      suggestion: 'Start with: كيف, لماذا, هل, or في [date]'
    });
  }
  
  // ============================================
  // FINAL VALIDATION
  // ============================================
  result.valid = result.issues.filter(i => i.severity === 'CRITICAL').length === 0;
  result.score = Math.max(0, result.score);
  
  // Overall status
  if (result.score >= 80) {
    result.status = 'APPROVED';
  } else if (result.score >= 60) {
    result.status = 'NEEDS_WORK';
  } else {
    result.status = 'REJECTED';
  }
  
  return result;
}

/**
 * GENERATE SUGGESTIONS TO FIX CONTENT
 */
export function suggestFixes(content, validation) {
  const fixes = [];
  
  for (const issue of validation.issues) {
    switch (issue.type) {
      case 'BANNED_PHRASE':
        fixes.push({
          action: 'REMOVE',
          what: issue.message,
          replace_with: 'Use specific facts instead of generic phrases'
        });
        break;
        
      case 'MISSING_NUMBER':
        fixes.push({
          action: 'ADD_NUMBER',
          what: issue.message,
          example: 'Add: 60%, 3.4 تريليون, 100 مليار'
        });
        break;
    }
  }
  
  for (const warning of validation.warnings) {
    switch (warning.type) {
      case 'NO_FULL_DATE':
        fixes.push({
          action: 'ADD_DATE',
          example: 'في 27 ديسمبر 2025'
        });
        break;
        
      case 'NO_ENTITY_TITLE':
        fixes.push({
          action: 'ADD_TITLE',
          example: 'الرئيس ترامب, شركة أبل, وزير المالية'
        });
        break;
        
      case 'NO_CREDIBILITY':
        fixes.push({
          action: 'ADD_CREDIBILITY',
          example: 'تحديداً, بحسب رويترز, رسمياً'
        });
        break;
    }
  }
  
  return fixes;
}

