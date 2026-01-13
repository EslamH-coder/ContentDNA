import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    const { data: videos, error } = await supabase
      .from('channel_videos')
      .select('*')
      .eq('show_id', showId)
      .order('publish_date', { ascending: false });

    if (error) throw error;

    if (!videos || videos.length === 0) {
      return NextResponse.json({ 
        success: true, 
        insights: {
          recentVideos: { long: [], shorts: [] },
          topPerformers: { long: [], shorts: [] },
          evergreenChampions: { long: [], shorts: [] },
          successFormula: { long: null, shorts: null }
        },
        stats: { longCount: 0, shortsCount: 0 }
      });
    }

    const now = new Date();
    
    // Age boundaries
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

    // Separate by format
    const longVideos = videos.filter(v => v.format === 'Long');
    const shortsVideos = videos.filter(v => v.format === 'Shorts');

    // Helper to calculate days since publish
    const getDaysOld = (publishDate) => {
      if (!publishDate) return 999;
      const published = new Date(publishDate);
      return Math.floor((now - published) / (24 * 60 * 60 * 1000));
    };

    // Process each format
    const processFormat = (formatVideos) => {
      if (!formatVideos || formatVideos.length === 0) {
        return {
          recentVideos: [],
          topPerformers: [],
          evergreenChampions: []
        };
      }

      // RECENT: Published in last 30 days
      // Show: current views (last 7 days) - they're still accumulating
      const recentVideos = formatVideos
        .filter(v => {
          const publishDate = new Date(v.publish_date);
          return publishDate > thirtyDaysAgo;
        })
        .map(v => ({
          ...v,
          days_old: getDaysOld(v.publish_date),
          display_metric: v.views_7_days_organic || 0,
          metric_label: 'views (last 7 days)'
        }))
        .sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date))
        .slice(0, 15);

      // TOP PERFORMERS: 7-90 days old
      // Use FIRST 7 DAYS organic views - this is the true "launch success" metric
      // YouTube pushes hard in first week, so this shows algorithm favorites
      const topPerformers = formatVideos
        .filter(v => {
          const publishDate = new Date(v.publish_date);
          return publishDate <= sevenDaysAgo && publishDate > ninetyDaysAgo;
        })
        .map(v => ({
          ...v,
          days_old: getDaysOld(v.publish_date),
          display_metric: v.views_7_days_organic || 0,
          metric_label: 'views (first 7 days)'
        }))
        .sort((a, b) => (b.views_7_days_organic || 0) - (a.views_7_days_organic || 0))
        .slice(0, 15);

      // EVERGREEN: 90+ days old WITH fresh synced data
      // Only show videos that have been synced and are getting real views now
      const evergreenChampions = formatVideos
        .filter(v => {
          const publishDate = new Date(v.publish_date);
          const isOldEnough = publishDate <= ninetyDaysAgo;
          
          // MUST have fresh synced data
          const hasFreshData = typeof v.views_last_7_days_current === 'number' && 
                               v.views_last_7_days_current > 0 &&
                               v.views_last_7_days_updated_at !== null;
          
          return isOldEnough && hasFreshData;
        })
        .map(v => {
          const daysOld = getDaysOld(v.publish_date);
          const totalOrganic = v.views_organic || v.views || 0;
          const last7Days = v.views_last_7_days_current;
          
          // Calculate "evergreen ratio" - what % of total views came in last 7 days
          // Higher = more evergreen / trending again
          const evergreenRatio = totalOrganic > 0 
            ? ((last7Days / totalOrganic) * 100 * 52).toFixed(2) // Annualized %
            : 0;
          
          return {
            ...v,
            days_old: daysOld,
            has_fresh_data: true,
            display_metric: last7Days,
            metric_label: 'views (last 7 days) ✓',
            secondary_metric: totalOrganic,
            secondary_label: 'total organic',
            evergreen_ratio: evergreenRatio,
            sort_value: last7Days
          };
        })
        .filter(v => v.display_metric >= 100) // At least 100 views in last 7 days
        .sort((a, b) => b.sort_value - a.sort_value)
        .slice(0, 15);

      return {
        recentVideos,
        topPerformers,
        evergreenChampions
      };
    };

    const longInsights = processFormat(longVideos);
    const shortsInsights = processFormat(shortsVideos);

    // Calculate Success Formula
    const calculateSuccessFormula = (formatVideos, topPerformers, evergreenChampions) => {
      if (!formatVideos || formatVideos.length < 3) return null;

      // Analyze top performers for patterns (what launches well)
      const topPerformerTopics = {};
      const topPerformerElements = {};
      
      topPerformers.forEach(v => {
        if (v.topic_id) {
          topPerformerTopics[v.topic_id] = (topPerformerTopics[v.topic_id] || 0) + 1;
        }
        if (v.thumbnail_elements && Array.isArray(v.thumbnail_elements)) {
          v.thumbnail_elements.forEach(el => {
            topPerformerElements[el] = (topPerformerElements[el] || 0) + 1;
          });
        }
      });

      // Analyze evergreen for patterns (what lasts)
      const evergreenTopics = {};
      const evergreenElements = {};
      
      evergreenChampions.forEach(v => {
        if (v.topic_id) {
          evergreenTopics[v.topic_id] = (evergreenTopics[v.topic_id] || 0) + 1;
        }
        if (v.thumbnail_elements && Array.isArray(v.thumbnail_elements)) {
          v.thumbnail_elements.forEach(el => {
            evergreenElements[el] = (evergreenElements[el] || 0) + 1;
          });
        }
      });

      // Sort by count
      const sortByCount = (obj) => Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      const topLaunchTopics = sortByCount(topPerformerTopics);
      const topLaunchElements = sortByCount(topPerformerElements);
      const topEvergreenTopics = sortByCount(evergreenTopics);
      const topEvergreenElements = sortByCount(evergreenElements);

      // Find intersection (winning combo - good launch AND lasting power)
      const commonTopics = topLaunchTopics.filter(t => topEvergreenTopics.includes(t));
      const commonElements = topLaunchElements.filter(e => topEvergreenElements.includes(e));

      // Calculate success rates for topics
      const topTopics = Object.entries(topPerformerTopics)
        .map(([name, count]) => {
          const topicVideos = formatVideos.filter(v => v.topic_id === name);
          const overperforming = topicVideos.filter(v => v.performance_hint === 'Overperforming').length;
          const successRate = topicVideos.length > 0 
            ? Math.round((overperforming / topicVideos.length) * 100) 
            : 0;
          return { name, successRate, count: topicVideos.length };
        })
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5);

      return {
        launchPattern: {
          description: topLaunchTopics.length > 0 
            ? `Topics that launch strong: ${topLaunchTopics.slice(0, 3).join(', ')}`
            : 'Need more videos (7-90 days old) to analyze',
          elements: topLaunchElements,
          topics: topLaunchTopics
        },
        evergreenPattern: {
          description: topEvergreenTopics.length > 0
            ? `Topics with lasting power: ${topEvergreenTopics.slice(0, 3).join(', ')}`
            : 'Need videos older than 90 days to analyze',
          elements: topEvergreenElements,
          topics: topEvergreenTopics
        },
        winningCombo: {
          description: commonTopics.length > 0 
            ? `Best of both worlds (strong launch + lasting): ${commonTopics.join(', ')}`
            : 'Create more content to find your winning combo',
          elements: commonElements,
          topics: commonTopics
        },
        topTopics
      };
    };

    const longFormula = calculateSuccessFormula(longVideos, longInsights.topPerformers, longInsights.evergreenChampions);
    const shortsFormula = calculateSuccessFormula(shortsVideos, shortsInsights.topPerformers, shortsInsights.evergreenChampions);

    return NextResponse.json({
      success: true,
      insights: {
        recentVideos: {
          long: longInsights.recentVideos,
          shorts: shortsInsights.recentVideos
        },
        topPerformers: {
          long: longInsights.topPerformers,
          shorts: shortsInsights.topPerformers
        },
        evergreenChampions: {
          long: longInsights.evergreenChampions,
          shorts: shortsInsights.evergreenChampions
        },
        successFormula: {
          long: longFormula,
          shorts: shortsFormula
        }
      },
      stats: {
        longCount: longVideos.length,
        shortsCount: shortsVideos.length,
        recentCount: longInsights.recentVideos.length + shortsInsights.recentVideos.length,
        topPerformersCount: longInsights.topPerformers.length + shortsInsights.topPerformers.length,
        evergreenCount: longInsights.evergreenChampions.length + shortsInsights.evergreenChampions.length
      }
    });

  } catch (error) {
    console.error('Video insights error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
