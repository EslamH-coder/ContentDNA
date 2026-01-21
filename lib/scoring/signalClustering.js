/**
 * Signal Clustering Module
 * Groups signals about the same news story using hybrid approach:
 * 1. Rule-based anchor matching (FREE, fast)
 * 2. AI validation for borderline cases (low cost, accurate)
 * 
 * Rules:
 * - Must have same DNA topic
 * - Must share ≥2 high-value anchors (not just country/mechanism)
 * - Must be within time window (48h for Post Today, 72h otherwise)
 * - AI validates uncertain matches
 */

// ============================================
// ANCHOR CLASSIFICATION
// ============================================

/**
 * High-value anchors - specific enough to indicate same story
 * Having 2+ of these = strong signal of same story
 */
const HIGH_VALUE_ANCHORS = new Set([
  // Leaders (very specific - if two articles mention same leader + topic, likely same story)
  'trump', 'biden', 'putin', 'xi', 'jinping', 'netanyahu', 'macron', 'musk', 'zelensky',
  'scholz', 'sunak', 'modi', 'erdogan', 'khamenei', 'mbs', 'sisi',
  // Arabic leaders
  'ترامب', 'ترمب', 'بايدن', 'بوتين', 'شي', 'نتنياهو', 'ماكرون', 'ماسك', 'زيلينسكي',
  'أردوغان', 'خامنئي', 'السيسي',
  
  // Specific places (more than just country - indicates specific story)
  'greenland', 'taiwan', 'gaza', 'crimea', 'xinjiang', 'hong kong', 'donbas', 'kherson',
  'rafah', 'golan', 'kashmir', 'tibet',
  // Arabic places
  'غرينلاند', 'تايوان', 'غزة', 'القرم', 'شينجيانغ', 'هونغ كونغ', 'رفح', 'الجولان',
  
  // Events/Actions (indicate specific news event)
  'tariff', 'tariffs', 'sanctions', 'invasion', 'coup', 'protest', 'protests',
  'election', 'elections', 'deal', 'treaty', 'collapse', 'crisis', 'ceasefire',
  'summit', 'talks', 'agreement', 'withdrawal', 'deployment', 'strike', 'attack',
  // Arabic events
  'رسوم', 'تعريفة', 'عقوبات', 'غزو', 'انقلاب', 'احتجاج', 'احتجاجات', 'انتخابات',
  'صفقة', 'معاهدة', 'انهيار', 'أزمة', 'وقف إطلاق النار', 'قمة', 'محادثات', 'انسحاب',
  
  // Tech (specific companies/products)
  'chatgpt', 'openai', 'deepseek', 'gemini', 'claude', 'grok',
  'iphone', 'tesla', 'starlink', 'neuralink',
  // Arabic tech
  'شات جي بي تي', 'تسلا', 'ستارلينك',
  
  // Finance (specific events)
  'fed', 'rate cut', 'rate hike', 'default', 'bailout', 'ipo', 'merger', 'acquisition',
  'bankruptcy', 'stimulus',
  // Arabic finance
  'الفيدرالي', 'خفض الفائدة', 'رفع الفائدة', 'تخلف', 'إنقاذ', 'إفلاس',
  
  // Energy (specific)
  'opec', 'nord stream', 'lng', 'pipeline',
  // Arabic energy
  'أوبك', 'نورد ستريم',
  
  // Organizations (specific groups)
  'hamas', 'hezbollah', 'houthis', 'taliban', 'isis', 'wagner',
  'nato', 'brics', 'g7', 'g20', 'imf', 'who',
  // Arabic organizations
  'حماس', 'حزب الله', 'الحوثي', 'الحوثيين', 'طالبان', 'داعش', 'فاغنر',
  'الناتو', 'بريكس', 'صندوق النقد'
]);

/**
 * Country anchors - valid but need combination with high-value anchor
 * Country alone = too broad (many different stories about same country)
 */
const COUNTRY_ANCHORS = new Set([
  'iran', 'china', 'russia', 'israel', 'ukraine', 'syria', 'yemen', 'lebanon',
  'saudi', 'turkey', 'egypt', 'pakistan', 'india', 'iraq', 'afghanistan',
  'usa', 'us', 'uk', 'britain', 'germany', 'france', 'japan', 'korea',
  'venezuela', 'mexico', 'brazil', 'canada', 'australia',
  'qatar', 'uae', 'emirates', 'jordan', 'libya', 'sudan', 'morocco', 'algeria',
  // Arabic countries
  'إيران', 'ايران', 'الصين', 'روسيا', 'إسرائيل', 'اسرائيل', 'أوكرانيا', 'سوريا',
  'اليمن', 'لبنان', 'السعودية', 'تركيا', 'مصر', 'باكستان', 'الهند', 'العراق',
  'أفغانستان', 'فنزويلا', 'قطر', 'الإمارات', 'الأردن', 'ليبيا', 'السودان'
]);

/**
 * Mechanism words - TOO GENERIC, never cluster on these alone
 * These appear in many unrelated stories
 */
const MECHANISM_WORDS = new Set([
  'economy', 'economic', 'market', 'markets', 'price', 'prices', 'trade',
  'growth', 'investment', 'business', 'policy', 'government', 'military',
  'news', 'report', 'update', 'analysis', 'impact', 'effect', 'future',
  'rise', 'fall', 'surge', 'drop', 'increase', 'decrease',
  // Arabic mechanisms
  'اقتصاد', 'اقتصادي', 'سوق', 'أسواق', 'سعر', 'أسعار', 'تجارة',
  'نمو', 'استثمار', 'أعمال', 'سياسة', 'حكومة', 'عسكري',
  'تحليل', 'تأثير', 'مستقبل', 'ارتفاع', 'انخفاض'
]);

// ============================================
// ANCHOR EXTRACTION
// ============================================

/**
 * Extract anchors from signal title/content
 * Categorizes into high-value, country, and mechanism
 */
export function extractAnchors(text) {
  if (!text) return { highValue: new Set(), country: new Set(), mechanism: new Set(), all: [] };
  
  const lower = text.toLowerCase();
  const normalized = normalizeArabic(lower);
  
  const highValue = new Set();
  const country = new Set();
  const mechanism = new Set();
  
  // Check each word/phrase against anchor sets
  for (const anchor of HIGH_VALUE_ANCHORS) {
    if (normalized.includes(anchor.toLowerCase())) {
      highValue.add(anchor);
    }
  }
  
  for (const anchor of COUNTRY_ANCHORS) {
    if (normalized.includes(anchor.toLowerCase())) {
      country.add(anchor);
    }
  }
  
  for (const word of MECHANISM_WORDS) {
    if (normalized.includes(word.toLowerCase())) {
      mechanism.add(word);
    }
  }
  
  return {
    highValue,
    country,
    mechanism,
    all: [...highValue, ...country]
  };
}

/**
 * Normalize Arabic text for matching
 */
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

// ============================================
// CLUSTERING DECISION LOGIC
// ============================================

/**
 * Determine if two signals should be clustered
 * Returns decision with confidence and reason
 */
export function shouldClusterSignals(signal1, signal2, options = {}) {
  const {
    requireSameDNA = true,
    minHighValueAnchors = 2,
    timeWindowHours = 72
  } = options;
  
  // RULE 0: Must have same DNA topic (if required)
  if (requireSameDNA) {
    const dna1 = signal1.dnaMatch?.topicId || signal1.matched_topic || signal1.ai_classification?.matchedTopicId;
    const dna2 = signal2.dnaMatch?.topicId || signal2.matched_topic || signal2.ai_classification?.matchedTopicId;
    
    if (dna1 && dna2 && dna1 !== dna2) {
      return { 
        cluster: false, 
        confidence: 0,
        reason: `Different DNA topics: ${dna1} vs ${dna2}` 
      };
    }
  }
  
  // RULE 1: Check time window
  const time1 = new Date(signal1.published_at || signal1.created_at);
  const time2 = new Date(signal2.published_at || signal2.created_at);
  const hoursDiff = Math.abs(time1 - time2) / (1000 * 60 * 60);
  
  if (hoursDiff > timeWindowHours) {
    return {
      cluster: false,
      confidence: 0,
      reason: `Outside time window: ${Math.round(hoursDiff)}h apart (max ${timeWindowHours}h)`
    };
  }
  
  // Extract anchors from both signals
  const anchors1 = extractAnchors(signal1.title);
  const anchors2 = extractAnchors(signal2.title);
  
  // Find shared anchors by type
  const sharedHighValue = [...anchors1.highValue].filter(a => anchors2.highValue.has(a));
  const sharedCountry = [...anchors1.country].filter(a => anchors2.country.has(a));
  const sharedMechanism = [...anchors1.mechanism].filter(a => anchors2.mechanism.has(a));
  
  // RULE 2: ≥2 HIGH_VALUE anchors = CLUSTER (high confidence)
  if (sharedHighValue.length >= minHighValueAnchors) {
    return { 
      cluster: true, 
      confidence: 90,
      reason: `${sharedHighValue.length} high-value anchors: ${sharedHighValue.join(', ')}`,
      clusterKey: generateClusterKey(signal1, sharedHighValue),
      sharedAnchors: sharedHighValue,
      needsAIValidation: false
    };
  }
  
  // RULE 3: 1 HIGH_VALUE + 1 COUNTRY = likely same story (medium confidence)
  if (sharedHighValue.length >= 1 && sharedCountry.length >= 1) {
    return { 
      cluster: true, 
      confidence: 70,
      reason: `High-value + country: ${sharedHighValue[0]} + ${sharedCountry[0]}`,
      clusterKey: generateClusterKey(signal1, [...sharedHighValue, ...sharedCountry]),
      sharedAnchors: [...sharedHighValue, ...sharedCountry],
      needsAIValidation: true // AI should validate this
    };
  }
  
  // RULE 4: 1 HIGH_VALUE only = borderline (needs AI validation)
  if (sharedHighValue.length === 1) {
    return {
      cluster: false,
      confidence: 50,
      reason: `Only 1 high-value anchor: ${sharedHighValue[0]} - needs AI validation`,
      sharedAnchors: sharedHighValue,
      needsAIValidation: true
    };
  }
  
  // RULE 5: REJECT if ONLY mechanism overlap
  if (sharedHighValue.length === 0 && sharedCountry.length === 0 && sharedMechanism.length > 0) {
    return { 
      cluster: false, 
      confidence: 10,
      reason: `Only mechanism words: ${sharedMechanism.slice(0, 3).join(', ')}`,
      needsAIValidation: false
    };
  }
  
  // RULE 6: REJECT if ONLY country overlap
  if (sharedHighValue.length === 0 && sharedCountry.length > 0) {
    return { 
      cluster: false, 
      confidence: 30,
      reason: `Only country: ${sharedCountry.join(', ')} - likely different stories`,
      needsAIValidation: false
    };
  }
  
  return { 
    cluster: false, 
    confidence: 0,
    reason: 'Insufficient anchor overlap',
    needsAIValidation: false
  };
}

/**
 * Generate a unique cluster key from DNA topic + anchors
 */
function generateClusterKey(signal, anchors) {
  const dna = signal.dnaMatch?.topicId || signal.matched_topic || signal.ai_classification?.matchedTopicId || 'unknown';
  const sortedAnchors = [...anchors].sort().slice(0, 3).join('_');
  return `${dna}_${sortedAnchors}`.toLowerCase().replace(/\s+/g, '_');
}

// ============================================
// AI VALIDATION (for borderline cases)
// ============================================

/**
 * Use AI to validate if two signals are about the same story
 * Only called for borderline cases (confidence 50-70)
 * Uses Claude Haiku for low cost (~$0.0001 per call)
 */
export async function aiValidateCluster(signal1, signal2, sharedAnchors = []) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Are these two headlines about the SAME specific news story/event? Not just same general topic.

Headline 1: "${signal1.title}"
Headline 2: "${signal2.title}"
Shared keywords: ${sharedAnchors.join(', ')}

Answer ONLY with JSON:
{"sameStory": true/false, "confidence": 0-100, "reason": "brief explanation"}`
        }]
      })
    });

    if (!response.ok) {
      console.warn(`⚠️ AI cluster validation failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log(`   🤖 AI cluster validation: ${result.sameStory ? '✅ Same story' : '❌ Different stories'} - ${result.reason}`);
      return result;
    }
    
    return null;
  } catch (err) {
    console.warn(`⚠️ AI cluster validation error:`, err.message);
    return null;
  }
}

// ============================================
// MAIN CLUSTERING FUNCTION
// ============================================

/**
 * Group signals by story using hybrid approach
 * 
 * @param {Array} signals - Signals to cluster
 * @param {Object} options - Clustering options
 * @returns {Array} Array of cluster objects
 */
export async function groupSignalsByStoryAndDNA(signals, options = {}) {
  const {
    requireSameDNA = true,
    minHighValueAnchors = 2,
    timeWindowHours = 72,
    useAIValidation = true,
    maxAICallsPerRun = 10,
    supabase = null
  } = options;
  
  if (!signals || signals.length === 0) {
    return [];
  }
  
  console.log(`\n🔗 Clustering ${signals.length} signals...`);
  
  const clusters = [];
  const assignedSignalIds = new Set();
  let aiCallCount = 0;
  
  // Sort signals by score (best first - they become cluster anchors)
  const sortedSignals = [...signals].sort((a, b) => {
    const scoreA = a.realScore || a.score || a.final_score || 0;
    const scoreB = b.realScore || b.score || b.final_score || 0;
    return scoreB - scoreA;
  });
  
  // Check cache first (if supabase provided)
  const clusterCache = new Map();
  if (supabase) {
    try {
      const signalIds = signals.map(s => s.id).filter(Boolean);
      if (signalIds.length > 0) {
        const { data: cached } = await supabase
          .from('signal_cluster_cache')
          .select('*')
          .in('signal_id', signalIds);
        
        if (cached) {
          for (const c of cached) {
            clusterCache.set(`${c.signal_id}_${c.paired_signal_id}`, c);
            clusterCache.set(`${c.paired_signal_id}_${c.signal_id}`, c); // Bidirectional
          }
          console.log(`   💾 Loaded ${cached.length} cached cluster decisions`);
        }
      }
    } catch (cacheErr) {
      // Cache not available, continue without it
    }
  }
  
  // Process each signal
  for (let i = 0; i < sortedSignals.length; i++) {
    const signal = sortedSignals[i];
    
    if (assignedSignalIds.has(signal.id)) continue;
    
    // Start new cluster with this signal as anchor
    const cluster = {
      id: `cluster_${Date.now()}_${i}`,
      primarySignalId: signal.id,
      primarySignal: signal,
      signals: [signal],
      signalIds: [signal.id],
      dnaTopicId: signal.dnaMatch?.topicId || signal.matched_topic || signal.ai_classification?.matchedTopicId,
      anchors: [...extractAnchors(signal.title).all],
      clusterKey: null,
      confidence: 100,
      createdAt: new Date().toISOString()
    };
    
    assignedSignalIds.add(signal.id);
    
    // Find all signals that should cluster with this one
    for (let j = i + 1; j < sortedSignals.length; j++) {
      const otherSignal = sortedSignals[j];
      
      if (assignedSignalIds.has(otherSignal.id)) continue;
      
      // Check cache first
      const cacheKey = `${signal.id}_${otherSignal.id}`;
      const cachedDecision = clusterCache.get(cacheKey);
      
      let decision;
      if (cachedDecision) {
        decision = {
          cluster: cachedDecision.should_cluster,
          confidence: cachedDecision.confidence,
          reason: cachedDecision.reason,
          needsAIValidation: false
        };
        console.log(`   💾 Using cached cluster decision for "${otherSignal.title?.substring(0, 30)}..."`);
      } else {
        // Calculate clustering decision
        decision = shouldClusterSignals(signal, otherSignal, {
          requireSameDNA,
          minHighValueAnchors,
          timeWindowHours
        });
        
        // AI validation for borderline cases
        if (useAIValidation && decision.needsAIValidation && aiCallCount < maxAICallsPerRun) {
          const aiResult = await aiValidateCluster(signal, otherSignal, decision.sharedAnchors || []);
          aiCallCount++;
          
          if (aiResult) {
            decision.cluster = aiResult.sameStory;
            decision.confidence = aiResult.confidence;
            decision.reason = `AI: ${aiResult.reason}`;
          }
        }
        
        // Save to cache (if supabase provided)
        if (supabase && signal.id && otherSignal.id) {
          try {
            await supabase
              .from('signal_cluster_cache')
              .upsert({
                signal_id: signal.id,
                paired_signal_id: otherSignal.id,
                should_cluster: decision.cluster,
                confidence: decision.confidence,
                reason: decision.reason,
                shared_anchors: decision.sharedAnchors || [],
                validated_at: new Date().toISOString()
              }, {
                onConflict: 'signal_id,paired_signal_id'
              });
          } catch (saveErr) {
            // Non-fatal, continue
          }
        }
      }
      
      // Add to cluster if decision is positive
      if (decision.cluster && decision.confidence >= 50) {
        cluster.signals.push(otherSignal);
        cluster.signalIds.push(otherSignal.id);
        assignedSignalIds.add(otherSignal.id);
        
        // Update cluster anchors (union of all signal anchors)
        const otherAnchors = extractAnchors(otherSignal.title).all;
        for (const anchor of otherAnchors) {
          if (!cluster.anchors.includes(anchor)) {
            cluster.anchors.push(anchor);
          }
        }
        
        // Update cluster confidence (average)
        cluster.confidence = Math.round(
          (cluster.confidence * (cluster.signals.length - 1) + decision.confidence) / cluster.signals.length
        );
      }
    }
    
    // Generate cluster key
    cluster.clusterKey = generateClusterKey(cluster.primarySignal, cluster.anchors.slice(0, 3));
    
    clusters.push(cluster);
  }
  
  // Log clustering results
  const multiSignalClusters = clusters.filter(c => c.signals.length > 1);
  console.log(`   ✅ Created ${clusters.length} clusters (${multiSignalClusters.length} with multiple signals)`);
  
  if (multiSignalClusters.length > 0) {
    console.log(`   📊 Multi-signal clusters:`);
    for (const c of multiSignalClusters) {
      console.log(`      - "${c.primarySignal.title?.substring(0, 40)}..." (${c.signals.length} signals, anchors: ${c.anchors.slice(0, 3).join(', ')})`);
    }
  }
  
  if (aiCallCount > 0) {
    console.log(`   🤖 AI validations used: ${aiCallCount}`);
  }
  
  return clusters;
}

// ============================================
// HELPER FUNCTIONS FOR UI
// ============================================

/**
 * Mark signals with cluster information for UI display
 */
export function markSignalsWithClusterInfo(signals, clusters) {
  const signalToCluster = new Map();
  
  // Build signal -> cluster lookup
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.signals.length; i++) {
      const signal = cluster.signals[i];
      signalToCluster.set(signal.id, {
        clusterId: cluster.id,
        clusterKey: cluster.clusterKey,
        clusterSize: cluster.signals.length,
        clusterRank: i + 1,
        isPrimary: signal.id === cluster.primarySignalId,
        clusterAnchors: cluster.anchors,
        clusterConfidence: cluster.confidence
      });
    }
  }
  
  // Mark each signal
  return signals.map(signal => {
    const clusterInfo = signalToCluster.get(signal.id);
    
    if (clusterInfo && clusterInfo.clusterSize > 1) {
      return {
        ...signal,
        cluster_id: clusterInfo.clusterId,
        cluster_key: clusterInfo.clusterKey,
        cluster_size: clusterInfo.clusterSize,
        cluster_rank: clusterInfo.clusterRank,
        is_cluster_primary: clusterInfo.isPrimary,
        cluster_anchors: clusterInfo.clusterAnchors,
        cluster_confidence: clusterInfo.clusterConfidence
      };
    }
    
    return {
      ...signal,
      cluster_id: null,
      cluster_size: 1,
      cluster_rank: 1,
      is_cluster_primary: true
    };
  });
}

/**
 * Get only primary signals (one per cluster) for compact view
 */
export function getPrimarySignalsOnly(signals) {
  return signals.filter(s => s.is_cluster_primary !== false);
}

/**
 * Get all signals in a specific cluster
 */
export function getClusterSignals(signals, clusterId) {
  return signals.filter(s => s.cluster_id === clusterId);
}

// ============================================
// DATABASE INTEGRATION
// ============================================

/**
 * Save cluster to database for learning
 */
export async function saveClusterToDatabase(cluster, showId, supabase) {
  if (!supabase || !cluster || !showId) return null;
  
  try {
    const { data, error } = await supabase
      .from('signal_story_clusters')
      .upsert({
        show_id: showId,
        cluster_key: cluster.clusterKey,
        dna_topic_id: cluster.dnaTopicId,
        anchor_keywords: cluster.anchors,
        signal_ids: cluster.signalIds,
        primary_signal_id: cluster.primarySignalId,
        signal_count: cluster.signals.length,
        confidence: cluster.confidence,
        created_at: cluster.createdAt,
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72h expiry
      }, {
        onConflict: 'show_id,cluster_key'
      })
      .select()
      .single();
    
    if (error) {
      console.warn(`⚠️ Failed to save cluster:`, error.message);
      return null;
    }
    
    return data;
  } catch (err) {
    console.warn(`⚠️ Error saving cluster:`, err.message);
    return null;
  }
}

/**
 * Record user feedback on cluster (for learning)
 */
export async function recordClusterFeedback(clusterId, action, supabase) {
  if (!supabase || !clusterId) return;
  
  try {
    const updates = {};
    if (action === 'expanded') {
      updates.expanded_count = supabase.sql`expanded_count + 1`;
    } else if (action === 'liked') {
      updates.liked_count = supabase.sql`liked_count + 1`;
    } else if (action === 'rejected') {
      updates.rejected_count = supabase.sql`rejected_count + 1`;
    }
    
    await supabase
      .from('signal_story_clusters')
      .update(updates)
      .eq('id', clusterId);
  } catch (err) {
    console.warn(`⚠️ Error recording cluster feedback:`, err.message);
  }
}

export default {
  extractAnchors,
  shouldClusterSignals,
  aiValidateCluster,
  groupSignalsByStoryAndDNA,
  markSignalsWithClusterInfo,
  getPrimarySignalsOnly,
  getClusterSignals,
  saveClusterToDatabase,
  recordClusterFeedback
};
