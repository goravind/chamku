# chamku – US → India Relocation Tracker

A web app to track all the tasks you need to complete when relocating your family from the US to India.

## Features

- **Pre-populated checklist** – 42 common relocation tasks across 10 categories
- **Subtasks** – Break big tasks into smaller steps (e.g., OCI application has 3 subtasks)
- **Comments** – Add multiple comments to any task or subtask
- **File attachments** – Attach documents to tasks/subtasks (requires sign-in)
- **Assignments** – Assign tasks and subtasks to family members (Me, Spouse, Child 1, etc.)
- **AI chat** – Click 💬 on any task to generate subtasks from prompts (OpenAI) or type a list manually
- **Cloud sync** – Sign in with Supabase to sync across devices and enable attachments
- **Categories** – Visa, Housing, Finances, Shipping, Employment, Healthcare, Utilities, Documents, Family
- **Progress tracking** – Visual progress bar, completion count, and progress notes
- **Reset option** – Restore the default checklist if needed

## Run the app

```bash
npm install   # if you haven't already
npm run dev   # start development server
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Cloud sync (optional)

To enable sign-in and sync across devices:

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env` and add your Supabase URL and anon key
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor
4. Create a storage bucket named `attachments` (Public) in Supabase Dashboard > Storage
5. Add storage policies so users can upload/read/delete their own files (see `supabase/schema.sql`)

Without Supabase, the app works offline with localStorage (no attachments, no cross-device sync).

### AI subtask generation (optional)

Add `VITE_OPENAI_API_KEY` to `.env` for AI-generated subtasks. Without it, you can still type a list (one per line or comma-separated) and the chat will parse it.

### CSV backup & GitHub sync

- **Settings → Backup & CSV**: Save to CSV, import from CSV, or sync to GitHub
- CSV is auto-saved to localStorage whenever tasks change
- **Sync to GitHub**: Create a [personal access token](https://github.com/settings/tokens) with `repo` scope, enter `owner/repo` and token. Backups go to `backup/relocation-tasks.csv`

## Build for production

```bash
npm run build
npm run preview   # preview the production build
```

The built files will be in the `dist/` folder—you can deploy them to any static hosting (Vercel, Netlify, GitHub Pages, etc.) or run locally.
