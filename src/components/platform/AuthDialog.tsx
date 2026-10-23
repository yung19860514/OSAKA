"use client";

// 登入／註冊視窗。註冊只需要 Email＋密碼。
// 模擬會員系統期間，視窗下方會註明「資料只存在這台電腦」。

import { useEffect, useRef, useState } from "react";
import { MIN_PASSWORD, auth, validEmail, validPassword, type AuthError } from "@/platform/auth";
import { useT } from "@/i18n";

type Mode = "signin" | "signup";

export default function AuthDialog({ initialMode = "signin", onClose, onDone }: { initialMode?: Mode; onClose: () => void; onDone?: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!auth.enabled) {
    return (
      <div className="pf-modal" role="dialog" aria-modal="true" aria-label={t("platform.login")} onClick={onClose}>
        <div className="pf-dialog" onClick={(e) => e.stopPropagation()}>
          <h3>{t("platform.login")}</h3>
          <p>{t("platform.loginSoon")}</p>
          <button className="pf-btn pf-btn-primary" onClick={onClose}>
            {t("platform.asGuest")}
          </button>
        </div>
      </div>
    );
  }

  const pwHint = mode === "signup" && password.length > 0 && !validPassword(password);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validEmail(email)) return setError("bad_email");
    if (mode === "signup" && !validPassword(password)) return setError("weak_password");
    setBusy(true);
    const r = mode === "signup" ? await auth.signUp({ email, password }) : await auth.signIn({ email, password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone?.();
    onClose();
  };

  return (
    <div className="pf-modal" role="dialog" aria-modal="true" aria-label={t(mode === "signup" ? "auth.signUp" : "auth.signIn")} onClick={onClose}>
      <form className="pf-dialog pf-auth" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="pf-auth-tabs" role="tablist">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {t(m === "signup" ? "auth.signUp" : "auth.signIn")}
            </button>
          ))}
        </div>

        <label className="pf-field">
          <span>{t("auth.email")}</span>
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            aria-invalid={error === "bad_email" || error === "email_taken"}
          />
        </label>

        <label className="pf-field">
          <span>{t("auth.password")}</span>
          <span className="pf-pw">
            <input
              type={showPw ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error === "weak_password" || error === "bad_credentials"}
              aria-describedby="pw-rule"
            />
            <button type="button" className="pf-pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={t(showPw ? "auth.hidePw" : "auth.showPw")}>
              {t(showPw ? "auth.hide" : "auth.show")}
            </button>
          </span>
          {mode === "signup" && (
            <small id="pw-rule" className={pwHint ? "pf-field-warn" : ""}>
              {t("auth.pwRule", { n: MIN_PASSWORD })}
            </small>
          )}
        </label>

        {mode === "signup" && (
          <label className="pf-check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{t("auth.agree")}</span>
          </label>
        )}

        {error && (
          <p className="pf-form-error" role="alert">
            {t(`auth.err.${error}`)}
          </p>
        )}

        <button className="pf-btn pf-btn-primary pf-btn-lg" type="submit" disabled={busy || (mode === "signup" && !agree)}>
          {busy ? t("auth.wait") : t(mode === "signup" ? "auth.signUpBtn" : "auth.signInBtn")}
        </button>

        <div className="pf-social">
          <span>{t("auth.or")}</span>
          <button type="button" className="pf-btn pf-btn-ghost" disabled title={t("auth.soon")}>
            Google
          </button>
          <button type="button" className="pf-btn pf-btn-ghost" disabled title={t("auth.soon")}>
            LINE
          </button>
        </div>

        {auth.mode === "mock" && <p className="pf-mock-note">{t("auth.mockNote")}</p>}
      </form>
    </div>
  );
}
