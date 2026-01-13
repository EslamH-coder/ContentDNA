# 📊 Content Intelligence System
## Automated Content Recommendation Engine for المُخبر الاقتصادي

---

## 🎯 What It Does

1. **Scans RSS Feeds** - Pulls latest news from 15+ sources (Reuters, Bloomberg, NYT, etc.)
2. **Scores Against Channel DNA** - Uses your channel's success patterns to rank topics
3. **Generates Recommendations** - Daily report with HIGH PRIORITY topics
4. **Creates Production Briefs** - Auto-generates synopses with hooks, structure, thumbnails

---

## 📁 Project Structure

```
content_intelligence_system/
├── main.py                 # Main application
├── config/
│   ├── channel_dna.json    # Your channel's success patterns
│   └── rss_feeds.json      # RSS feed sources
├── output/
│   ├── report_YYYYMMDD.txt # Daily reports
│   └── data_YYYYMMDD.json  # Raw scored data
└── logs/                   # Error logs
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install feedparser anthropic
```

### 2. Run Test (No Network Required)

```bash
cd content_intelligence_system
python main.py --test
```

### 3. Run Full Scan (Requires Network)

```bash
python main.py
```

### 4. Generate Synopsis for Top Item

```bash
python main.py --synopsis 1
```

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `python main.py` | Full RSS scan + report |
| `python main.py --test` | Test with sample data |
| `python main.py --synopsis <N>` | Generate synopsis for item #N |
| `python main.py --help` | Show help |

---

## ⚙️ Configuration

### Adding RSS Feeds

Edit `config/rss_feeds.json`:

```json
{
    "name": "Your Feed Name",
    "url": "https://example.com/rss",
    "category": "business",
    "priority": 1,
    "enabled": true
}
```

### Updating Channel DNA

Edit `config/channel_dna.json` to add:
- New positive/negative keywords
- Adjust scoring weights
- Add winning/losing topics

---

## 🔌 Claude API Integration (Optional)

For auto-generated synopses:

```bash
export ANTHROPIC_API_KEY=your-api-key-here
python main.py --synopsis 1
```

Without API key, the system will output a prompt you can copy to Claude manually.

---

## 📊 Understanding the Report

### Score Breakdown (0-100)

| Score | Status | Action |
|-------|--------|--------|
| 75-100 | 🔥 HIGH_PRIORITY | Produce immediately |
| 55-74 | 📋 CONSIDER | Review for potential |
| 40-54 | 📌 LOW_PRIORITY | Only if nothing better |
| 0-39 | ⏭️ SKIP/REJECT | Ignore |

### Scoring Factors

- **Entity Keywords** (+5 each): Trump, Tesla, China, etc.
- **Regional Relevance** (+15): Saudi, Dubai, Egypt, Gulf
- **Topic Keywords** (+3 each): war, crisis, oil, AI, etc.
- **Specific Numbers** (+15): Dates, amounts, percentages
- **Threat Angle** (+10): danger, crisis, collapse
- **Reveal Angle** (+8): secret, hidden, exposed
- **Stakes Angle** (+6): lost, billion, cost

---

## 🔄 Automation (Cron Job)

Run daily at 8 AM:

```bash
# Edit crontab
crontab -e

# Add this line
0 8 * * * cd /path/to/content_intelligence_system && python main.py >> logs/cron.log 2>&1
```

---

## 📧 Email/Slack Integration

### Email (using Python)

```python
import smtplib
from email.mime.text import MIMEText

# After generating report
with open('output/report_latest.txt', 'r') as f:
    report = f.read()

msg = MIMEText(report)
msg['Subject'] = '📊 Daily Content Recommendations'
msg['From'] = 'system@example.com'
msg['To'] = 'team@example.com'

# Send via SMTP
```

### Slack (using webhook)

```python
import requests

webhook_url = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
requests.post(webhook_url, json={'text': report[:4000]})
```

---

## 🔧 Troubleshooting

### "feedparser not installed"
```bash
pip install feedparser
```

### "No items fetched"
- Check internet connection
- Verify RSS URLs in config
- Some feeds may be rate-limited

### "Score seems wrong"
- Review `channel_dna.json` keywords
- Adjust `scoring_weights` as needed

---

## 📈 Roadmap

- [x] RSS Feed Scanner
- [x] DNA-Based Scoring
- [x] Report Generator
- [x] Claude Synopsis Integration
- [ ] Google Trends Integration
- [ ] Twitter/X Trending Integration
- [ ] YouTube Analytics Feedback Loop
- [ ] Slack Bot Interface
- [ ] Web Dashboard

---

## 📝 Version History

- **v1.0** (Dec 2025) - Initial release with RSS + DNA scoring

---

*Built for المُخبر الاقتصادي Content Team*
