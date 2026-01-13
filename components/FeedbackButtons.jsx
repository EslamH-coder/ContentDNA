'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Bookmark, Film } from 'lucide-react';
import { FEEDBACK_ACTIONS } from '@/lib/constants/systemLabels';

const REJECTION_REASONS = [
  { id: 'not_relevant', label: 'Not relevant to channel', icon: '❌' },
  { id: 'already_covered', label: 'Already covered this topic', icon: '📺' },
  { id: 'angle_too_broad', label: 'Angle too broad/generic', icon: '🎯' },
  { id: 'weak_evidence', label: 'Evidence not convincing', icon: '📊' },
  { id: 'bad_timing', label: 'Bad timing', icon: '⏰' },
  { id: 'low_interest', label: 'Low expected audience interest', icon: '📉' }
];

export default function FeedbackButtons({ 
  recommendation, 
  showId, 
  onFeedback,
  sessionId 
}) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [shownAt] = useState(new Date().toISOString());

  const submitFeedback = async (action, rejectionReason = null) => {
    setLoading(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_id: showId,
          recommendation_id: recommendation.id || `${recommendation.topic}-${Date.now()}`,
          topic: recommendation.topic,
          topic_type: recommendation.type,
          original_score: recommendation.score,
          evidence_summary: {
            search_terms_count: recommendation.evidence?.search_terms?.length || 0,
            competitor_videos_count: recommendation.evidence?.competitor_videos?.length || 0,
            comments_count: recommendation.evidence?.audience_comments?.length || 0,
            current_events_count: recommendation.evidence?.current_events?.length || 0
          },
          action,
          rejection_reason: rejectionReason,
          shown_at: shownAt,
          session_id: sessionId
        })
      });

      if (response.ok) {
        setSubmitted(action);
        onFeedback?.(action, recommendation);
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
    } finally {
      setLoading(false);
      setShowRejectModal(false);
    }
  };

  if (submitted) {
    const messages = {
      [FEEDBACK_ACTIONS.LIKED]: { text: 'Marked as relevant', color: 'text-green-600' },
      [FEEDBACK_ACTIONS.REJECTED]: { text: 'Marked as not relevant', color: 'text-red-600' },
      [FEEDBACK_ACTIONS.SAVED]: { text: 'Saved for later', color: 'text-blue-600' },
      [FEEDBACK_ACTIONS.PRODUCED]: { text: 'Marked as produced', color: 'text-purple-600' }
    };
    const msg = messages[submitted];
    return (
      <div className={`flex items-center gap-2 text-sm ${msg.color}`}>
        ✓ {msg.text}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => submitFeedback(FEEDBACK_ACTIONS.LIKED)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <ThumbsUp className="w-4 h-4" />
          Like
        </button>

        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <ThumbsDown className="w-4 h-4" />
          Reject
        </button>

        <button
          onClick={() => submitFeedback(FEEDBACK_ACTIONS.SAVED)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Bookmark className="w-4 h-4" />
          Save
        </button>

        <button
          onClick={() => submitFeedback(FEEDBACK_ACTIONS.PRODUCED)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Film className="w-4 h-4" />
          Produced
        </button>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              Why is this not relevant?
            </h3>
            
            <div className="space-y-2">
              {REJECTION_REASONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => submitFeedback(FEEDBACK_ACTIONS.REJECTED, reason.id)}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>{reason.icon}</span>
                  <span>{reason.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowRejectModal(false)}
              className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}




