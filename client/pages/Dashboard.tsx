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
} from "lucide-react";
import { Link } from "react-router-dom";

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
  return (
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
        icon={<Megaphone className="h-5 w-5" />}
        title="Send Announcement"
        to="/messages?tab=announcements"
      />
      <QuickAction
        icon={<Calendar className="h-5 w-5" />}
        title="School Settings"
        to="/settings"
      />
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
