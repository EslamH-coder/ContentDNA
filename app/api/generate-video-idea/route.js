import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request) {
  const { showId, cluster } = await request.json();

  if (!cluster) {
    return NextResponse.json({ error: 'cluster required' }, { status: 400 });
  }

  try {
    const prompt = `You are a YouTube content strategist for an Arabic news/documentary channel.

Based on this trending topic cluster, generate a compelling video idea:

Topic: ${cluster.name}
Related signals (${cluster.signalCount} total):
${cluster.items?.map((t, i) => `${i + 1}. ${t}`).join('\n') || 'No items'}

Generate a video idea in Arabic that would:
1. Hook Arab viewers in the first 5 seconds
2. Use the channel's proven style (documentary/explainer)
3. Connect to current events the audience cares about

Respond in this exact JSON format:
{
  "title": "عنوان جذاب بالعربية - يبدأ برقم أو سؤال مثير",
  "hook": "جملة افتتاحية قوية تجذب المشاهد في أول 5 ثواني - تبدأ بـ 'هل تعلم' أو رقم صادم أو سيناريو درامي",
  "angle": "الزاوية الفريدة التي سنتناول بها الموضوع",
  "key_points": ["نقطة 1", "نقطة 2", "نقطة 3"],
  "thumbnail_suggestion": "وصف مختصر للصورة المصغرة المقترحة",
  "full_pitch": "وصف كامل للفيديو في 3-4 جمل"
}

IMPORTANT: Respond ONLY with valid JSON, no markdown or extra text.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1000
    });

    const content = completion.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    let idea;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        idea = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      // If parsing fails, create a basic structure
      idea = {
        title: 'فكرة فيديو جديدة',
        hook: content.substring(0, 200),
        full_pitch: content
      };
    }

    // Add source info
    idea.source_title = cluster.items?.[0] || cluster.name;
    idea.cluster_name = cluster.name;

    return NextResponse.json({
      success: true,
      idea
    });

  } catch (error) {
    console.error('Generate video idea error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



