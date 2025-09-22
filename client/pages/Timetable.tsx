import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClassItem { id: number; name: string; description?: string }
interface Teacher { id: number; first_name: string; last_name: string; subject?: string | null }
interface Entry {
  id: number;
  class_id: number | null;
  teacher_id: number | null;
  subject: string;
  day_of_week: number; // 1..7
  start_time: string;  // "08:00"
  end_time: string;    // "09:00"
  room?: string | null;
  class_name?: string;
  teacher_name?: string;
}

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function Timetable() {
  const { role } = useRole();
  const [mode, setMode] = useState<"class" | "teacher">("class");
  const [colorMode, setColorMode] = useState<"subject" | "teacher">("subject");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [copyFromDay, setCopyFromDay] = useState<number>(1);
  const [copyToDay, setCopyToDay] = useState<number>(1);
  const [copyTargetClass, setCopyTargetClass] = useState<string>("");

  const canEdit = role === "Admin" || role === "Teacher";

  async function loadStatic() {
    try {
      const [cls, tch] = await Promise.all([
        apiFetch<ClassItem[]>("/api/classes"),
        apiFetch<Teacher[]>("/api/teachers"),
      ]);
      setClasses(cls);
      setTeachers(tch);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    }
  }

  async function copyDay() {
    if (!(mode === "class" ? selectedClass : selectedTeacher)) return;
    if (copyFromDay === copyToDay) { setError("Choose different days to copy"); return; }
    const list = entries.filter((e) => e.day_of_week === copyFromDay);
    if (!list.length) { setInfo("No entries on the source day"); return; }
    let created = 0, skipped = 0;
    setLoading(true);
    setError(null);
    setInfo(null);
    for (const e of list) {
      try {
        await apiFetch<Entry>("/api/timetable", {
          method: "POST",
          body: JSON.stringify({
            id: undefined,
            class_id: mode === "class" ? Number(selectedClass) : e.class_id,
            teacher_id: mode === "teacher" ? Number(selectedTeacher) : e.teacher_id,
            subject: e.subject,
            day_of_week: copyToDay,
            start_time: e.start_time,
            end_time: e.end_time,
            room: e.room ?? undefined,
          }),
        });
        created++;
      } catch (err) {
        skipped++;
      }
    }
    await loadEntries();
    setLoading(false);
    setInfo(`Copy day complete: created ${created}, skipped ${skipped}`);
  }

  async function copyWeekToClass() {
    if (mode !== "class") { setError("Switch to Class view to copy week to another class"); return; }
    if (!selectedClass || !copyTargetClass) { setError("Select source and target class"); return; }
    if (selectedClass === copyTargetClass) { setError("Choose a different target class"); return; }
    const list = entries; // all days of current class
    if (!list.length) { setInfo("No entries to copy"); return; }
    let created = 0, skipped = 0;
    setLoading(true);
    setError(null);
    setInfo(null);
    for (const e of list) {
      try {
        await apiFetch<Entry>("/api/timetable", {
          method: "POST",
          body: JSON.stringify({
            id: undefined,
            class_id: Number(copyTargetClass),
            teacher_id: e.teacher_id ?? undefined,
            subject: e.subject,
            day_of_week: e.day_of_week,
            start_time: e.start_time,
            end_time: e.end_time,
            room: e.room ?? undefined,
          }),
        });
        created++;
      } catch (err) {
        skipped++;
      }
    }
    setLoading(false);
    setInfo(`Copy week complete: created ${created}, skipped ${skipped}`);
  }
  }

  async function loadEntries() {
    try {
      setLoading(true);
      setError(null);
      if (mode === "class" && selectedClass) {
        const data = await apiFetch<Entry[]>(`/api/timetable/class/${selectedClass}`);
        setEntries(data);
      } else if (mode === "teacher" && selectedTeacher) {
        const data = await apiFetch<Entry[]>(`/api/timetable/teacher/${selectedTeacher}`);
        setEntries(data);
      } else {
        setEntries([]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedClass, selectedTeacher]);

  const byDay = useMemo(() => {
    const map: Record<number, Entry[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    for (const e of entries) map[e.day_of_week]?.push(e);
    for (const k of Object.keys(map)) {
      map[Number(k) as 1|2|3|4|5|6|7].sort((a,b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [entries]);

  // --- Color coding helpers ---
  function hashString(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function colorForKey(key: string | undefined) {
    const base = key && key.trim() ? key : "_none_";
    const h = hashString(base) % 360; // hue
    const s = 70; // saturation
    const l = 88; // lightness for background
    const lBorder = 70;
    return {
      bg: `hsl(${h} ${s}% ${l}%)`,
      border: `hsl(${h} ${s}% ${lBorder}%)`,
    };
  }

  // ---- Edit Modal State ----
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Entry> | null>(null);

  function timeToMins(t: string) {
    const [h, m] = t.split(":").map((x) => Number(x));
    return h * 60 + m;
  }

  function overlaps(day: number, start: string, end: string, excludeId?: number) {
    const s = timeToMins(start);
    const e = timeToMins(end);
    if (Number.isNaN(s) || Number.isNaN(e)) return true; // invalid considered overlap
    if (s >= e) return true; // invalid range
    const list = byDay[day] || [];
    return list.some((x) => {
      if (excludeId && x.id === excludeId) return false;
      const xs = timeToMins(x.start_time);
      const xe = timeToMins(x.end_time);
      return Math.max(xs, s) < Math.min(xe, e);
    });
  }

  async function createOrUpdate(entry: Partial<Entry>) {
    try {
      setLoading(true);
      const body = {
        ...entry,
        class_id: mode === "class" ? Number(selectedClass) || null : (entry.class_id ?? null),
        teacher_id: mode === "teacher" ? Number(selectedTeacher) || null : (entry.teacher_id ?? null),
      };
      const saved = await apiFetch<Entry>("/api/timetable", {
        method: "POST",
        body: JSON.stringify(body),
      });
      // Refresh
      await loadEntries();
      return saved;
    } catch (e: any) {
      setError(e.message || "Failed to save entry");
    } finally {
      setLoading(false);
    }
  }

  async function deleteEntry(id: number) {
    try {
      setLoading(true);
      await apiFetch(`/api/timetable/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Timetable</h1>
        <Button variant="outline" size="sm" onClick={loadEntries} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card className="mb-3">
        <CardHeader>
          <CardTitle className="text-base">View</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant={mode === "class" ? "default" : "outline"}
              onClick={() => setMode("class")}
              size="sm"
            >
              By Class
            </Button>
            <Button
              variant={mode === "teacher" ? "default" : "outline"}
              onClick={() => setMode("teacher")}
              size="sm"
            >
              By Teacher
            </Button>
          </div>

          {mode === "class" ? (
            <select
              className="border rounded-md px-2 py-1 text-sm bg-background"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select Class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="border rounded-md px-2 py-1 text-sm bg-background"
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="">Select Teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
          )}

          {/* Color mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color by:</span>
            <Button
              size="sm"
              variant={colorMode === "subject" ? "default" : "outline"}
              onClick={() => setColorMode("subject")}
            >
              Subject
            </Button>
            <Button
              size="sm"
              variant={colorMode === "teacher" ? "default" : "outline"}
              onClick={() => setColorMode("teacher")}
            >
              Teacher
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk tools */}
      {(mode === "class" ? selectedClass : selectedTeacher) && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle className="text-base">Tools</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Copy Day</div>
                <div className="flex items-center gap-2">
                  <select className="border rounded-md px-2 py-1 text-sm bg-background" value={copyFromDay} onChange={(e) => setCopyFromDay(Number(e.target.value))}>
                    {DAYS.map((d,i) => (<option key={d} value={i+1}>{d}</option>))}
                  </select>
                  <span className="text-xs">to</span>
                  <select className="border rounded-md px-2 py-1 text-sm bg-background" value={copyToDay} onChange={(e) => setCopyToDay(Number(e.target.value))}>
                    {DAYS.map((d,i) => (<option key={d} value={i+1}>{d}</option>))}
                  </select>
                  <Button size="sm" onClick={copyDay} disabled={loading}>Copy</Button>
                </div>
              </div>

              {mode === "class" && (
                <div className="md:ml-auto">
                  <div className="text-xs text-muted-foreground mb-1">Copy Week to Class</div>
                  <div className="flex items-center gap-2">
                    <select className="border rounded-md px-2 py-1 text-sm bg-background" value={copyTargetClass} onChange={(e) => setCopyTargetClass(e.target.value)}>
                      <option value="">Select Target Class…</option>
                      {classes.filter(c => String(c.id) !== selectedClass).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={copyWeekToClass} disabled={loading || !copyTargetClass}>Copy Week</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {info && <div className="text-sm text-green-700 mb-2">{info}</div>}

      {(mode === "class" ? selectedClass : selectedTeacher) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {DAYS.map((d, idx) => (
                <div key={d} className="border rounded-md p-2">
                  <div className="font-medium text-sm mb-2">{d}</div>
                  <div className="space-y-2">
                    {byDay[(idx+1) as 1|2|3|4|5|6|7].map((e) => {
                      const key = colorMode === "subject" ? e.subject : (e.teacher_name || e.class_name || "");
                      const c = colorForKey(key);
                      return (
                      <div key={e.id} className="rounded-md p-2 text-sm border" style={{ backgroundColor: c.bg, borderColor: c.border }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{e.subject}</div>
                            <div className="text-xs text-muted-foreground">
                              {e.start_time} - {e.end_time}
                              {e.room ? ` • Room ${e.room}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mode === "class" ? (e.teacher_name ? `Teacher: ${e.teacher_name}` : "") : (e.class_name ? `Class: ${e.class_name}` : "")}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => {
                                setEditData({ ...e });
                                setEditOpen(true);
                              }}>
                                ✎
                              </Button>
                              <Button size="icon" variant="destructive" onClick={() => deleteEntry(e.id)}>
                                ×
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                    {canEdit && (
                      <AddEntryForm
                        day={idx+1}
                        onAdd={(data) => createOrUpdate(data)}
                        classId={mode === "class" ? Number(selectedClass) : undefined}
                        teacherId={mode === "teacher" ? Number(selectedTeacher) : undefined}
                        hasOverlap={(start, end) => overlaps(idx+1, start, end)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-muted-foreground">Select a {mode === "class" ? "class" : "teacher"} to view timetable.</div>
      )}
      <EditEntryModal
        open={editOpen}
        onOpenChange={setEditOpen}
        data={editData}
        onSave={(p) => createOrUpdate(p)}
        hasOverlap={overlaps}
        mode={mode}
        classes={classes}
        teachers={teachers}
        currentClassId={selectedClass ? Number(selectedClass) : undefined}
        currentTeacherId={selectedTeacher ? Number(selectedTeacher) : undefined}
      />
    </AppLayout>
  );
}

function AddEntryForm({ day, onAdd, classId, teacherId, hasOverlap }: { day: number; onAdd: (p: Partial<Entry>) => void; classId?: number; teacherId?: number; hasOverlap: (start: string, end: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [room, setRoom] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="border rounded-md p-2 bg-background">
      {open ? (
        <div className="space-y-2">
          <input className="w-full border rounded-md px-2 py-1 text-sm bg-background" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div className="flex items-center gap-2">
            <input className="w-full border rounded-md px-2 py-1 text-sm bg-background" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <input className="w-full border rounded-md px-2 py-1 text-sm bg-background" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <input className="w-full border rounded-md px-2 py-1 text-sm bg-background" placeholder="Room (optional)" value={room} onChange={(e) => setRoom(e.target.value)} />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => {
              if (!subject) { setErr("Subject is required"); return; }
              if ((start || "") >= (end || "")) { setErr("Start time must be before end time"); return; }
              if (hasOverlap(start, end)) { setErr("Overlaps with another entry"); return; }
              onAdd({ class_id: classId, teacher_id: teacherId, subject, day_of_week: day, start_time: start, end_time: end, room: room || undefined });
              setOpen(false); setSubject(""); setErr(null);
            }}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Add</Button>
      )}
    </div>
  );
}

// Edit Entry Modal
function EditEntryModal({ open, onOpenChange, data, onSave, hasOverlap, mode, classes, teachers, currentClassId, currentTeacherId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: Partial<Entry> | null;
  onSave: (p: Partial<Entry>) => void;
  hasOverlap: (day: number, start: string, end: string, excludeId?: number) => boolean;
  mode: "class" | "teacher";
  classes: { id: number; name: string }[];
  teachers: { id: number; first_name: string; last_name: string }[];
  currentClassId?: number;
  currentTeacherId?: number;
}) {
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [room, setRoom] = useState("");
  const [day, setDay] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [reassignClassId, setReassignClassId] = useState<number | undefined>(undefined);
  const [reassignTeacherId, setReassignTeacherId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (data) {
      setSubject(data.subject || "");
      setStart(data.start_time || "08:00");
      setEnd(data.end_time || "09:00");
      setRoom((data.room as string) || "");
      setDay((data.day_of_week as number) || 1);
      setErr(null);
      setReassignClassId(currentClassId);
      setReassignTeacherId(currentTeacherId);
    }
  }, [data]);

  function validate() {
    if (!subject) return "Subject is required";
    if ((start || "") >= (end || "")) return "Start time must be before end time";
    if (hasOverlap(day, start, end, data?.id)) return "Overlaps with another entry";
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i+1}>{d}</option>
              ))}
            </select>
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background md:col-span-2" placeholder="Room (optional)" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          {mode === "class" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Assign Teacher</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={reassignTeacherId || ""} onChange={(e) => setReassignTeacherId(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
          )}
          {mode === "teacher" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Assign Class</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={reassignClassId || ""} onChange={(e) => setReassignClassId(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Unassigned</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => {
              const msg = validate();
              if (msg) { setErr(msg); return; }
              onSave({ id: data?.id, subject, day_of_week: day, start_time: start, end_time: end, room: room || undefined, class_id: mode === "teacher" ? (reassignClassId ?? null) : undefined, teacher_id: mode === "class" ? (reassignTeacherId ?? null) : undefined });
              onOpenChange(false);
            }}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
