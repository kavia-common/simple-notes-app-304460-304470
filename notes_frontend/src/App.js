import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

// PUBLIC_INTERFACE
function App() {
  const API_BASE_URL = useMemo(() => {
    return process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
  }, []);

  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);

  const [isNew, setIsNew] = useState(false);

  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const selectedNote = useMemo(
    () => notes.find(n => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const titleError = useMemo(() => {
    if (!titleTouched) return '';
    if (!editorTitle.trim()) return 'Title is required.';
    return '';
  }, [editorTitle, titleTouched]);

  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data && (data.detail || data.message)) {
          detail = data.detail || data.message;
        }
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }, []);

  const loadNotes = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await fetchJson(`${API_BASE_URL}/notes`);
      setNotes(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && selectedId == null) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes');
    } finally {
      setLoadingList(false);
    }
  }, [API_BASE_URL, fetchJson, selectedId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (isNew) return;
    if (!selectedNote) {
      setEditorTitle('');
      setEditorContent('');
      setTitleTouched(false);
      return;
    }
    setEditorTitle(selectedNote.title || '');
    setEditorContent(selectedNote.content || '');
    setTitleTouched(false);
  }, [selectedNote, isNew]);

  const startNewNote = () => {
    setIsNew(true);
    setSelectedId(null);
    setEditorTitle('');
    setEditorContent('');
    setTitleTouched(false);
    setError('');
  };

  const cancelNewNote = () => {
    setIsNew(false);
    if (notes.length > 0) setSelectedId(notes[0].id);
    setError('');
  };

  const selectNote = (id) => {
    setIsNew(false);
    setSelectedId(id);
    setError('');
  };

  const saveNote = async () => {
    setTitleTouched(true);
    if (!editorTitle.trim()) return;

    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const created = await fetchJson(`${API_BASE_URL}/notes`, {
          method: 'POST',
          body: JSON.stringify({ title: editorTitle.trim(), content: editorContent })
        });
        await loadNotes();
        setIsNew(false);
        setSelectedId(created.id);
      } else if (selectedId != null) {
        await fetchJson(`${API_BASE_URL}/notes/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: editorTitle.trim(), content: editorContent })
        });
        await loadNotes();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (id == null) return;
    setDeletingId(id);
    setError('');
    try {
      await fetchJson(`${API_BASE_URL}/notes/${id}`, { method: 'DELETE' });
      const nextNotes = notes.filter(n => n.id !== id);
      setNotes(nextNotes);

      if (selectedId === id) {
        if (nextNotes.length > 0) {
          setSelectedId(nextNotes[0].id);
        } else {
          startNewNote();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="appRoot">
      <Header />
      <main className="mainLayout" aria-label="Notes workspace">
        <section className="sidebar" aria-label="Notes list">
          <div className="sidebarHeader">
            <div className="sidebarTitleBlock">
              <h2 className="sidebarTitle">Notes</h2>
              <p className="sidebarSubtitle">{loadingList ? 'Loading…' : `${notes.length} total`}</p>
            </div>
            <button className="secondaryButton" onClick={loadNotes} disabled={loadingList} type="button">
              Refresh
            </button>
          </div>

          {error ? (
            <div className="alert" role="alert">
              <div className="alertTitle">Something went wrong</div>
              <div className="alertBody">{error}</div>
            </div>
          ) : null}

          <div className="notesList" role="list">
            {loadingList ? (
              <div className="skeletonList" aria-label="Loading notes">
                <div className="skeletonItem" />
                <div className="skeletonItem" />
                <div className="skeletonItem" />
              </div>
            ) : notes.length === 0 ? (
              <div className="emptyState">
                <div className="emptyTitle">No notes yet</div>
                <div className="emptyBody">Create your first note with the “New” button.</div>
              </div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`noteRow ${selectedId === n.id && !isNew ? 'noteRowActive' : ''}`}
                  onClick={() => selectNote(n.id)}
                  role="listitem"
                >
                  <div className="noteRowTitle">{n.title}</div>
                  <div className="noteRowMeta">
                    {new Date(n.updated_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="editor" aria-label="Note editor">
          <div className="editorHeader">
            <div className="editorHeaderLeft">
              <h2 className="editorTitle">{isNew ? 'New note' : selectedNote ? 'Edit note' : 'Select a note'}</h2>
              <div className="editorSubtitle">
                {isNew
                  ? 'Draft will be saved when you click Save.'
                  : selectedNote
                    ? `Created ${new Date(selectedNote.created_at).toLocaleString()}`
                    : 'Choose a note from the list to begin.'}
              </div>
            </div>

            <div className="editorHeaderActions">
              {isNew ? (
                <button className="secondaryButton" onClick={cancelNewNote} type="button" disabled={saving}>
                  Cancel
                </button>
              ) : null}

              {!isNew && selectedNote ? (
                <button
                  className="dangerButton"
                  onClick={() => deleteNote(selectedNote.id)}
                  type="button"
                  disabled={deletingId === selectedNote.id || saving}
                >
                  {deletingId === selectedNote.id ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}

              <button
                className="primaryButton"
                onClick={saveNote}
                type="button"
                disabled={saving || (!isNew && !selectedNote)}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="editorBody">
            <label className="field">
              <div className="fieldLabel">Title</div>
              <input
                className={`textInput ${titleError ? 'textInputError' : ''}`}
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                onBlur={() => setTitleTouched(true)}
                placeholder="e.g., Meeting notes"
                disabled={!isNew && !selectedNote}
              />
              {titleError ? <div className="fieldError">{titleError}</div> : null}
            </label>

            <label className="field">
              <div className="fieldLabel">Content</div>
              <textarea
                className="textArea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Write your note here…"
                disabled={!isNew && !selectedNote}
              />
            </label>
          </div>
        </section>

        <FloatingActionButton onClick={startNewNote} />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="topHeader">
      <div className="topHeaderInner">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div>
            <div className="brandTitle">Simple Notes</div>
            <div className="brandSubtitle">Fast + clean note taking</div>
          </div>
        </div>
        <div className="headerRightHint">Backend: <span className="pill">:3001</span></div>
      </div>
    </header>
  );
}

function FloatingActionButton({ onClick }) {
  return (
    <button className="fab" type="button" onClick={onClick} aria-label="Create a new note">
      New
    </button>
  );
}

export default App;
