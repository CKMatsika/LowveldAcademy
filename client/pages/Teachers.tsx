import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
}

interface Subject { id: number; name: string }

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", subject: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", phone: "", subject: "" });
  const [classes, setClasses] = useState<{ id: number; name: string; description?: string }[]>([]);
  const [assigned, setAssigned] = useState<Record<number, { id: number; name: string; description?: string }[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<Record<number, Subject[]>>({});

  async function fetchTeachers() {
    try {
      setLoading(true);
      const [rows, allClasses, subs] = await Promise.all([
        apiFetch<Teacher[]>("/api/teachers"),
        apiFetch<{ id: number; name: string; description?: string }[]>("/api/classes"),
        apiFetch<Subject[]>("/api/subjects"),
      ]);
      setTeachers(rows);
      setClasses(allClasses);
      setSubjects(subs);
      // Load assignments for each teacher in parallel (small scale assumption)
      const entries = await Promise.all(
        rows.map(async (t) => {
          const cls = await apiFetch<{ id: number; name: string; description?: string }[]>(`/api/teachers/${t.id}/classes`);
          return [t.id, cls] as const;
        })
      );
      setAssigned(Object.fromEntries(entries));

      // Load subjects per teacher
      const subjEntries = await Promise.all(
        rows.map(async (t) => {
          const list = await apiFetch<Subject[]>(`/api/teachers/${t.id}/subjects`);
          return [t.id, list] as const;
        })
      );
      setTeacherSubjects(Object.fromEntries(subjEntries));
    } catch (e: any) {
      setError(e.message || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }
  async function startEdit(t: Teacher) {
    setEditingId(t.id);
    setEditForm({
      first_name: t.first_name || "",
      last_name: t.last_name || "",
      email: t.email || "",
      phone: t.phone || "",
      subject: t.subject || "",
    });
  }

  async function saveEdit(id: number) {
    try {
      setLoading(true);
      const updated = await apiFetch<Teacher>(`/api/teachers/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || undefined,
          phone: editForm.phone || undefined,
          subject: editForm.subject || undefined,
        }),
      });
      setTeachers((prev) => prev.map((x) => (x.id === id ? updated : x)));
      setEditingId(null);
      setError(null);
    } catch (e: any) {
      try {
        const o = JSON.parse(e.message);
        setError(o.error || "Failed to update teacher");
      } catch {
        setError(e.message || "Failed to update teacher");
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteTeacher(id: number) {
    const ok = typeof window !== "undefined" ? window.confirm("Delete this teacher?") : true;
    if (!ok) return;
    try {
      setLoading(true);
      await apiFetch(`/api/teachers/${id}`, { method: "DELETE" });
      setTeachers((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to delete teacher");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function addTeacher() {
    if (!form.first_name || !form.last_name) {
      setError("First and last name are required");
      return;
    }
    try {
      setLoading(true);
      const t = await apiFetch<Teacher>("/api/teachers", {
        method: "POST",
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          subject: form.subject || undefined,
        }),
      });
      setTeachers((prev) => [t, ...prev]);
      setForm({ first_name: "", last_name: "", email: "", phone: "", subject: "" });
      setError(null);
    } catch (e: any) {
      try {
        const o = JSON.parse(e.message);
        setError(o.error || "Failed to add teacher");
      } catch {
        setError(e.message || "Failed to add teacher");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Teachers</h1>
        <Button variant="outline" size="sm" onClick={fetchTeachers} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card className="mb-3">
        <CardHeader>
          <CardTitle className="text-base">Add Teacher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="First name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Last name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Email (optional)"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Subject (optional)"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button onClick={addTeacher} disabled={loading}>Save</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading && teachers.length === 0 && (
          <div className="text-sm text-muted-foreground">Loading teachers…</div>
        )}
        {teachers.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 space-y-2">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      placeholder="First name"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      placeholder="Last name"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      placeholder="Email (optional)"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      placeholder="Phone (optional)"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      placeholder="Subject (optional)"
                      value={editForm.subject}
                      onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => saveEdit(t.id)} disabled={loading}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={loading}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.first_name} {t.last_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.subject ? `${t.subject} • ` : ""}{t.email || "No email"}{t.phone ? ` • ${t.phone}` : ""}
                    </div>
                    {/* Assigned classes */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(assigned[t.id] || []).map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent">
                          {c.name}
                          <button
                            aria-label="Remove"
                            className="text-red-600"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/teachers/${t.id}/classes/${c.id}`, { method: "DELETE" });
                                setAssigned((prev) => ({
                                  ...prev,
                                  [t.id]: (prev[t.id] || []).filter((x) => x.id !== c.id),
                                }));
                              } catch (e: any) {
                                setError(e.message || "Failed to unassign class");
                              }
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {/* Assign new class */}
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="border rounded-md px-2 py-1 text-sm bg-background"
                        defaultValue=""
                        onChange={async (e) => {
                          const classId = Number(e.target.value);
                          if (!classId) return;
                          try {
                            const created = await apiFetch<{ id: number; name: string; description?: string }>(
                              `/api/teachers/${t.id}/classes`,
                              { method: "POST", body: JSON.stringify({ class_id: classId }) }
                            );
                            setAssigned((prev) => ({
                              ...prev,
                              [t.id]: [created, ...(prev[t.id] || [])],
                            }));
                            e.currentTarget.value = "";
                          } catch (e: any) {
                            setError(e.message || "Failed to assign class");
                          }
                        }}
                      >
                        <option value="">Assign to class…</option>
                        {classes
                          .filter((c) => !(assigned[t.id] || []).some((a) => a.id === c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </div>

                    {/* Subjects taught */}
                    <div className="mt-3">
                      <div className="text-sm font-medium">Subjects Taught</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(teacherSubjects[t.id] || []).map((s) => (
                          <span key={`${t.id}-${s.id}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border">
                            {s.name}
                            <button
                              aria-label="Remove subject"
                              className="text-red-600"
                              onClick={async () => {
                                try {
                                  await apiFetch(`/api/teachers/${t.id}/subjects/${s.id}`, { method: "DELETE" });
                                  setTeacherSubjects((prev) => ({ ...prev, [t.id]: (prev[t.id] || []).filter((x) => x.id !== s.id) }));
                                } catch (e: any) {
                                  setError(e.message || "Failed to remove subject");
                                }
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {(teacherSubjects[t.id] || []).length === 0 && (
                          <span className="text-xs text-muted-foreground">No subjects linked</span>
                        )}
                      </div>
                      <div className="mt-2">
                        <select
                          className="border rounded-md px-2 py-1 text-sm bg-background"
                          defaultValue=""
                          onChange={async (e) => {
                            const sid = Number(e.target.value);
                            if (!sid) return;
                            try {
                              const added = await apiFetch<Subject>(`/api/teachers/${t.id}/subjects`, { method: "POST", body: JSON.stringify({ subject_id: sid }) });
                              setTeacherSubjects((prev) => ({ ...prev, [t.id]: [ ...(prev[t.id] || []), added ] }));
                              e.currentTarget.value = "";
                            } catch (e: any) {
                              setError(e.message || "Failed to add subject");
                            }
                          }}
                        >
                          <option value="">Add Subject…</option>
                          {subjects.filter(s => !(teacherSubjects[t.id] || []).some(x => x.id === s.id)).map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(t)} disabled={loading}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteTeacher(t.id)} disabled={loading}>Delete</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
