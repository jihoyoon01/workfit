'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearLogin, getAdminName, getToken } from '@/lib/api';

const NAV = [
  { href: '/admin', label: '대시보드', exact: true },
  { href: '/admin/courses', label: '과정·콘텐츠 관리' },
  { href: '/admin/resources', label: '실무자료 관리' },
  { href: '/admin/tags', label: '검색 태그 관리' },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setName(getAdminName());
    setReady(true);
  }, [router]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* 서버가 꺼져 있어도 로그아웃 처리 */
    }
    clearLogin();
    router.replace('/login');
  }

  if (!ready) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          WorkFit<span>관리자</span>
        </div>
        {NAV.map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href) || (n.href === '/admin/courses' && pathname.startsWith('/admin/contents'));
          return (
            <Link key={n.href} href={n.href} className={`nav-link${active ? ' active' : ''}`}>
              {n.label}
            </Link>
          );
        })}
        <div className="sidebar-foot">
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{name || '관리자'}</div>
          <button className="btn ghost small" style={{ paddingLeft: 0 }} onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
