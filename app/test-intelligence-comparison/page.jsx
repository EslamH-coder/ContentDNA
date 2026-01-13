'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function TestIntelligenceComparisonPage() {
  const searchParams = useSearchParams();
  const showId = searchParams.get('showId') || searchParams.get('show_id');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(10);

  const runComparison = async () => {
    if (!showId) {
      setError('Please provide showId in URL (?showId=...)');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/test-intelligence-comparison?showId=${showId}&limit=${limit}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run comparison');
      }
      
      setResults(data);
    } catch (err) {
      setError(err.message);
      console.error('Comparison error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showId) {
      runComparison();
    }
  }, [showId, limit]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Intelligence System vs Multi-Signal Scoring</h1>
        <p className="text-gray-600">Compare results from both systems using real database signals</p>
      </div>

      {/* Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Show ID</label>
            <input
              type="text"
              value={showId || ''}
              readOnly
              className="px-3 py-2 border rounded bg-gray-100"
              placeholder="Add ?showId=... to URL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
              min="1"
              max="50"
              className="px-3 py-2 border rounded"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runComparison}
              disabled={loading || !showId}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Run Comparison'}
            </button>
          </div>
        </div>
        {!showId && (
          <p className="mt-2 text-sm text-red-600">
            ⚠️ Add ?showId=YOUR_SHOW_ID to the URL
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">❌ {error}</p>
        </div>
      )}

      {/* Stats */}
      {results && results.stats && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Signals</div>
            <div className="text-2xl font-bold">{results.stats.totalSignals}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">Intelligence Results</div>
            <div className="text-2xl font-bold">{results.stats.intelligenceResults}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-gray-600">Multi-Signal Results</div>
            <div className="text-2xl font-bold">{results.stats.multiSignalResults}</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-sm text-gray-600">Matched by Both</div>
            <div className="text-2xl font-bold">
              {results.comparison.filter(c => c.intelligence && c.multiSignal).length}
            </div>
          </div>
        </div>
      )}

      {/* System Stats */}
      {results && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Intelligence System Stats */}
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-bold mb-3">🤖 Intelligence System</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Recommendations:</span>
                <span className="font-semibold">{results.intelligenceSystem?.totalRecommendations || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Highly Recommended:</span>
                <span className="font-semibold text-green-700">{results.intelligenceSystem?.highlyRecommended || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Recommended:</span>
                <span className="font-semibold text-blue-700">{results.intelligenceSystem?.recommended || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Consider:</span>
                <span className="font-semibold text-yellow-700">{results.intelligenceSystem?.consider || 0}</span>
              </div>
            </div>
          </div>

          {/* Multi-Signal System Stats */}
          <div className="p-4 bg-purple-50 rounded-lg">
            <h3 className="font-bold mb-3">📊 Multi-Signal Scoring</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Average Score:</span>
                <span className="font-semibold">{Math.round(results.multiSignalSystem?.avgScore || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>High (≥70):</span>
                <span className="font-semibold text-green-700">{results.multiSignalSystem?.highScore || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Medium (50-69):</span>
                <span className="font-semibold text-yellow-700">{results.multiSignalSystem?.mediumScore || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Low (&lt;50):</span>
                <span className="font-semibold text-red-700">{results.multiSignalSystem?.lowScore || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {results && results.comparison && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-4">Signal-by-Signal Comparison</h2>
          
          {results.comparison.map((item, index) => (
            <div key={item.signal.id || index} className="border rounded-lg p-4 bg-white">
              {/* Signal Info */}
              <div className="mb-4 pb-4 border-b">
                <h3 className="font-semibold text-lg mb-2">{item.signal.title}</h3>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>Source: {item.signal.source}</span>
                  <span>DB Score: {item.signal.dbScore || 'N/A'}</span>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Intelligence System Result */}
                <div className={`p-4 rounded-lg ${item.intelligence ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    🤖 Intelligence System
                    {item.intelligence && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.intelligence.recommendation === 'HIGHLY_RECOMMENDED' ? 'bg-green-600 text-white' :
                        item.intelligence.recommendation === 'RECOMMENDED' ? 'bg-blue-600 text-white' :
                        'bg-yellow-600 text-white'
                      }`}>
                        {item.intelligence.recommendation}
                      </span>
                    )}
                  </h4>
                  {item.intelligence ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Score:</span> {item.intelligence.score}
                      </div>
                      <div>
                        <span className="font-medium">Evidence Strength:</span> {item.intelligence.evidenceStrength || 'N/A'}
                      </div>
                      {item.intelligence.evidence && (
                        <div className="mt-2 text-xs">
                          <div className="font-medium mb-1">Evidence:</div>
                          {item.intelligence.evidence.search && (
                            <div>🔍 Search: {item.intelligence.evidence.search.summary || 'N/A'}</div>
                          )}
                          {item.intelligence.evidence.audience && (
                            <div>👥 Audience: {item.intelligence.evidence.audience.summary || 'N/A'}</div>
                          )}
                          {item.intelligence.evidence.competitor && (
                            <div>🏆 Competitor: {item.intelligence.evidence.competitor.summary || 'N/A'}</div>
                          )}
                          {item.intelligence.evidence.comments && (
                            <div>💬 Comments: {item.intelligence.evidence.comments.summary || 'N/A'}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No recommendation from Intelligence System</p>
                  )}
                </div>

                {/* Multi-Signal Scoring Result */}
                <div className={`p-4 rounded-lg ${item.multiSignal ? 'bg-purple-50 border-2 border-purple-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    📊 Multi-Signal Scoring
                    {item.multiSignal && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.multiSignal.score >= 70 ? 'bg-green-600 text-white' :
                        item.multiSignal.score >= 50 ? 'bg-yellow-600 text-white' :
                        'bg-red-600 text-white'
                      }`}>
                        Score: {item.multiSignal.score}
                      </span>
                    )}
                  </h4>
                  {item.multiSignal ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Score:</span> {item.multiSignal.score}
                      </div>
                      {item.multiSignal.dnaMatch && item.multiSignal.dnaMatch.length > 0 && (
                        <div>
                          <span className="font-medium">DNA Match:</span> {item.multiSignal.dnaMatch.join(', ')}
                        </div>
                      )}
                      {item.multiSignal.competitorBreakdown && (
                        <div>
                          <span className="font-medium">Competitors:</span> {item.multiSignal.competitorBreakdown.total || 0} total
                        </div>
                      )}
                      {item.multiSignal.patternMatches && item.multiSignal.patternMatches.length > 0 && (
                        <div>
                          <span className="font-medium">Patterns:</span> {item.multiSignal.patternMatches.length} matches
                          {item.multiSignal.patternBoost > 0 && (
                            <span className="text-green-600"> (+{item.multiSignal.patternBoost})</span>
                          )}
                        </div>
                      )}
                      {item.multiSignal.strategicLabel && (
                        <div>
                          <span className="font-medium">Label:</span> {item.multiSignal.strategicLabel.text}
                        </div>
                      )}
                      {item.multiSignal.scoringSignals && item.multiSignal.scoringSignals.length > 0 && (
                        <div className="mt-2 text-xs">
                          <div className="font-medium mb-1">Signals ({item.multiSignal.scoringSignals.length}):</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {item.multiSignal.scoringSignals.slice(0, 5).map((sig, i) => (
                              <div key={i} className="text-xs">
                                {sig.icon} {sig.text} ({sig.weight})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No result from Multi-Signal Scoring</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Running comparison...</p>
        </div>
      )}
    </div>
  );
}
