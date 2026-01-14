# Git Commit Instructions

## Step 1: Check Git Status
```bash
cd /Users/Hassanes_1/Documents/channelbrain
git status
```

## Step 2: Stage All Changes
```bash
git add .
```

Or stage specific files:
```bash
git add cursor/lib/taxonomy/
git add cursor/app/api/
git add cursor/lib/scoring/
git add cursor/migrations/
git add cursor/*.md
```

## Step 3: Commit with Message
```bash
git commit -m "feat: Unified Taxonomy System + Scoring Fixes + Auto-Learning

- Created unified taxonomy service using topic_definitions as single source of truth
- Implemented auto-learning from user feedback
- Added AI-powered keyword generation for topics
- Fixed showId error in feedback route
- Fixed DNA matching bugs (undefined variables, generic term filtering)
- Improved scoring: DNA bonus scaling, indirect breakout scaling, reduced penalties
- Disabled thumbnail analysis in onboarding
- Auto-generate topics if missing before classification
- Removed deprecation warnings
- Added comprehensive testing and documentation"
```

## Step 4: Push to Remote
```bash
git push
```

Or if you need to set upstream:
```bash
git push -u origin main
# or
git push -u origin master
```

## Alternative: Use the Commit Message File
If you prefer, you can use the commit message from the file:
```bash
git commit -F cursor/COMMIT_MESSAGE.md
```

## Check What Branch You're On
```bash
git branch
```

## If You Need to Create a New Branch
```bash
git checkout -b feature/unified-taxonomy-system
git add .
git commit -m "feat: Unified Taxonomy System + Scoring Fixes + Auto-Learning"
git push -u origin feature/unified-taxonomy-system
```
