import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'primereact/button';

const NAV = [
  { label: 'Add Bill',    icon: 'pi pi-plus-circle', path: '/addbill' },
  { label: 'View Bills',  icon: 'pi pi-list',        path: '/vib' },
  { label: 'Payments',    icon: 'pi pi-credit-card', path: '/payments' },
  { label: 'Reports',     icon: 'pi pi-chart-bar',   path: '/balance' },
  { label: 'Master Data', icon: 'pi pi-cog',         path: '/ac' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const currentLabel = NAV.find(n => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))?.label || 'Dashboard';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <nav style={{
        width: collapsed ? 60 : 220,
        minWidth: collapsed ? 60 : 220,
        backgroundColor: '#1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.18)',
        zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{
          height: 58,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}>
          {!collapsed && (
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
              <i className="pi pi-building" style={{ color: '#64b5f6', marginRight: 8 }} />
              SAS Accounts
            </span>
          )}
          <Button
            icon={collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}
            className="p-button-text p-button-rounded p-button-sm"
            style={{ color: 'rgba(255,255,255,0.75)', padding: 4, minWidth: 32 }}
            onClick={() => setCollapsed(c => !c)}
          />
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, paddingTop: 8 }}>
          {NAV.map(item => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <div
                key={item.path}
                title={collapsed ? item.label : ''}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: collapsed ? '13px 0' : '13px 20px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  cursor: 'pointer',
                  backgroundColor: active ? 'rgba(100,181,246,0.18)' : 'transparent',
                  borderLeft: active ? '3px solid #64b5f6' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <i className={item.icon} style={{ color: active ? '#64b5f6' : 'rgba(255,255,255,0.65)', fontSize: 17 }} />
                {!collapsed && (
                  <span style={{ color: active ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!collapsed && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>SAS v1.0 • Local</span>
          </div>
        )}
      </nav>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f0f2f5' }}>
        {/* Topbar */}
        <header style={{
          height: 58,
          backgroundColor: '#fff',
          borderBottom: '1px solid #e0e6f0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          gap: 10,
        }}>
          <i className="pi pi-angle-right" style={{ color: '#aaa', fontSize: 13 }} />
          <span style={{ color: '#1e3a5f', fontWeight: 600, fontSize: 15 }}>{currentLabel}</span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
