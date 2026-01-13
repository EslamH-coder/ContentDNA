'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getUserShows } from '@/lib/userShows'
import Navigation from '@/app/components/Navigation'

export default function VideoImport() {
  const [selectedShow, setSelectedShow] = useState(null)
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(false)
  const [importMode, setImportMode] = useState('manual') // 'manual' or 'csv'
  const [importResult, setImportResult] = useState(null)
  
  // Manual form state
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    viewCount: '',
    likeCount: '',
    commentCount: '',
    publishedAt: '',
    durationSeconds: '',
    format: 'long_form', // 'long_form' or 'short_form'
  })

  // CSV state
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)

  useEffect(() => {
    fetchShows()
  }, [])

  async function fetchShows() {
    if (!isSupabaseConfigured) {
      setShows([
        { id: '1', name: 'Show 1', channel_id: 'channel1' },
        { id: '2', name: 'Show 2', channel_id: 'channel2' },
      ])
      if (!selectedShow) setSelectedShow('1')
      return
    }

    try {
      // Get only shows that belong to the current user
      const { shows, error } = await getUserShows()

      if (error) {
        console.error('Error fetching user shows:', error)
        setShows([])
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
    }
  }

  function handleCsvFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    setCsvFile(file)

    // Preview CSV
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split('\n').slice(0, 6) // First 5 rows
      setCsvPreview(lines.join('\n'))
    }
    reader.readAsText(file)
  }

  async function handleCsvUpload() {
    if (!csvFile || !selectedShow) {
      alert('Please select a CSV file and a show')
      return
    }

    setLoading(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('show_id', selectedShow)

      const response = await fetch('/api/videos/import-csv', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.error) {
        setImportResult({ success: false, message: result.error, details: result.details })
      } else {
        setImportResult({
          success: true,
          message: `Successfully imported ${result.imported} videos`,
          details: result,
        })
        setCsvFile(null)
        setCsvPreview(null)
        // Reset file input
        document.querySelector('input[type="file"]').value = ''
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Failed to import CSV',
        details: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault()
    if (!selectedShow) {
      alert('Please select a show')
      return
    }

    setLoading(true)
    setImportResult(null)

    try {
      const response = await fetch('/api/videos/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          show_id: selectedShow,
          video: formData,
        }),
      })

      const result = await response.json()

      if (result.error) {
        setImportResult({ success: false, message: result.error, details: result.details })
      } else {
        setImportResult({
          success: true,
          message: 'Video imported successfully',
          details: result,
        })
        // Reset form
        setFormData({
          title: '',
          url: '',
          viewCount: '',
          likeCount: '',
          commentCount: '',
          publishedAt: '',
          durationSeconds: '',
          format: 'long_form',
        })
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Failed to import video',
        details: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Videos</h1>
          <p className="text-gray-600">Add videos manually or upload a CSV file</p>
        </div>

        {/* Show Selector */}
        {shows.length > 0 && (
          <div className="mb-6">
            <label htmlFor="show-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select Show
            </label>
            <select
              id="show-select"
              value={selectedShow || ''}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Import Mode Toggle */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setImportMode('manual')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              importMode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setImportMode('csv')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              importMode === 'csv'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            CSV Upload
          </button>
        </div>

        {/* Manual Form */}
        {importMode === 'manual' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Video Manually</h2>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Video title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    View Count *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.viewCount}
                    onChange={(e) => setFormData({ ...formData, viewCount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="100000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Like Count
                  </label>
                  <input
                    type="number"
                    value={formData.likeCount}
                    onChange={(e) => setFormData({ ...formData, likeCount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comment Count
                  </label>
                  <input
                    type="number"
                    value={formData.commentCount}
                    onChange={(e) => setFormData({ ...formData, commentCount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={formData.durationSeconds}
                    onChange={(e) => setFormData({ ...formData, durationSeconds: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Published Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.publishedAt}
                    onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Format *
                  </label>
                  <select
                    required
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="long_form">Long Form</option>
                    <option value="short_form">Short Form</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Importing...' : 'Import Video'}
              </button>
            </form>
          </div>
        )}

        {/* CSV Upload */}
        {importMode === 'csv' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV File</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File *
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-2 text-sm text-gray-500">
                Expected columns: title, url, viewCount, likeCount, commentCount, publishedAt, durationSeconds, format
              </p>
            </div>

            {csvPreview && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">CSV Preview (first 5 rows):</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">{csvPreview}</pre>
              </div>
            )}

            <button
              onClick={handleCsvUpload}
              disabled={loading || !csvFile}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Importing...' : 'Upload and Import CSV'}
            </button>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`mt-6 p-4 rounded-lg ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              importResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {importResult.success ? '✅' : '❌'} {importResult.message}
            </p>
            {importResult.details && (
              <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                {JSON.stringify(importResult.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

