"use client";

// 會員中心：基本資料、我的遊戲、訂單紀錄（含待繳費代碼）、修改密碼、登出、刪除帳號。

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlatformFrame from "./PlatformFrame";
import { productName } from "../Shop";
import { formatMoney } from "@/game/shop";
import { GAMES } from "@/platform/games";
import { MIN_PASSWORD, auth, gameAccounts, type AuthError } from "@/platform/auth";
import { listOrders } from "@/platform/orders";
import { useUser } from "@/platform/useUser";
import { useT } from "@/i18n";

export default function AccountPage() {
  return (
    <PlatformFrame nav={false}>
      {({ openLogin }) => (
        <main className="pf-main pf-account">
          <Account onLogin={openLogin} />
        </main>
      )}
    </PlatformFrame>
  );
}

function Account({ onLogin }: { onLogin: (mode?: "signin" | "signup") => void }) {
  const t = useT();
  const user = useUser();

  if (user.kind !== "member") {
    return (
      <section className="pf-panel pf-account-guest">
        <h1>{t("account.title")}</h1>
        <p>{t(auth.enabled ? "account.needLogin" : "platform.loginSoon")}</p>
        {auth.enabled && (
          <div className="pf-feature-cta">
            <button className="pf-btn pf-btn-primary pf-btn-lg" onClick={() => onLogin("signin")}>
              {t("auth.signIn")}
            </button>
            <button className="pf-btn pf-btn-ghost pf-btn-lg" onClick={() => onLogin("signup")}>
              {t("auth.signUp")}
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="pf-account-head">
        <h1>{t("account.hello", { name: user.name })}</h1>
        <SignOutButton />
      </div>
      <div className="pf-account-grid">
        <Profile />
        <Security />
        <MyGames />
        <Orders />
      </div>
    </>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

function Profile() {
  const t = useT();
  const user = useUser();
  const [name, setName] = useState(user.name);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (user.kind !== "member") return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await auth.updateProfile({ name });
    setMsg(r.ok ? { ok: true, text: t("account.saved") } : { ok: false, text: t(`auth.err.${r.error}`) });
  };
  return (
    <section className="pf-panel">
      <div className="pf-section-head">
        <h2>{t("account.profile")}</h2>
      </div>
      <form className="pf-form" onSubmit={save}>
        <label className="pf-field">
          <span>{t("account.name")}</span>
          <span className="pf-inline">
            <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
            <button className="pf-btn" type="submit" disabled={name.trim() === user.name}>
              {t("account.save")}
            </button>
          </span>
        </label>
        {msg && <p className={msg.ok ? "pf-form-ok" : "pf-form-error"}>{msg.text}</p>}
      </form>
      <dl className="pf-kv">
        <div>
          <dt>{t("auth.email")}</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>{t("account.region")}</dt>
          <dd>{t(`account.region.${user.regionId}` as "account.region.tw")}</dd>
        </div>
        <div>
          <dt>{t("account.joined")}</dt>
          <dd>{fmtDate(user.createdAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

function MyGames() {
  const t = useT();
  const [accounts] = useState(gameAccounts);
  return (
    <section className="pf-panel pf-account-wide">
      <div className="pf-section-head">
        <h2>{t("account.games")}</h2>
      </div>
      <ul className="pf-list">
        {GAMES.filter((g) => g.status === "live").map((g) => (
          <li key={g.id}>
            <span>
              <b>{t(`platform.game.${g.id}` as "platform.game.blockblitz")}</b>
              <small>{accounts[g.id] ? t("account.gameSince", { date: fmtDate(accounts[g.id]) }) : t("account.gameAuto")}</small>
            </span>
            <Link className="pf-btn" href={g.path}>
              {t("platform.play")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Orders() {
  const t = useT();
  const [orders] = useState(() => listOrders());
  return (
    <section className="pf-panel pf-account-wide">
      <div className="pf-section-head">
        <h2>{t("account.orders")}</h2>
      </div>
      {!orders.length ? (
        <p className="pf-empty">{t("shop.ordersEmpty")}</p>
      ) : (
        <ul className="pf-orders">
          {orders.map((o) => (
            <li key={o.orderId}>
              <div className="pf-order-main">
                <span className={`pf-order-status pf-order-${o.status}`}>{t(`shop.status.${o.status}`)}</span>
                <b>{o.lines.map((l) => `${productName(t, l.purchase)} ×${l.qty}`).join("、")}</b>
                <small>
                  {t(`platform.game.${o.gameId}` as "platform.game.blockblitz")}・{fmtDate(o.createdAt)}・{t("shop.orderNo", { id: o.orderId.replace(/-/g, "").slice(0, 10).toUpperCase() })}
                </small>
              </div>
              <span className="pf-order-total">{formatMoney(o.total)}</span>
              {o.status === "pending" && (
                <div className="pf-order-pay">
                  <span>{t("shop.payCodeAt", { store: o.payment.store })}</span>
                  <b>{o.payment.code.match(/.{1,4}/g)?.join(" ")}</b>
                  <small>{t("shop.payDeadline", { time: new Date(o.payment.expiresAt).toLocaleString() })}</small>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Security() {
  const t = useT();
  const router = useRouter();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState<AuthError | null>(null);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await auth.changePassword(oldPw, newPw);
    if (r.ok) {
      setOldPw("");
      setNewPw("");
    }
    setMsg(r.ok ? { ok: true, text: t("account.pwChanged") } : { ok: false, text: t(`auth.err.${r.error}`) });
  };
  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await auth.deleteAccount(delPw);
    if (!r.ok) return setDelErr(r.error);
    router.push("/");
  };

  return (
    <section className="pf-panel">
      <div className="pf-section-head">
        <h2>{t("account.security")}</h2>
      </div>
      <form className="pf-form" onSubmit={change}>
        <label className="pf-field">
          <span>{t("account.oldPw")}</span>
          <input type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </label>
        <label className="pf-field">
          <span>{t("account.newPw")}</span>
          <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <small>{t("auth.pwRule", { n: MIN_PASSWORD })}</small>
        </label>
        {msg && <p className={msg.ok ? "pf-form-ok" : "pf-form-error"}>{msg.text}</p>}
        <button className="pf-btn" type="submit" disabled={!oldPw || !newPw}>
          {t("account.changePw")}
        </button>
      </form>

      <div className="pf-danger">
        {!delOpen ? (
          <button className="pf-link-danger" onClick={() => setDelOpen(true)}>
            {t("account.delete")}
          </button>
        ) : (
          <form className="pf-form" onSubmit={remove}>
            <p className="pf-form-error">{t("account.deleteWarn")}</p>
            <label className="pf-field">
              <span>{t("account.deleteConfirm")}</span>
              <input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
            </label>
            {delErr && <p className="pf-form-error">{t(`auth.err.${delErr}`)}</p>}
            <div className="pf-inline">
              <button className="pf-btn pf-btn-danger" type="submit" disabled={!delPw}>
                {t("account.deleteBtn")}
              </button>
              <button className="pf-btn pf-btn-ghost" type="button" onClick={() => setDelOpen(false)}>
                {t("account.cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function SignOutButton() {
  const t = useT();
  const router = useRouter();
  return (
    <button
      className="pf-btn pf-btn-ghost"
      onClick={async () => {
        await auth.signOut();
        router.push("/");
      }}
    >
      {t("account.signOut")}
    </button>
  );
}
