/**
 * PERSONA ENGINE
 * Matches content to personas, tracks serving, monitors growth
 */

import { PERSONAS, PERSONA_SERVING_GOALS } from './personaDefinitions.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'personas.json');

// ============================================
// LOAD/SAVE DATA
// ============================================
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
}

async function loadData() {
  await ensureDataDir();
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { 
      personas: Object.keys(PERSONAS),
      personaTopicHistory: [], 
      growthSignals: [],
      servingHistory: {},
      lastAnalyzed: null 
    };
  }
}

async function saveData(data) {
  await ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  return data;
}

// ============================================
// MATCH NEWS TO PERSONA
// ============================================
export function matchNewsToPersona(newsItem) {
  const title = (newsItem.title || '').toLowerCase();
  const description = (newsItem.description || '').toLowerCase();
  const content = (newsItem.content || '').toLowerCase();
  const fullText = `${title} ${description} ${content}`;
  
  const matches = [];
  
  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    let score = 0;
    const matchedKeywords = [];
    
    // Check trigger keywords
    for (const keyword of persona.triggerKeywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        score += 10;
        matchedKeywords.push(keyword);
      }
    }
    
    // Check primary interests
    for (const interest of persona.interests.primary) {
      if (fullText.includes(interest.toLowerCase())) {
        score += 15;
        matchedKeywords.push(interest);
      }
    }
    
    // Check secondary interests
    for (const interest of persona.interests.secondary) {
      if (fullText.includes(interest.toLowerCase())) {
        score += 8;
        matchedKeywords.push(interest);
      }
    }
    
    if (score > 0) {
      matches.push({
        personaId,
        personaName: persona.name,
        icon: persona.icon,
        score,
        matchedKeywords: [...new Set(matchedKeywords)],
        relevance: score >= 30 ? 'HIGH' : score >= 15 ? 'MEDIUM' : 'LOW'
      });
    }
  }
  
  // Sort by score
  matches.sort((a, b) => b.score - a.score);
  
  return {
    newsItem,
    primaryPersona: matches[0] || null,
    secondaryPersonas: matches.slice(1, 3),
    allMatches: matches,
    servesMultiple: matches.filter(m => m.relevance !== 'LOW').length > 1
  };
}

// ============================================
// BATCH MATCH WITH STATS
// ============================================
export function matchBatchToPersonas(newsItems) {
  const results = newsItems.map(item => matchNewsToPersona(item));
  
  // Count per persona
  const personaCounts = {};
  for (const persona of Object.keys(PERSONAS)) {
    personaCounts[persona] = results.filter(
      r => r.primaryPersona?.personaId === persona
    ).length;
  }
  
  // Find underserved personas
  const underserved = Object.entries(personaCounts)
    .filter(([_, count]) => count === 0)
    .map(([personaId]) => ({
      personaId,
      name: PERSONAS[personaId].name,
      icon: PERSONAS[personaId].icon
    }));
  
  return {
    results,
    stats: {
      total: newsItems.length,
      matched: results.filter(r => r.primaryPersona).length,
      unmatched: results.filter(r => !r.primaryPersona).length,
      personaCounts,
      underserved,
      wellServed: Object.entries(personaCounts)
        .filter(([_, count]) => count >= 2)
        .map(([id]) => id)
    }
  };
}

// ============================================
// TRACK SERVING HISTORY
// ============================================
export async function trackPersonaServing(personaId, topic, published = false) {
  const data = await loadData();
  
  const entry = {
    personaId,
    topic,
    date: new Date().toISOString(),
    published,
    week: getWeekNumber(new Date())
  };
  
  data.personaTopicHistory.push(entry);
  
  // Update serving counts
  if (!data.servingHistory) data.servingHistory = {};
  const weekKey = `${new Date().getFullYear()}-W${entry.week}`;
  if (!data.servingHistory[weekKey]) data.servingHistory[weekKey] = {};
  data.servingHistory[weekKey][personaId] = (data.servingHistory[weekKey][personaId] || 0) + 1;
  
  await saveData(data);
  return entry;
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ============================================
// CHECK SERVING STATUS
// ============================================
export async function getServingStatus() {
  const data = await loadData();
  const weekKey = `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
  const weekServing = data.servingHistory?.[weekKey] || {};
  
  const status = {};
  
  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    const served = weekServing[personaId] || 0;
    const goal = PERSONA_SERVING_GOALS.weekly[personaId] || 2;
    
    status[personaId] = {
      name: persona.name,
      icon: persona.icon,
      served,
      goal,
      remaining: Math.max(0, goal - served),
      status: served >= goal ? 'COMPLETE' : served > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
      percentage: Math.round((served / goal) * 100)
    };
  }
  
  return {
    week: weekKey,
    personas: status,
    needsAttention: Object.entries(status)
      .filter(([_, s]) => s.status === 'NOT_STARTED')
      .map(([id, s]) => ({ id, ...s }))
  };
}

// ============================================
// GET PERSONA SUGGESTIONS
// ============================================
export async function getPersonaSuggestions() {
  const servingStatus = await getServingStatus();
  const suggestions = [];
  
  for (const persona of servingStatus.needsAttention) {
    const personaDef = PERSONAS[persona.id];
    
    suggestions.push({
      persona: persona.id,
      name: personaDef.name,
      icon: personaDef.icon,
      urgency: 'HIGH',
      reason: `لم يتم تقديم محتوى لـ ${personaDef.name} هذا الأسبوع`,
      suggestedTopics: personaDef.winningTopics,
      triggerKeywords: personaDef.triggerKeywords.slice(0, 5),
      adjacentInspiration: personaDef.adjacentContent
    });
  }
  
  return suggestions;
}




