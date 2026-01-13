'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LayoutWithNav from '../layout-with-nav';

function ContentToolsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentShowId, setCurrentShowId] = useState(searchParams.get('showId') || '00000000-0000-0000-0000-000000000004');
  const showId = currentShowId; // Use state for showId
  
  // State
  const [shows, setShows] = useState([]);
  const [topic, setTopic] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [channelDNA, setChannelDNA] = useState(null);
  const [activeTab, setActiveTab] = useState('analyzer'); // 'analyzer' | 'dna' | 'explorer'
  const [topicFormat, setTopicFormat] = useState('all'); // 'all' | 'long' | 'shorts'
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicVideos, setTopicVideos] = useState([]);
  const [topicsWithCounts, setTopicsWithCounts] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  
  // Topic Management States
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [showReclassifyModal, setShowReclassifyModal] = useState(false);
  const [reclassifyVideo, setReclassifyVideo] = useState(null);

  // Topic form state
  const [topicForm, setTopicForm] = useState({
    topic_id: '',
    topic_name_en: '',
    topic_name_ar: '',
    keywords: '',
    description: ''
  });
  
  // Fetch shows on load
  useEffect(() => {
    fetchShows();
  }, []);

  // Update URL when showId changes
  useEffect(() => {
    if (currentShowId) {
      const url = new URL(window.location.href);
      url.searchParams.set('showId', currentShowId);
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [currentShowId, router]);

  // Fetch Channel DNA on load
  useEffect(() => {
    if (showId) {
      fetchChannelDNA();
    }
  }, [showId]);

  const fetchShows = async () => {
    try {
      const res = await fetch('/api/shows');
      const data = await res.json();
      if (data.success) {
        setShows(data.shows || []);
        // If current showId is not in the list, use first show
        if (data.shows && data.shows.length > 0) {
          const showExists = data.shows.find(s => s.id === showId);
          if (!showExists) {
            setCurrentShowId(data.shows[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  // Fetch topics when explorer tab is opened
  useEffect(() => {
    if (activeTab === 'explorer' && showId) {
      fetchTopicsWithCounts();
    }
  }, [activeTab, showId]);
  
  const fetchChannelDNA = async () => {
    try {
      const res = await fetch(`/api/content-dna?showId=${showId}`);
      const data = await res.json();
      if (data.success) {
        setChannelDNA(data.dna);
      }
    } catch (error) {
      console.error('Error fetching DNA:', error);
    }
  };

  const fetchTopicVideos = async (topicId) => {
    setLoadingVideos(true);
    setSelectedTopic(topicId);
    
    try {
      const res = await fetch(`/api/videos-by-topic?showId=${showId}&topicId=${topicId}`);
      const data = await res.json();
      if (data.success) {
        setTopicVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching topic videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const fetchTopicsWithCounts = async () => {
    try {
      const res = await fetch(`/api/topics-list?showId=${showId}`);
      const data = await res.json();
      if (data.success) {
        setTopicsWithCounts(data.topics);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
    }
  };

  // Open edit topic modal
  const openEditTopic = (topic) => {
    setEditingTopic(topic);
    setTopicForm({
      topic_id: topic.topic_id,
      topic_name_en: topic.topic_name_en || '',
      topic_name_ar: topic.topic_name_ar || '',
      keywords: Array.isArray(topic.keywords) ? topic.keywords.join(', ') : (topic.keywords || ''),
      description: topic.description || ''
    });
    setShowTopicModal(true);
  };

  // Open new topic modal
  const openNewTopic = () => {
    setEditingTopic(null);
    setTopicForm({
      topic_id: '',
      topic_name_en: '',
      topic_name_ar: '',
      keywords: '',
      description: ''
    });
    setShowTopicModal(true);
  };

  // Save topic (create or update)
  const saveTopic = async () => {
    try {
      const keywordsArray = topicForm.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const res = await fetch('/api/topics/manage', {
        method: editingTopic ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          topicId: editingTopic?.topic_id || topicForm.topic_id.toLowerCase().replace(/\s+/g, '_'),
          topic_name_en: topicForm.topic_name_en,
          topic_name_ar: topicForm.topic_name_ar,
          keywords: keywordsArray,
          description: topicForm.description
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowTopicModal(false);
        fetchTopicsWithCounts(); // Refresh list
        alert(editingTopic ? 'Topic updated!' : 'Topic created!');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error saving topic: ' + error.message);
    }
  };

  // Delete topic
  const deleteTopic = async (topicId) => {
    if (!confirm(`Delete topic "${topicId}"? Videos will be moved to "other_stories".`)) {
      return;
    }

    try {
      const res = await fetch('/api/topics/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, topicId })
      });

      const data = await res.json();
      if (data.success) {
        fetchTopicsWithCounts();
        if (selectedTopic === topicId) {
          setSelectedTopic(null);
          setTopicVideos([]);
        }
        alert(`Topic deleted. ${data.videosReassigned} videos moved to "other_stories".`);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error deleting topic: ' + error.message);
    }
  };

  // Open reclassify modal
  const openReclassifyModal = (video) => {
    setReclassifyVideo(video);
    setShowReclassifyModal(true);
  };

  // Reclassify video to new topic
  const reclassifyVideoToTopic = async (newTopicId) => {
    try {
      const res = await fetch('/api/videos/reclassify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          videoId: reclassifyVideo.video_id,
          newTopicId
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowReclassifyModal(false);
        // Remove video from current list
        setTopicVideos(prev => prev.filter(v => v.video_id !== reclassifyVideo.video_id));
        // Update counts
        fetchTopicsWithCounts();
        alert('Video reclassified!');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error reclassifying: ' + error.message);
    }
  };
  
  // Analyze topic
  const analyzeTopic = async () => {
    if (!topic.trim()) return;
    
    setIsAnalyzing(true);
    setResults(null);
    
    try {
      // Fetch all 3 APIs in parallel
      const [scoreRes, hookRes, thumbRes] = await Promise.all([
        fetch('/api/score-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId, topic })
        }),
        fetch('/api/smart-hook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId, topic })
        }),
        fetch('/api/thumbnail-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId, topic })
        })
      ]);
      
      const [scoreData, hookData, thumbData] = await Promise.all([
        scoreRes.json(),
        hookRes.json(),
        thumbRes.json()
      ]);
      
      setResults({
        score: scoreData,
        hook: hookData,
        thumbnail: thumbData
      });
    } catch (error) {
      console.error('Error analyzing:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <LayoutWithNav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🛠️ Content Tools</h1>
          <p className="text-gray-600">Analyze ideas and optimize content based on your channel's DNA</p>
        </div>
      
      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('analyzer')}
              className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === 'analyzer'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              💡 Idea Analyzer
            </button>
            <button
              onClick={() => setActiveTab('dna')}
              className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === 'dna'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🧬 Channel DNA
            </button>
            <button
              onClick={() => setActiveTab('explorer')}
              className={`py-4 px-2 font-medium border-b-2 transition-colors ${
                activeTab === 'explorer'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🔍 Topic Explorer
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Idea Analyzer Tab */}
        {activeTab === 'analyzer' && (
          <div className="space-y-8">
            {/* Input Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">💡 Test Your Video Idea</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && analyzeTopic()}
                  placeholder="اكتب فكرة الفيديو هنا... مثال: الحرب التجارية بين أمريكا والصين"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                  dir="rtl"
                />
                <button
                  onClick={analyzeTopic}
                  disabled={isAnalyzing || !topic.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      🎯 Analyze
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Results Section */}
            {results && (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Score Card */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Topic Score</h3>
                  <div className="text-center mb-4">
                    <div className={`text-5xl font-bold ${
                      results.score.score >= 80 ? 'text-green-600' :
                      results.score.score >= 60 ? 'text-blue-600' :
                      results.score.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {results.score.score}
                    </div>
                    <div className="text-xl mt-1">{results.score.rating}</div>
                  </div>
                  <div className="space-y-2">
                    {results.score.reasons?.map((reason, idx) => (
                      <p key={idx} className="text-sm text-gray-600 text-right" dir="rtl">
                        {reason}
                      </p>
                    ))}
                  </div>
                </div>
                
                {/* Hook Card */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🎣 Hook Ideas</h3>
                  {results.hook.similarSuccessfulHooks?.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500 mb-2">Similar successful hooks:</p>
                      {results.hook.similarSuccessfulHooks.slice(0, 2).map((h, idx) => (
                        <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-100">
                          <p className="text-sm text-gray-800 text-right" dir="rtl">{h.hook}</p>
                          <p className="text-xs text-green-600 mt-1">👁️ {h.views?.toLocaleString()} views</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">Recommended patterns:</p>
                      {results.hook.recommendedPatterns?.slice(0, 3).map((p, idx) => (
                        <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-800">{p.pattern}</p>
                          <p className="text-xs text-blue-600">Avg: {p.avgViews?.toLocaleString()} views</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 font-medium mb-2">💡 Tips:</p>
                    {results.hook.tips?.slice(0, 3).map((tip, idx) => (
                      <p key={idx} className="text-xs text-gray-600">{tip}</p>
                    ))}
                  </div>
                </div>
                
                {/* Thumbnail Card */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🖼️ Thumbnail Elements</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {results.thumbnail.recommendedElements?.map((elem, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                      >
                        {elem}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-2 mt-4">
                    <p className="text-xs text-gray-500 font-medium">🏆 Top Combos:</p>
                    {results.thumbnail.topPerformingCombos?.map((combo, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{combo.elements.join(' + ')}</span>
                        <span className="text-green-600 font-medium">{combo.avgViews}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 font-medium mb-2">💡 Tips:</p>
                    {results.thumbnail.tips?.slice(0, 3).map((tip, idx) => (
                      <p key={idx} className="text-xs text-gray-600">{tip}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Empty State */}
            {!results && !isAnalyzing && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-4">💡</p>
                <p>Enter a video idea above to analyze it</p>
              </div>
            )}
          </div>
        )}
        
        {/* Channel DNA Tab */}
        {activeTab === 'dna' && channelDNA && (
          <div className="space-y-8">
            {/* Ad Traffic Warning Banner */}
            {channelDNA?.stats?.has_paid_promotion && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h4 className="font-semibold text-yellow-800">Paid Promotion Detected</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This channel has ~{channelDNA.stats.avg_ad_percentage}% of views from ads. 
                      All performance metrics are calculated using <strong>organic views only</strong> for accurate analysis.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Format Stats Overview */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Long Form Stats */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  🎬 Long Form
                  <span className="text-sm font-normal text-gray-500">({channelDNA?.formatStats?.long?.count || 0} videos)</span>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {((channelDNA?.formatStats?.long?.total_views_organic || 0) / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-gray-500">Organic Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {((channelDNA?.formatStats?.long?.total_views_ads || 0) / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-gray-500">Ad Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {channelDNA?.formatStats?.long?.avg_ad_percentage?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-gray-500">Avg Ad Traffic</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-purple-600">{channelDNA?.formatStats?.long?.overperforming || 0}</span> overperforming
                  </p>
                </div>
              </div>

              {/* Shorts Stats */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  📱 Shorts
                  <span className="text-sm font-normal text-gray-500">({channelDNA?.formatStats?.shorts?.count || 0} videos)</span>
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {((channelDNA?.formatStats?.shorts?.total_views_organic || 0) / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-gray-500">Organic Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {((channelDNA?.formatStats?.shorts?.total_views_ads || 0) / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-gray-500">Ad Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {channelDNA?.formatStats?.shorts?.avg_ad_percentage?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-gray-500">Avg Ad Traffic</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-purple-600">{channelDNA?.formatStats?.shorts?.overperforming || 0}</span> overperforming
                  </p>
                </div>
              </div>
            </div>

            {/* Format Tabs for Topics */}
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">🏆 Top Performing Topics</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTopicFormat('all')}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      topicFormat === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTopicFormat('long')}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      topicFormat === 'long' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    🎬 Long
                  </button>
                  <button
                    onClick={() => setTopicFormat('shorts')}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      topicFormat === 'shorts' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    📱 Shorts
                  </button>
                </div>
              </div>
              
              {/* Topics Table - update to show ad % column */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Topic</th>
                      <th className="pb-3 font-medium">Videos</th>
                      <th className="pb-3 font-medium">Avg Organic</th>
                      <th className="pb-3 font-medium">Avg Total</th>
                      <th className="pb-3 font-medium">Ad %</th>
                      <th className="pb-3 font-medium">Success Rate</th>
                      <th className="pb-3 font-medium">Viral Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(topicFormat === 'all' ? channelDNA?.topTopics :
                      topicFormat === 'long' ? channelDNA?.topTopicsLong :
                      channelDNA?.topTopicsShorts)?.slice(0, 10).map((topic, idx) => (
                      <tr key={idx} className="text-sm">
                        <td className="py-3 font-medium text-gray-900">{topic.topic_id}</td>
                        <td className="py-3 text-gray-600">{topic.video_count}</td>
                        <td className="py-3 text-green-600 font-semibold">
                          {Number(topic.avg_views_organic || topic.avg_views).toLocaleString()}
                        </td>
                        <td className="py-3 text-gray-400">
                          {Number(topic.avg_views).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (topic.avg_ad_percentage || 0) > 30 ? 'bg-red-100 text-red-700' :
                            (topic.avg_ad_percentage || 0) > 10 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {topic.avg_ad_percentage || 0}%
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            topic.success_rate >= 50 ? 'bg-green-100 text-green-700' :
                            topic.success_rate >= 25 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {topic.success_rate}%
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            topic.avg_viral_score >= 70 ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {topic.avg_viral_score || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Top Thumbnail Elements */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🖼️ Top Thumbnail Elements (by Organic Views)</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channelDNA.topElements?.slice(0, 9).map((elem, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{elem.element}</p>
                      <p className="text-sm text-gray-500">{elem.count} videos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {Number(elem.avg_views_organic || elem.avg_views).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 line-through">
                        {Number(elem.avg_views).toLocaleString()} total
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{elem.success_rate}% success</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Hook Patterns */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎣 Successful Hook Patterns</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {channelDNA.hookPatterns && Object.entries(channelDNA.hookPatterns)
                  .filter(([_, data]) => data.count > 0)
                  .sort((a, b) => b[1].avgViews - a[1].avgViews)
                  .map(([pattern, data], idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 capitalize">
                          {pattern.replace('with', '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-green-600 font-semibold">
                          {data.avgViews?.toLocaleString()} avg views
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{data.count} videos use this pattern</p>
                      {data.examples?.[0] && (
                        <p className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded text-right" dir="rtl">
                          "{data.examples[0]}..."
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Topic Explorer Tab */}
        {activeTab === 'explorer' && (
          <div className="grid md:grid-cols-4 gap-6">
            {/* Topics List - Left Sidebar */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">📁 Topics</h3>
                  <button
                    onClick={openNewTopic}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {topicsWithCounts.map((topic) => (
                    <div
                      key={topic.topic_id}
                      className={`group rounded-lg transition-all ${
                        selectedTopic === topic.topic_id
                          ? 'bg-blue-100 border border-blue-300'
                          : 'hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => fetchTopicVideos(topic.topic_id)}
                        className="w-full text-left px-3 py-2"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium truncate text-gray-900">
                            {topic.topic_name_ar || topic.topic_id}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            selectedTopic === topic.topic_id
                              ? 'bg-blue-200 text-blue-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {topic.video_count}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {topic.topic_name_en}
                        </div>
                      </button>
                      
                      {/* Edit/Delete buttons - show on hover or when selected */}
                      <div className={`flex gap-1 px-3 pb-2 ${
                        selectedTopic === topic.topic_id ? 'flex' : 'hidden group-hover:flex'
                      }`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditTopic(topic); }}
                          className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          ✏️ Edit
                        </button>
                        {topic.topic_id !== 'other_stories' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTopic(topic.topic_id); }}
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Videos List - Right Content */}
            <div className="md:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                {!selectedTopic ? (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-4 block">👈</span>
                    <p>Select a topic to see its videos</p>
                  </div>
                ) : loadingVideos ? (
                  <div className="text-center py-12">
                    <span className="animate-spin text-2xl">⏳</span>
                    <p className="text-gray-500 mt-2">Loading videos...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">
                        {selectedTopic} 
                        <span className="text-gray-400 font-normal ml-2">({topicVideos.length} videos)</span>
                      </h3>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                          {topicVideos.filter(v => v.performance_hint === 'Overperforming').length} overperforming
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                          {topicVideos.filter(v => v.format === 'Long').length} Long / {topicVideos.filter(v => v.format === 'Shorts').length} Shorts
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[550px] overflow-y-auto">
                      {topicVideos.map((video) => (
                        <div 
                          key={video.video_id}
                          className={`flex gap-4 p-3 rounded-lg border ${
                            video.performance_hint === 'Overperforming' 
                              ? 'border-green-200 bg-green-50' 
                              : video.performance_hint === 'Underperforming'
                              ? 'border-red-100 bg-red-50'
                              : 'border-gray-200'
                          }`}
                        >
                          {/* Thumbnail */}
                          <a 
                            href={video.youtube_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <img 
                              src={video.thumbnail_url} 
                              alt={video.title}
                              className="w-32 h-20 object-cover rounded"
                            />
                          </a>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <a 
                              href={video.youtube_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                            >
                              {video.title}
                            </a>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              {/* Format Badge */}
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                video.format === 'Shorts' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {video.format}
                              </span>

                              {/* Performance Badge */}
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                video.performance_hint === 'Overperforming' 
                                  ? 'bg-green-100 text-green-700' 
                                  : video.performance_hint === 'Underperforming'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {video.performance_hint || 'Average'}
                              </span>

                              {/* Views */}
                              <span className="text-xs text-gray-500">
                                👁 {Number(video.views_organic || video.views || 0).toLocaleString()} organic
                              </span>

                              {/* Ad % if significant */}
                              {video.ad_percentage > 5 && (
                                <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                                  {video.ad_percentage.toFixed(0)}% ads
                                </span>
                              )}

                              {/* Viral Score */}
                              {video.viral_score > 0 && (
                                <span className="text-xs text-gray-500">
                                  🚀 {video.viral_score}
                                </span>
                              )}
                            </div>

                            {/* Hook Preview */}
                            {video.hook_text && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-1">
                                🎣 {video.hook_text}
                              </p>
                            )}
                          </div>

                          {/* Reclassify Button */}
                          <div className="flex-shrink-0">
                            <button
                              onClick={() => openReclassifyModal(video)}
                              className="text-xs px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Change topic"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Topic Edit/Create Modal */}
        {showTopicModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
              <h3 className="text-lg font-semibold mb-4">
                {editingTopic ? '✏️ Edit Topic' : '➕ New Topic'}
              </h3>
              
              <div className="space-y-4">
                {/* Topic ID (only for new) */}
                {!editingTopic && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Topic ID (lowercase, no spaces)
                    </label>
                    <input
                      type="text"
                      value={topicForm.topic_id}
                      onChange={(e) => setTopicForm({...topicForm, topic_id: e.target.value})}
                      placeholder="e.g., tech_news"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* English Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    English Name
                  </label>
                  <input
                    type="text"
                    value={topicForm.topic_name_en}
                    onChange={(e) => setTopicForm({...topicForm, topic_name_en: e.target.value})}
                    placeholder="e.g., Technology News"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Arabic Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arabic Name
                  </label>
                  <input
                    type="text"
                    value={topicForm.topic_name_ar}
                    onChange={(e) => setTopicForm({...topicForm, topic_name_ar: e.target.value})}
                    placeholder="e.g., أخبار التقنية"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    dir="rtl"
                  />
                </div>

                {/* Keywords */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keywords (comma separated)
                  </label>
                  <textarea
                    value={topicForm.keywords}
                    onChange={(e) => setTopicForm({...topicForm, keywords: e.target.value})}
                    placeholder="keyword1, keyword2, كلمة1, كلمة2"
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These keywords help auto-classify future videos
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={topicForm.description}
                    onChange={(e) => setTopicForm({...topicForm, description: e.target.value})}
                    placeholder="What kind of content belongs to this topic?"
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowTopicModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTopic}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTopic ? 'Save Changes' : 'Create Topic'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reclassify Video Modal */}
        {showReclassifyModal && reclassifyVideo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-2">🔄 Reclassify Video</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{reclassifyVideo.title}</p>
              
              <p className="text-sm font-medium text-gray-700 mb-2">Select new topic:</p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {topicsWithCounts
                  .filter(t => t.topic_id !== reclassifyVideo.topic_id)
                  .map((topic) => (
                  <button
                    key={topic.topic_id}
                    onClick={() => reclassifyVideoToTopic(topic.topic_id)}
                    className="w-full text-left px-3 py-2 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-all"
                  >
                    <span className="font-medium">{topic.topic_name_ar || topic.topic_id}</span>
                    <span className="text-sm text-gray-500 ml-2">({topic.topic_name_en})</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowReclassifyModal(false)}
                className="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </LayoutWithNav>
  );
}

export default function ContentToolsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Content Tools...</p>
        </div>
      </div>
    }>
      <ContentToolsContent />
    </Suspense>
  );
}

