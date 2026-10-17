import './globals.css';

export const metadata = {
  title: 'WorkFit 관리자',
  description: 'WorkFit 콘텐츠 업로드·관리 모듈',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
