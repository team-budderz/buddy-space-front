import { Suspense } from "react";
import CallbackClient from "./callbackclient";

export const dynamic = 'force-dynamic'; 
export default function Page() {
  return (
    <Suspense fallback={<p>로그인 처리 중…</p>}>
      <CallbackClient />
    </Suspense>
  );
}
