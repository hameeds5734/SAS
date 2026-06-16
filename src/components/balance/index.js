import { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { TabView, TabPanel } from 'primereact/tabview';
import { useTranslation } from 'react-i18next';
import { reportsApi, placesApi, customersApi, baseProductsApi } from '../../services/api';

const fmtQty = (q) => {
  const n = parseFloat(q) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const toLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// bill_items.product_name is stored as "Base - Sub"; show only the sub-product portion when both exist.
const stripBase = (name) => {
  if (!name) return '';
  const i = name.indexOf(' - ');
  return i >= 0 ? name.substring(i + 3).trim() : name;
};


// ─── Bill Report Tab ──────────────────────────────────────────────────────────
function BillReport() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [statementData, setStatementData] = useState(null);
  const [appliedDetail, setAppliedDetail] = useState(false);

  useEffect(() => {
    customersApi.getAll().then(r => setCustomers(r.data));
  }, []);

  const search = async () => {
    if (!selectedCustomer) {
      toast.current.show({ severity: 'warn', summary: 'Customer required', detail: 'Select a customer to generate the statement' });
      return;
    }
    setLoading(true);
    try {
      const params = { customer_id: selectedCustomer.id };
      if (fromDate) params.from_date = toLocalDate(fromDate);
      if (toDate) params.to_date = toLocalDate(toDate);
      if (showDetail) params.detail = '1';
      const res = await reportsApi.getCustomerStatement(params);
      setStatementData(res.data);
      setAppliedDetail(showDetail);
      setResultVisible(true);
      if (res.data.entries.length === 0 && res.data.opening_balance === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No transactions for this customer' });
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to generate report' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(null); setToDate(null);
    setSelectedCustomer(null);
    setShowDetail(false);
    setStatementData(null);
  };

  return (
    <>
      <Toast ref={toast} />

      {/* Filter card */}
      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Report Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon placeholder="Select start date" style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon placeholder="Select end date" style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customer *</label>
            <Dropdown value={selectedCustomer} options={customers} optionLabel="name"
              onChange={e => setSelectedCustomer(e.value)} placeholder="Select customer" filter showClear
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 8, marginBottom: 16 }}>
          <Checkbox inputId="detailed" checked={showDetail} onChange={e => setShowDetail(e.checked)} />
          <label htmlFor="detailed" style={{ fontSize: 14, fontWeight: 600, color: '#1e3a5f', cursor: 'pointer' }}>
            Detailed view — expand each sale date into its bill items
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Generate Statement" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {/* Result modal */}
      <Dialog
        header={
          <span>
            <i className="pi pi-file" style={{ marginRight: 8, color: '#2196f3' }} />
            Customer Statement
            {statementData && <span style={{ marginLeft: 12, fontSize: 13, color: '#888', fontWeight: 400 }}>{statementData.customer.name}</span>}
          </span>
        }
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: appliedDetail ? '820px' : '720px' }}
        maximizable
      >
        {statementData && (
          <CustomerStatement data={statementData} fromDate={fromDate} toDate={toDate} detail={appliedDetail} />
        )}
      </Dialog>
    </>
  );
}

function CustomerStatement({ data, fromDate, toDate, detail }) {
  const { customer, opening_balance, entries, total_sale, total_paid, closing_balance } = data;
  const round = (v) => Math.round(parseFloat(v || 0)).toLocaleString('en-IN');

  // Build a flat list of rows for the detail body so column widths stay aligned.
  const detailRows = [];
  if (detail) {
    entries.forEach((e, ei) => {
      if (parseFloat(e.paid || 0) > 0) {
        detailRows.push({ type: 'pay', date: e.date, paid: e.paid, key: `p${ei}` });
      }
      if (e.items && e.items.length > 0) {
        e.items.forEach((it, ii) => {
          detailRows.push({
            type: 'item', date: ii === 0 ? e.date : '',
            rate: it.rate, product: stripBase(it.product_name), qty: it.quantity, amount: it.amount,
            key: `i${ei}-${ii}`,
          });
        });
        detailRows.push({ type: 'stot', sale: e.sale, key: `s${ei}` });
      }
    });
  }

  return (
    <>
      <style>{`
        .cs-report {
          width: 720px;
          max-width: 100%;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #ccc;
          padding: 24px 28px;
          font-family: "Courier New", Consolas, "Lucida Console", monospace;
          color: #000;
          font-size: 16px;
          line-height: 1.55;
          box-sizing: border-box;
        }
        .cs-period { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #000; }
        .cs-name   { text-align: start; font-weight: 700; font-size: 17px; margin-top: 4px; }
        .cs-place  { text-align: start; font-size: 14px; margin-bottom: 12px; }
        .cs-row    { display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; margin: 6px 0; }
        .cs-tbl    { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
        .cs-tbl th { font-size: 13px; font-weight: 700; padding-bottom: 4px; border-bottom: 1px solid #000; }
        .cs-tbl td { font-size: 15px; padding: 2px 0; font-variant-numeric: tabular-nums; }
        .cs-date   { width: 110px; }
        .cs-rate   { width: 70px;  text-align: right; padding-right: 16px !important; }
        .cs-prod   { word-break: break-word; padding-left: 6px; padding-right: 6px; }
        .cs-qty    { width: 55px;  text-align: right; padding-right: 6px; }
        .cs-amt    { width: 110px; text-align: right; }
        .cs-paid   { width: 100px; text-align: right; }
        .cs-stot td { font-weight: 700; padding-top: 4px; }
        .cs-stot .cs-amt { border-top: 1px solid #000; }
        .cs-tot td { font-weight: 700; padding-top: 6px; }
        .cs-tot .cs-amt, .cs-tot .cs-paid { border-top: 1px solid #3c3b3b; }
        .cs-close  { display: flex; justify-content: space-between; font-weight: 700; font-size: 16px; margin-top: 14px; padding-top: 6px; }
        .cs-close .cs-val { border-top: 3px double #000; border-bottom: 3px double #000; padding: 2px 0; min-width: 130px; text-align: right; font-variant-numeric: tabular-nums; }

        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          .cs-report, .cs-report * { visibility: visible; }
          .cs-report {
            position: fixed !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important; transform: none !important;
            width: 80mm !important; max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
          }
          .cs-period { font-size: 10px !important; margin-bottom: 3px !important; padding-bottom: 2px !important; }
          .cs-name   { font-size: 11px !important; }
          .cs-place  { font-size: 9px  !important; margin-bottom: 4px !important; }
          .cs-row    { font-size: 10px !important; }
          .cs-tbl    { table-layout: fixed !important; }
          .cs-tbl th { font-size: 9px  !important; padding-bottom: 2px !important; }
          .cs-tbl td { font-size: 10px !important; padding: 1px 0 !important; }
          .cs-date   { width: 16mm !important; }
          .cs-rate   { width: 9mm  !important; padding-right: 1mm !important; }
          .cs-prod   { padding-left: 1mm !important; padding-right: 1mm !important; word-break: normal !important; overflow-wrap: anywhere !important; }
          .cs-qty    { width: 6mm  !important; padding-right: 1mm !important; }
          .cs-amt    { width: 14mm !important; }
          .cs-paid   { width: 10mm !important; }
          .cs-close  { font-size: 11px !important; margin-top: 4px !important; }
          .cs-close .cs-val { min-width: 22mm !important; }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button label="Print" icon="pi pi-print" className="p-button-sm p-button-outlined" onClick={() => window.print()} />
      </div>

      <div className="cs-report">
        <div className="cs-period">
          {fmtDate(fromDate || new Date())} &nbsp;to&nbsp; {fmtDate(toDate || new Date())}
        </div>
        <div className="cs-name">{customer.name}</div>
        <div className="cs-place">{customer.place_name || ''}</div>

        <div className="cs-row">
          <span>Balance</span>
          <span>{round(opening_balance)}</span>
        </div>

        {detail ? (
          <table className="cs-tbl">
            <thead>
              <tr>
                <th className="cs-date"></th>
                <th className="cs-rate"></th>
                <th className="cs-prod"></th>
                <th className="cs-qty"></th>
                <th className="cs-amt">Sale</th>
                <th className="cs-paid">Paid</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '14px 0', color: '#666' }}>No transactions in this period</td></tr>
              )}
              {detailRows.map(r => {
                if (r.type === 'pay') {
                  return (
                    <tr key={r.key}>
                      <td className="cs-date">{fmtDate(r.date)}</td>
                      <td colSpan={3}></td>
                      <td className="cs-amt"></td>
                      <td className="cs-paid">{round(r.paid)}</td>
                    </tr>
                  );
                }
                if (r.type === 'item') {
                  return (
                    <tr key={r.key}>
                      <td className="cs-date">{r.date ? fmtDate(r.date) : ''}</td>
                      <td className="cs-rate">{round(r.rate)}</td>
                      <td className="cs-prod">{r.product || '—'}</td>
                      <td className="cs-qty">{fmtQty(r.qty)}</td>
                      <td className="cs-amt">{round(r.amount)}</td>
                      <td className="cs-paid"></td>
                    </tr>
                  );
                }
                // subtotal row for a date's sale
                return (
                  <tr key={r.key} className="cs-stot">
                    <td colSpan={4}></td>
                    <td className="cs-amt">{round(r.sale)}</td>
                    <td className="cs-paid"></td>
                  </tr>
                );
              })}
              <tr className="cs-tot">
                <td colSpan={4}></td>
                <td className="cs-amt">{round(total_sale)}</td>
                <td className="cs-paid">{round(total_paid)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="cs-tbl">
            <thead>
              <tr>
                <th className="cs-date" style={{ textAlign: 'left' }}></th>
                <th className="cs-amt">Sale</th>
                <th className="cs-paid">Paid</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '14px 0', color: '#666' }}>No transactions in this period</td></tr>
              )}
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="cs-date">{fmtDate(e.date)}</td>
                  <td className="cs-amt">{e.sale ? round(e.sale) : ''}</td>
                  <td className="cs-paid">{e.paid ? round(e.paid) : ''}</td>
                </tr>
              ))}
              <tr className="cs-tot">
                <td></td>
                <td className="cs-amt">{round(total_sale)}</td>
                <td className="cs-paid">{round(total_paid)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="cs-close">
          <span>Balance</span>
          <span className="cs-val">{round(closing_balance)}</span>
        </div>
      </div>
    </>
  );
}

// ─── Reusable printed report ──────────────────────────────────────────────────
// Renders a Date → Place → (customer, value) ledger styled to print on 80mm thermal rolls.
// `valueField` picks the numeric field on each row (e.g. "balance" or "billed").
function PrintedReport({ data, fromDate, toDate, valueField }) {
  const grouped = useMemo(() => {
    const dateMap = new Map();
    data.forEach(r => {
      if (!dateMap.has(r.bill_date)) dateMap.set(r.bill_date, new Map());
      const placeMap = dateMap.get(r.bill_date);
      const placeKey = r.place_name || '— No place —';
      if (!placeMap.has(placeKey)) placeMap.set(placeKey, []);
      placeMap.get(placeKey).push(r);
    });
    return dateMap;
  }, [data]);

  const grand = data.reduce((s, r) => s + parseFloat(r[valueField] || 0), 0);

  return (
    <>
      <style>{`
        .tr-report {
          width: 600px;
          max-width: 100%;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #ccc;
          padding: 24px 28px;
          font-family: "Courier New", Consolas, "Lucida Console", monospace;
          color: #000;
          font-size: 16px;
          line-height: 1.55;
          box-sizing: border-box;
        }
        .tr-period { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #000; }
        .tr-date   { text-align: center; font-weight: 700; font-size: 16px; margin: 12px 0 4px; text-decoration: underline; }
        .tr-place  { text-align: center; font-weight: 700; font-size: 15px; margin: 8px 0 4px; }
        .tr-tbl    { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .tr-tbl td { font-size: 15px; padding: 2px 0; }
        .tr-name   { padding-left: 14px !important; word-break: break-word; }
        .tr-amt    { text-align: right; width: 110px; font-variant-numeric: tabular-nums; }
        .tr-sub td { font-weight: 700; padding-top: 4px; border-top: 0; }
        .tr-sub .tr-amt { border-top: 1px solid #000; }
        .tr-day    { display: flex; justify-content: flex-end; margin-top: 6px; }
        .tr-day td { font-weight: 700; padding: 2px 0; }
        .tr-day .tr-amt { border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .tr-grand  { display: flex; justify-content: flex-end; margin-top: 14px; }
        .tr-grand td { font-weight: 700; font-size: 17px; padding: 4px 0; }
        .tr-grand .tr-amt { border-top: 3px double #000; border-bottom: 3px double #000; width: 130px; }
        .tr-lbl    { padding-right: 14px !important; text-align: right; }

        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          .tr-report, .tr-report * { visibility: visible; }
          .tr-report {
            position: fixed !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important; transform: none !important;
            width: 80mm !important; max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          .tr-period { font-size: 11px !important; margin-bottom: 4px !important; padding-bottom: 3px !important; }
          .tr-date   { font-size: 11px !important; margin: 5px 0 2px !important; }
          .tr-place  { font-size: 11px !important; margin: 3px 0 2px !important; }
          .tr-tbl td { font-size: 11px !important; padding: 1px 0 !important; }
          .tr-amt    { width: 22mm !important; }
          .tr-grand td { font-size: 12px !important; padding: 2px 0 !important; }
          .tr-grand .tr-amt { width: 24mm !important; }
          .tr-name   { padding-left: 4mm !important; }
          .tr-lbl    { padding-right: 4mm !important; }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button label="Print" icon="pi pi-print" className="p-button-sm p-button-outlined" onClick={() => window.print()} />
      </div>

      <div className="tr-report">
        <div className="tr-period">
          {fmtDate(fromDate)} &nbsp;to&nbsp; {fmtDate(toDate)}
        </div>

        {[...grouped.entries()].map(([date, placeMap]) => {
          const dayRows = [...placeMap.values()].flat();
          const dateValue = dayRows.reduce((s, r) => s + parseFloat(r[valueField] || 0), 0);
          const dayCount = dayRows.length;
          // Day total adds info only when the day spans more than one place.
          const showDayTotal = placeMap.size > 1;
          return (
            <div key={date}>
              <div className="tr-date">{fmtDate(date)}</div>

              {[...placeMap.entries()].map(([placeName, rows]) => {
                const placeValue = rows.reduce((s, r) => s + parseFloat(r[valueField] || 0), 0);
                // Place subtotal adds info only when there's more than one customer.
                const showPlaceSubtotal = rows.length > 1;
                return (
                  <div key={placeName}>
                    <div className="tr-place">{placeName}</div>
                    <table className="tr-tbl">
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td className="tr-name">{r.customer_name}</td>
                            <td className="tr-amt">{Math.round(parseFloat(r[valueField] || 0)).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        {showPlaceSubtotal && (
                          <tr className="tr-sub">
                            <td className="tr-lbl">{rows.length}</td>
                            <td className="tr-amt">{Math.round(placeValue).toLocaleString('en-IN')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {showDayTotal && (
                <div className="tr-day">
                  <table>
                    <tbody>
                      <tr>
                        <td className="tr-lbl">Day Total ({dayCount})</td>
                        <td className="tr-amt">{Math.round(dateValue).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Grand total adds info only when the period covers more than one day. */}
        {grouped.size > 1 && (
          <div className="tr-grand">
            <table>
              <tbody>
                <tr>
                  <td className="tr-lbl">TOTAL ({data.length})</td>
                  <td className="tr-amt">{Math.round(grand).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Customer Balance Tab ─────────────────────────────────────────────────────
function CustomerBalance() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [places, setPlaces] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => {
    Promise.all([placesApi.getAll(), customersApi.getAll()]).then(([p, c]) => {
      setPlaces(p.data);
      setCustomers(c.data);
    });
  }, []);

  const search = async () => {
    const params = {};
    if (fromDate) params.from_date = toLocalDate(fromDate);
    if (toDate) params.to_date = toLocalDate(toDate);
    if (selectedPlaces.length > 0) params.place_ids = selectedPlaces.map(p => p.id).join(',');
    if (selectedCustomers.length > 0) params.customer_ids = selectedCustomers.map(c => c.id).join(',');

    setLoading(true);
    try {
      const res = await reportsApi.getDaywiseBalance(params);
      setData(res.data);
      setSearched(true);
      if (res.data.length === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No bills match these filters' });
      } else {
        setResultVisible(true);
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load balances' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(new Date()); setToDate(new Date());
    setSelectedPlaces([]); setSelectedCustomers([]);
    setData([]); setSearched(false);
  };

  return (
    <>
      <Toast ref={toast} />

      {/* Filter card */}
      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Customer Balance Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Places</label>
            <MultiSelect value={selectedPlaces} options={places} optionLabel="name"
              onChange={e => setSelectedPlaces(e.value)} placeholder="All places" filter display="chip"
              style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customers</label>
            <MultiSelect value={selectedCustomers} options={customers} optionLabel="name"
              onChange={e => setSelectedCustomers(e.value)} placeholder="All customers" filter display="chip"
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Search" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {!searched && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 10 }}>
          <i className="pi pi-search" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#bbb' }} />
          Set filters and click <strong>Search</strong> to see customer balances grouped by date and place.
        </div>
      )}
      {searched && data.length > 0 && !resultVisible && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Button label="View Result" icon="pi pi-eye" onClick={() => setResultVisible(true)} />
        </div>
      )}

      <Dialog
        header={<span><i className="pi pi-wallet" style={{ marginRight: 8, color: '#2196f3' }} />Customer Balance</span>}
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: '720px' }}
        contentStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
        maximizable
      >
        {data.length > 0 && (
          <PrintedReport data={data} fromDate={fromDate} toDate={toDate} valueField="balance" />
        )}
      </Dialog>
    </>
  );
}

// ─── Customer Sale Tab ────────────────────────────────────────────────────────
function CustomerSale() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [places, setPlaces] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => {
    Promise.all([placesApi.getAll(), customersApi.getAll()]).then(([p, c]) => {
      setPlaces(p.data);
      setCustomers(c.data);
    });
  }, []);

  const search = async () => {
    const params = {};
    if (fromDate) params.from_date = toLocalDate(fromDate);
    if (toDate) params.to_date = toLocalDate(toDate);
    if (selectedPlaces.length > 0) params.place_ids = selectedPlaces.map(p => p.id).join(',');
    if (selectedCustomers.length > 0) params.customer_ids = selectedCustomers.map(c => c.id).join(',');

    setLoading(true);
    try {
      const res = await reportsApi.getDaywiseBalance(params);
      setData(res.data);
      setSearched(true);
      if (res.data.length === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No bills match these filters' });
      } else {
        setResultVisible(true);
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load sales' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(new Date()); setToDate(new Date());
    setSelectedPlaces([]); setSelectedCustomers([]);
    setData([]); setSearched(false);
  };

  return (
    <>
      <Toast ref={toast} />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Customer Sale Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Places</label>
            <MultiSelect value={selectedPlaces} options={places} optionLabel="name"
              onChange={e => setSelectedPlaces(e.value)} placeholder="All places" filter display="chip"
              style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customers</label>
            <MultiSelect value={selectedCustomers} options={customers} optionLabel="name"
              onChange={e => setSelectedCustomers(e.value)} placeholder="All customers" filter display="chip"
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Search" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {!searched && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 10 }}>
          <i className="pi pi-search" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#bbb' }} />
          Set filters and click <strong>Search</strong> to see customer sales grouped by date and place.
        </div>
      )}
      {searched && data.length > 0 && !resultVisible && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Button label="View Result" icon="pi pi-eye" onClick={() => setResultVisible(true)} />
        </div>
      )}

      <Dialog
        header={<span><i className="pi pi-shopping-cart" style={{ marginRight: 8, color: '#2196f3' }} />Customer Sale</span>}
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: '720px' }}
        contentStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
        maximizable
      >
        {data.length > 0 && (
          <PrintedReport data={data} fromDate={fromDate} toDate={toDate} valueField="billed" />
        )}
      </Dialog>
    </>
  );
}

// ─── Sale Summary Tab ─────────────────────────────────────────────────────────
function SaleSummary() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [places, setPlaces] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => {
    Promise.all([placesApi.getAll(), customersApi.getAll()]).then(([p, c]) => {
      setPlaces(p.data);
      setCustomers(c.data);
    });
  }, []);

  const search = async () => {
    const params = {};
    if (fromDate) params.from_date = toLocalDate(fromDate);
    if (toDate) params.to_date = toLocalDate(toDate);
    if (selectedPlaces.length > 0) params.place_ids = selectedPlaces.map(p => p.id).join(',');
    if (selectedCustomers.length > 0) params.customer_ids = selectedCustomers.map(c => c.id).join(',');

    setLoading(true);
    try {
      const res = await reportsApi.getReport(params);
      setBills(res.data);
      setSearched(true);
      if (res.data.length === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No bills match these filters' });
      } else {
        setResultVisible(true);
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load sale summary' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(new Date()); setToDate(new Date());
    setSelectedPlaces([]); setSelectedCustomers([]);
    setBills([]); setSearched(false);
  };

  return (
    <>
      <Toast ref={toast} />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Sale Summary Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Places</label>
            <MultiSelect value={selectedPlaces} options={places} optionLabel="name"
              onChange={e => setSelectedPlaces(e.value)} placeholder="All places" filter display="chip"
              style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customers</label>
            <MultiSelect value={selectedCustomers} options={customers} optionLabel="name"
              onChange={e => setSelectedCustomers(e.value)} placeholder="All customers" filter display="chip"
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Search" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {!searched && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 10 }}>
          <i className="pi pi-search" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#bbb' }} />
          Set filters and click <strong>Search</strong> to see the sale summary.
        </div>
      )}
      {searched && bills.length > 0 && !resultVisible && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Button label="View Result" icon="pi pi-eye" onClick={() => setResultVisible(true)} />
        </div>
      )}

      <Dialog
        header={<span><i className="pi pi-receipt" style={{ marginRight: 8, color: '#2196f3' }} />Sale Summary</span>}
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: '760px' }}
        contentStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
        maximizable
      >
        {bills.length > 0 && (
          <SaleSummaryReport bills={bills} fromDate={fromDate} toDate={toDate} />
        )}
      </Dialog>
    </>
  );
}

function SaleSummaryReport({ bills, fromDate, toDate }) {
  const round = (v) => Math.round(parseFloat(v || 0)).toLocaleString('en-IN');

  // Backend provides per-day sequence as bill.daily_no — just sort by date+id for display.
  const sorted = [...bills].sort((a, b) => {
    const da = (a.bill_date || '').substring(0, 10);
    const db = (b.bill_date || '').substring(0, 10);
    if (da !== db) return da.localeCompare(db);
    return a.id - b.id;
  });

  const grandAmt = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

  return (
    <>
      <style>{`
        .ss-report {
          width: 640px;
          max-width: 100%;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #ccc;
          padding: 24px 28px;
          font-family: "Courier New", Consolas, "Lucida Console", monospace;
          color: #000;
          font-size: 15px;
          line-height: 1.5;
          box-sizing: border-box;
        }
        .ss-period { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #000; }
        .ss-bill   { margin-bottom: 16px; }
        .ss-head   { display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; }
        .ss-place  { font-size: 13px; margin-bottom: 4px; }
        .ss-tbl    { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .ss-tbl td { font-size: 14px; padding: 1px 0; font-variant-numeric: tabular-nums; }
        .ss-rate   { width: 70px; text-align: left; }
        .ss-name   { padding-left: 6px; word-break: break-word; }
        .ss-qty    { width: 60px; text-align: right; }
        .ss-amt    { width: 110px; text-align: right; }
        .ss-tot td { font-weight: 700; padding-top: 4px; }
        .ss-tot .ss-qty, .ss-tot .ss-amt { border-top: 1px solid #000; }
        .ss-grand  { display: flex; justify-content: flex-end; gap: 18px; margin-top: 14px; font-weight: 700; font-size: 15px; padding-top: 6px; border-top: 3px double #000; }

        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          .ss-report, .ss-report * { visibility: visible; }
          .ss-report {
            position: fixed !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important; transform: none !important;
            width: 80mm !important; max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          .ss-period { font-size: 11px !important; margin-bottom: 4px !important; padding-bottom: 3px !important; }
          .ss-head   { font-size: 11px !important; }
          .ss-place  { font-size: 10px !important; margin-bottom: 2px !important; }
          .ss-tbl td { font-size: 11px !important; padding: 1px 0 !important; }
          .ss-rate   { width: 14mm !important; }
          .ss-qty    { width: 12mm !important; }
          .ss-amt    { width: 22mm !important; }
          .ss-bill   { margin-bottom: 6px !important; }
          .ss-grand  { font-size: 12px !important; gap: 4mm !important; margin-top: 4mm !important; }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button label="Print" icon="pi pi-print" className="p-button-sm p-button-outlined" onClick={() => window.print()} />
      </div>

      <div className="ss-report">
        <div className="ss-period">
          {fmtDate(fromDate)} &nbsp;to&nbsp; {fmtDate(toDate)}
        </div>

        {sorted.map(bill => (
          <div className="ss-bill" key={bill.id}>
            <div className="ss-head">
              <span>{bill.customer_name}</span>
              <span>{fmtDate(bill.bill_date)} - {bill.daily_no}</span>
            </div>
            {bill.place_name && <div className="ss-place">{bill.place_name}</div>}

            <table className="ss-tbl">
              <tbody>
                {bill.items.map((item, i) => (
                  <tr key={i}>
                    <td className="ss-rate">{round(item.rate)}</td>
                    <td className="ss-name">{stripBase(item.product_name) || '—'}</td>
                    <td className="ss-qty">{fmtQty(item.quantity)}</td>
                    <td className="ss-amt">{round(item.amount)}</td>
                  </tr>
                ))}
                <tr className="ss-tot">
                  <td colSpan={2}></td>
                  <td className="ss-qty">{fmtQty(bill.total_qty)}</td>
                  <td className="ss-amt">{round(bill.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <div className="ss-grand">
          <span>TOTAL</span>
          {/* <span>{fmtQty(grandQty)}</span> */}
          <span>{round(grandAmt)}</span>
        </div>
      </div>
    </>
  );
}

// ─── Daily Sale Tab ───────────────────────────────────────────────────────────
function DailySale() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [places, setPlaces] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => {
    Promise.all([placesApi.getAll(), customersApi.getAll()]).then(([p, c]) => {
      setPlaces(p.data);
      setCustomers(c.data);
    });
  }, []);

  const search = async () => {
    const params = {};
    if (fromDate) params.from_date = toLocalDate(fromDate);
    if (toDate) params.to_date = toLocalDate(toDate);
    if (selectedPlaces.length > 0) params.place_ids = selectedPlaces.map(p => p.id).join(',');
    if (selectedCustomers.length > 0) params.customer_ids = selectedCustomers.map(c => c.id).join(',');

    setLoading(true);
    try {
      const res = await reportsApi.getDailySale(params);
      setEntries(res.data);
      setSearched(true);
      if (res.data.length === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No bills or payments match these filters' });
      } else {
        setResultVisible(true);
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load daily sale' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(new Date()); setToDate(new Date());
    setSelectedPlaces([]); setSelectedCustomers([]);
    setEntries([]); setSearched(false);
  };

  return (
    <>
      <Toast ref={toast} />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Daily Sale Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Places</label>
            <MultiSelect value={selectedPlaces} options={places} optionLabel="name"
              onChange={e => setSelectedPlaces(e.value)} placeholder="All places" filter display="chip"
              style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customers</label>
            <MultiSelect value={selectedCustomers} options={customers} optionLabel="name"
              onChange={e => setSelectedCustomers(e.value)} placeholder="All customers" filter display="chip"
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Search" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {!searched && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 10 }}>
          <i className="pi pi-search" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#bbb' }} />
          Set filters and click <strong>Search</strong> to see the daily sale.
        </div>
      )}
      {searched && entries.length > 0 && !resultVisible && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Button label="View Result" icon="pi pi-eye" onClick={() => setResultVisible(true)} />
        </div>
      )}

      <Dialog
        header={<span><i className="pi pi-calendar-plus" style={{ marginRight: 8, color: '#2196f3' }} />Daily Sale</span>}
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: '760px' }}
        contentStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
        maximizable
      >
        {entries.length > 0 && (
          <DailySaleReport entries={entries} fromDate={fromDate} toDate={toDate} />
        )}
      </Dialog>
    </>
  );
}

function DailySaleReport({ entries, fromDate, toDate }) {
  const round = (v) => Math.round(parseFloat(v || 0)).toLocaleString('en-IN');

  return (
    <>
      <style>{`
        .dl-report {
          width: 640px;
          max-width: 100%;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #ccc;
          padding: 24px 28px;
          font-family: "Courier New", Consolas, "Lucida Console", monospace;
          color: #000;
          font-size: 15px;
          line-height: 1.5;
          box-sizing: border-box;
        }
        .dl-period { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #000; }
        .dl-block  { margin-bottom: 18px; padding-bottom: 6px; }
        .dl-date   { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; font-size: 15px; }
        .dl-bills  { font-weight: 700; font-size: 14px; color: #000; }
        .dl-name   { font-weight: 700; font-size: 15px; }
        .dl-place  { font-size: 13px; margin-bottom: 4px; }
        .dl-tbl    { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .dl-tbl td { font-size: 14px; padding: 1px 0; font-variant-numeric: tabular-nums; }
        .dl-rate   { width: 70px; text-align: left; }
        .dl-prod   { padding-left: 6px; word-break: break-word; }
        .dl-qty    { width: 60px; text-align: right; }
        .dl-amt    { width: 95px; text-align: right; }
        .dl-paid   { width: 80px; text-align: right; }
        .dl-lbl    { font-weight: 700; text-align: center; }
        .dl-hdr td { font-weight: 700; }
        .dl-subtot .dl-qty, .dl-subtot .dl-amt { border-top: 1px solid #000; font-weight: 700; padding-top: 3px; }
        .dl-bal td { font-weight: 700; padding-top: 3px; }
        .dl-bal .dl-amt, .dl-bal .dl-paid { border-top: 1px solid #000; }
        .dl-close td { font-weight: 700; padding-top: 2px; }

        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          .dl-report, .dl-report * { visibility: visible; }
          .dl-report {
            position: fixed !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important; transform: none !important;
            width: 80mm !important; max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          .dl-period { font-size: 11px !important; margin-bottom: 4px !important; padding-bottom: 3px !important; }
          .dl-date   { font-size: 11px !important; }
          .dl-bills  { font-size: 11px !important; }
          .dl-name   { font-size: 11px !important; }
          .dl-place  { font-size: 10px !important; margin-bottom: 2px !important; }
          .dl-tbl td { font-size: 11px !important; padding: 1px 0 !important; }
          .dl-rate   { width: 14mm !important; }
          .dl-qty    { width: 10mm !important; }
          .dl-amt    { width: 20mm !important; }
          .dl-paid   { width: 18mm !important; }
          .dl-block  { margin-bottom: 6mm !important; }
          .no-print  { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button label="Print" icon="pi pi-print" className="p-button-sm p-button-outlined" onClick={() => window.print()} />
      </div>

      <div className="dl-report">
        <div className="dl-period">
          {fmtDate(fromDate)} &nbsp;to&nbsp; {fmtDate(toDate)}
        </div>

        {entries.map(entry => (
          <div className="dl-block" key={`${entry.date}-${entry.customer_id}`}>
            <div className="dl-date">
              <span>{fmtDate(entry.date)}</span>
              {entry.bill_numbers && entry.bill_numbers.length > 0 && (
                <span className="dl-bills">{entry.bill_numbers.join(', ')}</span>
              )}
            </div>
            <div className="dl-name">{entry.customer_name}</div>
            {entry.place_name && <div className="dl-place">{entry.place_name}</div>}

            <table className="dl-tbl">
              <tbody>
                {/* Opening balance label + value */}
                <tr>
                  <td></td>
                  <td></td>
                  <td className="dl-lbl">Balance</td>
                  <td className="dl-amt">{round(entry.opening_balance)}</td>
                  <td></td>
                </tr>
                {/* Sale | Paid headers */}
                <tr className="dl-hdr">
                  <td></td>
                  <td></td>
                  <td></td>
                  <td className="dl-amt">Sale</td>
                  <td className="dl-paid">Paid</td>
                </tr>
                {/* Items — first row also shows the day's payment value */}
                {entry.items.map((item, i) => (
                  <tr key={i}>
                    <td className="dl-rate">{round(item.rate)}</td>
                    <td className="dl-prod">{stripBase(item.product_name) || '—'}</td>
                    <td className="dl-qty">{fmtQty(item.quantity)}</td>
                    <td className="dl-amt">{round(item.amount)}</td>
                    <td className="dl-paid">{i === 0 && entry.paid > 0 ? round(entry.paid) : ''}</td>
                  </tr>
                ))}
                {/* Payment-only day (no items) */}
                {entry.items.length === 0 && entry.paid > 0 && (
                  <tr>
                    <td colSpan={4}></td>
                    <td className="dl-paid">{round(entry.paid)}</td>
                  </tr>
                )}
                {/* Item subtotal */}
                {entry.items.length > 0 && (
                  <tr className="dl-subtot">
                    <td></td>
                    <td></td>
                    <td className="dl-qty">{fmtQty(entry.total_qty)}</td>
                    <td className="dl-amt">{round(entry.total_sale)}</td>
                    <td></td>
                  </tr>
                )}
                {/* Totals: total billed (incl. opening) | total paid */}
                <tr className="dl-bal">
                  <td></td>
                  <td></td>
                  <td></td>
                  <td className="dl-amt">{round(entry.total_billed)}</td>
                  <td className="dl-paid">{round(entry.paid)}</td>
                </tr>
                {/* Closing balance with label */}
                <tr className="dl-close">
                  <td></td>
                  <td></td>
                  <td className="dl-lbl">Balance</td>
                  <td className="dl-amt">{round(entry.closing_balance)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Product Sale Tab ─────────────────────────────────────────────────────────
function ProductSale() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [baseProducts, setBaseProducts] = useState([]);
  const [selectedBase, setSelectedBase] = useState([]);
  const [showDetail, setShowDetail] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [appliedDetail, setAppliedDetail] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => { baseProductsApi.getAll().then(r => setBaseProducts(r.data)); }, []);

  const search = async () => {
    const params = {};
    if (fromDate) params.from_date = toLocalDate(fromDate);
    if (toDate) params.to_date = toLocalDate(toDate);
    if (selectedBase.length > 0) params.base_product_ids = selectedBase.map(b => b.id).join(',');

    setLoading(true);
    try {
      const res = await reportsApi.getProductSale(params);
      setRows(res.data);
      setAppliedDetail(showDetail);
      setSearched(true);
      if (res.data.length === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No products sold in this period' });
      } else {
        setResultVisible(true);
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load product sale' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(new Date()); setToDate(new Date());
    setSelectedBase([]); setShowDetail(false);
    setRows([]); setSearched(false);
  };

  return (
    <>
      <Toast ref={toast} />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Product Sale Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Base Products</label>
            <MultiSelect value={selectedBase} options={baseProducts} optionLabel="name"
              onChange={e => setSelectedBase(e.value)} placeholder="All products" filter display="chip"
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 8, marginBottom: 14 }}>
          <Checkbox inputId="ps-detail" checked={showDetail} onChange={e => setShowDetail(e.checked)} />
          <label htmlFor="ps-detail" style={{ fontSize: 14, fontWeight: 600, color: '#1e3a5f', cursor: 'pointer' }}>
            Detail — show each bill (customer + date) under the product
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Search" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {!searched && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 10 }}>
          <i className="pi pi-search" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#bbb' }} />
          Set filters and click <strong>Search</strong> to see what was sold.
        </div>
      )}
      {searched && rows.length > 0 && !resultVisible && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Button label="View Result" icon="pi pi-eye" onClick={() => setResultVisible(true)} />
        </div>
      )}

      <Dialog
        header={<span><i className="pi pi-box" style={{ marginRight: 8, color: '#2196f3' }} />Product Sale</span>}
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: '720px' }}
        contentStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
        maximizable
      >
        {rows.length > 0 && (
          <ProductSaleReport rows={rows} fromDate={fromDate} toDate={toDate} showDetail={appliedDetail} />
        )}
      </Dialog>
    </>
  );
}

function ProductSaleReport({ rows, fromDate, toDate, showDetail }) {
  // Group rows by base_product preserving sorted order from the server.
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.base_product || '— Unlinked —';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [rows]);

  const grandQty = rows.reduce((s, r) => s + parseFloat(r.quantity || 0), 0);

  return (
    <>
      <style>{`
        .ps-report {
          width: 600px;
          max-width: 100%;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #ccc;
          padding: 24px 28px;
          font-family: "Courier New", Consolas, "Lucida Console", monospace;
          color: #000;
          font-size: 15px;
          line-height: 1.5;
          box-sizing: border-box;
        }
        .ps-period { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #000; }
        .ps-grp    { margin-bottom: 6px; }
        .ps-head   { display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; padding: 2px 0; }
        .ps-tbl    { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 4px; }
        .ps-tbl td { font-size: 13px; padding: 1px 0; font-variant-numeric: tabular-nums; color: #222; }
        .ps-date   { width: 90px; padding-left: 14px; }
        .ps-cust   { word-break: break-word; }
        .ps-sub    { width: 130px; }
        .ps-qty    { width: 60px; text-align: right; }
        .ps-grand  { display: flex; justify-content: space-between; font-weight: 700; font-size: 16px; margin-top: 14px; padding-top: 6px; border-top: 3px double #000; border-bottom: 3px double #000; }

        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          .ps-report, .ps-report * { visibility: visible; }
          .ps-report {
            position: fixed !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important; transform: none !important;
            width: 80mm !important; max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          .ps-period { font-size: 11px !important; margin-bottom: 4px !important; padding-bottom: 3px !important; }
          .ps-head   { font-size: 11px !important; }
          .ps-tbl td { font-size: 10px !important; padding: 1px 0 !important; }
          .ps-date   { width: 18mm !important; padding-left: 4mm !important; }
          .ps-sub    { width: 22mm !important; }
          .ps-qty    { width: 14mm !important; }
          .ps-grand  { font-size: 12px !important; margin-top: 4mm !important; }
          .no-print  { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button label="Print" icon="pi pi-print" className="p-button-sm p-button-outlined" onClick={() => window.print()} />
      </div>

      <div className="ps-report">
        <div className="ps-period">
          {fmtDate(fromDate)} &nbsp;to&nbsp; {fmtDate(toDate)}
        </div>

        {[...groups.entries()].map(([baseName, items]) => {
          const totalQty = items.reduce((s, r) => s + parseFloat(r.quantity || 0), 0);
          return (
            <div key={baseName} className="ps-grp">
              <div className="ps-head">
                <span>{baseName}</span>
                <span>{fmtQty(totalQty)}</span>
              </div>

              {showDetail && (
                <table className="ps-tbl">
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={i}>
                        <td className="ps-date">{fmtDate(r.bill_date)}</td>
                        <td className="ps-cust">{r.customer_name}</td>
                        <td className="ps-sub">{stripBase(r.product_name)}</td>
                        <td className="ps-qty">{fmtQty(r.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}

        <div className="ps-grand">
          <span>TOTAL</span>
          <span>{fmtQty(grandQty)}</span>
        </div>
      </div>
    </>
  );
}

// ─── Payment Entries Tab ──────────────────────────────────────────────────────
function PaymentEntries() {
  const toast = useRef(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [places, setPlaces] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => {
    Promise.all([placesApi.getAll(), customersApi.getAll()]).then(([p, c]) => {
      setPlaces(p.data);
      setCustomers(c.data);
    });
  }, []);

  const search = async () => {
    const params = {};
    if (fromDate) params.from_date = toLocalDate(fromDate);
    if (toDate) params.to_date = toLocalDate(toDate);
    if (selectedPlaces.length > 0) params.place_ids = selectedPlaces.map(p => p.id).join(',');
    if (selectedCustomers.length > 0) params.customer_ids = selectedCustomers.map(c => c.id).join(',');

    setLoading(true);
    try {
      const res = await reportsApi.getPaymentsReport(params);
      setData(res.data);
      setSearched(true);
      if (res.data.length === 0) {
        toast.current.show({ severity: 'info', summary: 'No data', detail: 'No payments match these filters' });
      } else {
        setResultVisible(true);
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to load payments' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setFromDate(new Date()); setToDate(new Date());
    setSelectedPlaces([]); setSelectedCustomers([]);
    setData([]); setSearched(false);
  };

  return (
    <>
      <Toast ref={toast} />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 700 }}>
          <i className="pi pi-filter" style={{ marginRight: 8, color: '#2196f3' }} />
          Payment Entries Filters
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>From Date</label>
            <Calendar value={fromDate} onChange={e => setFromDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>To Date</label>
            <Calendar value={toDate} onChange={e => setToDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Places</label>
            <MultiSelect value={selectedPlaces} options={places} optionLabel="name"
              onChange={e => setSelectedPlaces(e.value)} placeholder="All places" filter display="chip"
              style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customers</label>
            <MultiSelect value={selectedCustomers} options={customers} optionLabel="name"
              onChange={e => setSelectedCustomers(e.value)} placeholder="All customers" filter display="chip"
              style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="Search" icon="pi pi-search" onClick={search} loading={loading} />
          <Button label="Reset" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={reset} />
        </div>
      </Card>

      {!searched && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14, background: '#fafbfc', border: '1px dashed #dde3f0', borderRadius: 10 }}>
          <i className="pi pi-search" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: '#bbb' }} />
          Set filters and click <strong>Search</strong> to see payment entries grouped by date and place.
        </div>
      )}
      {searched && data.length > 0 && !resultVisible && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Button label="View Result" icon="pi pi-eye" onClick={() => setResultVisible(true)} />
        </div>
      )}

      <Dialog
        header={<span><i className="pi pi-credit-card" style={{ marginRight: 8, color: '#2196f3' }} />Payment Entries</span>}
        visible={resultVisible}
        onHide={() => setResultVisible(false)}
        style={{ width: '720px' }}
        contentStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
        maximizable
      >
        {data.length > 0 && (
          <PrintedReport data={data} fromDate={fromDate} toDate={toDate} valueField="paid" />
        )}
      </Dialog>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Balance() {
  const { t } = useTranslation();
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#1e3a5f', fontSize: 20, fontWeight: 700 }}>
          <i className="pi pi-chart-bar" style={{ marginRight: 10, color: '#2196f3' }} />
          {t('reports.title')}
        </h2>
        <p style={{ color: '#888', fontSize: 13, marginTop: 4, marginBottom: 0 }}>{t('reports.subtitle')}</p>
      </div>
      <TabView>
        <TabPanel header={<span><i className="pi pi-file" style={{ marginRight: 6 }} />{t('reports.bill_report')}</span>}><BillReport /></TabPanel>
        <TabPanel header={<span><i className="pi pi-wallet" style={{ marginRight: 6 }} />{t('reports.customer_balance')}</span>}><CustomerBalance /></TabPanel>
        <TabPanel header={<span><i className="pi pi-shopping-cart" style={{ marginRight: 6 }} />{t('reports.customer_sale')}</span>}><CustomerSale /></TabPanel>
        <TabPanel header={<span><i className="pi pi-receipt" style={{ marginRight: 6 }} />{t('reports.sale_summary')}</span>}><SaleSummary /></TabPanel>
        <TabPanel header={<span><i className="pi pi-calendar-plus" style={{ marginRight: 6 }} />{t('reports.daily_sale')}</span>}><DailySale /></TabPanel>
        <TabPanel header={<span><i className="pi pi-box" style={{ marginRight: 6 }} />{t('reports.product_sale')}</span>}><ProductSale /></TabPanel>
        <TabPanel header={<span><i className="pi pi-credit-card" style={{ marginRight: 6 }} />{t('reports.payment_entries')}</span>}><PaymentEntries /></TabPanel>
      </TabView>
    </div>
  );
}
