# AMETHYST STUDIO — Official v1.0.0

**One crystal. Every format.**

Amethyst Studio is an English-language web workspace with a dark amethyst/neon interface, animated crystal particles, a Royal Gold Premium theme, Google Sign-In, a 10-jobs/day Free plan, single-use 7-day Premium keys, an admin key console, media processing, image tools and document conversion/viewing.

## What is real in v1.0.0

- Google Identity Services login verified again on the backend.
- Admin is determined server-side from `ADMIN_EMAIL` (default: `khangyukimaru@gmail.com`).
- Admin is always Premium and does not consume daily quota.
- Free users receive 10 processing jobs per UTC day.
- Each Premium key can be redeemed exactly once.
- Each normal Premium key grants 7 days from redemption; redeeming while Premium is active extends from the current expiry.
- Keys are stored as SHA-256 hashes, not recoverable plaintext. Newly generated plaintext keys are displayed only in the Admin Console response so the admin can copy them.
- Best-available authorized YouTube/TikTok video download through `yt-dlp`.
- Best-available authorized audio download to FLAC.
- Video scaling up to 10K-width targets and motion interpolation up to 600 FPS through FFmpeg. 8K/10K and >120 FPS are Premium-only. These are enhanced derivatives, not native-source claims.
- Audio conversion/extraction: MP3 320 kbps, FLAC, WAV and OPUS backend support.
- Image 2×–8× high-quality upscale and sharpening.
- AI image background removal using `rembg` + ONNX Runtime.
- Green-screen video removal to transparent WebM using FFmpeg chroma key.
- Office-document conversion through LibreOffice headless for source/output pairs LibreOffice actually supports.
- Browser viewer: PDF and images directly; supported Office files are temporarily converted to PDF.
- Per-account processing history.
- Temporary job-file cleanup after the configured retention time (24 hours by default).
- Responsive amethyst UI, animated particles, glowing borders, crystal float/orbit animation and Premium gold mode.
- Privacy Policy and Terms pages included for public deployment.

## Important architecture

GitHub Pages is static hosting. It can host the **frontend**, but it cannot run a persistent Python/FFmpeg/LibreOffice API. Therefore production Amethyst Studio has two pieces:

1. `frontend/` → GitHub Pages.
2. `backend/` → any Docker-capable HTTPS host connected to PostgreSQL.

The repository includes a GitHub Actions Pages workflow and a Dockerfile for the backend.

---

# 1. Create the GitHub repository

1. Create a repository, for example `amethyst-studio`.
2. Upload the entire contents of this folder to the repository root.
3. Commit to the `main` branch.
4. In GitHub go to **Settings → Pages**.
5. Under **Build and deployment → Source**, choose **GitHub Actions**.

The included `.github/workflows/pages.yml` builds `frontend/` and deploys it automatically.

---

# 2. Create Google Sign-In credentials

In Google Cloud Console:

1. Create/select a project for Amethyst Studio.
2. Configure the OAuth consent/branding screen.
3. Create an **OAuth Client ID → Web application**.
4. Add the exact GitHub Pages origin as an **Authorized JavaScript origin**, for example:
   `https://YOUR_USERNAME.github.io`
5. If you later use a custom domain, add that HTTPS origin too.
6. Copy the Web Client ID ending in `.apps.googleusercontent.com`.

Use the same Client ID in frontend and backend. Never put a Google Client Secret into the frontend.

For a public production OAuth app, publish a real home page, Privacy Policy and Terms links and follow Google's current brand/verification requirements. The project already contains `/privacy.html` and `/terms.html`, but replace the support-contact placeholder before a public launch.

---

# 3. Deploy the backend

The backend needs persistent HTTPS hosting with enough CPU/RAM/disk for FFmpeg and LibreOffice. 10K/600 FPS workloads are extremely expensive and should use a powerful server/GPU-enabled pipeline in serious production.

Build from `backend/Dockerfile`.

Required environment variables:

```env
APP_SECRET=use-a-long-random-secret
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
ADMIN_EMAIL=khangyukimaru@gmail.com
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
CORS_ORIGINS=https://YOUR_USERNAME.github.io
JOB_DIR=/app/data/jobs
JOB_TTL_HOURS=24
FREE_DAILY_LIMIT=10
MAX_UPLOAD_MB=500
```

`DATABASE_URL=sqlite:///./data/amethyst.db` is okay for local development. Use PostgreSQL in real production.

Your backend URL will look similar to:

`https://api.your-domain.example`

Test it by opening the root endpoint. It should return JSON containing `Amethyst Studio API`, `1.0.0`, and `online`.

---

# 4. Add GitHub repository variables

Go to:

**GitHub repository → Settings → Secrets and variables → Actions → Variables**

Create these repository variables:

- `VITE_API_URL` = your HTTPS backend URL, with no trailing slash.
- `VITE_GOOGLE_CLIENT_ID` = your Google Web Client ID.

These are intentionally repository **variables**, not secrets: a browser frontend necessarily receives both the public API address and OAuth Client ID.

Push a commit or manually run **Actions → Deploy Amethyst Studio to GitHub Pages → Run workflow**.

---

# 5. Set backend CORS correctly

After GitHub gives you the final Pages address, ensure backend `CORS_ORIGINS` contains the exact browser origin.

Example:

```env
CORS_ORIGINS=https://YOUR_USERNAME.github.io
```

For local + public development:

```env
CORS_ORIGINS=http://localhost:5173,https://YOUR_USERNAME.github.io
```

Restart/redeploy the backend after changing it.

---

# 6. Local development

## Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
```

Load the `.env` values into your process/environment, then:

```bash
uvicorn app.main:app --reload --port 8000
```

FFmpeg and LibreOffice must be installed on the host. The included Dockerfile installs them for the Linux container.

## Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

---

# Premium key behavior

Example key:

`AMETHYST-7D-A1B2-C3D4-E5F6`

Lifecycle:

`UNUSED → redeemed once → USED forever`

A Used key cannot be reused by another account and is not restored if Premium is revoked manually in a future admin version.

The Admin Console can create 1, 5, 10, 25, 50 or 100 keys at once. The database stores only their hashes. Copy newly generated plaintext keys immediately.

---

# Media-use rule

Version 1.0.0 accepts YouTube and TikTok URLs only. The UI requires the user to affirm that they own the media or have permission to download/process it. The site operator and user remain responsible for applicable copyright law and source-platform terms.

---

# Quality note

Amethyst Studio differentiates source quality from processing targets:

- **Best available/original source** = what the platform/backend actually provides.
- **10K / 600 FPS** = server-generated scale/interpolation target.

Upscaling does not create native source detail, and interpolation does not turn the source into a truly captured 600 FPS recording.

---

# Production hardening before a large public launch

v1.0.0 already has server-side auth, quota and key enforcement, but a high-traffic commercial deployment should additionally add a dedicated queue (Redis/BullMQ/Celery/RQ), object storage, malware scanning, reverse-proxy request limits, stronger API rate limiting, GPU workers for heavy enhancement, centralized logs, backups, monitoring and a support/contact workflow.

## Version

**Amethyst Studio 1.0.0 — August 31, 2026**
