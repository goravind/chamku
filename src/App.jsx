import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES, INITIAL_TASKS, DEFAULT_FAMILY_MEMBERS } from './data/relocationData';
import { supabase, hasSupabase } from './lib/supabase';
import * as api from './lib/api';
import { tasksToCsv, csvToTasks } from './lib/csvBackup';
import { syncToGitHub, fetchFromGitHub } from './lib/githubBackup';
import { ChatPanel } from './components/ChatPanel';
import './App.css';

const STORAGE_KEY = 'relocation-tasks';
const STORAGE_PROFILE = 'relocation-profile';
const STORAGE_FAMILY_PHOTO = 'relocation-family-photo';
const STORAGE_CSV_BACKUP = 'relocation-csv-backup';
const STORAGE_PROGRESS_NOTES = 'relocation-progress-notes';

// Migrate legacy notes string to comments array (supports JSON or plain text)
function notesToComments(notes) {
  if (!notes || typeof notes !== 'string') return [];
  const trimmed = notes.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c) => ({
        id: c.id || `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: c.text || '',
        createdAt: c.createdAt || new Date().toISOString(),
      }));
    }
  } catch {
    // Plain text: treat as single comment
  }
  return [{ id: `c-${Date.now()}`, text: trimmed, createdAt: new Date().toISOString() }];
}

// Ensure task has full shape (subtasks, attachments, assignedTo, comments)
function normalizeTask(t) {
  const comments = t.comments && Array.isArray(t.comments) && t.comments.length > 0
    ? t.comments.map((c) => ({
        id: c.id || `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: c.text || '',
        createdAt: c.createdAt || new Date().toISOString(),
      }))
    : notesToComments(t.notes);
  return {
    ...t,
    subtasks: (t.subtasks || []).map(normalizeSubtask),
    attachments: t.attachments || [],
    assignedTo: t.assignedTo || '',
    comments,
  };
}

function normalizeSubtask(s) {
  const comments = s.comments && Array.isArray(s.comments) && s.comments.length > 0
    ? s.comments.map((c) => ({
        id: c.id || `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: c.text || '',
        createdAt: c.createdAt || new Date().toISOString(),
      }))
    : notesToComments(s.notes);
  return {
    ...s,
    comments,
  };
}

function normalizeTasks(list) {
  return list.map(normalizeTask);
}

function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeTasks(JSON.parse(saved)) : normalizeTasks(INITIAL_TASKS);
    } catch {
      return normalizeTasks(INITIAL_TASKS);
    }
  });
  const [familyMembers, setFamilyMembers] = useState(DEFAULT_FAMILY_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskCategory, setNewTaskCategory] = useState('other');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authError, setAuthError] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadSubtaskId, setUploadSubtaskId] = useState(null);
  const [chatTaskId, setChatTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('tasks'); // 'tasks' | 'dashboard'
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [settingsTab, setSettingsTab] = useState('people'); // 'people' | 'account' | 'backup' | 'photo'
  const [familyPhoto, setFamilyPhoto] = useState(() => localStorage.getItem(STORAGE_FAMILY_PHOTO) || '');
  const [progressNotes, setProgressNotes] = useState(() => localStorage.getItem(STORAGE_PROGRESS_NOTES) || '');

  const loadTasks = useCallback(async () => {
    if (hasSupabase() && user) {
      try {
        const data = await api.fetchTasks(user.id);
        const apiTasks = normalizeTasks(data || []);
        // If API returns empty but we have local data, keep local (user may have added before sign-in)
        if (apiTasks.length === 0) {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.length > 0) {
              setTasks(normalizeTasks(parsed));
              return;
            }
          }
        }
        setTasks(apiTasks);
      } catch (err) {
        console.error('Failed to load tasks:', err);
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setTasks(normalizeTasks(JSON.parse(saved)));
        } catch {}
      }
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : INITIAL_TASKS;
        setTasks(normalizeTasks(parsed));
      } catch {
        setTasks(normalizeTasks(INITIAL_TASKS));
      }
    }
  }, [user]);

  const loadProfile = useCallback(async () => {
    if (hasSupabase() && user) {
      try {
        const names = await api.fetchProfile(user.id);
        if (names?.length) setFamilyMembers(names);
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_PROFILE);
        if (saved) setFamilyMembers(JSON.parse(saved));
      } catch {}
    }
  }, [user]);

  useEffect(() => {
    if (hasSupabase()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      supabase.auth.onAuthStateChange((_e, { session }) => {
        setUser(session?.user ?? null);
      });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch from API when signed in; localStorage mode uses initial state
    if (hasSupabase() && user) {
      loadTasks();
    }
  }, [loadTasks, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Always persist to localStorage (backup + primary when not signed in)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(STORAGE_CSV_BACKUP, tasksToCsv(tasks));
    } catch (e) {
      console.error('Failed to save tasks:', e);
    }
  }, [tasks]);

  const saveTasks = useCallback(
    async (newTasks) => {
      setTasks(newTasks);
      if (!hasSupabase() || !user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
      }
    },
    [user]
  );

  const saveProfile = useCallback(
    async (members) => {
      setFamilyMembers(members);
      if (hasSupabase() && user) {
        await api.updateProfile(user.id, members);
      } else {
        localStorage.setItem(STORAGE_PROFILE, JSON.stringify(members));
      }
    },
    [user]
  );

  const categoryFilteredTasks =
    selectedCategory === 'all'
      ? tasks
      : tasks.filter((t) => t.categoryId === selectedCategory);

  // Filter by assignee: task or any subtask assigned to this person
  const filteredTasks = selectedAssignee
    ? categoryFilteredTasks.filter((t) => {
        if (t.assignedTo === selectedAssignee) return true;
        return t.subtasks?.some((s) => s.assignedTo === selectedAssignee);
      })
    : categoryFilteredTasks;

  const totalItems = tasks.reduce((acc, t) => acc + 1 + (t.subtasks?.length || 0), 0);
  const completedItems = tasks.reduce(
    (acc, t) =>
      acc + (t.completed ? 1 : 0) + (t.subtasks?.filter((s) => s.completed).length || 0),
    0
  );
  const progress = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;

  const toggleComplete = (taskId, subtaskId = null) => {
    if (subtaskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) =>
                  s.id === subtaskId ? { ...s, completed: !s.completed } : s
                ),
              }
            : t
        )
      );
      if (hasSupabase() && user) {
        const task = tasks.find((t) => t.id === taskId);
        const sub = task?.subtasks?.find((s) => s.id === subtaskId);
        if (sub && typeof sub.id === 'string' && sub.id.length > 20) {
          api.updateSubtask(subtaskId, { completed: !sub.completed });
        }
      }
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
      );
      if (hasSupabase() && user) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && typeof task.id === 'string' && task.id.length > 20) {
          api.updateTask(taskId, { completed: !task.completed });
        }
      }
    }
  };

  const deleteTask = (id) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    setEditingId(null);
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (hasSupabase() && user) {
      const task = tasks.find((t) => t.id === id);
      if (task && typeof task.id === 'string' && task.id.length > 20) {
        api.deleteTask(id);
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const updateTask = (id, updates) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setTasks(updated);
    if (hasSupabase() && user) {
      const task = tasks.find((t) => t.id === id);
      if (task && typeof task.id === 'string' && task.id.length > 20) {
        api.updateTask(id, updates);
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const updateSubtask = (taskId, subtaskId, updates) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, ...updates } : s
              ),
            }
          : t
      )
    );
    if (hasSupabase() && user) {
      const task = tasks.find((t) => t.id === taskId);
      const sub = task?.subtasks?.find((s) => s.id === subtaskId);
      if (sub && typeof sub.id === 'string' && sub.id.length > 20) {
        api.updateSubtask(subtaskId, updates);
      }
    }
  };

  const addComment = (taskId, subtaskId, text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    if (subtaskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) =>
                  s.id === subtaskId
                    ? { ...s, comments: [...(s.comments || []), comment] }
                    : s
                ),
              }
            : t
        )
      );
      if (hasSupabase() && user) {
        const task = tasks.find((t) => t.id === taskId);
        const sub = task?.subtasks?.find((s) => s.id === subtaskId);
        if (sub && typeof sub.id === 'string' && sub.id.length > 20) {
          const updated = { ...sub, comments: [...(sub.comments || []), comment] };
          api.updateSubtask(subtaskId, { notes: JSON.stringify(updated.comments) });
        }
      }
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...(t.comments || []), comment] }
            : t
        )
      );
      if (hasSupabase() && user) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && typeof task.id === 'string' && task.id.length > 20) {
          const updated = { ...task, comments: [...(task.comments || []), comment] };
          api.updateTask(taskId, { notes: JSON.stringify(updated.comments) });
        }
      }
    }
  };

  const deleteSubtask = (taskId, subtaskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t
      )
    );
    if (hasSupabase() && user) {
      const task = tasks.find((t) => t.id === taskId);
      const sub = task?.subtasks?.find((s) => s.id === subtaskId);
      if (sub && typeof sub.id === 'string' && sub.id.length > 20) {
        api.deleteSubtask(subtaskId);
      }
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: hasSupabase() && user ? `temp-${Date.now()}` : String(Date.now()),
      categoryId: newTaskCategory,
      title: newTaskTitle.trim(),
      completed: false,
      notes: '',
      dueDate: '',
      assignedTo: newTaskAssignedTo || '',
      subtasks: [],
      attachments: [],
    };

    if (hasSupabase() && user) {
      try {
        const created = await api.createTask(user.id, newTask);
        setTasks((prev) => [...prev, normalizeTask(created)]);
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    } else {
      const updated = [...tasks, normalizeTask(newTask)];
      setTasks(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    setNewTaskTitle('');
    setNewTaskCategory('other');
    setNewTaskAssignedTo('');
    setShowAddForm(false);
  };

  const addSubtask = (taskId, title) => {
    if (!title?.trim()) return;
    const task = tasks.find((t) => t.id === taskId);
    const newSub = {
      id: hasSupabase() && user ? `temp-${Date.now()}` : `${taskId}-${Date.now()}`,
      title: title.trim(),
      completed: false,
      comments: [],
      dueDate: '',
      assignedTo: '',
    };

    if (hasSupabase() && user && typeof task.id === 'string' && task.id.length > 20) {
      api.createSubtask(taskId, newSub).then((created) => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: [...t.subtasks, { ...newSub, id: created.id }] }
              : t
          )
        );
      });
    } else {
      const updated = tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSub] } : t
      );
      setTasks(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const addSubtasks = async (taskId, titles) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSubs = [];
    for (const title of titles) {
      if (!title?.trim()) continue;
      const newSub = {
        id: hasSupabase() && user ? `temp-${Date.now()}-${Math.random()}` : `${taskId}-${Date.now()}-${Math.random()}`,
        title: title.trim(),
        completed: false,
        comments: [],
        dueDate: '',
        assignedTo: '',
      };
      if (hasSupabase() && user && typeof task.id === 'string' && task.id.length > 20) {
        const created = await api.createSubtask(taskId, newSub);
        newSubs.push({ ...newSub, id: created.id });
      } else {
        newSubs.push(newSub);
      }
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, ...newSubs] } : t
      )
    );
    setExpandedTasks((prev) => new Set([...prev, taskId]));
  };

  const handleAttachment = async (taskId, subtaskId, file) => {
    if (!hasSupabase() || !user) {
      alert('Sign in to enable file attachments.');
      return;
    }
    setUploadingId(taskId);
    setUploadSubtaskId(subtaskId);
    try {
      const att = await api.uploadAttachment(user.id, taskId, subtaskId, file);
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (subtaskId) {
            return {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId
                  ? { ...s, attachments: [...(s.attachments || []), att] }
                  : s
              ),
            };
          }
          return { ...t, attachments: [...(t.attachments || []), att] };
        })
      );
    } catch (err) {
      alert('Upload failed: ' + (err.message || err));
    } finally {
      setUploadingId(null);
      setUploadSubtaskId(null);
    }
  };

  const removeAttachment = async (taskId, subtaskId, att) => {
    if (hasSupabase() && user) {
      try {
        await api.deleteAttachment(att.id, att.filePath);
      } catch (err) {
        console.error('Failed to delete attachment:', err);
      }
    }
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (subtaskId) {
          return {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === subtaskId
                ? { ...s, attachments: (s.attachments || []).filter((a) => a.id !== att.id) }
                : s
            ),
          };
        }
        return { ...t, attachments: (t.attachments || []).filter((a) => a.id !== att.id) };
      })
    );
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message || 'Sign in failed');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      setAuthEmail('');
      setAuthPassword('');
      setAuthError('Check your email to confirm your account.');
    } catch (err) {
      setAuthError(err.message || 'Sign up failed');
    }
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  const toggleExpanded = (taskId) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="header-title-row">
            {familyPhoto && (
              <img src={familyPhoto} alt="Family" className="header-family-photo" />
            )}
            <div>
              <h1>Gowri's Relocation Plan</h1>
              <p className="header-tagline">US → India</p>
            </div>
          </div>
          <div className="header-actions">
            {hasSupabase() && (
              user ? (
                <div className="user-badge">
                  <span>{user.email}</span>
                  <button className="sign-out-btn" onClick={handleSignOut}>
                    Sign out
                  </button>
                </div>
              ) : (
                <button className="auth-btn" onClick={() => setShowSettings(!showSettings)}>
                  Sign in
                </button>
              )
            )}
            <button
              className="settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
              aria-label="Settings"
            >
              <span className="settings-btn-label">Settings</span>
            </button>
          </div>
        </div>
        <p className="subtitle">
          {familyPhoto ? 'Your family move to India' : 'Track everything for your family move to India'}
        </p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="progress-text">
          {completedItems} of {totalItems} items complete ({progress}%)
        </p>
        <div className="progress-notes">
          <textarea
            value={progressNotes}
            onChange={(e) => {
              const v = e.target.value;
              setProgressNotes(v);
              localStorage.setItem(STORAGE_PROGRESS_NOTES, v);
            }}
            placeholder="Add progress notes, updates, or comments..."
            rows={2}
            className="progress-notes-input"
          />
        </div>
      </header>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-tabs">
              <button
                type="button"
                className={`settings-tab ${settingsTab === 'people' ? 'active' : ''}`}
                onClick={() => setSettingsTab('people')}
              >
                People
              </button>
              {hasSupabase() && (
                <button
                  type="button"
                  className={`settings-tab ${settingsTab === 'account' ? 'active' : ''}`}
                  onClick={() => setSettingsTab('account')}
                >
                  {user ? 'Account' : 'Sign in'}
                </button>
              )}
              <button
                type="button"
                className={`settings-tab ${settingsTab === 'backup' ? 'active' : ''}`}
                onClick={() => setSettingsTab('backup')}
              >
                Backup & CSV
              </button>
              <button
                type="button"
                className={`settings-tab ${settingsTab === 'photo' ? 'active' : ''}`}
                onClick={() => setSettingsTab('photo')}
              >
                Family Photo
              </button>
            </div>
            {settingsTab === 'people' ? (
              <PeopleSettings
                familyMembers={familyMembers}
                onAddPerson={(name) => {
                  const trimmed = name.trim();
                  if (trimmed && !familyMembers.includes(trimmed)) {
                    const updated = [...familyMembers, trimmed];
                    setFamilyMembers(updated);
                    saveProfile(updated);
                  }
                }}
                onRemovePerson={(name) => {
                  const updated = familyMembers.filter((m) => m !== name);
                  setFamilyMembers(updated);
                  saveProfile(updated);
                }}
              />
            ) : settingsTab === 'photo' ? (
              <FamilyPhotoSettings
                familyPhoto={familyPhoto}
                onPhotoChange={(dataUrl) => {
                  setFamilyPhoto(dataUrl || '');
                  if (dataUrl) {
                    localStorage.setItem(STORAGE_FAMILY_PHOTO, dataUrl);
                  } else {
                    localStorage.removeItem(STORAGE_FAMILY_PHOTO);
                  }
                }}
              />
            ) : settingsTab === 'backup' ? (
              <BackupSettings
                tasks={tasks}
                onImport={(importedTasks) => {
                  setTasks(normalizeTasks(importedTasks));
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(importedTasks));
                }}
              />
            ) : (
              <>
                {user ? (
                  <>
                    <h3>Account</h3>
                    <p className="modal-hint">Signed in as {user.email}</p>
                  </>
                ) : (
                  <>
                    <h3>Sign in for cloud sync</h3>
                    <p className="modal-hint">
                      Sign in to sync your tasks across devices and enable file attachments.
                    </p>
                    <form
                      onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp}
                      className="auth-form"
                    >
                      <input
                        type="email"
                        placeholder="Email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        required
                      />
                      {authError && <p className="auth-error">{authError}</p>}
                      <div className="auth-buttons">
                        <button type="submit">
                          {authMode === 'signin' ? 'Sign in' : 'Sign up'}
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                            setAuthError('');
                          }}
                        >
                          {authMode === 'signin' ? 'Create account' : 'Already have account?'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </>
            )}
            <button className="close-btn" onClick={() => setShowSettings(false)}>
              ×
            </button>
          </div>
        </div>
      )}

      <div className="main">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">View</div>
            <button
              className={`category-btn ${viewMode === 'tasks' ? 'active' : ''}`}
              onClick={() => setViewMode('tasks')}
            >
              📋 Tasks
            </button>
            <button
              className={`category-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
              onClick={() => setViewMode('dashboard')}
            >
              📊 Dashboard
            </button>
          </div>

          {viewMode === 'tasks' && (
            <>
              <div className="sidebar-section">
                <div className="sidebar-label">Assignee</div>
                {familyMembers.length === 0 && (
                  <p className="sidebar-hint">
                    <button
                      type="button"
                      className="link-text"
                      onClick={() => setShowSettings(true)}
                    >
                      Add people in settings
                    </button>
                  </p>
                )}
                <button
                  className={`category-btn assignee-btn ${!selectedAssignee ? 'active' : ''}`}
                  onClick={() => setSelectedAssignee('')}
                >
                  All
                </button>
                {familyMembers.map((m) => {
                  const count = tasks.filter(
                    (t) =>
                      t.assignedTo === m ||
                      t.subtasks?.some((s) => s.assignedTo === m)
                  ).length;
                  return (
                    <button
                      key={m}
                      className={`category-btn assignee-btn ${selectedAssignee === m ? 'active' : ''}`}
                      onClick={() => setSelectedAssignee(m)}
                    >
                      {m}
                      {count > 0 && <span className="cat-count">{count}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="sidebar-section">
                <div className="sidebar-label">Category</div>
                <button
                  className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{ '--cat-color': cat.color }}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    {cat.name}
                    <span className="cat-count">
                      {tasks.filter((t) => t.categoryId === cat.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="task-list">
          {viewMode === 'dashboard' ? (
            <AssigneeDashboard
              tasks={tasks}
              familyMembers={familyMembers}
              categories={CATEGORIES}
              onOpenSettings={() => setShowSettings(true)}
              onTaskClick={(taskId, assigneeName) => {
                setViewMode('tasks');
                setSelectedAssignee(assigneeName || '');
                setExpandedTasks((prev) => new Set([...prev, taskId]));
              }}
            />
          ) : (
            <>
          <div className="task-list-header">
            <h2>
              {selectedAssignee
                ? `${selectedAssignee}'s tasks`
                : selectedCategory === 'all'
                ? 'All Tasks'
                : CATEGORIES.find((c) => c.id === selectedCategory)?.name || 'Tasks'}
            </h2>
            <button
              className="add-btn"
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  if (selectedCategory !== 'all') setNewTaskCategory(selectedCategory);
                  if (selectedAssignee) setNewTaskAssignedTo(selectedAssignee);
                }
              }}
            >
              {showAddForm ? 'Cancel' : '+ Add Task'}
            </button>
          </div>

          {showAddForm && (
            <div className="add-form">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                autoFocus
              />
              {selectedCategory === 'all' ? (
                <select
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="add-form-category">
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.icon}{' '}
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.name}
                </span>
              )}
              <select
                value={newTaskAssignedTo}
                onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                title="Assign to"
              >
                <option value="">Unassigned</option>
                {familyMembers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button className="save-btn" onClick={addTask}>
                Add
              </button>
            </div>
          )}

          {chatTaskId && (() => {
            const task = tasks.find((t) => t.id === chatTaskId);
            return task ? (
              <div className="chat-overlay" onClick={() => setChatTaskId(null)}>
                <div className="chat-panel-wrapper" onClick={(e) => e.stopPropagation()}>
                  <ChatPanel
                    task={task}
                    onClose={() => setChatTaskId(null)}
                    onAddSubtasks={(titles) => addSubtasks(chatTaskId, titles)}
                  />
                </div>
              </div>
            ) : null;
          })()}

          <ul className="tasks">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                category={CATEGORIES.find((c) => c.id === task.categoryId)}
                familyMembers={familyMembers}
                isExpanded={expandedTasks.has(task.id)}
                onToggleExpanded={toggleExpanded}
                onOpenChat={() => setChatTaskId(task.id)}
                editingId={editingId}
                editingSubtaskId={editingSubtaskId}
                setEditingId={setEditingId}
                setEditingSubtaskId={setEditingSubtaskId}
                onToggleComplete={toggleComplete}
                onUpdateTask={updateTask}
                onUpdateSubtask={updateSubtask}
                onAddComment={addComment}
                onDeleteTask={deleteTask}
                onDeleteSubtask={deleteSubtask}
                onAddSubtask={addSubtask}
                onAttachment={handleAttachment}
                onRemoveAttachment={removeAttachment}
                uploadingId={uploadingId}
                uploadSubtaskId={uploadSubtaskId}
              />
            ))}
          </ul>

          {filteredTasks.length === 0 && (
            <p className="empty-state">
              {selectedAssignee
                ? `No tasks assigned to ${selectedAssignee}.`
                : selectedCategory === 'all'
                ? 'No tasks yet. Add one above!'
                : 'No tasks in this category.'}
            </p>
          )}
            </>
          )}
        </section>
      </div>

      <footer className="footer">
        <button
          className="reset-btn"
          onClick={async () => {
            if (!confirm('Reset all tasks to the default checklist?')) return;
            if (hasSupabase() && user) {
              try {
                await api.deleteAllTasks(user.id);
                for (const t of INITIAL_TASKS) {
                  const task = await api.createTask(user.id, normalizeTask(t));
                  for (const sub of t.subtasks || []) {
                    await api.createSubtask(task.id, sub);
                  }
                }
                setTasks(await api.fetchTasks(user.id));
              } catch (err) {
                console.error('Reset failed:', err);
                alert('Reset failed. Try again.');
              }
            } else {
              setTasks(normalizeTasks(INITIAL_TASKS));
            }
          }}
        >
          Reset to default checklist
        </button>
      </footer>
    </div>
  );
}

function CommentsList({ comments }) {
  if (!comments?.length) return null;
  return (
    <ul className="comments-list">
      {comments.map((c) => (
        <li key={c.id} className="comment-item">
          <p className="comment-text">{c.text}</p>
          <span className="comment-date">
            {c.createdAt ? new Date(c.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }) : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AddCommentInput({ onAdd, placeholder = 'Add a comment...' }) {
  const [text, setText] = useState('');
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const trimmed = text.trim();
    if (trimmed) {
      onAdd(trimmed);
      setText('');
    }
  };
  return (
    <form className="add-comment-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="add-comment-input"
        aria-label="Add comment"
      />
      <button type="submit" className="add-comment-btn" disabled={!text.trim()}>
        Add
      </button>
    </form>
  );
}

function TaskItem({
  task,
  category,
  familyMembers,
  isExpanded,
  onToggleExpanded,
  onOpenChat,
  editingId,
  editingSubtaskId,
  setEditingId,
  setEditingSubtaskId,
  onToggleComplete,
  onUpdateTask,
  onUpdateSubtask,
  onAddComment,
  onDeleteTask,
  onDeleteSubtask,
  onAddSubtask,
  onAttachment,
  onRemoveAttachment,
  uploadingId,
  uploadSubtaskId,
}) {
  const isEditing = editingId === task.id;
  const hasSubtasks = task.subtasks?.length > 0;
  const showSubtasks = isExpanded || hasSubtasks;

  const taskCompletedCount = task.subtasks?.filter((s) => s.completed).length || 0;
  const taskSubtaskTotal = task.subtasks?.length || 0;

  return (
    <li className={`task-item ${task.completed ? 'completed' : ''}`}>
      <div className="task-row">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggleComplete(task.id)}
          className="task-checkbox"
        />
        <div className="task-content">
          {isEditing ? (
            <div className="edit-form">
              <input
                type="text"
                defaultValue={task.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) onUpdateTask(task.id, { title: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
              />
              <div className="edit-row">
                <input
                  type="date"
                  defaultValue={task.dueDate}
                  onBlur={(e) => onUpdateTask(task.id, { dueDate: e.target.value })}
                />
                <select
                  defaultValue={task.assignedTo}
                  onChange={(e) => onUpdateTask(task.id, { assignedTo: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {familyMembers.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <label className="edit-label">Comments</label>
              <CommentsList comments={task.comments || []} />
              <AddCommentInput onAdd={(text) => onAddComment(task.id, null, text)} />
              <div className="attachments-edit">
                <label className="attach-label">
                  📎 Attach file
                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onAttachment(task.id, null, f);
                      e.target.value = '';
                    }}
                    disabled={!!uploadingId}
                  />
                </label>
                {uploadingId === task.id && !uploadSubtaskId && (
                  <span className="uploading">Uploading...</span>
                )}
                {task.attachments?.map((att) => (
                  <span key={att.id} className="attachment-tag">
                    <a
                      href={att.filePath && hasSupabase() ? api.getAttachmentUrl(att.filePath) : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => !att.filePath && e.preventDefault()}
                    >
                      {att.fileName}
                    </a>
                    <button
                      type="button"
                      className="remove-attach"
                      onClick={() => onRemoveAttachment(task.id, null, att)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="edit-done-btn"
                onClick={() => setEditingId(null)}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <span
                className="task-title"
                onClick={() => setEditingId(task.id)}
              >
                {task.title}
              </span>
              <div className="task-meta">
                {category && (
                  <span className="task-category" style={{ color: category.color }}>
                    {category.icon} {category.name}
                  </span>
                )}
                {task.dueDate && (
                  <span className="task-due">Due: {task.dueDate}</span>
                )}
                <select
                  className="task-assign-select"
                  value={task.assignedTo}
                  onChange={(e) => onUpdateTask(task.id, { assignedTo: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  title="Assign to"
                >
                  <option value="">Assign...</option>
                  {familyMembers.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {task.attachments?.length > 0 && (
                  <span className="task-attachments">📎 {task.attachments.length}</span>
                )}
              </div>
              <div className="task-comments">
                <span className="comments-label">Comments</span>
                <CommentsList comments={task.comments || []} />
                <AddCommentInput onAdd={(text) => onAddComment(task.id, null, text)} />
              </div>
            </>
          )}
        </div>
        <div className="task-actions">
          <button
            className="chat-btn"
            onClick={() => onOpenChat()}
            title="AI: Generate subtasks from prompt"
          >
            💬
          </button>
          {hasSubtasks && (
            <button
              className="expand-btn"
              onClick={() => onToggleExpanded(task.id)}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <button
            className="delete-btn"
            onClick={() => onDeleteTask(task.id)}
            title="Delete"
            aria-label="Delete task"
          >
            ×
          </button>
        </div>
      </div>

      {showSubtasks && (
        <ul className="subtasks">
          {task.subtasks?.map((sub) => (
            <SubtaskItem
              key={sub.id}
              taskId={task.id}
              subtask={sub}
              familyMembers={familyMembers}
              isEditing={editingSubtaskId === sub.id}
              onToggleComplete={() => onToggleComplete(task.id, sub.id)}
              onUpdate={(updates) => onUpdateSubtask(task.id, sub.id, updates)}
              onAddComment={(text) => onAddComment(task.id, sub.id, text)}
              onDelete={() => onDeleteSubtask(task.id, sub.id)}
              onStartEdit={() => setEditingSubtaskId(sub.id)}
              onStopEdit={() => setEditingSubtaskId(null)}
              onAttachment={(f) => onAttachment(task.id, sub.id, f)}
              onRemoveAttachment={(att) => onRemoveAttachment(task.id, sub.id, att)}
              uploading={uploadingId === task.id && uploadSubtaskId === sub.id}
            />
          ))}
          <li className="add-subtask-row">
            <input
              type="text"
              placeholder="+ Add subtask"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onAddSubtask(task.id, e.target.value.trim());
                  e.target.value = '';
                }
              }}
            />
          </li>
        </ul>
      )}

      {!hasSubtasks && (
        <div className="add-subtask-inline">
          <button
            className="add-subtask-btn"
            onClick={() => onToggleExpanded(task.id)}
          >
            + Add subtasks
          </button>
        </div>
      )}
    </li>
  );
}

function SubtaskItem({
  taskId,
  subtask,
  familyMembers,
  isEditing,
  onToggleComplete,
  onUpdate,
  onAddComment,
  onDelete,
  onStartEdit,
  onStopEdit,
  onAttachment,
  onRemoveAttachment,
  uploading,
}) {
  return (
    <li className={`subtask-item ${subtask.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={subtask.completed}
        onChange={onToggleComplete}
        className="subtask-checkbox"
      />
      <div className="subtask-content">
        {isEditing ? (
          <div className="edit-form">
            <input
              type="text"
              defaultValue={subtask.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) onUpdate({ title: v });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') onStopEdit();
              }}
              autoFocus
            />
            <div className="edit-row">
              <input
                type="date"
                defaultValue={subtask.dueDate}
                onBlur={(e) => onUpdate({ dueDate: e.target.value })}
              />
              <select
                defaultValue={subtask.assignedTo}
                onChange={(e) => onUpdate({ assignedTo: e.target.value })}
              >
                <option value="">Unassigned</option>
                {familyMembers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <label className="edit-label">Comments</label>
            <CommentsList comments={subtask.comments || []} />
            <AddCommentInput onAdd={(text) => onAddComment(text)} placeholder="Add a comment..." />
            <div className="attachments-edit">
              <label className="attach-label">
                📎 Attach
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAttachment(f);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                />
              </label>
              {uploading && <span className="uploading">Uploading...</span>}
              {subtask.attachments?.map((att) => (
                <span key={att.id} className="attachment-tag">
                  <a
                    href={att.filePath && hasSupabase() ? api.getAttachmentUrl(att.filePath) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => !att.filePath && e.preventDefault()}
                  >
                    {att.fileName}
                  </a>
                  <button
                    type="button"
                    className="remove-attach"
                    onClick={() => onRemoveAttachment(att)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              className="edit-done-btn"
              onClick={onStopEdit}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <span className="subtask-title" onClick={onStartEdit}>
              {subtask.title}
            </span>
            <div className="subtask-meta">
              {subtask.dueDate && (
                <span className="task-due">Due: {subtask.dueDate}</span>
              )}
              <select
                className="task-assign-select subtask-assign"
                value={subtask.assignedTo}
                onChange={(e) => onUpdate({ assignedTo: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                title="Assign to"
              >
                <option value="">Assign...</option>
                {familyMembers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {subtask.attachments?.length > 0 && (
                <span className="task-attachments">📎 {subtask.attachments.length}</span>
              )}
            </div>
            <div className="task-comments subtask-comments">
              <span className="comments-label">Comments</span>
              <CommentsList comments={subtask.comments || []} />
              <AddCommentInput onAdd={(text) => onAddComment(text)} placeholder="Add a comment..." />
            </div>
          </>
        )}
      </div>
      <button
        className="delete-btn subtask-delete"
        onClick={() => onDelete()}
        title="Delete subtask"
      >
        ×
      </button>
    </li>
  );
}

function BackupSettings({ tasks, onImport }) {
  const [githubRepo, setGithubRepo] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [importError, setImportError] = useState('');

  const handleExport = () => {
    const csv = tasksToCsv(tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relocation-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = csvToTasks(ev.target.result);
        if (imported.length === 0) throw new Error('No valid data in CSV');
        onImport(imported);
      } catch (err) {
        setImportError(err.message || 'Import failed');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSyncToGitHub = async () => {
    if (!githubRepo.trim() || !githubToken.trim()) {
      setSyncStatus('Enter repo and token');
      return;
    }
    setSyncStatus('Syncing...');
    try {
      await syncToGitHub(githubRepo.trim(), githubToken.trim(), tasksToCsv(tasks));
      setSyncStatus('Synced successfully');
    } catch (err) {
      setSyncStatus(`Error: ${err.message}`);
    }
  };

  const handleFetchFromGitHub = async () => {
    if (!githubRepo.trim() || !githubToken.trim()) {
      setSyncStatus('Enter repo and token');
      return;
    }
    setSyncStatus('Fetching...');
    try {
      const csv = await fetchFromGitHub(githubRepo.trim(), githubToken.trim());
      if (!csv) {
        setSyncStatus('No backup found in repo');
        return;
      }
      const imported = csvToTasks(csv);
      onImport(imported);
      setSyncStatus('Restored from GitHub');
    } catch (err) {
      setSyncStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="backup-settings">
      <h3>Backup & CSV</h3>
      <p className="modal-hint">
        Save your tasks to a CSV file, import from CSV, or sync to GitHub.
      </p>

      <div className="backup-section">
        <h4>Save to CSV</h4>
        <p className="backup-hint">
          Downloads your tasks as a CSV file. Use this to back up or move data to another device.
        </p>
        <div className="backup-buttons">
          <button type="button" className="backup-btn" onClick={handleExport}>
            Save to CSV
          </button>
          <label className="backup-btn backup-btn-secondary">
            Import from CSV
            <input type="file" accept=".csv" onChange={handleImport} hidden />
          </label>
        </div>
        {importError && <p className="backup-error">{importError}</p>}
      </div>

      <div className="backup-section">
        <h4>Sync to GitHub</h4>
        <p className="backup-hint">
          Uploads backup to <code>backup/relocation-tasks.csv</code> in your repo.
        </p>
        <input
          type="text"
          placeholder="owner/repo (e.g. username/relocation)"
          value={githubRepo}
          onChange={(e) => setGithubRepo(e.target.value)}
          className="backup-input"
        />
        <input
          type="password"
          placeholder="GitHub personal access token"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          className="backup-input"
        />
        <div className="backup-buttons">
          <button type="button" className="backup-btn" onClick={handleSyncToGitHub}>
            Sync to GitHub
          </button>
          <button type="button" className="backup-btn backup-btn-secondary" onClick={handleFetchFromGitHub}>
            Restore from GitHub
          </button>
        </div>
        {syncStatus && <p className="backup-status">{syncStatus}</p>}
      </div>
    </div>
  );
}

function FamilyPhotoSettings({ familyPhoto, onPhotoChange }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onPhotoChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemove = () => onPhotoChange('');

  // File input in portal at body level - avoids modal stacking/click issues
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      id="family-photo-file-input"
      style={{
        position: 'fixed',
        left: -9999,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0,
      }}
      aria-hidden
    />
  );

  return (
    <div className="family-photo-settings">
      {createPortal(fileInput, document.body)}
      <h3>Family Photo</h3>
      <p className="modal-hint">
        Add a family photo to show in the header. It&apos;s stored locally on this device.
      </p>
      {familyPhoto ? (
        <div
          className="family-photo-preview"
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file?.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = () => onPhotoChange(reader.result);
              reader.readAsDataURL(file);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <img src={familyPhoto} alt="Family" />
          <div className="family-photo-actions">
            <button
              type="button"
              className="family-photo-label-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Change photo
            </button>
            <button type="button" className="remove-btn" onClick={handleRemove}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className="family-photo-upload"
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file?.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = () => onPhotoChange(reader.result);
              reader.readAsDataURL(file);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="family-photo-label-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose a photo
          </button>
          <p className="family-photo-drop-hint">or drag and drop an image here</p>
        </div>
      )}
    </div>
  );
}

function PeopleSettings({ familyMembers, onAddPerson, onRemovePerson }) {
  const [newPersonName, setNewPersonName] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (newPersonName.trim()) {
      onAddPerson(newPersonName);
      setNewPersonName('');
    }
  };

  return (
    <div className="people-settings">
      <h3>People</h3>
      <p className="modal-hint">
        Add people who can be assigned to tasks. Each person appears in the assignee dropdown.
      </p>

      <ul className="people-list">
        {familyMembers.map((name) => (
          <li key={name} className="people-list-item">
            <span className="people-name">{name}</span>
            <button
              type="button"
              className="people-remove-btn"
              onClick={() => onRemovePerson(name)}
              title={`Remove ${name}`}
              aria-label={`Remove ${name}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {familyMembers.length === 0 && (
        <p className="people-empty">No people yet. Add someone below.</p>
      )}

      <form className="people-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={newPersonName}
          onChange={(e) => setNewPersonName(e.target.value)}
          placeholder="Enter name"
          aria-label="New person name"
        />
        <button type="submit" disabled={!newPersonName.trim()}>
          Add person
        </button>
      </form>
    </div>
  );
}

function AssigneeDashboard({ tasks, familyMembers, categories, onTaskClick, onOpenSettings }) {
  if (familyMembers.length === 0) {
    return (
      <div className="dashboard dashboard-empty">
        <h2 className="dashboard-title">Assignee Dashboard</h2>
        <p className="dashboard-empty-msg">
          Add people in settings to see their tasks here.
        </p>
        <button type="button" className="add-btn" onClick={onOpenSettings}>
          Open settings
        </button>
      </div>
    );
  }

  const assigneeStats = familyMembers.map((name) => {
    const taskItems = [];
    tasks.forEach((t) => {
      const taskAssigned = t.assignedTo === name;
      const subAssigned = t.subtasks?.filter((s) => s.assignedTo === name) || [];
      if (taskAssigned) taskItems.push({ type: 'task', task: t, item: t });
      subAssigned.forEach((s) =>
        taskItems.push({ type: 'subtask', task: t, item: s })
      );
    });
    const total = taskItems.length;
    const completed = taskItems.filter(
      (i) => (i.type === 'task' ? i.item.completed : i.item.completed)
    ).length;
    return { name, taskItems, total, completed };
  });

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Assignee Dashboard</h2>
      <div className="dashboard-cards">
        {assigneeStats.map(({ name, taskItems, total, completed }) => (
          <div key={name} className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>{name}</h3>
              <div className="dashboard-stats">
                <span className="stat-done">{completed}</span>
                <span className="stat-sep">/</span>
                <span className="stat-total">{total}</span>
                <span className="stat-label">tasks</span>
              </div>
            </div>
            <ul className="dashboard-task-list">
              {taskItems.slice(0, 10).map(({ type, task, item }) => (
                <li
                  key={type === 'task' ? task.id : `${task.id}-${item.id}`}
                  className={`dashboard-task-item ${item.completed ? 'completed' : ''}`}
                  onClick={() => onTaskClick(task.id, name)}
                >
                  {type === 'subtask' && <span className="sub-prefix">↳ </span>}
                  {item.title}
                </li>
              ))}
              {taskItems.length > 10 && (
                <li className="dashboard-more">
                  +{taskItems.length - 10} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
