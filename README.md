# Schueco Black — Lead Registration System (LRS)

A secure, real-time lead tracking tool for the Schueco Black Private Home program.

---

## What this does

- Every inquiry is registered once with one Schueco person, one fabricator, one architect
- Instant duplicate detection — if anyone tries to register the same client + project, they see who already owns it
- Real-time sync — if Yashpal registers an inquiry, Sachin sees it instantly without refreshing
- Login protected — only your team can access it

---

## Setup Guide (one-time, ~30 minutes)

### Step 1 — Create a Supabase account

1. Go to https://supabase.com and click "Start your project"
2. Sign up with Google or email
3. Click "New project"
4. Name it `schueco-lrs`
5. Set a strong database password (save it somewhere safe)
6. Choose region: **Southeast Asia (Singapore)** — closest to India
7. Wait ~2 minutes for the project to be ready

### Step 2 — Set up the database

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Open the file `schema.sql` from this project folder
4. Copy everything and paste it into the SQL editor
5. Click **Run**
6. You should see "Success" — your tables are created

### Step 3 — Get your API keys

1. In Supabase, go to **Settings → API** (left sidebar)
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`)
3. Copy the **anon public** key (long string starting with `eyJ...`)
4. Keep these ready for Step 5

### Step 4 — Create user accounts for your team

1. In Supabase, go to **Authentication → Users** (left sidebar)
2. Click "Invite user" or "Add user"
3. Enter each team member's email and a temporary password
4. Repeat for everyone who needs access (Yashpal, Sachin, etc.)
5. They can change their password after first login

> Important: There is NO self-signup. Only you can create accounts here.

### Step 5 — Set up the project locally

Make sure you have **Node.js** installed (https://nodejs.org — download the LTS version).

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
# 1. Go into the project folder
cd path/to/schueco-lrs

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
```

Now open `.env` in any text editor (Notepad works) and replace the placeholder values:

```
VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

### Step 6 — Test it locally

```bash
npm run dev
```

Open http://localhost:5173 in your browser. You should see the login screen.
Log in with one of the accounts you created in Step 4.

### Step 7 — Deploy to Vercel (go live)

1. Create a free account at https://github.com and upload this project folder
   (GitHub Desktop app makes this easy: https://desktop.github.com)

2. Create a free account at https://vercel.com

3. In Vercel, click "Add New Project" → select your GitHub repo

4. Before deploying, click "Environment Variables" and add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

5. Click "Deploy" — Vercel will build and host it

6. You'll get a URL like `schueco-lrs.vercel.app` — share this with your team

---

## Daily use

**Register an inquiry:** Click "New Inquiry" → fill in client name + project name → assign Schueco person, fabricator, architect → Register.

**Check for duplicates:** The system automatically checks as you submit. If it already exists, it shows who registered it, when, and who's assigned.

**Update status:** On the Dashboard, click the status badge on any row to change it (New → Quoted → Won → Lost).

**Add people:** Go to "Manage People" to add fabricators, architects, or Schueco team members.

---

## Need help?

If anything breaks:
- Supabase dashboard: check **Table Editor** to see if data is there
- Vercel dashboard: check **Deployments** to see if it built successfully
- For the env variables: they must be set in Vercel dashboard, not just the local `.env` file
