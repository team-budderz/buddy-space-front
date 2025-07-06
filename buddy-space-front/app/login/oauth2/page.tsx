"use client";

import { Suspense } from "react";
import OAuth2RedirectPage from "./oauth2redirectpage";

export default function Page() {
  return (
    <Suspense fallback={<p>로그인 처리 중…</p>}>
      <OAuth2RedirectPage />
    </Suspense>
  );
}
