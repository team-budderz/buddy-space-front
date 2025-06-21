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
      <body>
        <ConditionalNavbar />
        {children}
        </body>
    </html>
  );
}