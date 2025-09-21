import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { load, save } from "@/lib/storage";
import { setToken } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface School {
  name: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
}

// --- Subjects Manager ---
import { apiFetch } from "@/lib/api";

function SubjectsManager() {
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const list = await apiFetch<{ id: number; name: string }[]>("/api/subjects");
      setSubjects(list);
    } catch (e: any) {
      setError(e.message || "Failed to load subjects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const created = await apiFetch<{ id: number; name: string }>("/api/subjects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      if (created) setSubjects((prev) => [...prev, created]);
      setName("");
    } catch (e: any) {
      setError(e.message || "Failed to add subject");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      await apiFetch(`/api/subjects/${id}`, { method: "DELETE" });
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      setInfo("Subject deleted");
    } catch (e: any) {
      // Try to show server message
      try { const o = JSON.parse(e.message); setError(o.error || "Failed to delete"); }
      catch { setError(e.message || "Failed to delete"); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subjects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Add new subject (e.g., Mathematics)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button size="sm" onClick={add} disabled={loading}>Add</Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {info && <div className="text-sm text-green-700">{info}</div>}
        <div className="flex flex-wrap gap-2 pt-1">
          {subjects.map((s) => (
            <span key={s.id} className="px-2 py-1 border rounded-md text-sm flex items-center gap-2">
              {s.name}
              <Button size="sm" className="h-7 px-2" variant="destructive" onClick={() => remove(s.id)} disabled={loading}>Delete</Button>
            </span>
          ))}
          {subjects.length === 0 && (
            <span className="text-xs text-muted-foreground">No subjects yet</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
interface Profile {
  name: string;
  email: string;
  phone?: string;
}

const SCHOOL_KEY = "schoolapp.school";
const PROFILE_KEY = "schoolapp.profile";

export default function Settings() {
  const { role } = useRole();
  const isAdmin = role === "Admin";
  return (
    <AppLayout>
      <h1 className="text-xl font-semibold mb-2">
        {isAdmin ? "School Settings" : "Profile"}
      </h1>
      {isAdmin ? <AdminSettings /> : <UserProfile />}
    </AppLayout>
  );
}

function AdminSettings() {
  const [school, setSchool] = useState<School>(() =>
    load<School>(SCHOOL_KEY, {
      name: "Aurora High School",
      logoUrl: "",
      email: "info@aurora.edu",
      phone: "+1 555 0123",
      address: "123 Aurora Ave",
    }),
  );

  useEffect(() => {
    save(SCHOOL_KEY, school);
  }, [school]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">School Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="School Name"
            value={school.name}
            onChange={(e) => setSchool({ ...school, name: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Contact Email"
            value={school.email}
            onChange={(e) => setSchool({ ...school, email: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Phone"
            value={school.phone}
            onChange={(e) => setSchool({ ...school, phone: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Address"
            value={school.address}
            onChange={(e) => setSchool({ ...school, address: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                setSchool({ ...school, logoUrl: url });
              }}
            />
            {school.logoUrl && (
              <img
                src={school.logoUrl}
                alt="Logo"
                className="h-10 w-10 rounded-md object-cover"
              />
            )}
          </div>
          <Button onClick={() => save(SCHOOL_KEY, school)}>Save</Button>
        </CardContent>
      </Card>

      <SubjectsManager />
    </div>
  );
}

function UserProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(() =>
    load<Profile>(PROFILE_KEY, { name: "", email: "" }),
  );
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    save(PROFILE_KEY, profile);
  }, [profile]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Full Name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            placeholder="Phone"
            value={profile.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <Button onClick={() => save(PROFILE_KEY, profile)}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            type="password"
            placeholder="Current Password"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            type="password"
            placeholder="New Password"
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            type="password"
            placeholder="Confirm New Password"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
          />
          <Button disabled={!pwd.next || pwd.next !== pwd.confirm}>
            Update Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            onClick={() => {
              setToken(null);
              navigate("/login", { replace: true });
            }}
          >
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
