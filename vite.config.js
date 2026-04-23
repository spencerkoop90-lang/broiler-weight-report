# Broiler Flock Weigh Report

Interactive broiler chicken weight analysis tool with Ross 308 benchmarking.

## Deploy to Vercel

### Option A: GitHub (recommended)

1. Create a new repo on GitHub
2. Push this folder:
   ```bash
   cd broiler-weigh-report
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/broiler-weigh-report.git
   git push -u origin main
   ```
3. Go to [vercel.com](https://vercel.com), click **Add New Project**
4. Import your GitHub repo
5. Vercel auto-detects Vite — just click **Deploy**

### Option B: Vercel CLI

```bash
npm install -g vercel
cd broiler-weigh-report
npm install
vercel
```

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

## How It Works

- Upload scale CSV files (supports both standard and United Agri formats)
- Set placement dates per barn — flock age is auto-calculated
- Benchmarks against Ross 308 (Aviagen 2022, as-hatched)
- Day 1 = placement day (Aviagen Day 0)
- Print button triggers compact layout + browser print dialog

## Ross 308 Source

Aviagen, Ross 308/308 FF Broiler Performance Objectives 2022 (as-hatched table).
