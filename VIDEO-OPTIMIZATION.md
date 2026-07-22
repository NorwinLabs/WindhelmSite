# Video Optimization Guide

## Current Status
Your background videos are quite large:
- `BGVideo.mp4`: 3.3 MB
- `HeroVideoWorld.mp4`: 6 MB

Total: **9.3 MB of video on initial page load**

## Target
- `BGVideo.mp4`: ~1.5 MB (54% reduction)
- `HeroVideoWorld.mp4`: ~2 MB (67% reduction)

Total: **~3.5 MB** (62% total reduction, saving ~5-7 seconds on slower connections)

## Requirements
You'll need FFmpeg installed. If you don't have it:
- **Windows:** Download from https://www.gyan.dev/ffmpeg/builds/
- **Mac:** `brew install ffmpeg`
- **Linux:** `sudo apt install ffmpeg`

## Commands to Run

### Option 1: Balanced Quality (Recommended)
```bash
# Navigate to your media folder
cd "c:\Users\Gavin Norwood\Documents\Git\WindhelmSite\media"

# Optimize BGVideo.mp4
ffmpeg -i BGVideo.mp4 -vcodec libx264 -crf 28 -preset slow -vf "scale=1920:-2" -an BGVideo-optimized.mp4

# Optimize HeroVideoWorld.mp4
ffmpeg -i HeroVideoWorld.mp4 -vcodec libx264 -crf 28 -preset slow -vf "scale=1920:-2" -an HeroVideoWorld-optimized.mp4
```

### Option 2: Maximum Compression (if Option 1 isn't small enough)
```bash
# For even smaller files, increase CRF to 32
ffmpeg -i BGVideo.mp4 -vcodec libx264 -crf 32 -preset slow -vf "scale=1280:-2" -an BGVideo-optimized.mp4
ffmpeg -i HeroVideoWorld.mp4 -vcodec libx264 -crf 32 -preset slow -vf "scale=1280:-2" -an HeroVideoWorld-optimized.mp4
```

### Option 3: WebM Format (Best compression, modern browsers only)
```bash
# Convert to WebM for even better compression
ffmpeg -i BGVideo.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -vf "scale=1920:-2" -an BGVideo-optimized.webm
ffmpeg -i HeroVideoWorld.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -vf "scale=1920:-2" -an HeroVideoWorld-optimized.webm
```

## What These Flags Mean
- `-vcodec libx264` or `-c:v libvpx-vp9`: Video codec (H.264 or VP9)
- `-crf 28`: Quality level (18-28 is good, higher = smaller file)
- `-preset slow`: Slower encoding for better compression
- `-vf "scale=1920:-2"`: Scale to 1920px width, maintain aspect ratio
- `-an`: Remove audio (not needed for background video)
- `-b:v 0`: Variable bitrate (WebM only)

## After Optimization

### 1. Test the optimized videos
Open them in a video player to ensure quality is acceptable.

### 2. Update your script
Edit `script.min.js` around line 33:

**Current:**
```javascript
var HERO_VIDEOS = ["media/BGVideo.mp4", "media/HeroVideoWorld.mp4"];
```

**Change to (MP4):**
```javascript
var HERO_VIDEOS = ["media/BGVideo-optimized.mp4", "media/HeroVideoWorld-optimized.mp4"];
```

**Or (WebM with MP4 fallback):**
```javascript
var HERO_VIDEOS = [
  window.matchMedia('(min-width: 1024px)').matches 
    ? ["media/BGVideo-optimized.webm", "media/HeroVideoWorld-optimized.webm"]
    : ["media/BGVideo-optimized.mp4", "media/HeroVideoWorld-optimized.mp4"]
];
```

### 3. Update service worker cache
Edit `sw.js` line 8-16 to remove old video references if needed.

### 4. Delete old files (optional)
Once you confirm the new videos work:
```bash
# Backup first!
mkdir backup
move BGVideo.mp4 backup/
move HeroVideoWorld.mp4 backup/

# Or just rename the optimized ones
move BGVideo-optimized.mp4 BGVideo.mp4
move HeroVideoWorld-optimized.mp4 HeroVideoWorld.mp4
```

## Expected Results
- **Load time:** 5-7 seconds faster on 4G connections
- **LCP (Largest Contentful Paint):** Improved by 2-3 seconds
- **Mobile experience:** Significantly better
- **Data usage:** 62% reduction

## Quality Check
After optimization, check:
1. Video plays smoothly
2. No visible compression artifacts
3. Colors look natural
4. Motion is fluid (no stuttering)

If quality is too low, re-encode with a lower CRF value (e.g., 24 instead of 28).

## Alternative: Cloud CDN
Consider hosting videos on:
- **Cloudflare Stream** - $1/1000 minutes viewed
- **Mux Video** - Similar pricing
- **YouTube (unlisted)** - Free but requires iframe embed

Benefits:
- Adaptive bitrate streaming
- Automatic optimization
- Global CDN delivery
- No storage on your server

---

**Questions?** Test locally first, then deploy once satisfied with quality/size tradeoff.
