'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LayoutWithNav from '../layout-with-nav';

function StoryIdeasContent() {
  const searchParams = useSearchParams();
  const showId = searchParams.get('showId') || '59dd9aef-bc59-4f79-b944-b8a345cf71c3';
  
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    anniversaries: [],
    islamicEvents: [],
    sportsEvents: [],
    seasonalEvents: [],
    newsSignals: [],
    ideaBank: []
  });
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: '', description: '', priority: 5 });

  useEffect(() => {
    fetchAllData();
  }, [showId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/story-ideas?showId=${showId}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching story ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSignals = async () => {
    try {
      const res = await fetch(`/api/signals/refresh?showId=${showId}`, { method: 'POST' });
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        alert('Error: Server returned non-JSON response. Check console for details.');
        return;
      }
      
      const result = await res.json();
      if (result.success) {
        // Wait a bit for processing, then refresh
        setTimeout(() => {
          fetchAllData();
        }, 2000);
        alert(`Refreshed! Imported ${result.imported} new signals from ${result.sourcesProcessed} sources.`);
      } else {
        alert('Error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error refreshing signals:', error);
      alert('Error refreshing signals: ' + error.message);
    }
  };

  const addIdea = async () => {
    try {
      const res = await fetch('/api/idea-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, ...newIdea })
      });
      const result = await res.json();
      if (result.success) {
        setShowAddIdea(false);
        setNewIdea({ title: '', description: '', priority: 5 });
        fetchAllData();
      }
    } catch (error) {
      console.error('Error adding idea:', error);
    }
  };

  const updateIdeaStatus = async (ideaId, status) => {
    try {
      await fetch('/api/idea-bank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaId, status })
      });
      fetchAllData();
    } catch (error) {
      console.error('Error updating idea:', error);
    }
  };

  if (loading) {
    return (
      <LayoutWithNav>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <span className="animate-spin text-4xl">⏳</span>
            <p className="mt-4 text-gray-600">Loading story ideas...</p>
          </div>
        </div>
      </LayoutWithNav>
    );
  }

  return (
    <LayoutWithNav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📚 Story Ideas</h1>
            <p className="text-gray-600 mt-1">أفكار القصص والمواضيع</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refreshSignals}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              🔄 Refresh News
            </button>
            <button
              onClick={() => setShowAddIdea(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              ➕ Add Idea
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto">
          {[
            { id: 'upcoming', label: '📅 Upcoming', count: data.anniversaries?.length || 0 },
            { id: 'islamic', label: '🕌 Islamic', count: data.islamicEvents?.length || 0 },
            { id: 'sports', label: '⚽ Sports', count: data.sportsEvents?.length || 0 },
            { id: 'seasonal', label: '🌤️ Seasonal', count: data.seasonalEvents?.length || 0 },
            { id: 'news', label: '📰 News', count: data.newsSignals?.length || 0 },
            { id: 'ideas', label: '💡 Idea Bank', count: data.ideaBank?.length || 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          
          {/* Upcoming Anniversaries */}
          {activeTab === 'upcoming' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-yellow-800">📅 ذكريات قادمة في الأسبوعين القادمين</h3>
                <p className="text-sm text-yellow-700">أحداث تاريخية يمكن استغلالها لإنشاء محتوى</p>
              </div>
              
              {data.anniversaries?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">📅</span>
                  <p>لا توجد ذكريات في الأسبوعين القادمين</p>
                </div>
              ) : (
                data.anniversaries?.map((event, idx) => (
                  <EventCard key={idx} event={event} type="anniversary" showId={showId} />
                ))
              )}
            </div>
          )}

          {/* Islamic Events */}
          {activeTab === 'islamic' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-green-800">🕌 مناسبات إسلامية</h3>
                <p className="text-sm text-green-700">أفكار قصص مرتبطة بالمناسبات الدينية</p>
              </div>
              
              {data.islamicEvents?.map((event, idx) => (
                <EventCard key={idx} event={event} type="islamic" showId={showId} />
              ))}
            </div>
          )}

          {/* Sports Events */}
          {activeTab === 'sports' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-purple-800">⚽ أحداث رياضية</h3>
                <p className="text-sm text-purple-700">قصص مرتبطة بالبطولات والرياضة</p>
              </div>
              
              {data.sportsEvents?.map((event, idx) => (
                <EventCard key={idx} event={event} type="sports" showId={showId} />
              ))}
            </div>
          )}

          {/* Seasonal Events */}
          {activeTab === 'seasonal' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-orange-800">🌤️ مواسم</h3>
                <p className="text-sm text-orange-700">قصص مرتبطة بالمواسم السنوية</p>
              </div>
              
              {data.seasonalEvents?.map((event, idx) => (
                <EventCard key={idx} event={event} type="seasonal" showId={showId} />
              ))}
            </div>
          )}

          {/* News Signals */}
          {activeTab === 'news' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-blue-800">📰 أخبار للإلهام</h3>
                <p className="text-sm text-blue-700">أخبار حالية يمكن ربطها بقصص تاريخية</p>
              </div>
              
              {data.newsSignals?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-4 block">📰</span>
                  <p>لا توجد أخبار حالياً</p>
                  <button
                    onClick={refreshSignals}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    🔄 Fetch News
                  </button>
                </div>
              ) : (
                data.newsSignals?.map((signal, idx) => (
                  <NewsCard key={idx} signal={signal} showId={showId} />
                ))
              )}
            </div>
          )}

          {/* Idea Bank */}
          {activeTab === 'ideas' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-indigo-800">💡 بنك الأفكار</h3>
                <p className="text-sm text-indigo-700">أفكار الفريق والجمهور</p>
              </div>
              
              {data.ideaBank?.map((idea, idx) => (
                <IdeaCard key={idx} idea={idea} onStatusChange={updateIdeaStatus} showId={showId} />
              ))}
            </div>
          )}
        </div>

        {/* Add Idea Modal */}
        {showAddIdea && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
              <h3 className="text-lg font-semibold mb-4">➕ إضافة فكرة جديدة</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                  <input
                    type="text"
                    value={newIdea.title}
                    onChange={(e) => setNewIdea({...newIdea, title: e.target.value})}
                    placeholder="عنوان القصة أو الفكرة"
                    className="w-full px-3 py-2 border rounded-lg"
                    dir="rtl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                  <textarea
                    value={newIdea.description}
                    onChange={(e) => setNewIdea({...newIdea, description: e.target.value})}
                    placeholder="وصف مختصر للفكرة..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                    dir="rtl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية (1-10)</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={newIdea.priority}
                    onChange={(e) => setNewIdea({...newIdea, priority: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>منخفضة</span>
                    <span className="font-bold text-blue-600">{newIdea.priority}</span>
                    <span>عالية</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddIdea(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={addIdea}
                  disabled={!newIdea.title}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWithNav>
  );
}

// Event Card Component
function EventCard({ event, type, showId }) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const storyAngles = event.story_angles || [];
  
  const generatePitch = async (angle) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          showId, 
          topic: angle,
          context: `Event: ${event.title_ar}. Year: ${event.event_year || 'recurring'}`
        })
      });
      const data = await res.json();
      if (data.pitch) {
        alert('Pitch generated! Check the console for now.');
        console.log('Generated Pitch:', data.pitch);
      }
    } catch (error) {
      console.error('Error generating pitch:', error);
    } finally {
      setGenerating(false);
    }
  };

  const bgColors = {
    anniversary: 'bg-yellow-50 border-yellow-200',
    islamic: 'bg-green-50 border-green-200',
    sports: 'bg-purple-50 border-purple-200',
    seasonal: 'bg-orange-50 border-orange-200'
  };

  return (
    <div className={`rounded-xl border p-4 ${bgColors[type] || 'bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {event.event_date && (
              <span className="text-xs px-2 py-1 bg-white rounded-full font-medium">
                📅 {event.event_date}
              </span>
            )}
            {event.event_year && (
              <span className="text-xs px-2 py-1 bg-white rounded-full">
                منذ {new Date().getFullYear() - event.event_year} سنة
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full ${
              event.importance >= 9 ? 'bg-red-100 text-red-700' :
              event.importance >= 7 ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              أهمية: {event.importance}/10
            </span>
          </div>
          
          <h3 className="font-semibold text-gray-900 text-lg">{event.title_ar}</h3>
          {event.title_en && (
            <p className="text-sm text-gray-500">{event.title_en}</p>
          )}
        </div>
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      
      {/* Story Angles */}
      {expanded && storyAngles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">💡 زوايا للقصة:</h4>
          <div className="space-y-2">
            {storyAngles.map((angle, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3">
                <span className="text-sm text-gray-800">{angle}</span>
                <button
                  onClick={() => generatePitch(angle)}
                  disabled={generating}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {generating ? '...' : '✨ Generate'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// News Card Component
function NewsCard({ signal, showId }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              {signal.source}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(signal.created_at).toLocaleDateString('ar-SA')}
            </span>
          </div>
          
          <a 
            href={signal.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2"
          >
            {signal.title}
          </a>
          
          {signal.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{signal.description}</p>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50"
          >
            🔗 Open
          </a>
        </div>
      </div>
    </div>
  );
}

// Idea Card Component
function IdeaCard({ idea, onStatusChange, showId }) {
  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    researching: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    produced: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[idea.status] || 'bg-gray-100 text-gray-700'}`}>
              {idea.status}
            </span>
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
              أولوية: {idea.priority}/10
            </span>
            {idea.source && (
              <span className="text-xs text-gray-400">{idea.source}</span>
            )}
          </div>
          
          <h3 className="font-semibold text-gray-900">{idea.title}</h3>
          
          {idea.description && (
            <p className="text-sm text-gray-600 mt-2">{idea.description}</p>
          )}
        </div>
        
        <div className="flex flex-col gap-1">
          <select
            value={idea.status}
            onChange={(e) => onStatusChange(idea.id, e.target.value)}
            className="text-xs px-2 py-1 border rounded-lg"
          >
            <option value="new">New</option>
            <option value="researching">Researching</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="produced">Produced</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function StoryIdeasPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <StoryIdeasContent />
    </Suspense>
  );
}

