/**
 * RSS Quality Checker
 * Analyzes signals to identify quality issues
 * 
 * Usage:
 * import { checkRssQuality } from '@/lib/testing/rssQualityCheck';
 * await checkRssQuality(signals);
 */

export async function checkRssQuality(signals) {
  const issues = {
    aggregatorMetadata: [],
    tooShort: [],
    tooGeneric: [],
    duplicates: [],
    noStoryAngle: [],
    goodQuality: []
  };
  
  const seenTitles = new Set();
  
  for (const signal of signals) {
    const title = signal.title || '';
    
    // Check for aggregator metadata
    if (title.includes('تم العثور على') || title.match(/^\d+ news found/i)) {
      issues.aggregatorMetadata.push(title);
      continue;
    }
    
    // Check for too short
    if (title.length < 40) {
      issues.tooShort.push(title);
      continue;
    }
    
    // Check for duplicates
    const normalized = title.toLowerCase().substring(0, 50);
    if (seenTitles.has(normalized)) {
      issues.duplicates.push(title);
      continue;
    }
    seenTitles.add(normalized);
    
    // Check for generic patterns
    const genericPatterns = [
      /^explainer:/i,
      /stock (?:rises|falls) \d/i,
      /quarterly (?:earnings|results)/i,
      /يوقع اتفاقي/,
      /يستقبل|يلتقي/,
      /^\d+ (?:news|stories|articles) found/i,
      /breaking:?\s*$/i,
      /update:?\s*$/i
    ];
    
    if (genericPatterns.some(p => p.test(title))) {
      issues.noStoryAngle.push(title);
      continue;
    }
    
    // Check for too generic (very common words only)
    const genericWords = [
      'news', 'update', 'report', 'breaking', 'latest',
      'أخبار', 'تحديث', 'تقرير', 'خبر'
    ];
    
    const titleWords = title.toLowerCase().split(/\s+/);
    const genericWordCount = titleWords.filter(w => genericWords.includes(w)).length;
    if (genericWordCount >= 2 && titleWords.length <= 5) {
      issues.tooGeneric.push(title);
      continue;
    }
    
    // Good quality
    issues.goodQuality.push(title);
  }
  
  // Generate report
  const total = signals.length;
  const goodCount = issues.goodQuality.length;
  const goodPercent = total > 0 ? Math.round((goodCount / total) * 100) : 0;
  
  console.log('\n📊 RSS QUALITY REPORT');
  console.log('='.repeat(50));
  console.log(`Total signals: ${total}`);
  console.log(`Good quality: ${goodCount} (${goodPercent}%)`);
  console.log(`Aggregator metadata: ${issues.aggregatorMetadata.length}`);
  console.log(`Too short: ${issues.tooShort.length}`);
  console.log(`Duplicates: ${issues.duplicates.length}`);
  console.log(`No story angle: ${issues.noStoryAngle.length}`);
  console.log(`Too generic: ${issues.tooGeneric.length}`);
  
  if (issues.aggregatorMetadata.length > 0) {
    console.log('\n⚠️ Aggregator metadata examples:');
    issues.aggregatorMetadata.slice(0, 3).forEach(t => console.log(`   - ${t.substring(0, 60)}...`));
  }
  
  if (issues.noStoryAngle.length > 0) {
    console.log('\n⚠️ No story angle examples:');
    issues.noStoryAngle.slice(0, 3).forEach(t => console.log(`   - ${t.substring(0, 60)}...`));
  }
  
  if (issues.tooGeneric.length > 0) {
    console.log('\n⚠️ Too generic examples:');
    issues.tooGeneric.slice(0, 3).forEach(t => console.log(`   - ${t.substring(0, 60)}...`));
  }
  
  if (issues.duplicates.length > 0) {
    console.log('\n⚠️ Duplicate examples:');
    issues.duplicates.slice(0, 3).forEach(t => console.log(`   - ${t.substring(0, 60)}...`));
  }
  
  // Quality score (0-100)
  const qualityScore = total > 0 
    ? Math.round((goodCount / total) * 100)
    : 0;
  
  console.log(`\n📈 Quality Score: ${qualityScore}/100`);
  
  if (qualityScore < 50) {
    console.log('⚠️  WARNING: Low quality score! Consider improving RSS sources or filters.');
  } else if (qualityScore >= 80) {
    console.log('✅ Excellent quality score!');
  }
  
  return {
    issues,
    qualityScore,
    total,
    goodCount,
    goodPercent
  };
}

/**
 * Quick quality check for a single signal
 */
export function checkSignalQuality(signal) {
  const title = signal.title || '';
  const issues = [];
  
  // Check for aggregator metadata
  if (title.includes('تم العثور على') || title.match(/^\d+ news found/i)) {
    issues.push('aggregator_metadata');
  }
  
  // Check for too short
  if (title.length < 40) {
    issues.push('too_short');
  }
  
  // Check for generic patterns
  const genericPatterns = [
    /^explainer:/i,
    /stock (?:rises|falls) \d/i,
    /quarterly (?:earnings|results)/i,
    /يوقع اتفاقي/,
    /يستقبل|يلتقي/
  ];
  
  if (genericPatterns.some(p => p.test(title))) {
    issues.push('no_story_angle');
  }
  
  return {
    isGoodQuality: issues.length === 0,
    issues
  };
}
