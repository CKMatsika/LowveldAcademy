import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface Student { id: number; first_name: string; last_name: string; class_name?: string }
interface Teacher { id: number; first_name: string; last_name: string }
interface Staff { id: number; first_name: string; last_name: string; title?: string | null }
interface ClassItem { id: number; name: string }
interface Stream { id: number; class_id: number; name: string }

type EntityType = "student" | "teacher" | "staff";

type Row = { id: number; name: string; extra?: string };

export default function AttendancePage() {
  const [tab, setTab] = useState<EntityType>("student");
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [today, setToday] = useState<{ [key: string]: string }>({}); // key: `${type}:${id}` -> status
  const [classId, setClassId] = useState<string>("");
  const [streamId, setStreamId] = useState<string>("");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [s, t, f, cls, str] = await Promise.all([
        apiFetch<Student[]>("/api/students"),
        apiFetch<Teacher[]>("/api/teachers"),
        apiFetch<Staff[]>("/api/staff"),
        apiFetch<ClassItem[]>("/api/classes"),
        apiFetch<Stream[]>("/api/class-streams"),
      ]);
      setStudents(s);
      setTeachers(t);
      setStaff(f);
      setClasses(cls);
      setStreams(str);
      // Preload today's statuses so marking shows existing ones
      const [stud, teach, stf] = await Promise.all([
        apiFetch<any[]>("/api/attendance/today?type=student"),
        apiFetch<any[]>("/api/attendance/today?type=teacher"),
        apiFetch<any[]>("/api/attendance/today?type=staff"),
      ]);
      const map: { [key: string]: string } = {};
      for (const r of stud) map[`student:${r.entity_id}`] = r.status;
      for (const r of teach) map[`teacher:${r.entity_id}`] = r.status;
      for (const r of stf) map[`staff:${r.entity_id}`] = r.status;
      setToday(map);
    } catch (e: any) {
      setError(e.message || "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }

  async function markBulk(status: string) {
    if (tab !== "student") return;
    const ids = list.map(r => r.id);
    setLoading(true);
    try {
      for (const id of ids) {
        await apiFetch("/api/attendance/mark", {
          method: "POST",
          body: JSON.stringify({ entity_type: "student", entity_id: id, status }),
        });
      }
      setToday(prev => {
        const next = { ...prev } as any;
        for (const id of ids) next[`student:${id}`] = status;
        return next;
      });
    } catch (e: any) {
      setError(e.message || "Failed to mark all");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const list: Row[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const toRows = (arr: any[], extraKey?: string): Row[] => arr.map(x => ({ id: x.id, name: `${x.first_name} ${x.last_name}`, extra: extraKey ? x[extraKey] : undefined }));
    let base: Row[] = [];
    if (tab === "student") {
      const filtered = students.filter((s: any) => {
        if (classId && String(s.class_id) !== classId) return false;
        if (streamId && String(s.class_stream_id || "") !== streamId) return false;
        return true;
      });
      base = toRows(filtered, "class_name");
    }
    else if (tab === "teacher") base = toRows(teachers);
    else base = toRows(staff, "title");
    if (!q) return base;
    return base.filter(r => r.name.toLowerCase().includes(q) || (r.extra || "").toLowerCase().includes(q));
  }, [tab, students, teachers, staff, search, classId, streamId]);

  async function mark(id: number, status: string) {
    try {
      setLoading(true);
      await apiFetch("/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ entity_type: tab, entity_id: id, status }),
      });
      setToday(prev => ({ ...prev, [`${tab}:${id}`]: status }));
    } catch (e: any) {
      setError(e.message || "Failed to mark attendance");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Attendance</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mark Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button size="sm" variant={tab === "student" ? "default" : "outline"} onClick={() => setTab("student")}>Students</Button>
              <Button size="sm" variant={tab === "teacher" ? "default" : "outline"} onClick={() => setTab("teacher")}>Teachers</Button>
              <Button size="sm" variant={tab === "staff" ? "default" : "outline"} onClick={() => setTab("staff")}>Staff</Button>
            </div>
            {tab === "student" && (
              <>
                <select className="border rounded-md px-2 py-1 text-sm bg-background ml-auto" value={classId} onChange={(e) => { setClassId(e.target.value); setStreamId(""); }}>
                  <option value="">All Classes</option>
                  {classes.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <select className="border rounded-md px-2 py-1 text-sm bg-background" value={streamId} onChange={(e) => setStreamId(e.target.value)} disabled={!classId}>
                  <option value="">All Streams</option>
                  {streams.filter(s => String(s.class_id) === classId).map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => markBulk("Present")} disabled={loading || list.length === 0}>All Present</Button>
                  <Button size="sm" variant="outline" onClick={() => markBulk("Absent")} disabled={loading || list.length === 0}>All Absent</Button>
                  <Button size="sm" variant="outline" onClick={() => markBulk("Late")} disabled={loading || list.length === 0}>All Late</Button>
                </div>
              </>
            )}
            <input className="border rounded-md px-2 py-1 text-sm bg-background ml-auto" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {list.map(r => {
              const key = `${tab}:${r.id}`;
              const status = today[key] || "";
              return (
                <div key={key} className="flex items-center justify-between border rounded-md px-2 py-2 text-sm">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.extra || ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={status === "Present" ? "default" : "outline"} onClick={() => mark(r.id, "Present")} disabled={loading}>Present</Button>
                    <Button size="sm" variant={status === "Absent" ? "default" : "outline"} onClick={() => mark(r.id, "Absent")} disabled={loading}>Absent</Button>
                    <Button size="sm" variant={status === "Late" ? "default" : "outline"} onClick={() => mark(r.id, "Late")} disabled={loading}>Late</Button>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && (
              <div className="text-sm text-muted-foreground">No records</div>
            )}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
