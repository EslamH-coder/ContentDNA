#!/usr/bin/env python3
"""
Content Intelligence System - Option A (Simple)
================================================
Automated system to scan RSS feeds, score against Channel DNA,
and generate content recommendations.

Usage:
    python main.py                    # Run full scan
    python main.py --test             # Test with sample data
    python main.py --synopsis <index> # Generate synopsis for item #index
"""

import json
import re
import os
import sys
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from pathlib import Path

# Try to import optional dependencies
try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    HAS_FEEDPARSER = False
    print("⚠️  feedparser not installed. Run: pip install feedparser")

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    print("⚠️  anthropic not installed. Run: pip install anthropic")


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).parent
CONFIG_DIR = BASE_DIR / "config"
OUTPUT_DIR = BASE_DIR / "output"
LOGS_DIR = BASE_DIR / "logs"

# Ensure directories exist
OUTPUT_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)


# ============================================================
# CHANNEL DNA LOADER
# ============================================================

class ChannelDNA:
    """Loads and provides access to Channel DNA configuration."""
    
    def __init__(self, config_path: Path = CONFIG_DIR / "channel_dna.json"):
        with open(config_path, 'r', encoding='utf-8') as f:
            self.data = json.load(f)
    
    @property
    def positive_keywords(self) -> Dict[str, List[str]]:
        return self.data.get("positive_keywords", {})
    
    @property
    def negative_keywords(self) -> List[str]:
        return self.data.get("negative_keywords", [])
    
    @property
    def scoring_weights(self) -> Dict[str, int]:
        return self.data.get("scoring_weights", {})
    
    @property
    def hook_performance(self) -> Dict:
        return self.data.get("hook_performance", {})
    
    @property
    def winning_topics(self) -> List[Dict]:
        return self.data.get("winning_topics", [])
    
    def get_all_positive_keywords(self) -> List[str]:
        """Flatten all positive keywords into one list."""
        all_keywords = []
        for category, keywords in self.positive_keywords.items():
            all_keywords.extend(keywords)
        return all_keywords


# ============================================================
# RSS FEED FETCHER
# ============================================================

class RSSFetcher:
    """Fetches and parses RSS feeds."""
    
    def __init__(self, config_path: Path = CONFIG_DIR / "rss_feeds.json"):
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        self.feeds = [f for f in self.config["feeds"] if f.get("enabled", True)]
        self.settings = self.config.get("settings", {})
    
    def fetch_all(self) -> List[Dict]:
        """Fetch all enabled RSS feeds and return combined items."""
        if not HAS_FEEDPARSER:
            print("❌ feedparser required. Install with: pip install feedparser")
            return []
        
        all_items = []
        max_items = self.settings.get("max_items_per_feed", 20)
        max_age = timedelta(hours=self.settings.get("max_age_hours", 48))
        cutoff_time = datetime.now() - max_age
        
        for feed_config in self.feeds:
            try:
                print(f"📡 Fetching: {feed_config['name']}...")
                feed = feedparser.parse(feed_config["url"])
                
                for entry in feed.entries[:max_items]:
                    # Parse published date
                    published = None
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        published = datetime(*entry.published_parsed[:6])
                    
                    # Skip old items
                    if published and published < cutoff_time:
                        continue
                    
                    item = {
                        "title": entry.get("title", ""),
                        "description": entry.get("summary", entry.get("description", "")),
                        "link": entry.get("link", ""),
                        "source": feed_config["name"],
                        "category": feed_config.get("category", "general"),
                        "published": published.isoformat() if published else None,
                        "priority": feed_config.get("priority", 2)
                    }
                    
                    # Generate unique ID
                    item["id"] = hashlib.md5(
                        f"{item['title']}{item['link']}".encode()
                    ).hexdigest()[:12]
                    
                    all_items.append(item)
                    
            except Exception as e:
                print(f"⚠️  Error fetching {feed_config['name']}: {e}")
        
        print(f"✅ Fetched {len(all_items)} items from {len(self.feeds)} feeds")
        return all_items


# ============================================================
# CONTENT SCORER
# ============================================================

class ContentScorer:
    """Scores RSS items against Channel DNA."""
    
    def __init__(self, dna: ChannelDNA):
        self.dna = dna
    
    def score_item(self, item: Dict) -> Dict:
        """Score a single item against Channel DNA."""
        score = 50  # Base score
        reasons = []
        flags = []
        
        title = item.get("title", "").lower()
        description = item.get("description", "").lower()
        content = f"{title} {description}"
        
        # ===== NEGATIVE KEYWORDS (Instant Reject) =====
        for keyword in self.dna.negative_keywords:
            if keyword.lower() in content:
                return {
                    "score": 0,
                    "status": "REJECT",
                    "hook_potential": None,
                    "reasons": [f"❌ Reject keyword: '{keyword}'"],
                    "flags": ["AUTO_REJECT"],
                    "item": item
                }
        
        # ===== POSITIVE KEYWORDS =====
        weights = self.dna.scoring_weights
        
        # Entity keywords (Trump, Tesla, etc.)
        entity_hits = []
        for kw in self.dna.positive_keywords.get("entities", []):
            if kw.lower() in content:
                entity_hits.append(kw)
        if entity_hits:
            bonus = len(entity_hits) * weights.get("positive_keyword_entity", 5)
            score += bonus
            reasons.append(f"🏢 Entities: {', '.join(entity_hits[:3])} (+{bonus})")
        
        # Regional keywords (Saudi, Dubai, etc.)
        region_hits = []
        for kw in self.dna.positive_keywords.get("regions", []):
            if kw.lower() in content:
                region_hits.append(kw)
        if region_hits:
            bonus = weights.get("positive_keyword_region", 15)
            score += bonus
            reasons.append(f"🌍 Regional: {', '.join(region_hits[:2])} (+{bonus})")
            flags.append("REGIONAL_RELEVANCE")
        
        # Topic keywords
        topic_hits = []
        for kw in self.dna.positive_keywords.get("topics", []):
            if kw.lower() in content:
                topic_hits.append(kw)
        if topic_hits:
            bonus = len(topic_hits) * weights.get("positive_keyword_topic", 3)
            score += min(bonus, 15)  # Cap at 15
            reasons.append(f"📌 Topics: {', '.join(topic_hits[:3])} (+{min(bonus, 15)})")
        
        # ===== SPECIFICITY (Numbers) =====
        numbers = re.findall(
            r'\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:مليار|مليون|billion|million|trillion|percent|%))?',
            content
        )
        if len(numbers) >= 2:
            bonus = weights.get("specific_numbers", 15)
            score += bonus
            reasons.append(f"🔢 Specific numbers: {len(numbers)} found (+{bonus})")
            flags.append("HAS_NUMBERS")
        elif len(numbers) == 1:
            score += 8
            reasons.append(f"🔢 Has 1 number (+8)")
        
        # ===== HOOK POTENTIAL DETECTION =====
        hook_potential = "news_peg"  # Default
        
        # Threat angle
        threat_words = ["خطر", "تهديد", "threat", "danger", "warning", "crisis", 
                       "انهيار", "collapse", "crash", "destroy", "devastating"]
        for word in threat_words:
            if word.lower() in content:
                hook_potential = "threat_claim"
                bonus = weights.get("threat_angle", 10)
                score += bonus
                reasons.append(f"⚠️ Threat angle: '{word}' (+{bonus})")
                flags.append("THREAT_ANGLE")
                break
        
        # Reveal angle
        if hook_potential == "news_peg":
            reveal_words = ["سر", "خفي", "secret", "hidden", "revealed", "exposed",
                          "truth", "actually", "really", "uncovered"]
            for word in reveal_words:
                if word.lower() in content:
                    hook_potential = "reveal"
                    bonus = weights.get("reveal_angle", 8)
                    score += bonus
                    reasons.append(f"🔍 Reveal angle: '{word}' (+{bonus})")
                    flags.append("REVEAL_ANGLE")
                    break
        
        # Stakes/Loss angle
        if hook_potential == "news_peg":
            stakes_words = ["خسر", "فقد", "lost", "lose", "losing", "cost",
                          "billion", "trillion", "مليار", "تريليون"]
            for word in stakes_words:
                if word.lower() in content:
                    hook_potential = "stakes"
                    bonus = weights.get("stakes_angle", 6)
                    score += bonus
                    reasons.append(f"💰 Stakes angle: '{word}' (+{bonus})")
                    flags.append("STAKES_ANGLE")
                    break
        
        # ===== FINAL ADJUSTMENTS =====
        # Priority bonus (from feed config)
        if item.get("priority") == 1:
            score += 5
        
        # Cap score at 100
        score = min(score, 100)
        
        # Determine status
        if score >= 75:
            status = "🔥 HIGH_PRIORITY"
        elif score >= 55:
            status = "📋 CONSIDER"
        elif score >= 40:
            status = "📌 LOW_PRIORITY"
        else:
            status = "⏭️ SKIP"
        
        return {
            "score": score,
            "status": status,
            "hook_potential": hook_potential,
            "hook_name_ar": self.dna.hook_performance.get(hook_potential, {}).get("description", ""),
            "reasons": reasons,
            "flags": flags,
            "item": item
        }
    
    def score_batch(self, items: List[Dict]) -> List[Dict]:
        """Score a batch of items and return sorted results."""
        scored = [self.score_item(item) for item in items]
        
        # Remove duplicates (by title similarity)
        seen_titles = set()
        unique_scored = []
        for s in scored:
            title_key = s["item"]["title"][:50].lower()
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                unique_scored.append(s)
        
        # Sort by score
        unique_scored.sort(key=lambda x: x["score"], reverse=True)
        
        return unique_scored


# ============================================================
# REPORT GENERATOR
# ============================================================

class ReportGenerator:
    """Generates daily reports and recommendations."""
    
    def __init__(self, dna: ChannelDNA):
        self.dna = dna
    
    def generate_report(self, scored_items: List[Dict]) -> str:
        """Generate a text report of recommendations."""
        
        # Categorize items
        high_priority = [i for i in scored_items if "HIGH" in i["status"]]
        consider = [i for i in scored_items if "CONSIDER" in i["status"]]
        low_priority = [i for i in scored_items if "LOW" in i["status"]]
        rejected = [i for i in scored_items if i["status"] in ["REJECT", "⏭️ SKIP"]]
        
        report = f"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    📊 CONTENT INTELLIGENCE REPORT                             ║
║                    {self.dna.data['channel_name']}                                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}                                           ║
║  Items Scanned: {len(scored_items):>4}                                                       ║
║  High Priority: {len(high_priority):>4}  |  Consider: {len(consider):>4}  |  Rejected: {len(rejected):>4}        ║
╚══════════════════════════════════════════════════════════════════════════════╝

"""
        
        # HIGH PRIORITY Section
        report += "═" * 80 + "\n"
        report += f"🔥 HIGH PRIORITY ({len(high_priority)} items)\n"
        report += "═" * 80 + "\n"
        
        for i, item in enumerate(high_priority[:10], 1):
            report += self._format_item(i, item)
        
        if not high_priority:
            report += "   No high priority items found.\n"
        
        # CONSIDER Section
        report += "\n" + "═" * 80 + "\n"
        report += f"📋 CONSIDER ({len(consider)} items)\n"
        report += "═" * 80 + "\n"
        
        for i, item in enumerate(consider[:10], 1):
            report += self._format_item(i, item, brief=True)
        
        if not consider:
            report += "   No items to consider.\n"
        
        # Summary
        report += "\n" + "═" * 80 + "\n"
        report += "📈 SUMMARY\n"
        report += "═" * 80 + "\n"
        
        # Count by hook type
        hook_counts = {}
        for item in high_priority + consider:
            hook = item.get("hook_potential", "unknown")
            hook_counts[hook] = hook_counts.get(hook, 0) + 1
        
        report += "\nHook Types Distribution:\n"
        for hook, count in sorted(hook_counts.items(), key=lambda x: x[1], reverse=True):
            report += f"   • {hook}: {count}\n"
        
        # Regional relevance count
        regional_count = sum(1 for i in high_priority + consider if "REGIONAL_RELEVANCE" in i.get("flags", []))
        report += f"\nWith Regional Angle: {regional_count}\n"
        
        # Sources distribution
        sources = {}
        for item in high_priority + consider:
            src = item["item"].get("source", "Unknown")
            sources[src] = sources.get(src, 0) + 1
        
        report += "\nTop Sources:\n"
        for src, count in sorted(sources.items(), key=lambda x: x[1], reverse=True)[:5]:
            report += f"   • {src}: {count}\n"
        
        report += "\n" + "═" * 80 + "\n"
        report += "💡 Next Steps:\n"
        report += "   1. Review HIGH PRIORITY items\n"
        report += "   2. Run: python main.py --synopsis <number> for detailed brief\n"
        report += "   3. Check items with 🌍 Regional tag for Arab audience angle\n"
        report += "═" * 80 + "\n"
        
        return report
    
    def _format_item(self, index: int, scored_item: Dict, brief: bool = False) -> str:
        """Format a single item for the report."""
        item = scored_item["item"]
        
        output = f"""
┌─[{index}]────────────────────────────────────────────────────────────────────
│ Score: {scored_item['score']}/100  |  Hook: {scored_item['hook_potential']} ({scored_item.get('hook_name_ar', '')})
│ 
│ 📰 {item['title'][:75]}
│ 📌 Source: {item.get('source', 'Unknown')}  |  {item.get('published', '')[:10] if item.get('published') else 'No date'}
"""
        
        if not brief:
            # Add description
            desc = item.get('description', '')[:200]
            desc = re.sub(r'<[^>]+>', '', desc)  # Remove HTML tags
            output += f"│ \n│ {desc}...\n"
            
            # Add reasons
            output += "│ \n│ ✅ Match Reasons:\n"
            for reason in scored_item.get('reasons', [])[:4]:
                output += f"│    {reason}\n"
            
            # Add flags
            flags = scored_item.get('flags', [])
            if flags:
                output += f"│ \n│ 🏷️ Flags: {', '.join(flags)}\n"
        
        output += f"│ 🔗 {item.get('link', '')[:70]}\n"
        output += "└" + "─" * 78 + "\n"
        
        return output
    
    def save_report(self, report: str, scored_items: List[Dict]) -> Tuple[Path, Path]:
        """Save report to files."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M')
        
        # Save text report
        report_path = OUTPUT_DIR / f"report_{timestamp}.txt"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        # Save JSON data for later use
        json_path = OUTPUT_DIR / f"data_{timestamp}.json"
        
        # Prepare serializable data
        json_data = {
            "timestamp": datetime.now().isoformat(),
            "items": [
                {
                    **s,
                    "item": {**s["item"], "published": str(s["item"].get("published", ""))}
                }
                for s in scored_items[:50]  # Top 50
            ]
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        return report_path, json_path


# ============================================================
# SYNOPSIS GENERATOR (Claude API)
# ============================================================

class SynopsisGenerator:
    """Generates production synopses using Claude API."""
    
    def __init__(self, dna: ChannelDNA):
        self.dna = dna
        self.client = None
        
        if HAS_ANTHROPIC:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if api_key:
                self.client = anthropic.Anthropic(api_key=api_key)
    
    def generate(self, scored_item: Dict) -> str:
        """Generate a production synopsis for a scored item."""
        item = scored_item["item"]
        
        prompt = f"""أنت مساعد إنتاج محتوى لقناة "{self.dna.data['channel_name']}".

## معلومات الموضوع:
العنوان: {item.get('title', 'N/A')}
الوصف: {item.get('description', 'N/A')}
المصدر: {item.get('source', 'N/A')}
الرابط: {item.get('link', 'N/A')}

## تقييم الموضوع:
- Score: {scored_item['score']}/100
- Hook Potential: {scored_item['hook_potential']} ({scored_item.get('hook_name_ar', '')})
- الأسباب: {', '.join(scored_item.get('reasons', []))}
- Flags: {', '.join(scored_item.get('flags', []))}

## DNA القناة - ما الذي يعمل:
- أفضل Hooks: Threat Claim (5.6M), Reveal (5.5M), Stakes (2.7M)
- Audience Triggers: أرقام محددة، Loss framing، Hidden truth، Regional relevance
- الجمهور: عربي (خليج + مصر)

## المطلوب إنشاءه:

### 1. العنوان (3 خيارات)
اكتب 3 عناوين قصيرة ومثيرة بالعربية، تتضمن رقم أو تساؤل

### 2. الـ Hook (أول 15-20 ثانية)
اكتب Hook بالعربية يبدأ بـ {scored_item['hook_potential']}
- يجب أن يتضمن رقم محدد
- يجب أن يخلق إحساس بالـ urgency
- يربط بالمشاهد العربي

### 3. هيكل الحلقة
| الوقت | القسم | المحتوى |
|-------|-------|--------|
| 0:00-0:30 | HOOK | ... |
| 0:30-3:00 | PROOF | ... |
| 3:00-7:00 | MECHANISM | ... |
| 7:00-10:00 | STAKES | ... |
| 10:00-13:00 | IMPLICATIONS | ... |
| 13:00-15:00 | CTA | ... |

### 4. الأرقام المطلوب البحث عنها
قائمة بالإحصائيات والأرقام التي يحتاج الفريق للبحث عنها

### 5. الزاوية الإقليمية
كيف نربط الموضوع بـ:
- الخليج (السعودية، الإمارات، قطر)
- مصر
- العالم العربي

### 6. Thumbnail (3 أفكار)
وصف 3 أفكار للصورة المصغرة

### 7. أفكار Shorts (3 أفكار)
3 زوايا قصيرة يمكن استخدامها كـ Shorts

---
اكتب Synopsis كامل وجاهز للفريق:
"""
        
        if self.client:
            try:
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=2000,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            except Exception as e:
                return f"❌ Error generating synopsis: {e}\n\n📝 Prompt saved for manual use:\n\n{prompt}"
        else:
            return f"""
⚠️ Claude API not configured. 

To enable auto-generation:
1. Install: pip install anthropic
2. Set: export ANTHROPIC_API_KEY=your-key

📝 MANUAL PROMPT (copy to Claude):
{'='*60}

{prompt}
"""


# ============================================================
# MAIN APPLICATION
# ============================================================

class ContentIntelligenceSystem:
    """Main application class."""
    
    def __init__(self):
        self.dna = ChannelDNA()
        self.fetcher = RSSFetcher()
        self.scorer = ContentScorer(self.dna)
        self.reporter = ReportGenerator(self.dna)
        self.synopsis_gen = SynopsisGenerator(self.dna)
        self.last_results = None
    
    def run_full_scan(self) -> str:
        """Run a full RSS scan and generate report."""
        print("\n🚀 Starting Content Intelligence Scan...\n")
        
        # Fetch RSS feeds
        items = self.fetcher.fetch_all()
        
        if not items:
            return "❌ No items fetched. Check RSS configuration and network."
        
        # Score items
        print(f"\n🔍 Scoring {len(items)} items against Channel DNA...")
        scored_items = self.scorer.score_batch(items)
        self.last_results = scored_items
        
        # Generate report
        print("📝 Generating report...")
        report = self.reporter.generate_report(scored_items)
        
        # Save files
        report_path, json_path = self.reporter.save_report(report, scored_items)
        print(f"\n✅ Report saved: {report_path}")
        print(f"✅ Data saved: {json_path}")
        
        return report
    
    def run_test(self) -> str:
        """Run with sample data for testing."""
        print("\n🧪 Running test with sample data...\n")
        
        sample_items = [
            {
                "title": "Tesla Robotaxi Launch: Musk Announces 2026 Rollout in Dubai",
                "description": "Elon Musk confirmed Tesla will launch its robotaxi service in Dubai by 2026, threatening 500,000 driver jobs in the Gulf region. The announcement comes as UAE accelerates autonomous vehicle testing.",
                "source": "Reuters",
                "link": "https://reuters.com/example1",
                "published": datetime.now().isoformat(),
                "priority": 1
            },
            {
                "title": "Gold Hits $3,500 as Central Banks Stockpile Amid Dollar Concerns",
                "description": "Gold prices reached record $3,500 per ounce as central banks, including Saudi Arabia and UAE, increase reserves. Analysts warn of potential dollar crisis.",
                "source": "Bloomberg",
                "link": "https://bloomberg.com/example2",
                "published": datetime.now().isoformat(),
                "priority": 1
            },
            {
                "title": "Buy Now Pay Later Defaults Surge 40% in GCC Countries",
                "description": "Tabby and Tamara report rising defaults among young consumers in Saudi Arabia and UAE. Hidden debt crisis threatens millions of families.",
                "source": "Financial Times",
                "link": "https://ft.com/example3",
                "published": datetime.now().isoformat(),
                "priority": 1
            },
            {
                "title": "China Develops Hypersonic Missile That Can Evade US Defenses",
                "description": "Pentagon officials warn new Chinese missile travels at Mach 10, capable of striking US carriers in first 20 minutes of conflict. $50 billion defense gap exposed.",
                "source": "NYT",
                "link": "https://nyt.com/example4",
                "published": datetime.now().isoformat(),
                "priority": 1
            },
            {
                "title": "Apple Secret Project: AI-Powered Health Device Could Save Millions",
                "description": "Leaked documents reveal Apple's hidden health monitoring device, capable of detecting heart attacks 30 minutes before they happen. FDA approval pending.",
                "source": "TechCrunch",
                "link": "https://techcrunch.com/example5",
                "published": datetime.now().isoformat(),
                "priority": 2
            },
            {
                "title": "Local Chicago City Council Approves New Parking Meters",
                "description": "Chicago aldermen voted 35-15 to approve new smart parking meters downtown.",
                "source": "Chicago Tribune",
                "link": "https://tribune.com/example6",
                "published": datetime.now().isoformat(),
                "priority": 3
            },
            {
                "title": "NFL Week 15: Chiefs vs Bills Preview and Predictions",
                "description": "Breaking down the key matchups for this Sunday's AFC showdown.",
                "source": "ESPN",
                "link": "https://espn.com/example7",
                "published": datetime.now().isoformat(),
                "priority": 3
            },
            {
                "title": "Trump Threatens 100% Tariffs on China: Trade War 2.0 Begins",
                "description": "President Trump announced sweeping new tariffs targeting $500 billion in Chinese imports. Beijing warns of immediate retaliation affecting Gulf oil exports.",
                "source": "Reuters",
                "link": "https://reuters.com/example8",
                "published": datetime.now().isoformat(),
                "priority": 1
            },
            {
                "title": "Uber Investing $1.2 Billion to Replace Human Drivers with AI",
                "description": "Internal documents reveal Uber's secret plan to phase out human drivers by 2030. 3 million Uber and Careem drivers in MENA region face uncertain future.",
                "source": "Bloomberg",
                "link": "https://bloomberg.com/example9",
                "published": datetime.now().isoformat(),
                "priority": 1
            },
            {
                "title": "Egypt Currency Crisis: Pound Falls 15% in Single Day",
                "description": "Egyptian pound crashed to record low as central bank loses control. Inflation expected to hit 40%. Millions of Egyptians face economic hardship.",
                "source": "Al Jazeera",
                "link": "https://aljazeera.com/example10",
                "published": datetime.now().isoformat(),
                "priority": 1
            }
        ]
        
        # Score items
        scored_items = self.scorer.score_batch(sample_items)
        self.last_results = scored_items
        
        # Generate report
        report = self.reporter.generate_report(scored_items)
        
        # Save files
        report_path, json_path = self.reporter.save_report(report, scored_items)
        print(f"✅ Report saved: {report_path}")
        print(f"✅ Data saved: {json_path}")
        
        return report
    
    def generate_synopsis(self, index: int) -> str:
        """Generate synopsis for item at given index."""
        if not self.last_results:
            # Try to load latest data file
            data_files = sorted(OUTPUT_DIR.glob("data_*.json"), reverse=True)
            if data_files:
                with open(data_files[0], 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.last_results = data.get("items", [])
            else:
                return "❌ No data available. Run a scan first."
        
        if index < 1 or index > len(self.last_results):
            return f"❌ Invalid index. Choose between 1 and {len(self.last_results)}"
        
        scored_item = self.last_results[index - 1]
        return self.synopsis_gen.generate(scored_item)


# ============================================================
# CLI ENTRY POINT
# ============================================================

def main():
    system = ContentIntelligenceSystem()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--test":
            report = system.run_test()
            print(report)
        
        elif sys.argv[1] == "--synopsis" and len(sys.argv) > 2:
            try:
                index = int(sys.argv[2])
                synopsis = system.generate_synopsis(index)
                print(synopsis)
                
                # Save synopsis
                synopsis_path = OUTPUT_DIR / f"synopsis_{index}_{datetime.now().strftime('%Y%m%d_%H%M')}.md"
                with open(synopsis_path, 'w', encoding='utf-8') as f:
                    f.write(synopsis)
                print(f"\n✅ Synopsis saved: {synopsis_path}")
                
            except ValueError:
                print("❌ Invalid index. Use: python main.py --synopsis <number>")
        
        elif sys.argv[1] == "--help":
            print(__doc__)
        
        else:
            print(f"Unknown option: {sys.argv[1]}")
            print("Use --help for usage information")
    
    else:
        # Full scan
        report = system.run_full_scan()
        print(report)


if __name__ == "__main__":
    main()
