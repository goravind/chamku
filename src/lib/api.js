import { supabase, hasSupabase } from './supabase';

// Normalize task from DB to app format (notes may be JSON comments)
function dbTaskToApp(dbTask, subtasks = [], attachments = []) {
  return {
    id: dbTask.id,
    categoryId: dbTask.category_id,
    title: dbTask.title,
    completed: dbTask.completed,
    notes: dbTask.notes || '',
    dueDate: dbTask.due_date || '',
    assignedTo: dbTask.assigned_to || '',
    subtasks: subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      completed: s.completed,
      notes: s.notes || '',
      dueDate: s.due_date || '',
      assignedTo: s.assigned_to || '',
      attachments: [],
    })),
    attachments: attachments.map((a) => ({
      id: a.id,
      filePath: a.file_path,
      fileName: a.file_name,
      fileSize: a.file_size,
    })),
  };
}

// Convert app task to DB format
function appTaskToDb(task) {
  const notes = task.comments?.length
    ? JSON.stringify(task.comments)
    : (task.notes || '');
  return {
    category_id: task.categoryId,
    title: task.title,
    completed: task.completed,
    notes,
    due_date: task.dueDate || null,
    assigned_to: task.assignedTo || '',
  };
}

export async function fetchTasks(userId) {
  if (!hasSupabase() || !userId) return null;

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) throw error;
  if (!tasks?.length) return [];

  const taskIds = tasks.map((t) => t.id);

  const [subtasksRes, attachmentsRes] = await Promise.all([
    supabase.from('subtasks').select('*').in('task_id', taskIds).order('position'),
    supabase.from('attachments').select('*').in('task_id', taskIds),
  ]);

  const subtasksByTask = {};
  const allSubtasks = subtasksRes.data || [];
  allSubtasks.forEach((s) => {
    if (!subtasksByTask[s.task_id]) subtasksByTask[s.task_id] = [];
    subtasksByTask[s.task_id].push(s);
  });

  const subtaskIds = allSubtasks.map((s) => s.id);
  const { data: subtaskAttachments } = subtaskIds.length
    ? await supabase.from('attachments').select('*').in('subtask_id', subtaskIds)
    : { data: [] };

  const attachmentsByTask = {};
  const attachmentsBySubtask = {};
  (attachmentsRes.data || []).forEach((a) => {
    if (a.task_id && !a.subtask_id) {
      if (!attachmentsByTask[a.task_id]) attachmentsByTask[a.task_id] = [];
      attachmentsByTask[a.task_id].push(a);
    }
  });
  (subtaskAttachments || []).forEach((a) => {
    if (a.subtask_id) {
      if (!attachmentsBySubtask[a.subtask_id]) attachmentsBySubtask[a.subtask_id] = [];
      attachmentsBySubtask[a.subtask_id].push(a);
    }
  });

  return tasks.map((t) => {
    const subs = (subtasksByTask[t.id] || []).map((s) => ({
      id: s.id,
      title: s.title,
      completed: s.completed,
      notes: s.notes || '',
      dueDate: s.due_date || '',
      assignedTo: s.assigned_to || '',
      attachments: (attachmentsBySubtask[s.id] || []).map((a) => ({
        id: a.id,
        filePath: a.file_path,
        fileName: a.file_name,
        fileSize: a.file_size,
      })),
    }));
    return dbTaskToApp(t, subs, attachmentsByTask[t.id] || []);
  });
}

export async function createTask(userId, task) {
  if (!hasSupabase() || !userId) return null;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      ...appTaskToDb(task),
    })
    .select()
    .single();

  if (error) throw error;
  return dbTaskToApp(data, [], []);
}

export async function updateTask(taskId, updates) {
  if (!hasSupabase()) return null;

  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
  if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;

  const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId) {
  if (!hasSupabase()) return null;
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function deleteAllTasks(userId) {
  if (!hasSupabase() || !userId) return null;
  const { error } = await supabase.from('tasks').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function createSubtask(taskId, subtask) {
  if (!hasSupabase()) return null;

  const notesVal = subtask.comments?.length
    ? JSON.stringify(subtask.comments)
    : (subtask.notes || '');
  const { data, error } = await supabase
    .from('subtasks')
    .insert({
      task_id: taskId,
      title: subtask.title,
      completed: subtask.completed ?? false,
      notes: notesVal,
      due_date: subtask.dueDate || null,
      assigned_to: subtask.assignedTo || '',
    })
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, ...subtask, id: data.id };
}

export async function updateSubtask(subtaskId, updates) {
  if (!hasSupabase()) return null;

  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
  if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;

  const { error } = await supabase.from('subtasks').update(dbUpdates).eq('id', subtaskId);
  if (error) throw error;
}

export async function deleteSubtask(subtaskId) {
  if (!hasSupabase()) return null;
  const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId);
  if (error) throw error;
}

export async function uploadAttachment(userId, taskId, subtaskId, file) {
  if (!hasSupabase() || !userId) return null;

  const ext = file.name.split('.').pop();
  const path = `${userId}/${taskId}/${subtaskId || 'task'}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      task_id: subtaskId ? taskId : taskId,
      subtask_id: subtaskId || null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
    })
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, filePath: path, fileName: file.name, fileSize: file.size };
}

export async function deleteAttachment(attachmentId, filePath) {
  if (!hasSupabase()) return null;

  await supabase.storage.from('attachments').remove([filePath]);
  const { error } = await supabase.from('attachments').delete().eq('id', attachmentId);
  if (error) throw error;
}

export function getAttachmentUrl(filePath) {
  if (!hasSupabase()) return null;
  const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function fetchProfile(userId) {
  if (!hasSupabase() || !userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('family_member_names')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.family_member_names || null;
}

export async function updateProfile(userId, familyMemberNames) {
  if (!hasSupabase() || !userId) return null;

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, family_member_names: familyMemberNames, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (error) throw error;
}
