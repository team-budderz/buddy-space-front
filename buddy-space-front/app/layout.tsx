import './globals.css';
import ConditionalNavbar from './components/conditionalnavbar';

export const metadata = {
  title: 'My App',
  description: 'Next.js App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css"
        precedence="default"
      />
      <body>
        <ConditionalNavbar />
        {children}
      </body>
    </html>
  );
}