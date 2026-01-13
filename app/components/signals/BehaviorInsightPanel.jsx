/**
 * BEHAVIOR INSIGHT PANEL
 * Shows WHY the audience cares about this topic
 */

'use client';
import { useState } from 'react';

export default function BehaviorInsightPanel({ behavior }) {
  const [expanded, setExpanded] = useState(false);
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 BehaviorInsightPanel received:', {
      hasBehavior: !!behavior,
      behaviorType: typeof behavior,
      behaviorKeys: behavior ? Object.keys(behavior) : [],
      primaryInterest: behavior?.primaryInterest,
      relevanceScore: behavior?.relevanceScore
    });
  }
  
  if (!behavior) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ BehaviorInsightPanel: No behavior data provided');
    }
    return null;
  }
  
  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
      {/* Header - Removed generic "Why Audience Cares" and relevance score */}
      
      {/* Primary Interest */}
      <div className="bg-white p-3 rounded-lg shadow-sm mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{behavior.primaryInterest?.icon}</span>
          <div>
            <div className="font-bold text-gray-900">{behavior.primaryInterest?.name}</div>
            <div className="text-sm text-gray-600 italic">"{behavior.primaryInterest?.question}"</div>
          </div>
        </div>
        
        {/* Secondary Interests */}
        {behavior.secondaryInterests?.length > 0 && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Also:</span>
            {behavior.secondaryInterests.map((s, i) => (
              <span key={i} className="inline-flex items-center text-xs bg-gray-100 px-2 py-0.5 rounded">
                {s.icon} {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Additional behavior insights can be added here in the future with real data */}
    </div>
  );
}

