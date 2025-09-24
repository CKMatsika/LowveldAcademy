import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface ClassItem { id: number; name: string; description?: string }
interface Stream { id: number; class_id: number; name: string }
interface Subject { id: number; name: string }
interface Guardian { id: number; first_name: string; last_name: string; phone?: string; email?: string; address?: string }
interface Student { id: number; first_name: string; last_name: string; class_id: number; class_name?: string; stream_name?: string; guardian_id?: number | null }

export default function Students() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Enrollment form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [streamId, setStreamId] = useState<string>("");
  const [guardian, setGuardian] = useState({ first_name: "", last_name: "", phone: "", email: "", address: "" });
  const [subjectIds, setSubjectIds] = useState<number[]>([]);

  const classStreams = useMemo(() => streams.filter(s => String(s.class_id) === classId), [streams, classId]);

  async function loadAll() {
    try {
      setLoading(true);
      const [cls, sts, subs] = await Promise.all([
        apiFetch<ClassItem[]>("/api/classes"),
        apiFetch<Student[]>("/api/students"),
        apiFetch<Subject[]>("/api/subjects"),
      ]);
      setClasses(cls);
      setStudents(sts);
      setSubjects(subs);
      const allStreams = await apiFetch<Stream[]>("/api/class-streams");
      setStreams(allStreams);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Preselect recommended subjects for chosen class (but allow toggling all)
  useEffect(() => {
    (async () => {
      if (!classId) { setSubjectIds([]); return; }
      try {
        const rec = await apiFetch<Subject[]>(`/api/classes/${classId}/subjects`);
        setSubjectIds(rec.map(r => r.id));
      } catch (e) {
        // ignore
      }
    })();
  }, [classId]);

  async function enroll() {
    setError(null);
    setInfo(null);
    if (!firstName || !lastName || !classId) { setError("First name, Last name and Class are required"); return; }
    try {
      setLoading(true);
      const created = await apiFetch<Student>("/api/students", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          class_id: Number(classId),
          class_stream_id: streamId ? Number(streamId) : null,
          guardian: (guardian.first_name || guardian.last_name || guardian.phone || guardian.email || guardian.address) ? guardian : undefined,
          subject_ids: subjectIds,
        }),
      });
      setStudents(prev => [created, ...prev]);
      setFirstName(""); setLastName(""); setClassId(""); setStreamId(""); setGuardian({ first_name: "", last_name: "", phone: "", email: "", address: "" }); setSubjectIds([]);
      setInfo("Student enrolled successfully");
    } catch (e: any) {
      try { const o = JSON.parse(e.message); setError(o.error || "Failed to enroll student"); }
      catch { setError(e.message || "Failed to enroll student"); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Students</h1>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
      </div>

      <Card className="mb-3">
        <CardHeader>
          <CardTitle className="text-base">Enroll Student</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={classId} onChange={(e) => { setClassId(e.target.value); setStreamId(""); }}>
              <option value="">Select Class…</option>
              {classes.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={streamId} onChange={(e) => setStreamId(e.target.value)} disabled={!classId}>
              <option value="">Select Stream…</option>
              {classStreams.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Guardian (optional)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Guardian First name" value={guardian.first_name} onChange={(e) => setGuardian({ ...guardian, first_name: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Guardian Last name" value={guardian.last_name} onChange={(e) => setGuardian({ ...guardian, last_name: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Phone" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Email" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2 text-sm bg-background md:col-span-2" placeholder="Address" value={guardian.address} onChange={(e) => setGuardian({ ...guardian, address: e.target.value })} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Subjects</div>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => {
                const checked = subjectIds.includes(s.id);
                return (
                  <label key={s.id} className={`px-2 py-1 border rounded-md text-sm cursor-pointer ${checked ? 'bg-primary/10 border-primary' : ''}`}>
                    <input type="checkbox" className="mr-2" checked={checked} onChange={(e) => {
                      setSubjectIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                    }} />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {info && <div className="text-sm text-green-700">{info}</div>}

          <Button onClick={enroll} disabled={loading}>Enroll</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading && students.length === 0 && <div className="text-sm text-muted-foreground">Loading students…</div>}
        {students.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{s.first_name} {s.last_name}</div>
                <div className="text-xs text-muted-foreground">{s.class_name || `Class ID: ${s.class_id}`} {s.stream_name ? `• Stream: ${s.stream_name}` : ''}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
