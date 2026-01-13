'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LayoutWithNav from '../layout-with-nav';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';

function DNAContent() {
  const searchParams = useSearchParams();
  const showId = searchParams.get('showId');
  const initialTab = searchParams.get('tab') || 'overview';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [topicFormatFilter, setTopicFormatFilter] = useState('all'); // 'all', 'longform', 'shortform'
  
  // Data
  const [dna, setDna] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicVideos, setTopicVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  
  // Modals
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showReclassifyModal, setShowReclassifyModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [reclassifyVideo, setReclassifyVideo] = useState(null);
  
  // Topic form
  const [topicForm, setTopicForm] = useState({
    topic_id: '',
    topic_name_en: '',
    topic_name_ar: '',
    keywords: '',
    description: ''
  });

  useEffect(() => {
    if (showId) fetchData();
  }, [showId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch DNA
      const dnaRes = await fetch(`/api/content-dna?showId=${showId}`);
      const dnaData = await dnaRes.json();
      if (dnaData.success) setDna(dnaData.dna);

      // Fetch topics
      const topicsRes = await fetch(`/api/topics-list?showId=${showId}`);
      const topicsData = await topicsRes.json();
      if (topicsData.success) setTopics(topicsData.topics);

    } catch (error) {
      console.error('Error fetching DNA:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicVideos = async (topicId) => {
    setLoadingVideos(true);
    setSelectedTopic(topicId);
    
    try {
      const res = await fetch(`/api/videos-by-topic?showId=${showId}&topicId=${topicId}`);
      const data = await res.json();
      if (data.success) setTopicVideos(data.videos);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  // Topic management
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
        fetchData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error saving topic: ' + error.message);
    }
  };

  const deleteTopic = async (topicId) => {
    if (!confirm(`Delete topic "${topicId}"? Videos will be moved to "other_stories".`)) return;

    try {
      const res = await fetch('/api/topics/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, topicId })
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
        if (selectedTopic === topicId) {
          setSelectedTopic(null);
          setTopicVideos([]);
        }
      }
    } catch (error) {
      alert('Error deleting topic: ' + error.message);
    }
  };

  // Video reclassification
  const openReclassify = (video) => {
    setReclassifyVideo(video);
    setShowReclassifyModal(true);
  };

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
        setTopicVideos(prev => prev.filter(v => v.video_id !== reclassifyVideo.video_id));
        fetchData();
      }
    } catch (error) {
      alert('Error reclassifying: ' + error.message);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'insights', label: 'Insights', icon: '📈' },
    { id: 'topics', label: 'Topics', icon: '🏷️', count: topics.length },
    { id: 'elements', label: 'Elements', icon: '🖼️' },
  ];

  if (!showId) {
    return (
      <LayoutWithNav>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <EmptyState
            icon="🧬"
            title="No Show Selected"
            description="Select a show from the dropdown above to view DNA analysis."
          />
        </div>
      </LayoutWithNav>
    );
  }

  if (loading) {
    return (
      <LayoutWithNav>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <span className="animate-spin text-4xl">⏳</span>
          <p className="text-gray-500 mt-4">Analyzing content DNA...</p>
        </div>
      </LayoutWithNav>
    );
  }

  return (
    <LayoutWithNav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Content DNA</h1>
          <p className="text-gray-500 mt-1">Understand what makes your content perform</p>
        </div>

        {/* Paid Promotion Alert */}
        {dna?.stats?.has_paid_promotion && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="font-semibold text-yellow-800">Paid Promotion Detected</h4>
              <p className="text-sm text-yellow-700">
                This channel has ~{dna.stats.avg_ad_percentage?.toFixed(0)}% views from ads. 
                All metrics are calculated using <strong>organic views only</strong> for accurate analysis.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <InsightsTab showId={showId} />
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard icon="🎬" value={dna?.stats?.total_videos || 0} label="Total Videos" color="blue" />
              <StatCard icon="👁️" value={`${((dna?.stats?.total_views_organic || 0) / 1000000).toFixed(1)}M`} label="Organic Views" color="green" />
              <StatCard icon="📺" value={`${((dna?.stats?.total_views_ads || 0) / 1000000).toFixed(1)}M`} label="Ad Views" color="orange" />
              <StatCard icon="⭐" value={dna?.stats?.overperforming || 0} label="Overperforming" color="purple" />
              <StatCard icon="📊" value={`${dna?.stats?.avg_ad_percentage?.toFixed(0) || 0}%`} label="Avg Ad Traffic" color="red" />
            </div>

            {/* Format Stats */}
            {dna?.formatStats && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader icon="🎬" title="Long Form" subtitle={`${dna.formatStats.long?.count || 0} videos`} />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xl font-bold text-green-600">
                        {((dna.formatStats.long?.total_views_organic || 0) / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-gray-500">Organic</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-xl font-bold text-orange-600">
                        {((dna.formatStats.long?.total_views_ads || 0) / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-gray-500">Ads</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xl font-bold text-purple-600">
                        {dna.formatStats.long?.overperforming || 0}
                      </p>
                      <p className="text-xs text-gray-500">Overperforming</p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader icon="📱" title="Shorts" subtitle={`${dna.formatStats.shorts?.count || 0} videos`} />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xl font-bold text-green-600">
                        {((dna.formatStats.shorts?.total_views_organic || 0) / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-gray-500">Organic</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-xl font-bold text-orange-600">
                        {((dna.formatStats.shorts?.total_views_ads || 0) / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-gray-500">Ads</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xl font-bold text-purple-600">
                        {dna.formatStats.shorts?.overperforming || 0}
                      </p>
                      <p className="text-xs text-gray-500">Overperforming</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Top Topics */}
            <Card>
              <CardHeader 
                icon="🏆" 
                title="Top Performing Topics" 
                subtitle="Ranked by organic views"
                action={
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('topics')}>
                    View All →
                  </Button>
                }
              />
              
              {/* Format Tabs */}
              <div className="px-6 pt-4 pb-2 border-b">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTopicFormatFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      topicFormatFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Formats
                  </button>
                  <button
                    onClick={() => setTopicFormatFilter('longform')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      topicFormatFilter === 'longform'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🎬 Longform
                  </button>
                  <button
                    onClick={() => setTopicFormatFilter('shortform')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      topicFormatFilter === 'shortform'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    📱 Short Form
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium px-6">Topic</th>
                      <th className="pb-3 font-medium">Videos</th>
                      <th className="pb-3 font-medium">Avg Organic</th>
                      <th className="pb-3 font-medium">Ad %</th>
                      <th className="pb-3 font-medium">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(topicFormatFilter === 'all' 
                      ? dna?.topTopics?.slice(0, 8)
                      : topicFormatFilter === 'longform'
                      ? dna?.topTopicsLong?.slice(0, 8)
                      : dna?.topTopicsShorts?.slice(0, 8)
                    )?.map((topic, idx) => (
                      <tr key={idx} className="text-sm">
                        <td className="py-3 px-6">
                          <span className="font-medium text-gray-900">{topic.topic_id}</span>
                        </td>
                        <td className="py-3 text-gray-600">{topic.video_count}</td>
                        <td className="py-3 text-green-600 font-semibold">
                          {Number(topic.avg_views_organic).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <Badge variant={topic.avg_ad_percentage > 30 ? 'danger' : topic.avg_ad_percentage > 10 ? 'warning' : 'success'}>
                            {topic.avg_ad_percentage?.toFixed(0) || 0}%
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge variant={topic.success_rate >= 50 ? 'success' : topic.success_rate >= 25 ? 'warning' : 'default'}>
                            {topic.success_rate}%
                          </Badge>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-500">
                          No topics found for {topicFormatFilter === 'all' ? 'all formats' : topicFormatFilter === 'longform' ? 'longform' : 'short form'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Top Elements */}
            {dna?.topElements?.length > 0 && (
              <Card>
                <CardHeader icon="🖼️" title="Top Thumbnail Elements" subtitle="Visual elements that perform well" />
                <div className="flex flex-wrap gap-3">
                  {dna.topElements.slice(0, 10).map((elem, idx) => (
                    <div key={idx} className="px-4 py-2 bg-gray-50 rounded-lg">
                      <span className="font-medium" dir="auto">{elem.element}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({elem.count} videos, {elem.success_rate}% success)
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <div className="grid md:grid-cols-4 gap-6">
            {/* Topics List */}
            <div className="md:col-span-1">
              <Card padding={false}>
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">Topics</h3>
                  <Button size="sm" onClick={openNewTopic}>+ Add</Button>
                </div>
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {topics.map(topic => (
                    <div
                      key={topic.topic_id}
                      className={`p-3 cursor-pointer transition-all ${
                        selectedTopic === topic.topic_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div 
                        onClick={() => fetchTopicVideos(topic.topic_id)}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-900" dir="auto">
                            {topic.topic_name_ar || topic.topic_id}
                          </p>
                          <p className="text-xs text-gray-500">{topic.topic_name_en}</p>
                        </div>
                        <Badge variant="default">{topic.video_count}</Badge>
                      </div>
                      {selectedTopic === topic.topic_id && (
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="ghost" onClick={() => openEditTopic(topic)}>
                            Edit
                          </Button>
                          {topic.topic_id !== 'other_stories' && (
                            <Button size="sm" variant="ghost" onClick={() => deleteTopic(topic.topic_id)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Videos in Topic */}
            <div className="md:col-span-3">
              <Card>
                {!selectedTopic ? (
                  <EmptyState
                    icon="👈"
                    title="Select a Topic"
                    description="Click on a topic to see its videos"
                  />
                ) : loadingVideos ? (
                  <div className="text-center py-12">
                    <span className="animate-spin text-2xl">⏳</span>
                  </div>
                ) : (
                  <>
                    <CardHeader 
                      title={selectedTopic}
                      subtitle={`${topicVideos.length} videos`}
                      action={
                        <div className="flex gap-2">
                          <Badge variant="success">
                            {topicVideos.filter(v => v.performance_hint === 'Overperforming').length} overperforming
                          </Badge>
                          <Badge variant="default">
                            {topicVideos.filter(v => v.format === 'Long').length} Long / {topicVideos.filter(v => v.format === 'Shorts').length} Shorts
                          </Badge>
                        </div>
                      }
                    />
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {topicVideos.map(video => (
                        <VideoCard 
                          key={video.video_id} 
                          video={video}
                          onReclassify={() => openReclassify(video)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* Elements Tab */}
        {activeTab === 'elements' && (
          <Card>
            <CardHeader 
              icon="🖼️" 
              title="Thumbnail Elements" 
              subtitle="Visual elements that perform well"
            />
            {dna?.topElements?.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {dna.topElements.map((elem, idx) => (
                  <div key={idx} className="px-4 py-2 bg-gray-50 rounded-lg">
                    <span className="font-medium" dir="auto">{elem.element}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({elem.count} videos, {elem.success_rate}% success)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="🖼️"
                title="No Elements Analyzed"
                description="Thumbnail analysis will appear here after videos are processed."
              />
            )}
          </Card>
        )}

        {/* Topic Modal */}
        <Modal
          isOpen={showTopicModal}
          onClose={() => setShowTopicModal(false)}
          title={editingTopic ? 'Edit Topic' : 'Add Topic'}
        >
          <div className="space-y-4">
            {!editingTopic && (
              <Input
                label="Topic ID (lowercase, no spaces)"
                value={topicForm.topic_id}
                onChange={(e) => setTopicForm({...topicForm, topic_id: e.target.value})}
                placeholder="e.g., tech_news"
              />
            )}
            <Input
              label="English Name"
              value={topicForm.topic_name_en}
              onChange={(e) => setTopicForm({...topicForm, topic_name_en: e.target.value})}
              placeholder="Technology News"
            />
            <Input
              label="Arabic Name"
              value={topicForm.topic_name_ar}
              onChange={(e) => setTopicForm({...topicForm, topic_name_ar: e.target.value})}
              placeholder="أخبار التقنية"
              dir="rtl"
            />
            <Textarea
              label="Keywords (comma separated)"
              value={topicForm.keywords}
              onChange={(e) => setTopicForm({...topicForm, keywords: e.target.value})}
              placeholder="keyword1, keyword2, كلمة1, كلمة2"
              hint="These help auto-classify future videos"
            />
            <Textarea
              label="Description"
              value={topicForm.description}
              onChange={(e) => setTopicForm({...topicForm, description: e.target.value})}
              placeholder="What content belongs to this topic?"
            />
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowTopicModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={saveTopic} className="flex-1">
              {editingTopic ? 'Save Changes' : 'Create Topic'}
            </Button>
          </div>
        </Modal>

        {/* Reclassify Modal */}
        <Modal
          isOpen={showReclassifyModal}
          onClose={() => setShowReclassifyModal(false)}
          title="Reclassify Video"
        >
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Video:</p>
            <p className="font-medium" dir="auto">{reclassifyVideo?.title}</p>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-3">Select new topic:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {topics
              .filter(t => t.topic_id !== reclassifyVideo?.topic_id)
              .map(topic => (
                <button
                  key={topic.topic_id}
                  onClick={() => reclassifyVideoToTopic(topic.topic_id)}
                  className="w-full text-left px-4 py-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all"
                >
                  <span className="font-medium" dir="auto">{topic.topic_name_ar || topic.topic_id}</span>
                  <span className="text-sm text-gray-500 ml-2">({topic.topic_name_en})</span>
                </button>
              ))}
          </div>
          <Button variant="secondary" onClick={() => setShowReclassifyModal(false)} className="w-full mt-4">
            Cancel
          </Button>
        </Modal>
      </div>
    </LayoutWithNav>
  );
}

// Video Card Component
function VideoCard({ video, onReclassify }) {
  return (
    <div className={`flex gap-4 p-3 rounded-lg border ${
      video.performance_hint === 'Overperforming' ? 'border-green-200 bg-green-50' :
      video.performance_hint === 'Underperforming' ? 'border-red-100 bg-red-50' :
      'border-gray-200'
    }`}>
      <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        <img 
          src={video.thumbnail_url} 
          alt=""
          className="w-32 h-20 object-cover rounded"
        />
      </a>
      <div className="flex-1 min-w-0">
        <a 
          href={video.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
          dir="auto"
        >
          {video.title}
        </a>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant={video.format === 'Shorts' ? 'purple' : 'primary'}>
            {video.format}
          </Badge>
          <Badge variant={
            video.performance_hint === 'Overperforming' ? 'success' :
            video.performance_hint === 'Underperforming' ? 'danger' : 'default'
          }>
            {video.performance_hint || 'Average'}
          </Badge>
          <span className="text-xs text-gray-500">
            👁️ {Number(video.views_organic || video.views).toLocaleString()}
          </span>
          {video.ad_percentage > 5 && (
            <Badge variant="warning">{video.ad_percentage?.toFixed(0)}% ads</Badge>
          )}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onReclassify}>
        ✏️
      </Button>
    </div>
  );
}

// Insights Tab Component with sub-tabs
function InsightsTab({ showId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState('long');
  const [subTab, setSubTab] = useState('recent');

  useEffect(() => {
    fetchInsights();
  }, [showId]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/video-insights?showId=${showId}`);
      const data = await res.json();
      if (data.success) {
        setInsights(data.insights);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <span className="animate-spin text-3xl">⏳</span>
        <p className="text-gray-500 mt-2">Analyzing videos...</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <EmptyState
        icon="📊"
        title="No Insights Available"
        description="Import videos first to see insights"
      />
    );
  }

  const currentData = {
    recent: insights.recentVideos?.[format] || [],
    top: insights.topPerformers?.[format] || [],
    evergreen: insights.evergreenChampions?.[format] || [],
    formula: insights.successFormula?.[format] || null
  };

  const subTabs = [
    { 
      id: 'recent', 
      label: 'Recent', 
      icon: '🕐', 
      count: currentData.recent.length,
      description: 'Published in the last 30 days - showing last 7 days views'
    },
    { 
      id: 'top', 
      label: 'Top Performers', 
      icon: '🚀', 
      count: currentData.top.length,
      description: '7-90 days old - ranked by first 7 days views (algorithm push success)'
    },
    { 
      id: 'evergreen', 
      label: 'Evergreen', 
      icon: '🌲', 
      count: currentData.evergreen.length,
      description: '90+ days old with real views in the last 7 days (synced from YouTube)'
    },
    { 
      id: 'formula', 
      label: 'Success Formula', 
      icon: '🧬',
      description: 'Patterns discovered from your best performing content'
    },
  ];

  return (
    <div className="space-y-4">
      {/* Format Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={format === 'long' ? 'primary' : 'secondary'}
            onClick={() => setFormat('long')}
            icon="🎬"
          >
            Long Form
          </Button>
          <Button
            variant={format === 'shorts' ? 'primary' : 'secondary'}
            onClick={() => setFormat('shorts')}
            icon="📱"
          >
            Shorts
          </Button>
        </div>
        
        <Button variant="ghost" size="sm" onClick={fetchInsights} icon="🔄">
          Refresh
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`
              px-4 py-3 font-medium text-sm transition-all border-b-2 -mb-px flex items-center gap-2
              ${subTab === tab.id 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-gray-700'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                subTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab description */}
      <p className="text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
        ℹ️ {subTabs.find(t => t.id === subTab)?.description}
      </p>

      {/* Content */}
      <Card padding={false}>
        {subTab === 'recent' && (
          <VideoInsightList 
            videos={currentData.recent}
            emptyMessage="No videos published in the last 30 days"
          />
        )}

        {subTab === 'top' && (
          <VideoInsightList 
            videos={currentData.top}
            emptyMessage="No videos in the 7-90 day range yet"
            highlight="top"
          />
        )}

        {subTab === 'evergreen' && (
          <VideoInsightList 
            videos={currentData.evergreen}
            emptyMessage="No evergreen content yet (need videos 90+ days old with recent views)"
            highlight="evergreen"
          />
        )}

        {subTab === 'formula' && (
          <SuccessFormulaView formula={currentData.formula} format={format} />
        )}
      </Card>
    </div>
  );
}

// Video Insight List Component - uses display_metric and metric_label from API
function VideoInsightList({ videos, emptyMessage, highlight }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-2 block">📭</span>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y">
      {videos.map((video, idx) => (
        <div 
          key={video.video_id}
          className={`flex gap-4 p-4 hover:bg-gray-50 transition-all ${
            highlight === 'top' && idx < 3 ? 'bg-orange-50' :
            highlight === 'evergreen' && idx < 3 ? 'bg-green-50' : ''
          }`}
        >
          {/* Rank */}
          <div className="flex-shrink-0 w-8 text-center">
            <span className={`text-lg font-bold ${
              idx === 0 ? 'text-yellow-500' :
              idx === 1 ? 'text-gray-400' :
              idx === 2 ? 'text-orange-400' : 'text-gray-300'
            }`}>
              {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
            </span>
          </div>

          {/* Thumbnail */}
          <a 
            href={video.youtube_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img 
              src={video.thumbnail_url} 
              alt=""
              className="w-32 h-20 object-cover rounded-lg hover:opacity-80 transition-all"
            />
          </a>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <a 
              href={video.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2 block"
              dir="auto"
            >
              {video.title}
            </a>
            
            {/* Metrics Row */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              {/* Main metric from API */}
              <div className={`font-semibold ${
                highlight === 'top' ? 'text-orange-600' :
                highlight === 'evergreen' ? 'text-green-600' :
                'text-blue-600'
              }`}>
                {Number(video.display_metric || 0).toLocaleString()} {video.metric_label || 'views'}
              </div>
              
              <span className="text-gray-300">|</span>
              
              {/* Total organic */}
              <span className="text-gray-500">
                {Number(video.views_organic || video.views || 0).toLocaleString()} total
              </span>
              
              {/* Days old */}
              <span className="text-gray-400 text-xs">
                {video.days_old} days old
              </span>
              
              {/* Evergreen: show recent % */}
              {highlight === 'evergreen' && video.recent_percentage > 0 && (
                <Badge variant="success">
                  {video.recent_percentage}% recent
                </Badge>
              )}
              
              {/* Ad percentage warning */}
              {video.ad_percentage > 20 && (
                <Badge variant="warning">{video.ad_percentage?.toFixed(0)}% ads</Badge>
              )}
              
              {/* Topic */}
              {video.topic_id && (
                <Badge variant="default">{video.topic_id}</Badge>
              )}
              
              {/* Performance hint */}
              {video.performance_hint && (
                <Badge variant={
                  video.performance_hint === 'Overperforming' ? 'success' :
                  video.performance_hint === 'Underperforming' ? 'danger' : 'default'
                }>
                  {video.performance_hint}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Success Formula - update to use launchPattern instead of viralPattern
function SuccessFormulaView({ formula, format }) {
  if (!formula) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-2 block">🧬</span>
        <p>Not enough data to calculate success formula</p>
        <p className="text-sm mt-2">Need more videos across different age ranges</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Launch Pattern */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
        <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
          <span>🚀</span> Strong Launch Pattern
        </h4>
        <p className="text-sm text-orange-700 mb-3">{formula.launchPattern?.description}</p>
        
        {formula.launchPattern?.elements?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-orange-600 font-medium">Thumbnail elements:</span>
            {formula.launchPattern.elements.map((el, idx) => (
              <Badge key={idx} variant="orange">{el}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Evergreen Pattern */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
        <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
          <span>🌲</span> Lasting Power Pattern
        </h4>
        <p className="text-sm text-green-700 mb-3">{formula.evergreenPattern?.description}</p>
        
        {formula.evergreenPattern?.elements?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-green-600 font-medium">Thumbnail elements:</span>
            {formula.evergreenPattern.elements.map((el, idx) => (
              <Badge key={idx} variant="success">{el}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Winning Combo */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
          <span>🏆</span> Your Winning Combo
        </h4>
        <p className="text-sm text-purple-700 mb-3">{formula.winningCombo?.description}</p>
        
        {formula.winningCombo?.elements?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formula.winningCombo.elements.map((el, idx) => (
              <Badge key={idx} variant="purple">{el}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Top Topics */}
      {formula.topTopics?.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <span>📊</span> Best Performing Topics
          </h4>
          <div className="space-y-2">
            {formula.topTopics.map((topic, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">#{idx + 1}</span>
                  <span className="font-medium">{topic.name}</span>
                  <span className="text-sm text-gray-500">({topic.count} videos)</span>
                </div>
                <Badge variant={topic.successRate >= 50 ? 'success' : topic.successRate >= 25 ? 'warning' : 'default'}>
                  {topic.successRate}% success
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DNAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="animate-spin text-4xl">⏳</span>
      </div>
    }>
      <DNAContent />
    </Suspense>
  );
}

