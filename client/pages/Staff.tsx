import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface Staff {
  id: number;
  first_name: string;
  last_name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", title: "", email: "", phone: "" });

  async function load() {
    try {
      setLoading(true);
      const list = await apiFetch<Staff[]>("/api/staff");
      setStaff(list);
    } catch (e: any) {
      setError(e.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!form.first_name || !form.last_name) { setError("First and last name are required"); return; }
    try {
      setLoading(true);
      const created = await apiFetch<Staff>("/api/staff", { method: "POST", body: JSON.stringify({ ...form }) });
      setStaff(prev => [created, ...prev]);
      setForm({ first_name: "", last_name: "", title: "", email: "", phone: "" });
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to add staff");
    } finally { setLoading(false); }
  }

  async function remove(id: number) {
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this staff member?') : true;
    if (!ok) return;
    try { setLoading(true); await apiFetch(`/api/staff/${id}`, { method: 'DELETE' }); setStaff(prev => prev.filter(s => s.id !== id)); }
    catch (e: any) { setError(e.message || 'Failed to delete'); }
    finally { setLoading(false); }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Non-Teaching Staff</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
      </div>

      <Card className="mb-3">
        <CardHeader><CardTitle className="text-base">Add Staff</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="First name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Last name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Title (e.g., Bursar)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button onClick={add} disabled={loading}>Save</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading && staff.length === 0 && <div className="text-sm text-muted-foreground">Loading…</div>}
        {staff.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{s.first_name} {s.last_name}</div>
                <div className="text-xs text-muted-foreground">{s.title || 'No title'} {s.email ? `• ${s.email}` : ''} {s.phone ? `• ${s.phone}` : ''}</div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => remove(s.id)} disabled={loading}>Delete</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
