'use client'

import { useState, useEffect } from 'react'
import Navigation from '@/app/components/Navigation'
import { CONTENT_TYPES, SUGGESTED_CHANNELS } from '@/lib/competitors/competitorTypes.js'

export default function CompetitorsPage() {
  const [channels, setChannels] = useState([])
  const [videos, setVideos] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('direct_competitor')
  const [showAddChannelModal, setShowAddChannelModal] = useState(false)
  const [showAddVideoModal, setShowAddVideoModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      const [channelsRes, videosRes, statsRes] = await Promise.all([
        fetch(`/api/competitors/channels?type=${activeTab}`).then(r => r.json()),
        fetch('/api/competitors/videos').then(r => r.json()),
        fetch('/api/competitors/stats').then(r => r.json())
      ])
      
      setChannels(channelsRes.channels || [])
      setVideos(videosRes.videos || [])
      setStats(statsRes)
    } catch (error) {
      console.error('Failed to load:', error)
    }
    setLoading(false)
  }

  async function handleAddChannel(channelData) {
    try {
      const res = await fetch('/api/competitors/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelData)
      })
      
      const data = await res.json()
      if (data.success) {
        await loadData()
        setShowAddChannelModal(false)
      } else {
        alert(data.error || 'Failed to add channel')
      }
    } catch (error) {
      alert('Failed to add channel')
    }
  }

  async function handleAddVideo(videoData) {
    try {
      const res = await fetch('/api/competitors/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoData)
      })
      
      const data = await res.json()
      if (data.success) {
        await loadData()
        setShowAddVideoModal(false)
      } else {
        alert(data.error || 'Failed to add video')
      }
    } catch (error) {
      alert('Failed to add video')
    }
  }

  async function handleToggleMonitor(channelId) {
    try {
      const res = await fetch(`/api/competitors/channels/${channelId}/toggle`, {
        method: 'POST'
      })
      
      const data = await res.json()
      if (data.success) {
        await loadData()
      }
    } catch (error) {
      alert('Failed to toggle monitor')
    }
  }

  async function handleDeleteChannel(channelId) {
    if (!confirm('Are you sure you want to delete this channel?')) return
    
    try {
      const res = await fetch(`/api/competitors/channels?id=${channelId}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      if (data.success) {
        await loadData()
      }
    } catch (error) {
      alert('Failed to delete channel')
    }
  }

  const typeConfig = CONTENT_TYPES[activeTab]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🎯 Content Intelligence</h1>
          <p className="text-gray-600">Track competitors, adjacent content, and format inspiration</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.totalChannels}</div>
              <div className="text-sm text-gray-600">Total Channels</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.activeChannels}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.totalVideos}</div>
              <div className="text-sm text-gray-600">Videos</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold">{stats.newInsights || 0}</div>
              <div className="text-sm text-gray-600">New Insights</div>
            </div>
          </div>
        )}

        {/* Type Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {Object.entries(CONTENT_TYPES).map(([key, type]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="mr-2">{type.icon}</span>
              {type.nameAr}
              {stats && (
                <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {stats.channelsByType?.[key] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Type Description */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{typeConfig.icon}</span>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{typeConfig.nameAr}</h3>
              <p className="text-gray-700 text-sm mb-3">{typeConfig.descriptionAr}</p>
              <div className="text-sm">
                <strong>ماذا نتعلم:</strong>
                <ul className="list-disc list-inside mt-1 text-gray-600">
                  {typeConfig.learnFrom.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddChannelModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ➕ Add Channel
              </button>
              <button
                onClick={() => setShowAddVideoModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                📹 Add Video
              </button>
            </div>
          </div>
        </div>

        {/* Suggested Channels */}
        {SUGGESTED_CHANNELS[activeTab] && channels.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-3">💡 قنوات مقترحة:</h4>
            <div className="grid grid-cols-2 gap-3">
              {SUGGESTED_CHANNELS[activeTab].map((suggestion, i) => (
                <div key={i} className="bg-white p-3 rounded border">
                  <div className="font-medium">{suggestion.name}</div>
                  <div className="text-sm text-gray-600">{suggestion.reason}</div>
                  <button
                    onClick={() => {
                      setShowAddChannelModal(true)
                      // You could pre-fill the form here
                    }}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    ➕ Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              No channels added yet for this type
            </div>
          ) : (
            channels.map(channel => (
              <div key={channel.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold">{channel.name}</h4>
                    {channel.subType && (
                      <span className="text-xs text-gray-500">{channel.subType}</span>
                    )}
                    {channel.formatType && (
                      <span className="text-xs text-gray-500">{channel.formatType}</span>
                    )}
                  </div>
                  <span className={`text-sm ${channel.monitor ? 'text-green-600' : 'text-gray-400'}`}>
                    {channel.monitor ? '✅' : '⏸️'}
                  </span>
                </div>
                
                {channel.reasonToWatch && (
                  <p className="text-sm text-gray-600 mb-2">{channel.reasonToWatch}</p>
                )}
                
                <div className="flex gap-2 mt-3">
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    🔗 Visit
                  </a>
                  <button
                    onClick={() => handleToggleMonitor(channel.id)}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    {channel.monitor ? '⏸️ Pause' : '▶️ Resume'}
                  </button>
                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Channel Modal */}
        {showAddChannelModal && (
          <AddChannelModal
            type={activeTab}
            typeConfig={typeConfig}
            onClose={() => setShowAddChannelModal(false)}
            onAdd={handleAddChannel}
          />
        )}

        {/* Add Video Modal */}
        {showAddVideoModal && (
          <AddVideoModal
            channels={channels}
            onClose={() => setShowAddVideoModal(false)}
            onAdd={handleAddVideo}
          />
        )}
      </div>
    </div>
  )
}

// Add Channel Modal Component
function AddChannelModal({ type, typeConfig, onClose, onAdd }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [subType, setSubType] = useState('')
  const [formatType, setFormatType] = useState('')
  const [reasonToWatch, setReasonToWatch] = useState('')
  const [learnFrom, setLearnFrom] = useState([])
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) {
      alert('URL is required')
      return
    }

    setLoading(true)
    onAdd({
      url,
      name: name || undefined,
      type,
      subType: subType || undefined,
      formatType: formatType || undefined,
      reasonToWatch: reasonToWatch || undefined,
      learnFrom
    }).finally(() => setLoading(false))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">
          {typeConfig.icon} Add {typeConfig.nameAr}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">YouTube URL *</label>
            <input
              type="text"
              placeholder="https://youtube.com/@channel"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Channel Name</label>
            <input
              type="text"
              placeholder="Channel name (optional)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {type === 'adjacent_content' && typeConfig.subTypes && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Content Category</label>
              <select
                value={subType}
                onChange={e => setSubType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select category...</option>
                {typeConfig.subTypes.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.icon} {st.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'format_inspiration' && typeConfig.formatTypes && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Format Type</label>
              <select
                value={formatType}
                onChange={e => setFormatType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select format...</option>
                {typeConfig.formatTypes.map(ft => (
                  <option key={ft.id} value={ft.id}>
                    {ft.icon} {ft.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">لماذا تتابع هذه القناة؟</label>
            <textarea
              placeholder="ما الذي يمكن تعلمه من هذه القناة..."
              value={reasonToWatch}
              onChange={e => setReasonToWatch(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">ماذا تريد أن تتعلم؟</label>
            <div className="space-y-2">
              {typeConfig.learnFrom.map((item, i) => (
                <label key={i} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={learnFrom.includes(item)}
                    onChange={e => {
                      if (e.target.checked) {
                        setLearnFrom([...learnFrom, item])
                      } else {
                        setLearnFrom(learnFrom.filter(l => l !== item))
                      }
                    }}
                    className="mr-2"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Add Video Modal Component
function AddVideoModal({ channels, onClose, onAdd }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [channelId, setChannelId] = useState('')
  const [reason, setReason] = useState('')
  const [contentType, setContentType] = useState('direct_competitor')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) {
      alert('URL is required')
      return
    }

    setLoading(true)
    onAdd({
      url,
      title: title || undefined,
      channelId: channelId || undefined,
      reason: reason || undefined,
      contentType
    }).finally(() => setLoading(false))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">📹 Add Video</h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">YouTube Video URL *</label>
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Video Title</label>
            <input
              type="text"
              placeholder="Video title (optional)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {channels.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Channel</label>
              <select
                value={channelId}
                onChange={e => setChannelId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select channel...</option>
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Content Type</label>
            <select
              value={contentType}
              onChange={e => setContentType(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="direct_competitor">Direct Competitor</option>
              <option value="adjacent_content">Adjacent Content</option>
              <option value="format_inspiration">Format Inspiration</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Why save this video?</label>
            <textarea
              placeholder="What to learn from this video..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}




