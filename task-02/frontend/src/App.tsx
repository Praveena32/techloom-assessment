import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  SlidersHorizontal,
  X,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  Star,
  Layers,
  ChevronRight,
  ShieldCheck,
  Truck,
  ArrowRight,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  reservedStock: number;
  category: string;
  imageUrl: string;
  rating: number;
  specs: Record<string, string> | null;
  isOutOfStock?: boolean;
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
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  status: 'PENDING' | 'RESERVED' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'FAILED' | 'EXPIRED';
  totalAmount: number;
  expiresAt: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: any[];
}

const API_BASE = '/api';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['ALL']);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [maxPrice, setMaxPrice] = useState(2500);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // UI Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);

  // Checkout & Payment Simulation
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment'>('details');
  const [activeReservation, setActiveReservation] = useState<Order | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentOutcome, setPaymentOutcome] = useState<'SUCCESS' | 'FAILURE' | 'TIMEOUT'>('SUCCESS');

  // Customer shipping form
  const [customerForm, setCustomerForm] = useState({
    name: 'Alex Johnson',
    email: 'alex.johnson@techloom.ai',
    address: '742 Evergreen Terrace, Suite 100',
  });

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch products with query params
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (searchQuery) query.append('q', searchQuery);
      if (selectedCategory && selectedCategory !== 'ALL') query.append('category', selectedCategory);
      if (maxPrice < 2500) query.append('maxPrice', String(maxPrice));
      if (inStockOnly) query.append('inStock', 'true');
      if (sortBy) query.append('sort', sortBy);

      const res = await fetch(`${API_BASE}/products?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders and categories
  const fetchOrdersAndCategories = async () => {
    try {
      const [ordRes, catRes] = await Promise.all([
        fetch(`${API_BASE}/orders`),
        fetch(`${API_BASE}/products/categories`),
      ]);
      if (ordRes.ok) {
        const data = await ordRes.json();
        setOrders(data.data || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.data || ['ALL']);
      }
    } catch (err) {
      console.error('Initial data error:', err);
    }
  };

  useEffect(() => {
    fetchOrdersAndCategories();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedCategory, maxPrice, inStockOnly, sortBy]);

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    if (product.stock <= 0) {
      showToast(`'${product.name}' is currently sold out!`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > product.stock) {
          showToast(`Cannot exceed available inventory (${product.stock})`, 'error');
          return prev;
        }
        showToast(`Updated cart: ${product.name} (x${newQty})`, 'success');
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      showToast(`Added '${product.name}' to cart!`, 'success');
      return [...prev, { product, quantity }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.stock) {
              showToast(`Only ${item.product.stock} units available!`, 'error');
              return item;
            }
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Step 1: Pre-Payment Stock Reservation
  const handleInitiateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    try {
      setCheckoutLoading(true);
      const res = await fetch(`${API_BASE}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerForm.name,
          customerEmail: customerForm.email,
          shippingAddress: customerForm.address,
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to reserve items', 'error');
        return;
      }

      setActiveReservation(data.data);
      setCheckoutStep('payment');
      showToast('Items reserved for 5 minutes! Complete payment.', 'success');
      fetchProducts();
      fetchOrdersAndCategories();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Step 2: Payment Execution (Success, Failure, Timeout)
  const handleExecutePayment = async () => {
    if (!activeReservation) return;

    try {
      setCheckoutLoading(true);
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
        showToast(data.error || 'Payment execution failed', 'error');
        return;
      }

      if (paymentOutcome === 'SUCCESS') {
        showToast('Payment confirmed! Your order has been placed.', 'success');
        setCart([]);
        setShowCheckoutModal(false);
        setActiveReservation(null);
        setCheckoutStep('details');
        setIsCartOpen(false);
        setIsOrderHistoryOpen(true);
      } else if (paymentOutcome === 'FAILURE') {
        showToast('Payment declined. Stock reservation released back to store.', 'error');
        setShowCheckoutModal(false);
        setActiveReservation(null);
        setCheckoutStep('details');
      } else {
        showToast('Gateway timed out. Order is kept reserved pending verification.', 'info');
        setShowCheckoutModal(false);
      }

      fetchProducts();
      fetchOrdersAndCategories();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Post-Purchase: Cancel order & simulate refund
  const handleCancelOrRefund = async (orderId: string, currentStatus: string) => {
    const isPaid = currentStatus === 'PAID';
    const msg = isPaid
      ? 'Request refund and cancellation? Your funds will be returned and inventory restored to the catalog.'
      : 'Cancel order reservation and release inventory?';

    if (!confirm(msg)) return;

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Customer requested refund via dashboard' }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        fetchProducts();
        fetchOrdersAndCategories();
      } else {
        showToast(data.error || 'Refund/cancellation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: '14px 20px',
            borderRadius: 12,
            background:
              toast.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : toast.type === 'error'
                ? 'rgba(244, 63, 94, 0.95)'
                : 'rgba(56, 189, 248, 0.95)',
            color: '#fff',
            fontWeight: 600,
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <Clock size={18} />}
          {toast.message}
        </div>
      )}

      {/* Navigation Bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(9, 13, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
          padding: '16px 28px',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981, #065f46)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              }}
            >
              <ShoppingBag size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  TECHLOOM
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  TASK 02
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                E-Commerce Storefront & Payment Engine
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
            />
            <input
              type="text"
              placeholder="Search products by title, specs, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 42 }}
            />
          </div>

          {/* Nav Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setIsOrderHistoryOpen(true)}
              className="store-btn store-btn-secondary"
            >
              <RotateCcw size={16} />
              My Orders ({orders.length})
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="store-btn store-btn-emerald"
              style={{ position: 'relative' }}
            >
              <ShoppingBag size={18} />
              Cart (LKR {cartSubtotal.toFixed(2)})
              {cart.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    background: '#f43f5e',
                    color: '#fff',
                    borderRadius: 999,
                    width: 20,
                    height: 20,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(244, 63, 94, 0.5)',
                  }}
                >
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, transparent 100%)',
          padding: '36px 28px',
        }}
      >
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', padding: '4px 12px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, marginBottom: 12 }}>
              <ShieldCheck size={14} /> ZERO-OVERSELLING PRE-RESERVATION GUARANTEE
            </div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Next-Generation Electronics & Hardware
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: 6, maxWidth: 640 }}>
              Live inventory reservation locks your stock the moment checkout starts. Complete payment with instant confirmation, timeout resilience, and one-click refund handling.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={18} color="var(--accent-emerald)" /> Free Global Shipping
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--accent-amber)" /> 5-Min Stock Lock
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={18} color="var(--accent-sky)" /> Automated Refunds
            </div>
          </div>
        </div>
      </section>

      {/* Main Layout: Filters + Product Grid */}
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '32px 28px',
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 32,
          flex: 1,
          width: '100%',
        }}
      >
        {/* Left Filter Sidebar */}
        <aside>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              position: 'sticky',
              top: 100,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <SlidersHorizontal size={18} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Filter Catalog</h3>
            </div>

            {/* Category selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, display: 'block' }}>
                CATEGORY
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: selectedCategory === cat ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: selectedCategory === cat ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      fontWeight: selectedCategory === cat ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat === 'ALL' ? 'All Products' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                  MAX PRICE
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  LKR {maxPrice.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={2500}
                step={50}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
            </div>

            {/* Availability Filter */}
            <div style={{ marginBottom: 20, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent-emerald)' }}
                />
                In Stock Only
              </label>
            </div>

            {/* Sort Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, display: 'block' }}>
                SORT BY
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="newest">Featured & Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Customer Rating</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <main>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: '#fff' }}>{products.length}</strong> matching products
            </p>
          </div>

          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No products matched your filters</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginTop: 4 }}>
                Try resetting your search query or price threshold.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setMaxPrice(2500);
                  setInStockOnly(false);
                }}
                className="store-btn store-btn-secondary"
                style={{ marginTop: 16 }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 24,
              }}
            >
              {products.map((p) => {
                const isSoldOut = p.stock <= 0;
                return (
                  <div key={p.id} className="glass-store-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Image Header */}
                    <div style={{ position: 'relative', height: 210, overflow: 'hidden', background: '#1e293b' }}>
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                        onError={(e) => {
                          (e.target as any).src =
                            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
                        }}
                      />
                      {/* Category Badge */}
                      <span
                        style={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(8px)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        {p.category}
                      </span>

                      {/* Stock Badge */}
                      <span
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: isSoldOut ? 'rgba(244, 63, 94, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                          color: '#fff',
                        }}
                      >
                        {isSoldOut ? 'SOLD OUT' : `${p.stock} IN STOCK`}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                      <div>
                        {/* Rating */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                          <Star size={14} fill="#f59e0b" color="#f59e0b" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>
                            {p.rating.toFixed(1)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(Customer verified)</span>
                        </div>

                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
                          {p.name}
                        </h4>
                        <p
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                            marginBottom: 16,
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {p.description}
                        </p>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                            LKR {p.price.toFixed(2)}
                          </span>
                          {p.reservedStock > 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)' }}>
                              ({p.reservedStock} on checkout hold)
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button
                            onClick={() => setSelectedProduct(p)}
                            className="store-btn store-btn-secondary"
                            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                          >
                            Details
                          </button>
                          <button
                            onClick={() => addToCart(p)}
                            disabled={isSoldOut}
                            className="store-btn store-btn-emerald"
                            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                          >
                            {isSoldOut ? 'Sold Out' : 'Add to Cart'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ======================= MODAL: PRODUCT DETAILS ======================= */}
      {selectedProduct && (
        <div className="store-modal-overlay">
          <div className="store-modal-body" style={{ maxWidth: 740, padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', maxHeight: '85vh', overflowY: 'auto' }}>
              {/* Product Image */}
              <div style={{ background: '#0f172a', position: 'relative' }}>
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Product Info */}
              <div style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                      {selectedProduct.category}
                    </span>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.1rem' }}
                    >
                      ✕
                    </button>
                  </div>

                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 8 }}>
                    {selectedProduct.name}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <Star size={16} fill="#f59e0b" color="#f59e0b" />
                    <span style={{ fontWeight: 700, color: '#f59e0b' }}>{selectedProduct.rating.toFixed(1)}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>| In Stock: {selectedProduct.stock}</span>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 18 }}>
                    {selectedProduct.description}
                  </p>

                  {/* Specifications Table */}
                  {selectedProduct.specs && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10, marginBottom: 20 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>
                        TECHNICAL SPECIFICATIONS
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem' }}>
                        {Object.entries(selectedProduct.specs).map(([k, v]) => (
                          <div key={k}>
                            <span style={{ color: 'var(--text-dim)', textTransform: 'capitalize' }}>{k}: </span>
                            <strong style={{ color: '#fff' }}>{v}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      LKR {selectedProduct.price.toFixed(2)}
                    </span>
                    <span
                      className={`store-badge ${
                        selectedProduct.stock > 0 ? 'badge-paid' : 'badge-failed'
                      }`}
                    >
                      {selectedProduct.stock > 0 ? `${selectedProduct.stock} In Stock` : 'Sold Out'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className="store-btn store-btn-emerald"
                    style={{ width: '100%', padding: '12px 18px', fontSize: '1rem' }}
                  >
                    <ShoppingBag size={18} />
                    {selectedProduct.stock > 0 ? 'Add to Shopping Cart' : 'Currently Unavailable'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= DRAWER: CART ======================= */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="cart-drawer">
            {/* Header */}
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShoppingBag size={20} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Your Shopping Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-dim)' }}>
                  <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: '1rem', fontWeight: 600 }}>Your cart is empty</p>
                  <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Add products from the store to proceed.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '12px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                        {item.product.name}
                      </h5>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        LKR {item.product.price.toFixed(2)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => updateCartQty(item.product.id, -1)}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer' }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.product.id, 1)}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer' }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', marginLeft: 4 }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            {cart.length > 0 && (
              <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>LKR {cartSubtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <span>Delivery & Handling</span>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>FREE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  <span>Total Due</span>
                  <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                    LKR {cartSubtotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => setShowCheckoutModal(true)}
                  className="store-btn store-btn-emerald"
                  style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                >
                  <CreditCard size={18} /> Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= MODAL: CHECKOUT & PAYMENT SIMULATOR ======================= */}
      {showCheckoutModal && (
        <div className="store-modal-overlay">
          <div className="store-modal-body" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={22} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {checkoutStep === 'details' ? 'Secure Checkout' : 'Payment Gateway Simulation'}
                </h3>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Step 1: Customer Details & Reservation */}
            {checkoutStep === 'details' && (
              <form onSubmit={handleInitiateReservation} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                    SHIPPING ADDRESS
                  </label>
                  <input
                    type="text"
                    required
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 14, borderRadius: 10 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                    ⚡ 5-Minute Stock Reservation Guard
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Clicking "Lock Items & Continue" triggers an atomic database reservation. Your items will be held exclusively for 5 minutes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="store-btn store-btn-emerald"
                  style={{ padding: '14px', fontSize: '1rem', marginTop: 8 }}
                >
                  {checkoutLoading ? 'Reserving Stock...' : 'Lock Items & Continue to Payment'}
                </button>
              </form>
            )}

            {/* Step 2: Payment Simulator */}
            {checkoutStep === 'payment' && activeReservation && (
              <div>
                {/* Active Reservation Timer Banner */}
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
                      ACTIVE STOCK RESERVATION HOLD
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                      Order #{activeReservation.orderNumber}
                    </div>
                  </div>
                  {activeReservation.expiresAt && (
                    <StoreCountdownBadge
                      expiresAt={activeReservation.expiresAt}
                      onExpire={() => {
                        showToast('Reservation expired! Stock released.', 'error');
                        setShowCheckoutModal(false);
                        fetchProducts();
                      }}
                    />
                  )}
                </div>

                {/* Amount Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Amount to Pay:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                    LKR {activeReservation.totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Simulator Outcome Selection */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10, display: 'block' }}>
                    SELECT PAYMENT GATEWAY SIMULATION SCENARIO:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setPaymentOutcome('SUCCESS')}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: `2px solid ${paymentOutcome === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--border)'}`,
                        background: paymentOutcome === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: paymentOutcome === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      <CheckCircle size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
                      Success (Paid)
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentOutcome('FAILURE')}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: `2px solid ${paymentOutcome === 'FAILURE' ? 'var(--accent-rose)' : 'var(--border)'}`,
                        background: paymentOutcome === 'FAILURE' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: paymentOutcome === 'FAILURE' ? 'var(--accent-rose)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      <AlertCircle size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
                      Failure (Decline)
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentOutcome('TIMEOUT')}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: `2px solid ${paymentOutcome === 'TIMEOUT' ? 'var(--accent-amber)' : 'var(--border)'}`,
                        background: paymentOutcome === 'TIMEOUT' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: paymentOutcome === 'TIMEOUT' ? 'var(--accent-amber)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      <Clock size={18} style={{ display: 'block', margin: '0 auto 4px' }} />
                      Gateway Timeout
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 20 }}>
                  {paymentOutcome === 'SUCCESS' && 'Order confirmed, stock deducted permanently, customer receipt recorded.'}
                  {paymentOutcome === 'FAILURE' && 'Simulates card rejection. Order marked FAILED and reserved inventory is immediately returned.'}
                  {paymentOutcome === 'TIMEOUT' && 'Simulates gateway network lag. Order remains reserved pending retry or 5-min timeout.'}
                </p>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => handleCancelOrRefund(activeReservation.id, 'RESERVED')}
                    className="store-btn store-btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel Reservation
                  </button>
                  <button
                    onClick={handleExecutePayment}
                    disabled={checkoutLoading}
                    className="store-btn store-btn-emerald"
                    style={{ flex: 1, padding: '12px' }}
                  >
                    {checkoutLoading ? 'Processing...' : 'Complete Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= MODAL: ORDER HISTORY & REFUNDS ======================= */}
      {isOrderHistoryOpen && (
        <div className="store-modal-overlay">
          <div className="store-modal-body" style={{ maxWidth: 880, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RotateCcw size={22} color="var(--accent-sky)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Order History & Refunds</h3>
              </div>
              <button
                onClick={() => setIsOrderHistoryOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                No past orders found for this session.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {orders.map((ord) => {
                  const isPaid = ord.status === 'PAID';
                  const isReserved = ord.status === 'RESERVED';
                  return (
                    <div
                      key={ord.id}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: 18,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#fff' }}>
                              {ord.orderNumber}
                            </span>
                            <span
                              className={`store-badge ${
                                ord.status === 'PAID'
                                  ? 'badge-paid'
                                  : ord.status === 'RESERVED'
                                  ? 'badge-reserved'
                                  : ord.status === 'REFUNDED'
                                  ? 'badge-refunded'
                                  : ord.status === 'CANCELLED'
                                  ? 'badge-cancelled'
                                  : 'badge-failed'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            Placed {new Date(ord.createdAt).toLocaleString()} | Customer: {ord.customerName}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                            LKR {ord.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                        {ord.items?.map((item) => (
                          <div
                            key={item.id}
                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '3px 0' }}
                          >
                            <span>
                              {item.quantity}x {item.product?.name || 'Product'}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              LKR {(item.unitPrice * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Post-Purchase Actions */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        {isPaid && (
                          <button
                            onClick={() => handleCancelOrRefund(ord.id, ord.status)}
                            className="store-btn store-btn-danger"
                            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                          >
                            <RotateCcw size={14} /> Request Cancellation & Refund
                          </button>
                        )}
                        {isReserved && (
                          <button
                            onClick={() => handleCancelOrRefund(ord.id, ord.status)}
                            className="store-btn store-btn-danger"
                            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                          >
                            Cancel Reservation
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 5-minute countdown badge
function StoreCountdownBadge({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
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
        gap: 5,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        fontWeight: 800,
        color: secondsLeft < 60 ? 'var(--accent-rose)' : 'var(--accent-amber)',
        background: 'rgba(0,0,0,0.4)',
        padding: '4px 10px',
        borderRadius: 8,
      }}
    >
      <Clock size={14} /> {formatted}
    </span>
  );
}
