export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic'; 

const OAuth2RedirectPage = dynamicImport(
  () => import('./oauth2redirectpage'),
  {
    ssr: false,
    loading: () => <p>로그인 처리 중…</p>,
  }
);

export default function Page() {
  return <OAuth2RedirectPage />;
}
