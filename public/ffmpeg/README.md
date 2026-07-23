# FFmpeg WASM core — self-hosted

Phase 15 / B4 reduces the third-party dependency on unpkg.com for the
~10 MB FFmpeg WASM core. The video-stream-manager will use these files
if they're present in this directory; otherwise it falls back to the
public CDN.

## How to populate

After `npm install`, copy the two artefacts shipped by `@ffmpeg/core`:

```bash
mkdir -p public/ffmpeg
cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js public/ffmpeg/
cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm public/ffmpeg/
```

Or as a one-line CI step:

```bash
node -e "const fs=require('fs');const path=require('path');const src='node_modules/@ffmpeg/core/dist/esm';fs.mkdirSync('public/ffmpeg',{recursive:true});for(const f of ['ffmpeg-core.js','ffmpeg-core.wasm']){fs.copyFileSync(path.join(src,f),path.join('public/ffmpeg',f))}"
```

(@ffmpeg/core isn't currently in `dependencies` because the FFmpeg
runtime is loaded dynamically — `npm i @ffmpeg/core@0.12.6` if you
want the files locally.)

## Why this isn't done at build time automatically

Adding 10 MB to the static export inflates `out/` even for users who
never trigger the FFmpeg transcode fallback. Hosts who care about
CDN-independence opt in by populating this directory; others can
leave it empty and let the runtime fall back to unpkg.

## Files this directory should contain after population

- `ffmpeg-core.js`   (~600 KB)
- `ffmpeg-core.wasm` (~10 MB)
