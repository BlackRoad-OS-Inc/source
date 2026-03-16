// RoadPay — BlackRoad's Own Payment & Billing System
// pay.blackroad.io
// v1.0.0
//
// Own your customers, subscriptions, invoices, and payments.
// Stripe is just a dumb card charger underneath.

const VERSION = '2.0.0';

// ─── Schema ──────────────────────────────────────────────────────────────
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    stripe_customer_id TEXT,
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    interval TEXT DEFAULT 'month',
    interval_count INTEGER DEFAULT 1,
    features TEXT DEFAULT '[]',
    stripe_price_id TEXT,
    tier INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS addons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    interval TEXT DEFAULT 'month',
    stripe_price_id TEXT,
    active INTEGER DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    plan_id TEXT NOT NULL REFERENCES plans(id),
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'active',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at TEXT,
    canceled_at TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_addons (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
    addon_id TEXT NOT NULL REFERENCES addons(id),
    stripe_subscription_item_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    subscription_id TEXT REFERENCES subscriptions(id),
    stripe_invoice_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'draft',
    description TEXT,
    line_items TEXT DEFAULT '[]',
    due_date TEXT,
    paid_at TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    invoice_id TEXT REFERENCES invoices(id),
    stripe_payment_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    method TEXT DEFAULT 'card',
    status TEXT DEFAULT 'pending',
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    customer_id TEXT,
    entity_type TEXT,
    entity_id TEXT,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_stripe ON customers(stripe_customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`,
  `CREATE INDEX IF NOT EXISTS idx_events_customer ON events(customer_id)`,
  // v2: API keys for customers
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    name TEXT DEFAULT 'default',
    scopes TEXT DEFAULT '["api:read"]',
    rate_limit INTEGER DEFAULT 1000,
    last_used TEXT,
    usage_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // v2: Usage metering
  `CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    api_key_id TEXT REFERENCES api_keys(id),
    endpoint TEXT NOT NULL,
    method TEXT DEFAULT 'GET',
    status_code INTEGER,
    latency_ms INTEGER,
    tokens_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_customer ON usage(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_date ON usage(created_at)`,
];

// ─── Seed Plans ──────────────────────────────────────────────────────────
const SEED_PLANS = [
  {
    id: 'plan_operator',
    name: 'Operator',
    slug: 'operator',
    description: 'Free forever. 1 agent, community access, basic tools.',
    amount: 0,
    interval: 'month',
    tier: 0,
    features: JSON.stringify([
      '1 AI agent',
      'Community support',
      'Basic RoadSearch',
      'Public dashboard',
    ]),
    stripe_price_id: 'price_1TAjzB3e5FMFdlFwJrJaGhtK',
  },
  {
    id: 'plan_rider',
    name: 'Rider',
    slug: 'rider',
    description: 'For builders. 5 agents, priority support, full API access.',
    amount: 2900,
    interval: 'month',
    tier: 1,
    features: JSON.stringify([
      '5 AI agents',
      'Priority support',
      'Full API access',
      'RoadSearch Pro',
      'Custom dashboards',
      'Webhook integrations',
    ]),
    stripe_price_id: 'price_1TAjzC3e5FMFdlFwPFUMCzSI',
  },
  {
    id: 'plan_paver',
    name: 'Paver',
    slug: 'paver',
    description: 'For teams. 25 agents, dedicated support, fleet management.',
    amount: 9900,
    interval: 'month',
    tier: 2,
    features: JSON.stringify([
      '25 AI agents',
      'Dedicated support',
      'Fleet management',
      'Team workspaces',
      'Advanced analytics',
      'Priority inference',
      'Custom models',
    ]),
    stripe_price_id: 'price_1TAjzD3e5FMFdlFwVNBkEJcU',
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Unlimited. Tailored to your organization.',
    amount: 0,
    interval: 'month',
    tier: 3,
    features: JSON.stringify([
      'Unlimited agents',
      'Dedicated infrastructure',
      'Custom SLAs',
      'White-label option',
      'Private deployment',
      'Direct engineering support',
      'Custom integrations',
    ]),
    stripe_price_id: null,
  },
];

const SEED_ADDONS = [
  {
    id: 'addon_lucidia',
    name: 'Lucidia Enhanced',
    slug: 'lucidia-enhanced',
    description: 'Advanced AI companion with memory, personality, and learning.',
    amount: 999,
    interval: 'month',
    stripe_price_id: 'price_1TAk3e3e5FMFdlFwGi46sMNf',
  },
  {
    id: 'addon_roadauth',
    name: 'RoadAuth',
    slug: 'roadauth',
    description: 'Decentralized identity and auth for your apps.',
    amount: 499,
    interval: 'month',
    stripe_price_id: 'price_1TAk3f3e5FMFdlFwfYwLHZVk',
  },
  {
    id: 'addon_context_bridge',
    name: 'Context Bridge',
    slug: 'context-bridge',
    description: 'Cross-agent memory sharing and context persistence.',
    amount: 799,
    interval: 'month',
    stripe_price_id: 'price_1TAk3g3e5FMFdlFwNkgWv2tU',
  },
  {
    id: 'addon_knowledge_hub',
    name: 'Knowledge Hub',
    slug: 'knowledge-hub',
    description: 'RAG pipeline with vector search across your data.',
    amount: 1499,
    interval: 'month',
    stripe_price_id: 'price_1TAk3i3e5FMFdlFwlGXxMWFJ',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

function err(message, status = 400) {
  return Response.json({ error: message }, { status });
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RoadPay-Key',
    'Access-Control-Max-Age': '86400',
  };
}

async function logEvent(db, type, customerId, entityType, entityId, data = {}) {
  await db.prepare(
    'INSERT INTO events (id, type, customer_id, entity_type, entity_id, data) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(`evt_${uid()}`, type, customerId, entityType, entityId, JSON.stringify(data)).run();
}

async function stripeRequest(env, method, path, body = null) {
  if (!env.STRIPE_SECRET_KEY) return null;
  const url = `https://api.stripe.com/v1${path}`;
  const headers = {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const options = { method, headers };
  if (body) options.body = new URLSearchParams(body).toString();
  const res = await fetch(url, options);
  return res.json();
}

// ─── Auth middleware ─────────────────────────────────────────────────────
async function authenticate(request, env) {
  // Admin key for server-to-server
  const apiKey = request.headers.get('X-RoadPay-Key');
  if (apiKey && env.ROADPAY_ADMIN_KEY && apiKey === env.ROADPAY_ADMIN_KEY) {
    return { role: 'admin', email: 'admin' };
  }

  // Bearer token — verify with auth.blackroad.io
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const res = await fetch(`${env.AUTH_API || 'https://auth.blackroad.io'}/api/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        return { role: 'user', email: user.email, userId: user.id };
      }
    } catch {}
  }

  return null;
}

// ─── Init ────────────────────────────────────────────────────────────────
async function handleInit(db) {
  for (const sql of SCHEMA) {
    await db.prepare(sql).run();
  }

  // Seed plans
  for (const plan of SEED_PLANS) {
    await db.prepare(
      `INSERT OR IGNORE INTO plans (id, name, slug, description, amount, interval, tier, features, stripe_price_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(plan.id, plan.name, plan.slug, plan.description, plan.amount, plan.interval, plan.tier, plan.features, plan.stripe_price_id).run();
  }

  // Seed addons
  for (const addon of SEED_ADDONS) {
    await db.prepare(
      `INSERT OR IGNORE INTO addons (id, name, slug, description, amount, interval, stripe_price_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(addon.id, addon.name, addon.slug, addon.description, addon.amount, addon.interval, addon.stripe_price_id).run();
  }

  return json({ ok: true, tables: SCHEMA.length, plans: SEED_PLANS.length, addons: SEED_ADDONS.length });
}

// ─── Customers ───────────────────────────────────────────────────────────
async function handleCustomers(request, db, env) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const email = url.searchParams.get('email');
    const id = url.searchParams.get('id');

    if (id) {
      const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
      if (!customer) return err('Customer not found', 404);
      // Get their subscriptions
      const subs = await db.prepare(
        `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.amount as plan_amount
         FROM subscriptions s JOIN plans p ON s.plan_id = p.id
         WHERE s.customer_id = ? ORDER BY s.created_at DESC`
      ).bind(id).all();
      return json({ customer, subscriptions: subs.results });
    }

    if (email) {
      const customer = await db.prepare('SELECT * FROM customers WHERE email = ?').bind(email).first();
      if (!customer) return err('Customer not found', 404);
      return json({ customer });
    }

    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const customers = await db.prepare(
      'SELECT * FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
    const count = await db.prepare('SELECT COUNT(*) as total FROM customers').first();
    return json({ customers: customers.results, total: count.total });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const { email, name, metadata } = body;
    if (!email) return err('email is required');

    // Check existing
    const existing = await db.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first();
    if (existing) return err('Customer already exists', 409);

    const id = `cus_${uid()}`;

    // Create Stripe customer if key exists
    let stripeId = null;
    if (env.STRIPE_SECRET_KEY) {
      const stripeCustomer = await stripeRequest(env, 'POST', '/customers', {
        email,
        name: name || '',
        'metadata[roadpay_id]': id,
        'metadata[source]': 'roadpay',
      });
      stripeId = stripeCustomer?.id;
    }

    await db.prepare(
      'INSERT INTO customers (id, email, name, stripe_customer_id, metadata) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email, name || null, stripeId, JSON.stringify(metadata || {})).run();

    await logEvent(db, 'customer.created', id, 'customer', id, { email });

    return json({ id, email, name, stripe_customer_id: stripeId }, 201);
  }

  return err('Method not allowed', 405);
}

// ─── Plans ───────────────────────────────────────────────────────────────
async function handlePlans(db) {
  const plans = await db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY tier ASC').all();
  return json({
    plans: plans.results.map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
      metadata: JSON.parse(p.metadata || '{}'),
    })),
  });
}

// ─── Addons ──────────────────────────────────────────────────────────────
async function handleAddons(db) {
  const addons = await db.prepare('SELECT * FROM addons WHERE active = 1 ORDER BY amount ASC').all();
  return json({
    addons: addons.results.map(a => ({
      ...a,
      metadata: JSON.parse(a.metadata || '{}'),
    })),
  });
}

// ─── Subscribe ───────────────────────────────────────────────────────────
async function handleSubscribe(request, db, env) {
  const body = await request.json();
  const { customer_id, plan_slug, addon_slugs = [], success_url, cancel_url } = body;

  if (!customer_id || !plan_slug) return err('customer_id and plan_slug are required');

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(customer_id).first();
  if (!customer) return err('Customer not found', 404);

  const plan = await db.prepare('SELECT * FROM plans WHERE slug = ?').bind(plan_slug).first();
  if (!plan) return err('Plan not found', 404);

  // Check existing active subscription
  const existing = await db.prepare(
    "SELECT id FROM subscriptions WHERE customer_id = ? AND status = 'active'"
  ).bind(customer_id).first();
  if (existing) return err('Customer already has an active subscription. Cancel first or upgrade.', 409);

  // Free plan — no payment needed
  if (plan.amount === 0 && !plan.stripe_price_id) {
    const subId = `sub_${uid()}`;
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(
      `INSERT INTO subscriptions (id, customer_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'active', ?, ?)`
    ).bind(subId, customer_id, plan.id, now, periodEnd).run();

    // Create invoice at $0
    await db.prepare(
      `INSERT INTO invoices (id, customer_id, subscription_id, amount, status, description, paid_at)
       VALUES (?, ?, ?, 0, 'paid', ?, ?)`
    ).bind(`inv_${uid()}`, customer_id, subId, `${plan.name} — Free`, now).run();

    await logEvent(db, 'subscription.created', customer_id, 'subscription', subId, { plan: plan.slug });

    return json({ subscription_id: subId, plan: plan.slug, status: 'active' });
  }

  // Paid plan — create Stripe checkout
  if (!env.STRIPE_SECRET_KEY) {
    return err('Payment processing not configured', 503);
  }

  // Build line items
  const lineItems = {};
  lineItems['line_items[0][price]'] = plan.stripe_price_id;
  lineItems['line_items[0][quantity]'] = '1';

  // Add addon line items
  if (addon_slugs.length > 0) {
    const addons = await db.prepare(
      `SELECT * FROM addons WHERE slug IN (${addon_slugs.map(() => '?').join(',')}) AND active = 1`
    ).bind(...addon_slugs).all();

    addons.results.forEach((addon, i) => {
      lineItems[`line_items[${i + 1}][price]`] = addon.stripe_price_id;
      lineItems[`line_items[${i + 1}][quantity]`] = '1';
    });
  }

  const origin = new URL(request.url).origin;
  const subId = `sub_${uid()}`;

  const session = await stripeRequest(env, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    ...lineItems,
    customer: customer.stripe_customer_id || undefined,
    customer_email: !customer.stripe_customer_id ? customer.email : undefined,
    success_url: success_url || `${origin}/success?session_id={CHECKOUT_SESSION_ID}&sub=${subId}`,
    cancel_url: cancel_url || `${origin}/pricing`,
    'subscription_data[metadata][roadpay_sub_id]': subId,
    'subscription_data[metadata][roadpay_customer_id]': customer_id,
    'subscription_data[metadata][plan]': plan.slug,
    'automatic_tax[enabled]': 'true',
  });

  if (session.error) {
    return err(session.error.message, 500);
  }

  // Create pending subscription
  await db.prepare(
    `INSERT INTO subscriptions (id, customer_id, plan_id, status, metadata)
     VALUES (?, ?, ?, 'pending', ?)`
  ).bind(subId, customer_id, plan.id, JSON.stringify({ stripe_checkout_session: session.id })).run();

  await logEvent(db, 'checkout.started', customer_id, 'subscription', subId, { plan: plan.slug });

  return json({ checkout_url: session.url, subscription_id: subId, session_id: session.id });
}

// ─── Manage Subscription ─────────────────────────────────────────────────
async function handleSubscription(request, db, env) {
  const url = new URL(request.url);
  const subId = url.pathname.split('/').pop();

  if (request.method === 'GET') {
    const sub = await db.prepare(
      `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.amount as plan_amount, p.features
       FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.id = ?`
    ).bind(subId).first();
    if (!sub) return err('Subscription not found', 404);

    // Get addons
    const addons = await db.prepare(
      `SELECT sa.*, a.name as addon_name, a.slug as addon_slug, a.amount as addon_amount
       FROM subscription_addons sa JOIN addons a ON sa.addon_id = a.id
       WHERE sa.subscription_id = ? AND sa.status = 'active'`
    ).bind(subId).all();

    return json({
      subscription: {
        ...sub,
        features: JSON.parse(sub.features || '[]'),
        metadata: JSON.parse(sub.metadata || '{}'),
      },
      addons: addons.results,
    });
  }

  if (request.method === 'DELETE') {
    const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(subId).first();
    if (!sub) return err('Subscription not found', 404);

    // Cancel in Stripe
    if (sub.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
      await stripeRequest(env, 'DELETE', `/subscriptions/${sub.stripe_subscription_id}`);
    }

    const now = new Date().toISOString();
    await db.prepare(
      "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ?"
    ).bind(now, now, subId).run();

    await logEvent(db, 'subscription.canceled', sub.customer_id, 'subscription', subId);

    return json({ ok: true, status: 'canceled' });
  }

  return err('Method not allowed', 405);
}

// ─── Invoices ────────────────────────────────────────────────────────────
async function handleInvoices(request, db) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');

  if (!customerId) return err('customer_id is required');

  const invoices = await db.prepare(
    'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(customerId).all();

  return json({
    invoices: invoices.results.map(inv => ({
      ...inv,
      line_items: JSON.parse(inv.line_items || '[]'),
      metadata: JSON.parse(inv.metadata || '{}'),
    })),
  });
}

// ─── Payments ────────────────────────────────────────────────────────────
async function handlePayments(request, db) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');

  if (!customerId) return err('customer_id is required');

  const payments = await db.prepare(
    'SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(customerId).all();

  return json({ payments: payments.results });
}

// ─── Billing Portal (own) ────────────────────────────────────────────────
async function handlePortal(request, db) {
  const { customer_id } = await request.json();
  if (!customer_id) return err('customer_id is required');

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(customer_id).first();
  if (!customer) return err('Customer not found', 404);

  const subs = await db.prepare(
    `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.amount as plan_amount, p.features
     FROM subscriptions s JOIN plans p ON s.plan_id = p.id
     WHERE s.customer_id = ? ORDER BY s.created_at DESC`
  ).bind(customer_id).all();

  const invoices = await db.prepare(
    'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(customer_id).all();

  const payments = await db.prepare(
    'SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(customer_id).all();

  return json({
    customer: { ...customer, metadata: JSON.parse(customer.metadata || '{}') },
    subscriptions: subs.results.map(s => ({
      ...s,
      features: JSON.parse(s.features || '[]'),
      metadata: JSON.parse(s.metadata || '{}'),
    })),
    invoices: invoices.results.map(i => ({
      ...i,
      line_items: JSON.parse(i.line_items || '[]'),
    })),
    payments: payments.results,
  });
}

// ─── Webhook (Stripe → RoadPay sync) ────────────────────────────────────
async function handleWebhook(request, db, env) {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (env.STRIPE_WEBHOOK_SECRET && signature) {
    try {
      await verifySignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return err(`Webhook verification failed: ${e.message}`, 400);
    }
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return err('Invalid JSON', 400);
  }

  const now = new Date().toISOString();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const subId = session.metadata?.roadpay_sub_id;
      const customerId = session.metadata?.roadpay_customer_id;

      if (subId) {
        await db.prepare(
          `UPDATE subscriptions SET status = 'active', stripe_subscription_id = ?,
           current_period_start = ?, updated_at = ? WHERE id = ?`
        ).bind(session.subscription, now, now, subId).run();
      }

      // Update customer's Stripe ID if we didn't have it
      if (customerId && session.customer) {
        await db.prepare(
          'UPDATE customers SET stripe_customer_id = ?, updated_at = ? WHERE id = ? AND stripe_customer_id IS NULL'
        ).bind(session.customer, now, customerId).run();
      }

      await logEvent(db, 'checkout.completed', customerId, 'subscription', subId, {
        stripe_session: session.id,
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const stripeSubId = invoice.subscription;

      // Find our subscription
      const sub = await db.prepare(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?'
      ).bind(stripeSubId).first();

      if (sub) {
        // Create invoice record
        await db.prepare(
          `INSERT INTO invoices (id, customer_id, subscription_id, stripe_invoice_id, amount, status, description, paid_at)
           VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`
        ).bind(
          `inv_${uid()}`, sub.customer_id, sub.id, invoice.id,
          invoice.amount_paid, `Payment for ${invoice.lines?.data?.[0]?.description || 'subscription'}`, now
        ).run();

        // Create payment record
        await db.prepare(
          `INSERT INTO payments (id, customer_id, invoice_id, stripe_payment_id, amount, status)
           VALUES (?, ?, ?, ?, ?, 'succeeded')`
        ).bind(`pay_${uid()}`, sub.customer_id, invoice.id, invoice.payment_intent, invoice.amount_paid).run();

        // Update subscription period
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        if (periodEnd) {
          await db.prepare(
            'UPDATE subscriptions SET current_period_end = ?, updated_at = ? WHERE id = ?'
          ).bind(new Date(periodEnd * 1000).toISOString(), now, sub.id).run();
        }

        await logEvent(db, 'payment.succeeded', sub.customer_id, 'payment', invoice.payment_intent, {
          amount: invoice.amount_paid,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const sub = await db.prepare(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?'
      ).bind(invoice.subscription).first();

      if (sub) {
        await db.prepare(
          "UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE id = ?"
        ).bind(now, sub.id).run();

        await logEvent(db, 'payment.failed', sub.customer_id, 'subscription', sub.id, {
          amount: invoice.amount_due,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object;
      const sub = await db.prepare(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?'
      ).bind(stripeSub.id).first();

      if (sub) {
        await db.prepare(
          "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ?"
        ).bind(now, now, sub.id).run();

        await logEvent(db, 'subscription.canceled', sub.customer_id, 'subscription', sub.id);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const stripeSub = event.data.object;
      const sub = await db.prepare(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?'
      ).bind(stripeSub.id).first();

      if (sub) {
        await db.prepare(
          'UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?'
        ).bind(stripeSub.status, now, sub.id).run();
      }
      break;
    }

    default:
      console.log(`Unhandled webhook: ${event.type}`);
  }

  return json({ received: true });
}

async function verifySignature(payload, sigHeader, secret) {
  if (!sigHeader) throw new Error('Missing signature');
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts.t;
  const sigs = Object.entries(parts).filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || !sigs.length) throw new Error('Invalid signature format');

  const tolerance = 300;
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp)) > tolerance) {
    throw new Error('Timestamp outside tolerance');
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (!sigs.includes(computed)) throw new Error('Signature mismatch');
}

// ─── Stats / Dashboard ──────────────────────────────────────────────────
async function handleStats(db) {
  const customers = await db.prepare('SELECT COUNT(*) as total FROM customers').first();
  const activeSubs = await db.prepare("SELECT COUNT(*) as total FROM subscriptions WHERE status = 'active'").first();
  const totalRevenue = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'succeeded'").first();
  const invoicesPaid = await db.prepare("SELECT COUNT(*) as total FROM invoices WHERE status = 'paid'").first();
  const recentEvents = await db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 20').all();

  // MRR calculation
  const mrr = await db.prepare(
    `SELECT COALESCE(SUM(p.amount), 0) as mrr
     FROM subscriptions s JOIN plans p ON s.plan_id = p.id
     WHERE s.status = 'active'`
  ).first();

  // Plan breakdown
  const planBreakdown = await db.prepare(
    `SELECT p.name, p.slug, COUNT(s.id) as subscribers, p.amount
     FROM plans p LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
     GROUP BY p.id ORDER BY p.tier ASC`
  ).all();

  return json({
    stats: {
      customers: customers.total,
      active_subscriptions: activeSubs.total,
      total_revenue_cents: totalRevenue.total,
      total_revenue: `$${(totalRevenue.total / 100).toFixed(2)}`,
      mrr_cents: mrr.mrr,
      mrr: `$${(mrr.mrr / 100).toFixed(2)}`,
      invoices_paid: invoicesPaid.total,
    },
    plan_breakdown: planBreakdown.results,
    recent_events: recentEvents.results.map(e => ({
      ...e,
      data: JSON.parse(e.data || '{}'),
    })),
  });
}

// ─── Lookup (by email — public-ish) ──────────────────────────────────────
async function handleLookup(request, db) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  if (!email) return err('email is required');

  const customer = await db.prepare('SELECT id, email, name, status, created_at FROM customers WHERE email = ?').bind(email).first();
  if (!customer) return json({ found: false });

  const sub = await db.prepare(
    `SELECT s.id, s.status, s.current_period_end, p.name as plan_name, p.slug as plan_slug, p.tier
     FROM subscriptions s JOIN plans p ON s.plan_id = p.id
     WHERE s.customer_id = ? AND s.status = 'active'
     ORDER BY s.created_at DESC LIMIT 1`
  ).bind(customer.id).first();

  return json({
    found: true,
    customer_id: customer.id,
    email: customer.email,
    name: customer.name,
    plan: sub ? { name: sub.plan_name, slug: sub.plan_slug, tier: sub.tier, status: sub.status, period_end: sub.current_period_end } : null,
  });
}

// ─── Upgrade / Downgrade ─────────────────────────────────────────────────
async function handleUpgrade(request, db, env) {
  const { customer_id, new_plan_slug } = await request.json();
  if (!customer_id || !new_plan_slug) return err('customer_id and new_plan_slug required');

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(customer_id).first();
  if (!customer) return err('Customer not found', 404);

  const newPlan = await db.prepare('SELECT * FROM plans WHERE slug = ?').bind(new_plan_slug).first();
  if (!newPlan) return err('Plan not found', 404);

  const currentSub = await db.prepare(
    "SELECT * FROM subscriptions WHERE customer_id = ? AND status = 'active'"
  ).bind(customer_id).first();

  if (!currentSub) return err('No active subscription to upgrade', 404);

  const now = new Date().toISOString();

  // If upgrading to enterprise/free (contact only) or downgrading to free
  if (!newPlan.stripe_price_id || newPlan.amount === 0) {
    // Cancel stripe sub
    if (currentSub.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
      await stripeRequest(env, 'DELETE', `/subscriptions/${currentSub.stripe_subscription_id}`);
    }
    await db.prepare(
      "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ?"
    ).bind(now, now, currentSub.id).run();

    // Create new free sub
    const newSubId = `sub_${uid()}`;
    await db.prepare(
      `INSERT INTO subscriptions (id, customer_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'active', ?, ?)`
    ).bind(newSubId, customer_id, newPlan.id, now, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()).run();

    await logEvent(db, 'subscription.changed', customer_id, 'subscription', newSubId, {
      from: currentSub.plan_id, to: newPlan.id,
    });

    return json({ subscription_id: newSubId, plan: newPlan.slug, status: 'active' });
  }

  // Stripe subscription update (proration)
  if (currentSub.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
    // Get current subscription items
    const stripeSub = await stripeRequest(env, 'GET', `/subscriptions/${currentSub.stripe_subscription_id}`);
    if (stripeSub?.items?.data?.[0]) {
      await stripeRequest(env, 'POST', `/subscriptions/${currentSub.stripe_subscription_id}`, {
        'items[0][id]': stripeSub.items.data[0].id,
        'items[0][price]': newPlan.stripe_price_id,
        proration_behavior: 'create_prorations',
      });
    }

    await db.prepare(
      'UPDATE subscriptions SET plan_id = ?, updated_at = ? WHERE id = ?'
    ).bind(newPlan.id, now, currentSub.id).run();

    await logEvent(db, 'subscription.upgraded', customer_id, 'subscription', currentSub.id, {
      from: currentSub.plan_id, to: newPlan.id,
    });

    return json({ subscription_id: currentSub.id, plan: newPlan.slug, status: 'active', prorated: true });
  }

  return err('Cannot upgrade — no active Stripe subscription', 400);
}

// ─── Health ──────────────────────────────────────────────────────────────
function handleHealth() {
  return json({
    status: 'ok',
    service: 'roadpay',
    version: VERSION,
    time: new Date().toISOString(),
    endpoints: [
      'GET  /health',
      'GET  /init',
      'GET  /plans',
      'GET  /addons',
      'GET  /stats',
      'GET  /lookup?email=',
      'GET  /customers?email=|id=',
      'POST /customers',
      'POST /subscribe',
      'GET  /subscriptions/:id',
      'DELETE /subscriptions/:id',
      'POST /upgrade',
      'POST /portal',
      'GET  /invoices?customer_id=',
      'GET  /payments?customer_id=',
      'POST /webhook',
      'GET  /keys?customer_id=',
      'POST /keys',
      'DELETE /keys?id=',
      'GET  /usage?customer_id=&days=30',
      'POST /usage/record',
    ],
  });
}

// ─── API Keys ───────────────────────────────────────────────────────────
async function handleApiKeys(request, db) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const customerId = url.searchParams.get('customer_id');
    if (!customerId) return err('customer_id required');
    const keys = await db.prepare(
      "SELECT id, customer_id, key_prefix, name, scopes, rate_limit, last_used, usage_count, status, expires_at, created_at FROM api_keys WHERE customer_id = ? ORDER BY created_at DESC"
    ).bind(customerId).all();
    return json({ keys: keys.results.map(k => ({ ...k, scopes: JSON.parse(k.scopes || '[]') })) });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const { customer_id, name, scopes, rate_limit, expires_in_days } = body;
    if (!customer_id) return err('customer_id required');

    // Generate API key: rp_live_ + 32 random hex chars
    const rawKey = `rp_live_${randHex(16)}`;
    const keyPrefix = rawKey.slice(0, 12);
    // Hash the key for storage (don't store raw)
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(rawKey));
    const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const id = `key_${uid()}`;
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null;

    await db.prepare(
      'INSERT INTO api_keys (id, customer_id, key_hash, key_prefix, name, scopes, rate_limit, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, customer_id, keyHash, keyPrefix, name || 'default', JSON.stringify(scopes || ['api:read']), rate_limit || 1000, expiresAt).run();

    // Return the raw key ONLY on creation — can never be retrieved again
    return json({ id, key: rawKey, prefix: keyPrefix, name: name || 'default', warning: 'Save this key now. It cannot be retrieved again.' }, 201);
  }

  if (request.method === 'DELETE') {
    const keyId = url.searchParams.get('id');
    if (!keyId) return err('id required');
    await db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?").bind(keyId).run();
    return json({ ok: true, revoked: keyId });
  }

  return err('Method not allowed', 405);
}

// ─── Usage / Metering ────────────────────────────────────────────────────
async function handleUsage(request, db) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');
  if (!customerId) return err('customer_id required');

  const days = parseInt(url.searchParams.get('days') || '30');
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Daily breakdown
  const daily = await db.prepare(
    `SELECT date(created_at) as day, COUNT(*) as requests, SUM(tokens_used) as tokens,
     AVG(latency_ms) as avg_latency, SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
     FROM usage WHERE customer_id = ? AND created_at >= ? GROUP BY day ORDER BY day DESC`
  ).bind(customerId, since).all();

  // Totals
  const totals = await db.prepare(
    `SELECT COUNT(*) as total_requests, SUM(tokens_used) as total_tokens,
     AVG(latency_ms) as avg_latency, COUNT(DISTINCT endpoint) as unique_endpoints
     FROM usage WHERE customer_id = ? AND created_at >= ?`
  ).bind(customerId, since).first();

  // Top endpoints
  const endpoints = await db.prepare(
    `SELECT endpoint, method, COUNT(*) as count, AVG(latency_ms) as avg_latency
     FROM usage WHERE customer_id = ? AND created_at >= ?
     GROUP BY endpoint, method ORDER BY count DESC LIMIT 10`
  ).bind(customerId, since).all();

  return json({
    customer_id: customerId,
    period: { days, since },
    totals,
    daily: daily.results,
    top_endpoints: endpoints.results,
  });
}

// ─── Record Usage (internal — called by API gateway) ─────────────────────
async function handleRecordUsage(request, db) {
  const body = await request.json();
  const { customer_id, api_key_id, endpoint, method, status_code, latency_ms, tokens_used } = body;
  if (!customer_id || !endpoint) return err('customer_id and endpoint required');

  await db.prepare(
    'INSERT INTO usage (customer_id, api_key_id, endpoint, method, status_code, latency_ms, tokens_used) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(customer_id, api_key_id || null, endpoint, method || 'GET', status_code || 200, latency_ms || 0, tokens_used || 0).run();

  // Update API key usage count
  if (api_key_id) {
    await db.prepare(
      "UPDATE api_keys SET usage_count = usage_count + 1, last_used = datetime('now') WHERE id = ?"
    ).bind(api_key_id).run();
  }

  return json({ ok: true });
}

function randHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Rate limiting ───────────────────────────────────────────────────────
const rl = new Map();
function rateLimit(ip, max = 30, windowSec = 60) {
  const now = Date.now();
  const entry = rl.get(ip);
  if (!entry || now - entry.t > windowSec * 1000) { rl.set(ip, { t: now, c: 1 }); return true; }
  return ++entry.c <= max;
}

// ─── Router ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, ...SECURITY_HEADERS } });
    }

    // Rate limit all requests
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!rateLimit(clientIp)) {
      return addHeaders(err('Too many requests — slow down', 429), cors);
    }

    const db = env.DB;
    let response;

    try {
      const path = url.pathname;

      // Public endpoints (no auth)
      if (path === '/health') return addHeaders(handleHealth(), cors);
      if (path === '/init') return addHeaders(await handleInit(db), cors);
      if (path === '/plans') return addHeaders(await handlePlans(db), cors);
      if (path === '/addons') return addHeaders(await handleAddons(db), cors);
      if (path === '/webhook' && request.method === 'POST') return addHeaders(await handleWebhook(request, db, env), cors);
      if (path === '/lookup') return addHeaders(await handleLookup(request, db), cors);

      // Authenticated endpoints
      const user = await authenticate(request, env);
      if (!user) {
        return addHeaders(err('Unauthorized — provide Bearer token or X-RoadPay-Key', 401), cors);
      }

      switch (true) {
        case path === '/customers':
          response = await handleCustomers(request, db, env);
          break;
        case path === '/subscribe' && request.method === 'POST':
          response = await handleSubscribe(request, db, env);
          break;
        case path.startsWith('/subscriptions/'):
          response = await handleSubscription(request, db, env);
          break;
        case path === '/upgrade' && request.method === 'POST':
          response = await handleUpgrade(request, db, env);
          break;
        case path === '/portal' && request.method === 'POST':
          response = await handlePortal(request, db);
          break;
        case path === '/invoices':
          response = await handleInvoices(request, db);
          break;
        case path === '/payments':
          response = await handlePayments(request, db);
          break;
        case path === '/stats':
          response = await handleStats(db);
          break;
        case path === '/keys' || path === '/api-keys':
          response = await handleApiKeys(request, db);
          break;
        case path === '/usage':
          response = await handleUsage(request, db);
          break;
        case path === '/usage/record' && request.method === 'POST':
          response = await handleRecordUsage(request, db);
          break;
        default:
          response = err('Not found', 404);
      }
    } catch (e) {
      console.error('RoadPay error:', e);
      response = err(e.message, 500);
    }

    return addHeaders(response, cors);
  },
};

function addHeaders(response, cors) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries({ ...cors, ...SECURITY_HEADERS })) {
    headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers });
}
