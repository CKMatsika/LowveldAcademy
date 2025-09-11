import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { load, save } from "@/lib/storage";

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
    </div>
  );
}

function UserProfile() {
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
    </div>
  );
}
