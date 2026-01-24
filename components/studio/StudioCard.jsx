'use client';

import { useState } from 'react';

export default function StudioCard({ signal, tierColor, onAction, showGenerateButton = false, onGeneratePitch }) {
  const [expanded, setExpanded] = useState(false);
  const [pitchExpanded, setPitchExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clusterExpanded, setClusterExpanded] = useState(false);

  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${Math.round(views / 1000)}K`;
    return views.toString();
  };

  // Extract breakout info from scoringSignals
  const breakoutSignal = signal.scoringSignals?.find(s => 
    s.type === 'competitor_breakout_trendsetter' || 
    s.type === 'competitor_breakout_direct' || 
    s.type === 'competitor_breakout_indirect'
  );
  
  // Extract trendsetter count signal
  const trendsetterSignal = signal.scoringSignals?.find(s => 
    s.type === 'trendsetter_volume' || 
    s.type === 'competitor_volume_trendsetter'
  );
  
  // Extract recency signal
  const recencySignal = signal.scoringSignals?.find(s => s.type === 'recency');
  
  // Get DNA matches - prefer new evidence structure, fallback to old structure
  const dnaEvidence = signal.evidence?.dna || null;
  const dnaMatches = [];
  
  // NEW: Use evidence.dna if available
  if (dnaEvidence && dnaEvidence.topicName) {
    dnaMatches.push(dnaEvidence.topicName);
  }
  
  // FALLBACK: Get DNA matches from scoringSignals (extract English names)
  if (dnaMatches.length === 0) {
    const dnaSignals = signal.scoringSignals?.filter(s => s.type === 'dna_match') || [];
    
    // Extract English topic names from scoring signals
    dnaSignals.forEach(s => {
      // Prefer English names from evidence, fallback to topic IDs
      if (s.evidence?.matchedTopicNames && s.evidence.matchedTopicNames.length > 0) {
        s.evidence.matchedTopicNames.forEach(topicName => {
          if (topicName && !dnaMatches.includes(topicName)) {
            dnaMatches.push(topicName);
          }
        });
      } else if (s.data?.topicNames && s.data.topicNames.length > 0) {
        s.data.topicNames.forEach(topicName => {
          if (topicName && !dnaMatches.includes(topicName)) {
            dnaMatches.push(topicName);
          }
        });
      } else if (s.data?.matchedTopics) {
        // Fallback to topic IDs (they're usually in English format like "energy_oil_gas_lng")
        s.data.matchedTopics.forEach(topicId => {
          if (topicId && !dnaMatches.includes(topicId)) {
            dnaMatches.push(topicId);
          }
        });
      }
    });
    
    // Add direct DNA match from API (already in English)
    if (signal.dnaMatch && !dnaMatches.includes(signal.dnaMatch)) {
      dnaMatches.push(signal.dnaMatch);
    }
  }
  
  // Get competitor evidence - prefer new structure
  const competitorEvidence = signal.evidence?.competitors || signal.competitors || null;
  
  // Get pattern evidence - prefer new structure
  const patternEvidence = signal.evidence?.pattern || null;
  
  // Get audience evidence - prefer new structure
  const audienceEvidence = signal.evidence?.audience || null;
  
  // Get shadow evaluation (3-axis scoring comparison)
  const shadowEval = signal.shadowEvaluation || null;
  const shadowTierChanged = shadowEval && shadowEval.comparison?.tierChanged;
  const shadowIsPromotion = shadowEval && shadowEval.newTier && 
    ['post_today'].includes(shadowEval.newTier) && 
    !['post_today'].includes(signal.tier);

  // DEBUG: Check why shadow UI isn't showing
if (shadowEval) {
  console.log('🔬 Shadow Debug:', {
    title: signal.title?.substring(0, 30),
    tierChanged: shadowTierChanged,
    isMustKnow: shadowEval.axes?.urgency?.isMustKnow,
    comparison: shadowEval.comparison,
    conditionMet: !!(shadowTierChanged || shadowEval.axes?.urgency?.isMustKnow),
  });
}

return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      {/* Strategic Label Banner */}
      
      {signal.strategicLabel && (
        <div className={`mb-3 p-2 rounded-lg text-sm font-semibold text-center ${
          signal.strategicLabel.color === 'red' ? 'bg-red-50 text-red-700' :
          signal.strategicLabel.color === 'orange' ? 'bg-orange-50 text-orange-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {signal.strategicLabel.icon} {signal.strategicLabel.text}
        </div>
      )}

{/* Shadow Mode Evaluation (3-Axis Scoring) */}
{shadowEval && (shadowTierChanged || shadowEval.axes?.urgency?.isMustKnow) && (
        <div className={`mb-3 p-3 rounded-lg text-sm border-2 ${
          shadowEval.newTier === 'post_today' 
            ? 'bg-purple-50 border-purple-300' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-purple-700">
              🔬 Shadow Mode: {shadowEval.newTier?.toUpperCase().replace('_', ' ')}
              {shadowEval.newLane && ` (${shadowEval.newLane})`}
            </span>
            {shadowEval.axes?.urgency?.isMustKnow && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">
                ⚡ MUST-KNOW
              </span>
            )}
          </div>
          
          {/* 3-Axis Scores */}
          <div className="flex gap-4 text-xs text-gray-600 mb-2">
            <span title="DNA Score (topic relevance)">
              🧬 DNA: <strong>{shadowEval.axes?.dna?.score ?? '?'}</strong>
            </span>
            <span title="Urgency Score (time-sensitive)">
              ⏰ Urgency: <strong>{shadowEval.axes?.urgency?.score ?? '?'}</strong>
            </span>
            <span title="Demand Score (audience interest)">
              📈 Demand: <strong>{shadowEval.axes?.demand?.score ?? '?'}</strong>
            </span>
          </div>
          
          {/* Urgency Breakdown */}
          {shadowEval.axes?.urgency?.triggers && shadowEval.axes.urgency.triggers.length > 0 && (
            <div className="text-xs text-gray-500">
              {shadowEval.axes.urgency.triggers.map((t, i) => (
                <span key={i} className="mr-2">
                  {t.icon || '•'} {t.text}
                </span>
              ))}
            </div>
          )}
          
          {/* Tier Comparison */}
          {shadowTierChanged && (
            <div className="mt-2 pt-2 border-t border-purple-200 text-xs">
              <span className="text-gray-500">Current: </span>
              <span className="font-medium">{signal.tier}</span>
              <span className="mx-2">→</span>
              <span className={`font-bold ${
                shadowEval.newTier === 'post_today' ? 'text-purple-700' : 'text-gray-700'
              }`}>
                {shadowEval.newTier}
              </span>
              {shadowIsPromotion && <span className="ml-1">⬆️</span>}
            </div>
          )}
        </div>
      )}

     {/* Header Row */}
     <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          {/* Title */}
          <h3 className="font-bold text-lg text-gray-900" dir="auto">
            {signal.title}
          </h3>
          
          {/* Meta */}
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>📰 {signal.source}</span>
            <span>•</span>
            <span>⏰ {signal.hoursOld}h ago</span>
          </div>
        </div>
        
        {/* Score Badge + Cluster Indicator */}
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold text-gray-700">{Math.round(signal.score || signal.realScore || 0)}</span>
          <span className="text-xs text-gray-400">score</span>
          {/* Cluster Badge */}
          {signal.cluster_size > 1 && signal.is_cluster_primary && (
            <div className="flex items-center gap-1 mt-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{signal.cluster_size} related</span>
            </div>
          )}
        </div>
      </div>

      {/* WHY NOW Section - Always visible, rich evidence */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
        <div className="font-bold text-sm text-gray-800 mb-3">WHY NOW:</div>
        
        {/* Format Recommendation Strategy Badge */}
        {signal.recommended_strategy && (
          <div className="mb-3 pb-2 border-b border-yellow-300">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">Strategy:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                signal.recommended_strategy.format === 'Long'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {signal.recommended_strategy.format === 'Long' ? 'LONG FORM 🟢' : 'SHORT FORM ⚡'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 pl-1 leading-tight">
              {signal.recommended_strategy.reason}
            </p>
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          {/* Trendsetter Breakout */}
          {breakoutSignal && (
            <div className="flex items-start gap-2">
              <span className="text-orange-500 text-lg">⚡</span>
              <div className="flex-1">
                <div className="font-medium text-gray-800">
                  {breakoutSignal.text}
                </div>
                {breakoutSignal.subtext && (
                  <div className="text-gray-600 text-xs mt-0.5">{breakoutSignal.subtext}</div>
                )}
                {signal.competitorBreakout && (
                  <div className="text-gray-500 text-xs mt-1">
                    {signal.competitorBreakout.multiplier?.toFixed(1)}x median ({formatViews(signal.competitorBreakout.views)} views)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Multiple Competitors Signal */}
          {trendsetterSignal && (
            <div className="flex items-start gap-2">
              <span className="text-blue-500">📊</span>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{trendsetterSignal.text}</div>
                {trendsetterSignal.subtext && (
                  <div className="text-gray-600 text-xs mt-0.5">{trendsetterSignal.subtext}</div>
                )}
              </div>
            </div>
          )}

          {/* Matched Keywords */}
          {signal.matchedKeywords && signal.matchedKeywords.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">🔍</span>
              <div className="flex-1">
                <span className="text-gray-600">Matched: </span>
                <span className="font-medium text-gray-800">
                  {signal.matchedKeywords.slice(0, 5).join(', ')}
                  {signal.matchedKeywords.length > 5 && '...'}
                </span>
              </div>
            </div>
          )}

          {/* Competitors covering this */}
          {signal.competitors && signal.competitors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-yellow-300">
              <div className="font-medium text-gray-800 mb-2">Competitors covering this:</div>
              <div className="space-y-1.5">
              {signal.competitors.map((comp, i) => (
                  <div key={i} className="flex flex-col gap-1 text-xs mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${
                        comp.type === 'trendsetter' ? 'text-orange-600' :
                        comp.type === 'direct' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {comp.typeLabel || comp.type || 'Competitor'}: {comp.channelName || comp.channel || comp.name || 'Unknown'}
                      </span>
                      <a
                        href={comp.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        [View →]
                      </a>
                      {comp.multiplier && comp.multiplier > 1 && (
  <span className="text-green-600 font-medium">
    ({comp.multiplier.toFixed(1)}x their median)
  </span>
)}
{comp.matchedKeywords && comp.matchedKeywords.length > 0 && !comp.multiplier && (
  <span className="text-gray-500">
    ({comp.matchedKeywords.slice(0, 3).join(', ')})
  </span>
)}
                    </div>
                    {/* Video Title - NEW */}
                    {comp.videoTitle && (
                      <div 
                        className="text-gray-600 pl-4 truncate max-w-[300px] italic" 
                        title={comp.videoTitle}
                        dir="auto"
                      >
                        "{comp.videoTitle}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DNA Matches */}
          {dnaMatches.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-green-600">✅</span>
              <div className="flex-1">
                <span className="text-gray-600">Matches your DNA: </span>
                <span className="font-medium text-gray-800">
                  {dnaMatches.join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Pattern Matches - NEW: Use evidence.pattern, fallback to old structure */}
          {(patternEvidence || (signal.patternMatches && signal.patternMatches.length > 0)) && (
            <div className="mt-3 pt-3 border-t border-yellow-300">
              <div className="font-medium text-gray-800 mb-2">Pattern Matches:</div>
              <div className="space-y-2">
                {patternEvidence ? (
                  <div className="text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-600">🎯</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {patternEvidence.patternNameAr || patternEvidence.patternName}
                        </div>
                        <div className="text-gray-600 text-xs mt-0.5">
                          {patternEvidence.multiplier && (
                            <span>
                              {patternEvidence.multiplier.toFixed(2)}x your average
                            </span>
                          )}
                          {patternEvidence.videoCount > 0 && (
                            <span className="text-gray-500 ml-2">
                              ({patternEvidence.videoCount} videos)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  signal.patternMatches.map((pattern, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-purple-600">🎯</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {pattern.patternName}
                          </div>
                          <div className="text-gray-600 text-xs mt-0.5">
                            {pattern.evidence}
                            {pattern.avgViews && pattern.multiplier && (
                              <span>
                                {' '}(your videos avg {formatViews(pattern.avgViews)} views, {pattern.multiplier.toFixed(2)}x your average)
                              </span>
                            )}
                            {pattern.likedCount > 0 && (
                              <span className="text-green-600 font-medium">
                                {' '}(you liked this pattern {pattern.likedCount}x before)
                              </span>
                            )}
                          </div>
                          {pattern.isLearned && (
                            <div className="text-xs text-green-600 mt-0.5 italic">
                              (learned from your feedback)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Audience Interest - NEW: Display from evidence.audience */}
          {audienceEvidence && audienceEvidence.hasAudienceInterest && (
            <div className="mt-3 pt-3 border-t border-purple-300">
              <div className="font-medium text-gray-800 mb-2">👥 Audience Interest:</div>
              <div className="space-y-2">
                {audienceEvidence.matches?.slice(0, 3).map((match, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-600">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {match.interestName}
                        </div>
                        {match.reason && (
                          <div className="text-gray-600 text-xs mt-0.5">
                            {match.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending */}
          {recencySignal && (
            <div className="flex items-start gap-2">
              <span className="text-blue-500">📰</span>
              <div className="flex-1">
                <span className="text-gray-600">{recencySignal.text}</span>
              </div>
            </div>
          )}

          {/* Source Link */}
          {signal.sourceUrl && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">📎</span>
              <div className="flex-1">
                <span className="text-gray-600">Source: </span>
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  "{signal.source}" - View article →
                </a>
              </div>
            </div>
          )}

          {/* Last Covered */}
          {signal.lastCoveredVideo && signal.daysSinceLastPost !== null && signal.daysSinceLastPost !== 999 && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">⏰</span>
              <div className="flex-1">
                <span className="text-gray-600">Last covered: </span>
                <span className="text-gray-800">{signal.daysSinceLastPost} days ago</span>
                {signal.lastCoveredVideo.url && signal.lastCoveredVideo.title && (
                  <>
                    <br />
                    <span className="text-gray-500">→ </span>
                    <a
                      href={signal.lastCoveredVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      "{signal.lastCoveredVideo.title?.substring(0, 50)}..." → View
                    </a>
                  </>
                )}
              </div>
            </div>
          )}
          {signal.daysSinceLastPost === 999 && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">⏰</span>
              <div className="flex-1">
                <span className="text-gray-600">Last covered: </span>
                <span className="text-gray-800">You haven't covered this topic</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cluster Section - Shows related stories (OUTSIDE WHY NOW section) */}
      {signal.cluster_size > 1 && signal.is_cluster_primary && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
          <button
            onClick={() => setClusterExpanded(!clusterExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 text-purple-600 transition-transform ${clusterExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-purple-800">
                📚 {signal.cluster_size - 1} more stories about this topic
              </span>
              {signal.cluster_anchors && signal.cluster_anchors.length > 0 && (
                <span className="text-xs text-purple-500 ml-2">
                  ({signal.cluster_anchors.slice(0, 3).join(', ')})
                </span>
              )}
            </div>
            <span className="text-xs text-purple-400">
              {clusterExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          
          {clusterExpanded && (
            <div className="mt-3 space-y-2 pl-4 border-l-2 border-purple-200">
              {signal.clusterSignals
                ?.filter(s => s.id !== signal.id)
                .map((relatedSignal, idx) => (
                  <div key={relatedSignal.id || idx} className="p-2 bg-white rounded-lg shadow-sm">
                    <div className="text-sm font-medium text-gray-700" dir="auto">
                      {relatedSignal.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{relatedSignal.source}</span>
                      <span>•</span>
                      <span>{relatedSignal.hoursOld || relatedSignal.hoursAgo}h ago</span>
                      <span>•</span>
                      <span className="text-purple-600">Score: {Math.round(relatedSignal.score || 0)}</span>
                    </div>
                    {relatedSignal.sourceUrl && (
                      <a 
                        href={relatedSignal.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View source →
                      </a>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Expandable Score Breakdown - Collapsed by default, only shows signals not in WHY NOW */}
      {signal.scoringSignals && signal.scoringSignals.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-2 mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-left text-xs"
          >
            <span className="text-gray-600">
              Score Breakdown ({signal.scoringSignals.length} signals)
            </span>
            <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
          </button>

          {expanded && (
            <div className="mt-2 space-y-1 text-xs pt-2 border-t border-gray-200">
              {signal.scoringSignals
                .filter(sig => 
                  // Don't show signals already displayed in WHY NOW section
                  sig.type !== 'competitor_breakout_trendsetter' &&
                  sig.type !== 'competitor_breakout_direct' &&
                  sig.type !== 'competitor_breakout_indirect' &&
                  sig.type !== 'trendsetter_volume' &&
                  sig.type !== 'competitor_volume_direct' &&
                  sig.type !== 'competitor_volume_mixed' &&
                  sig.type !== 'competitor_volume_indirect' &&
                  sig.type !== 'dna_match' &&
                  sig.type !== 'recency' &&
                  sig.type !== 'freshness' &&
                  sig.type !== 'fresh_topic' &&
                  sig.type !== 'saturated'
                )
                .map((sig, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-600">
                    <span>{sig.icon || '•'}</span>
                    <span>{sig.text}</span>
                    {sig.subtext && (
                      <span className="text-gray-400 italic text-xs">({sig.subtext})</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Pitch Section - Show if signal has a saved pitch */}
      {signal.raw_data?.recommendation?.pitch && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-3">
          <button
            onClick={() => setPitchExpanded(!pitchExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <span className="font-semibold text-purple-800">Generated Pitch</span>
              {signal.raw_data?.recommendation?.pitch_generated_at && (
                <span className="text-xs text-purple-600">
                  (saved {new Date(signal.raw_data.recommendation.pitch_generated_at).toLocaleDateString()})
                </span>
              )}
            </div>
            <span className="text-purple-400">{pitchExpanded ? '▼' : '▶'}</span>
          </button>

          {pitchExpanded && (
            <div className="mt-3 pt-3 border-t border-purple-300 space-y-3">
              {signal.raw_data.recommendation.pitch.title && (
                <div>
                  <p className="text-xs font-medium text-purple-700 mb-1">Title:</p>
                  <p className="text-sm text-purple-900 font-medium">
                    {signal.raw_data.recommendation.pitch.title}
                  </p>
                </div>
              )}
              
              {signal.raw_data.recommendation.pitch.hook && (
                <div>
                  <p className="text-xs font-medium text-purple-700 mb-1">Hook:</p>
                  <p className="text-sm text-purple-800 leading-relaxed">
                    {signal.raw_data.recommendation.pitch.hook}
                  </p>
                </div>
              )}
              
              {(signal.raw_data.recommendation.pitch.format || signal.raw_data.recommendation.pitch.recommendedFormat) && (
                <div>
                  <p className="text-xs font-medium text-purple-700 mb-1">Recommended Format:</p>
                  <p className="text-sm text-purple-800">
                    {signal.raw_data.recommendation.pitch.recommendedFormat || signal.raw_data.recommendation.pitch.format || 'long_form'}
                  </p>
                </div>
              )}
              
              {signal.raw_data.recommendation.pitch.evidenceStrength && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-700">Evidence:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    signal.raw_data.recommendation.pitch.evidenceStrength === 'strong' ? 'bg-green-100 text-green-700' :
                    signal.raw_data.recommendation.pitch.evidenceStrength === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {signal.raw_data.recommendation.pitch.evidenceStrength}
                  </span>
                </div>
              )}
              
              <div className="pt-2 border-t border-purple-300">
                <p className="text-xs text-purple-600 mb-2">
                  💡 Tip: Switch to "Pitches" view to see full pitch details and give feedback
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex gap-2">
          <button
            onClick={() => onAction(signal.id, 'like')}
            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm"
          >
            👍 Like
          </button>
          <button
            onClick={() => onAction(signal.id, 'reject')}
            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm"
          >
            👎 Reject
          </button>
          <button
            onClick={() => onAction(signal.id, 'save')}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm"
          >
            💾 Save
          </button>
        </div>
        
        {showGenerateButton && !signal.hasPitch ? (
          <button
            onClick={async () => {
              if (onGeneratePitch && !generating) {
                setGenerating(true);
                try {
                  await onGeneratePitch(signal);
                } finally {
                  setGenerating(false);
                }
              }
            }}
            disabled={generating}
            className="px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {generating ? '⏳ Generating...' : '🎬 Generate Pitch'}
          </button>
        ) : signal.hasPitch ? (
          <button
            onClick={() => {
              // Switch to pitches view to show this signal's pitch
              if (onAction) onAction(signal.id, 'view_pitch');
            }}
            className="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
          >
            📋 View Pitch
          </button>
        ) : (
          <button
            onClick={() => onAction(signal.id, 'script')}
            className="px-4 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
          >
            📝 Generate Script
          </button>
        )}
      </div>
    </div>
  );
}
