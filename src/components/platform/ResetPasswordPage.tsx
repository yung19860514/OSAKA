"use client";

// 重設密碼：玩家點了重設密碼信裡的連結，會帶著一次性的登入狀態回到這頁，在這裡設定新密碼。
// 其他儲值管道自動建立的會員，也是用「忘記密碼 → 這頁」第一次設定密碼。

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlatformFrame from "./PlatformFrame";
import { MIN_PASSWORD, auth, validPassword, type AuthError } from "@/platform/auth";
import { useUser } from "@/platform/useUser";
import { useT } from "@/i18n";

export default function ResetPasswordPage() {
  return (
    <PlatformFrame nav={false}>
      {() => (
        <main className="pf-main pf-account">
          <ResetForm />
        </main>
      )}
    </PlatformFrame>
  );
}

function ResetForm() {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);

  // 連結失效（或直接打開這頁）＝沒有登入狀態
  if (user.kind !== "member") {
    return (
      <section className="pf-panel pf-account-guest">
        <h1>{t("auth.reset.title")}</h1>
        <p>{t("auth.reset.invalid")}</p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validPassword(password)) return setError("weak_password");
    setBusy(true);
    const r = await auth.setNewPassword(password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    alert(t("auth.reset.done"));
    router.replace("/account");
  };

  return (
    <form className="pf-panel pf-auth" onSubmit={submit} noValidate>
      <h1>{t("auth.reset.title")}</h1>
      <p>{t("auth.reset.desc")}</p>
      <p className="pf-form-info">{user.email}</p>
      <label className="pf-field">
        <span>{t("auth.password")}</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={error === "weak_password"} />
        <small>{t("auth.pwRule", { n: MIN_PASSWORD })}</small>
      </label>
      {error && (
        <p className="pf-form-error" role="alert">
          {t(`auth.err.${error}`)}
        </p>
      )}
      <button className="pf-btn pf-btn-primary pf-btn-lg" type="submit" disabled={busy}>
        {busy ? t("auth.wait") : t("auth.reset.btn")}
      </button>
    </form>
  );
}
