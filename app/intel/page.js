'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navigation from '@/app/components/Navigation'
import BehaviorInsightPanel from '@/app/components/signals/BehaviorInsightPanel'
import IntelligenceEngine, { CONTENT_FORMATS } from '@/lib/intelligence/intelligenceEngine'
import FeedbackButtons from '@/components/FeedbackButtons'
import LearningStats from '@/components/LearningStats'

export default function IntelPage() {
  const showId = '00000000-0000-0000-0000-000000000004'
  const [recommendations, setRecommendations] = useState(null)
  const [v2Recommendations, setV2Recommendations] = useState(null)
  const [dataStatus, setDataStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [v2Loading, setV2Loading] = useState(false)
  const [useV2, setUseV2] = useState(false)
  const [scoringTopic, setScoringTopic] = useState('')
  const [scoreResult, setScoreResult] = useState(null)
  const [scoring, setScoring] = useState(false)
  const [showAddTrend, setShowAddTrend] = useState(false)
  const [newTrend, setNewTrend] = useState({
    type: 'idea',
    topic: '',
    description: '',
    url: '',
    note: '',
    persona: ''
  })
  const [addingTrend, setAddingTrend] = useState(false)
  const [generatingPitch, setGeneratingPitch] = useState({})
  const [pitches, setPitches] = useState({})

  useEffect(() => {
    fetchRecommendations()
    fetchDataStatus()
  }, [])

  useEffect(() => {
    if (useV2) {
      fetchV2Recommendations()
    }
  }, [useV2])

  async function fetchRecommendations() {
    try {
      setLoading(true)
      setRecommendations(null) // Clear previous results
      
      // Use Simple Intelligence Engine (NO AI, FREE)
      const res = await fetch(`/api/intelligence/simple?show_id=${showId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await res.json()
      console.log('Simple Intelligence API Response:', data)
      
      if (!res.ok || data.success === false) {
        // Try to get detailed error message from response
        const errorMessage = data.error || data.errorType || `HTTP ${res.status}: ${res.statusText}`
        console.error('API returned error:', errorMessage)
        setRecommendations({ 
          error: errorMessage,
          recommendations: [],
          summary: data.summary || {}
        })
        return
      }
      
      console.log('Simple Recommendations loaded:', data)
      setRecommendations(data)
    } catch (error) {
      console.error('Error fetching recommendations:', error)
      setRecommendations({ 
        error: error.message,
        recommendations: [],
        summary: {}
      })
    } finally {
      setLoading(false)
    }
  }

  async function fetchV2Recommendations() {
    try {
      setV2Loading(true)
      setV2Recommendations(null)
      
      const res = await fetch(`/api/intelligence/v2?show_id=${showId}`)
      const data = await res.json()
      
      if (!res.ok || !data.success) {
        const errorMessage = data.error || `HTTP ${res.status}`
        console.error('V2 API error:', errorMessage)
        setV2Recommendations({ 
          error: errorMessage,
          recommendations: [],
          summary: {}
        })
        return
      }
      
      console.log('V2 Recommendations loaded:', data)
      setV2Recommendations(data)
    } catch (error) {
      console.error('Error fetching V2 recommendations:', error)
      setV2Recommendations({ 
        error: error.message,
        recommendations: [],
        summary: {}
      })
    } finally {
      setV2Loading(false)
    }
  }

  async function fetchDataStatus() {
    try {
      const res = await fetch('/api/data/status')
      const data = await res.json()
      if (data.success) {
        setDataStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching data status:', error)
    }
  }

  async function scoreTopic() {
    if (!scoringTopic.trim()) return
    
    setScoring(true)
    try {
      const res = await fetch('/api/intel/score-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: scoringTopic, sourceType: 'manual' })
      })
      const data = await res.json()
      if (data.success) {
        setScoreResult(data.result)
      }
    } catch (error) {
      console.error('Error scoring topic:', error)
    } finally {
      setScoring(false)
    }
  }

  async function addTrend() {
    setAddingTrend(true)
    try {
      const res = await fetch('/api/intel/add-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrend)
      })
      const data = await res.json()
      if (data.success) {
        alert(`✅ Added trend! Score: ${data.score.totalScore}/100 - ${data.score.recommendation}`)
        setNewTrend({ type: 'idea', topic: '', description: '', url: '', note: '', persona: '' })
        setShowAddTrend(false)
        // Refresh recommendations
        fetchRecommendations()
      }
    } catch (error) {
      console.error('Error adding trend:', error)
      alert('Error adding trend: ' + error.message)
    } finally {
      setAddingTrend(false)
    }
  }

  async function generatePitch(topic, evidence, format) {
    const topicKey = topic;
    setGeneratingPitch(prev => ({ ...prev, [topicKey]: true }));
    
    try {
      const res = await fetch('/api/intelligence/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, evidence, format })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPitches(prev => ({ ...prev, [topicKey]: data.pitch }));
      } else {
        alert('Error generating pitch: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error generating pitch:', error);
      alert('Error generating pitch: ' + error.message);
    } finally {
      setGeneratingPitch(prev => ({ ...prev, [topicKey]: false }));
    }
  }

  // V2 Recommendation Card Component
  const RecommendationCardV2 = ({ rec, onGeneratePitch, generatingPitch, pitch, showId }) => {
    const format = rec.format || { icon: '🎬', name: 'Long-form Video', reason: '' };
    
    return (
      <div className={`p-4 rounded-lg border ${
        rec.level === 'HIGHLY_RECOMMENDED' ? 'border-green-500 bg-green-50' :
        rec.level === 'RECOMMENDED' ? 'border-blue-500 bg-blue-50' :
        'border-gray-300 bg-gray-50'
      }`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg">{rec.topic}</h3>
            <span className={`text-sm px-2 py-1 rounded ${
              rec.level === 'HIGHLY_RECOMMENDED' ? 'bg-green-200 text-green-800' :
              rec.level === 'RECOMMENDED' ? 'bg-blue-200 text-blue-800' :
              'bg-gray-200 text-gray-800'
            }`}>
              {rec.level}
            </span>
          </div>
          <div className="text-2xl font-bold">
            {rec.score} / 100
          </div>
        </div>

        {/* Format Recommendation */}
        <div className="mb-3 p-2 bg-purple-50 rounded">
          <div className="font-semibold text-purple-800">
            {format.icon} Suggested Format: {format.name || format.label}
          </div>
          <div className="text-sm text-purple-600">
            {format.reason || (rec.format_reasoning && rec.format_reasoning[0])}
          </div>
        </div>

        {/* Evidence */}
        <div className="mb-3 text-sm">
          <div className="font-semibold mb-1">📊 Evidence:</div>
          <ul className="list-disc list-inside text-gray-600">
            {rec.evidence.search_volume > 0 && (
              <li>🔍 {rec.evidence.search_volume.toLocaleString()} searches</li>
            )}
            {rec.evidence.competitor_videos > 0 && (
              <li>🎬 {rec.evidence.competitor_videos} competitor videos ({rec.evidence.competitor_success} successful)</li>
            )}
            {rec.evidence.has_current_event && (
              <li>📰 {rec.evidence.current_events.length} current news</li>
            )}
            {rec.evidence.comment_mentions > 0 && (
              <li>💬 {rec.evidence.comment_mentions} comments requesting topic</li>
            )}
          </ul>
        </div>

        {/* Gaps */}
        {rec.gaps && rec.gaps.length > 0 && (
          <div className="mb-3 text-sm">
            <div className="font-semibold mb-1">🎯 Opportunities:</div>
            {rec.gaps.map((gap, i) => (
              <div key={i} className="p-2 bg-yellow-50 rounded mb-1">
                {gap.description}
              </div>
            ))}
          </div>
        )}

        {/* Suggested Angle */}
        {rec.suggested_angle && (
          <div className="p-2 bg-blue-50 rounded mb-3">
            <div className="font-semibold text-blue-800">💡 Suggested Angle:</div>
            <div className="text-blue-600">{rec.suggested_angle}</div>
          </div>
        )}

        {/* Generate Pitch Button */}
        <div className="mt-3 pt-3 border-t">
          {!pitch ? (
            <button
              onClick={() => onGeneratePitch(rec.topic, rec.evidence, format)}
              disabled={generatingPitch}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {generatingPitch ? '⏳ Generating Pitch...' : '✨ Generate Pitch (Claude)'}
            </button>
          ) : (
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <div className="font-semibold text-green-900 mb-2">✅ Pitch Generated:</div>
              {pitch.title && (
                <div className="mb-2">
                  <span className="font-semibold text-green-800">Title:</span>
                  <div className="text-green-700">{pitch.title}</div>
                </div>
              )}
              {pitch.hook && (
                <div className="mb-2">
                  <span className="font-semibold text-green-800">Hook:</span>
                  <div className="text-green-700">{pitch.hook}</div>
                </div>
              )}
              {pitch.angle && (
                <div className="mb-2">
                  <span className="font-semibold text-green-800">Angle:</span>
                  <div className="text-green-700">{pitch.angle}</div>
                </div>
              )}
              {pitch.mainPoints && pitch.mainPoints.length > 0 && (
                <div className="mb-2">
                  <span className="font-semibold text-green-800">Main Points:</span>
                  <ul className="list-disc list-inside ml-2 mt-1 text-green-700">
                    {pitch.mainPoints.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {pitch.cta && (
                <div>
                  <span className="font-semibold text-green-800">CTA:</span>
                  <div className="text-green-700">{pitch.cta}</div>
                </div>
              )}
              <button
                onClick={() => onGeneratePitch(rec.topic, rec.evidence, format)}
                disabled={generatingPitch}
                className="mt-2 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-400"
              >
                {generatingPitch ? '⏳ Generating...' : '🔄 Regenerate'}
              </button>
            </div>
          )}
        </div>
        
        {/* Feedback Buttons */}
        <div className="mt-4 pt-4 border-t">
          <FeedbackButtons
            recommendation={rec}
            showId={showId}
            sessionId={`session-${Date.now()}-${rec.topic?.substring(0, 20)}`}
            onFeedback={(action, recommendation) => {
              console.log(`User ${action}:`, recommendation.topic);
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Learning Stats */}
        <div className="mb-6">
          <LearningStats showId={showId} />
        </div>
        
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🧠 Content Intelligence
            </h1>
            <p className="text-gray-600">
              AI-powered content recommendations based on your audience data
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
            {/* Story Ideas Button */}
            <Link
              href={`/story-ideas?showId=${showId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              📚 Story Ideas
            </Link>
            {/* Engine Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setUseV2(false);
                  if (!recommendations) fetchRecommendations();
                }}
                className={`px-4 py-2 rounded-md transition-colors ${
                  !useV2 ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                V3
              </button>
              <button
                onClick={() => {
                  setUseV2(true);
                  if (!v2Recommendations) fetchV2Recommendations();
                }}
                className={`px-4 py-2 rounded-md transition-colors ${
                  useV2 ? 'bg-purple-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                V2
              </button>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={useV2 ? fetchV2Recommendations : fetchRecommendations}
              disabled={useV2 ? v2Loading : loading}
              className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-md disabled:bg-gray-400"
            >
              {useV2 ? (v2Loading ? 'Loading...' : '🔄 Refresh') : (loading ? 'Loading...' : '🔄 Refresh')}
            </button>
            
            {/* Add Trend Button */}
            <button
              onClick={() => setShowAddTrend(!showAddTrend)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
            >
              + Add Manual Trend
            </button>
          </div>
        </div>

        {/* Add Trend Form */}
        {showAddTrend && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Add Manual Trend / Idea</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newTrend.type}
                  onChange={(e) => setNewTrend({ ...newTrend, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="idea">Topic Idea</option>
                  <option value="twitter">Twitter URL</option>
                  <option value="tiktok">TikTok URL</option>
                  <option value="url">Any URL</option>
                </select>
              </div>
              
              {newTrend.type === 'idea' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Topic *
                    </label>
                    <input
                      type="text"
                      value={newTrend.topic}
                      onChange={(e) => setNewTrend({ ...newTrend, topic: e.target.value })}
                      placeholder="e.g. الاقتصاد الإسلامي"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTrend.description}
                      onChange={(e) => setNewTrend({ ...newTrend, description: e.target.value })}
                      placeholder="Why is this important?"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={newTrend.url}
                    onChange={(e) => setNewTrend({ ...newTrend, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Note
                </label>
                <textarea
                  value={newTrend.note}
                  onChange={(e) => setNewTrend({ ...newTrend, note: e.target.value })}
                  placeholder="Why did you spot this? What's the trend?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suggested Persona (optional)
                </label>
                <select
                  value={newTrend.persona}
                  onChange={(e) => setNewTrend({ ...newTrend, persona: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Auto-detect</option>
                  <option value="geopolitics">🌍 المحلل الجيوسياسي</option>
                  <option value="investor">📊 المستثمر الفردي</option>
                  <option value="tech_future">💻 متابع التقنية</option>
                  <option value="egyptian_business">🇪🇬 رجل الأعمال المصري</option>
                  <option value="gulf_oil">🛢️ متابع النفط الخليجي</option>
                  <option value="curious_learner">🎓 المتعلم الفضولي</option>
                  <option value="employee">👔 الموظف - الاقتصاد الشخصي</option>
                  <option value="student_entrepreneur">🚀 الطالب - ريادة الأعمال</option>
                </select>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={addTrend}
                  disabled={addingTrend || (newTrend.type === 'idea' && !newTrend.topic) || (newTrend.type !== 'idea' && !newTrend.url)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {addingTrend ? 'Adding...' : 'Add Trend'}
                </button>
                <button
                  onClick={() => {
                    setShowAddTrend(false)
                    setNewTrend({ type: 'idea', topic: '', description: '', url: '', note: '', persona: '' })
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Status */}
        {dataStatus && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">📊 Data Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Videos</div>
                <div className="text-2xl font-bold">{dataStatus.available.videos}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Comments</div>
                <div className="text-2xl font-bold">{dataStatus.available.comments}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Channels</div>
                <div className="text-2xl font-bold">{dataStatus.available.otherChannels}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Search Terms</div>
                <div className="text-2xl font-bold">{dataStatus.available.searchTerms}</div>
              </div>
            </div>
            {dataStatus.lastImported && (
              <div className="mt-4 text-sm text-gray-500">
                Last imported: {new Date(dataStatus.lastImported).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Quick Score Topic */}
        <div className="mb-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">⚡ Quick Score Topic</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={scoringTopic}
              onChange={(e) => setScoringTopic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && scoreTopic()}
              placeholder="Enter a topic to score with evidence..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={scoreTopic}
              disabled={scoring || !scoringTopic.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {scoring ? 'Scoring...' : 'Score'}
            </button>
          </div>
          
          {scoreResult && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-2xl font-bold">{scoreResult.totalScore} / 100</div>
                  <div className="text-sm text-gray-600">{scoreResult.recommendation}</div>
                </div>
                {scoreResult.primaryPersona && (
                  <div className="text-right">
                    <div className="font-semibold">{scoreResult.primaryPersona.name}</div>
                    {scoreResult.primaryPersona.reason && (
                      <div className="text-sm text-gray-600">
                        {scoreResult.primaryPersona.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {scoreResult.evidence && scoreResult.evidence.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold mb-2">Evidence:</div>
                  <div className="space-y-2">
                    {scoreResult.evidence.map((ev, i) => (
                      <div key={i} className="text-sm text-gray-700">
                        • {ev.summary}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {scoreResult.suggestedAngle && (
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="text-sm font-semibold text-blue-900 mb-1">Suggested Angle:</div>
                  <div className="text-sm text-blue-800">{scoreResult.suggestedAngle}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {(useV2 ? v2Loading : loading) ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg font-medium">Loading recommendations...</div>
            <div className="text-sm text-gray-400 mt-2">This may take 10-20 seconds for AI analysis...</div>
            <div className="mt-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        ) : (useV2 ? v2Recommendations : recommendations) ? (
          <div className="space-y-8">
            {/* Error Message */}
            {(useV2 ? v2Recommendations?.error : recommendations?.error) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-800 font-semibold">Error loading recommendations</div>
                <div className="text-red-600 text-sm mt-1">{useV2 ? v2Recommendations?.error : recommendations?.error}</div>
                <button
                  onClick={useV2 ? fetchV2Recommendations : fetchRecommendations}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}

            {/* V2 Intelligence Engine Recommendations */}
            {useV2 && (
              <div className="mb-8">
                {v2Loading ? (
                  <div className="text-center py-8">Loading V2 recommendations...</div>
                ) : v2Recommendations?.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-red-800">Error: {v2Recommendations.error}</div>
                  </div>
                ) : v2Recommendations?.recommendations && v2Recommendations.recommendations.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">
                      🧠 Intelligence Engine V2 Recommendations
                </h2>
                    
                    {/* Summary */}
                    {v2Recommendations.summary && (
                      <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-sm text-purple-600">Total</div>
                            <div className="text-2xl font-bold">{v2Recommendations.summary.total}</div>
                          </div>
                          <div>
                            <div className="text-sm text-green-600">Highly Recommended</div>
                            <div className="text-2xl font-bold">{v2Recommendations.summary.highly_recommended}</div>
                          </div>
                          <div>
                            <div className="text-sm text-blue-600">Recommended</div>
                            <div className="text-2xl font-bold">{v2Recommendations.summary.recommended}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Consider</div>
                            <div className="text-2xl font-bold">{v2Recommendations.summary.consider}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Data Sources */}
                    {v2Recommendations.data_sources && (
                      <div className="mb-6 p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="font-semibold mb-2">Data Sources:</div>
                        <div className="grid grid-cols-5 gap-2">
                          <div>🔍 {v2Recommendations.data_sources.search_terms} search terms</div>
                          <div>🎬 {v2Recommendations.data_sources.competitor_videos} competitor videos</div>
                          <div>💬 {v2Recommendations.data_sources.comments} comments</div>
                          <div>📰 {v2Recommendations.data_sources.signals} signals</div>
                          <div>✋ {v2Recommendations.data_sources.manual_trends} manual trends</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Recommendations List */}
                <div className="space-y-4">
                      {v2Recommendations.recommendations.map((rec, i) => (
                        <RecommendationCardV2 
                          key={i} 
                          rec={rec} 
                          onGeneratePitch={generatePitch}
                          generatingPitch={generatingPitch[rec.topic]}
                          pitch={pitches[rec.topic]}
                          showId={showId}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <div className="text-gray-600 mb-4">No V2 recommendations available</div>
                    <button
                      onClick={fetchV2Recommendations}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >
                      Load V2 Recommendations
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Simple Intelligence Recommendations */}
            {!useV2 && recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">
                  🧠 Simple Intelligence Recommendations (FREE - No AI)
                </h2>
                {recommendations.ai_calls !== undefined && (
                  <div className="mb-4 p-2 bg-green-50 rounded text-sm text-green-700">
                    ✅ AI Calls: {recommendations.ai_calls} (FREE keyword-based scoring)
                  </div>
                )}
                <div className="space-y-4">
                  {recommendations.recommendations.slice(0, 20).map((rec, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${
                      rec.level === 'HIGHLY_RECOMMENDED' 
                        ? 'bg-green-50 border-green-200' 
                        : rec.level === 'RECOMMENDED'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-lg mb-1">{rec.topic}</div>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                            <span>Score: <strong>{rec.score || rec.totalScore || 0} / 100</strong></span>
                            <span className={`px-2 py-1 rounded ${
                              (rec.level || rec.recommendation) === 'HIGHLY_RECOMMENDED' 
                                ? 'bg-green-100 text-green-800'
                                : (rec.level || rec.recommendation) === 'RECOMMENDED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {rec.level || rec.recommendation || 'CONSIDER'}
                            </span>
                            {rec.format && (
                              <span>{rec.format.icon} {rec.format.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Format Recommendation */}
                      {rec.format && (
                        <div className="mb-3 p-2 bg-purple-50 rounded">
                          <div className="font-semibold text-purple-800">
                            {rec.format.icon} Suggested Format: {rec.format.name || rec.format.label}
                          </div>
                          <div className="text-sm text-purple-600">
                            {rec.format.reason}
                          </div>
                        </div>
                      )}
                      
                      {/* Summary and Angle */}
                      {rec.summary && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                          <div className="font-semibold text-gray-800 mb-1">📝 Summary:</div>
                          <div className="text-sm text-gray-700">{rec.summary}</div>
                        </div>
                      )}
                      
                      {rec.angle && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                          <div className="font-semibold text-blue-800 mb-1">🎯 Suggested Angle:</div>
                          <div className="text-sm text-blue-700">{rec.angle}</div>
                        </div>
                      )}
                      
                      {/* Evidence Section - Full Details */}
                      {rec.evidence && (
                        <div className="mt-4 space-y-3">
                          <h4 className="font-semibold text-gray-700">📊 Evidence:</h4>
                          
                          {/* Search Terms */}
                          {rec.evidence.search_terms && rec.evidence.search_terms.length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <div className="font-medium text-blue-800 mb-2">🔍 Search Terms:</div>
                              <div className="flex flex-wrap gap-2">
                                {rec.evidence.search_terms.slice(0, 5).map((term, i) => (
                                  <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                    {term.term} ({term.volume?.toLocaleString() || 0})
                                  </span>
                                ))}
                              </div>
                              {rec.evidence.total_search_volume > 0 && (
                                <div className="text-sm text-blue-600 mt-1">
                                  Total Search Volume: {rec.evidence.total_search_volume.toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Current Events */}
                          {rec.evidence.current_events && rec.evidence.current_events.length > 0 && (
                            <div className="bg-red-50 p-3 rounded-lg">
                              <div className="font-medium text-red-800 mb-2">📰 Current News:</div>
                              <ul className="space-y-1">
                                {rec.evidence.current_events.slice(0, 3).map((event, i) => (
                                  <li key={i} className="text-sm text-red-700">
                                    • {event.title} <span className="text-red-500">({event.source || 'RSS'})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Competitor Videos */}
                          {rec.evidence.competitor_videos && rec.evidence.competitor_videos.length > 0 && (
                            <div className="bg-purple-50 p-3 rounded-lg">
                              <div className="font-medium text-purple-800 mb-2">🎬 فيديوهات المنافسين:</div>
                              <ul className="space-y-2">
                                {rec.evidence.competitor_videos.slice(0, 3).map((video, i) => (
                                  <li key={i} className="text-sm text-purple-700">
                                    <div className="font-medium">
                                      • {video.title?.substring(0, 60)}{video.title?.length > 60 ? '...' : ''}
                                    </div>
                                    {video.description && (
                                      <div className="text-xs text-purple-600 mt-1 italic">
                                        {video.description.substring(0, 100)}{video.description.length > 100 ? '...' : ''}
                                      </div>
                                    )}
                                    <div className="text-xs text-purple-600 mt-1">
                                      <span className="font-semibold">{video.views?.toLocaleString() || 0} views</span>
                                      {video.creator && (
                                        <span> • {video.creator}</span>
                                      )}
                                      {video.performance && (
                                        <span className={`ml-2 px-1.5 py-0.5 rounded ${
                                          video.performance === 'viral' ? 'bg-red-200 text-red-800' :
                                          video.performance === 'success' ? 'bg-green-200 text-green-800' :
                                          'bg-gray-200 text-gray-800'
                                        }`}>
                                          {video.performance === 'viral' ? '🔥 Viral' :
                                           video.performance === 'success' ? '✅ Success' : '📊 Average'}
                                        </span>
                                      )}
                                    </div>
                                    {video.insight && (
                                      <div className="text-xs text-purple-600 mt-1 bg-purple-100 p-1.5 rounded">
                                        💡 {video.insight}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Audience Comments */}
                          {rec.evidence.audience_comments && rec.evidence.audience_comments.length > 0 && (
                            <div className="bg-green-50 p-3 rounded-lg">
                              <div className="font-medium text-green-800 mb-2">💬 Audience Comments:</div>
                              <ul className="space-y-2">
                                {rec.evidence.audience_comments.slice(0, 3).map((comment, i) => (
                                  <li key={i} className="text-sm text-green-700 bg-green-100 p-2 rounded">
                                    "{comment.text?.substring(0, 100)}{comment.text?.length > 100 ? '...' : ''}"
                                    <span className="text-green-500 text-xs block mt-1">
                                      — {comment.author || 'مجهول'} ({comment.likes || 0} likes)
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Audience Interest Breakdown */}
                          {rec.evidence.audience_interest && (
                            <div className="bg-yellow-50 p-3 rounded-lg">
                              <div className="font-medium text-yellow-800 mb-2">📈 Interest Breakdown:</div>
                              <div className="text-sm text-yellow-700 space-y-1">
                                <div>Total: {rec.evidence.audience_interest.total_score || 0}</div>
                                <div>From Comments: {rec.evidence.audience_interest.from_comments || 0}</div>
                                <div>From Search: {rec.evidence.audience_interest.from_searches || 0}</div>
                                <div>From Videos: {rec.evidence.audience_interest.from_video_engagement || 0}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Legacy format support - show counts if arrays are empty */}
                          {(!rec.evidence.search_terms || rec.evidence.search_terms.length === 0) && 
                           (!rec.evidence.current_events || rec.evidence.current_events.length === 0) && 
                           (!rec.evidence.competitor_videos || rec.evidence.competitor_videos.length === 0) && 
                           (!rec.evidence.audience_comments || rec.evidence.audience_comments.length === 0) && (
                            <div className="mb-3 text-sm">
                              <ul className="list-disc list-inside text-gray-600">
                                {rec.evidence.search_volume > 0 && (
                                  <li>🔍 {rec.evidence.search_volume.toLocaleString()} searches</li>
                                )}
                                {(rec.evidence.competitor_videos > 0 || rec.evidence.competitor_coverage > 0) && (
                                  <li>🎬 {rec.evidence.competitor_videos || rec.evidence.competitor_coverage || 0} competitor videos</li>
                                )}
                                {rec.evidence.audience_interest > 0 && (
                                  <li>💬 {rec.evidence.audience_interest} تعليق يطلب الموضوع</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Audience Behavior */}
                      {rec.audience_behavior && (
                        <div className="mt-3 bg-yellow-50 p-3 rounded-lg">
                          <div className="font-medium text-yellow-800 mb-2">🎯 سلوك الجمهور:</div>
                          <div className="text-sm text-yellow-700 space-y-1">
                            <div><strong>الفئة:</strong> {rec.audience_behavior.cluster}</div>
                            <div><strong>السؤال:</strong> {rec.audience_behavior.core_question}</div>
                            <div><strong>الدافع:</strong> {rec.audience_behavior.why_they_care}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Context - Why this is recommended */}
                      {rec.context && (
                        <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                          <div className="font-medium text-indigo-800 mb-2">💡 Context:</div>
                          <div className="text-sm text-indigo-700 space-y-1">
                            {rec.context.economic_angle && (
                              <div><strong>Economic Angle:</strong> {rec.context.economic_angle}</div>
                            )}
                            {rec.context.why_now && (
                              <div><strong>Why Now:</strong> {rec.context.why_now}</div>
                            )}
                            {rec.context.audience_interest && (
                              <div><strong>Audience Interest:</strong> {rec.context.audience_interest}</div>
                            )}
                            {rec.context.core_interest && (
                              <div><strong>الاهتمام الأساسي:</strong> {rec.context.core_interest}</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Suggested Approach */}
                      {rec.suggested_approach && (
                        <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
                          <div className="font-medium text-teal-800 mb-2">🎯 Suggested Approach:</div>
                          <div className="text-sm text-teal-700 space-y-2">
                            {rec.suggested_approach.title && (
                              <div>
                                <strong>Suggested Title:</strong> 
                                <div className="mt-1 font-semibold">{rec.suggested_approach.title}</div>
                              </div>
                            )}
                            {rec.suggested_approach.angle && (
                              <div>
                                <strong>Angle:</strong> 
                                <div className="mt-1">{rec.suggested_approach.angle}</div>
                              </div>
                            )}
                            {rec.suggested_approach.insight && (
                              <div className="bg-teal-100 p-2 rounded">
                                <strong>💡 Insight:</strong> {rec.suggested_approach.insight}
                              </div>
                            )}
                            {rec.suggested_approach.format && (
                              <div className="text-xs text-teal-600">
                                Format: {rec.suggested_approach.format === 'long_form' ? 'Long-form Video' : 'Short-form Video'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Competitor Proof */}
                      {rec.evidence.competitor_proof && rec.evidence.competitor_proof.length > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                          <div className="font-medium text-purple-800 mb-2">✅ Competitor Success Proof:</div>
                          <ul className="space-y-2">
                            {rec.evidence.competitor_proof.slice(0, 3).map((proof, i) => {
                              // Handle both single proof object and array of videos
                              const videos = Array.isArray(proof.videos) ? proof.videos : [proof];
                              return videos.map((video, j) => (
                                <li key={`${i}-${j}`} className="text-sm text-purple-700">
                                  <div className="font-medium">
                                    • {video.original_video || video.title || 'Competitor Video'}
                                  </div>
                                  <div className="text-xs text-purple-600 mt-1">
                                    <span className="font-semibold">{video.views?.toLocaleString() || 0} views</span>
                                    {video.creator && (
                                      <span> • {video.creator}</span>
                                    )}
                                  </div>
                                  {video.insight && (
                                    <div className="text-xs text-purple-600 mt-1 bg-purple-100 p-1.5 rounded">
                                      💡 {video.insight}
                                    </div>
                                  )}
                                </li>
                              ));
                            })}
                          </ul>
                          {rec.evidence.competitor_proof[0]?.count > 1 && (
                            <div className="text-xs text-purple-600 mt-2">
                              Total: {rec.evidence.competitor_proof[0].count} videos
                              {rec.evidence.competitor_proof[0].total_views && (
                                <span> • {rec.evidence.competitor_proof[0].total_views.toLocaleString()} total views</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Recommendation Reason */}
                      {rec.recommendation_reason && (
                        <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                          <div className="font-medium text-indigo-800 mb-1">💡 Why This Recommendation:</div>
                          <div className="text-sm text-indigo-700">{rec.recommendation_reason}</div>
                        </div>
                      )}
                      
                      {/* Legacy Evidence Format (array) */}
                      {rec.evidence && Array.isArray(rec.evidence) && rec.evidence.length > 0 && (
                        <div className="mt-3 mb-3">
                          <div className="text-sm font-semibold mb-1">Evidence:</div>
                          <div className="space-y-1">
                            {rec.evidence.map((ev, j) => (
                              <div key={j} className="text-sm text-gray-700">
                                {ev.type} {ev.summary} (+{ev.points} pts)
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Generate Pitch Button */}
                      <div className="mt-3 pt-3 border-t">
                        {!pitches[rec.topic] ? (
                          <button
                            onClick={() => generatePitch(rec.topic, rec.evidence, rec.format)}
                            disabled={generatingPitch[rec.topic]}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {generatingPitch[rec.topic] ? '⏳ Generating Pitch...' : '✨ Generate Pitch (Claude)'}
                          </button>
                        ) : (
                          <div className="p-3 bg-green-50 rounded border border-green-200">
                            <div className="font-semibold text-green-900 mb-2">✅ Pitch Generated:</div>
                            {pitches[rec.topic].title && (
                              <div className="mb-2">
                                <span className="font-semibold text-green-800">Title:</span>
                                <div className="text-green-700">{pitches[rec.topic].title}</div>
                        </div>
                      )}
                            {pitches[rec.topic].hook && (
                              <div className="mb-2">
                                <span className="font-semibold text-green-800">Hook:</span>
                                <div className="text-green-700">{pitches[rec.topic].hook}</div>
                              </div>
                            )}
                            {pitches[rec.topic].angle && (
                              <div className="mb-2">
                                <span className="font-semibold text-green-800">Angle:</span>
                                <div className="text-green-700">{pitches[rec.topic].angle}</div>
                              </div>
                            )}
                            {pitches[rec.topic].mainPoints && pitches[rec.topic].mainPoints.length > 0 && (
                              <div className="mb-2">
                                <span className="font-semibold text-green-800">Main Points:</span>
                                <ul className="list-disc list-inside ml-2 mt-1 text-green-700">
                                  {pitches[rec.topic].mainPoints.map((point, idx) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {pitches[rec.topic].cta && (
                              <div>
                                <span className="font-semibold text-green-800">CTA:</span>
                                <div className="text-green-700">{pitches[rec.topic].cta}</div>
                              </div>
                            )}
                            <button
                              onClick={() => generatePitch(rec.topic, rec.evidence, rec.format)}
                              disabled={generatingPitch[rec.topic]}
                              className="mt-2 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-400"
                            >
                              {generatingPitch[rec.topic] ? '⏳ Generating...' : '🔄 Regenerate'}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Audience Behavior Insights */}
                      {(() => {
                        const behaviorData = rec.behaviorUI || rec.behavior;
                        
                        // Debug log
                        if (process.env.NODE_ENV === 'development' && rec.topic) {
                          console.log('Recommendation behavior check:', {
                            topic: rec.topic?.substring(0, 30),
                            hasBehaviorUI: !!rec.behaviorUI,
                            hasBehavior: !!rec.behavior,
                            behaviorData: behaviorData ? 'found' : 'not found',
                            recKeys: Object.keys(rec)
                          });
                        }
                        
                        return behaviorData ? (
                          <BehaviorInsightPanel behavior={behaviorData} />
                        ) : null;
                      })()}
                      
                      {rec.pitch && (
                        <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                          <div className="text-sm font-semibold text-green-900 mb-2">Pitch:</div>
                          {typeof rec.pitch === 'object' ? (
                            <div className="text-sm text-green-800 space-y-2">
                              {rec.pitch.title && (
                                <div>
                                  <span className="font-semibold">العنوان:</span> {rec.pitch.title}
                                </div>
                              )}
                              {rec.pitch.hook && (
                                <div>
                                  <span className="font-semibold">Hook:</span> {rec.pitch.hook}
                                </div>
                              )}
                              {rec.pitch.angle && (
                                <div>
                                  <span className="font-semibold">Angle:</span> {rec.pitch.angle}
                                </div>
                              )}
                              {rec.pitch.mainPoints && rec.pitch.mainPoints.length > 0 && (
                                <div>
                                  <span className="font-semibold">النقاط الرئيسية:</span>
                                  <ul className="list-disc list-inside ml-2 mt-1">
                                    {rec.pitch.mainPoints.map((point, idx) => (
                                      <li key={idx}>{point}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {rec.pitch.cta && (
                                <div>
                                  <span className="font-semibold">CTA:</span> {rec.pitch.cta}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-green-800 whitespace-pre-line">{String(rec.pitch)}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Feedback Buttons */}
                      <div className="mt-4 pt-4 border-t">
                        <FeedbackButtons
                          recommendation={rec}
                          showId={showId}
                          sessionId={`session-${Date.now()}-${rec.topic?.substring(0, 20)}`}
                          onFeedback={(action, recommendation) => {
                            console.log(`User ${action}:`, recommendation.topic);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-yellow-800 font-semibold mb-2">No recommendations yet</div>
                <div className="text-yellow-700 text-sm">
                  <p className="mb-2">This could be because:</p>
                  <ul className="list-disc list-inside space-y-1 mb-4">
                    <li>No RSS items were provided to analyze</li>
                    <li>All items were filtered out (too low relevance)</li>
                    <li>API keys (GROQ_API_KEY or ANTHROPIC_API_KEY) are missing</li>
                    <li>No data in Supabase tables (search_terms, videos, comments, signals)</li>
                  </ul>
                  <p className="mb-2 font-semibold">Try:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Adding a manual trend using the button above</li>
                    <li>Scoring a topic using the "Quick Score Topic" section</li>
                    <li>Checking browser console for detailed error messages</li>
                    <li>Verifying API keys in your <code className="bg-yellow-100 px-1 rounded">.env.local</code> file</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            {recommendations?.summary && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">📊 Summary</h2>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm opacity-90">Total</div>
                    <div className="text-3xl font-bold">{recommendations.summary.total || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-90">Highly Recommended</div>
                    <div className="text-3xl font-bold">{recommendations.summary.highly_recommended || recommendations.summary.highlyRecommended || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-90">Recommended</div>
                    <div className="text-3xl font-bold">{recommendations.summary.recommended || 0}</div>
                  </div>
                </div>
                {recommendations.summary.byPersona && Object.keys(recommendations.summary.byPersona).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <div className="text-sm opacity-90 mb-2">Top Picks by Persona:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(recommendations.summary.byPersona).map(([personaId, items]) => (
                        <div key={personaId} className="bg-white/20 px-3 py-1 rounded text-sm">
                          {personaId}: {items.length}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Debug Info (only in development) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="bg-gray-100 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-gray-700">Debug Info</summary>
                <pre className="mt-2 text-xs overflow-auto max-h-64 bg-white p-3 rounded border">
                  {JSON.stringify(recommendations, null, 2)}
                </pre>
              </details>
            )}

            {/* Legacy Format Support */}
            {/* Urgent Persona Needs */}
            {recommendations?.urgentPersonaNeeds?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-red-900 mb-4">
                  🔥 Urgent: Personas Needing Content
                </h2>
                <div className="space-y-4">
                  {recommendations.urgentPersonaNeeds.map((persona, i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-red-300">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{persona.icon}</span>
                        <div>
                          <div className="font-semibold text-lg">{persona.persona}</div>
                          <div className="text-sm text-gray-600">{persona.reason}</div>
                        </div>
                      </div>
                      {persona.suggestedTopics.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-semibold mb-1">Suggested Topics:</div>
                          <div className="flex flex-wrap gap-2">
                            {persona.suggestedTopics.map((topic, j) => (
                              <span key={j} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audience Questions */}
            {recommendations?.audienceQuestions?.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">❓ Top Questions from Audience</h2>
                <div className="space-y-3">
                  {recommendations.audienceQuestions.map((q, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="font-semibold mb-1">{q.question}</div>
                      <div className="text-sm text-gray-600">
                        {q.likes} likes • {q.source}
                      </div>
                      <div className="mt-2 text-sm text-blue-600">{q.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topic Opportunities */}
            {recommendations?.topicOpportunities?.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">🎯 Topic Opportunities</h2>
                <div className="space-y-3">
                  {recommendations.topicOpportunities.map((opp, i) => (
                    <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{opp.topic}</div>
                        <span className={`px-2 py-1 rounded text-sm ${
                          opp.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {opp.priority}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        Audience Interest: {opp.audienceInterest} videos watched
                      </div>
                      <div className="text-sm text-blue-700">{opp.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitor Inspiration */}
            {recommendations?.competitorInspiration?.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">📺 Competitor Inspiration</h2>
                <div className="space-y-3">
                  {recommendations.competitorInspiration.map((comp, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="font-semibold mb-1">{comp.originalTitle}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {comp.sourceType} • {comp.source}
                      </div>
                      {comp.ourAngle && (
                        <div className="text-sm text-blue-600">{comp.ourAngle}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comment Ideas */}
            {recommendations?.commentIdeas?.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">💡 Ideas from Comments</h2>
                <div className="space-y-3">
                  {recommendations.commentIdeas.map((idea, i) => (
                    <div key={i} className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="font-semibold mb-1">{idea.idea}</div>
                      <div className="text-sm text-gray-600">
                        {idea.likes} likes • {idea.source}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary (Legacy Format) */}
            {recommendations?.summary?.topRecommendation && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">📊 Summary</h2>
                  <div className="bg-white/20 rounded-lg p-4">
                    <div className="font-semibold text-lg mb-1">
                      {recommendations.summary.topRecommendation.message}
                    </div>
                    <div className="text-sm opacity-90">
                      Action: {recommendations.summary.topRecommendation.action}
                    </div>
                  </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">No recommendations available</div>
          </div>
        )}
      </div>
    </div>
  )
}

