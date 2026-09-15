import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Layers,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  CreditCard,
  Ban,
  TrendingUp,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  reservedStock: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: Product;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'RESERVED' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  totalAmount: number;
  customerName: string;
  expiresAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

const API_BASE = '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'orders' | 'concurrency'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverHealthy, setServerHealthy] = useState(true);

  // Active Checkout state
  const [activeReservation, setActiveReservation] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentOutcome, setPaymentOutcome] = useState<'SUCCESS' | 'FAILURE' | 'TIMEOUT'>('SUCCESS');

  // Product CRUD modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'Hardware',
  });

  // Concurrency Benchmark state
  const [concurrencyStock, setConcurrencyStock] = useState(5);
  const [concurrencyRequests, setConcurrencyRequests] = useState(50);
  const [concurrencyLoading, setConcurrencyLoading] = useState(false);
  const [concurrencyResult, setConcurrencyResult] = useState<any>(null);

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch products and orders
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, ordRes] = await Promise.all([
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/orders`),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.data || []);
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.data || []);
      }
      setServerHealthy(true);
    } catch (err) {
      console.error('Fetch error:', err);
      setServerHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      showToast(`'${product.name}' is out of available stock!`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          showToast(`Cannot add more than available stock (${product.stock})`, 'error');
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) {
              showToast(`Cannot exceed available stock of ${item.product.stock}`, 'error');
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Step 1: Initiate Checkout & Reserve Stock
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      setPaymentLoading(true);
      const res = await fetch(`${API_BASE}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'POS Cashier Station #1',
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Checkout reservation failed', 'error');
        return;
      }

      setActiveReservation(data.data);
      setShowPaymentModal(true);
      clearCart();
      showToast('Stock reserved for 5 minutes! Proceed to payment.', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Step 2: Simulate Payment (Success, Failure, Timeout)
  const handleProcessPayment = async () => {
    if (!activeReservation) return;

    try {
      setPaymentLoading(true);
      const res = await fetch(`${API_BASE}/payments/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeReservation.id,
          simulateStatus: paymentOutcome,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Payment failed', 'error');
        return;
      }

      if (paymentOutcome === 'SUCCESS') {
        showToast('Payment SUCCESS! Order is confirmed and marked PAID.', 'success');
        setShowPaymentModal(false);
        setActiveReservation(null);
      } else if (paymentOutcome === 'FAILURE') {
        showToast('Simulated payment FAILURE. Reserved stock released back to inventory.', 'error');
        setShowPaymentModal(false);
        setActiveReservation(null);
      } else {
        showToast('Gateway TIMEOUT simulated. Order remains reserved pending retry or expiration.', 'info');
        setShowPaymentModal(false);
      }

      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Cancel reservation
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this reservation and release the stock?')) return;

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Order cancelled and reserved stock restored.', 'success');
        if (activeReservation?.id === orderId) {
          setShowPaymentModal(false);
          setActiveReservation(null);
        }
        fetchData();
      } else {
        showToast(data.error || 'Failed to cancel order', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Product CRUD
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct
        ? `${API_BASE}/products/${editingProduct.id}`
        : `${API_BASE}/products`;
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
          category: productForm.category,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Product ${editingProduct ? 'updated' : 'created'} successfully!`, 'success');
        setShowProductModal(false);
        setEditingProduct(null);
        fetchData();
      } else {
        showToast(data.error || 'Failed to save product', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Product deleted.', 'success');
        fetchData();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Run Concurrency Stress Test
  const handleRunConcurrencyTest = async () => {
    try {
      setConcurrencyLoading(true);
      setConcurrencyResult(null);
      const res = await fetch(`${API_BASE}/test/concurrency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialStock: Number(concurrencyStock),
          totalRequests: Number(concurrencyRequests),
        }),
      });
      const data = await res.json();
      setConcurrencyResult(data);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setConcurrencyLoading(false);
    }
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            padding: '14px 20px',
            borderRadius: 12,
            background:
              toast.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : toast.type === 'error'
                ? 'rgba(244, 63, 94, 0.95)'
                : 'rgba(99, 102, 241, 0.95)',
            color: '#fff',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {toast.type === 'success' && <CheckCircle2 size={18} />}
          {toast.type === 'error' && <XCircle size={18} />}
          {toast.type === 'info' && <Clock size={18} />}
          {toast.message}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '14px 28px',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              <ShoppingCart size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  TECHLOOM POS
                </h1>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  TASK 01
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Concurrency-Safe Order & Inventory System
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12 }}>
            <button
              onClick={() => setActiveTab('pos')}
              className={`btn ${activeTab === 'pos' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              <ShoppingCart size={16} /> Cashier POS
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              <Package size={16} /> Inventory ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              <Layers size={16} /> Orders & Reservations ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('concurrency')}
              className={`btn ${activeTab === 'concurrency' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '8px 14px',
                fontSize: '0.82rem',
                borderColor: activeTab === 'concurrency' ? 'transparent' : 'rgba(245, 158, 11, 0.4)',
                color: activeTab === 'concurrency' ? '#fff' : '#f59e0b',
              }}
            >
              <Zap size={16} /> Concurrency Benchmark
            </button>
          </nav>

          {/* Server status & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8rem',
                color: serverHealthy ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                padding: '4px 10px',
                borderRadius: 8,
                background: serverHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              }}
            >
              <div
                className="pulse-dot"
                style={{
                  background: serverHealthy ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                }}
              />
              {serverHealthy ? 'Backend Connected' : 'Connecting...'}
            </div>
            <button
              onClick={fetchData}
              className="btn btn-secondary"
              style={{ padding: 8 }}
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 28px', flex: 1, width: '100%' }}>
        {/* ======================= TAB 1: POS REGISTER ======================= */}
        {activeTab === 'pos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
            {/* Catalog Section */}
            <div>
              {/* Search and Filters */}
              <div
                className="glass-panel"
                style={{
                  padding: 16,
                  marginBottom: 20,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="text"
                  placeholder="Search products by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ flex: 1, minWidth: 220 }}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: 'auto', minWidth: 140 }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  return (
                    <div
                      key={p.id}
                      className="glass-panel"
                      style={{
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: isOutOfStock ? 0.7 : 1,
                        border: isOutOfStock ? '1px solid rgba(244, 63, 94, 0.2)' : undefined,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-dim)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {p.category}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: isOutOfStock ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                              background: isOutOfStock
                                ? 'rgba(244, 63, 94, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            {isOutOfStock ? 'OUT OF STOCK' : `${p.stock} AVAILABLE`}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            marginBottom: 12,
                            minHeight: 36,
                          }}
                        >
                          {p.description || 'Standard POS merchant inventory product'}
                        </p>
                      </div>

                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              color: '#fff',
                            }}
                          >
                            ${p.price.toFixed(2)}
                          </span>
                          {p.reservedStock > 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)' }}>
                              ({p.reservedStock} reserved)
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => addToCart(p)}
                          disabled={isOutOfStock}
                          className={`btn ${isOutOfStock ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ width: '100%' }}
                        >
                          <Plus size={16} /> {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cart & Cashier Sidebar */}
            <div className="glass-panel" style={{ padding: 20, position: 'sticky', top: 90 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCart size={20} color="var(--primary)" />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Active Cart</h2>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-rose)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Cart
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-dim)' }}>
                  <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ fontSize: '0.9rem' }}>Your POS cart is empty.</p>
                  <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Select items from the catalog.</p>
                </div>
              ) : (
                <>
                  <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: 10 }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                            {item.product.name}
                          </p>
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-dim)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            ${item.product.price.toFixed(2)} each
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: 'rgba(255,255,255,0.08)',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              minWidth: 20,
                              textAlign: 'center',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: 'rgba(255,255,255,0.08)',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-rose)',
                              cursor: 'pointer',
                              marginLeft: 4,
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pricing Summary */}
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      padding: 14,
                      borderRadius: 10,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      <span>Subtotal</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      <span>Sales Tax (0%)</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>$0.00</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: '#fff',
                        paddingTop: 8,
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      <span>Total</span>
                      <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                        ${cartTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={handleCheckout}
                    disabled={paymentLoading}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px 18px', fontSize: '1rem' }}
                  >
                    <CreditCard size={18} />
                    {paymentLoading ? 'Reserving Stock...' : 'Proceed to Checkout'}
                  </button>
                  <p
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-dim)',
                      textAlign: 'center',
                      marginTop: 8,
                    }}
                  >
                    Reserves items for 5 mins under atomic transaction locks.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB 2: INVENTORY CRUD ======================= */}
        {activeTab === 'inventory' && (
          <div className="glass-panel" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Product & Stock Management</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Accurate real-time stock levels with atomic updates
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', description: '', price: 29.99, stock: 10, category: 'Hardware' });
                  setShowProductModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} /> Add New Product
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Available Stock</th>
                    <th>Reserved Stock</th>
                    <th>Total Stock</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const totalPhysical = p.stock + p.reservedStock;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {p.description || 'ID: ' + p.id.slice(0, 8)}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              background: 'rgba(255,255,255,0.06)',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            {p.category}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          ${p.price.toFixed(2)}
                        </td>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: p.stock > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                            }}
                          >
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: p.reservedStock > 0 ? 'var(--accent-amber)' : 'var(--text-dim)',
                            }}
                          >
                            {p.reservedStock}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{totalPhysical}</td>
                        <td>
                          <span
                            className={`badge ${
                              p.stock > 0 ? 'badge-paid' : 'badge-failed'
                            }`}
                          >
                            {p.stock > 0 ? 'IN STOCK' : 'DEPLETED'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  name: p.name,
                                  description: p.description,
                                  price: p.price,
                                  stock: p.stock,
                                  category: p.category,
                                });
                                setShowProductModal(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="btn btn-danger"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: ORDERS & RESERVATIONS ======================= */}
        {activeTab === 'orders' && (
          <div className="glass-panel" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Orders & Active Stock Reservations</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Tracks the full order lifecycle: PENDING $\rightarrow$ RESERVED $\rightarrow$ PAID / CANCELLED / EXPIRED
                </p>
              </div>
              <button onClick={fetchData} className="btn btn-secondary">
                <RefreshCw size={15} /> Refresh Orders
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Reservation TTL</th>
                    <th>Created At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                        No orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => {
                      const isReserved = o.status === 'RESERVED';
                      return (
                        <tr key={o.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>
                            {o.orderNumber}
                          </td>
                          <td>{o.customerName}</td>
                          <td>
                            <div style={{ fontSize: '0.8rem' }}>
                              {o.items?.map((item) => (
                                <div key={item.id}>
                                  {item.quantity}x {item.product?.name || 'Product'}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                            ${o.totalAmount.toFixed(2)}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                o.status === 'PAID'
                                  ? 'badge-paid'
                                  : o.status === 'RESERVED'
                                  ? 'badge-reserved'
                                  : o.status === 'CANCELLED'
                                  ? 'badge-cancelled'
                                  : o.status === 'EXPIRED'
                                  ? 'badge-expired'
                                  : 'badge-failed'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td>
                            {isReserved && o.expiresAt ? (
                              <CountdownBadge expiresAt={o.expiresAt} onExpire={fetchData} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {new Date(o.createdAt).toLocaleTimeString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isReserved && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  onClick={() => {
                                    setActiveReservation(o);
                                    setShowPaymentModal(true);
                                  }}
                                  className="btn btn-success"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                >
                                  <CreditCard size={14} /> Pay
                                </button>
                                <button
                                  onClick={() => handleCancelOrder(o.id)}
                                  className="btn btn-danger"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                >
                                  <Ban size={14} /> Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB 4: CONCURRENCY BENCHMARK ======================= */}
        {activeTab === 'concurrency' && (
          <div>
            <div
              className="glass-panel"
              style={{
                padding: 24,
                marginBottom: 24,
                border: '1px solid rgba(245, 158, 11, 0.3)',
                background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(18, 24, 39, 0.8) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Zap size={26} color="var(--accent-amber)" />
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                  Automated Concurrency & Race Condition Stress Test
                </h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 840, lineHeight: 1.6 }}>
                Simulates real-world POS traffic where <strong>multiple concurrent buyers simultaneously</strong> attempt
                to purchase a limited-stock item. Proves that database transactions and atomic decrement guards{' '}
                <strong>completely eliminate overselling</strong>.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 20,
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    INITIAL PRODUCT STOCK
                  </label>
                  <input
                    type="number"
                    value={concurrencyStock}
                    onChange={(e) => setConcurrencyStock(Number(e.target.value))}
                    min={1}
                    max={20}
                    style={{ width: 140, marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    CONCURRENT BUYERS (SIMULTANEOUS)
                  </label>
                  <input
                    type="number"
                    value={concurrencyRequests}
                    onChange={(e) => setConcurrencyRequests(Number(e.target.value))}
                    min={5}
                    max={100}
                    style={{ width: 180, marginTop: 4 }}
                  />
                </div>
                <button
                  onClick={handleRunConcurrencyTest}
                  disabled={concurrencyLoading}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                    padding: '10px 24px',
                    fontWeight: 700,
                  }}
                >
                  <Zap size={18} />
                  {concurrencyLoading ? 'Firing Concurrent Requests...' : 'Execute Concurrency Test'}
                </button>
              </div>
            </div>

            {/* Test Results View */}
            {concurrencyResult && (
              <div className="glass-panel" style={{ padding: 24, animation: 'fadeIn 0.3s' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                    paddingBottom: 16,
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      TEST PRODUCT
                    </span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      {concurrencyResult.testSummary?.productName}
                    </h3>
                  </div>

                  <div
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      background: concurrencyResult.testSummary?.oversellingOccurred
                        ? 'rgba(244, 63, 94, 0.2)'
                        : 'rgba(16, 185, 129, 0.2)',
                      color: concurrencyResult.testSummary?.oversellingOccurred
                        ? 'var(--accent-rose)'
                        : 'var(--accent-emerald)',
                      border: `1px solid ${
                        concurrencyResult.testSummary?.oversellingOccurred
                          ? 'var(--accent-rose)'
                          : 'var(--accent-emerald)'
                      }`,
                    }}
                  >
                    {concurrencyResult.testSummary?.verdict}
                  </div>
                </div>

                {/* Metrics Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      TOTAL REQUESTS
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {concurrencyResult.testSummary?.totalConcurrentRequests}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Executed in {concurrencyResult.testSummary?.executionTimeMs}ms
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      SUCCESSFUL RESERVATIONS
                    </div>
                    <div
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-emerald)',
                      }}
                    >
                      {concurrencyResult.testSummary?.successfulReservations}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Expected: {concurrencyResult.testSummary?.initialStock} (201 Created)
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(244, 63, 94, 0.08)',
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 700 }}>
                      OUT OF STOCK REJECTIONS
                    </div>
                    <div
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-rose)',
                      }}
                    >
                      {concurrencyResult.testSummary?.rejectedDueToOutOfStock}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Gracefully handled (409 Conflict)
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(99, 102, 241, 0.08)',
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
                      FINAL AVAILABLE STOCK
                    </div>
                    <div
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: '#fff',
                      }}
                    >
                      {concurrencyResult.testSummary?.finalAvailableStock}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Zero Overselling Guaranteed
                    </div>
                  </div>
                </div>

                {/* Sample Request Logs */}
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 10 }}>
                  Sample Request Trajectory:
                </h4>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    padding: 12,
                    borderRadius: 8,
                    maxHeight: 220,
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                  }}
                >
                  {concurrencyResult.sampleRequests?.map((r: any) => (
                    <div
                      key={r.index}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '4px 0',
                        color: r.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)' }}>#{r.index}</span>
                      <span style={{ fontWeight: 700 }}>[{r.statusCode}]</span>
                      <span>{r.message}</span>
                      {r.orderNumber && (
                        <span style={{ color: 'var(--text-muted)' }}>({r.orderNumber})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================= MODAL: PAYMENT SIMULATOR ======================= */}
      {showPaymentModal && activeReservation && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: 28 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>POS Payment Gateway</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Order Brief */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Order Number:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {activeReservation.orderNumber}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Total Amount:</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    color: 'var(--accent-emerald)',
                    fontSize: '1.1rem',
                  }}
                >
                  ${activeReservation.totalAmount.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Stock Hold Status:</span>
                <span className="badge badge-reserved">RESERVED (5 MIN LOCK)</span>
              </div>
            </div>

            {/* Payment Outcome Simulator Selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, display: 'block' }}>
                SIMULATE PAYMENT GATEWAY OUTCOME:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentOutcome('SUCCESS')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `2px solid ${
                      paymentOutcome === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--border-color)'
                    }`,
                    background:
                      paymentOutcome === 'SUCCESS'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(255,255,255,0.02)',
                    color: paymentOutcome === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  <CheckCircle2 size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto 4px' }} />
                  Success (Paid)
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOutcome('FAILURE')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `2px solid ${
                      paymentOutcome === 'FAILURE' ? 'var(--accent-rose)' : 'var(--border-color)'
                    }`,
                    background:
                      paymentOutcome === 'FAILURE'
                        ? 'rgba(244, 63, 94, 0.15)'
                        : 'rgba(255,255,255,0.02)',
                    color: paymentOutcome === 'FAILURE' ? 'var(--accent-rose)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  <XCircle size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto 4px' }} />
                  Failure (Decline)
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOutcome('TIMEOUT')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: `2px solid ${
                      paymentOutcome === 'TIMEOUT' ? 'var(--accent-amber)' : 'var(--border-color)'
                    }`,
                    background:
                      paymentOutcome === 'TIMEOUT'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(255,255,255,0.02)',
                    color: paymentOutcome === 'TIMEOUT' ? 'var(--accent-amber)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  <Clock size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto 4px' }} />
                  Gateway Timeout
                </button>
              </div>
            </div>

            {/* Explanatory note */}
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                marginBottom: 20,
                lineHeight: 1.4,
              }}
            >
              {paymentOutcome === 'SUCCESS' &&
                'Order will transition to PAID, stock reservation will be converted to permanent sale.'}
              {paymentOutcome === 'FAILURE' &&
                'Payment will fail with CARD_DECLINED, order transitions to FAILED, and reserved stock is immediately restored to available stock.'}
              {paymentOutcome === 'TIMEOUT' &&
                'Simulates network lag. Order stays RESERVED pending retry or will auto-expire at 5 minutes.'}
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => handleCancelOrder(activeReservation.id)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel & Release Stock
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={paymentLoading}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {paymentLoading ? 'Processing...' : 'Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: PRODUCT CREATE / EDIT ======================= */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 16 }}>
              {editingProduct ? 'Edit Product' : 'Create New Product'}
            </h3>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                  PRODUCT NAME
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                  DESCRIPTION
                </label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  style={{ marginTop: 4, height: 70 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    PRICE ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    INITIAL STOCK COUNT
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                  CATEGORY
                </label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  style={{ marginTop: 4 }}
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Peripherals">Peripherals</option>
                  <option value="Accessories">Accessories</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for 5-minute reservation countdown timer
function CountdownBadge({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsLeft(0);
        clearInterval(timer);
        onExpire();
      } else {
        setSecondsLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: secondsLeft < 60 ? 'var(--accent-rose)' : 'var(--accent-amber)',
        background: secondsLeft < 60 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        padding: '2px 8px',
        borderRadius: 6,
      }}
    >
      <Clock size={12} /> {formatted}
    </span>
  );
}
