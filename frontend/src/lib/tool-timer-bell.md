# Recorded timer bell

- Recording: [Boxing bell #1](https://bigsoundbank.com/boxing-bell-1-s1926.html) by Joseph Sardin.
- License: [CC0](https://bigsoundbank.com/licenses.html). The recording page explicitly permits editing, redistribution, and use in apps without attribution. Credit is included here to preserve provenance.
- Original: `https://bigsoundbank.com/UPLOAD/bwf-en/1926.wav`, downloaded 2026-10-20. SHA-256: `8ccfe01d54ffd928dd1bbe5816302f26a73b81fbe02d22282e405282758d33b6`.
- Processing: `python scripts/prepare-timer-bell.py 1926.wav` verifies the original hash, takes the first 0.94 seconds (three quick strikes), resamples mono 48 kHz/24-bit PCM to 11,025 Hz/8-bit PCM, applies an 80 ms fade, normalizes with headroom, and embeds the cue in `tool-timer-bell.js`. The original source file is not stored in this repository.
