import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { load, save } from "@/lib/storage";
import { setToken } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

interface School {
  name: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
}

interface Profile {
  name: string;
  email: string;
  phone?: string;
}

const SCHOOL_KEY = "school.settings";
const PROFILE_KEY = "user.profile";

// --- Subjects Manager ---
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

// --- User Management ---
function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "Teacher"
  });

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const userList = await apiFetch<any[]>("/api/users");
      setUsers(userList);
    } catch (e: any) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser() {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      setInfo("User added successfully");
      setNewUser({ name: "", email: "", password: "", role: "Teacher" });
      setShowAddUser(false);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserStatus(userId: number, isActive: boolean) {
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      await apiFetch(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !isActive }),
      });
      setInfo(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || "Failed to update user status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">User Management</CardTitle>
          <Button onClick={() => setShowAddUser(true)} disabled={loading}>
            Add User
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <div className="text-sm text-red-600">{error}</div>}
        {info && <div className="text-sm text-green-600">{info}</div>}

        {showAddUser && (
          <Card className="border-2 border-dashed">
            <CardContent className="space-y-2 pt-4">
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Full Name"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              />
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="Teacher">Teacher</option>
                <option value="Admin">Admin</option>
                <option value="Parent">Parent</option>
              </select>
              <div className="flex gap-2">
                <Button onClick={addUser} disabled={loading || !newUser.name || !newUser.email || !newUser.password}>
                  Create User
                </Button>
                <Button variant="outline" onClick={() => setShowAddUser(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
                <div className="text-xs">Role: {user.role}</div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleUserStatus(user.id, user.is_active)}
                  disabled={loading}
                >
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- School Settings ---
function SchoolSettings() {
  const [school, setSchool] = useState<School>(() =>
    load<School>(SCHOOL_KEY, {
      name: "Lowveld Academy",
      logoUrl: "",
      email: "",
      phone: "",
      address: "",
    })
  );

  useEffect(() => {
    save(SCHOOL_KEY, school);
  }, [school]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">School Settings</CardTitle>
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
          placeholder="Email"
          value={school.email}
          onChange={(e) => setSchool({ ...school, email: e.target.value })}
        />
        <input
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          placeholder="Phone"
          value={school.phone}
          onChange={(e) => setSchool({ ...school, phone: e.target.value })}
        />
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          placeholder="Address"
          value={school.address}
          onChange={(e) => setSchool({ ...school, address: e.target.value })}
        />
        <Button onClick={() => save(SCHOOL_KEY, school)}>Save</Button>
      </CardContent>
    </Card>
  );
}

// --- User Profile ---
function UserProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(() =>
    load<Profile>(PROFILE_KEY, { name: "", email: "" })
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

// --- Main Settings Component ---
export default function Settings() {
  const { role } = useRole();

  // Only show user management to admins
  const showUserManagement = role === "Admin";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your application settings</p>
        </div>

        <div className="grid gap-4">
          {showUserManagement && <UserManagement />}
          <SchoolSettings />
          <SubjectsManager />
          <UserProfile />
        </div>
      </div>
    </AppLayout>
  );
}  
