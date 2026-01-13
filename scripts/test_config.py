#!/usr/bin/env python3
"""
Test script to verify config files can be loaded
Tests: scripts/config/channel_dna.json and scripts/config/rss_feeds.json
"""

import json
import os
from pathlib import Path

# Get the script directory (where this file is located)
SCRIPT_DIR = Path(__file__).parent
CONFIG_DIR = SCRIPT_DIR / "config"

def load_json_file(filepath):
    """Load and parse a JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error in {filepath}: {e}")
        return None
    except Exception as e:
        print(f"❌ Error loading {filepath}: {e}")
        return None

def analyze_dna(dna_data):
    """Analyze DNA config and return summary"""
    if not dna_data or not isinstance(dna_data, dict):
        return None
    
    # Extract show name
    show_name = (
        dna_data.get("channel_name") or
        dna_data.get("show_name") or
        dna_data.get("name") or
        dna_data.get("title") or
        "Not specified"
    )
    
    # Count topics (winning + losing)
    winning_topics = dna_data.get("winning_topics", [])
    losing_topics = dna_data.get("losing_topics", [])
    total_topics = len(winning_topics) + len(losing_topics)
    
    # Count hook patterns
    hook_performance = dna_data.get("hook_performance", {})
    hook_patterns_count = len(hook_performance) if isinstance(hook_performance, dict) else 0
    
    return {
        "show_name": show_name,
        "total_topics": total_topics,
        "winning_topics_count": len(winning_topics),
        "losing_topics_count": len(losing_topics),
        "hook_patterns_count": hook_patterns_count,
    }

def analyze_rss_feeds(rss_data):
    """Analyze RSS feeds config and return summary"""
    if not rss_data:
        return None
    
    feeds = []
    if isinstance(rss_data, list):
        feeds = rss_data
    elif isinstance(rss_data, dict):
        feeds = (
            rss_data.get("feeds") or
            rss_data.get("sources") or
            rss_data.get("rss_feeds") or
            []
        )
    
    if not isinstance(feeds, list):
        return None
    
    # Filter enabled feeds (skip placeholders and comments)
    enabled_feeds = []
    for feed in feeds:
        if not isinstance(feed, dict):
            continue
        
        # Skip placeholder/comment entries
        name = feed.get("name", "")
        if name == "placeholder" or name.startswith("_comment") or feed.get("_comment"):
            continue
        
        # Check if enabled (default to True if not specified)
        enabled = feed.get("enabled", True)
        if enabled:
            enabled_feeds.append(name)
    
    return {
        "total_feeds": len(feeds),
        "enabled_feeds": enabled_feeds,
        "enabled_count": len(enabled_feeds),
    }

def main():
    # Load DNA config
    dna_file = CONFIG_DIR / "channel_dna.json"
    alt_dna_file = CONFIG_DIR / "show_dna_almokhbir.json"
    
    dna_data = None
    if dna_file.exists():
        dna_data = load_json_file(dna_file)
    elif alt_dna_file.exists():
        dna_data = load_json_file(alt_dna_file)
    
    # Load RSS feeds config
    rss_file = CONFIG_DIR / "rss_feeds.json"
    rss_data = load_json_file(rss_file) if rss_file.exists() else None
    
    # Analyze data
    dna_summary = analyze_dna(dna_data) if dna_data else None
    rss_summary = analyze_rss_feeds(rss_data) if rss_data else None
    
    # Print summary
    print()
    print("=" * 70)
    print("Config Files Verification")
    print("=" * 70)
    print()
    
    # DNA Summary
    if dna_summary:
        print(f"✅ DNA Loaded: {dna_summary['show_name']}")
        print(f"   - {dna_summary['total_topics']} topics")
        print(f"   - {dna_summary['hook_patterns_count']} hook patterns")
        print(f"   - {dna_summary['winning_topics_count']} winning topics")
        if dna_summary['losing_topics_count'] > 0:
            print(f"   - {dna_summary['losing_topics_count']} losing topics")
    else:
        print("❌ DNA: Failed to load")
    
    print()
    
    # RSS Feeds Summary
    if rss_summary:
        print(f"✅ RSS Feeds: {rss_summary['total_feeds']} feeds configured")
        print(f"   - {rss_summary['enabled_count']} enabled")
        if rss_summary['enabled_feeds']:
            print("   - " + "\n   - ".join(rss_summary['enabled_feeds'][:10]))
            if len(rss_summary['enabled_feeds']) > 10:
                remaining = len(rss_summary['enabled_feeds']) - 10
                print(f"   - ... and {remaining} more")
    else:
        print("❌ RSS Feeds: Failed to load")
    
    print()
    print("=" * 70)
    
    # Final status
    if dna_summary and rss_summary:
        print("✅ All config files verified successfully!")
        return 0
    else:
        print("❌ Some config files failed to load")
        return 1

if __name__ == "__main__":
    exit(main())

