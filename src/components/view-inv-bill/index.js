import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { billsApi, customersApi, placesApi, paymentsApi } from '../../services/api';

const fmt = (v) => `₹ ${parseFloat(v || 0).toFixed(2)}`;
const fmtQty = (q) => {
  const n = parseFloat(q) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const toLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const stripBase = (name) => {
  if (!name) return '';
  const i = name.indexOf(' - ');
  return i >= 0 ? name.substring(i + 3).trim() : name;
};

// Merge bills + payments into a dated ledger. Splits at fromStr/toStr:
// entries before fromStr collapse into previousBalance; entries after toStr are dropped;
// entries inside the period are returned with running balance (newest-first).
function buildStatement(bills, payments, fromStr, toStr) {
  const entries = [
    ...bills.map(b => ({
      _type: 'bill', _date: (b.bill_date || '').substring(0, 10), _order: 0,
      id: b.id, daily_no: b.daily_no, date: b.bill_date,
      debit: parseFloat(b.total_amount || 0), credit: 0,
      items: b.items || [],
    })),
    ...payments.map(p => ({
      _type: 'payment', _date: (p.payment_date || '').substring(0, 10), _order: 1,
      id: p.id, date: p.payment_date,
      debit: 0, credit: parseFloat(p.amount || 0),
      notes: p.notes || '',
    })),
  ];

  entries.sort((a, b) => a._date < b._date ? -1 : a._date > b._date ? 1 : a._order - b._order);

  let previousBalance = 0;
  const periodEntries = [];
  for (const e of entries) {
    if (fromStr && e._date < fromStr) {
      previousBalance += e.debit - e.credit;
    } else if (toStr && e._date > toStr) {
      // outside upper bound — ignore
    } else {
      periodEntries.push(e);
    }
  }

  let bal = previousBalance;
  const withBalance = periodEntries.map(e => { bal += e.debit - e.credit; return { ...e, runningBalance: bal }; });

  const periodSales = periodEntries.reduce((s, e) => s + e.debit, 0);
  const periodPayments = periodEntries.reduce((s, e) => s + e.credit, 0);

  return {
    entries: withBalance.reverse(), // newest first for display
    previousBalance,
    periodSales,
    periodPayments,
    currentBalance: previousBalance + periodSales - periodPayments,
  };
}

export default function ViewInvBill() {
  const navigate = useNavigate();
  const toast = useRef(null);

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [places, setPlaces] = useState([]);

  const [filter, setFilter] = useState('');
  const [custFilter, setCustFilter] = useState(null);
  const [placeFilter, setPlaceFilter] = useState(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [statement, setStatement] = useState({ entries: [], previousBalance: 0, periodSales: 0, periodPayments: 0, currentBalance: 0 });
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    load();
    Promise.all([customersApi.getAll(), placesApi.getAll()]).then(([c, p]) => {
      setCustomers(c.data);
      setPlaces(p.data);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    try { setBills((await billsApi.getAll()).data); } finally { setLoading(false); }
  };

  const filteredBills = bills.filter(b => {
    if (filter && !b.customer_name?.toLowerCase().includes(filter.toLowerCase()) && !b.place_name?.toLowerCase().includes(filter.toLowerCase())) return false;
    if (custFilter && b.customer_id !== custFilter.id) return false;
    if (placeFilter && b.place_name !== placeFilter.name) return false;
    const d = (b.bill_date || '').substring(0, 10);
    if (fromDate && d < toLocalDate(fromDate)) return false;
    if (toDate && d > toLocalDate(toDate)) return false;
    return true;
  });

  const customerRows = useMemo(() => {
    const map = {};
    filteredBills.forEach(b => {
      if (!map[b.customer_id]) {
        map[b.customer_id] = {
          customer_id: b.customer_id, customer_name: b.customer_name,
          place_name: b.place_name || '—', bill_count: 0,
          total_billed: 0, total_paid: 0, total_balance: 0,
        };
      }
      const r = map[b.customer_id];
      r.bill_count++;
      r.total_billed += parseFloat(b.total_amount || 0);
      r.total_paid += parseFloat(b.paid_amount || 0);
      r.total_balance += parseFloat(b.balance || 0);
    });
    return Object.values(map).sort((a, b) => b.total_balance - a.total_balance);
  }, [filteredBills]);

  const totalBilled = customerRows.reduce((s, r) => s + r.total_billed, 0);
  const totalPaid = customerRows.reduce((s, r) => s + r.total_paid, 0);
  const totalBalance = customerRows.reduce((s, r) => s + r.total_balance, 0);

  const loadStatement = async (customerId) => {
    const [billsRes, pmtsRes] = await Promise.all([
      billsApi.getByCustomer(customerId),
      paymentsApi.getByCustomer(customerId),
    ]);
    const fromStr = fromDate ? toLocalDate(fromDate) : null;
    const toStr = toDate ? toLocalDate(toDate) : null;
    return buildStatement(billsRes.data, pmtsRes.data, fromStr, toStr);
  };

  const openDetail = async (row) => {
    setDetailCustomer(row);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      setStatement(await loadStatement(row.customer_id));
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load statement' });
    } finally { setDetailLoading(false); }
  };

  const deleteBill = (entry) => confirmDialog({
    message: `Delete Invoice #${entry.daily_no} dated ${fmtDate(entry.date)}?`,
    header: 'Confirm Delete', icon: 'pi pi-trash', acceptClassName: 'p-button-danger',
    accept: async () => {
      try {
        await billsApi.remove(entry.id);
        toast.current.show({ severity: 'success', summary: 'Deleted', detail: 'Bill deleted' });
        const updated = await loadStatement(detailCustomer.customer_id);
        setStatement(updated);
        if (updated.entries.filter(e => e._type === 'bill').length === 0) setDetailVisible(false);
        load();
      } catch {
        toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete' });
      }
    },
  });

  const periodLabel = (() => {
    const today = toLocalDate(new Date());
    const f = fromDate ? toLocalDate(fromDate) : null;
    const t = toDate ? toLocalDate(toDate) : null;
    if (f && t && f === t && f === today) return 'Today';
    if (f && t && f === t) return fmtDate(fromDate);
    if (f && t) return `${fmtDate(fromDate)} → ${fmtDate(toDate)}`;
    if (f) return `From ${fmtDate(fromDate)}`;
    if (t) return `Until ${fmtDate(toDate)}`;
    return 'All time';
  })();

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0, color: '#1e3a5f', fontSize: 20, fontWeight: 700 }}>
            <i className="pi pi-list" style={{ marginRight: 10, color: '#2196f3' }} />
            All Bills
          </h2>
          <Button label="New Bill" icon="pi pi-plus" onClick={() => navigate('/addbill')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <i className="pi pi-search" style={{ position: 'absolute', left: '0.75rem', color: '#6c757d', pointerEvents: 'none', zIndex: 1 }} />
            <InputText value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name / place..." style={{ width: '100%', paddingLeft: '2.25rem' }} />
          </span>
          <Dropdown value={custFilter} options={customers} optionLabel="name" onChange={e => setCustFilter(e.value)}
            placeholder="All customers" showClear filter style={{ width: '100%' }} />
          <Dropdown value={placeFilter} options={places} optionLabel="name" onChange={e => setPlaceFilter(e.value)}
            placeholder="All places" showClear style={{ width: '100%' }} />
          <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon placeholder="From date" style={{ width: '100%' }} />
          <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon placeholder="To date" style={{ width: '100%' }} />
          <Button icon="pi pi-filter-slash" label="Clear" className="p-button-outlined p-button-secondary"
            onClick={() => { setFilter(''); setCustFilter(null); setPlaceFilter(null); setFromDate(null); setToDate(null); }} />
        </div>

        {customerRows.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Customers', val: customerRows.length, bg: '#1e3a5f' },
              { label: 'Total Billed', val: fmt(totalBilled), bg: '#1565c0' },
              { label: 'Total Paid', val: fmt(totalPaid), bg: '#2e7d32' },
              { label: 'Total Balance', val: fmt(totalBalance), bg: totalBalance > 0 ? '#c62828' : '#2e7d32' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, color: 'white', borderRadius: 8, padding: '8px 16px', minWidth: 130 }}>
                <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        <DataTable value={customerRows} loading={loading} stripedRows rowHover size="small"
          paginator rows={15} rowsPerPageOptions={[10, 15, 25, 50]} emptyMessage="No bills found">
          <Column field="customer_name" header="Customer" sortable />
          <Column field="place_name" header="Place" body={row => row.place_name || '—'} />
          <Column field="bill_count" header="Bills" style={{ width: 60, textAlign: 'center' }} />
          <Column field="total_billed" header="Total (₹)" sortable body={row => <span style={{ fontWeight: 600 }}>{fmt(row.total_billed)}</span>} />
          <Column field="total_paid" header="Paid (₹)" sortable body={row => <span style={{ color: '#2e7d32', fontWeight: 600 }}>{fmt(row.total_paid)}</span>} />
          <Column field="total_balance" header="Balance (₹)" sortable
            body={row => { const b = parseFloat(row.total_balance || 0); return <Tag value={fmt(b)} severity={b > 0 ? 'danger' : 'success'} style={{ fontWeight: 700 }} />; }} />
          <Column header="Statement" style={{ width: 90 }}
            body={row => <Button icon="pi pi-book" label="View" className="p-button-text p-button-sm" onClick={() => openDetail(row)} />} />
        </DataTable>
      </Card>

      {/* Account Statement Dialog */}
      <Dialog
        header={
          detailCustomer
            ? <span>
                <i className="pi pi-book" style={{ marginRight: 8, color: '#2196f3' }} />
                {detailCustomer.customer_name}
                {detailCustomer.place_name && detailCustomer.place_name !== '—'
                  ? <span style={{ fontSize: 13, color: '#888', fontWeight: 400, marginLeft: 10 }}>{detailCustomer.place_name}</span>
                  : null}
              </span>
            : 'Account Statement'
        }
        visible={detailVisible}
        onHide={() => setDetailVisible(false)}
        style={{ width: '780px' }}
        maximizable
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: 40 }} />
          </div>
        ) : (
          <div>
            {/* Period banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '10px 16px', background: '#eef3fb', border: '1px solid #cdd9ee', borderRadius: 8 }}>
              <span style={{ fontSize: 15, color: '#1e3a5f', fontWeight: 600 }}>
                <i className="pi pi-calendar" style={{ marginRight: 8 }} />
                Showing: <span style={{ color: '#0d47a1' }}>{periodLabel}</span>
              </span>
              <span style={{ fontSize: 14, color: '#555' }}>
                Old Balance:&nbsp;
                <strong style={{ color: statement.previousBalance > 0 ? '#c62828' : '#2e7d32', fontSize: 15 }}>{fmt(statement.previousBalance)}</strong>
              </span>
            </div>

            {/* Timeline of bill / payment cards */}
            <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '4px 2px' }}>
              {statement.entries.length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: '#999', fontSize: 15, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 8 }}>
                  <i className="pi pi-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10, color: '#bbb' }} />
                  No bills or payments in this period
                </div>
              )}

              {statement.entries.map((entry) => (
                entry._type === 'bill' ? (
                  <div key={`b${entry.id}`} style={{ marginBottom: 12, border: '1px solid #ffd9a8', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(230,81,0,0.08)' }}>
                    {/* Bill header */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(90deg, #fff3e0 0%, #ffe8d0 100%)', borderBottom: '1px solid #ffd9a8' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e65100', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                        <i className="pi pi-shopping-cart" style={{ fontSize: 18 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 16, color: '#1e3a5f' }}>
                        Bill #{entry.daily_no} — Sale
                        <span style={{ marginLeft: 12, color: '#6d4c41', fontWeight: 600 }}>
                          <i className="pi pi-calendar" style={{ marginRight: 5, fontSize: 14 }} />
                          {fmtDate(entry.date)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', marginRight: 8 }}>
                        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
                        <div style={{ fontWeight: 700, fontSize: 20, color: '#c62828' }}>{fmt(entry.debit)}</div>
                      </div>
                      <Button icon="pi pi-pencil" className="p-button-text p-button-sm" style={{ color: '#1565c0' }}
                        onClick={() => { setDetailVisible(false); navigate(`/addbill/${entry.id}`); }} title="Edit" />
                      <Button icon="pi pi-trash" className="p-button-text p-button-danger p-button-sm"
                        onClick={() => deleteBill(entry)} title="Delete" />
                    </div>

                    {/* Items table */}
                    {entry.items.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #eee' }}>Product</th>
                            <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, width: 90, borderBottom: '1px solid #eee' }}>Qty</th>
                            <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, width: 130, borderBottom: '1px solid #eee' }}>Rate</th>
                            <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, width: 150, borderBottom: '1px solid #eee' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.items.map((item, i) => (
                            <tr key={i} style={{ borderBottom: i === entry.items.length - 1 ? 'none' : '1px solid #f5f5f5' }}>
                              <td style={{ padding: '10px 14px', fontSize: 15, color: '#222', fontWeight: 500 }}>{stripBase(item.product_name) || '—'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 15, color: '#444', fontWeight: 600 }}>{fmtQty(item.quantity)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 15, color: '#444' }}>{fmt(item.rate)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>{fmt(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  /* Payment card */
                  <div key={`p${entry.id}`} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', marginBottom: 12, background: 'linear-gradient(90deg, #e8f5e9 0%, #d6efd9 100%)', border: '1px solid #a5d6a7', borderRadius: 10, boxShadow: '0 1px 3px rgba(46,125,50,0.08)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2e7d32', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                      <i className="pi pi-check" style={{ fontSize: 18 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 16, color: '#1b5e20' }}>
                      Payment Received
                      <span style={{ marginLeft: 12, color: '#558b2f', fontWeight: 600 }}>
                        <i className="pi pi-calendar" style={{ marginRight: 5, fontSize: 14 }} />
                        {fmtDate(entry.date)}
                      </span>
                      {entry.notes && <span style={{ marginLeft: 10, color: '#666', fontWeight: 400, fontSize: 14 }}>· {entry.notes}</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#558b2f', textTransform: 'uppercase', fontWeight: 600 }}>Paid</div>
                      <div style={{ fontWeight: 700, fontSize: 20, color: '#2e7d32' }}>{fmt(entry.credit)}</div>
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Summary footer — Previous / Sale / Payment / Current */}
            <div style={{ display: 'flex', gap: 0, marginTop: 12, border: '1px solid #dde3f0', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { label: 'Previous Balance', val: fmt(statement.previousBalance), bg: '#455a64', color: '#fff' },
                { label: 'Sale', val: fmt(statement.periodSales), bg: '#1565c0', color: '#fff' },
                { label: 'Payment', val: fmt(statement.periodPayments), bg: '#2e7d32', color: '#fff' },
                { label: 'Current Balance', val: fmt(statement.currentBalance), bg: statement.currentBalance > 0 ? '#c62828' : '#388e3c', color: '#fff' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, color: s.color, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{s.val}</div>
                  </div>
                ))}
              </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
