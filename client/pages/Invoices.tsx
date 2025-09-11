import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export type InvoiceStatus = "Pending" | "Paid" | "Under Review";

interface Invoice { id: string; title: string; student: string; amount: number; status: InvoiceStatus; proofUrl?: string }

const defaults: Invoice[] = [
  { id: "i1", title: "Term 2 Tuition", student: "John Doe", amount: 450, status: "Pending" },
  { id: "i2", title: "Sports Fee", student: "Jane Doe", amount: 50, status: "Paid" },
];

export default function Invoices() {
  const { role } = useRole();
  const [invoices, setInvoices] = useState<Invoice[]>(defaults);
  const [form, setForm] = useState({ title: "", student: "", amount: "" });

  const isAdmin = role === "Admin";
  const isParent = role === "Parent";

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold mb-2">{isParent ? "Invoices" : "Finance"}</h1>

      {isAdmin && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle className="text-base">Create Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Student Name" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} />
            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" placeholder="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Button onClick={() => {
              if (!form.title || !form.student || !form.amount) return;
              setInvoices([{ id: crypto.randomUUID(), title: form.title, student: form.student, amount: Number(form.amount), status: "Pending" }, ...invoices]);
              setForm({ title: "", student: "", amount: "" });
            }}>Create</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{inv.title}</div>
                  <div className="text-xs text-muted-foreground">{inv.student}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${inv.amount.toFixed(2)}</div>
                  <div className={`text-xs ${inv.status === "Paid" ? "text-green-600" : inv.status === "Under Review" ? "text-amber-600" : "text-red-600"}`}>{inv.status}</div>
                </div>
              </div>

              {isParent && (
                <div className="flex items-center gap-2">
                  <input type="file" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = URL.createObjectURL(file);
                    setInvoices((prev) => prev.map((x) => x.id === inv.id ? { ...x, proofUrl: url, status: "Under Review" } : x));
                  }} />
                  <Button variant="outline" className="ml-auto" disabled={!inv.proofUrl}>Replace</Button>
                </div>
              )}

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setInvoices((prev) => prev.map((x) => x.id === inv.id ? { ...x, status: "Paid" } : x))}>Mark Paid</Button>
                  <Button size="sm" variant="outline" onClick={() => setInvoices((prev) => prev.map((x) => x.id === inv.id ? { ...x, status: "Under Review" } : x))}>Mark Review</Button>
                  <Button size="sm" variant="destructive" onClick={() => setInvoices((prev) => prev.filter((x) => x.id !== inv.id))}>Delete</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
