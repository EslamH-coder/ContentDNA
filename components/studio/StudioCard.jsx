'use client';

import { useState } from 'react';

export default function StudioCard({ signal, tierColor, onAction }) {
  const [expanded, setExpanded] = useState(false);

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
  
  // Get DNA matches from scoringSignals (extract English names)
  const dnaSignals = signal.scoringSignals?.filter(s => s.type === 'dna_match') || [];
  const dnaMatches = [];
  
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
        
        {/* Score Badge */}
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold text-gray-700">{signal.score || signal.realScore || 0}</span>
          <span className="text-xs text-gray-400">score</span>
        </div>
      </div>

      {/* WHY NOW Section - Always visible, rich evidence */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
        <div className="font-bold text-sm text-gray-800 mb-3">WHY NOW:</div>
        
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
                    {signal.competitorBreakout.multiplier?.toFixed(1)}x average ({formatViews(signal.competitorBreakout.views)} views)
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
                  <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
                    <span className={`font-medium ${
                      comp.type === 'trendsetter' ? 'text-orange-600' :
                      comp.type === 'direct' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {comp.typeLabel || 'Competitor'}: {comp.channel || 'Competitor'}
                    </span>
                    <a
                      href={comp.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      [View →]
                    </a>
                    {comp.matchedKeywords && comp.matchedKeywords.length > 0 && (
                      <span className="text-gray-500">
                        ({comp.matchedKeywords.slice(0, 3).join(', ')})
                      </span>
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

          {/* Pattern Matches */}
          {signal.patternMatches && signal.patternMatches.length > 0 && (
            <div className="mt-3 pt-3 border-t border-yellow-300">
              <div className="font-medium text-gray-800 mb-2">Pattern Matches:</div>
              <div className="space-y-2">
                {signal.patternMatches.map((pattern, i) => (
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
        
        <button
          onClick={() => onAction(signal.id, 'script')}
          className="px-4 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
        >
          📝 Generate Script
        </button>
      </div>
    </div>
  );
}
