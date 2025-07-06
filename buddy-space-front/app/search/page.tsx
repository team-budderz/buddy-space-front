import { Suspense } from "react";
import SearchClient from "./searchclient";

export default function Page() {
  return (
    <Suspense fallback={<p>검색 중…</p>}>
      <SearchClient />
    </Suspense>
  );
}
