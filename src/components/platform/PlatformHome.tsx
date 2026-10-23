"use client";

// 平台大廳：一個帳號玩所有遊戲。
// 版面參考台灣遊戲入口網站慣例：上方導覽 → 主打輪播 → 熱門遊戲 → 最新消息＋繳費說明 → 頁尾公司資訊。
// 主視覺一律用遊戲自己的畫面（不放空白佔位格）。會員系統未開放前以訪客身分遊玩。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BlockBlitzKeyArt from "@/games/blockblitz/KeyArt";
import { ItemIcon } from "@/multiplayer/MatchUI";
import { currentRegion, formatMoney, priceOf } from "@/game/shop";
import { GAMES, getGame, isAvailable, type GameInfo } from "@/platform/games";
import { NEWS } from "@/platform/content";
import { ensureGameAccount } from "@/platform/auth";
import PlatformFrame from "./PlatformFrame";
import MapOverlay from "./MapOverlay";
import { useT, type TFunc } from "@/i18n";

const SLIDE_MS = 6500;

export default function PlatformHome() {
  const router = useRouter();
  const region = currentRegion();
  // 可以玩的在前，「即將開放」的列在後面（按鈕停用）
  const games = [...GAMES.filter((g) => isAvailable(g, region)), ...GAMES.filter((g) => g.status === "soon" && region.active && !region.excludedGames?.includes(g.id))];

  // 舊的對戰邀請連結（/?room=XXXXX）→ 轉到遊戲頁
  useEffect(() => {
    const room = new URLSearchParams(location.search).get("room");
    if (room && /^[A-Z2-9]{5}$/i.test(room))
      router.replace(`/play/blockblitz?room=${room.toUpperCase()}`);
  }, [router]);

  const play = useCallback(
    (g: GameInfo, query = "") => {
      ensureGameAccount(g.id);
      router.push(g.path + query);
    },
    [router],
  );

  return (
    <PlatformFrame>
      {({ locale, t }) => (
        <>
          <Hero t={t} onPlay={(id, q) => play(getGame(id)!, q)} />

          <main className="pf-main">
            <section id="games" className="pf-section">
              <div className="pf-section-head">
                <h2><i className="pf-idx">01</i>{t("platform.hotGames")}</h2>
              </div>
              {games.length <= 2 ? (
                games.map((g) => (
                  <FeaturedGame
                    key={g.id}
                    game={g}
                    onPlay={(q) => play(g, q)}
                  />
                ))
              ) : (
                <ul className="pf-grid">
                  {games.map((g) => (
                    <li key={g.id} className={g.status === "soon" ? "pf-card pf-card-soon" : "pf-card"}>
                      <button
                        className="pf-card-art"
                        disabled={g.status === "soon"}
                        onClick={() => play(g)}
                        aria-label={t("platform.playGame", {
                          name: t(
                            `platform.game.${g.id}` as "platform.game.blockblitz",
                          ),
                        })}
                      >
                        <GameArt id={g.id} />
                        <span className="pf-card-play">
                          {g.status === "soon" ? t("platform.soon") : `▶ ${t("platform.play")}`}
                        </span>
                      </button>
                      <div className="pf-card-body">
                        <div className="pf-card-title">
                          <h3>
                            {t(
                              `platform.game.${g.id}` as "platform.game.blockblitz",
                            )}
                          </h3>
                          <span className="pf-rating">
                            {t(`platform.rating.${g.rating}`)}
                          </span>
                        </div>
                        <p>
                          {t(
                            `platform.gameDesc.${g.id}` as "platform.gameDesc.blockblitz",
                          )}
                        </p>
                        <div className="pf-tags">
                          <span>{t("platform.players", { n: g.players })}</span>
                          <span>{t("platform.browser")}</span>
                          {g.paid && <span>{t("platform.paid")}</span>}
                        </div>
                        <button className="pf-btn pf-btn-primary pf-card-btn" disabled={g.status === "soon"} onClick={() => play(g)}>
                          {g.status === "soon" ? t("platform.soon") : `▶ ${t("platform.playNow")}`}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="pf-two">
              <section id="news" className="pf-section pf-panel">
                <div className="pf-section-head">
                  <h2><i className="pf-idx">02</i>{t("platform.news")}</h2>
                </div>
                <ul className="pf-news">
                  {NEWS.map((n) => {
                    const [y, m, d] = n.date.split("-");
                    const title = locale === "zh-TW" ? n.title : n.titleEn;
                    return (
                      <li key={n.date + n.title}>
                        <span className="pf-date">
                          <b>
                            {m}/{d}
                          </b>
                          <small>{y}</small>
                        </span>
                        <span className={`pf-news-tag pf-news-${n.tag}`}>
                          {t(`platform.newsTag.${n.tag}`)}
                        </span>
                        {n.href ? (
                          <Link className="pf-news-title" href={n.href}>
                            {title}
                          </Link>
                        ) : (
                          <span className="pf-news-title">{title}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <aside id="pay" className="pf-section pf-panel pf-pay">
                <div className="pf-section-head">
                  <h2><i className="pf-idx">03</i>{t("platform.payTitle")}</h2>
                </div>
                <div className="pf-stores">
                  {region.cvs.stores.map((s) => (
                    <span key={s} className="pf-store">
                      {s}
                    </span>
                  ))}
                  <span className="pf-store-note">{t("platform.payCvs")}</span>
                </div>
                <ol className="pf-steps">
                  <li>{t("platform.payStep1")}</li>
                  <li>{t("platform.payStep2")}</li>
                  <li>
                    {t("platform.payStep3", { d: region.cvs.expireDays })}
                  </li>
                  <li>{t("platform.payStep4")}</li>
                </ol>
              </aside>
            </div>
          </main>
        </>
      )}
    </PlatformFrame>
  );
}

/** 主打輪播的一張：photo＝遊戲宣傳圖；bb＝方塊消消的動態畫面；promo＝商城活動 */
interface Slide {
  key: string;
  kind: "photo" | "bb" | "promo";
  img?: string;
  gameId: string;
  query?: string;
  /** 宣傳圖上已經有遊戲名稱就不再放大標題 */
  title?: string;
  kicker: string;
  desc: string;
  cta: string;
  soon?: boolean;
}

/** 主打輪播：每款遊戲一張＋商城活動 */
function Hero({ t, onPlay }: { t: TFunc; onPlay: (gameId: string, query?: string) => void }) {
  const rookie = priceOf({ kind: "bundle", id: "rookie" });
  const slides: Slide[] = [
    { key: "mjys", kind: "photo", img: "/games/mjys/keyart.jpg", gameId: "mjys", kicker: t("platform.mjysKicker"), desc: t("platform.mjysHero"), cta: t("platform.playNow") },
    { key: "xiantu", kind: "photo", img: "/games/xiantu/banner.jpg", gameId: "xiantu", kicker: t("platform.xiantuKicker"), desc: t("platform.xiantuHero"), cta: t("platform.playNow") },
    { key: "sanguo", kind: "photo", img: "/games/sanguo/banner.jpg", gameId: "sanguo", kicker: t("platform.sanguoKicker"), desc: t("platform.sanguoHero"), cta: t("platform.soon"), soon: true },
    { key: "bb", kind: "bb", gameId: "blockblitz", title: t("platform.game.blockblitz"), kicker: t("platform.heroKicker"), desc: t("platform.heroDesc"), cta: t("platform.playNow") },
    {
      key: "promo",
      kind: "promo",
      gameId: "blockblitz",
      query: "?shop=items",
      title: t("shop.bundle.rookie"),
      kicker: t("platform.promoKicker"),
      desc: t("platform.promoDesc", { price: rookie ? formatMoney(rookie) : "" }),
      cta: t("platform.promoCta"),
    },
  ];
  const count = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setI((n) => (n + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [i, paused, count]);

  return (
    <section className="pf-hero" aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="pf-hero-track">
        <div className="pf-slides" style={{ transform: `translateX(-${i * 100}%)` }}>
          {slides.map((sl, k) => (
            <div key={sl.key} className={`pf-slide pf-slide-${sl.kind}`} aria-hidden={i !== k}>
              {sl.kind === "photo" && (
                // eslint-disable-next-line @next/next/no-img-element -- 遊戲方提供的宣傳圖
                <img src={sl.img} alt={t(`platform.game.${sl.gameId}` as "platform.game.mjys")} className="pf-slide-art" />
              )}
              {sl.kind === "bb" && <BlockBlitzKeyArt variant="banner" className="pf-slide-art" />}
              {sl.kind === "promo" && (
                <div className="pf-promo-icons" aria-hidden="true">
                  {(["bomb", "shield", "rain", "ink", "speed", "freeze", "longbar", "steal", "mirror", "cleanse"] as const).map((id) => (
                    <span key={id}>
                      <ItemIcon id={id} size={40} />
                    </span>
                  ))}
                </div>
              )}
              {sl.kind !== "promo" && <MapOverlay label={`${sl.gameId.toUpperCase()} · ${String(k + 1).padStart(2, "0")}`} />}
              <div className={sl.kind === "photo" ? "pf-slide-text pf-slide-text-bottom" : "pf-slide-text"}>
                <span className="pf-kicker">{sl.kicker}</span>
                {sl.title && <h1>{sl.title}</h1>}
                <p>{sl.desc}</p>
                <div className="pf-slide-cta">
                  <button
                    className="pf-btn pf-btn-primary pf-btn-lg"
                    tabIndex={i === k ? 0 : -1}
                    disabled={sl.soon}
                    onClick={() => onPlay(sl.gameId, sl.query)}
                  >
                    {sl.soon ? sl.cta : `▶ ${sl.cta}`}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pf-hero-count" aria-hidden="true">
          <b>{String(i + 1).padStart(2, "0")}</b>
          <span />
          {String(count).padStart(2, "0")}
        </div>
        <button className="pf-hero-nav pf-hero-prev" aria-label={t("platform.prev")} onClick={() => setI((n) => (n + count - 1) % count)}>
          ‹
        </button>
        <button className="pf-hero-nav pf-hero-next" aria-label={t("platform.next")} onClick={() => setI((n) => (n + 1) % count)}>
          ›
        </button>
      </div>
    </section>
  );
}

function GameArt({ id }: { id: string }) {
  if (id === "blockblitz")
    return <BlockBlitzKeyArt variant="card" className="pf-card-canvas" />;
  // eslint-disable-next-line @next/next/no-img-element -- 遊戲方提供的宣傳圖
  if (id === "mjys") return <img src="/games/mjys/keyart.jpg" alt="" className="pf-card-canvas pf-card-photo" />;
  // eslint-disable-next-line @next/next/no-img-element -- 遊戲方提供的素材合成
  if (id === "sanguo" || id === "xiantu") return <img src={`/games/${id}/card.jpg`} alt="" className="pf-card-canvas pf-card-photo" />;
  return null;
}

/** 主打遊戲展示區（遊戲還少的時候用）：左邊大圖，右邊介紹＋玩法＋入口 */
function FeaturedGame({
  game,
  onPlay,
}: {
  game: GameInfo;
  onPlay: (query?: string) => void;
}) {
  const t = useT();
  const name = t(`platform.game.${game.id}` as "platform.game.blockblitz");
  return (
    <article className="pf-feature">
      <button
        className="pf-feature-art"
        onClick={() => onPlay()}
        aria-label={t("platform.playGame", { name })}
      >
        <GameArt id={game.id} />
        <span className="pf-card-play">▶ {t("platform.play")}</span>
      </button>
      <div className="pf-feature-body">
        <div className="pf-card-title">
          <h3>{name}</h3>
          <span className="pf-rating">
            {t(`platform.rating.${game.rating}`)}
          </span>
        </div>
        <p className="pf-feature-desc">
          {t(`platform.gameDesc.${game.id}` as "platform.gameDesc.blockblitz")}
        </p>
        <dl className="pf-modes">
          <div>
            <dt>{t(`platform.${game.id}.mode1` as "platform.blockblitz.mode1")}</dt>
            <dd>{t(`platform.${game.id}.mode1Sub` as "platform.blockblitz.mode1Sub")}</dd>
          </div>
          <div>
            <dt>{t(`platform.${game.id}.mode2` as "platform.blockblitz.mode1")}</dt>
            <dd>{t(`platform.${game.id}.mode2Sub` as "platform.blockblitz.mode1Sub")}</dd>
          </div>
          <div>
            <dt>{t(`platform.${game.id}.mode3` as "platform.blockblitz.mode1")}</dt>
            <dd>{t(`platform.${game.id}.mode3Sub` as "platform.blockblitz.mode1Sub")}</dd>
          </div>
        </dl>
        <div className="pf-tags">
          <span>{t("platform.players", { n: game.players })}</span>
          <span>{t("platform.browser")}</span>
          {game.paid && <span>{t("platform.paid")}</span>}
        </div>
        <div className="pf-feature-cta">
          <button
            className="pf-btn pf-btn-primary pf-btn-lg"
            onClick={() => onPlay()}
          >
            ▶ {t("platform.playNow")}
          </button>
          <button
            className="pf-btn pf-btn-ghost pf-btn-lg"
            onClick={() => onPlay("?shop=items")}
          >
            {t("platform.toShop")}
          </button>
        </div>
      </div>
    </article>
  );
}
