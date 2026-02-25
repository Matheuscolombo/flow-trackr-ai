import { useState } from "react";
import { Shield, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Mode = "login" | "signup";

const LoginPage = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        setErrorMsg("E-mail ou senha incorretos.");
      } else {
        navigate("/");
      }
    } else {
      // Signup
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Conta criada! Entrando...");
        const { error: signInErr } = await signIn(email, password);
        if (!signInErr) navigate("/");
      }
    }
  };

  const toggleMode = () => {
    setMode((m) => m === "login" ? "signup" : "login");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-foreground uppercase">SENTINEL</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">
            Funnel Intelligence Engine
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-2xl">
          <h2 className="text-sm font-semibold text-foreground mb-5">
            {mode === "login" ? "Entrar na plataforma" : "Criar conta"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="bg-background border-border text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-background border-border text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 text-xs text-foreground bg-primary/10 border border-primary/20 rounded-lg p-3">
                {successMsg}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {mode === "login" ? "Entrando..." : "Criando conta..."}
                </div>
              ) : (
                mode === "login" ? "Entrar" : "Criar conta"
              )}
            </Button>
          </form>

          <p className="text-center text-[10px] text-muted-foreground mt-4">
            {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button onClick={toggleMode} className="text-primary hover:underline font-medium">
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          SENTINEL © 2025 · Funil Intelligence Engine
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

