import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export type InvoiceStatus = "Pending" | "Paid" | "Under Review";

interface Invoice {
  id: number;
  title: string;
  student_id: number;
  amount: number;
  status: InvoiceStatus;
  proofUrl?: string;
}

function InvoiceAmountSummary({ inv, receipts }: { inv: { id: number; amount: number }; receipts: { invoice_id: number | null; amount: number }[] }) {
  const paid = useMemo(() => {
    return receipts
      .filter((r) => r.invoice_id === inv.id)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [receipts, inv.id]);

  const remaining = Math.max(0, inv.amount - paid);
  const color = paid >= inv.amount ? "text-green-600" : remaining > 0 ? "text-amber-600" : "text-foreground";

  return (
    <div className="text-right">
      <div className="font-semibold">
        ${paid.toFixed(2)} <span className="text-xs text-muted-foreground">/ ${inv.amount.toFixed(2)}</span>
      </div>
      {remaining > 0 && (
        <div className={`text-xs ${color}`}>Remaining: ${remaining.toFixed(2)}</div>
      )}
    </div>
  );
}

interface Student { id: number; first_name: string; last_name: string }
interface Receipt { id: number; invoice_id: number | null; amount: number; method?: string; reference?: string; created_at: string }
interface Expense { id: number; title: string; amount: number; category?: string; created_at: string }
interface Summary { totalReceipts: number; totalExpenses: number; bankBalance: number }

export default function Invoices() {
  const { role } = useRole();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ title: "", student_id: "", amount: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState({ invoice_id: "", amount: "", method: "Cash", reference: "" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", category: "" });
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function fetchAll() {
    try {
      setLoading(true);
      const [inv, studs, recs, exps, sum] = await Promise.all([
        apiFetch<Invoice[]>("/api/invoices"),
        apiFetch<Student[]>("/api/students"),
        apiFetch<Receipt[]>("/api/receipts"),
        apiFetch<Expense[]>("/api/expenses"),
        apiFetch<Summary>("/api/finance/summary"),
      ]);
      setInvoices(inv);
      setStudents(studs);
      setReceipts(recs);
      setExpenses(exps);
      setSummary(sum);
    } catch (e: any) {
      setError(e.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const isAdmin = role === "Admin";
  const isParent = role === "Parent";

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">
          {isParent ? "Invoices" : "Finance"}
        </h1>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {!isParent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>Receipts: <span className="font-semibold">${summary ? summary.totalReceipts.toFixed(2) : "0.00"}</span></div>
              <div>Expenses: <span className="font-semibold">${summary ? summary.totalExpenses.toFixed(2) : "0.00"}</span></div>
              <div>Bank Balance: <span className="font-semibold">${summary ? summary.bankBalance.toFixed(2) : "0.00"}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Receipt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={receiptForm.invoice_id}
                onChange={(e) => setReceiptForm({ ...receiptForm, invoice_id: e.target.value })}
              >
                <option value="">Unallocated (no invoice)</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    #{inv.id} • {inv.title}
                  </option>
                ))}
              </select>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Amount"
                type="number"
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Method (Cash/Card/Transfer)"
                value={receiptForm.method}
                onChange={(e) => setReceiptForm({ ...receiptForm, method: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Reference/Note"
                value={receiptForm.reference}
                onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })}
              />
              <Button
                onClick={async () => {
                  if (!receiptForm.amount) return;
                  try {
                    setLoading(true);
                    const created = await apiFetch<Receipt>("/api/receipts", {
                      method: "POST",
                      body: JSON.stringify({
                        invoice_id: receiptForm.invoice_id ? Number(receiptForm.invoice_id) : null,
                        amount: Number(receiptForm.amount),
                        method: receiptForm.method || undefined,
                        reference: receiptForm.reference || undefined,
                      }),
                    });
                    setReceipts((prev) => [created, ...prev]);
                    // Refresh invoices and summary to reflect paid status and balances
                    const [inv, sum] = await Promise.all([
                      apiFetch<Invoice[]>("/api/invoices"),
                      apiFetch<Summary>("/api/finance/summary"),
                    ]);
                    setInvoices(inv);
                    setSummary(sum);
                    setReceiptForm({ invoice_id: "", amount: "", method: "Cash", reference: "" });
                  } catch (e: any) {
                    setError(e.message || "Failed to record receipt");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Save Receipt
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Expense</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Title"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Amount"
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Category (optional)"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              />
              <Button
                onClick={async () => {
                  if (!expenseForm.title || !expenseForm.amount) return;
                  try {
                    setLoading(true);
                    const created = await apiFetch<Expense>("/api/expenses", {
                      method: "POST",
                      body: JSON.stringify({
                        title: expenseForm.title,
                        amount: Number(expenseForm.amount),
                        category: expenseForm.category || undefined,
                      }),
                    });
                    setExpenses((prev) => [created, ...prev]);
                    const sum = await apiFetch<Summary>("/api/finance/summary");
                    setSummary(sum);
                    setExpenseForm({ title: "", amount: "", category: "" });
                  } catch (e: any) {
                    setError(e.message || "Failed to record expense");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Save Expense
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {isAdmin && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle className="text-base">Create Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            >
              <option value="">Select Student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <Button
              onClick={async () => {
                if (!form.title || !form.student_id || !form.amount) return;
                try {
                  setLoading(true);
                  const created = await apiFetch<Invoice>("/api/invoices", {
                    method: "POST",
                    body: JSON.stringify({
                      title: form.title,
                      student_id: Number(form.student_id),
                      amount: Number(form.amount),
                      status: "Pending",
                    }),
                  });
                  setInvoices((prev) => [created, ...prev]);
                  setForm({ title: "", student_id: "", amount: "" });
                } catch (e: any) {
                  setError(e.message || "Failed to create invoice");
                } finally {
                  setLoading(false);
                }
              }}
            >
              Create
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading && invoices.length === 0 && (
          <div className="text-sm text-muted-foreground">Loading invoices…</div>
        )}
        {invoices.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{inv.title}</div>
                  <div className="text-xs text-muted-foreground">Student ID: {inv.student_id}</div>
                </div>
                <div className="text-right">
                  <InvoiceAmountSummary inv={inv} receipts={receipts} />
                  <div
                    className={`text-xs ${inv.status === "Paid" ? "text-green-600" : inv.status === "Under Review" ? "text-amber-600" : "text-red-600"}`}
                  >
                    {inv.status}
                  </div>
                </div>
              </div>
              {!isParent && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReceiptForm((f) => ({ ...f, invoice_id: String(inv.id) }))}
                  >
                    Record Receipt for #{inv.id}
                  </Button>
                </div>
              )}

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setInvoices((prev) =>
                        prev.map((x) =>
                          x.id === inv.id ? { ...x, status: "Paid" } : x,
                        ),
                      )
                    }
                  >
                    Mark Paid
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setInvoices((prev) =>
                        prev.map((x) =>
                          x.id === inv.id
                            ? { ...x, status: "Under Review" }
                            : x,
                        ),
                      )
                    }
                  >
                    Mark Review
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setInvoices((prev) => prev.filter((x) => x.id !== inv.id))
                    }
                  >
                    Delete
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
