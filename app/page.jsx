'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LayoutWithNav from './layout-with-nav';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getUserShows } from '@/lib/userShows';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showId = searchParams.get('showId');
  
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [show, setShow] = useState(null);
  const [stats, setStats] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [topTopics, setTopTopics] = useState([]);
  const [recentIdeas, setRecentIdeas] = useState([]);

  // Auto-redirect to first show if no showId
  useEffect(() => {
    async function redirectToFirstShow() {
      if (showId) {
        // Already have showId, proceed normally
        return;
      }

      setRedirecting(true);
      try {
        const { shows, error } = await getUserShows();
        
        if (error) {
          console.error('Error fetching shows:', error);
          setRedirecting(false);
          setLoading(false);
          return;
        }

        if (shows && shows.length > 0) {
          // Redirect to first show
          const firstShowId = shows[0].id;
          router.replace(`/?showId=${firstShowId}`);
        } else {
          // No shows available
          setRedirecting(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error redirecting to show:', error);
        setRedirecting(false);
        setLoading(false);
      }
    }

    redirectToFirstShow();
  }, [showId, router]);

  useEffect(() => {
    if (showId) {
      fetchDashboardData();
    } else if (!redirecting) {
      setLoading(false);
    }
  }, [showId, redirecting]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch show info
      const showRes = await fetch(`/api/shows/${showId}`);
      const showData = await showRes.json();
      if (showData.success) setShow(showData.show);

      // Fetch DNA stats
      const dnaRes = await fetch(`/api/content-dna?showId=${showId}`);
      const dnaData = await dnaRes.json();
      if (dnaData.success) {
        setStats(dnaData.dna.stats);
        setTopTopics(dnaData.dna.topTopics?.slice(0, 5) || []);
      }

      // Fetch upcoming events
      const ideasRes = await fetch(`/api/story-ideas?showId=${showId}`);
      const ideasData = await ideasRes.json();
      if (ideasData.success) {
        setUpcomingEvents(ideasData.data.anniversaries?.slice(0, 3) || []);
        setRecentIdeas(ideasData.data.ideaBank?.slice(0, 3) || []);
      }

    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while redirecting
  if (redirecting) {
    return (
      <LayoutWithNav>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <span className="animate-spin text-4xl">⏳</span>
          <p className="text-gray-500 mt-4">Loading your show...</p>
        </div>
      </LayoutWithNav>
    );
  }

  if (!showId) {
    return (
      <LayoutWithNav>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <EmptyState
            icon="🎬"
            title="Welcome to ContentDNA"
            description="Select a show from the dropdown above or add a new show to get started."
            action={
              <Link href="/onboarding">
                <Button icon="➕">Add Your First Show</Button>
              </Link>
            }
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
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </LayoutWithNav>
    );
  }

  return (
    <LayoutWithNav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{show?.name}</h1>
          <p className="text-gray-500 mt-1">Dashboard overview and quick actions</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon="🎬" 
            value={stats?.total_videos || 0} 
            label="Total Videos" 
            color="blue"
          />
          <StatCard 
            icon="👁️" 
            value={`${((stats?.total_views_organic || 0) / 1000000).toFixed(1)}M`} 
            label="Organic Views" 
            color="green"
          />
          <StatCard 
            icon="⭐" 
            value={stats?.overperforming || 0} 
            label="Overperforming" 
            color="purple"
          />
          <StatCard 
            icon="📊" 
            value={`${stats?.avg_ad_percentage?.toFixed(0) || 0}%`} 
            label="Ad Traffic" 
            color="orange"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Top Topics */}
            <Card>
              <CardHeader 
                icon="🏆" 
                title="Top Performing Topics" 
                subtitle="By organic views"
                action={
                  <Link href={`/dna?showId=${showId}&tab=topics`}>
                    <Button variant="ghost" size="sm">View All →</Button>
                  </Link>
                }
              />
              
              {topTopics.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No topics analyzed yet</p>
              ) : (
                <div className="space-y-3">
                  {topTopics.map((topic, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                        <div>
                          <p className="font-medium text-gray-900">{topic.topic_id}</p>
                          <p className="text-sm text-gray-500">{topic.video_count} videos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {Number(topic.avg_views_organic).toLocaleString()}
                        </p>
                        <Badge variant={topic.success_rate >= 50 ? 'success' : 'default'}>
                          {topic.success_rate}% success
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader icon="⚡" title="Quick Actions" />
              <div className="grid grid-cols-2 gap-3">
                <Link href={`/ideas?showId=${showId}&tab=calendar`}>
                  <div className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer">
                    <span className="text-2xl mb-2 block">📅</span>
                    <p className="font-medium text-gray-900">Browse Calendar</p>
                    <p className="text-sm text-gray-500">Find story opportunities</p>
                  </div>
                </Link>
                <Link href={`/ideas?showId=${showId}&tab=news`}>
                  <div className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer">
                    <span className="text-2xl mb-2 block">📰</span>
                    <p className="font-medium text-gray-900">Check News</p>
                    <p className="text-sm text-gray-500">Get inspired by current events</p>
                  </div>
                </Link>
                <Link href={`/dna?showId=${showId}&tab=videos`}>
                  <div className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer">
                    <span className="text-2xl mb-2 block">🎬</span>
                    <p className="font-medium text-gray-900">Explore Videos</p>
                    <p className="text-sm text-gray-500">Analyze past performance</p>
                  </div>
                </Link>
                <Link href={`/ideas?showId=${showId}&tab=backlog`}>
                  <div className="p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer">
                    <span className="text-2xl mb-2 block">💡</span>
                    <p className="font-medium text-gray-900">Idea Backlog</p>
                    <p className="text-sm text-gray-500">Manage your ideas</p>
                  </div>
                </Link>
              </div>
            </Card>
          </div>

          {/* Right Column - 1/3 */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <Card>
              <CardHeader 
                icon="📅" 
                title="Upcoming Events"
                action={
                  <Link href={`/ideas?showId=${showId}&tab=calendar`}>
                    <Button variant="ghost" size="sm">View All →</Button>
                  </Link>
                }
              />
              
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No upcoming events</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event, idx) => (
                    <div key={idx} className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="warning">{event.event_date}</Badge>
                        {event.event_year && (
                          <span className="text-xs text-gray-500">
                            {new Date().getFullYear() - event.event_year} years ago
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 text-sm" dir="auto">
                        {event.title_ar || event.title_en}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Ideas */}
            <Card>
              <CardHeader 
                icon="💡" 
                title="Recent Ideas"
                action={
                  <Link href={`/ideas?showId=${showId}&tab=backlog`}>
                    <Button variant="ghost" size="sm">View All →</Button>
                  </Link>
                }
              />
              
              {recentIdeas.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-3">No ideas yet</p>
                  <Link href={`/ideas?showId=${showId}&tab=backlog`}>
                    <Button size="sm" icon="➕">Add Idea</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentIdeas.map((idea, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={
                          idea.status === 'approved' ? 'success' : 
                          idea.status === 'researching' ? 'warning' : 'default'
                        }>
                          {idea.status}
                        </Badge>
                        <Badge variant="purple">Priority: {idea.priority}</Badge>
                      </div>
                      <p className="font-medium text-gray-900 text-sm" dir="auto">
                        {idea.title}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </LayoutWithNav>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="animate-spin text-4xl">⏳</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
