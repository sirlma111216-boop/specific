"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}

let cachedApp: FirebaseApp | null = null;

function app(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase 환경변수가 설정되지 않았습니다. .env.local의 NEXT_PUBLIC_FIREBASE_* 값을 채워주세요. (SETUP.md 참고)",
    );
  }
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(config);
  }
  return cachedApp;
}

export function clientAuth(): Auth {
  return getAuth(app());
}
