import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  UserPlus,
  CreditCard,
  Calendar,
  Users,
  FileSpreadsheet,
  BarChart2,
  ClipboardCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Dashboard() {
  const { role } = useRole();

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {role} Dashboard
        </h1>
        {role === "Admin" && <AdminHome />}
        {role === "Teacher" && <TeacherHome />}
        {role === "Parent" && <ParentHome />}
        {role === "Student" && <StudentHome />}
      </div>
    </AppLayout>
  );
}

function AdminHome() {
  const [data, setData] = useState<{ totals: { students: number; teachers: number; staff: number }, attendanceToday: { students: number; teachers: number; staff: number } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await apiFetch<typeof data>("/api/analytics/overview");
      setData(res as any);
    } catch (e: any) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totals = data?.totals || { students: 0, teachers: 0, staff: 0 };
  const att = data?.attendanceToday || { students: 0, teachers: 0, staff: 0 };

  const bars = [
    { label: "Students", total: totals.students, present: att.students },
    { label: "Teachers", total: totals.teachers, present: att.teachers },
    { label: "Staff", total: totals.staff, present: att.staff },
  ];

  return (
    <div className="space-y-3">
      {/* Analytics top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard title="Total Students" value={totals.students} loading={loading} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Total Teachers" value={totals.teachers} loading={loading} icon={<FileSpreadsheet className="h-5 w-5" />} />
        <KpiCard title="Total Staff" value={totals.staff} loading={loading} icon={<ClipboardCheck className="h-5 w-5" />} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><BarChart2 className="h-5 w-5" /> Attendance Today</CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="space-y-2">
            {bars.map((b) => {
              const pct = b.total ? Math.min(100, Math.round((b.present / b.total) * 100)) : 0;
              return (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-sm"><span>{b.label}</span><span>{b.present}/{b.total}</span></div>
                  <div className="h-2 bg-muted rounded-md overflow-hidden">
                    <div className="h-2 bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuickAction
          icon={<UserPlus className="h-5 w-5" />}
          title="Enroll Students"
          to="/classes"
        />
        <QuickAction
          icon={<Users className="h-5 w-5" />}
          title="Create / Manage Classes"
          to="/classes"
        />
        <QuickAction
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Allocate Teachers"
          to="/classes"
        />
        <QuickAction
          icon={<CreditCard className="h-5 w-5" />}
          title="Create Invoice"
          to="/invoices"
        />
        <QuickAction
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Attendance"
          to="/attendance"
        />
        <QuickAction
          icon={<Megaphone className="h-5 w-5" />}
          title="Send Announcement"
          to="/messages?tab=announcements"
        />
        <QuickAction
          icon={<Calendar className="h-5 w-5" />}
          title="School Settings / Subjects"
          to="/settings"
        />
      </div>
    </div>
  );
}

function TeacherHome() {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allocated Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Grade 7 - A</div>
              <div className="text-xs text-muted-foreground">28 students</div>
            </div>
            <Link to="/classes">
              <Button size="sm" variant="outline">
                View
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Grade 8 - B</div>
              <div className="text-xs text-muted-foreground">26 students</div>
            </div>
            <Link to="/classes">
              <Button size="sm" variant="outline">
                View
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/messages">
            <Button className="w-full">Message Parents</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ParentHome() {
  return (
    <div className="grid grid-cols-1 gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Term 2 Tuition</span>
            <span className="font-semibold text-primary">$450</span>
          </div>
          <Link to="/invoices">
            <Button className="w-full">View & Upload Payment</Button>
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/messages?tab=announcements">
            <Button variant="outline" className="w-full">
              View Notices
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentHome() {
  return (
    <div className="grid grid-cols-1 gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/messages?tab=announcements">
            <Button className="w-full">View</Button>
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class Timetable</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/classes">
            <Button variant="outline" className="w-full">
              Open
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  to: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <div className="font-medium">{title}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function KpiCard({ title, value, icon, loading }: { title: string; value: number; icon?: React.ReactNode; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-2xl font-semibold">{loading ? "…" : value}</div>
          </div>
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
