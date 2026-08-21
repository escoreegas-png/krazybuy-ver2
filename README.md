# Wobz Vercel Frontend — Production V1.2

This is the frontend deployment package for Wobz.

## Architecture

- Vercel: static frontend (`index.html`, `styles.css`, `app.js`, `images/logo.png`)
- Render: processing API (`https://wobz-ver-1-1.onrender.com`)
- Vercel rewrites `/api/*` to the Render API.

## Live workflows in this package

- PDF merge
- PDF split
- PDF organize/edit foundation
- PDF compress
- PDF protect
- PDF → All Images (ZIP with every page + manifest)
- Images → PDF
- Image edit / convert / compress
- Files → ZIP
- Render health/status

## Intentionally disabled

PPTX, DOCX and XLSX workflows are shown as planned until the deployed Render server exposes real routes for them. The frontend does not fake those operations.

## Vercel

Import this repository as a static project.

- Framework: Other
- Build Command: empty
- Output Directory: `.`
- Install Command: empty

The `vercel.json` file already contains the API rewrite.
