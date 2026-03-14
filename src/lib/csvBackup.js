/**
 * CSV backup format: one row per task, one row per subtask
 * Columns: type, id, parent_id, category_id, title, completed, notes, due_date, assigned_to
 */

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val).replace(/\r?\n/g, ' '); // flatten newlines for CSV safety
  if (s.includes(',') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function tasksToCsv(tasks) {
  const headers = [
    'type',
    'id',
    'parent_id',
    'category_id',
    'title',
    'completed',
    'notes',
    'due_date',
    'assigned_to',
  ];
  const rows = [headers.join(',')];

  for (const t of tasks) {
    const notesVal = t.comments?.length ? JSON.stringify(t.comments) : (t.notes || '');
    rows.push(
      [
        'task',
        t.id,
        '',
        t.categoryId,
        t.title,
        t.completed ? '1' : '0',
        notesVal,
        t.dueDate || '',
        t.assignedTo || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
    for (const s of t.subtasks || []) {
      const subNotesVal = s.comments?.length ? JSON.stringify(s.comments) : (s.notes || '');
      rows.push(
        [
          'subtask',
          s.id,
          t.id,
          '',
          s.title,
          s.completed ? '1' : '0',
          subNotesVal,
          s.dueDate || '',
          s.assignedTo || '',
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
  }

  return rows.join('\n');
}

function unescapeCsv(val) {
  if (!val) return '';
  if (val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1).replace(/""/g, '"');
  }
  return val;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === ',' && !inQuotes) || c === '\n') {
      result.push(unescapeCsv(current.trim()));
      current = '';
      if (c === '\n') break;
    } else {
      current += c;
    }
  }
  result.push(unescapeCsv(current.trim()));
  return result;
}

export function csvToTasks(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const tasks = [];
  const taskMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const [type, id, parentId, categoryId, title, completed, notes, dueDate, assignedTo] =
      cols;

    if (type === 'task') {
      const task = {
        id: id || `task-${Date.now()}-${i}`,
        categoryId: categoryId || 'other',
        title: title || 'Untitled',
        completed: completed === '1',
        notes: notes || '',
        dueDate: dueDate || '',
        assignedTo: assignedTo || '',
        subtasks: [],
        attachments: [],
      };
      tasks.push(task);
      taskMap.set(task.id, task);
    } else if (type === 'subtask' && parentId) {
      const parent = taskMap.get(parentId);
      if (parent) {
        parent.subtasks.push({
          id: id || `sub-${Date.now()}-${i}`,
          title: title || 'Untitled',
          completed: completed === '1',
          notes: notes || '',
          dueDate: dueDate || '',
          assignedTo: assignedTo || '',
        });
      }
    }
  }

  return tasks;
}
