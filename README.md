# CatalogIQ

AI visibility audit tool for promotional products distributors. Enter a company name, select a category — the app runs a real GPT-4o query simulating a corporate buyer and uses Claude to diagnose exactly why the company didn't appear.

---

## 1. Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **Vercel CLI** — `npm install -g vercel`
- **OpenAI API key** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Anthropic API key** — [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

---

## 2. Local Development

```bash
# Clone or download the project
cd catalogiq

# Install dependencies for the serverless function
npm init -y
npm install openai @anthropic-ai/sdk

# Create your local .env file (never commit this)
cp .env.example .env
# Edit .env and add your real API keys

# Start local dev server (runs the serverless function locally)
npx vercel dev
```

The site will be available at `http://localhost:3000`. The `/api/audit` endpoint runs as a real serverless function using your `.env` file.

---

## 3. Deploy to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial CatalogIQ build"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/catalogiq.git
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** and select your `catalogiq` repo
3. Vercel will auto-detect the project settings from `vercel.json`

### Step 3 — Add Environment Variables

In the Vercel project settings before deploying:

1. Go to **Settings → Environment Variables**
2. Add `OPENAI_API_KEY` → paste your OpenAI key
3. Add `ANTHROPIC_API_KEY` → paste your Anthropic key
4. Set scope to **Production, Preview, Development** for both

### Step 4 — Deploy

Click **Deploy**. Vercel builds and deploys in ~30 seconds. Your live URL will be something like `catalogiq.vercel.app`.

---

## 4. Connect a Custom Domain

1. In your Vercel project, go to **Settings → Domains**
2. Add your domain (e.g. `catalogiq.co`)
3. In your domain registrar's DNS settings, add:
   - **A record**: `@` → `76.76.21.21`
   - **CNAME**: `www` → `cname.vercel-dns.com`
4. Vercel auto-provisions SSL within a few minutes

---

## 5. Connect Form Submissions (Formspree)

When a user clicks "Get My Detailed Audit" or "Book a Free 15-Min Call" and submits the modal form, submissions currently log to the browser console. To route them to your email:

1. Create a free account at [formspree.io](https://formspree.io)
2. Create a new form — copy the form ID (looks like `xabcdefg`)
3. Open `index.html` and find the `submitModal()` function
4. Replace the TODO comment block with:

```javascript
fetch('https://formspree.io/f/YOUR_FORM_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name, email, site,
    type: isPaid ? 'paid' : 'free',
    company: currentCompany
  })
});
```

Formspree will email you every submission and lets you export to CSV.

---

## 6. Testing Checklist

Run these three test cases after deployment to verify everything works end-to-end:

### Test 1 — Found-but-weak state (yellow banner)
- Company: `Crestline`
- Category: Drinkware
- Expected: Yellow warning banner ("appeared — but without product listings"), Crestline highlighted in yellow in the ChatGPT response text, competitor cards showing other companies

### Test 2 — Not found state (red banner)
- Company: `Acme Promotional Goods`
- Category: Apparel
- Expected: Red banner ("was not mentioned"), not-found chip at bottom of left panel, gap reason naming a specific competitor

### Test 3 — Error handling
- Temporarily remove one API key from Vercel environment variables
- Expected: Input form reappears with a friendly error message, no raw error or API key exposed in the UI
