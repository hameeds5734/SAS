import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Toast } from 'primereact/toast';
import { AutoComplete } from 'primereact/autocomplete';
import { Divider } from 'primereact/divider';
import { billsApi, customersApi, productsApi } from '../../services/api';

const toLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Addbill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [billDate, setBillDate] = useState(new Date());
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // Quick-entry state
  const [entryName, setEntryName] = useState('');
  const [entryProductId, setEntryProductId] = useState(null);
  const [entryQty, setEntryQty] = useState(1);
  const [entryRate, setEntryRate] = useState(0);
  const [suggestions, setSuggestions] = useState([]);

  // Keyboard-flow refs
  const productInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);

  // Always-current mirrors for qty/rate (avoids stale-closure on Enter keydown)
  const entryQtyRef = useRef(1);
  const entryRateRef = useRef(0);

  const focusSelect = (ref) => {
    setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 50);
  };

  // Read the current typed value straight from the DOM input (bypasses onValueChange timing)
  const readDomNum = (ref) =>
    parseFloat((ref.current?.value || '0').replace(/,/g, '')) || 0;

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  useEffect(() => {
    const init = async () => {
      const [custRes, prodRes] = await Promise.all([customersApi.getAll(), productsApi.getAll()]);
      const custs = custRes.data;
      const prods = prodRes.data.map(pr => ({
        ...pr,
        label: pr.sub_product ? `${pr.base_product} - ${pr.sub_product}` : pr.base_product,
      }));
      setCustomers(custs);
      setProducts(prods);
      if (id) await loadBill(id, custs);
    };
    init().catch(() => toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Could not load data' }));
  }, []); // eslint-disable-line

  useEffect(() => {
    setTimeout(() => productInputRef.current?.focus(), 300);
  }, []);

  const loadBill = async (billId, custs) => {
    try {
      const { data } = await billsApi.getById(billId);
      const custList = custs || customers;
      setBillDate(new Date(data.bill_date));
      setCustomer(custList.find(c => c.id === data.customer_id) || { id: data.customer_id, name: data.customer_name });
      setItems(data.items.length ? data.items.map(i => ({ ...i, _key: Math.random().toString(36).slice(2) })) : []);
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Could not load bill' });
    }
  };

  const resetForm = () => {
    setBillDate(new Date());
    setCustomer(null);
    setItems([]);
    setEntryName('');
    setEntryProductId(null);
    setEntryQty(1);
    setEntryRate(0);
    if (id) navigate('/addbill');
    setTimeout(() => productInputRef.current?.focus(), 100);
  };

  const searchProduct = ({ query }) => {
    const q = query.toLowerCase();
    setSuggestions(products.filter(p => p.label.toLowerCase().includes(q)));
  };

  const addEntry = () => {
    if (!entryName.trim()) {
      productInputRef.current?.focus();
      return;
    }
    const qty = entryQtyRef.current;
    const rate = entryRateRef.current;
    const amount = qty * rate;
    setItems(prev => [...prev, {
      _key: Math.random().toString(36).slice(2),
      product_id: entryProductId,
      product_name: entryName.trim(),
      quantity: qty,
      rate,
      amount,
    }]);
    setEntryName('');
    setEntryProductId(null);
    entryQtyRef.current = 1;
    entryRateRef.current = 0;
    setEntryQty(1);
    setEntryRate(0);
    setTimeout(() => productInputRef.current?.focus(), 50);
  };

  const updateItem = (_key, field, value) => {
    setItems(prev => prev.map(item => {
      if (item._key !== _key) return item;
      const upd = { ...item, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        upd.amount = parseFloat(upd.quantity || 0) * parseFloat(upd.rate || 0);
      } else if (field === 'amount') {
        upd.amount = parseFloat(value) || 0;
      }
      return upd;
    }));
  };

  const handleSave = async () => {
    if (!customer) return toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Please select a customer' });
    const validItems = items.filter(i => i.product_name || i.amount);
    if (!validItems.length) return toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Add at least one item' });

    const payload = {
      bill_date: toLocalDate(billDate),
      customer_id: customer.id,
      total_amount: total,
      paid_amount: 0,
      items: validItems,
    };

    setSaving(true);
    try {
      if (id) {
        await billsApi.update(id, payload);
        toast.current.show({ severity: 'success', summary: 'Updated', detail: 'Bill updated successfully' });
      } else {
        const res = await billsApi.create(payload);
        toast.current.show({ severity: 'success', summary: 'Saved', detail: `Bill #${res.data.id} created` });
        resetForm();
      }
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to save bill' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toast ref={toast} />

      <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#1e3a5f', fontSize: 20, fontWeight: 700 }}>
            <i className="pi pi-file-plus" style={{ marginRight: 10, color: '#2196f3' }} />
            {id ? `Edit Bill #${id}` : 'New Bill'}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {id && <Button label="New Bill" icon="pi pi-plus" className="p-button-outlined p-button-sm" onClick={resetForm} />}
            <Button label="View All Bills" icon="pi pi-list" className="p-button-outlined p-button-secondary p-button-sm" onClick={() => navigate('/vib')} />
          </div>
        </div>

        {/* Date + Customer */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, marginBottom: 20 }}>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Bill Date</label>
            <Calendar value={billDate} onChange={e => setBillDate(e.value)} dateFormat="dd-mm-yy" showIcon style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Customer *</label>
            <Dropdown
              value={customer}
              options={customers}
              onChange={e => setCustomer(e.value)}
              optionLabel="name"
              filter
              filterPlaceholder="Search customer..."
              placeholder="Select Customer"
              style={{ width: '100%' }}
              itemTemplate={opt => (
                <div>
                  <div style={{ fontWeight: 600 }}>{opt.name}</div>
                  {opt.place_name && <div style={{ fontSize: 12, color: '#888' }}>{opt.place_name}</div>}
                </div>
              )}
            />
          </div>
        </div>

        {/* Quick-entry row */}
        <div style={{ background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px auto', gap: 12, alignItems: 'flex-end' }}>
            <div className="flex flex-column gap-1">
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Product Name</label>
              <AutoComplete
                inputRef={productInputRef}
                value={entryName}
                suggestions={suggestions}
                completeMethod={searchProduct}
                field="label"
                onChange={e => {
                  const v = e.value;
                  if (typeof v === 'string') {
                    setEntryName(v);
                    setEntryProductId(null);
                  } else if (v && typeof v === 'object') {
                    // object arrives before onSelect — extract label immediately
                    setEntryName(v.label || '');
                  }
                }}
                onSelect={e => {
                  const prod = e.value;
                  setEntryName(prod.label);
                  setEntryProductId(prod.id);
                  entryRateRef.current = prod.price || 0;
                  setEntryRate(prod.price || 0);
                  focusSelect(qtyInputRef);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    focusSelect(qtyInputRef);
                  }
                }}
                placeholder="Type or select product..."
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
                forceSelection={false}
              />
            </div>

            <div className="flex flex-column gap-1">
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Quantity</label>
              <InputNumber
                inputRef={qtyInputRef}
                value={entryQty}
                onValueChange={e => { const v = e.value ?? 1; entryQtyRef.current = v; setEntryQty(v); }}
                min={0}
                minFractionDigits={0}
                maxFractionDigits={3}
                inputStyle={{ textAlign: 'right', width: '100%' }}
                style={{ width: '100%' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    entryQtyRef.current = readDomNum(qtyInputRef);
                    focusSelect(rateInputRef);
                  }
                }}
              />
            </div>

            <div className="flex flex-column gap-1">
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Rate (₹)</label>
              <InputNumber
                inputRef={rateInputRef}
                value={entryRate}
                onValueChange={e => { const v = e.value ?? 0; entryRateRef.current = v; setEntryRate(v); }}
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                inputStyle={{ textAlign: 'right', width: '100%' }}
                style={{ width: '100%' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    entryQtyRef.current = readDomNum(qtyInputRef);
                    entryRateRef.current = readDomNum(rateInputRef);
                    addEntry();
                  }
                }}
              />
            </div>

            <Button
              icon="pi pi-plus"
              label="Add"
              className="p-button-sm"
              onClick={addEntry}
              style={{ height: 42, whiteSpace: 'nowrap' }}
            />
          </div>
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <div style={{ marginBottom: 16, maxHeight: 220, overflowY: 'auto', border: '1px solid #eef0f6', borderRadius: 6 }}>
            <table className="bill-items-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Product</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item._key}>
                    <td style={{ color: '#999', textAlign: 'center', fontSize: 12 }}>{idx + 1}</td>
                    <td>
                      <InputText
                        value={item.product_name}
                        onChange={e => updateItem(item._key, 'product_name', e.target.value)}
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </td>
                    <td>
                      <InputNumber
                        value={item.quantity}
                        onValueChange={e => updateItem(item._key, 'quantity', e.value ?? 0)}
                        min={0} minFractionDigits={0} maxFractionDigits={3}
                        style={{ width: '100%' }} inputStyle={{ textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <InputNumber
                        value={item.rate}
                        onValueChange={e => updateItem(item._key, 'rate', e.value ?? 0)}
                        min={0} minFractionDigits={2} maxFractionDigits={2}
                        style={{ width: '100%' }} inputStyle={{ textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <InputNumber
                        value={item.amount}
                        onValueChange={e => updateItem(item._key, 'amount', e.value ?? 0)}
                        min={0} minFractionDigits={2} maxFractionDigits={2}
                        style={{ width: '100%' }} inputStyle={{ textAlign: 'right', fontWeight: 600 }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        icon="pi pi-trash"
                        className="p-button-text p-button-danger p-button-sm"
                        onClick={() => setItems(p => p.filter(x => x._key !== item._key))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Divider />

        {/* Actions + Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button label={id ? 'Update Bill' : 'Save Bill'} icon="pi pi-save" onClick={handleSave} loading={saving} />
            <Button label="Clear" icon="pi pi-refresh" className="p-button-outlined p-button-secondary" onClick={resetForm} />
          </div>

          <div style={{ background: '#1e3a5f', borderRadius: 10, padding: '12px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Total Amount
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>₹ {total.toFixed(2)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
