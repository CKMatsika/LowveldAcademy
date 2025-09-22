import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch, setToken, getToken } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [email, setEmail] = useState("admin@lowveld.local");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = location.state?.from?.pathname || "/";

  // Check if already authenticated
  useEffect(() => {
    const token = getToken();
    if (token) {
      console.log('Token found, redirecting to dashboard');
      navigate('/', { replace: true });
    }
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      console.log('Attempting login with:', email);
      const res = await apiFetch<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      console.log('Login successful, token received');
      setToken(res.token);

      // Store user info
      localStorage.setItem('user', JSON.stringify(res.user));

      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setError(() => {
        try {
          const o = JSON.parse(err.message);
          return o.error || "Login failed";
        } catch {
          return err.message || "Login failed";
        }
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-xs text-center text-muted-foreground">
              Don’t have an account? <Link to="/register" className="underline">Sign up as parent</Link> • <Link to="#" className="underline">Ask admin</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
