"use client";

// 平台各頁共用的外框：語言、上方導覽（含登入狀態）、頁尾、登入／註冊視窗。
// 網址帶 ?login=1（或 ?login=signup）會自動打開登入視窗，登入後跳到 ?next= 指定的頁面。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthDialog from "./AuthDialog";
import { currentRegion } from "@/game/shop";
import { useUser } from "@/platform/useUser";
import { platformLocale, setPlatformLocale } from "@/platform/prefs";
import { I18nContext, LOCALES, makeT, type Locale, type TFunc } from "@/i18n";

export interface FrameCtx {
  locale: Locale;
  t: TFunc;
  openLogin: (mode?: "signin" | "signup", next?: string) => void;
}

/** 站內路徑才允許跳轉（避免 ?next= 被拿來導去別的網站） */
const safeNext = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") ? p : null);

export default function PlatformFrame({ nav = true, children }: { nav?: boolean; children: (ctx: FrameCtx) => React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(platformLocale);
  const t = useMemo(() => makeT(locale), [locale]);
  const user = useUser();
  const region = currentRegion();
  const [login, setLogin] = useState<{ mode: "signin" | "signup"; next: string | null } | null>(() => {
    const q = new URLSearchParams(location.search);
    const l = q.get("login");
    return l ? { mode: l === "signup" ? "signup" : "signin", next: safeNext(q.get("next")) } : null;
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("platform.name");
  }, [locale, t]);

  const openLogin = (mode: "signin" | "signup" = "signin", next?: string) => setLogin({ mode, next: safeNext(next ?? null) });

  return (
    <I18nContext.Provider value={t}>
      <div className="pf">
        <header className="pf-head">
          <div className="pf-head-in">
            <Link className="pf-brand" href="/">
              <span className="pf-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="pf-brand-text">
                <b>PLAY HUB</b>
                <small>{t("platform.name")}</small>
              </span>
            </Link>
            {nav && (
              <nav className="pf-nav" aria-label={t("platform.nav")}>
                <Link href="/#games">{t("platform.navGames")}</Link>
                <Link href="/#news">{t("platform.navNews")}</Link>
                <Link href="/#pay">{t("platform.navPay")}</Link>
              </nav>
            )}
            <div className="pf-head-right">
              <div className="pf-seg" role="group" aria-label="Language">
                {LOCALES.map((l) => (
                  <button
                    key={l.id}
                    aria-pressed={locale === l.id}
                    onClick={() => {
                      setPlatformLocale(l.id);
                      setLocale(l.id);
                    }}
                  >
                    {l.id === "zh-TW" ? "中" : "EN"}
                  </button>
                ))}
              </div>
              {user.kind === "member" ? (
                <Link className="pf-btn pf-btn-ghost pf-user pf-user-on" href="/account">
                  <UserGlyph />
                  <span className="pf-user-name">{user.name}</span>
                  <small>{t("account.title")}</small>
                </Link>
              ) : (
                <>
                  <span className="pf-guest">
                    <UserGlyph />
                    {t("platform.guest", { name: user.name })}
                  </span>
                  <button className="pf-btn pf-btn-primary" onClick={() => openLogin("signin")}>
                    {t("platform.login")}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {children({ locale, t, openLogin })}

        <footer className="pf-foot">
          <div className="pf-foot-in">
            <div className="pf-foot-brand">
              <b>{t("platform.name")}</b>
              <p>{t("platform.taglineSub")}</p>
            </div>
            <div className="pf-foot-col">
              <b>{t("platform.footHelp")}</b>
              <span>{t("platform.payTitle")}</span>
              <span>{t("platform.contact")}</span>
            </div>
            <div className="pf-foot-col">
              <b>{t("platform.footLegal")}</b>
              <span>{t("platform.terms")}</span>
              <span>{t("platform.privacy")}</span>
              <span>{t("platform.ratingInfo")}</span>
            </div>
          </div>
          <div className="pf-foot-legal">
            <p>{t("platform.operator", { name: region.operator })}</p>
            <p>{t("platform.legalSoon")}</p>
          </div>
        </footer>

        {login && (
          <AuthDialog
            initialMode={login.mode}
            onClose={() => setLogin(null)}
            onDone={() => {
              if (login.next) router.push(login.next);
              else if (location.search.includes("login=")) router.replace(location.pathname);
            }}
          />
        )}
      </div>
    </I18nContext.Provider>
  );
}

export function UserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="5.5" r="3" fill="currentColor" />
      <path d="M2.5 14c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" fill="currentColor" />
    </svg>
  );
}

