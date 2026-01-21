/**
 * Content Format Strategy Decider
 * Determines whether content should be long-form or short-form based on performance stats
 */

/**
 * Determine content strategy (long-form vs short-form) based on performance multipliers
 * 
 * @param {Object} stats - Performance statistics with multipliers
 * @param {number} stats.long_multiplier - Performance multiplier for long-form content
 * @param {number} stats.short_multiplier - Performance multiplier for short-form content
 * @param {number} score - Current signal score
 * @returns {string} 'long_form' or 'short_form'
 */
export function determineContentStrategy(stats, score = 0) {
  if (!stats) {
    return 'short_form'; // Default to short-form if no stats
  }

  const longMultiplier = stats.long_multiplier || 0;
  const shortMultiplier = stats.short_multiplier || 0;

  // If both are 0 or equal, default to short-form
  if (longMultiplier === 0 && shortMultiplier === 0) {
    return 'short_form';
  }

  // If long-form performs significantly better (20%+ difference)
  if (longMultiplier > shortMultiplier * 1.2) {
    return 'long_form';
  }

  // If short-form performs better or equal, prefer short-form
  if (shortMultiplier >= longMultiplier) {
    return 'short_form';
  }

  // Default to short-form for high-scoring signals that need quick turnaround
  if (score >= 70) {
    return 'short_form';
  }

  // For medium scores, use the better performing format
  return longMultiplier > shortMultiplier ? 'long_form' : 'short_form';
}
