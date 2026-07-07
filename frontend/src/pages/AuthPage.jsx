import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioWaveform } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errText } from "../lib/api";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ identifier: "", password: "", username: "", name: "", contact: "" });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.identifier, form.password);
      } else {
        const isEmail = form.contact.includes("@");
        await register({
          username: form.username, name: form.name, password: form.password,
          email: isEmail ? form.contact : undefined,
          mobile: !isEmail ? form.contact : undefined,
        });
      }
      navigate("/");
    } catch (e2) {
      setError(errText(e2));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#C4B5FD]/50 focus:bg-white/[0.07] transition-colors";

  return (
    <div className="min-h-screen bg-[#0A0A0E] text-slate-50 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#C4B5FD]/5 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#93C5FD]/5 blur-[120px]" />

      <div className="w-full max-w-md fade-up relative z-10">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <AudioWaveform className="w-8 h-8 text-[#C4B5FD]" />
          <h1 className="font-heading text-3xl font-light tracking-tight">Resonance</h1>
        </div>
        <div className="glass rounded-3xl p-8">
          <h2 className="font-heading text-lg font-medium mb-1">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="text-sm text-slate-400 mb-6">{mode === "login" ? "Sign in with email, mobile or username" : "High resolution music awaits"}</p>
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <>
                <input data-testid="register-name" className={inputCls} placeholder="Full name" value={form.name} onChange={set("name")} required />
                <input data-testid="register-username" className={inputCls} placeholder="Unique username" value={form.username} onChange={set("username")} required />
                <input data-testid="register-contact" className={inputCls} placeholder="Email or mobile number" value={form.contact} onChange={set("contact")} required />
              </>
            )}
            {mode === "login" && (
              <input data-testid="login-identifier" className={inputCls} placeholder="Email, mobile or username" value={form.identifier} onChange={set("identifier")} required />
            )}
            <input data-testid="auth-password" className={inputCls} type="password" placeholder="Password" value={form.password} onChange={set("password")} required />
            {error && <p data-testid="auth-error" className="text-sm text-red-400">{error}</p>}
            <button data-testid="auth-submit" type="submit" disabled={busy}
              className="w-full py-3.5 rounded-xl bg-[#C4B5FD] text-[#0A0A0E] font-medium text-sm hover:bg-[#d4c9fe] transition-colors disabled:opacity-50">
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
            </button>
          </form>
          <button data-testid="auth-switch-mode" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="w-full mt-5 text-sm text-slate-400 hover:text-white transition-colors">
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
