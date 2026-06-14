import { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { AutoComplete } from 'primereact/autocomplete';
import { InputNumber } from 'primereact/inputnumber';
import { Calendar } from 'primereact/calendar';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Divider } from 'primereact/divider';
import { paymentsApi, customersApi } from '../../services/api';

const toLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;


const fmt = (v) => `₹ ${parseFloat(v || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function Payments() {
  const toast = useRef(null);

  const [customers, setCustomers] = useState([]);
  const [payDate, setPayDate] = useState(new Date());
  const [entryCustomerName, setEntryCustomerName] = useState('');
  const [entryCustomer, setEntryCustomer] = useState(null);
  const [entryAmount, setEntryAmount] = useState(null);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [allPayments, setAllPayments] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const customerInputRef = useRef(null);
  const amountInputRef = useRef(null);
  const entryAmountRef = useRef(null);

  const focusSelect = (ref) => {
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 50);
  };

  const readDomNum = (ref) =>
    parseFloat((ref.current?.value || '0').replace(/,/g, '')) || 0;

  useEffect(() => {
    customersApi.getAll().then(r => setCustomers(r.data));
    loadAllPayments();
  }, []);

  useEffect(() => {
    setTimeout(() => customerInputRef.current?.focus(), 300);
  }, []);

  const loadAllPayments = async () => {
    setAllLoading(true);
    try { setAllPayments((await paymentsApi.getAll()).data); } finally { setAllLoading(false); }
  };

  const searchCustomer = ({ query }) => {
    const q = query.toLowerCase();
    setSuggestions(customers.filter(c =>
      c.name.toLowerCase().includes(q) || (c.place_name || '').toLowerCase().includes(q)
    ));
  };

  const resetEntry = () => {
    setEntryCustomerName('');
    setEntryCustomer(null);
    setEntryAmount(null);
    entryAmountRef.current = null;
    setEditId(null);
    setTimeout(() => customerInputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!entryCustomer) {
      toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Select a customer' });
      customerInputRef.current?.focus();
      return;
    }
    const amount = entryAmountRef.current ?? entryAmount;
    if (!amount || amount <= 0) {
      toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Enter a valid amount' });
      focusSelect(amountInputRef);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: entryCustomer.id,
        amount,
        payment_date: toLocalDate(payDate),
      };
      if (editId) {
        await paymentsApi.update(editId, payload);
        toast.current.show({ severity: 'success', summary: 'Updated', detail: 'Payment updated' });
      } else {
        await paymentsApi.create(payload);
        toast.current.show({ severity: 'success', summary: 'Recorded', detail: `${fmt(amount)} recorded for ${entryCustomer.name}` });
      }
      resetEntry();
      loadAllPayments();
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to save payment' });
    } finally { setSaving(false); }
  };

  const startEdit = (row) => {
    const cust = customers.find(c => c.id === row.customer_id) || { id: row.customer_id, name: row.customer_name };
    setEntryCustomer(cust);
    setEntryCustomerName(cust.name);
    const amt = parseFloat(row.amount);
    setEntryAmount(amt);
    entryAmountRef.current = amt;
    setPayDate(new Date(row.payment_date));
    setEditId(row.id);
    focusSelect(amountInputRef);
  };

  const deletePayment = (row) => confirmDialog({
    message: `Delete payment of ${fmt(row.amount)} on ${fmtDate(row.payment_date)}?`,
    header: 'Confirm Delete', icon: 'pi pi-trash', acceptClassName: 'p-button-danger',
    accept: async () => {
      try {
        await paymentsApi.remove(row.id);
        toast.current.show({ severity: 'success', summary: 'Deleted', detail: 'Payment deleted' });
        loadAllPayments();
      } catch {
        toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete' });
      }
    },
  });

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 20, fontWeight: 700 }}>
          <i className="pi pi-credit-card" style={{ marginRight: 10, color: '#2196f3' }} />
          {editId ? 'Edit Payment' : 'Record Payment'}
        </h2>

        {/* Shared date */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
            Payment Date
          </label>
          <Calendar
            value={payDate}
            onChange={e => setPayDate(e.value)}
            dateFormat="dd-mm-yy"
            showIcon
            style={{ width: 200 }}
          />
        </div>

        <Divider style={{ margin: '10px 0 14px' }} />

        {/* Entry row — customer + amount on one line */}
        <div style={{ background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 8, padding: '14px 16px' }}>
          

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 12, alignItems: 'flex-end' }}>
            <div className="flex flex-column gap-1">
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Customer</label>
              <AutoComplete
                inputRef={customerInputRef}
                value={entryCustomerName}
                suggestions={suggestions}
                completeMethod={searchCustomer}
                field="name"
                onChange={e => {
                  const v = e.value;
                  if (typeof v === 'string') {
                    setEntryCustomerName(v);
                    setEntryCustomer(null);
                  } else if (v && typeof v === 'object') {
                    setEntryCustomerName(v.name || '');
                  }
                }}
                onSelect={e => {
                  setEntryCustomer(e.value);
                  setEntryCustomerName(e.value.name);
                  focusSelect(amountInputRef);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') focusSelect(amountInputRef);
                }}
                itemTemplate={opt => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.name}</div>
                    {opt.place_name && <div style={{ fontSize: 12, color: '#888' }}>{opt.place_name}</div>}
                  </div>
                )}
                placeholder="Type or select customer..."
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
                forceSelection={false}
              />
            </div>

            <div className="flex flex-column gap-1">
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Amount (₹)</label>
              <InputNumber
                inputRef={amountInputRef}
                value={entryAmount}
                onValueChange={e => { const v = e.value ?? null; entryAmountRef.current = v; setEntryAmount(v); }}
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                placeholder="0.00"
                inputStyle={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#2e7d32', width: '100%' }}
                style={{ width: '100%' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    entryAmountRef.current = readDomNum(amountInputRef);
                    handleSave();
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                label={editId ? 'Update' : 'Record'}
                icon="pi pi-check"
                onClick={handleSave}
                loading={saving}
                style={{ height: 42 }}
              />
              {editId && (
                <Button
                  icon="pi pi-times"
                  className="p-button-outlined p-button-secondary"
                  onClick={resetEntry}
                  title="Cancel edit"
                  style={{ height: 42 }}
                />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* All payments table */}
      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <h3 style={{ color: '#1e3a5f', fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>
          <i className="pi pi-list" style={{ marginRight: 8, color: '#2196f3' }} />
          All Payments
        </h3>
        <DataTable
          value={allPayments}
          loading={allLoading}
          size="small"
          stripedRows
          rowHover
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
          emptyMessage="No payments found"
          rowClassName={row => ({ 'p-highlight': row.id === editId })}
        >
          <Column field="id" header="ID" style={{ width: 60 }} />
          <Column field="payment_date" header="Date" body={row => fmtDate(row.payment_date)} sortable />
          <Column field="customer_name" header="Customer" sortable />
          <Column
            field="amount"
            header="Amount (₹)"
            sortable
            body={row => <span style={{ fontWeight: 700, color: '#2e7d32' }}>{fmt(row.amount)}</span>}
          />
          <Column
            header="Actions"
            style={{ width: 90 }}
            body={row => (
              <div style={{ display: 'flex', gap: 4 }}>
                <Button
                  icon="pi pi-pencil"
                  className="p-button-text p-button-sm"
                  onClick={() => startEdit(row)}
                  title="Edit"
                />
                <Button
                  icon="pi pi-trash"
                  className="p-button-text p-button-danger p-button-sm"
                  onClick={() => deletePayment(row)}
                  title="Delete"
                />
              </div>
            )}
          />
        </DataTable>
      </Card>
    </div>
  );
}
