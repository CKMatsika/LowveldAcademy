import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function ParentRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<{ user: any; token: string; message: string }>("/api/parents/register", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      setSuccess(res.message);
      // Store user info and token
      localStorage.setItem('user', JSON.stringify(res.user));
      localStorage.setItem('auth.token', res.token);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(() => {
        try {
          const o = JSON.parse(err.message);
          return o.error || "Registration failed";
        } catch {
          return err.message || "Registration failed";
        }
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Parent Registration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create an account to access your children's information
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Full Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Phone Number"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
            />
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Address (optional)"
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
            />

            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-600">{success}</div>}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-xs text-center text-muted-foreground">
              Already have an account? <Link to="/login" className="underline">Sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
