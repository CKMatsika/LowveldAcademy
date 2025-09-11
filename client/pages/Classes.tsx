import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  teacher?: string;
  students: string[];
}

const seed: ClassItem[] = [
  {
    id: "c1",
    name: "Grade 7 - A",
    subject: "Mathematics",
    teacher: "Mr. Smith",
    students: ["John Doe", "Jane Doe"],
  },
  {
    id: "c2",
    name: "Grade 8 - B",
    subject: "Science",
    teacher: "Mrs. Lee",
    students: ["Paul", "Mary"],
  },
];

export default function Classes() {
  const { role } = useRole();
  const [classes, setClasses] = useState<ClassItem[]>(seed);
  const [form, setForm] = useState({ name: "", subject: "" });

  const isAdmin = role === "Admin";
  const isTeacher = role === "Teacher";

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold mb-2">Classes</h1>

      {isAdmin && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle className="text-base">Create / Manage Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Class Name (e.g., Grade 7 - A)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <Button
              onClick={() => {
                if (!form.name || !form.subject) return;
                setClasses([
                  {
                    id: crypto.randomUUID(),
                    name: form.name,
                    subject: form.subject,
                    students: [],
                  },
                  ...classes,
                ]);
                setForm({ name: "", subject: "" });
              }}
            >
              Create Class
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {classes.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {c.name} • {c.subject}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  Teacher:{" "}
                  <span className="font-medium">
                    {c.teacher || "Unassigned"}
                  </span>
                </div>
                <div>{c.students.length} students</div>
              </div>

              {(isAdmin || isTeacher) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {isAdmin && (
                    <AssignTeacher
                      classItem={c}
                      onChange={(teacher) =>
                        setClasses((prev) =>
                          prev.map((x) =>
                            x.id === c.id ? { ...x, teacher } : x,
                          ),
                        )
                      }
                    />
                  )}
                  <AddStudent
                    onAdd={(name) =>
                      setClasses((prev) =>
                        prev.map((x) =>
                          x.id === c.id
                            ? { ...x, students: [...x.students, name] }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {c.students.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-md bg-accent text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>

              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setClasses((prev) => prev.filter((x) => x.id !== c.id))
                    }
                  >
                    Delete Class
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}

function AssignTeacher({
  classItem,
  onChange,
}: {
  classItem: ClassItem;
  onChange: (teacher: string) => void;
}) {
  const [teacher, setTeacher] = useState(classItem.teacher || "");
  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
        placeholder="Assign Teacher"
        value={teacher}
        onChange={(e) => setTeacher(e.target.value)}
      />
      <Button variant="outline" onClick={() => onChange(teacher)}>
        Assign
      </Button>
    </div>
  );
}

function AddStudent({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
        placeholder="Enroll Student"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        variant="outline"
        onClick={() => {
          if (!name) return;
          onAdd(name);
          setName("");
        }}
      >
        Add
      </Button>
    </div>
  );
}
