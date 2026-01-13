'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, ThumbsUp, ThumbsDown, Bookmark, Film, BarChart3 } from 'lucide-react';

export default function LearningStats({ showId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (showId) {
      fetchStats();
      // Refresh stats every 5 seconds to show updates
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [showId]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/feedback?showId=${showId}`);
      const result = await response.json();
      if (result.success) {
        setData(result);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching learning stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;
  }

  if (!data) return null;

  const { stats, weights } = data;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Learning Stats</h3>
        <span className="text-sm text-gray-500">(Last 30 Days)</span>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard 
          icon={ThumbsUp} 
          label="Liked" 
          value={stats.liked} 
          color="green" 
        />
        <StatCard 
          icon={ThumbsDown} 
          label="Rejected" 
          value={stats.rejected} 
          color="red" 
        />
        <StatCard 
          icon={Bookmark} 
          label="Saved" 
          value={stats.saved} 
          color="blue" 
        />
        <StatCard 
          icon={Film} 
          label="Produced" 
          value={stats.produced} 
          color="purple" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Total" 
          value={stats.total} 
          color="gray" 
        />
      </div>

      {/* Rates */}
      <div className="flex gap-6 text-sm mb-6">
        <div>
          <span className="text-green-600 font-bold text-lg">{stats.acceptance_rate}%</span>
          <span className="text-gray-500 ml-1">Acceptance Rate</span>
        </div>
        <div>
          <span className="text-purple-600 font-bold text-lg">{stats.production_rate}%</span>
          <span className="text-gray-500 ml-1">Production Rate</span>
        </div>
      </div>

      {/* Learned Topics */}
      {weights?.topic_weights && Object.keys(weights.topic_weights).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Learned Topic Preferences
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(weights.topic_weights)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([topic, weight]) => (
                <TopicBadge key={topic} topic={topic} weight={weight} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600'
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <Icon className="w-5 h-5 mb-2" />
      <div className="text-2xl font-bold">{value || 0}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function TopicBadge({ topic, weight }) {
  const getStyle = () => {
    if (weight >= 1.2) return 'bg-green-100 text-green-800 border-green-200';
    if (weight <= 0.8) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getLabel = () => {
    if (weight >= 1.2) return '↑';
    if (weight <= 0.8) return '↓';
    return '→';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs border ${getStyle()}`}>
      {topic} <span className="font-mono">{weight.toFixed(2)}x {getLabel()}</span>
    </span>
  );
}


