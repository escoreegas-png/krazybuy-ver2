KRAZYBUY V1.3 — VERCEL FRONTEND

This ZIP contains only the frontend needed for Vercel.

Backend/API:
https://wobz-ver-1-1.onrender.com

FILES
-----
index.html  -> application UI
styles.css  -> KrazyBuy orange theme
app.js      -> Vercel -> Render API connection
vercel.json -> Vercel configuration
images/logo.png -> app logo

VERCEL DEPLOY
-------------
1. Create/import a GitHub repository containing this folder's contents.
2. In Vercel, import that repository.
3. Framework Preset: Other.
4. Build Command: leave empty.
5. Output Directory: leave empty / project root.
6. Deploy.

IMPORTANT
---------
The frontend is configured to use:
https://wobz-ver-1-1.onrender.com

The Render backend must allow the Vercel origin through CORS.
If using a production Vercel domain, set on Render:
KRAZYBUY_FRONTEND_URL=https://YOUR-VERCEL-DOMAIN.vercel.app

TEST
----
After deployment, open the Vercel site.
The top status should become:
Server online · v1.2.1

Then test PDF -> Images.
The download should be:
krazybuy-pdf-images.zip

Do not upload server/, Dockerfile, package.json, or node_modules to this Vercel project.
