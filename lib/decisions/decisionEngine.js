import { decideTiming } from './timingDecision.js';
import { decideFormat } from './formatDecision.js';

/**
 * Combined decision engine
 * Returns timing + format + action recommendation
 */
export function makeDecisions(item, storyType, classification, showDna) {
  const timing = decideTiming(item, storyType);
  const format = decideFormat(item, storyType, classification, showDna);
  
  // Combine into action recommendation
  const action = determineAction(timing, format);
  
  return {
    timing,
    format,
    action,
    
    // Summary for UI
    summary: {
      when: timing.deadline,
      how: format.duration,
      priority: action.priority,
      action: action.recommendation
    }
  };
}

function determineAction(timing, format) {
  // URGENT + LONG = High priority, produce now
  if (timing.decision === 'URGENT' && format.decision === 'LONG') {
    return {
      priority: 'HIGH',
      recommendation: 'Produce this week - full long-form',
      color: 'red',
      order: 1
    };
  }
  
  // URGENT + BOTH = Highest priority
  if (timing.decision === 'URGENT' && format.decision === 'BOTH') {
    return {
      priority: 'HIGHEST',
      recommendation: 'Produce ASAP - long-form + shorts',
      color: 'red',
      order: 0
    };
  }
  
  // URGENT + SHORT = Quick turnaround
  if (timing.decision === 'URGENT' && format.decision === 'SHORT') {
    return {
      priority: 'MEDIUM-HIGH',
      recommendation: 'Quick short this week',
      color: 'orange',
      order: 2
    };
  }
  
  // URGENT + SKIP = Consider skipping
  if (timing.decision === 'URGENT' && format.decision === 'SHORT_OR_SKIP') {
    return {
      priority: 'LOW',
      recommendation: 'Skip - losing topic not worth rushing',
      color: 'gray',
      order: 10
    };
  }
  
  // TIMELY + LONG = Schedule for next week
  if (timing.decision === 'TIMELY' && format.decision === 'LONG') {
    return {
      priority: 'MEDIUM',
      recommendation: 'Schedule for next 1-2 weeks',
      color: 'yellow',
      order: 3
    };
  }
  
  // TIMELY + SHORT = Good filler
  if (timing.decision === 'TIMELY' && format.decision === 'SHORT') {
    return {
      priority: 'MEDIUM-LOW',
      recommendation: 'Good short for next week',
      color: 'yellow',
      order: 4
    };
  }
  
  // EVERGREEN + LONG = Backlog
  if (timing.decision === 'EVERGREEN' && format.decision === 'LONG') {
    return {
      priority: 'BACKLOG',
      recommendation: 'Add to backlog - produce when time allows',
      color: 'green',
      order: 5
    };
  }
  
  // EVERGREEN + SHORT = Low priority
  if (timing.decision === 'EVERGREEN' && format.decision === 'SHORT') {
    return {
      priority: 'LOW-BACKLOG',
      recommendation: 'Low priority short - save for slow days',
      color: 'green',
      order: 6
    };
  }
  
  // SHORT_OR_SKIP = Skip unless urgent
  if (format.decision === 'SHORT_OR_SKIP') {
    return {
      priority: 'SKIP',
      recommendation: 'Skip - losing topic',
      color: 'gray',
      order: 10
    };
  }
  
  // Default
  return {
    priority: 'EVALUATE',
    recommendation: 'Needs manual review',
    color: 'gray',
    order: 7
  };
}

/**
 * Sort items by priority
 */
export function sortByPriority(items) {
  return items.sort((a, b) => {
    const orderA = a.decisions?.action?.order || 99;
    const orderB = b.decisions?.action?.order || 99;
    return orderA - orderB;
  });
}

