'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ExternalLink, Play } from 'lucide-react';

export default function StudioCompetitorsPage() {
  const [competitors, setCompetitors] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showId, setShowId] = useState(null);

  useEffect(() => {
    fetchCompetitorData();
  }, []);

  const fetchCompetitorData = async () => {
    try {
      // Get showId from API (uses cookies for auth)
      const showResponse = await fetch('/api/shows/current', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!showResponse.ok) {
        console.error('Failed to get show:', showResponse.status);
        setLoading(false);
        return;
      }
      
      const showData = await showResponse.json();
      if (!showData.show?.id) {
        console.error('No show found');
        setLoading(false);
        return;
      }
      
      const currentShowId = showData.show.id;
      setShowId(currentShowId);
      
      // Fetch competitors
      const compResponse = await fetch(`/api/competitors?showId=${currentShowId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (compResponse.ok) {
        const compData = await compResponse.json();
        setCompetitors(compData.competitors || []);
      } else {
        console.error('Failed to fetch competitors:', compResponse.status);
      }

      // Fetch recent competitor videos
      const videoResponse = await fetch(`/api/competitors/videos?showId=${currentShowId}&limit=20`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (videoResponse.ok) {
        const videoData = await videoResponse.json();
        setVideos(videoData.videos || []);
      } else {
        console.error('Failed to fetch videos:', videoResponse.status);
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(0) + 'K';
    return views.toLocaleString();
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-500">Loading competitor data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          📊 Competitor Activity
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          See what's working for channels in your space
        </p>
      </div>

      {/* Competitors List */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {competitors.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No competitors configured yet
          </div>
        ) : (
          competitors.slice(0, 8).map(comp => (
            <div
              key={comp.id}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center"
            >
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center text-xl">
                {comp.channel_name?.[0] || comp.name?.[0] || '?'}
              </div>
              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                {comp.channel_name || comp.name || 'Unknown'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {comp.competitor_type === 'direct' ? '🎯 Direct' : 
                 comp.competitor_type === 'trendsetter' ? '⚡ Trendsetter' : 
                 '📌 Indirect'}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Recent Videos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Videos
        </h2>
        
        <div className="space-y-3">
          {videos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent videos found</p>
          ) : (
            videos.map(video => (
              <div
                key={video.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4"
              >
                {/* Thumbnail */}
                <div className="w-32 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Play className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {video.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {video.channel_name}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{formatViews(video.views)} views</span>
                    <span>{formatDate(video.published_at || video.created_at)}</span>
                    {video.is_breakout && (
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-3 h-3" />
                        Breakout
                      </span>
                    )}
                  </div>
                </div>

                {/* Link */}
                {video.video_id && (
                  <a
                    href={`https://youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
