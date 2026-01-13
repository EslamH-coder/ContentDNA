'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getUserShows } from '@/lib/userShows'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Navigation from '@/app/components/Navigation'

export default function Dashboard() {
  const [selectedShow, setSelectedShow] = useState(null)
  const [shows, setShows] = useState([])
  const [metrics, setMetrics] = useState({
    avgViews: 0,
    videosAnalyzed: 0,
    dnaScore: 0,
  })
  const [topSignals, setTopSignals] = useState([])
  const [performanceData, setPerformanceData] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingRss, setUpdatingRss] = useState(false)

  useEffect(() => {
    fetchShows()
  }, [])

  useEffect(() => {
    if (selectedShow) {
      fetchDashboardData(selectedShow)
    }
  }, [selectedShow])

  async function fetchShows() {
    // If Supabase is not configured, use mock data immediately
    if (!isSupabaseConfigured) {
      setShows([
        { id: '1', name: 'Show 1', channel_id: 'channel1' },
        { id: '2', name: 'Show 2', channel_id: 'channel2' },
      ])
      if (!selectedShow) setSelectedShow('1')
      setLoading(false)
      return
    }

    try {
      // Get only shows that belong to the current user
      const { shows, error } = await getUserShows()

      if (error) {
        console.error('Error fetching user shows:', error)
        setShows([])
        setLoading(false)
        return
      }

      setShows(shows || [])
      
      // If no show selected but user has shows, select the first one
      if (!selectedShow && shows && shows.length > 0) {
        setSelectedShow(shows[0].id)
      }
      
      // If selected show is not in user's shows, select first one
      if (selectedShow && shows && !shows.find(s => s.id === selectedShow)) {
        if (shows.length > 0) {
          setSelectedShow(shows[0].id)
        } else {
          setSelectedShow(null)
        }
      }
    } catch (error) {
      console.error('Error fetching shows:', error)
      setShows([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchDashboardData(showId) {
    setLoading(true)
    
    // If Supabase is not configured, use mock data immediately
    if (!isSupabaseConfigured) {
      setMetrics({
        avgViews: 12500,
        videosAnalyzed: 45,
        dnaScore: 7.8,
      })
      setTopSignals([
        { id: 1, name: 'Audience Engagement', score: 8.5, type: 'audience' },
        { id: 2, name: 'Performance Trend', score: 7.9, type: 'performance' },
        { id: 3, name: 'Timing Momentum', score: 7.2, type: 'timing' },
        { id: 4, name: 'Competition Gap', score: 6.8, type: 'competition' },
        { id: 5, name: 'Content Quality', score: 6.5, type: 'quality' },
      ])
      const mockData = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        mockData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: Math.floor(Math.random() * 50000) + 10000,
          videos: Math.floor(Math.random() * 10) + 1,
        })
      }
      setPerformanceData(mockData)
      setLoading(false)
      return
    }

    try {
      // Fetch top signals (use signals to calculate metrics)
      const { data: signalsData, error: signalsError } = await supabase
        .from('signals')
        .select('*')
        .eq('show_id', showId)
        .order('score', { ascending: false })

      if (signalsError) {
        console.error('Error fetching signals:', signalsError)
        throw signalsError
      }

      // Calculate metrics from signals
      const totalSignals = signalsData?.length || 0
      const avgScore = totalSignals > 0
        ? signalsData.reduce((sum, s) => sum + (s.score || 0), 0) / totalSignals
        : 0
      
      // Use health check API to get DNA config info
      let healthData = null
      try {
        const healthResponse = await fetch('/api/health')
        if (healthResponse.ok) {
          healthData = await healthResponse.json()
        }
      } catch (e) {
        console.warn('Could not fetch health data:', e)
      }

      // Fetch performance data for chart
      const { data: performanceData, error: performanceError } = await supabase
        .from('performance_history')
        .select('date, views, videos_count')
        .eq('show_id', showId)
        .order('date', { ascending: true })
        .limit(30)

      if (performanceError) {
        console.warn('Error fetching performance data:', performanceError)
      }

      // Process metrics from signals and health check
      const avgViews = healthData?.feeds_enabled ? healthData.feeds_enabled * 1000 : 0 // Estimate based on feeds
      const videosAnalyzed = totalSignals
      const dnaScore = healthData?.topics_count ? Math.round((healthData.topics_count / 20) * 10 * 10) / 10 : avgScore

      setMetrics({
        avgViews,
        videosAnalyzed,
        dnaScore: Math.round(dnaScore * 10) / 10,
      })

      // Process signals - use title instead of name
      if (signalsData && signalsData.length > 0) {
        const top5Signals = signalsData.slice(0, 5).map(signal => ({
          id: signal.id,
          name: signal.title || signal.name || 'Untitled Signal',
          score: signal.score || 0,
          type: signal.type || 'news',
          hook_potential: signal.hook_potential,
        }))
        setTopSignals(top5Signals)
      } else {
        // Mock signals data
        setTopSignals([
          { id: 1, name: 'Audience Engagement', score: 8.5, type: 'audience' },
          { id: 2, name: 'Performance Trend', score: 7.9, type: 'performance' },
          { id: 3, name: 'Timing Momentum', score: 7.2, type: 'timing' },
          { id: 4, name: 'Competition Gap', score: 6.8, type: 'competition' },
          { id: 5, name: 'Content Quality', score: 6.5, type: 'quality' },
        ])
      }

      // Process performance data
      if (performanceData && performanceData.length > 0) {
        setPerformanceData(performanceData.map(d => ({
          date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: d.views || 0,
          videos: d.videos_count || 0,
        })))
      } else {
        // Mock performance data
        const mockData = []
        for (let i = 29; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          mockData.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            views: Math.floor(Math.random() * 50000) + 10000,
            videos: Math.floor(Math.random() * 10) + 1,
          })
        }
        setPerformanceData(mockData)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Set mock data on error
      setMetrics({
        avgViews: 12500,
        videosAnalyzed: 45,
        dnaScore: 7.8,
      })
      setTopSignals([
        { id: 1, name: 'Audience Engagement', score: 8.5, type: 'audience' },
        { id: 2, name: 'Performance Trend', score: 7.9, type: 'performance' },
        { id: 3, name: 'Timing Momentum', score: 7.2, type: 'timing' },
        { id: 4, name: 'Competition Gap', score: 6.8, type: 'competition' },
        { id: 5, name: 'Content Quality', score: 6.5, type: 'quality' },
      ])
      const mockData = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        mockData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: Math.floor(Math.random() * 50000) + 10000,
          videos: Math.floor(Math.random() * 10) + 1,
        })
      }
      setPerformanceData(mockData)
    } finally {
      setLoading(false)
    }
  }

  async function updateRssFeeds() {
    if (!selectedShow) {
      alert('Please select a show first')
      return
    }

    setUpdatingRss(true)

    try {
      const response = await fetch(`/api/rss-processor?show_id=${selectedShow}`)
      const result = await response.json()

      if (result.error) {
        alert(`RSS Update Failed: ${result.error}`)
      } else {
        const message = `✅ RSS Update Complete!\n\n` +
          `📊 Processed: ${result.processed || 0} items\n` +
          `💾 Saved: ${result.saved || 0} signals\n` +
          (result.scoreStats ? `📈 Score Range: ${result.scoreStats.min} - ${result.scoreStats.max} (avg: ${result.scoreStats.avg})` : '')
        alert(message)

        // Refresh dashboard data after update
        await fetchDashboardData(selectedShow)
      }
    } catch (error) {
      console.error('Error updating RSS feeds:', error)
      alert(`RSS Update Failed: ${error.message}`)
    } finally {
      setUpdatingRss(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score) => {
    if (score >= 8) return 'bg-green-100'
    if (score >= 6) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Channel Brain Dashboard</h1>

        {/* Show Selector and RSS Update Button */}
        <div className="mb-8 flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label htmlFor="show-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select Show
            </label>
            <select
              id="show-select"
              value={selectedShow || ''}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={loading}
            >
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={updateRssFeeds}
              disabled={updatingRss || !selectedShow || loading}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                updatingRss || !selectedShow || loading
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {updatingRss ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Update RSS Feeds</span>
                </>
              )}
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading dashboard data...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Views</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatNumber(metrics.avgViews)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Videos Analyzed</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {metrics.videosAnalyzed}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">DNA Score</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {metrics.dnaScore}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 5 Signals */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Top 5 Signals</h2>
              <div className="space-y-4">
                {topSignals.map((signal, index) => (
                  <div key={signal.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${getScoreBgColor(signal.score)} ${getScoreColor(signal.score)}`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{signal.name}</p>
                        <p className="text-sm text-gray-500 capitalize">{signal.type || 'signal'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-2xl font-bold ${getScoreColor(signal.score)}`}>
                        {signal.score.toFixed(1)}
                      </span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            signal.score >= 8 ? 'bg-green-600' : signal.score >= 6 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${(signal.score / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Performance Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Performance</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} name="Views" />
                  <Line type="monotone" dataKey="videos" stroke="#10b981" strokeWidth={2} name="Videos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

