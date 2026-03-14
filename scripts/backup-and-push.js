#!/usr/bin/env node
/**
 * Backup tasks to CSV and push to git.
 * Uses INITIAL_TASKS or reads from backup/relocation-tasks.json if it exists.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tasksToCsv } from '../src/lib/csvBackup.js';
import { INITIAL_TASKS } from '../src/data/relocationData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BACKUP_JSON = join(ROOT, 'backup', 'relocation-tasks.json');
const BACKUP_CSV = join(ROOT, 'backup', 'relocation-tasks.csv');

function normalizeTask(t) {
  const comments = t.comments && Array.isArray(t.comments) ? t.comments : [];
  return {
    ...t,
    subtasks: (t.subtasks || []).map(normalizeTask),
    attachments: t.attachments || [],
    assignedTo: t.assignedTo || '',
    comments,
  };
}

let tasks;
if (existsSync(BACKUP_JSON)) {
  const raw = JSON.parse(readFileSync(BACKUP_JSON, 'utf8'));
  tasks = raw.map(normalizeTask);
  console.log('Loaded tasks from backup/relocation-tasks.json');
} else {
  tasks = INITIAL_TASKS.map(normalizeTask);
  console.log('Using default INITIAL_TASKS (export from app to backup/relocation-tasks.json for your data)');
}

const csv = tasksToCsv(tasks);
writeFileSync(BACKUP_CSV, csv, 'utf8');
console.log('Wrote backup/relocation-tasks.csv');
