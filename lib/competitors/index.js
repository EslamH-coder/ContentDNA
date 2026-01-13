/**
 * COMPETITORS MODULE ENTRY POINT
 */

export { CONTENT_TYPES, SUGGESTED_CHANNELS } from './competitorTypes.js';
export {
  addChannel,
  getChannels,
  getChannelsByType,
  updateChannel,
  deleteChannel,
  toggleChannelMonitor,
  getActiveChannels,
  addVideo,
  getVideos,
  deleteVideo,
  updateVideo,
  addInsight,
  getInsights,
  updateInsightStatus,
  getDashboardStats
} from './competitorStore.js';
export {
  analyzeAdjacentContent,
  discoverCrossoverOpportunities,
  extractFormatLessons
} from './adjacentAnalyzer.js';




