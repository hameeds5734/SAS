import { useState, useEffect, useRef } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { confirmDialog } from 'primereact/confirmdialog';
import { Card } from 'primereact/card';
import { useTranslation } from 'react-i18next';
import { customersApi, productsApi, placesApi, baseProductsApi } from '../../services/api';

// ─── Places Tab ───────────────────────────────────────────────────────────────
function PlacesTab() {
  const toast = useRef(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ id: null, name: '' });

  const load = async () => {
    setLoading(true);
    try { setPlaces((await placesApi.getAll()).data); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const openNew = () => { setForm({ id: null, name: '' }); setDialog(true); };
  const openEdit = (row) => { setForm({ id: row.id, name: row.name }); setDialog(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Place name is required' });
    try {
      form.id ? await placesApi.update(form.id, { name: form.name }) : await placesApi.create({ name: form.name });
      toast.current.show({ severity: 'success', summary: 'Saved', detail: `Place ${form.id ? 'updated' : 'added'}` });
      setDialog(false);
      load();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Operation failed';
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg });
    }
  };

  const remove = (row) => confirmDialog({
    message: `Delete place "${row.name}"?`,
    header: 'Confirm Delete', icon: 'pi pi-trash', acceptClassName: 'p-button-danger',
    accept: async () => {
      try { await placesApi.remove(row.id); toast.current.show({ severity: 'success', summary: 'Deleted', detail: 'Place deleted' }); load(); }
      catch { toast.current.show({ severity: 'error', summary: 'Error', detail: 'Cannot delete (may be in use by customers)' }); }
    },
  });

  return (
    <>
      <Toast ref={toast} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button label="Add Place" icon="pi pi-plus" onClick={openNew} />
      </div>
      <DataTable value={places} loading={loading} stripedRows rowHover size="small" emptyMessage="No places found">
        <Column field="id" header="ID" style={{ width: 60 }} />
        <Column field="name" header="Place Name" />
        <Column header="Actions" style={{ width: 100 }} body={row => (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button icon="pi pi-pencil" className="p-button-text p-button-sm" onClick={() => openEdit(row)} />
            <Button icon="pi pi-trash" className="p-button-text p-button-danger p-button-sm" onClick={() => remove(row)} />
          </div>
        )} />
      </DataTable>

      <Dialog header={form.id ? 'Edit Place' : 'Add Place'} visible={dialog} onHide={() => setDialog(false)} style={{ width: 360 }}
        footer={<><Button label="Cancel" className="p-button-text" onClick={() => setDialog(false)} /><Button label="Save" icon="pi pi-check" onClick={save} /></>}>
        <div className="flex flex-column gap-2 mt-2">
          <label style={{ fontWeight: 600, fontSize: 13 }}>Place Name *</label>
          <InputText value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter place name" autoFocus />
        </div>
      </Dialog>
    </>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab() {
  const toast = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', place_id: null, phone: '' });
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([customersApi.getAll(), placesApi.getAll()]);
      setCustomers(c.data);
      setPlaces(p.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const openNew = () => { setForm({ id: null, name: '', place_id: null, phone: '' }); setDialog(true); };
  const openEdit = (row) => { setForm({ id: row.id, name: row.name, place_id: row.place_id, phone: row.phone || '' }); setDialog(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Customer name is required' });
    try {
      form.id ? await customersApi.update(form.id, form) : await customersApi.create(form);
      toast.current.show({ severity: 'success', summary: 'Saved', detail: `Customer ${form.id ? 'updated' : 'added'}` });
      setDialog(false);
      load();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Operation failed';
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg });
    }
  };

  const remove = (row) => confirmDialog({
    message: `Delete customer "${row.name}"? This may affect existing bills.`,
    header: 'Confirm Delete', icon: 'pi pi-trash', acceptClassName: 'p-button-danger',
    accept: async () => {
      try { await customersApi.remove(row.id); toast.current.show({ severity: 'success', summary: 'Deleted', detail: 'Customer deleted' }); load(); }
      catch { toast.current.show({ severity: 'error', summary: 'Error', detail: 'Cannot delete (has linked bills)' }); }
    },
  });

  const filtered = customers.filter(c =>
    !filter || c.name.toLowerCase().includes(filter.toLowerCase()) || (c.place_name || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      <Toast ref={toast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, maxWidth: 320 }}>
          <i className="pi pi-search" style={{ position: 'absolute', left: '0.75rem', color: '#6c757d', pointerEvents: 'none', zIndex: 1 }} />
          <InputText value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name or place..." style={{ width: '100%', paddingLeft: '2.25rem' }} />
        </span>
        <Button label="Add Customer" icon="pi pi-plus" onClick={openNew} />
      </div>
      <DataTable value={filtered} loading={loading} stripedRows rowHover size="small" paginator rows={10} emptyMessage="No customers found">
        <Column field="id" header="ID" style={{ width: 60 }} />
        <Column field="name" header="Customer Name" sortable />
        <Column field="place_name" header="Place" sortable body={row => row.place_name || <span style={{ color: '#ccc' }}>—</span>} />
        <Column field="phone" header="Phone" body={row => row.phone || <span style={{ color: '#ccc' }}>—</span>} />
        <Column header="Actions" style={{ width: 100 }} body={row => (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button icon="pi pi-pencil" className="p-button-text p-button-sm" onClick={() => openEdit(row)} />
            <Button icon="pi pi-trash" className="p-button-text p-button-danger p-button-sm" onClick={() => remove(row)} />
          </div>
        )} />
      </DataTable>

      <Dialog header={form.id ? 'Edit Customer' : 'Add Customer'} visible={dialog} onHide={() => setDialog(false)} style={{ width: 420 }}
        footer={<><Button label="Cancel" className="p-button-text" onClick={() => setDialog(false)} /><Button label="Save" icon="pi pi-check" onClick={save} /></>}>
        <div className="flex flex-column gap-3 mt-2">
          <div className="flex flex-column gap-1">
            <label style={{ fontWeight: 600, fontSize: 13 }}>Customer Name *</label>
            <InputText value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontWeight: 600, fontSize: 13 }}>Place</label>
            <Dropdown value={form.place_id} options={places} optionLabel="name" optionValue="id"
              onChange={e => setForm(f => ({ ...f, place_id: e.value }))} placeholder="Select place" showClear filter style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontWeight: 600, fontSize: 13 }}>Phone</label>
            <InputText value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Mobile number" />
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ─── Base Products Tab ────────────────────────────────────────────────────────
function BaseProductsTab() {
  const toast = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ id: null, name: '' });
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try { setItems((await baseProductsApi.getAll()).data); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const openNew = () => { setForm({ id: null, name: '' }); setDialog(true); };
  const openEdit = (row) => { setForm({ id: row.id, name: row.name }); setDialog(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Base product name is required' });
    try {
      form.id ? await baseProductsApi.update(form.id, { name: form.name }) : await baseProductsApi.create({ name: form.name });
      toast.current.show({ severity: 'success', summary: 'Saved', detail: `Base product ${form.id ? 'updated' : 'added'}` });
      setDialog(false);
      load();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Operation failed';
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg });
    }
  };

  const remove = (row) => confirmDialog({
    message: `Delete base product "${row.name}"? This will fail if any products reference it.`,
    header: 'Confirm Delete', icon: 'pi pi-trash', acceptClassName: 'p-button-danger',
    accept: async () => {
      try { await baseProductsApi.remove(row.id); toast.current.show({ severity: 'success', summary: 'Deleted', detail: 'Base product deleted' }); load(); }
      catch (err) {
        const msg = err?.response?.data?.error || 'Cannot delete (may be in use)';
        toast.current.show({ severity: 'error', summary: 'Error', detail: msg });
      }
    },
  });

  const filtered = items.filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <Toast ref={toast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, maxWidth: 320 }}>
          <i className="pi pi-search" style={{ position: 'absolute', left: '0.75rem', color: '#6c757d', pointerEvents: 'none', zIndex: 1 }} />
          <InputText value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search base product..." style={{ width: '100%', paddingLeft: '2.25rem' }} />
        </span>
        <Button label="Add Base Product" icon="pi pi-plus" onClick={openNew} />
      </div>
      <DataTable value={filtered} loading={loading} stripedRows rowHover size="small" paginator rows={10} emptyMessage="No base products found">
        <Column field="id" header="ID" style={{ width: 60 }} />
        <Column field="name" header="Base Product Name" sortable />
        <Column header="Actions" style={{ width: 100 }} body={row => (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button icon="pi pi-pencil" className="p-button-text p-button-sm" onClick={() => openEdit(row)} />
            <Button icon="pi pi-trash" className="p-button-text p-button-danger p-button-sm" onClick={() => remove(row)} />
          </div>
        )} />
      </DataTable>

      <Dialog header={form.id ? 'Edit Base Product' : 'Add Base Product'} visible={dialog} onHide={() => setDialog(false)} style={{ width: 380 }}
        footer={<><Button label="Cancel" className="p-button-text" onClick={() => setDialog(false)} /><Button label="Save" icon="pi pi-check" onClick={save} /></>}>
        <div className="flex flex-column gap-2 mt-2">
          <label style={{ fontWeight: 600, fontSize: 13 }}>Base Product Name *</label>
          <InputText value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rice" autoFocus />
        </div>
      </Dialog>
    </>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab() {
  const toast = useRef(null);
  const [products, setProducts] = useState([]);
  const [baseProducts, setBaseProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ id: null, base_product_id: null, sub_product: '', price: 0 });
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, bp] = await Promise.all([productsApi.getAll(), baseProductsApi.getAll()]);
      setProducts(p.data);
      setBaseProducts(bp.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const openNew = () => { setForm({ id: null, base_product_id: null, sub_product: '', price: 0 }); setDialog(true); };
  const openEdit = (row) => { setForm({ id: row.id, base_product_id: row.base_product_id, sub_product: row.sub_product || '', price: parseFloat(row.price) || 0 }); setDialog(true); };

  const save = async () => {
    if (!form.base_product_id) return toast.current.show({ severity: 'warn', summary: 'Required', detail: 'Select a base product' });
    try {
      form.id ? await productsApi.update(form.id, form) : await productsApi.create(form);
      toast.current.show({ severity: 'success', summary: 'Saved', detail: `Product ${form.id ? 'updated' : 'added'}` });
      setDialog(false);
      load();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Operation failed';
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg });
    }
  };

  const remove = (row) => confirmDialog({
    message: `Delete product "${row.base_product}${row.sub_product ? ' - ' + row.sub_product : ''}"?`,
    header: 'Confirm Delete', icon: 'pi pi-trash', acceptClassName: 'p-button-danger',
    accept: async () => {
      try { await productsApi.remove(row.id); toast.current.show({ severity: 'success', summary: 'Deleted', detail: 'Product deleted' }); load(); }
      catch { toast.current.show({ severity: 'error', summary: 'Error', detail: 'Cannot delete (may be in use)' }); }
    },
  });

  const filtered = products.filter(p =>
    !filter || (p.base_product || '').toLowerCase().includes(filter.toLowerCase()) || (p.sub_product || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      <Toast ref={toast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, maxWidth: 320 }}>
          <i className="pi pi-search" style={{ position: 'absolute', left: '0.75rem', color: '#6c757d', pointerEvents: 'none', zIndex: 1 }} />
          <InputText value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search product..." style={{ width: '100%', paddingLeft: '2.25rem' }} />
        </span>
        <Button label="Add Product" icon="pi pi-plus" onClick={openNew} disabled={baseProducts.length === 0}
          tooltip={baseProducts.length === 0 ? 'Add a base product first' : undefined} />
      </div>
      <DataTable value={filtered} loading={loading} stripedRows rowHover size="small" paginator rows={10} emptyMessage="No products found">
        <Column field="id" header="ID" style={{ width: 60 }} />
        <Column field="base_product" header="Base Product" sortable />
        <Column field="sub_product" header="Sub Product / Variant" body={row => row.sub_product || <span style={{ color: '#ccc' }}>—</span>} />
        <Column field="price" header="Default Price (₹)" style={{ textAlign: 'right' }}
          body={row => <span style={{ fontWeight: 600, color: '#1e3a5f' }}>₹ {parseFloat(row.price).toFixed(2)}</span>} />
        <Column header="Actions" style={{ width: 100 }} body={row => (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button icon="pi pi-pencil" className="p-button-text p-button-sm" onClick={() => openEdit(row)} />
            <Button icon="pi pi-trash" className="p-button-text p-button-danger p-button-sm" onClick={() => remove(row)} />
          </div>
        )} />
      </DataTable>

      <Dialog header={form.id ? 'Edit Product' : 'Add Product'} visible={dialog} onHide={() => setDialog(false)} style={{ width: 420 }}
        footer={<><Button label="Cancel" className="p-button-text" onClick={() => setDialog(false)} /><Button label="Save" icon="pi pi-check" onClick={save} /></>}>
        <div className="flex flex-column gap-3 mt-2">
          <div className="flex flex-column gap-1">
            <label style={{ fontWeight: 600, fontSize: 13 }}>Base Product *</label>
            <Dropdown value={form.base_product_id} options={baseProducts} optionLabel="name" optionValue="id"
              onChange={e => setForm(f => ({ ...f, base_product_id: e.value }))}
              placeholder="Select base product" filter showClear style={{ width: '100%' }} />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontWeight: 600, fontSize: 13 }}>Sub Product / Variant</label>
            <InputText value={form.sub_product} onChange={e => setForm(f => ({ ...f, sub_product: e.target.value }))} placeholder="e.g. Basmati 25kg" />
          </div>
          <div className="flex flex-column gap-1">
            <label style={{ fontWeight: 600, fontSize: 13 }}>Default Price (₹)</label>
            <InputNumber value={form.price} onValueChange={e => setForm(f => ({ ...f, price: e.value ?? 0 }))}
              min={0} minFractionDigits={2} maxFractionDigits={2} prefix="₹ " style={{ width: '100%' }} />
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AccountCreation() {
  const { t } = useTranslation();
  return (
    <Card style={{ borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: '#1e3a5f', fontSize: 20, fontWeight: 700 }}>
          <i className="pi pi-cog" style={{ marginRight: 10, color: '#2196f3' }} />
          {t('masterdata.title')}
        </h2>
        <p style={{ color: '#888', fontSize: 13, marginTop: 4, marginBottom: 0 }}>{t('masterdata.subtitle')}</p>
      </div>
      <TabView>
        <TabPanel header={<span><i className="pi pi-users" style={{ marginRight: 6 }} />{t('fields.customers')}</span>}><CustomersTab /></TabPanel>
        <TabPanel header={<span><i className="pi pi-tag" style={{ marginRight: 6 }} />{t('fields.base_products')}</span>}><BaseProductsTab /></TabPanel>
        <TabPanel header={<span><i className="pi pi-box" style={{ marginRight: 6 }} />{t('fields.products')}</span>}><ProductsTab /></TabPanel>
        <TabPanel header={<span><i className="pi pi-map-marker" style={{ marginRight: 6 }} />{t('fields.places')}</span>}><PlacesTab /></TabPanel>
      </TabView>
    </Card>
  );
}
