'use client';
import { useState } from 'react';

export default function TestIntelligencePage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customTest, setCustomTest] = useState({
    title1: '',
    title2: ''
  });
  const [customResult, setCustomResult] = useState(null);

  const runAllTests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test-topic-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'runAllTests' })
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      } else {
        console.error('Test failed:', data.error);
      }
    } catch (error) {
      console.error('Error running tests:', error);
    }
    setLoading(false);
  };

  const runCustomTest = async () => {
    if (!customTest.title1 || !customTest.title2) {
      alert('Please enter both titles');
      return;
    }
    
    try {
      const res = await fetch('/api/test-topic-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: 'compare',
          data: customTest
        })
      });
      const data = await res.json();
      if (data.success) {
        setCustomResult(data.comparison);
      } else {
        console.error('Comparison failed:', data.error);
      }
    } catch (error) {
      console.error('Error running custom test:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Topic Intelligence Test Suite</h1>
      
      {/* Run All Tests */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Automated Tests</h2>
        <button 
          onClick={runAllTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running...' : 'Run All Tests'}
        </button>
        
        {results && (
          <div className="mt-4">
            <div className={`text-lg font-semibold mb-2 ${
              results.failed === 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {results.summary}
            </div>
            
            <div className="space-y-2">
              {results.tests.map((test, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded ${
                    test.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  } border`}
                >
                  <div className="flex items-center gap-2">
                    <span>{test.passed ? '✅' : '❌'}</span>
                    <span className="font-medium">{test.name}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{test.description}</div>
                  {!test.passed && (
                    <div className="mt-2 text-sm">
                      <div className="text-red-600">Expected: {JSON.stringify(test.expected)}</div>
                      <div className="text-red-600">Actual: {JSON.stringify(test.actual, null, 2)}</div>
                      {test.error && (
                        <div className="text-red-600 mt-1">Error: {test.error}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Custom Test */}
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Custom Comparison Test</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title 1 (Idea)</label>
            <input
              type="text"
              value={customTest.title1}
              onChange={(e) => setCustomTest({...customTest, title1: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Enter first title..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Title 2 (Video/Signal)</label>
            <input
              type="text"
              value={customTest.title2}
              onChange={(e) => setCustomTest({...customTest, title2: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Enter second title..."
            />
          </div>
          
          <button
            onClick={runCustomTest}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Compare
          </button>
          
          {customResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Result:</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Match:</span>{' '}
                  <span className={customResult.isMatch ? 'text-green-600' : 'text-red-600'}>
                    {customResult.isMatch ? 'YES' : 'NO'}
                  </span>
                </div>
                <div><span className="font-medium">Relationship:</span> {customResult.relationship}</div>
                <div><span className="font-medium">Confidence:</span> {Math.round(customResult.confidence * 100)}%</div>
                <div><span className="font-medium">Semantic Similarity:</span> {customResult.semanticSimilarity > 0 ? Math.round(customResult.semanticSimilarity * 100) + '%' : 'N/A (embeddings not available)'}</div>
                <div><span className="font-medium">Same Category:</span> {customResult.sameCategory ? 'Yes' : 'No'}</div>
                <div><span className="font-medium">Reason:</span> {customResult.reason}</div>
                <div className="mt-2">
                  <span className="font-medium">Entity Overlap:</span>
                  <pre className="text-xs mt-1 bg-white p-2 rounded overflow-auto">
                    {JSON.stringify(customResult.entityOverlap, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
