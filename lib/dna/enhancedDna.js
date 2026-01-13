/**
 * ENHANCED SHOW DNA
 * Includes retention, hooks, beats, and ceiling detection
 */

export const ENHANCED_DNA = {
  // ============================================
  // RETENTION BENCHMARKS
  // ============================================
  retention_benchmarks: {
    long_form: {
      hook_retention_30s: {
        average: 74.2,
        good: 75.0,
        excellent: 76.0
      },
      average_percent_viewed: {
        average: 48.9,
        good: 50.7,
        excellent: 53.0
      },
      ctr: {
        average: 5.4,
        good: 6.2,
        excellent: 7.0
      }
    },
    shorts: {
      retention_3s: {
        average: 119.6,
        good: 120,
        excellent: 125,
        insight: "Above 100% = replays. BUT high retention ≠ high views!"
      },
      viewed_vs_swiped: {
        average: 65.4,
        good: 68.0,
        excellent: 73.0,
        insight: "This is the KEY metric. Higher = more people watch vs swipe away."
      },
      optimal_duration_seconds: {
        recommended: "60-80",
        max: 120,
        insight: "Shorts over 120 sec perform WORSE (353K vs 5.6M avg)"
      }
    }
  },

  // ============================================
  // TOPICS WITH FULL METRICS
  // ============================================
  topics: [
    // WINNING TOPICS (high views + good metrics)
    {
      topic_id: "logistics_supply_chain",
      status: "winning",
      metrics: {
        views_avg: 2851313,
        retention_30s: 76.0,
        avg_viewed: 52.6,
        ctr: 2.7
      },
      has_ceiling: false,
      viral_potential: "HIGH",
      format_recommendation: "LONG",
      insight: "Best performer - topic spreads virally"
    },
    {
      topic_id: "us_china_geopolitics",
      status: "winning",
      metrics: {
        views_avg: 2636800,
        retention_30s: 74.5,
        avg_viewed: 49.2,
        ctr: 4.8
      },
      has_ceiling: false,
      viral_potential: "HIGH",
      format_recommendation: "LONG",
      insight: "Strong geopolitical interest"
    },
    {
      topic_id: "missiles_air_defense",
      status: "winning",
      metrics: {
        views_avg: 1809032,
        retention_30s: 72.0,
        avg_viewed: 39.1,
        ctr: 4.9
      },
      has_ceiling: false,
      viral_potential: "HIGH",
      format_recommendation: "BOTH",
      insight: "Topic curiosity > hook quality. Shorts go viral (5.6M)."
    },

    // NEUTRAL TOPICS (mixed results)
    {
      topic_id: "consumer_credit_cards",
      status: "neutral",
      metrics: {
        views_avg: 1489651,
        retention_30s: 73.0,
        avg_viewed: 44.1,
        ctr: 4.0
      },
      has_ceiling: false,
      viral_potential: "MEDIUM",
      format_recommendation: "SHORT_FIRST",
      insight: "Test with short before investing"
    },
    {
      topic_id: "big_tech_platforms",
      status: "neutral",
      metrics: {
        views_avg: 592864,
        retention_30s: 75.0,
        avg_viewed: 49.8,
        ctr: 6.2
      },
      has_ceiling: false,
      viral_potential: "MEDIUM",
      format_recommendation: "BOTH",
      insight: "Good metrics but needs right angle. Shorts can go viral (5.5M)."
    },

    // CEILING TOPICS (high retention, low views - TRAP!)
    {
      topic_id: "us_debt_treasuries",
      status: "ceiling",
      metrics: {
        views_avg: 484563,
        retention_30s: 76.0,  // HIGHEST retention!
        avg_viewed: 54.9,     // HIGHEST avg viewed!
        ctr: 6.3              // HIGH CTR!
      },
      has_ceiling: true,
      viral_potential: "LOW",
      ceiling_reason: "Niche audience. People click and watch but don't share.",
      format_recommendation: "SKIP",
      insight: "TRAP! Best retention but lowest views. Topic has ceiling."
    },
    {
      topic_id: "currency_devaluation",
      status: "ceiling",
      metrics: {
        views_avg: 647136,
        retention_30s: 74.5,
        avg_viewed: 49.2,
        ctr: 6.4  // HIGHEST CTR!
      },
      has_ceiling: true,
      viral_potential: "LOW",
      ceiling_reason: "High CTR = people interested. Low views = doesn't spread.",
      format_recommendation: "SKIP",
      insight: "TRAP! Highest CTR but limited audience."
    },
    {
      topic_id: "war_costs_economics",
      status: "ceiling",
      metrics: {
        views_avg: 483398,
        retention_30s: 74.0,
        avg_viewed: 52.1,
        ctr: 5.5
      },
      has_ceiling: true,
      viral_potential: "LOW",
      ceiling_reason: "Abstract topic. Hard to make personal/shareable.",
      format_recommendation: "SKIP",
      insight: "Good retention but no viral potential."
    }
  ],

  // ============================================
  // HOOK PATTERNS (From Actual Transcripts)
  // ============================================
  hook_patterns: [
    {
      pattern_id: "date_anchor_entity",
      name: "Date Anchor + Major Entity",
      rank: 1,
      metrics: {
        views_avg: 2851313,
        retention_30s: 76.0
      },
      structure: {
        arabic: "في [تاريخ محدد] [شخصية/شركة مهمة] [فعل صادم]",
        english: "On [SPECIFIC DATE] [MAJOR ENTITY] [SHOCKING ACTION]"
      },
      example: "في 13 فبراير 2025 رئيس الامريكي دونالد ترامب استقبل في البيت الابيض رئيس الوزراء الهندي...",
      required_elements: ["specific_date", "major_entity", "action_verb"],
      why_works: "Specific date = credibility. Major entity = interest. Action = momentum."
    },
    {
      pattern_id: "date_anchor_number",
      name: "Date Anchor + Big Number",
      rank: 2,
      metrics: {
        views_avg: 2688507,
        retention_30s: 74.0
      },
      structure: {
        arabic: "[شيء معروف] + [رقم ضخم]",
        english: "[FAMILIAR THING] + [SHOCKING NUMBER]"
      },
      example: "جهاز الايفون اللي بتنتجه شركه ابل... الشركه اللي قيمتها 3.4 تريليون دولار",
      required_elements: ["familiar_product", "big_number"],
      why_works: "Big number creates scale and stakes."
    },
    {
      pattern_id: "direct_question_answer",
      name: "Direct Question + Immediate Answer",
      rank: 3,
      metrics: {
        views_avg: 2585093,
        retention_30s: 75.0
      },
      structure: {
        arabic: "هل [سؤال مباشر]؟ الإجابة هي [إجابة صادمة]",
        english: "Can/Does [DIRECT QUESTION]? The answer is [SURPRISING ANSWER]"
      },
      example: "هل امريكا تقدر تحارب روسيا او الصين؟ الاجابه هي نعم امريكا تقدر...",
      required_elements: ["direct_question", "immediate_answer"],
      why_works: "Answers immediately - no clickbait feeling. Viewer stays for WHY."
    },
    {
      pattern_id: "shocking_news_date",
      name: "Shocking News + Date",
      rank: 4,
      metrics: {
        views_avg: 1809032,
        retention_30s: 72.0
      },
      structure: {
        arabic: "في [تاريخ] [جهة رسمية] نشرت [خبر صادم]",
        english: "On [DATE] [OFFICIAL SOURCE] published [SHOCKING NEWS]"
      },
      example: "في 31 اغسطس 2023 نشر التلفزيون الايراني فجاه تقرير غريب اعلن فيه...",
      required_elements: ["date", "official_source", "surprising_news"],
      why_works: "Official source + surprising reveal = credibility + curiosity."
    },
    {
      pattern_id: "viewer_question",
      name: "Question to Viewer",
      rank: 5,
      metrics: {
        views_avg: 1489651,
        retention_30s: 73.0
      },
      structure: {
        arabic: "برأيك [سؤال للمشاهد]؟",
        english: "In your opinion, [QUESTION TO VIEWER]?"
      },
      example: "برايك ايه هي اكتر حاجه عامله قلق للناس في بلدك؟",
      required_elements: ["viewer_address", "relatable_question"],
      why_works: "Involves viewer personally. Creates engagement."
    }
  ],

  // ============================================
  // VIDEO BEAT STRUCTURE
  // ============================================
  beat_structure: {
    chapter_1_hook: {
      name: "الافتتاح (Hook)",
      duration_percent: "10-15%",
      beats: [
        {
          beat_id: "news_peg",
          name_ar: "خبر الحلقة",
          name_en: "News Peg",
          description: "Specific event with date that triggered this video",
          template: "في [تاريخ]، [حدث محدد] حصل...",
          required: true
        },
        {
          beat_id: "central_question",
          name_ar: "سؤال الحلقة",
          name_en: "Central Question",
          description: "The main question this video will answer",
          template: "السؤال هو: [سؤال واضح]؟",
          required: true
        },
        {
          beat_id: "promise",
          name_ar: "وعد الحلقة",
          name_en: "Promise",
          description: "What viewer will learn/understand by the end",
          template: "في الحلقة دي هنفهم [X] و [Y] و [Z]",
          required: true
        }
      ]
    },
    chapter_2_context: {
      name: "السياق (Context)",
      duration_percent: "20-25%",
      beats: [
        {
          beat_id: "flashback",
          name_ar: "فلاشباك/تاريخ",
          name_en: "Historical Context",
          description: "Background needed to understand the story",
          template: "عشان نفهم، لازم نرجع لـ [تاريخ/حدث]...",
          required: false
        },
        {
          beat_id: "key_players",
          name_ar: "اللاعبين الرئيسيين",
          name_en: "Key Players",
          description: "Who is involved and what are their interests",
          template: "الأطراف الرئيسية هي: [1] اللي عايز [X]، و[2] اللي عايز [Y]",
          required: true
        }
      ]
    },
    chapter_3_deep_dive: {
      name: "التحليل العميق (Deep Dive)",
      duration_percent: "40-50%",
      beats: [
        {
          beat_id: "data_evidence",
          name_ar: "البيانات والأرقام",
          name_en: "Data & Evidence",
          description: "Numbers, statistics, facts that support the analysis",
          template: "الأرقام بتقول إن [X]... تحديداً [رقم] و [رقم]",
          required: true
        },
        {
          beat_id: "scenarios",
          name_ar: "السيناريوهات",
          name_en: "Scenarios",
          description: "What could happen - best case, worst case, most likely",
          template: "لو [X] حصل، هيحصل [Y]. لكن لو [Z]، الموضوع هيختلف...",
          required: true
        },
        {
          beat_id: "regional_impact",
          name_ar: "التأثير الإقليمي",
          name_en: "Regional Impact",
          description: "How this affects Arab region specifically",
          template: "طيب إيه علاقة ده بـ [الخليج/مصر/المنطقة]؟ الإجابة هي...",
          required: true
        }
      ]
    },
    chapter_4_conclusion: {
      name: "الخلاصة (Conclusion)",
      duration_percent: "10-15%",
      beats: [
        {
          beat_id: "answer_question",
          name_ar: "الإجابة على السؤال",
          name_en: "Answer Central Question",
          description: "Directly answer the question posed in the hook",
          template: "يعني الإجابة على سؤالنا: [إجابة واضحة]",
          required: true
        },
        {
          beat_id: "personal_relevance",
          name_ar: "ماذا يعني لك",
          name_en: "Personal Relevance",
          description: "What this means for the viewer personally",
          template: "طيب ده يعني إيه ليك؟ يعني [تأثير شخصي]",
          required: true
        },
        {
          beat_id: "cta",
          name_ar: "الدعوة للتفاعل",
          name_en: "Call to Action",
          description: "Subscribe, comment, next video",
          template: "لو عايز تفهم أكتر عن [X]، شوف الحلقة دي...",
          required: false
        }
      ]
    }
  }
};

