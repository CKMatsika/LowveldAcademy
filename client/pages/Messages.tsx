import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRole } from "@/hooks/use-role";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
}
interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  date: string;
}

const initialAnnouncements: Announcement[] = [
  {
    id: "1",
    title: "Welcome back",
    body: "School reopens on Monday at 8:00 AM.",
    date: new Date().toISOString(),
  },
  {
    id: "2",
    title: "PTA Meeting",
    body: "Parents meeting this Friday at 5 PM.",
    date: new Date().toISOString(),
  },
];

const initialMessages: Message[] = [
  {
    id: "m1",
    from: "Admin",
    to: "Parent",
    body: "Please check the latest invoice.",
    date: new Date().toISOString(),
  },
  {
    id: "m2",
    from: "Parent",
    to: "Teacher",
    body: "Will my child need extra books?",
    date: new Date().toISOString(),
  },
];

export default function Messages() {
  const { role } = useRole();
  const [params] = useSearchParams();
  const defaultTab = params.get("tab") === "announcements" ? "ann" : "dm";
  const [announcements, setAnnouncements] =
    useState<Announcement[]>(initialAnnouncements);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [compose, setCompose] = useState({ to: "", body: "" });
  const [notice, setNotice] = useState({ title: "", body: "" });

  const canSendAnnouncement = role === "Admin" || role === "Teacher";

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold mb-2">Communication</h1>
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="ann">
            Announcements
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="dm">
            Direct Messages
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ann" className="space-y-3">
          {canSendAnnouncement && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Send Announcement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  placeholder="Title"
                  value={notice.title}
                  onChange={(e) =>
                    setNotice({ ...notice, title: e.target.value })
                  }
                />
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm h-24 bg-background"
                  placeholder="Write your announcement"
                  value={notice.body}
                  onChange={(e) =>
                    setNotice({ ...notice, body: e.target.value })
                  }
                />
                <Button
                  onClick={() => {
                    if (!notice.title || !notice.body) return;
                    setAnnouncements([
                      {
                        id: crypto.randomUUID(),
                        title: notice.title,
                        body: notice.body,
                        date: new Date().toISOString(),
                      },
                      ...announcements,
                    ]);
                    setNotice({ title: "", body: "" });
                  }}
                >
                  Send
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="dm" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="To (Admin/Teacher/Parent/Student)"
                value={compose.to}
                onChange={(e) => setCompose({ ...compose, to: e.target.value })}
              />
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm h-24 bg-background"
                placeholder="Write a message"
                value={compose.body}
                onChange={(e) =>
                  setCompose({ ...compose, body: e.target.value })
                }
              />
              <Button
                onClick={() => {
                  if (!compose.to || !compose.body) return;
                  setMessages([
                    {
                      id: crypto.randomUUID(),
                      from: role,
                      to: compose.to,
                      body: compose.body,
                      date: new Date().toISOString(),
                    },
                    ...messages,
                  ]);
                  setCompose({ to: "", body: "" });
                }}
              >
                Send Message
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {messages.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">
                    {m.from} → {m.to}
                  </div>
                  <div className="text-sm">{m.body}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
