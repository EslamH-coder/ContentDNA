'use client'

import { useState } from 'react'
import Navigation from '@/app/components/Navigation'

export default function ImportDNA() {
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setError(null)
    setResult(null)
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a CSV file')
      return
    }

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/dna/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Import failed')
      }
    } catch (e) {
      setError('Failed to process data: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Import Video Data & Build DNA</h1>
          <p className="text-gray-600">Upload your CSV file with video performance data to build the Living DNA system</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Step 1: Upload CSV File</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            
            {file && (
              <p className="text-green-600 mb-4">
                ✅ Selected: {file.name}
              </p>
            )}
            
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importing...' : 'Import & Build DNA'}
            </button>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Expected CSV columns:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <code className="bg-gray-200 px-1 rounded">title</code> - Video title</li>
              <li>• <code className="bg-gray-200 px-1 rounded">views</code> - View count</li>
              <li>• <code className="bg-gray-200 px-1 rounded">topic_1</code>, <code className="bg-gray-200 px-1 rounded">topic_2</code>, <code className="bg-gray-200 px-1 rounded">topic_3</code> - Topics</li>
              <li>• <code className="bg-gray-200 px-1 rounded">hook_first_15s_text</code> - Hook text (first 15 seconds)</li>
              <li>• <code className="bg-gray-200 px-1 rounded">%Audience retention at 30s Longform</code> - Retention percentage</li>
              <li>• <code className="bg-gray-200 px-1 rounded">%CTR</code> - Click-through rate</li>
              <li>• <code className="bg-gray-200 px-1 rounded">duration</code> - Video duration</li>
            </ul>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-green-600">
              ✅ DNA Built Successfully!
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Videos Imported</p>
                <p className="text-2xl font-bold">{result.summary.videos_imported}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Topics Detected</p>
                <p className="text-2xl font-bold">{result.summary.topics_detected}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Hook Patterns</p>
                <p className="text-2xl font-bold">{result.summary.hook_patterns}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Weak Topics</p>
                <p className="text-2xl font-bold">{result.summary.weak_topics}</p>
              </div>
            </div>

            {/* Top Topics */}
            {result.topTopics && result.topTopics.length > 0 && (
              <>
                <h3 className="font-semibold mb-2">📈 Top Performing Topics:</h3>
                <ul className="mb-6 space-y-2">
                  {result.topTopics.slice(0, 5).map((topic, i) => (
                    <li key={i} className="flex justify-between py-2 px-3 bg-gray-50 rounded border-b">
                      <span className="font-medium">{topic.name}</span>
                      <span className="text-gray-500">
                        {topic.avg_views.toLocaleString()} avg views • {topic.avg_retention_30s}% retention
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Best Hooks */}
            {result.topHooks && result.topHooks.length > 0 && (
              <>
                <h3 className="font-semibold mb-2">🎣 Best Hook Patterns:</h3>
                <ul className="mb-6 space-y-2">
                  {result.topHooks.slice(0, 3).map((hook, i) => (
                    <li key={i} className="py-2 px-3 bg-gray-50 rounded border-b">
                      <p className="font-medium">{hook.pattern}</p>
                      <p className="text-sm text-gray-500">
                        {hook.avg_retention_30s}% retention • {hook.avg_views.toLocaleString()} avg views • {hook.usage_count} videos
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* DNA Preview */}
            <details className="mt-4">
              <summary className="cursor-pointer text-blue-600 font-medium">
                View Full DNA JSON
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-auto text-xs max-h-96">
                {JSON.stringify(result.dna, null, 2)}
              </pre>
            </details>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                ✅ DNA is now active! All LLM-generated content will use this DNA context for better titles and hooks.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}




