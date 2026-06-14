import { useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { adminApi } from '../services/api';

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
  const toast = useRef(null);
  const fileInputRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentLabel = NAV.find(n => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))?.label || 'Dashboard';

  const handleBackup = async () => {
    setBusy(true);
    try {
      const res = await adminApi.backup();
      const kb = (res.data.size / 1024).toFixed(1);
      const c = res.data.counts || {};
      const totals = `${c.bills || 0} bills, ${c.payments || 0} payments, ${c.customers || 0} customers`;
      if (res.data.verified) {
        toast.current.show({
          severity: 'success',
          summary: 'Backup created (verified)',
          detail: `${res.data.filename} — ${kb} KB · contains ${totals}. Your live data is untouched.`,
          life: 6000,
        });
      } else {
        toast.current.show({
          severity: 'warn',
          summary: 'Backup created but counts differ',
          detail: `${res.data.filename} — mismatched: ${res.data.mismatched.join(', ')}. Live data is unchanged.`,
          life: 9000,
        });
      }
    } catch (err) {
      toast.current.show({
        severity: 'error',
        summary: 'Backup failed',
        detail: err?.response?.data?.error || err.message,
      });
    } finally { setBusy(false); }
  };

  const onPickRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    let preview;
    try {
      const buf = await file.arrayBuffer();
      const res = await adminApi.previewRestore(buf);
      preview = res.data;
    } catch (err) {
      setBusy(false);
      toast.current.show({
        severity: 'error',
        summary: 'Cannot read backup file',
        detail: err?.response?.data?.error || err.message,
      });
      return;
    }
    setBusy(false);

    const summary = (c) =>
      `${c.bills || 0} bills · ${c.payments || 0} payments · ${c.customers || 0} customers · ${c.bill_items || 0} bill items`;

    confirmDialog({
      message: (
        <div style={{ lineHeight: 1.5 }}>
          <div style={{ marginBottom: 8 }}>
            File: <strong>{file.name}</strong>
          </div>
          <div style={{ background: '#fff3e0', border: '1px solid #ffd9a8', padding: '8px 10px', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
            <strong>Current data</strong> (will be replaced):<br />
            {summary(preview.current)}
          </div>
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', padding: '8px 10px', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
            <strong>Backup contents</strong> (will become your live data):<br />
            {summary(preview.incoming)}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            A safety snapshot of the current data is saved automatically as <code>sas-pre-restore-…db</code> in <code>server/backups/</code>, so you can roll back if needed.
          </div>
        </div>
      ),
      header: 'Confirm Restore',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Replace live data',
      rejectLabel: 'Cancel',
      accept: () => doRestore(file),
    });
  };

  const doRestore = async (file) => {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const res = await adminApi.restore(buf);
      toast.current.show({
        severity: 'success',
        summary: 'Restore complete',
        detail: `Pre-restore safety backup: ${res.data.preRestoreBackup}. Reloading…`,
        life: 3000,
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.current.show({
        severity: 'error',
        summary: 'Restore failed',
        detail: err?.response?.data?.error || err.message,
      });
      setBusy(false);
    }
  };

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

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button
              label="Backup"
              icon="pi pi-download"
              className="p-button-sm p-button-outlined"
              onClick={handleBackup}
              loading={busy}
              tooltip="Save a copy of the current database into server/backups/"
              tooltipOptions={{ position: 'bottom' }}
            />
            <Button
              label="Restore"
              icon="pi pi-upload"
              className="p-button-sm p-button-outlined p-button-warning"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              tooltip="Replace the current database with a backup file"
              tooltipOptions={{ position: 'bottom' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,application/octet-stream"
              onChange={onPickRestoreFile}
              style={{ display: 'none' }}
            />
          </div>
        </header>
        <Toast ref={toast} />
        <ConfirmDialog />

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
