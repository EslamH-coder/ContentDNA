/**
 * COMPETITOR/CONTENT TYPES
 * Different categories serve different purposes
 */

export const CONTENT_TYPES = {
  // ============================================
  // DIRECT COMPETITORS
  // Same niche, same topics, competing for same audience
  // ============================================
  direct_competitor: {
    id: 'direct_competitor',
    name: 'Direct Competitor',
    nameAr: 'منافس مباشر',
    icon: '🎯',
    color: '#e74c3c',
    description: 'Same niche and topics - direct competition',
    descriptionAr: 'نفس المجال والمواضيع - منافسة مباشرة',
    
    // What to learn from them
    learnFrom: [
      'Topics they cover',
      'Angles they use',
      'Keywords in titles',
      'Upload frequency',
      'What performs well for them'
    ],
    
    // Questions to ask
    analysisQuestions: [
      'What topics are they covering that we are not?',
      'What angles work best for them?',
      'How do their titles compare to ours?',
      'What is their upload schedule?'
    ]
  },
  
  // ============================================
  // ADJACENT CONTENT
  // Different niche, but same audience watches both
  // ============================================
  adjacent_content: {
    id: 'adjacent_content',
    name: 'Adjacent Content',
    nameAr: 'محتوى مجاور',
    icon: '🔗',
    color: '#9b59b6',
    description: 'Different topic, same audience - reveals audience interests',
    descriptionAr: 'موضوع مختلف، نفس الجمهور - يكشف اهتمامات الجمهور',
    
    learnFrom: [
      'What else interests our audience',
      'Crossover opportunities',
      'Tone and style preferences',
      'Content formats they enjoy',
      'Collaboration possibilities'
    ],
    
    analysisQuestions: [
      'Why does our audience watch this?',
      'What need does it fulfill?',
      'Can we create crossover content?',
      'What style elements resonate?'
    ],
    
    // Sub-categories
    subTypes: [
      { id: 'pop_science', name: 'Pop Science', nameAr: 'علوم مبسطة', icon: '🔬' },
      { id: 'podcast', name: 'Podcast', nameAr: 'بودكاست', icon: '🎙️' },
      { id: 'documentary', name: 'Documentary', nameAr: 'وثائقي', icon: '🎬' },
      { id: 'news_analysis', name: 'News Analysis', nameAr: 'تحليل إخباري', icon: '📰' },
      { id: 'entertainment_education', name: 'Edutainment', nameAr: 'ترفيه تعليمي', icon: '🎓' },
      { id: 'tech', name: 'Tech', nameAr: 'تقنية', icon: '💻' },
      { id: 'lifestyle', name: 'Lifestyle', nameAr: 'أسلوب حياة', icon: '🌟' },
      { id: 'other', name: 'Other', nameAr: 'أخرى', icon: '📺' }
    ]
  },
  
  // ============================================
  // FORMAT INSPIRATION
  // Great presentation/format regardless of topic
  // ============================================
  format_inspiration: {
    id: 'format_inspiration',
    name: 'Format Inspiration',
    nameAr: 'إلهام للشكل',
    icon: '✨',
    color: '#f39c12',
    description: 'Great format/presentation style to learn from',
    descriptionAr: 'شكل أو أسلوب عرض ممتاز للتعلم منه',
    
    learnFrom: [
      'Visual style',
      'Storytelling techniques',
      'Pacing and rhythm',
      'Hook strategies',
      'Thumbnail style',
      'Editing techniques'
    ],
    
    analysisQuestions: [
      'What makes their format engaging?',
      'How do they structure their videos?',
      'What visual techniques do they use?',
      'How do they hook viewers?'
    ],
    
    // Format categories
    formatTypes: [
      { id: 'explainer', name: 'Explainer', nameAr: 'شرح', icon: '📊' },
      { id: 'storytelling', name: 'Storytelling', nameAr: 'سرد قصصي', icon: '📖' },
      { id: 'animation', name: 'Animation', nameAr: 'رسوم متحركة', icon: '🎨' },
      { id: 'documentary_style', name: 'Documentary', nameAr: 'وثائقي', icon: '🎥' },
      { id: 'talking_head', name: 'Talking Head', nameAr: 'متحدث', icon: '🗣️' },
      { id: 'visual_essay', name: 'Visual Essay', nameAr: 'مقال مرئي', icon: '🖼️' },
      { id: 'data_visualization', name: 'Data Viz', nameAr: 'تصور بيانات', icon: '📈' },
      { id: 'investigative', name: 'Investigative', nameAr: 'استقصائي', icon: '🔍' }
    ]
  },
  
  // ============================================
  // AUDIENCE OVERLAP
  // Channels where audience significantly overlaps
  // (from YouTube Studio data)
  // ============================================
  audience_overlap: {
    id: 'audience_overlap',
    name: 'Audience Overlap',
    nameAr: 'تداخل الجمهور',
    icon: '👥',
    color: '#3498db',
    description: 'Channels with significant audience overlap (from YouTube Analytics)',
    descriptionAr: 'قنوات يتابعها نفس الجمهور (من YouTube Analytics)',
    
    learnFrom: [
      'Understand audience preferences',
      'Content gaps to fill',
      'Potential collaborations',
      'Cross-promotion opportunities'
    ],
    
    // This type is special - data comes from YouTube Studio
    dataSource: 'youtube_studio'
  }
};

// ============================================
// SUGGESTED CHANNELS BY TYPE
// ============================================
export const SUGGESTED_CHANNELS = {
  direct_competitor: [
    { name: 'Visualpolitik AR', reason: 'جيوسياسة بالعربي' },
    { name: 'CNBC عربية', reason: 'أخبار اقتصادية' },
    { name: 'الجزيرة وثائقية', reason: 'وثائقيات سياسية واقتصادية' },
    { name: 'DW عربية', reason: 'تحليل سياسي واقتصادي' },
    { name: 'تلفزيون سوريا', reason: 'تحليل سياسي' }
  ],
  
  adjacent_content: [
    { name: 'الدحيح', subType: 'pop_science', reason: 'علوم مبسطة، نفس الديموغرافية' },
    { name: 'Kurzgesagt', subType: 'pop_science', reason: 'تبسيط معقد، رسوم متحركة' },
    { name: 'إيجيكولوجي', subType: 'pop_science', reason: 'علوم بالعربي' },
    { name: 'Joe Rogan', subType: 'podcast', reason: 'محادثات طويلة، جمهور رجال' },
    { name: 'Lex Fridman', subType: 'podcast', reason: 'محادثات عميقة، تقنية وفلسفة' },
    { name: 'أبو فلة', subType: 'entertainment_education', reason: 'كيف يتواصل مع الشباب العربي' },
    { name: 'Ahmed Elghandour', subType: 'podcast', reason: 'بودكاست عربي، نقاشات' }
  ],
  
  format_inspiration: [
    { name: 'Vox', formatType: 'explainer', reason: 'أسلوب شرح ممتاز' },
    { name: 'Wendover Productions', formatType: 'explainer', reason: 'تبسيط اللوجستيات والاقتصاد' },
    { name: 'Polymatter', formatType: 'visual_essay', reason: 'تحليل جيوسياسي بصري' },
    { name: 'Johnny Harris', formatType: 'storytelling', reason: 'سرد قصصي + خرائط' },
    { name: 'ColdFusion', formatType: 'documentary_style', reason: 'وثائقيات تقنية واقتصادية' },
    { name: '3Blue1Brown', formatType: 'animation', reason: 'تصور بصري للمفاهيم المعقدة' },
    { name: 'Veritasium', formatType: 'storytelling', reason: 'Mystery + Reveal format' },
    { name: 'Half as Interesting', formatType: 'explainer', reason: 'شرح سريع وممتع' }
  ]
};




