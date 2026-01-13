/**
 * CENTRAL DATA STORE
 * Loads all data sources once, provides fast lookups
 */

import fs from 'fs/promises';
import path from 'path';

class DataStore {
  constructor() {
    this.loaded = false;
    this.data = {
      searchTerms: [],
      searchTermsMap: new Map(),
      
      audienceVideos: [],
      audienceVideoKeywords: new Map(),
      
      competitorChannels: [],
      competitorVideos: [],
      competitorKeywords: new Map(),
      
      comments: [],
      commentRequests: [],
      
      personas: null,
      
      processedTopics: new Set(), // For deduplication
    };
  }

  async load() {
    if (this.loaded) return this.data;
    
    try {
      console.log('📂 Loading all data sources...');
      
      // 1. Search Terms
      await this.loadSearchTerms();
      
      // 2. Audience Videos (what your audience watches)
      await this.loadAudienceVideos();
      
      // 3. Competitor Channels & Videos
      await this.loadCompetitors();
      
      // 4. Comments (filtered requests)
      await this.loadComments();
      
      // 5. Personas
      await this.loadPersonas();
      
      this.loaded = true;
      console.log('✅ All data loaded!\n');
      
      return this.data;
    } catch (error) {
      console.error('❌ Error loading data store:', error);
      console.error('Stack:', error.stack);
      // Still mark as loaded to prevent infinite retries, but return what we have
      this.loaded = true;
      throw error; // Re-throw to let caller handle
    }
  }

  // ============================================
  // SEARCH TERMS
  // ============================================
  async loadSearchTerms() {
    try {
      const filePath = path.join(process.cwd(), 'data/processed/search_terms.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      
      this.data.searchTerms = parsed.terms || [];
      
      // Build lookup map for fast matching
      for (const term of this.data.searchTerms) {
        const normalized = this.normalizeArabic(term.term);
        this.data.searchTermsMap.set(normalized, term);
        
        // Also index individual words
        const words = normalized.split(/\s+/);
        for (const word of words) {
          if (word.length > 2) {
            if (!this.data.searchTermsMap.has(word)) {
              this.data.searchTermsMap.set(word, { term: word, views: 0, related: [] });
            }
            const wordEntry = this.data.searchTermsMap.get(word);
            if (!wordEntry.related) wordEntry.related = [];
            wordEntry.related.push(term);
          }
        }
      }
      
      console.log(`   📊 Search Terms: ${this.data.searchTerms.length} terms`);
    } catch (e) {
      console.log('   ⚠️ Search terms not found: ' + e.message);
    }
  }

  // ============================================
  // AUDIENCE VIDEOS
  // ============================================
  async loadAudienceVideos() {
    try {
      const filePath = path.join(process.cwd(), 'data/processed/audience_videos.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      
      this.data.audienceVideos = parsed.videos || [];
      
      // Build keyword index
      for (const video of this.data.audienceVideos) {
        const keywords = this.extractKeywords(video.title || '');
        for (const kw of keywords) {
          if (!this.data.audienceVideoKeywords.has(kw)) {
            this.data.audienceVideoKeywords.set(kw, []);
          }
          this.data.audienceVideoKeywords.get(kw).push(video);
        }
      }
      
      console.log(`   📺 Audience Videos: ${this.data.audienceVideos.length} videos`);
    } catch (e) {
      console.log('   ⚠️ Audience videos not found: ' + e.message);
    }
  }

  // ============================================
  // COMPETITORS
  // ============================================
  async loadCompetitors() {
    try {
      // Load channels
      const channelsPath = path.join(process.cwd(), 'data/processed/channels.json');
      const channelsRaw = await fs.readFile(channelsPath, 'utf-8');
      const channelsData = JSON.parse(channelsRaw);
      this.data.competitorChannels = channelsData.channels || [];
      
      // Load recent videos from competitors (if available)
      // For now, we'll extract from channels data or create empty array
      this.data.competitorVideos = [];
      
      // Build keyword index for competitor videos
      for (const video of this.data.competitorVideos) {
        const keywords = this.extractKeywords(video.title || '');
        for (const kw of keywords) {
          if (!this.data.competitorKeywords.has(kw)) {
            this.data.competitorKeywords.set(kw, []);
          }
          this.data.competitorKeywords.get(kw).push(video);
        }
      }
      
      console.log(`   🏢 Competitors: ${this.data.competitorChannels.length} channels, ${this.data.competitorVideos.length} videos`);
    } catch (e) {
      console.log('   ⚠️ Competitor data not found: ' + e.message);
    }
  }

  // ============================================
  // COMMENTS
  // ============================================
  async loadComments() {
    try {
      const filePath = path.join(process.cwd(), 'data/processed/smart_comments.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      
      this.data.comments = parsed.all || [];
      this.data.commentRequests = parsed.actionable || [];
      
      console.log(`   💬 Comments: ${this.data.commentRequests.length} actionable requests`);
    } catch (e) {
      console.log('   ⚠️ Comments not found: ' + e.message);
    }
  }

  // ============================================
  // PERSONAS
  // ============================================
  async loadPersonas() {
    try {
      const { PERSONAS } = await import('../personas/personaDefinitions.js');
      this.data.personas = PERSONAS;
      console.log(`   👥 Personas: ${Object.keys(PERSONAS).length} defined`);
    } catch (e) {
      console.log('   ⚠️ Personas not found: ' + e.message);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================
  normalizeArabic(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ى]/g, 'ي')
      .replace(/[ة]/g, 'ه')
      .replace(/[^\u0600-\u06FFa-z0-9\s]/g, '')
      .trim();
  }

  extractKeywords(text) {
    if (!text) return [];
    const normalized = this.normalizeArabic(text);
    const words = normalized.split(/\s+/).filter(w => w.length > 2);
    
    // Also extract 2-word phrases
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
    
    return [...words, ...phrases];
  }

  // Check if topic was already processed (deduplication)
  isDuplicate(topic) {
    const normalized = this.normalizeArabic(topic);
    if (this.data.processedTopics.has(normalized)) {
      return true;
    }
    this.data.processedTopics.add(normalized);
    return false;
  }

  resetDeduplication() {
    this.data.processedTopics.clear();
  }
}

// Singleton instance
export const dataStore = new DataStore();

