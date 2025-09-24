import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ClassItem {
  id: number;
  name: string;
  description?: string;
}

interface StreamItem {
  id: number;
  class_id: number;
  name: string;
}

interface SubjectItem { id: number; name: string }

export default function Classes() {
  const { role } = useRole();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [form, setForm] = useState({ name: "", subject: "", streams: "" });
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [newStream, setNewStream] = useState<Record<number, string>>({});
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<number, SubjectItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "Admin";
  const isTeacher = role === "Teacher";

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [cls, str, subs] = await Promise.all([
          apiFetch<ClassItem[]>("/api/classes"),
          apiFetch<StreamItem[]>("/api/class-streams"),
          apiFetch<SubjectItem[]>("/api/subjects"),
        ]);
        setClasses(cls);
        setStreams(str);
        setSubjects(subs);
        // fetch class-subjects for each class
        const mapping: Record<number, SubjectItem[]> = {};
        for (const c of cls) {
          mapping[c.id] = await apiFetch<SubjectItem[]>(`/api/classes/${c.id}/subjects`);
        }
        setClassSubjects(mapping);
      } catch (e: any) {
        setError(e.message || "Failed to load classes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold mb-2">Classes</h1>

      {isAdmin && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle className="text-base">Create / Manage Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Class Name (e.g., Grade 7 - A)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Initial Streams (comma separated, e.g., A,B or Yellow,Green)"
              value={form.streams}
              onChange={(e) => setForm({ ...form, streams: e.target.value })}
            />
            <Button
              onClick={async () => {
                if (!form.name) return;
                try {
                  setLoading(true);
                  const created = await apiFetch<ClassItem>("/api/classes", {
                    method: "POST",
                    body: JSON.stringify({ name: form.name, description: form.subject || null }),
                  });
                  setClasses((prev) => [created, ...prev]);
                  // create initial streams if provided
                  const items = (form.streams || "").split(",").map(s => s.trim()).filter(Boolean);
                  for (const s of items) {
                    try { await apiFetch<StreamItem>("/api/class-streams", { method: "POST", body: JSON.stringify({ class_id: created.id, name: s }) }); } catch {}
                  }
                  if (items.length) {
                    const newStr = await apiFetch<StreamItem[]>("/api/class-streams");
                    setStreams(newStr);
                  }
                  setForm({ name: "", subject: "", streams: "" });
                } catch (e: any) {
                  setError(e.message || "Failed to create class");
                } finally {
                  setLoading(false);
                }
              }}
            >
              Create Class
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </CardContent>
        </Card>
      )}

      {loading && classes.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading classes…</div>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {c.name}
                  {c.description ? ` • ${c.description}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(isAdmin || isTeacher) && (
                  <div className="text-xs text-muted-foreground">
                    Class ID: {c.id}
                  </div>
                )}

                {/* Streams for this class */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Streams</div>
                  <div className="flex flex-wrap gap-2">
                    {streams.filter(s => s.class_id === c.id).map(s => (
                      <span key={s.id} className="px-2 py-1 rounded-md border text-xs">{s.name}</span>
                    ))}
                    {streams.filter(s => s.class_id === c.id).length === 0 && (
                      <span className="text-xs text-muted-foreground">No streams yet</span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <input
                        className="border rounded-md px-2 py-1 text-sm bg-background"
                        placeholder="Add stream (e.g., A, B, Yellow)"
                        value={newStream[c.id] || ""}
                        onChange={(e) => setNewStream({ ...newStream, [c.id]: e.target.value })}
                      />
                      <Button size="sm" variant="outline" onClick={async () => {
                        const name = (newStream[c.id] || "").trim();
                        if (!name) return;
                        try {
                          setLoading(true);
                          const created = await apiFetch<StreamItem>("/api/class-streams", {
                            method: "POST",
                            body: JSON.stringify({ class_id: c.id, name })
                          });
                          setStreams(prev => created ? [...prev, created] : prev);
                          setNewStream({ ...newStream, [c.id]: "" });
                        } catch (e: any) {
                          setError(e.message || "Failed to create stream");
                        } finally {
                          setLoading(false);
                        }
                      }}>Add</Button>
                    </div>
                  )}
                </div>

                {/* Subjects for this class */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Subjects</div>
                  <div className="flex flex-wrap gap-2">
                    {(classSubjects[c.id] || []).map(s => (
                      <span key={`${c.id}-${s.id}`} className="px-2 py-1 rounded-md border text-xs flex items-center gap-2">
                        {s.name}
                        {isAdmin && (
                          <Button size="sm" className="h-6 px-2" variant="destructive" onClick={async () => {
                            try {
                              await apiFetch(`/api/classes/${c.id}/subjects/${s.id}`, { method: "DELETE" });
                              setClassSubjects(prev => ({ ...prev, [c.id]: (prev[c.id] || []).filter(x => x.id !== s.id) }));
                            } catch (e: any) {
                              setError(e.message || "Failed to unlink subject");
                            }
                          }}>Remove</Button>
                        )}
                      </span>
                    ))}
                    {(classSubjects[c.id] || []).length === 0 && (
                      <span className="text-xs text-muted-foreground">No subjects linked</span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <select className="border rounded-md px-2 py-1 text-sm bg-background" value="" onChange={async (e) => {
                        const sid = Number(e.target.value);
                        if (!sid) return;
                        try {
                          const added = await apiFetch<SubjectItem>(`/api/classes/${c.id}/subjects`, { method: "POST", body: JSON.stringify({ subject_id: sid }) });
                          setClassSubjects(prev => ({ ...prev, [c.id]: [ ...(prev[c.id] || []), added ] }));
                        } catch (e: any) {
                          setError(e.message || "Failed to link subject");
                        } finally {
                          e.currentTarget.value = "";
                        }
                      }}>
                        <option value="">Add Subject…</option>
                        {subjects.filter(s => !(classSubjects[c.id] || []).some(x => x.id === s.id)).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
