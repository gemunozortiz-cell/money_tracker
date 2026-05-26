/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auth wrapper. Three states:
 *  - Supabase not configured → render the app (local-only mode, no sync)
 *  - Loading session → spinner
 *  - No user → login / signup screen
 *  - User signed in → render the app (children)
 */

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Loader2, Mail, Lock, LogIn, UserPlus, CheckCircle, AlertCircle } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading, signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signupOk, setSignupOk] = useState(false);

  // Supabase not configured → render the app in local-only mode
  if (!configured) return <>{children}</>;

  // Checking session from localStorage
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1221] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  // Already signed in → show the app
  if (user) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError("El correo es obligatorio.");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");

    setBusy(true);
    setError("");
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // onAuthStateChange will hide this screen automatically
      } else {
        const { error, needsConfirmation } = await signUp(email, password);
        if (error) throw error;
        if (needsConfirmation) {
          setSignupOk(true);
        }
        // else: signed in automatically (email confirmation disabled in Supabase)
      }
    } catch (e: any) {
      const msg = e?.message || "Error de autenticación";
      // Translate common Supabase errors to Spanish
      const translated =
        /Invalid login credentials/i.test(msg) ? "Email o contraseña incorrectos." :
        /User already registered/i.test(msg) ? "Ya existe una cuenta con ese correo. Intenta iniciar sesión." :
        /email.+not confirmed/i.test(msg) ? "Aún no confirmas tu correo. Revisa tu bandeja de entrada." :
        /Password should be at least/i.test(msg) ? "La contraseña debe tener al menos 6 caracteres." :
        msg;
      setError(translated);
    } finally {
      setBusy(false);
    }
  };

  // After signup, if email confirmation is required, show "check your email" screen
  if (signupOk) {
    return (
      <div className="min-h-screen bg-[#0c1221] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white/[0.04] rounded-3xl border border-emerald-500/30 p-6 text-center shadow-xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white font-display mb-2">¡Cuenta creada!</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Te mandamos un correo a <strong className="text-white">{email}</strong>.
            Ábrelo, haz click en el botón <strong className="text-emerald-300">"Confirm your mail"</strong>,
            y luego vuelve aquí para iniciar sesión.
          </p>
          <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
            Si no llegó en 1-2 min, revisa la carpeta de Spam.
          </p>
          <button
            onClick={() => { setSignupOk(false); setMode("signin"); setPassword(""); }}
            className="mt-4 w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1221] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient backgrounds */}
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-50px] left-[-50px] w-80 h-80 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-black text-2xl mx-auto mb-3 shadow-lg">
            $
          </div>
          <h1 className="text-2xl font-black font-display bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Control de Portafolio
          </h1>
          <p className="text-xs text-slate-400 mt-1">Finanzas personales sincronizadas</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/[0.04] rounded-3xl border border-white/10 p-5 space-y-3 shadow-2xl backdrop-blur-md">
          {/* Tab switcher */}
          <div className="flex gap-1 mb-3 p-1 bg-white/5 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); }}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                mode === "signin" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                mode === "signup" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Correo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-[#0d1527] border border-white/10 text-white text-sm rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:border-indigo-400 placeholder-slate-500"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-[#0d1527] border border-white/10 text-white text-sm rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:border-indigo-400 placeholder-slate-500"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
              />
            </div>
            {mode === "signup" && <p className="text-[10px] text-slate-500 mt-1">Mínimo 6 caracteres. Anótala porque la necesitarás en cada dispositivo.</p>}
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-2.5 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "signin" ? (
              <><LogIn className="w-4 h-4" /> Entrar</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Registrarme</>
            )}
          </button>
        </form>

        <p className="text-[10px] text-slate-500 text-center mt-4 leading-relaxed max-w-xs mx-auto">
          Tus datos se sincronizan entre dispositivos al iniciar sesión. Solo tú puedes leer tu portafolio gracias a Row Level Security.
        </p>
      </div>
    </div>
  );
}
