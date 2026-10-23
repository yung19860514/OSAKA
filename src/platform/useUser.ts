"use client";

import { useSyncExternalStore } from "react";
import { auth, type PlatformUser } from "./auth";

const SERVER_USER: PlatformUser = { kind: "guest", id: "", name: "" };

/** 目前登入的平台帳號（登入、登出、其他分頁變動時自動更新畫面） */
export function useUser(): PlatformUser {
  return useSyncExternalStore(auth.subscribe, auth.currentUser, () => SERVER_USER);
}
