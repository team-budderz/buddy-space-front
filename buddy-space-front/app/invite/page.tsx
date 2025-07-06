import { Suspense } from "react";

import SearchClient from "./inviteclient";

export default function Page() {
  return (
    <Suspense fallback={<p>로딩 중…</p>}>
      <SearchClient />
    </Suspense>
  );
}
