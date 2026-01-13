import { isArabLocation } from './storyParser.js';

/**
 * Arabize numbers for natural reading
 */
export function arabizeNumber(num) {
  if (!num) return '';
  const n = num.replace(/,/g, '');
  
  if (/billion/i.test(num)) return num.replace(/billion/i, 'مليار');
  if (/million/i.test(num)) return num.replace(/million/i, 'مليون');
  if (/trillion/i.test(num)) return num.replace(/trillion/i, 'تريليون');
  if (/thousand/i.test(num)) return num.replace(/thousand/i, 'ألف');
  
  return num;
}

/**
 * Generate multiple angles from a parsed story
 * This is the creative part - NOT templates!
 */
export function generateAngles(story) {
  const angles = [];
  const { elements, numbers, type } = story;
  const { actor, action, affected, location, timeline, stakes, surprise } = elements;
  
  // Get story type info
  const storyType = type?.primary || 'SHIFT';
  const storyTypeConfig = type?.primaryConfig || null;
  const storyTypeName = storyTypeConfig?.name_ar || 'قصة';
  const audienceFeeling = storyTypeConfig?.audience_feeling || 'curiosity';
  const angleDirection = storyTypeConfig?.angle_direction || 'what is happening';
  const titleEnergy = storyTypeConfig?.title_energy || 'insight';
  
  // Get key number for use in angles
  const keyNumber = numbers[0] || null;
  const keyNumberClean = keyNumber?.replace(/,/g, '') || '';
  const keyNumberArabized = keyNumber ? arabizeNumber(keyNumber) : null;
  
  // ========== TIMELINE ANGLES ==========
  if (timeline) {
    // Specific year
    if (/202\d/.test(timeline)) {
      angles.push({
        type: 'timeline',
        text_ar: `${timeline}: السنة اللي هتغير كل حاجة`,
        text_ar_v2: `${timeline}... استعد لعالم مختلف تماماً`,
        why: 'Specific year creates concreteness'
      });
    }
    
    // Countdown style
    if (affected) {
      angles.push({
        type: 'countdown',
        text_ar: `العد التنازلي بدأ... ${timeline} قدام ${affected.replace(/\d+\s*/, '') || 'الجميع'}`,
        why: 'Countdown creates urgency'
      });
    }
  }
  
  // ========== CONFLICT ANGLES ==========
  if (actor && affected) {
    const affectedClean = affected.replace(/\d+\s*/, '');
    angles.push({
      type: 'conflict',
      text_ar: `${actor} vs ${affectedClean}... مين هيكسب؟`,
      text_ar_v2: `معركة ${actor} و${affectedClean} بدأت`,
      why: 'Conflict creates drama and sides'
    });
  }
  
  if (actor && location) {
    angles.push({
      type: 'arrival',
      text_ar: `${actor} جاي ${location}... ${keyNumberArabized ? 'ومعاه ' + keyNumberArabized : 'والتفاصيل'}`,
      text_ar_v2: `${location} اختارت ${actor}... ${keyNumber ? 'بعد ' + keyNumberArabized : 'ليه؟'}`,
      why: 'Arrival story creates anticipation'
    });
  }
  
  // ========== PERSONAL IMPACT ANGLES ==========
  if (affected) {
    const affectedClean = affected.replace(/\d+\s*/, '');
    // Direct address
    angles.push({
      type: 'personal',
      text_ar: `لو أنت ${affectedClean}... لازم تشوف ده`,
      text_ar_v2: `${affectedClean}: الخبر اللي لازم تعرفه`,
      why: 'Direct address creates relevance'
    });
    
    // Family angle (Arab culture values)
    if (keyNumber) {
      angles.push({
        type: 'family',
        text_ar: `${keyNumberArabized} عيلة مستنية خبر صعب`,
        text_ar_v2: `${keyNumberArabized} عيلة... القرار اللي هيغير حياتهم`,
        why: 'Family angle resonates in Arab culture'
      });
    }
  }
  
  // ========== REVEAL ANGLES ==========
  if (actor) {
    angles.push({
      type: 'reveal',
      text_ar: `اللي ${actor} مش بتقوله... ${keyNumberArabized ? 'عن ' + keyNumberArabized : ''}`,
      text_ar_v2: `${actor} عمل حاجة محدش توقعها`,
      why: 'Reveal creates curiosity'
    });
  }
  
  if (surprise) {
    const surpriseText = surprise === 'first' ? 'لأول مرة' : 
                        surprise === 'record' ? 'رقم قياسي' :
                        surprise === 'biggest' || surprise === 'largest' ? 'أكبر' :
                        surprise;
    angles.push({
      type: 'surprise',
      text_ar: `${surpriseText}... ${location || actor || 'العالم'} اتغير`,
      text_ar_v2: `${surpriseText} في ${location || 'التاريخ'}`,
      why: 'Surprise element hooks attention'
    });
  }
  
  // ========== LOCATION/REGIONAL ANGLES ==========
  if (location && isArabLocation(location)) {
    angles.push({
      type: 'regional_pride',
      text_ar: `${location} قبل العالم كله... ${actor ? actor + ' اختارها' : 'ليه؟'}`,
      text_ar_v2: `${location}: ${actor || 'قرار'} هيغير المنطقة`,
      why: 'Regional pride + curiosity'
    });
    
    angles.push({
      type: 'regional_spread',
      text_ar: `اللي بيحصل في ${location}... هيحصل في الرياض ومصر`,
      text_ar_v2: `${location} بدأت... باقي الخليج جاي`,
      why: 'FOMO for other regions'
    });
    
    if (keyNumber) {
      angles.push({
        type: 'regional_impact',
        text_ar: `${location}: ${keyNumberArabized} هيغير حياة الملايين`,
        text_ar_v2: `${location} و${keyNumberArabized}... القرار الكبير`,
        why: 'Direct regional impact'
      });
    }
  }
  
  // ========== NUMBER ANCHOR ANGLES ==========
  if (keyNumber) {
    angles.push({
      type: 'number_shock',
      text_ar: `${keyNumberArabized}... الرقم اللي لازم تعرفه`,
      text_ar_v2: `${keyNumberArabized}: الرقم اللي غيّر المعادلة`,
      why: 'Numbers create specificity'
    });
    
    // Math/multiplication angle
    if (/\d+,?\d*/.test(keyNumber) && affected) {
      const numericValue = parseInt(keyNumberClean);
      if (numericValue > 1000) {
        angles.push({
          type: 'math',
          text_ar: `${keyNumberArabized} × عيلة = كارثة اقتصادية`,
          text_ar_v2: `${keyNumberArabized}... كل عيلة هتتأثر`,
          why: 'Multiplication shows scale'
        });
      }
    }
  }
  
  // ========== QUESTION ANGLES ==========
  if (location || actor) {
    angles.push({
      type: 'why_question',
      text_ar: `ليه ${location || actor || 'ده'} وليه دلوقتي؟`,
      text_ar_v2: `ليه ${location || actor}؟ السؤال اللي كل حد بيسأله`,
      why: 'Why question invites answer-seeking'
    });
  }
  
  if (affected) {
    const affectedClean = affected.replace(/\d+\s*/, '');
    angles.push({
      type: 'where_question',
      text_ar: `${affectedClean} هيروحوا فين؟`,
      text_ar_v2: `${affectedClean}... المستقبل فين؟`,
      why: 'Practical question about affected people'
    });
  }
  
  // ========== STORY TYPE-BASED ANGLES ==========
  // Generate angles based on detected story type
  
  if (storyType === 'THREAT') {
    // Threat angles: warning, urgency, protection
    if (affected) {
      angles.push({
        type: 'threat_warning',
        text_ar: `${affected.replace(/\d+\s*/, '')} في خطر... ${keyNumberArabized ? 'بعد ' + keyNumberArabized : 'التفاصيل'}`,
        text_ar_v2: `تحذير: ${affected.replace(/\d+\s*/, '')} مستهدفون`,
        why: 'Threat stories create urgency and need for protection'
      });
    }
    if (location) {
      angles.push({
        type: 'threat_location',
        text_ar: `${location} في خطر... ${actor ? actor + ' يهدد' : 'التهديد'}`,
        why: 'Location-specific threat creates local relevance'
      });
    }
    angles.push({
      type: 'threat_question',
      text_ar: `إيه اللي هيحصل لو ${actor || 'الخطر'} استمر؟`,
      why: 'Threat questions create forward-looking concern'
    });
  }
  
  if (storyType === 'OPPORTUNITY') {
    // Opportunity angles: potential, investment, growth
    if (keyNumber) {
      angles.push({
        type: 'opportunity_investment',
        text_ar: `${keyNumberArabized} ${storyTypeName}... ${location || 'السوق'} جاهز؟`,
        text_ar_v2: `${keyNumberArabized}: ${storyTypeName} ${location || 'الاقتصادية'}`,
        why: 'Opportunity with numbers creates investment interest'
      });
    }
    if (actor) {
      angles.push({
        type: 'opportunity_actor',
        text_ar: `${actor} يستثمر في ${location || 'المستقبل'}... ${keyNumberArabized ? 'بعد ' + keyNumberArabized : 'ليه؟'}`,
        why: 'Actor investment creates FOMO'
      });
    }
  }
  
  if (storyType === 'RACE') {
    // Race angles: competition, who's winning, FOMO
    if (actor && location) {
      angles.push({
        type: 'race_competition',
        text_ar: `${actor} في ${location}... مين الأول؟`,
        text_ar_v2: `سباق في ${location}: ${actor} vs الباقي`,
        why: 'Race stories create competitive tension'
      });
    }
    angles.push({
      type: 'race_fomo',
      text_ar: `${location || 'العالم'} في سباق... ${actor ? actor + ' قدام' : 'مين قدام؟'}`,
      why: 'Race creates FOMO about being left behind'
    });
  }
  
  if (storyType === 'REVEAL') {
    // Reveal angles: secrets, hidden truth, exposure
    if (actor) {
      angles.push({
        type: 'reveal_secret',
        text_ar: `اللي ${actor} مش بتقوله... ${keyNumberArabized ? 'عن ' + keyNumberArabized : 'السر'}`,
        text_ar_v2: `${actor}: السر اللي محدش يعرفه`,
        why: 'Reveal creates curiosity about hidden information'
      });
    }
    angles.push({
      type: 'reveal_truth',
      text_ar: `الحقيقة اللي محدش قالها... ${location || 'عن'}`,
      why: 'Truth reveal creates intrigue'
    });
  }
  
  if (storyType === 'MILESTONE') {
    // Milestone angles: significance, history, achievement
    if (keyNumber) {
      angles.push({
        type: 'milestone_record',
        text_ar: `${keyNumberArabized}: ${storyTypeName} ${location ? 'في ' + location : 'تاريخي'}`,
        text_ar_v2: `${keyNumberArabized}... ${storyTypeName} قياسي`,
        why: 'Milestone with numbers creates significance'
      });
    }
    if (location) {
      angles.push({
        type: 'milestone_location',
        text_ar: `${location}: ${storyTypeName} تاريخي`,
        why: 'Location milestone creates regional pride'
      });
    }
  }
  
  if (storyType === 'CONSEQUENCE') {
    // Consequence angles: cause-effect, impact, chain reaction
    if (actor && affected) {
      angles.push({
        type: 'consequence_chain',
        text_ar: `${actor} أدى إلى ${affected.replace(/\d+\s*/, '')}... إزاي؟`,
        why: 'Consequence stories explain cause-effect'
      });
    }
    if (location) {
      angles.push({
        type: 'consequence_impact',
        text_ar: `تأثير ${location}... ${keyNumberArabized ? 'بعد ' + keyNumberArabized : 'النتيجة'}`,
        why: 'Consequence shows impact'
      });
    }
  }
  
  // ========== ACTION-BASED ANGLES ==========
  if (action === 'launch') {
    angles.push({
      type: 'launch',
      text_ar: `${actor || 'شركة'} أعلنت... ${location || 'العالم'} هيتغير`,
      text_ar_v2: `${actor || 'قرار'} جديد في ${location || 'السوق'}... ${keyNumberArabized ? 'بعد ' + keyNumberArabized : 'التفاصيل'}`,
      why: 'Launch announcements create newsworthiness'
    });
  } else if (action === 'loss') {
    angles.push({
      type: 'loss_story',
      text_ar: `${actor || 'الشركة'} خسرت ${keyNumberArabized || 'كتير'}... السبب؟`,
      text_ar_v2: `${keyNumberArabized || 'خسارة'}... ${actor || 'الشركة'} في مأزق`,
      why: 'Loss stories create curiosity about cause'
    });
  } else if (action === 'growth') {
    angles.push({
      type: 'growth',
      text_ar: `${keyNumberArabized || 'نمو'}... ${actor || 'السوق'} في صعود`,
      text_ar_v2: `${actor || 'الاقتصاد'} يرتفع ${keyNumberArabized ? 'بعد ' + keyNumberArabized : ''}`,
      why: 'Growth stories create positive anticipation'
    });
  } else if (action === 'conflict') {
    angles.push({
      type: 'conflict_story',
      text_ar: `${actor || 'صراع'} في ${location || 'المنطقة'}... ${keyNumberArabized ? 'بعد ' + keyNumberArabized : 'التفاصيل'}`,
      why: 'Conflict stories create urgency'
    });
  }
  
  // ========== STAKES ANGLES ==========
  if (stakes) {
    angles.push({
      type: 'stakes',
      text_ar: `${stakes}... القرار اللي هيغير كل حاجة`,
      text_ar_v2: `${stakes} على المحك`,
      why: 'Stakes create urgency and importance'
    });
  }
  
  return angles;
}

