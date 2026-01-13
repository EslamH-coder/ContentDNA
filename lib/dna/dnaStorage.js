import fs from 'fs/promises';
import path from 'path';
import { createLivingDNA } from './livingDNA.js';

const DNA_DIR = path.join(process.cwd(), 'data');
const DNA_FILE = path.join(DNA_DIR, 'living_dna.json');

export async function loadDNA() {
  try {
    const data = await fs.readFile(DNA_FILE, 'utf-8');
    const dna = JSON.parse(data);
    
    // Ensure all required fields exist (for backward compatibility)
    if (!dna.hooks) dna.hooks = { patterns: {}, effective_phrases: [], failed_phrases: [] };
    if (!dna.audience) dna.audience = { behaviors: [], click_triggers: [], retention_triggers: [], share_triggers: [], traps: [] };
    if (!dna.insights) dna.insights = { recent: [], key_learnings: [], warnings: [], experiments: [] };
    if (!dna.banned) dna.banned = { phrases: [], weak_topics: [], failed_patterns: [] };
    
    return dna;
  } catch (e) {
    // Return fresh DNA if file doesn't exist
    console.log('Creating new DNA file');
    const freshDNA = createLivingDNA();
    await saveDNA(freshDNA);
    return freshDNA;
  }
}

export async function saveDNA(dna) {
  try {
    await fs.mkdir(DNA_DIR, { recursive: true });
    await fs.writeFile(DNA_FILE, JSON.stringify(dna, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save DNA:', e);
    return false;
  }
}

// Get DNA file path (for debugging)
export function getDNAPath() {
  return DNA_FILE;
}




