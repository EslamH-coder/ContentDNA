'use client';

import { useState } from 'react';

const REJECTION_REASONS = [
  { id: 'not_relevant', label: 'Not relevant to channel', icon: '❌' },
  { id: 'bad_source', label: 'Bad source quality', icon: '📰' },
  { id: 'bad_timing', label: 'Bad timing', icon: '⏰' },
  { id: 'low_interest', label: 'Low expected audience interest', icon: '📉' },
  { id: 'already_covered', label: 'Already covered', icon: '📺' },
  { id: 'angle_too_broad', label: 'Angle too broad', icon: '🎯' }
];

export default function StoryModal({ isOpen, onClose, story, onLike, onReject, showId }) {
  const [rejectingSignalId, setRejectingSignalId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState(null);

  if (!isOpen || !story) return null;

  const { signals, mainSignal } = story;

  const handleLike = async (signalId) => {
    if (onLike) {
      await onLike(signalId);
    }
  };

  const handleRejectClick = (signalId) => {
    setSelectedSignalId(signalId);
    setShowRejectModal(true);
  };

  const handleReject = async (reason) => {
    if (onReject && selectedSignalId) {
      setRejectingSignalId(selectedSignalId);
      await onReject(selectedSignalId, reason);
      setRejectingSignalId(null);
      setShowRejectModal(false);
      setSelectedSignalId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Trending Story
                </h2>
                <p className="text-sm text-gray-500">
                  {signals.length} angles from different sources
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Angles List */}
        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
          {signals.map((signal, index) => (
            <div 
              key={signal.id || index}
              className={`
                p-4 rounded-xl border transition-all
                ${index === 0 
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}
              `}
            >
              {/* Rank Badge */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className={`
                  inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${index === 0 
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}
                `}>
                  {index === 0 ? '★ Main Angle' : `Angle ${index + 1}`}
                </span>
                <span className="text-xs text-gray-400">
                  {signal.source || 'News'}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 leading-snug">
                <a 
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                  dir="auto"
                >
                  {signal.title}
                </a>
              </h3>

              {/* Description */}
              {signal.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2" dir="auto">
                  {signal.description}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span>Score: {signal.relevance_score || signal.score || '-'}</span>
                {signal.hook_potential && (
                  <span className="text-green-600">
                    Hook: {typeof signal.hook_potential === 'string' ? signal.hook_potential : signal.hook_potential}
                  </span>
                )}
                {signal.matched_topic && signal.matched_topic !== 'other_stories' && (
                  <span className="text-blue-600">
                    Topic: {signal.matched_topic}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLike(signal.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  Like
                </button>
                <button
                  onClick={() => handleRejectClick(signal.id)}
                  disabled={rejectingSignalId === signal.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                  {rejectingSignalId === signal.id ? 'Rejecting...' : 'Reject'}
                </button>
                {signal.url && (
                  <a
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-auto"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Source
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Tip: Like the best angle, reject duplicates
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  // Reject all except first with 'already_covered' reason
                  for (const s of signals.slice(1)) {
                    if (onReject) {
                      await onReject(s.id, 'already_covered');
                    }
                  }
                  onClose();
                }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Keep Main, Reject Others
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Why reject this angle?
            </h3>
            
            <div className="space-y-2">
              {REJECTION_REASONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => handleReject(reason.id)}
                  disabled={rejectingSignalId === selectedSignalId}
                  className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{reason.icon}</span>
                  <span className="text-gray-900 dark:text-white">{reason.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowRejectModal(false);
                setSelectedSignalId(null);
              }}
              className="mt-4 w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

