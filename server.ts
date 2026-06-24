import 'dotenv/config';
import express from "express";
console.log("[Server] Script execution started...");
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
// 
// 
// 

import pg from 'pg';
const { Pool } = pg;

import bcrypt from 'bcryptjs';
const SALT_ROUNDS = 10;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = "deck_serrinha.db";

// ─── Supabase Connection ──────────────────────────────────────────────────────
let pgPool: any = null;

function createPool() {
  const url = process.env.SUPABASE_DB_URL || "";
  
  if (!url) {
    console.error("SUPABASE_DB_URL is not set in environment.");
  }
  return new Pool({
    connectionString: url,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    },
    family: 4
  });
}

function getPgPool() {
  if (!pgPool) {
    try {
      pgPool = createPool();
    } catch (e) {
      console.error('[Supabase] Failed to initialize Pool:', e);
      return null;
    }
  }
  return pgPool;
}

function resetPool() {
  if (pgPool) {
    pgPool.end().catch(() => {});
    pgPool = null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Helper for Supabase tables initialization
async function initSupabase() {
  const pool = getPgPool();
  if (!pool) {
    console.warn("[Supabase] Supabase sync will be disabled (no valid URL).");
    return;
  }
  let client;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT,
        password TEXT,
        role TEXT,
        avatar TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        type TEXT,
        category TEXT,
        active INTEGER DEFAULT 1,
        print_enabled INTEGER DEFAULT 0,
        created_at TEXT,
        is_stockable INTEGER DEFAULT 0,
        is_solid INTEGER DEFAULT 0,
        current_stock REAL DEFAULT 0,
        is_event_item INTEGER DEFAULT 0
      );

      -- Migration block for Postgres schema updates
      DO $$
      BEGIN
        -- USERS
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
          ALTER TABLE users ADD COLUMN email TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar') THEN
          ALTER TABLE users ADD COLUMN avatar TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at') THEN
          ALTER TABLE users ADD COLUMN created_at TEXT;
        END IF;

        -- MENU_ITEMS
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='active') THEN
          ALTER TABLE menu_items ADD COLUMN active INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='print_enabled') THEN
          ALTER TABLE menu_items ADD COLUMN print_enabled INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_stockable') THEN
          ALTER TABLE menu_items ADD COLUMN is_stockable INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_solid') THEN
          ALTER TABLE menu_items ADD COLUMN is_solid INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='current_stock') THEN
          ALTER TABLE menu_items ADD COLUMN current_stock REAL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_event_item') THEN
          ALTER TABLE menu_items ADD COLUMN is_event_item INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='created_at') THEN
          ALTER TABLE menu_items ADD COLUMN created_at TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='description') THEN
          ALTER TABLE menu_items ADD COLUMN description TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='image_url') THEN
          ALTER TABLE menu_items ADD COLUMN image_url TEXT;
        END IF;

        -- CATEGORIES
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sort_order') THEN
          ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='print_enabled') THEN
          ALTER TABLE categories ADD COLUMN print_enabled INTEGER DEFAULT 0;
        END IF;

        -- ITEM_GROUPS
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='item_groups' AND column_name='sort_order') THEN
          ALTER TABLE item_groups ADD COLUMN sort_order INTEGER DEFAULT 0;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='item_groups' AND column_name='show_in_history') THEN
          ALTER TABLE item_groups ADD COLUMN show_in_history INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='item_groups' AND column_name='print_enabled') THEN
          ALTER TABLE item_groups ADD COLUMN print_enabled INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='item_groups' AND column_name='show_in_history') THEN
          ALTER TABLE item_groups ADD COLUMN show_in_history INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='item_groups' AND column_name='category_name') THEN
          ALTER TABLE item_groups ADD COLUMN category_name TEXT;
        END IF;

        -- TABLES
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='type') THEN
          ALTER TABLE tables ADD COLUMN type TEXT DEFAULT 'salao';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='customer_name') THEN
          ALTER TABLE tables ADD COLUMN customer_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='people_count') THEN
          ALTER TABLE tables ADD COLUMN people_count INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='opened_at') THEN
          ALTER TABLE tables ADD COLUMN opened_at TEXT;
        END IF;

        -- ORDERS
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='is_read') THEN
          ALTER TABLE orders ADD COLUMN is_read INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='observation') THEN
          ALTER TABLE orders ADD COLUMN observation TEXT;
        END IF;

        -- HISTORY
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='history' AND column_name='deleted') THEN
          ALTER TABLE history ADD COLUMN deleted INTEGER DEFAULT 0;
        END IF;

        -- CASHIER_SESSIONS
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_sessions' AND column_name='expected_balance') THEN
          ALTER TABLE cashier_sessions ADD COLUMN expected_balance REAL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_sessions' AND column_name='counted_balance') THEN
          ALTER TABLE cashier_sessions ADD COLUMN counted_balance REAL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_sessions' AND column_name='difference') THEN
          ALTER TABLE cashier_sessions ADD COLUMN difference REAL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_sessions' AND column_name='difference_reason') THEN
          ALTER TABLE cashier_sessions ADD COLUMN difference_reason TEXT;
        END IF;

        -- CASHIER_TRANSACTIONS
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_transactions' AND column_name='operator_id') THEN
          ALTER TABLE cashier_transactions ADD COLUMN operator_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_transactions' AND column_name='operator_name') THEN
          ALTER TABLE cashier_transactions ADD COLUMN operator_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cashier_transactions' AND column_name='deleted') THEN
          ALTER TABLE cashier_transactions ADD COLUMN deleted INTEGER DEFAULT 0;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        sort_order INTEGER DEFAULT 0,
        print_enabled INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS item_groups (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        category_name TEXT,
        sort_order INTEGER DEFAULT 0,
        print_enabled INTEGER DEFAULT 0,
        show_in_history INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        action TEXT,
        details TEXT,
        order_id TEXT,
        item_group TEXT,
        table_id INTEGER,
        request_id TEXT,
        is_read INTEGER DEFAULT 0,
        timestamp TEXT,
        deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cashier_sessions (
        id TEXT PRIMARY KEY,
        opened_at TEXT,
        closed_at TEXT,
        opened_by_id TEXT,
        opened_by_name TEXT,
        closed_by_id TEXT,
        closed_by_name TEXT,
        initial_balance REAL,
        expected_balance REAL,
        counted_balance REAL,
        difference REAL,
        difference_reason TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS cashier_transactions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        type TEXT,
        amount REAL,
        description TEXT,
        method TEXT,
        timestamp TEXT,
        user_id TEXT,
        username TEXT,
        operator_id TEXT,
        operator_name TEXT,
        deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY,
        number INTEGER UNIQUE,
        status TEXT,
        customer_name TEXT,
        people_count INTEGER,
        opened_at TEXT,
        type TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        table_id INTEGER,
        menu_item_id TEXT,
        quantity INTEGER,
        status TEXT,
        is_read INTEGER DEFAULT 0,
        observation TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS transfer_requests (
        id TEXT PRIMARY KEY,
        from_table_id INTEGER,
        to_table_id INTEGER,
        order_ids TEXT,
        user_id TEXT,
        username TEXT,
        target_type TEXT DEFAULT 'salao',
        status TEXT DEFAULT 'pending',
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS stock_purchases (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT,
        quantity REAL,
        cost_price REAL,
        timestamp TEXT,
        user_id TEXT,
        username TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS accounts_payable (
        id TEXT PRIMARY KEY,
        description TEXT,
        amount REAL,
        due_date TEXT,
        status TEXT,
        paid_at TEXT,
        method TEXT,
        category TEXT,
        recurring INTEGER DEFAULT 0,
        user_id TEXT,
        username TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        assigned_to TEXT,
        created_by TEXT,
        created_by_name TEXT,
        status TEXT,
        timestamp TEXT
      );
    `);
    console.log("[Supabase] Tables checked/created.");
  } catch (err) {
    console.error("[Supabase] Init error:", err);
  } finally {
    if (client) client.release();
  }
}

let db: any;

const LIMITS = {
  request: 66000
};
let broadcastFn: ((data: any) => void) | null = null;
let lastAlert: {[key: string]: number} = {};

function logUsage(type: 'supabase_query' | 'request', count: number = 1) {
  try {
    if (!db) return;
    const date = new Date().toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO usage_stats (date, supabase_queries, request_count)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
      supabase_queries = supabase_queries + (CASE WHEN ? = 'supabase_query' THEN ? ELSE 0 END),
      request_count = request_count + (CASE WHEN ? = 'request' THEN ? ELSE 0 END)
    `).run(
      date,
      type === 'supabase_query' ? count : 0,
      type === 'request' ? count : 0,
      type, count, type, count
    );
    checkThresholds(date);
  } catch (e) {
    console.error("Error logging usage:", e);
  }
}

function checkThresholds(date: string) {
  try {
    if (!db) return;
    const stats = db.prepare("SELECT * FROM usage_stats WHERE date = ?").get(date) as any;
    if (!stats) return;

    const checkUsage = (key: keyof typeof LIMITS, label: string) => {
      const usage = stats[key];
      const limit = LIMITS[key];
      const ratio = usage / limit;
      
      const alertKey = `${key}_${ratio >= 0.9 ? '90' : '75'}`;
      if (ratio >= 0.9 && (lastAlert[alertKey] || 0) < Date.now() - 3600000) {
        if (broadcastFn) broadcastFn({ type: "NOTIFICATION", payload: { message: `ALERTA CRÍTICO: Uso de ${label} em ${Math.round(ratio*100)}%!`, type: 'error' } });
        lastAlert[alertKey] = Date.now();
      } else if (ratio >= 0.75 && (lastAlert[alertKey] || 0) < Date.now() - 3600000) {
        if (broadcastFn) broadcastFn({ type: "NOTIFICATION", payload: { message: `AVISO: Uso de ${label} em ${Math.round(ratio*100)}%.`, type: 'warning' } });
        lastAlert[alertKey] = Date.now();
      }
    };

    checkUsage('request', 'Processamento Cloud Run');
  } catch (e) {
    console.error("Error checking thresholds:", e);
  }
}

function deleteDatabase() {
  console.log("[Database] Attempting to delete database files...");
  // Close the database if it exists
  if (db) {
    try {
      db.close();
      console.log("[Database] Database connection closed.");
    } catch (e) {
      console.warn("[Database] Error closing database before deletion:", e);
    }
  }

  const files = [
    DB_PATH,
    `${DB_PATH}-journal`,
    `${DB_PATH}-wal`,
    `${DB_PATH}-shm`
  ];
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`[Database] Deleted ${file}`);
      }
    } catch (e) {
      console.error(`[Database] Failed to delete ${file}:`, e);
    }
  });
}

function initializeStorage() {
  try {
    console.log("[Database] Opening database...");
    db = new Database(DB_PATH);
    
    console.log("[Database] Initializing schema...");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT,
        password TEXT,
        role TEXT,
        avatar TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY,
        number INTEGER UNIQUE,
        status TEXT DEFAULT 'free',
        customer_name TEXT,
        people_count INTEGER,
        opened_at TEXT,
        type TEXT DEFAULT 'salao'
      );

      CREATE TABLE IF NOT EXISTS transfer_requests (
        id TEXT PRIMARY KEY,
        from_table_id INTEGER,
        to_table_id INTEGER,
        order_ids TEXT,
        user_id TEXT,
        username TEXT,
        target_type TEXT DEFAULT 'salao',
        status TEXT DEFAULT 'pending',
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        type TEXT,
        category TEXT,
        active INTEGER DEFAULT 1,
        description TEXT,
        image_url TEXT,
        print_enabled INTEGER DEFAULT 0,
        created_at TEXT,
        is_stockable INTEGER DEFAULT 0,
        is_solid INTEGER DEFAULT 0,
        current_stock REAL DEFAULT 0,
        is_event_item INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        sort_order INTEGER DEFAULT 0,
        print_enabled INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS item_groups (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        category_name TEXT,
        sort_order INTEGER DEFAULT 0,
        print_enabled INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        table_id INTEGER,
        menu_item_id TEXT,
        quantity INTEGER,
        status TEXT,
        is_read INTEGER DEFAULT 0,
        observation TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        action TEXT,
        details TEXT,
        order_id TEXT,
        item_group TEXT,
        table_id INTEGER,
        request_id TEXT,
        is_read INTEGER DEFAULT 0,
        timestamp TEXT,
        deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS cashier_sessions (
        id TEXT PRIMARY KEY,
        opened_at TEXT,
        closed_at TEXT,
        opened_by_id TEXT,
        opened_by_name TEXT,
        closed_by_id TEXT,
        closed_by_name TEXT,
        initial_balance REAL DEFAULT 0,
        expected_balance REAL,
        counted_balance REAL,
        difference REAL,
        difference_reason TEXT,
        status TEXT DEFAULT 'open'
      );

      CREATE TABLE IF NOT EXISTS cashier_transactions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        type TEXT,
        amount REAL,
        description TEXT,
        method TEXT,
        timestamp TEXT,
        user_id TEXT,
        username TEXT,
        operator_id TEXT,
        operator_name TEXT,
        deleted INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS accounts_payable (
        id TEXT PRIMARY KEY,
        description TEXT,
        amount REAL,
        due_date TEXT,
        status TEXT DEFAULT 'pending',
        paid_at TEXT,
        method TEXT,
        category TEXT,
        recurring INTEGER DEFAULT 0,
        user_id TEXT,
        username TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS stock_purchases (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT,
        quantity REAL,
        cost_price REAL,
        timestamp TEXT,
        user_id TEXT,
        username TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        assigned_to TEXT,
        created_by TEXT,
        created_by_name TEXT,
        status TEXT,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS usage_stats (
        date TEXT PRIMARY KEY,
        supabase_queries INTEGER DEFAULT 0,
        request_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT
      );
    `);
    
    const addColumnIfMissing = (tableName: string, columnName: string, typeDef: string) => {
      const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
      const columnExists = info.some((c: any) => c.name === columnName);
      if (!columnExists) {
        try {
          db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${typeDef}`).run();
          console.log(`[Database] Added column ${columnName} to ${tableName}`);
        } catch (e) {
          console.error(`[Database] Error adding column ${columnName} to ${tableName}:`, e);
        }
      }
    };

    addColumnIfMissing("users", "email", "TEXT");
    addColumnIfMissing("users", "avatar", "TEXT");
    addColumnIfMissing("users", "created_at", "TEXT");
    addColumnIfMissing("categories", "sort_order", "INTEGER DEFAULT 0");
    addColumnIfMissing("categories", "print_enabled", "INTEGER DEFAULT 0");
    addColumnIfMissing("item_groups", "sort_order", "INTEGER DEFAULT 0");
    addColumnIfMissing("item_groups", "category_name", "TEXT");
    addColumnIfMissing("item_groups", "show_in_history", "INTEGER DEFAULT 1");
    addColumnIfMissing("item_groups", "print_enabled", "INTEGER DEFAULT 0");
    addColumnIfMissing("menu_items", "print_enabled", "INTEGER DEFAULT 0");
    addColumnIfMissing("menu_items", "active", "INTEGER DEFAULT 1");
    addColumnIfMissing("menu_items", "created_at", "TEXT");
    addColumnIfMissing("menu_items", "is_stockable", "INTEGER DEFAULT 0");
    addColumnIfMissing("menu_items", "is_solid", "INTEGER DEFAULT 0");
    addColumnIfMissing("menu_items", "current_stock", "REAL DEFAULT 0");
    addColumnIfMissing("menu_items", "is_event_item", "INTEGER DEFAULT 0");
    addColumnIfMissing("menu_items", "description", "TEXT");
    addColumnIfMissing("menu_items", "image_url", "TEXT");
    addColumnIfMissing("tables", "type", "TEXT DEFAULT 'salao'");
    addColumnIfMissing("tables", "customer_name", "TEXT");
    addColumnIfMissing("tables", "people_count", "INTEGER");
    addColumnIfMissing("tables", "opened_at", "TEXT");
    addColumnIfMissing("orders", "is_read", "INTEGER DEFAULT 0");
    addColumnIfMissing("orders", "observation", "TEXT");
    addColumnIfMissing("history", "order_id", "TEXT");
    addColumnIfMissing("history", "item_group", "TEXT");
    addColumnIfMissing("history", "table_id", "INTEGER");
    addColumnIfMissing("history", "request_id", "TEXT");
    addColumnIfMissing("history", "deleted", "INTEGER DEFAULT 0");
    addColumnIfMissing("cashier_sessions", "expected_balance", "REAL");
    addColumnIfMissing("cashier_sessions", "counted_balance", "REAL");
    addColumnIfMissing("cashier_sessions", "difference", "REAL");
    addColumnIfMissing("cashier_sessions", "difference_reason", "TEXT");
    addColumnIfMissing("cashier_transactions", "operator_id", "TEXT");
    addColumnIfMissing("cashier_transactions", "operator_name", "TEXT");
    addColumnIfMissing("cashier_transactions", "deleted", "INTEGER DEFAULT 0");

    console.log("[Database] Seeding initial data...");
    // Initial Settings
    const seedSettings = [
      { key: "service_fee", value: "10" },
      { key: "access_token", value: "123456" }
    ];

    seedSettings.forEach(s => {
      const exists = db.prepare("SELECT * FROM settings WHERE key = ?").get(s.key);
      if (!exists) {
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(s.key, s.value);
      }
    });

    // Role permissions
    const defaultPermissions: any = {
      host: { mesas: true, historico: true, cardapio: true, erp: true, config: true, edit_menu: true, delete_order: true, manage_users: true, clear_history: true, mark_history_read: true, manage_categories: true, reorder_categories: true, reorder_groups: true, apply_discount: true, remove_service_fee: true, manage_printer: true, manage_tasks: true, manage_tables: true }
    };

    const initialRoles = JSON.stringify(['host']);
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('custom_roles', ?)").run(initialRoles);

    for (const role of ['host']) {
      const key = `permissions_${role}`;
      const exists = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
      if (!exists) {
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, JSON.stringify(defaultPermissions[role]));
      }
    }

    // Legacy role migration
    try {
      db.prepare("UPDATE users SET role = 'waiter' WHERE role = 'user'").run();
    } catch (e) {}

    // Seed SQLite Users — senhas com hash bcrypt
    const hostUser = db.prepare("SELECT * FROM users WHERE username = ?").get("deckserrinha") as any;
    if (!hostUser) {
      const hashed = bcrypt.hashSync("deckappadmin", SALT_ROUNDS);
      db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)").run(uuidv4(), "deckserrinha", hashed, "host");
    } else if (!hostUser.password) {
      const hashed = bcrypt.hashSync("deckappadmin", SALT_ROUNDS);
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(hashed, "deckserrinha");
    }
    // Se hostUser já existe com senha, a migração ocorre automaticamente no login.

    const devUser = db.prepare("SELECT * FROM users WHERE username = ?").get("Dev") as any;
    if (!devUser) {
      const hashed = bcrypt.hashSync("2212", SALT_ROUNDS);
      db.prepare("INSERT INTO users (id, username, password, role, avatar) VALUES (?, ?, ?, ?, ?)").run(uuidv4(), "Dev", hashed, "host", "👨‍💻");
    }
    // Não sobrescreve senha do Dev se já existir — migração ocorre no login.

    // Seed Tables
    for (let i = 1; i <= 30; i++) {
      db.prepare("INSERT OR IGNORE INTO tables (id, number) VALUES (?, ?)").run(i, i);
    }

    // Seed Categories/Groups if empty
    const categoriesCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
    if (categoriesCount.count === 0) {
      const distinctTypes = db.prepare("SELECT DISTINCT type FROM menu_items WHERE type IS NOT NULL AND type != ''").all() as { type: string }[];
      for (const t of distinctTypes) {
        db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run(uuidv4(), t.type);
      }
    }

    const groupsCount = db.prepare("SELECT COUNT(*) as count FROM item_groups").get() as { count: number };
    if (groupsCount.count === 0) {
      const distinctCategories = db.prepare("SELECT DISTINCT category FROM menu_items WHERE category IS NOT NULL AND category != ''").all() as { category: string }[];
      for (const c of distinctCategories) {
        db.prepare("INSERT INTO item_groups (id, name) VALUES (?, ?)").run(uuidv4(), c.category);
      }
    }

    console.log("[Database] Initialized successfully.");
  } catch (err: any) {
    if (err.code === 'SQLITE_CORRUPT' || err.message.includes('malformed') || err.message.includes('corrupt')) {
      console.error("[Database] SQLite corruption detected. Recreating database...", err.message);
      deleteDatabase();
      initializeStorage(); // Recursive retry
    } else {
      console.error("[Database] Fatal initialization error:", err);
      throw err;
    }
  }
}

// Initial boot
initializeStorage();

// 

async function loadFromCloud(hostId: string) {
  try {
    console.log("Loading/Syncing data from Cloud (Supabase)...");
    logUsage('supabase_query', 5);

    const pool = getPgPool();
    if (!pool) {
      console.warn("[Supabase] Supabase sync desabilitado (sem URL válida).");
      return;
    }

    const pgClient = await pool.connect();
    try {

      // ════════════════════════════════════════════════════════════════
      // DADOS EM TEMPO REAL — INSERT OR IGNORE (local sempre vence)
      // Se o registro já existe localmente, NÃO sobrescreve.
      // Só importa o que não existe localmente (útil após reinício do servidor).
      // ════════════════════════════════════════════════════════════════

      // ── MESAS ──
      const tablesRes = await pgClient.query("SELECT * FROM tables");
      for (const r of tablesRes.rows) {
        const localTable = db.prepare("SELECT * FROM tables WHERE number = ?").get(r.number) as any;
        if (!localTable) {
          // Mesa não existe localmente — importa completa
          db.prepare(`
            INSERT OR IGNORE INTO tables (id, number, status, customer_name, people_count, opened_at, type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(r.id, r.number, r.status, r.customer_name, r.people_count, r.opened_at, r.type);
        }
        // Se a mesa existe localmente (aberta ou livre), a base local é a fonte da verdade e o próximo saveToCloud vai corrigir a nuvem.
      }

      // ── PEDIDOS ──
      // Só importa pedidos de mesas que existem localmente e estão abertas
      const ordersRes = await pgClient.query("SELECT * FROM orders");
      for (const r of ordersRes.rows) {
        const localTable = db.prepare("SELECT id FROM tables WHERE id = ? AND status != 'free'").get(r.table_id);
        if (localTable) {
          db.prepare(`
            INSERT INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET quantity=EXCLUDED.quantity, status=EXCLUDED.status, is_read=EXCLUDED.is_read, observation=EXCLUDED.observation
          `).run(r.id, r.table_id, r.menu_item_id, r.quantity, r.status, r.is_read, r.observation, r.timestamp);
        }
      }

      // ── CAIXA — SESSÕES ──
      // Atualiza com base na nuvem para não perder o fechamento e totais corrigidos
      const sessRes = await pgClient.query("SELECT * FROM cashier_sessions ORDER BY opened_at DESC");
      for (const r of sessRes.rows) {
        const localSession = db.prepare("SELECT * FROM cashier_sessions WHERE id = ?").get(r.id) as any;
        if (!localSession) {
          db.prepare(`
            INSERT INTO cashier_sessions
            (id, opened_at, closed_at, opened_by_id, opened_by_name, closed_by_id, closed_by_name, initial_balance, expected_balance, counted_balance, difference, difference_reason, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(r.id, r.opened_at, r.closed_at, r.opened_by_id, r.opened_by_name,
                 r.closed_by_id, r.closed_by_name, r.initial_balance, r.expected_balance, r.counted_balance, r.difference, r.difference_reason, r.status);
        } else if (localSession.status === 'open' && r.status === 'closed') {
          // Upload closed state from cloud to local
          db.prepare(`
            UPDATE cashier_sessions
            SET closed_at=?, status=?, expected_balance=?, counted_balance=?, difference=?, difference_reason=?
            WHERE id=?
          `).run(r.closed_at, r.status, r.expected_balance, r.counted_balance, r.difference, r.difference_reason, r.id);
        }
      }

      // ── CAIXA — TRANSAÇÕES ──
      const txRes = await pgClient.query("SELECT * FROM cashier_transactions ORDER BY timestamp DESC LIMIT 500");
      for (const r of txRes.rows) {
        db.prepare(`
          INSERT INTO cashier_transactions
          (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount, description=EXCLUDED.description, method=EXCLUDED.method, deleted=EXCLUDED.deleted
        `).run(r.id, r.session_id, r.type, r.amount, r.description, r.method, r.timestamp, r.user_id, r.username, r.operator_id, r.operator_name, r.deleted || 0);
      }

      // ── HISTÓRICO ──
      const histRes = await pgClient.query("SELECT * FROM history ORDER BY timestamp DESC LIMIT 200");
      for (const r of histRes.rows) {
        db.prepare(`
          INSERT INTO history
          (id, user_id, username, action, details, order_id, item_group, table_id, request_id, is_read, timestamp, deleted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET is_read=EXCLUDED.is_read, deleted=EXCLUDED.deleted
        `).run(r.id, r.user_id, r.username, r.action, r.details, r.order_id,
               r.item_group, r.table_id, r.request_id, r.is_read, r.timestamp, r.deleted || 0);
      }

      // ── CONTAS A PAGAR ──
      const payRes = await pgClient.query("SELECT * FROM accounts_payable");
      for (const r of payRes.rows) {
        db.prepare(`
          INSERT INTO accounts_payable
          (id, description, amount, due_date, status, paid_at, method, category, recurring, user_id, username, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status, paid_at=EXCLUDED.paid_at, method=EXCLUDED.method, amount=EXCLUDED.amount, due_date=EXCLUDED.due_date, description=EXCLUDED.description
        `).run(r.id, r.description, r.amount, r.due_date, r.status, r.paid_at,
               r.method, r.category, r.recurring, r.user_id, r.username, r.timestamp);
      }

      // ── TAREFAS ──
      const taskRes = await pgClient.query("SELECT * FROM tasks");
      for (const r of taskRes.rows) {
        db.prepare(`
          INSERT INTO tasks
          (id, title, description, assigned_to, created_by, created_by_name, status, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status, title=EXCLUDED.title, description=EXCLUDED.description, assigned_to=EXCLUDED.assigned_to
        `).run(r.id, r.title, r.description, r.assigned_to, r.created_by,
               r.created_by_name, r.status, r.timestamp);
      }

      // ── TRANSFER REQUESTS ──
      const transferRes = await pgClient.query("SELECT * FROM transfer_requests");
      for (const r of transferRes.rows) {
        db.prepare(`
          INSERT INTO transfer_requests
          (id, from_table_id, to_table_id, order_ids, user_id, username, target_type, status, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status
        `).run(r.id, r.from_table_id, r.to_table_id, r.order_ids, r.user_id, r.username, r.target_type, r.status, r.timestamp);
      }

      // ════════════════════════════════════════════════════════════════
      // DADOS ESTÁTICOS — INSERT OR REPLACE (nuvem sempre vence)
      // Cardápio, categorias, usuários e configurações são gerenciados
      // pelo dono e não mudam durante o serviço. A nuvem tem a versão
      // mais atualizada.
      // ════════════════════════════════════════════════════════════════

      // ── CONFIGURAÇÕES ──
      const settingsRes = await pgClient.query("SELECT * FROM settings");
      for (const r of settingsRes.rows) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(r.key, r.value);
      }

      // ── USUÁRIOS ──
      const userRes = await pgClient.query("SELECT * FROM users");
      for (const r of userRes.rows) {
        try {
          db.prepare(`
            INSERT INTO users (id, username, email, password, role, avatar)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
              id = excluded.id,
              email = excluded.email,
              password = excluded.password,
              role = excluded.role,
              avatar = excluded.avatar
          `).run(r.id, r.username, r.email, r.password, r.role, r.avatar);
        } catch (err) {
          console.error("Insert user error:", err);
        }
      }

      // ── CATEGORIAS ──
      const catRes = await pgClient.query("SELECT * FROM categories ORDER BY sort_order ASC");
      for (const r of catRes.rows) {
        db.prepare("INSERT OR REPLACE INTO categories (id, name, sort_order, print_enabled) VALUES (?, ?, ?, ?)")
          .run(r.id, r.name, r.sort_order, r.print_enabled);
      }

      // ── GRUPOS DE ITENS ──
      const igRes = await pgClient.query("SELECT * FROM item_groups ORDER BY sort_order ASC");
      for (const r of igRes.rows) {
        db.prepare("INSERT OR REPLACE INTO item_groups (id, name, category_name, sort_order, print_enabled, show_in_history) VALUES (?, ?, ?, ?, ?, ?)")
          .run(r.id, r.name, r.category_name, r.sort_order, r.print_enabled, r.show_in_history);
      }

      // ── ITENS DO CARDÁPIO ──
      const miRes = await pgClient.query("SELECT * FROM menu_items");
      for (const r of miRes.rows) {
        db.prepare(`
          INSERT OR REPLACE INTO menu_items
          (id, name, price, type, category, active, print_enabled, created_at, is_stockable, is_solid, current_stock, is_event_item, description, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(r.id, r.name, r.price, r.type, r.category, r.active, r.print_enabled,
               r.created_at, r.is_stockable, r.is_solid, r.current_stock,
               r.is_event_item, r.description || null, r.image_url || null);
      }

      console.log("Cloud load from Supabase completed.");
    } finally {
      pgClient.release();
    }
  } catch (error) {
    console.error("Cloud load error:", error);
  }
}



async function saveToCloud() {
  try {
    // Estimate writes
    logUsage('supabase_query', 20);

    try {
      // 1. SUPABASE - Heavy/History data
      const pool = getPgPool();
      if (pool) {
        const pgClient = await pool.connect();
        try {
          // Batch History
          const history = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 200").all() as any[];
          if (history.length > 0) {
            const historyPromises = history.map(h => pgClient.query(`
              INSERT INTO history (id, user_id, username, action, details, order_id, item_group, table_id, request_id, is_read, timestamp, deleted)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (id) DO UPDATE SET is_read = EXCLUDED.is_read, deleted = EXCLUDED.deleted
            `, [h.id, h.user_id, h.username, h.action, h.details, h.order_id, h.item_group, h.table_id, h.request_id, h.is_read || 0, h.timestamp, h.deleted || 0]));
            await Promise.all(historyPromises.slice(0, 50));
            if (historyPromises.length > 50) await Promise.all(historyPromises.slice(50));
          }

          // Batch Sessions
          const sessions = db.prepare("SELECT * FROM cashier_sessions").all() as any[];
          for (const s of sessions) {
            await pgClient.query(`
              INSERT INTO cashier_sessions (id, opened_at, closed_at, opened_by_id, opened_by_name, closed_by_id, closed_by_name, initial_balance, expected_balance, counted_balance, difference, difference_reason, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (id) DO UPDATE SET closed_at = EXCLUDED.closed_at, status = EXCLUDED.status, expected_balance = EXCLUDED.expected_balance, counted_balance = EXCLUDED.counted_balance, difference = EXCLUDED.difference, difference_reason = EXCLUDED.difference_reason
            `, [s.id, s.opened_at, s.closed_at, s.opened_by_id, s.opened_by_name, s.closed_by_id, s.closed_by_name, s.initial_balance, s.expected_balance, s.counted_balance, s.difference, s.difference_reason, s.status]);
          }

          // Batch Transactions
          const transactions = db.prepare("SELECT * FROM cashier_transactions ORDER BY timestamp DESC LIMIT 200").all() as any[];
          if (transactions.length > 0) {
            const txPromises = transactions.map(t => pgClient.query(`
              INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (id) DO UPDATE SET deleted = EXCLUDED.deleted
            `, [t.id, t.session_id, t.type, t.amount, t.description, t.method, t.timestamp, t.user_id, t.username, t.operator_id, t.operator_name, t.deleted || 0]));
            await Promise.all(txPromises);
          }

          // Batch Payables
          const payables = db.prepare("SELECT * FROM accounts_payable").all() as any[];
          for (const p of payables) {
            await pgClient.query(`
              INSERT INTO accounts_payable (id, description, amount, due_date, status, paid_at, method, category, recurring, user_id, username, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, paid_at = EXCLUDED.paid_at, method = EXCLUDED.method
            `, [p.id, p.description, p.amount, p.due_date, p.status, p.paid_at, p.method, p.category, p.recurring, p.user_id, p.username, p.timestamp]);
          }

          // Batch Tasks
          const tasks = db.prepare("SELECT * FROM tasks").all() as any[];
          for (const t of tasks) {
            await pgClient.query(`
              INSERT INTO tasks (id, title, description, assigned_to, created_by, created_by_name, status, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, title = EXCLUDED.title, description = EXCLUDED.description
            `, [t.id, t.title, t.description, t.assigned_to, t.created_by, t.created_by_name, t.status, t.timestamp]);
          }

          // Users
          const users = db.prepare("SELECT * FROM users").all() as any[];
          for (const u of users) {
            await pgClient.query(`
              INSERT INTO users (id, username, email, password, role, avatar)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (username) DO UPDATE SET id = EXCLUDED.id, email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role, avatar = EXCLUDED.avatar
            `, [u.id, u.username, u.email, u.password, u.role, u.avatar]);
          }

          // Categories
          const categories = db.prepare("SELECT * FROM categories").all() as any[];
          for (const c of categories) {
            await pgClient.query(`
              INSERT INTO categories (id, name, sort_order, print_enabled)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, print_enabled = EXCLUDED.print_enabled
            `, [c.id, c.name, c.sort_order, c.print_enabled]);
          }

          // Item Groups
          const itemGroups = db.prepare("SELECT * FROM item_groups").all() as any[];
          for (const ig of itemGroups) {
            await pgClient.query(`
              INSERT INTO item_groups (id, name, category_name, sort_order, print_enabled, show_in_history)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_name = EXCLUDED.category_name, sort_order = EXCLUDED.sort_order, print_enabled = EXCLUDED.print_enabled, show_in_history = EXCLUDED.show_in_history
            `, [ig.id, ig.name, ig.category_name, ig.sort_order, ig.print_enabled, ig.show_in_history]);
          }

          // Menu Items
          const menuItems = db.prepare("SELECT * FROM menu_items").all() as any[];
          for (const mi of menuItems) {
            await pgClient.query(`
              INSERT INTO menu_items (id, name, price, type, category, active, print_enabled, created_at, is_stockable, is_solid, current_stock, is_event_item, description, image_url)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, 
                price = EXCLUDED.price, 
                type = EXCLUDED.type, 
                category = EXCLUDED.category, 
                active = EXCLUDED.active, 
                print_enabled = EXCLUDED.print_enabled, 
                is_stockable = EXCLUDED.is_stockable, 
                is_solid = EXCLUDED.is_solid, 
                current_stock = EXCLUDED.current_stock, 
                is_event_item = EXCLUDED.is_event_item,
                description = EXCLUDED.description,
                image_url = EXCLUDED.image_url
            `, [mi.id, mi.name, mi.price, mi.type, mi.category, mi.active, mi.print_enabled, mi.created_at, mi.is_stockable, mi.is_solid, mi.current_stock, mi.is_event_item || 0, mi.description || null, mi.image_url || null]);
          }

          // Tables
          const tables = db.prepare("SELECT * FROM tables").all() as any[];
          const allPgTables = await pgClient.query("SELECT id FROM tables");
          const localTableIds = tables.map(t => t.id);
          for (const pt of allPgTables.rows) {
            if (!localTableIds.includes(pt.id)) {
              await pgClient.query("DELETE FROM orders WHERE table_id = $1", [pt.id]);
              await pgClient.query("DELETE FROM tables WHERE id = $1", [pt.id]);
            }
          }

          for (const t of tables) {
            await pgClient.query(`
              INSERT INTO tables (id, number, status, customer_name, people_count, opened_at, type)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO UPDATE SET number = EXCLUDED.number, status = EXCLUDED.status, customer_name = EXCLUDED.customer_name, people_count = EXCLUDED.people_count, opened_at = EXCLUDED.opened_at, type = EXCLUDED.type
            `, [t.id, t.number, t.status, t.customer_name, t.people_count, t.opened_at, t.type]);
          }

          // Orders
          const orders = db.prepare("SELECT * FROM orders").all() as any[];
          if (orders.length > 0) {
            const orderPromises = orders.map(o => pgClient.query(`
              INSERT INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (id) DO UPDATE SET table_id = EXCLUDED.table_id, menu_item_id = EXCLUDED.menu_item_id, quantity = EXCLUDED.quantity, status = EXCLUDED.status, is_read = EXCLUDED.is_read, observation = EXCLUDED.observation
            `, [o.id, o.table_id, o.menu_item_id, o.quantity, o.status, o.is_read, o.observation, o.timestamp]));
            
            await Promise.all(orderPromises.slice(0, 50));
            if (orderPromises.length > 50) await Promise.all(orderPromises.slice(50));
          }

          // Settings
          const settingsRecords = db.prepare("SELECT * FROM settings").all() as any[];
          for (const s of settingsRecords) {
            await pgClient.query(`
              INSERT INTO settings (key, value)
              VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [s.key, s.value]);
          }

          // Stock Purchases
          const stockPurchases = db.prepare("SELECT * FROM stock_purchases").all() as any[];
          for (const sp of stockPurchases) {
            await pgClient.query(`
              INSERT INTO stock_purchases (id, menu_item_id, quantity, cost_price, timestamp, user_id, username)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING
            `, [sp.id, sp.menu_item_id, sp.quantity, sp.cost_price, sp.timestamp, sp.user_id, sp.username]);
          }

          // ─── LIMPEZA CONSERVADORA ──────────────────────────────────────────────────
          // Apenas deletamos o que realmente não deve persistir se estiver vazio no SQLite
          // ex: pedidos que já foram finalizados ou mesas que sumiram
          const cleanups = [
            { table: 'orders', key: 'id' },
            { table: 'tasks', key: 'id' },
            { table: 'accounts_payable', key: 'id' },
            { table: 'categories', key: 'id' },
            { table: 'item_groups', key: 'id' },
            { table: 'menu_items', key: 'id' },
            { table: 'transfer_requests', key: 'id' }
          ];

          for (const c of cleanups) {
            const rows = db.prepare(`SELECT ${c.key} FROM ${c.table}`).all() as any[];
            const values = rows.map(r => r[c.key]);
            if (values.length > 0) {
              const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
              await pgClient.query(`DELETE FROM ${c.table} WHERE "${c.key}" NOT IN (${placeholders})`, values);
            } else {
              // Se o SQLite estiver vazio, deletamos tudo na nuvem para essa tabela específica
              await pgClient.query(`DELETE FROM ${c.table}`);
            }
          }
          // Tabelas 'free' na nuvem mas que não existem no SQLite podem ser limpas, mas as 'open' devem ficar.
          await pgClient.query(`DELETE FROM tables WHERE status = 'free' AND number NOT IN (SELECT number FROM tables)`);

        } finally {
          pgClient.release();
        }
      }

      console.log("Full Cloud save completed.");
    } catch (err) {
      console.error("Save to Cloud failed:", err);
    }
  } catch (error) {
    console.error("Save to Cloud outer error:", error);
  }
}

// Removed OperationType and handleFirestoreError

function formatTableNumber(num: number | string) {
  if (num === -1 || num === "-1") return "Balcão";
  try {
    if (db) {
      const table = db.prepare("SELECT number FROM tables WHERE id = ?").get(num) as any;
      if (table) {
        const n = table.number;
        return n < 10 ? `0${n}` : `${n}`;
      }
    }
  } catch(e) {}
  
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (isNaN(n)) return num;
  return n < 10 ? `0${n}` : `${n}`;
}

// ─── Helpers de senha ────────────────────────────────────────────────────────
async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(
  plain: string,
  stored: string,
  userId: string
): Promise<boolean> {
  const isHashed = stored.startsWith('$2');
  if (isHashed) {
    return bcrypt.compare(plain, stored);
  }
  // Senha em texto puro — compara diretamente e faz upgrade para hash
  if (plain !== stored) return false;
  try {
    const hashed = await hashPassword(plain);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, userId);
    const pool = getPgPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
      } finally {
        client.release();
      }
    }
    console.log(`[Auth] Senha do usuário ${userId} migrada para bcrypt.`);
  } catch (e) {
    console.error('[Auth] Falha ao fazer upgrade da senha:', e);
  }
  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  console.log("[Server] Starting initialization...");
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ─── Middleware de autenticação para rotas /api ───────────────────────────
  app.use('/api', (req, res, next) => {
    // Atenção: quando montado em '/api', o Express remove o prefixo do req.path
    // então '/api/login' aparece como '/login' aqui dentro
    const PUBLIC_ROUTES = ['/login', '/health'];
    if (PUBLIC_ROUTES.includes(req.path)) return next();

    const userId = req.headers['x-app-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Sessão inválida' });
    }

    (req as any).appUser = user;
    next();
  });
  // ─────────────────────────────────────────────────────────────────────────────

  // Basic health check to confirm server is responding
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  const hostUser = db.prepare("SELECT * FROM users WHERE username = ?").get("deckserrinha") as any;
  const hostId = hostUser?.id || "deckserrinha";

  // Test database connection (non-blocking)
  console.log("Supabase and SQLite connection active.");

  // Teste de conexão Supabase no boot
  (async () => {
    try {
      const pool = getPgPool();
      if (pool) {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('[Supabase] Conexão testada com sucesso no boot.');
      }
    } catch (e: any) {
      console.error('[Supabase] Falha no teste de boot:', e.message);
      resetPool();
    }
  })();

  // Initial sync on boot
  loadFromCloud(hostId).then(() => {
    console.log("[Server] Initial Cloud sync completed. Broadcasting updates...");
    if (broadcastFn) {
      const tables = db.prepare("SELECT * FROM tables").all();
      broadcastFn({ type: "TABLES_SYNC", payload: tables });
      
      const orders = db.prepare(`
        SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
        FROM orders o 
        LEFT JOIN menu_items m ON o.menu_item_id = m.id
      `).all();
      broadcastFn({ type: "ORDERS_SYNC", payload: orders });
      
      const activeSession = db.prepare("SELECT * FROM cashier_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get() as any;
      if (activeSession) {
        broadcastFn({ 
          type: "CASHIER_STATUS", 
          payload: { status: 'open', sessionId: activeSession.id, initialBalance: activeSession.initial_balance } 
        });
      }
    }
  }).catch(err => {
    console.error("[Server] Initial Cloud sync failed:", err);
  });

  const wss = new WebSocketServer({ noServer: true });

  const clients = new Map<WebSocket, { userId?: string, username?: string, role?: string }>();

  function broadcast(data: any, excludeWs?: WebSocket) {
    const message = JSON.stringify(data);
    clients.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(message);
      }
    });

    const ephemeralTypes = ['PRINT_COMMAND', 'NOTIFICATION', 'ONLINE_USERS', 'FORCE_LOGOUT'];
    if (data && data.type && !ephemeralTypes.includes(data.type)) {
      scheduleCloudSave();
    }
  }
  broadcastFn = (data: any) => broadcast(data);

  let syncTimeout: NodeJS.Timeout | null = null;
  let isSyncing = false;
  let pendingSync = false;

  function scheduleCloudSave() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      if (isSyncing) {
        pendingSync = true;
        return;
      }
      do {
        pendingSync = false;
        isSyncing = true;
        try {
          await saveToCloud();
        } catch (err) {
          console.error("Auto sync to cloud failed:", err);
          try {
            db.prepare("CREATE TABLE IF NOT EXISTS error_logs (msg TEXT, time TEXT)").run();
            db.prepare("INSERT INTO error_logs VALUES (?, ?)").run(err.toString(), new Date().toISOString());
          } catch(e) {}
        } finally {
          isSyncing = false;
        }
      } while (pendingSync);
    }, 3000);
  }

  // Real-time Firestore Listeners removed as per user request to save on reads.
  // Manual sync will handle cross-server consistency.

  function broadcastOnlineUsers() {
    const onlineUsers = Array.from(clients.values())
      .filter(u => u.userId)
      .map(u => ({ userId: u.userId, username: u.username, role: u.role }));
    broadcast({ type: "ONLINE_USERS", payload: onlineUsers });
  }

  async function logHistory(userId: string, username: string, action: string, details: string, orderId: string | null = null, itemGroup: string | null = null, tableId: number | null = null, requestId: string | null = null) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO history (id, user_id, username, action, details, order_id, item_group, table_id, request_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, username, action, details, orderId, itemGroup, tableId, requestId, timestamp);
    
    // History is now exclusively Supabase/SQLite to save Firestore writes.
    // It will be synced during manual saveToCloud.

    const history = db.prepare("SELECT * FROM history WHERE deleted = 0 ORDER BY timestamp DESC LIMIT 100").all();
    broadcast({ type: "HISTORY_UPDATE", payload: history });
  }

  wss.on("connection", (ws) => {
    clients.set(ws, {});

    // Initial sync
    const tables = db.prepare("SELECT * FROM tables").all();
    ws.send(JSON.stringify({ type: "TABLES_SYNC", payload: tables }));

    const menu = db.prepare("SELECT * FROM menu_items").all();
    ws.send(JSON.stringify({ type: "MENU_UPDATE", payload: menu }));

    const history = db.prepare(`
      SELECT h.* 
      FROM history h 
      WHERE h.deleted = 0
      ORDER BY h.timestamp DESC 
      LIMIT 100
    `).all();
    ws.send(JSON.stringify({ type: "HISTORY_UPDATE", payload: history }));

    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
    ws.send(JSON.stringify({ type: "SETTINGS_UPDATE", payload: settingsObj }));

    const categories = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
    ws.send(JSON.stringify({ type: "CATEGORIES_UPDATE", payload: categories }));

    const groups = db.prepare(`
      SELECT g.* 
      FROM item_groups g 
      LEFT JOIN categories c ON g.category_name = c.name 
      ORDER BY c.sort_order ASC, g.sort_order ASC
    `).all();
    ws.send(JSON.stringify({ type: "DETAILS_UPDATE", payload: groups }));

    const activeSession = db.prepare("SELECT * FROM cashier_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get() as any;
    if (activeSession) {
      ws.send(JSON.stringify({ 
        type: "CASHIER_STATUS", 
        payload: { 
          status: 'open', 
          sessionId: activeSession.id, 
          initialBalance: activeSession.initial_balance,
          openedAt: activeSession.opened_at
        } 
      }));
      const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(activeSession.id);
      ws.send(JSON.stringify({ type: "CASHIER_TRANSACTIONS", payload: transactions }));
    } else {
      ws.send(JSON.stringify({ type: "CASHIER_STATUS", payload: { status: 'closed' } }));
    }

    const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
    ws.send(JSON.stringify({ type: "TASKS_SYNC", payload: tasks }));

    const accountsPayable = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
    ws.send(JSON.stringify({ type: "ACCOUNTS_PAYABLE_SYNC", payload: accountsPayable }));

    ws.on("message", async (message) => {
      logUsage('request');
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case "SYNC_CHECK": {
            let supabaseStatus = "disconnected";
            try {
              const pool = getPgPool();
              if (pool) {
                const client = await pool.connect();
                await client.query("SELECT 1");
                client.release();
                supabaseStatus = "connected";
              }
            } catch (e: any) {
              console.error("[Supabase] Check failed:", e.message);
              // Reseta o pool para forçar nova conexão na próxima tentativa
              resetPool();
              supabaseStatus = "error";
            }
            ws.send(JSON.stringify({ type: "SYNC_STATUS", payload: { supabase: supabaseStatus, limits: LIMITS } }));
            break;
          }

          case "USAGE_GET": {
            const date = new Date().toISOString().split('T')[0];
            const stats = db.prepare("SELECT * FROM usage_stats WHERE date = ?").get(date);
            ws.send(JSON.stringify({ type: "USAGE_UPDATE", payload: stats || { date, supabase_queries: 0, request_count: 0 } }));
            break;
          }

          case "ROLE_ADD": {
            const { roleName } = data.payload;
            const currentRolesSetting = db.prepare("SELECT value FROM settings WHERE key = 'custom_roles'").get() as any;
            let roles = [];
            if (currentRolesSetting) {
              roles = JSON.parse(currentRolesSetting.value);
            }
            if (!roles.includes(roleName)) {
              roles.push(roleName);
              const rolesJson = JSON.stringify(roles);
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_roles', ?)").run(rolesJson);
              broadcast({ type: "SETTINGS_UPDATE", payload: { custom_roles: rolesJson } });
            }
            broadcast({ type: "NOTIFICATION", payload: { message: `Cargo ${roleName} criado com sucesso!`, type: 'success' } });
            break;
          }

          case "ROLE_DELETE": {
            const { roleName } = data.payload;
            // Update users to host if they were in this role (or default back to host if deleted)
            db.prepare("UPDATE users SET role = 'host' WHERE role = ?").run(roleName);
            // Remove permissions for this role
            db.prepare("DELETE FROM settings WHERE key = ?").run(`permissions_${roleName}`);
            // Update custom_roles list
            const currentRolesSetting = db.prepare("SELECT value FROM settings WHERE key = 'custom_roles'").get() as any;
            if (currentRolesSetting) {
              let roles = JSON.parse(currentRolesSetting.value);
              roles = roles.filter((r: string) => r !== roleName);
              const rolesJson = JSON.stringify(roles);
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_roles', ?)").run(rolesJson);
              broadcast({ type: "SETTINGS_UPDATE", payload: { custom_roles: rolesJson } });
            }
            const users = db.prepare("SELECT * FROM users").all();
            broadcast({ type: "USERS_SYNC", payload: users });
            
            // Critical change: save to cloud
            scheduleCloudSave();

            broadcast({ type: "NOTIFICATION", payload: { message: `Cargo ${roleName} excluído localmente.`, type: 'success' } });
            break;
          }

          case "ROLE_RENAME": {
            const { oldName, newName } = data.payload;
            // Transfer permissions
            const oldPerms = db.prepare("SELECT value FROM settings WHERE key = ?").get(`permissions_${oldName}`) as any;
            if (oldPerms) {
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(`permissions_${newName}`, oldPerms.value);
              db.prepare("DELETE FROM settings WHERE key = ?").run(`permissions_${oldName}`);
              // Broadcast newly created permissions for the new name
              broadcast({ type: "SETTINGS_UPDATE", payload: { [`permissions_${newName}`]: oldPerms.value } });
            }
            // Update custom_roles list
            const currentRolesSet = db.prepare("SELECT value FROM settings WHERE key = 'custom_roles'").get() as any;
            if (currentRolesSet) {
              let roles = JSON.parse(currentRolesSet.value);
              roles = roles.map((r: string) => r === oldName ? newName : r);
              const rolesJson = JSON.stringify(roles);
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_roles', ?)").run(rolesJson);
              broadcast({ type: "SETTINGS_UPDATE", payload: { custom_roles: rolesJson } });
            }
            // Update users with this role
            db.prepare("UPDATE users SET role = ? WHERE role = ?").run(newName, oldName);
            // Refresh users list for everyone
            broadcast({ type: "USERS_UPDATE", payload: db.prepare("SELECT id, username, role, avatar FROM users").all() });
            
            // Critical change: save to cloud
            scheduleCloudSave();

            broadcast({ type: "NOTIFICATION", payload: { message: `Cargo renomeado de ${oldName} para ${newName}.`, type: 'success' } });
            break;
          }

          case "SAVE_TO_CLOUD": {
            console.log("Manual SAVE to Cloud requested by", clients.get(ws)?.username);
            try {
              await saveToCloud();
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { message: "Dados enviados para a nuvem com sucesso!", type: 'success' } }));
            } catch (err) {
              console.error("Manual save failed:", err);
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { message: "Falha ao enviar dados para a nuvem!", type: 'error' } }));
            }
            break;
          }

          case "SYNC_FIRESTORE": {
            console.log("Manual LOAD from Cloud requested by", clients.get(ws)?.username);
            try {
              // LOAD cloud to local
              await loadFromCloud(hostId);
              
              // Broadcast updates
              const tables = db.prepare("SELECT * FROM tables").all();
              broadcast({ type: "TABLES_SYNC", payload: tables });
              
              const menu = db.prepare("SELECT * FROM menu_items").all();
              broadcast({ type: "MENU_UPDATE", payload: menu });
              
              const history = db.prepare("SELECT * FROM history WHERE deleted = 0 ORDER BY timestamp DESC LIMIT 100").all();
              broadcast({ type: "HISTORY_UPDATE", payload: history });
              
              const categories = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
              broadcast({ type: "CATEGORIES_UPDATE", payload: categories });

              const groups = db.prepare("SELECT * FROM item_groups").all();
              broadcast({ type: "DETAILS_UPDATE", payload: groups });

              const erp = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
              broadcast({ type: "ACCOUNTS_PAYABLE_SYNC", payload: erp });

              const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
              broadcast({ type: "TASKS_SYNC", payload: tasks });

              const users = db.prepare("SELECT id, username, role, avatar FROM users").all();
              broadcast({ type: "USERS_SYNC", payload: users });

              const settings = db.prepare("SELECT * FROM settings").all();
              const settingsObj = settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
              broadcast({ type: "SETTINGS_UPDATE", payload: settingsObj });

              const orders = db.prepare(`
                SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
                FROM orders o 
                JOIN menu_items m ON o.menu_item_id = m.id
              `).all();
              broadcast({ type: "ORDERS_SYNC", payload: orders });

              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { message: "Dados baixados da nuvem com sucesso!", type: 'success' } }));
            } catch (err) {
              console.error("Manual load failed:", err);
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { message: "Falha ao baixar dados da nuvem!", type: 'error' } }));
            }
            break;
          }

          case "FULL_SYNC": {
            const tables = db.prepare("SELECT * FROM tables").all();
            ws.send(JSON.stringify({ type: "TABLES_SYNC", payload: tables }));
            
            const menu = db.prepare("SELECT * FROM menu_items").all();
            ws.send(JSON.stringify({ type: "MENU_UPDATE", payload: menu }));
            
            const history = db.prepare("SELECT * FROM history WHERE deleted = 0 ORDER BY timestamp DESC LIMIT 100").all();
            ws.send(JSON.stringify({ type: "HISTORY_UPDATE", payload: history }));
            
            const categories = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
            ws.send(JSON.stringify({ type: "CATEGORIES_UPDATE", payload: categories }));
            
            const groups = db.prepare(`
              SELECT g.* 
              FROM item_groups g 
              LEFT JOIN categories c ON g.category_name = c.name 
              ORDER BY c.sort_order ASC, g.sort_order ASC
            `).all();
            ws.send(JSON.stringify({ type: "DETAILS_UPDATE", payload: groups }));
            
            const settings = db.prepare("SELECT * FROM settings").all();
            const settingsObj = settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            ws.send(JSON.stringify({ type: "SETTINGS_UPDATE", payload: settingsObj }));

            const transferRequests = db.prepare("SELECT * FROM transfer_requests ORDER BY timestamp DESC").all();
            ws.send(JSON.stringify({ type: "TRANSFER_REQUESTS_SYNC", payload: transferRequests }));

            const orders = db.prepare(`
              SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
              FROM orders o 
              JOIN menu_items m ON o.menu_item_id = m.id
            `).all();
            ws.send(JSON.stringify({ type: "ORDERS_SYNC", payload: orders }));

            const users = db.prepare("SELECT id, username, role, avatar FROM users").all();
            ws.send(JSON.stringify({ type: "USERS_SYNC", payload: users }));
            
            const onlineUsers = Array.from(clients.values())
              .filter(u => u.userId)
              .map(u => ({ userId: u.userId, username: u.username, role: u.role }));
            ws.send(JSON.stringify({ type: "ONLINE_USERS", payload: onlineUsers }));
            
            const activeSession = db.prepare("SELECT * FROM cashier_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get() as any;
            if (activeSession) {
              ws.send(JSON.stringify({ 
                type: "CASHIER_STATUS", 
                payload: { 
                  status: 'open', 
                  sessionId: activeSession.id, 
                  initialBalance: activeSession.initial_balance 
                } 
              }));
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(activeSession.id);
              ws.send(JSON.stringify({ type: "CASHIER_TRANSACTIONS", payload: transactions }));
            } else {
              ws.send(JSON.stringify({ type: "CASHIER_STATUS", payload: { status: 'closed' } }));
            }

            const accountsPayable = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
            ws.send(JSON.stringify({ type: "ACCOUNTS_PAYABLE_SYNC", payload: accountsPayable }));

            const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
            ws.send(JSON.stringify({ type: "TASKS_SYNC", payload: tasks }));
            break;
          }

          case "USER_IDENTIFY": {
            clients.set(ws, { 
              userId: data.payload.userId, 
              username: data.payload.username, 
              role: data.payload.role 
            });
            broadcastOnlineUsers();
            break;
          }

          case "USER_DISCONNECT": {
            const { userId } = data.payload;
            let disconnected = false;
            clients.forEach((info, client) => {
              if (info.userId === userId && info.role !== 'host') {
                client.send(JSON.stringify({ 
                  type: "FORCE_LOGOUT", 
                  payload: { message: "Você foi desconectado pelo administrador." } 
                }));
                setTimeout(() => client.close(), 500);
                disconnected = true;
              }
            });
            if (disconnected) {
              broadcast({ type: "NOTIFICATION", payload: { message: "Usuário desconectado com sucesso", type: 'success' } });
            }
            break;
          }

          case "USER_FORCE_LOGOUT": {
            const { userId } = data.payload;
            clients.forEach((info, client) => {
              if (info.userId === userId) {
                client.send(JSON.stringify({ type: "FORCE_LOGOUT", payload: { message: "Sua sessão foi encerrada pelo administrador." } }));
              }
            });
            break;
          }

          case "HISTORY_GET_ALL": {
            const allHistory = db.prepare("SELECT * FROM history WHERE deleted = 0 ORDER BY timestamp DESC").all();
            ws.send(JSON.stringify({ type: "HISTORY_ALL_DATA", payload: allHistory }));
            break;
          }

          case "CASHIER_OPEN": {
            const { userId, username, initialBalance } = data.payload;
            const id = uuidv4();
            const timestamp = new Date().toISOString();
            db.prepare("INSERT INTO cashier_sessions (id, opened_at, opened_by_id, opened_by_name, initial_balance, status) VALUES (?, ?, ?, ?, ?, ?)")
              .run(id, timestamp, userId, username, initialBalance, 'open');
            
            const pool = getPgPool();
            if (pool) {
                pool.query(`
                  INSERT INTO cashier_sessions (id, opened_at, opened_by_id, opened_by_name, initial_balance, status) 
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [id, timestamp, userId, username, initialBalance, 'open']).catch(e => console.error("Error syncing cashier opening:", e));
            }

            broadcast({ type: "CASHIER_STATUS", payload: { status: 'open', sessionId: id, initialBalance, openedAt: timestamp } });
            broadcast({ type: "CASHIER_TRANSACTIONS", payload: [] });
            
            broadcast({
              type: "PRINT_COMMAND",
              payload: {
                type: 'cashier_open',
                title: 'Abertura de Caixa',
                operator: username,
                data: { 'Saldo Inicial': initialBalance }
              }
            });
            break;
          }

          case "CASHIER_CLOSE": {
            const { userId, username, sessionId, countedBalance, differenceReason } = data.payload;
            const timestamp = new Date().toISOString();

            // Authoritative server-side calculation
            const session = db.prepare("SELECT * FROM cashier_sessions WHERE id = ?").get(sessionId) as any;
            const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0").all(sessionId) as any[];
            
            const totals = transactions.reduce((acc, t) => {
              const amount = Number(t.amount);
              const m = (t.method || t.payment_method || '').toLowerCase();
              const isCash = m.includes('dinheiro') || m.includes('cash');

              switch(t.type) {
                case 'sale': 
                  acc.totalSales += amount;
                  if (isCash) acc.sales += amount; 
                  break;
                case 'refund': 
                  if (isCash) acc.refunds += amount; 
                  break;
                case 'expense': 
                  if (isCash) acc.expenses += amount; 
                  break;
                case 'sangria': acc.sangrias += amount; break;
                case 'reinforcement': acc.reinforcements += amount; break;
              }
              return acc;
            }, { sales: 0, totalSales: 0, refunds: 0, expenses: 0, sangrias: 0, reinforcements: 0 });

            const expectedBalance = (Number(session.initial_balance) || 0) + totals.sales + totals.reinforcements - (totals.sangrias + totals.expenses + totals.refunds);
            const difference = Number(countedBalance) - expectedBalance;

            db.prepare(`
              UPDATE cashier_sessions 
              SET closed_at = ?, closed_by_id = ?, closed_by_name = ?, expected_balance = ?, counted_balance = ?, difference = ?, difference_reason = ?, status = 'closed' 
              WHERE id = ?
            `).run(timestamp, userId, username, expectedBalance, countedBalance, difference, differenceReason || null, sessionId);
            
            // Sync to Supabase
            const pool = getPgPool();
            if (pool) {
                pool.query(`
                  UPDATE cashier_sessions
                  SET status = 'closed', closed_at = $1, closed_by_id = $2, closed_by_name = $3, expected_balance = $4, counted_balance = $5, difference = $6, difference_reason = $7
                  WHERE id = $8
                `, [timestamp, userId, username, expectedBalance, countedBalance, difference, differenceReason || null, sessionId]).catch(e => console.error("Error syncing cashier closing:", e));
            }
            
            broadcast({ type: "CASHIER_STATUS", payload: { status: 'closed' } });

            // Send summary to printer
            const byMethod = transactions.filter(t => t.type === 'sale' || t.type === 'refund').reduce((acc, t) => {
              const m = t.method || 'outros';
              const amt = t.type === 'refund' ? -t.amount : t.amount;
              acc[m] = (acc[m] || 0) + amt;
              return acc;
            }, {} as any);

            broadcast({
              type: "PRINT_COMMAND",
              payload: {
                type: 'cashier_close',
                title: 'Fechamento de Caixa',
                operator: username,
                data: {
                  'Abertura': new Date(session.opened_at).toLocaleString(),
                  'Fechamento': new Date(timestamp).toLocaleString(),
                  'Saldo Inicial': session.initial_balance,
                  'Vendas (Bruto)': totals.totalSales,
                  'Vendas em Dinheiro': totals.sales,
                  'Estornos': totals.refunds,
                  'Reforços': totals.reinforcements,
                  'Sangrias': totals.sangrias,
                  'Despesas': totals.expenses,
                  'Saldo Esperado': expectedBalance,
                  'Saldo Informado': countedBalance,
                  'Diferença': difference,
                  'Entradas por Método': byMethod
                }
              }
            });
            break;
          }

          case "CASHIER_TRANSACTION": {
            const { sessionId, type, amount, description, method, payment_method, userId, username, operator, operator_name } = data.payload;
            const finalMethod = (payment_method || method || 'dinheiro').toLowerCase();
            const finalOperator = operator_name || operator || username || 'Sistema';
            const id = uuidv4();
            const timestamp = new Date().toISOString();
            
            // Save to DB first
            db.prepare("INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .run(id, sessionId, type, amount, description, finalMethod, timestamp, userId, username, userId, finalOperator, 0);
            
            const pool = getPgPool();
            if (pool) {
                pool.query(`
                  INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [id, sessionId, type, amount, description, finalMethod, timestamp, userId, username, userId, finalOperator, 0]).catch(e => console.error("Error syncing cashier transaction:", e));
            }

            const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(sessionId);
            broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });

            if (['expense', 'sangria', 'reinforcement', 'refund'].includes(type)) {
              broadcast({
                type: "PRINT_COMMAND",
                payload: {
                  type: 'cashier_slip',
                  title: type === 'expense' ? 'Comprovante de Despesa' : 
                         type === 'sangria' ? 'Comprovante de Sangria' :
                         type === 'reinforcement' ? 'Comprovante de Reforço' : 'Comprovante de Estorno',
                  operator: finalOperator,
                  data: {
                    'Valor': amount,
                    'Descrição': description,
                    'Método': finalMethod
                  }
                }
              });
            }
            break;
          }

          case "CASHIER_TRANSACTION_DELETE": {
            const { transactionId, userId, username } = data.payload;
            const existingT = db.prepare("SELECT * FROM cashier_transactions WHERE id = ?").get(transactionId) as any;
            
            if (existingT) {
              db.prepare("UPDATE cashier_transactions SET deleted = 1 WHERE id = ?").run(transactionId);
              
              const pool = getPgPool();
              if (pool) {
                  pool.query("UPDATE cashier_transactions SET deleted = 1 WHERE id = $1", [transactionId]).catch(e => console.error("Error syncing transaction delete:", e));
              }

              const sessionId = existingT.session_id;
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(sessionId);
              broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });
              broadcast({ type: "NOTIFICATION", payload: { message: "Transação excluída!", type: 'warning' } });
              
              await logHistory(userId, username, "CASHIER_TRANSACTION_DELETE", `Excluiu transação: ${existingT.type} de R$${existingT.amount}`);
            }
            break;
          }

          case "CASHIER_TRANSACTION_UPDATE": {
            const { transactionId, id, method, payment_method, amount, description, reason, userId, username, operator_name } = data.payload;
            const targetId = transactionId || id;
            const targetMethod = (method || payment_method || 'dinheiro').toLowerCase();
            const existingT = db.prepare("SELECT * FROM cashier_transactions WHERE id = ?").get(targetId) as any;
            
            if (existingT) {
              db.prepare("UPDATE cashier_transactions SET method = ?, amount = ?, description = ? WHERE id = ?")
                .run(targetMethod, amount, description || existingT.description, targetId);

              // Automatic Firestore sync removed.

              const sessionId = existingT.session_id;
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(sessionId);
              broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });
              broadcast({ type: "NOTIFICATION", payload: { message: "Transação atualizada!", type: 'success' } });
              
              const operatorInfo = operator_name || username || 'Sistema';
              await logHistory(userId, username, "CASHIER_EDIT", `Transação editada (${existingT.type}): R$${existingT.amount}->R$${amount}, método ${existingT.method}->${targetMethod}. Motivo: ${reason || 'Não informado'} (Por: ${operatorInfo})`);
            }
            break;
          }

          case "ACCOUNTS_PAYABLE_ADD": {
            const { description, amount, dueDate, category } = data.payload;
            const id = uuidv4();
            const timestamp = new Date().toISOString();
            db.prepare("INSERT INTO accounts_payable (id, description, amount, due_date, status, category, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .run(id, description, amount, dueDate, 'pending', category, timestamp);
            
            const accountsPayable = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
            broadcast({ type: "ACCOUNTS_PAYABLE_SYNC", payload: accountsPayable });
            break;
          }

          case "ACCOUNTS_PAYABLE_DELETE": {
            const { id } = data.payload;
            db.prepare("DELETE FROM accounts_payable WHERE id = ?").run(id);
            const accountsPayable = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
            broadcast({ type: "ACCOUNTS_PAYABLE_SYNC", payload: accountsPayable });
            break;
          }

          case "ACCOUNTS_PAYABLE_PAY": {
            const { id, sessionId, userId, username } = data.payload;
            const account = db.prepare("SELECT * FROM accounts_payable WHERE id = ?").get(id) as any;
            if (account) {
              db.prepare("UPDATE accounts_payable SET status = 'paid' WHERE id = ?").run(id);
              
              // Record transaction in cashier if sessionId provided
              if (sessionId) {
                const txId = uuidv4();
                const ts = new Date().toISOString();
                db.prepare("INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                  .run(txId, sessionId, 'expense', account.amount, `Pagamento: ${account.description}`, 'dinheiro', ts, userId, username, userId, username, 0);
                
                const pool = getPgPool();
                if (pool) {
                  pool.query(`
                    INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  `, [txId, sessionId, 'expense', account.amount, `Pagamento: ${account.description}`, 'dinheiro', ts, userId, username, userId, username, 0]).catch(e => console.error("Error syncing payable payment:", e));
                }

                const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(sessionId);
                broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });
              }

              const accountsPayable = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
              broadcast({ type: "ACCOUNTS_PAYABLE_SYNC", payload: accountsPayable });
            }
            break;
          }

          case "TASK_ADD": {
            const { title, description, assignedTo, userId, username } = data.payload;
            const id = uuidv4();
            const timestamp = new Date().toISOString();
            db.prepare("INSERT INTO tasks (id, title, description, assigned_to, created_by, created_by_name, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
              .run(id, title, description, JSON.stringify(assignedTo), userId, username, 'pending', timestamp);
            
            const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
            broadcast({ type: "TASKS_SYNC", payload: tasks });
            break;
          }

          case "TASK_UPDATE": {
            const { id, status } = data.payload;
            db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
            const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
            broadcast({ type: "TASKS_SYNC", payload: tasks });
            break;
          }

          case "TASK_DELETE": {
            const { id } = data.payload;
            db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
            const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
            broadcast({ type: "TASKS_SYNC", payload: tasks });
            break;
          }

          case "SETTINGS_UPDATE":
            let tokenChanged = false;
            for (const [key, value] of Object.entries(data.payload)) {
              if (key === 'access_token') {
                const currentToken = db.prepare("SELECT value FROM settings WHERE key = 'access_token'").get() as { value: string } | undefined;
                if (!currentToken || currentToken.value !== String(value)) tokenChanged = true;
              }
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));
            }
            
            // Critical change: save to cloud
            scheduleCloudSave();

            const updatedSettings = db.prepare("SELECT * FROM settings").all();
            const updatedSettingsObj = updatedSettings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            broadcast({ type: "SETTINGS_UPDATE", payload: updatedSettingsObj });
            
            if (tokenChanged) {
              const logoutMsg = JSON.stringify({ type: "FORCE_LOGOUT", payload: { message: "Token de acesso alterado. Por favor, faça login novamente." } });
              clients.forEach((info, client) => {
                if (info.role !== 'host' && client.readyState === WebSocket.OPEN) {
                  client.send(logoutMsg);
                  setTimeout(() => client.close(), 500);
                }
              });
            }
            break;

          case "TABLE_OPEN": {
            const tableId = Number(data.payload.tableId);
            const tableType = data.payload.tableType || 'salao';
            console.log(`[Server] TABLE_OPEN received for table ${tableId} type ${tableType}`);

            // Get table type name from settings
            const settingsTableTypes = db.prepare("SELECT value FROM settings WHERE key = 'table_types'").get() as { value: string } | undefined;
            const tableTypes = JSON.parse(settingsTableTypes?.value || '[{"id":"salao","name":"Salão","color":"#10b981"},{"id":"gramado","name":"Gramado","color":"#3b82f6"}]');
            const currentType = tableTypes.find((t: any) => t.id === tableType) || { name: tableType === 'salao' ? 'Salão' : 'Gramado' };
            
            // Ensure no old orders exist for this table in SQLite
            db.prepare("DELETE FROM orders WHERE table_id = ?").run(tableId);
            
            // Automatic Firestore sync removed.
            
            const openedAt = new Date().toISOString();
            db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ?, type = ? WHERE id = ?")
              .run(data.payload.customerName, data.payload.peopleCount, openedAt, tableType, tableId);
            
            // Automatic Firestore sync removed.

            const updatedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
            broadcast({ type: "TABLE_UPDATE", payload: updatedTable });

            // --- SALVAMENTO IMEDIATO NO SUPABASE ---
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  const pgClient = await pool.connect();
                  try {
                    await pgClient.query(`
                      UPDATE tables SET status = $1, customer_name = $2, people_count = $3, opened_at = $4, type = $5 WHERE id = $6
                    `, [updatedTable.status, updatedTable.customer_name, updatedTable.people_count, updatedTable.opened_at, updatedTable.type, updatedTable.id]);
                  } finally { pgClient.release(); }
                }
              } catch (e) { console.error("Immediate Supabase Save Error (TABLE_OPEN):", e); }
            })();

            broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${formatTableNumber(tableId)} (${currentType.name}) aberta`, type: 'info' } });
            
            await logHistory(data.payload.userId, data.payload.username, "ABRIR_MESA", `(${currentType.name}) aberta para ${data.payload.customerName || 'N/A'}`, null, null, tableId);
            break;
          }

          case "TABLE_UPDATE_DATA":
            db.prepare("UPDATE tables SET customer_name = ?, people_count = ?, type = ? WHERE id = ?")
              .run(data.payload.customerName, data.payload.peopleCount, data.payload.tableType || 'salao', data.payload.tableId);
            // Automatic Firestore sync removed.
            const updatedTableData = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: updatedTableData });

            // Salva edição da mesa no Supabase imediatamente
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  const pgClient = await pool.connect();
                  try {
                    await pgClient.query(`
                      UPDATE tables SET customer_name = $1, people_count = $2, type = $3 WHERE id = $4
                    `, [data.payload.customerName, data.payload.peopleCount, data.payload.tableType || 'salao', data.payload.tableId]);
                  } finally {
                    pgClient.release();
                  }
                }
              } catch (e) {
                console.error('[Supabase] Falha ao salvar edição de mesa:', e);
              }
            })();

            break;

          case "TABLE_REQUEST_BILL":
            db.prepare("UPDATE tables SET status = 'bill_requested' WHERE id = ?").run(data.payload.tableId);
            
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  await pool.query("UPDATE tables SET status = 'bill_requested' WHERE id = $1", [data.payload.tableId]);
                }
              } catch (e) { console.error("Immediate Supabase Save Error (TABLE_REQUEST_BILL):", e); }
            })();

            const tableWithBill = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: tableWithBill });
            broadcast({ type: "BILL_REQUEST", payload: { tableId: data.payload.tableId, customerName: tableWithBill.customer_name } });
            broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${formatTableNumber(data.payload.tableId)} pediu a conta!`, type: 'warning' } });
            await logHistory(data.payload.userId, data.payload.username, "PEDIR_CONTA", `Solicitou fechamento`, null, null, data.payload.tableId);

            // Print bill command
            const billTableOrders = db.prepare(`
              SELECT o.*, m.name as item_name, m.price as item_price 
              FROM orders o
              JOIN menu_items m ON o.menu_item_id = m.id
              WHERE o.table_id = ?
            `).all(data.payload.tableId);
            broadcast({
              type: "PRINT_COMMAND",
              payload: {
                type: 'table_bill',
                table: tableWithBill,
                orders: billTableOrders,
                operator: data.payload.username || 'Sistema',
                serviceFeePercentage: tableWithBill.number === -1 || tableWithBill.type === 'balcao' ? 0 : 10
              }
            });
            break;

          case "TABLE_CLOSE": {
            const { tableId, userId, username, paymentMethods, paymentDetails, total, operator, operator_name } = data.payload;
            const finalOperator = operator_name || operator || username || 'Sistema';
            const tableNum = Number(tableId);

            // Get customer name and orders before clearing
            // Note: Balcão is -1 explicitly. Provide fallback for receipt naming.
            let customerName = '';
            let tableData: any = null;
            let receiptOrders: any[] = [];
            
            if (tableNum === -1) {
              // Balcao logic
              customerName = data.payload.customerName || 'Balcão';
              tableData = { number: -1, customer_name: customerName, type: 'balcao' };
              receiptOrders = db.prepare(`
                 SELECT o.*, m.name as item_name, m.price as item_price 
                 FROM orders o
                 JOIN menu_items m ON o.menu_item_id = m.id
                 WHERE o.table_id = ?
              `).all(tableNum);
            } else {
              tableData = db.prepare("SELECT customer_name, number FROM tables WHERE id = ?").get(tableNum) as any;
              customerName = tableData?.customer_name || '';
              receiptOrders = db.prepare(`
                 SELECT o.*, m.name as item_name, m.price as item_price 
                 FROM orders o
                 JOIN menu_items m ON o.menu_item_id = m.id
                 WHERE o.table_id = ?
              `).all(tableNum);
            }

            // Record transaction if cashier is open
            const activeSession = db.prepare("SELECT id FROM cashier_sessions WHERE status = 'open'").get() as { id: string } | undefined;
            if (activeSession && total > 0) {
              const methods = paymentMethods || [];
              const pool = getPgPool();
              
              methods.forEach(async (method: string) => {
                const amount = paymentDetails ? paymentDetails[method] : (total / methods.length);
                const description = customerName ? `Venda ${tableNum === -1 ? 'Balcão' : 'Mesa ' + (tableData?.number || tableNum)} (${customerName})` : `Venda ${tableNum === -1 ? 'Balcão' : 'Mesa ' + (tableData?.number || tableNum)}`;
                const txId = uuidv4();
                const ts = new Date().toISOString();
                
                db.prepare(`
                  INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(txId, activeSession.id, 'sale', amount, description, method.toLowerCase(), ts, userId, username, userId, finalOperator, 0);

                if (pool) {
                  pool.query(`
                    INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  `, [txId, activeSession.id, 'sale', amount, description, method.toLowerCase(), ts, userId, username, userId, finalOperator, 0]).catch(e => console.error("Error syncing table close sale:", e));
                }
              });
            }

            if (tableNum !== -1) {
              // Clear table in SQLite
              db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL WHERE id = ?")
                .run(tableNum);
              
              // Automatic Firestore sync removed.

              const closedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableNum);
              broadcast({ type: "TABLE_UPDATE", payload: closedTable });
              broadcast({ type: "TABLES_SYNC", payload: db.prepare("SELECT * FROM tables").all() });
            }
            
            // Broadcast table close unconditionally so that Orders from -1 are deleted in the UI
            broadcast({ type: "TABLE_CLOSE", payload: { tableId: tableNum, paymentMethods: paymentMethods } });

            // --- SALVAMENTO IMEDIATO NO SUPABASE ---
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  const pgClient = await pool.connect();
                  try {
                    if (tableNum !== -1) {
                      const tNumber = tableData?.number || tableNum;
                      await pgClient.query(`
                        UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL WHERE id = $1 OR number = $2
                      `, [tableNum, tNumber]);
                    }
                    // Delete orders for this table in PG (including by number matching ID)
                    const tNumberForOrders = tableData?.number || tableNum;
                    await pgClient.query(`DELETE FROM orders WHERE table_id = $1 OR table_id IN (SELECT id FROM tables WHERE number = $2)`, [tableNum, tNumberForOrders]);
                  } finally { pgClient.release(); }
                }
              } catch (e) { console.error("Immediate Supabase Save Error (TABLE_CLOSE):", e); }
            })();

            // Clear orders for this table in SQLite (including -1)
            db.prepare("DELETE FROM orders WHERE table_id = ?").run(tableNum);
            
            // Automatic Firestore sync removed.
            // Critical: save to cloud after closure to ensure it persists in Supabase
            scheduleCloudSave();
            
            // Broadcast menu update if stock might have changed

            // Print Receipt command broadcast
            if (receiptOrders && receiptOrders.length > 0) {
              broadcast({
                type: "PRINT_COMMAND",
                payload: {
                  type: tableNum === -1 ? 'table_bill' : 'table_close', // Reuse table_bill style for explicit print passing
                  title: 'CUPOM NÃO FISCAL',
                  table: tableData,
                  orders: receiptOrders,
                  operator: finalOperator,
                  serviceFeePercentage: tableNum === -1 ? 0 : 10,
                  customServiceFee: data.payload.serviceFee,
                  discount: data.payload.discount,
                  paymentMethods: paymentMethods
                }
              });
            }

            if (activeSession) {
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(activeSession.id);
              broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });
            }

            broadcast({ type: "NOTIFICATION", payload: { message: `${tableNum === -1 ? 'Balcão' : 'Mesa ' + formatTableNumber(tableData?.number || tableNum)} fechada. Total: R$ ${total?.toFixed(2) || '0.00'}`, type: 'success' } });
            await logHistory(userId, username, "FECHAR_MESA", `Fechada. Total: R$ ${total?.toFixed(2) || '0.00'}. Métodos: ${paymentMethods?.join(', ')}`, null, null, tableNum);
            break;
          }

          case "BALCAO_DIRECT_SALE": {
            const { 
              items, 
              userId, 
              username, 
              operator,
              operator_name,
              paymentMethods, 
              paymentDetails, 
              total,
              subtotal,
              discount,
              serviceFee 
            } = data.payload;
            const finalOperator = operator_name || operator || username || 'Sistema';

            // 1. Log History
            for (const item of items) {
                const obsText = item.observation ? ` (Obs: ${item.observation})` : '';
                await logHistory(
                    userId,
                    username,
                    "NOVO_PEDIDO",
                    `${item.quantity}x ${item.item_name || item.name}${obsText}`,
                    null,
                    null,
                    -1
                );
            }

            await logHistory(
                userId, 
                username, 
                "FECHAR_MESA", 
                `Venda Balcão Finalizada. Total: R$ ${total?.toFixed(2)}. Métodos: ${paymentMethods?.join(', ')}`, 
                null, 
                null, 
                -1
            );

            // 2. Record Transactions
            const activeSession = db.prepare("SELECT id FROM cashier_sessions WHERE status = 'open'").get() as { id: string } | undefined;
            if (activeSession && total > 0) {
              const methods = paymentMethods || [];
              const pool = getPgPool();
              
              methods.forEach(async (method: string) => {
                const amount = paymentDetails ? paymentDetails[method] : (total / methods.length);
                const description = `Venda Balcão (Direta)`;
                const txId = uuidv4();
                const ts = new Date().toISOString();
                
                db.prepare(`
                  INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(txId, activeSession.id, 'sale', amount, description, method.toLowerCase(), ts, userId, username, userId, finalOperator, 0);

                if (pool) {
                  pool.query(`
                    INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username, operator_id, operator_name, deleted)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  `, [txId, activeSession.id, 'sale', amount, description, method.toLowerCase(), ts, userId, username, userId, finalOperator, 0]).catch(e => console.error("Error syncing direct balcao sale:", e));
                }
              });
            }

            // 3. Print Kitchen
            const itemsToPrint = items.filter((i: any) => i.print_enabled !== 0 && i.print_enabled !== false);
            if (itemsToPrint.length > 0) {
                broadcast({
                    type: "PRINT_COMMAND",
                    payload: {
                        type: 'order_kitchen',
                        tableNumber: -1,
                        operator: finalOperator,
                        items: itemsToPrint.map((i: any) => ({
                            quantity: i.quantity,
                            name: i.item_name || i.name,
                            observation: i.observation,
                            group: i.category || i.group,
                            customerName: 'Balcão'
                        }))
                    }
                });
            }

            // 4. Print Receipt
            broadcast({
                type: "PRINT_COMMAND",
                payload: {
                    type: 'table_bill', 
                    title: 'CUPOM NÃO FISCAL',
                    table: { number: -1, customer_name: 'Balcão' },
                    orders: items.map((i: any) => ({
                        item_name: i.item_name || i.name,
                        item_price: i.item_price || i.price,
                        quantity: i.quantity,
                        observation: i.observation
                    })),
                    operator: username,
                    serviceFeePercentage: 0,
                    discount: discount || 0,
                    total: total,
                    paymentMethods: paymentMethods
                }
            });

            // 5. Deduct Stock
            items.forEach((item: any) => {
                const menuItemId = item.menuItemId || item.id;
                const dbItem = db.prepare("SELECT id, is_stockable, current_stock FROM menu_items WHERE id = ?").get(menuItemId) as any;
                if (dbItem && dbItem.is_stockable) {
                  const newStock = Math.max(0, (dbItem.current_stock || 0) - item.quantity);
                  db.prepare("UPDATE menu_items SET current_stock = ? WHERE id = ?").run(newStock, menuItemId);
                  // Automatic Firestore sync removed.
                }
            });

            // 6. Syncs
            if (activeSession) {
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? AND deleted = 0 ORDER BY timestamp DESC").all(activeSession.id);
              broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });
            }
            
            broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            broadcast({ type: "NOTIFICATION", payload: { message: `Venda Balcão finalizada! R$ ${total?.toFixed(2)}`, type: 'success' } });
            broadcast({ type: "BALCAO_DIRECT_SALE_SUCCESS", payload: { userId } });

            break;
          }

          case "TABLE_ADD_PERMANENT": {
            const { number, type } = data.payload;
            try {
              db.prepare("INSERT INTO tables (number, type, status) VALUES (?, ?, 'free')").run(number, type);
              const tables = db.prepare("SELECT * FROM tables").all();
              broadcast({ type: "TABLES_SYNC", payload: tables });
              broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${number} criada com sucesso!`, type: 'success' } });
            } catch (e: any) {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { message: "Erro ao criar mesa: Número já existe", type: 'error' } }));
            }
            break;
          }

          case "TABLE_EDIT_PERMANENT": {
            const { tableId, number, type } = data.payload;
            try {
              db.prepare("UPDATE tables SET number = ?, type = ? WHERE id = ?").run(number, type, tableId);
              const tables = db.prepare("SELECT * FROM tables").all();
              broadcast({ type: "TABLES_SYNC", payload: tables });
              broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${number} atualizada!`, type: 'success' } });
            } catch (e: any) {
              ws.send(JSON.stringify({ type: "NOTIFICATION", payload: { message: "Erro ao editar mesa", type: 'error' } }));
            }
            break;
          }

          case "TABLE_DELETE_PERMANENT": {
            const { tableId } = data.payload;
            db.prepare("DELETE FROM tables WHERE id = ?").run(Number(tableId));
            
            // Automatic Firestore sync removed.

            const tables = db.prepare("SELECT * FROM tables").all();
            broadcast({ type: "TABLES_SYNC", payload: tables });
            broadcast({ type: "NOTIFICATION", payload: { message: "Mesa excluída permanentemente", type: 'success' } });
            break;
          }

          case "TABLES_RESET_ALL": {
            const { userId, username } = data.payload;
            db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL").run();
            db.prepare("DELETE FROM orders").run();
            
            // Sync to Postgres immediately
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  const pgClient = await pool.connect();
                  try {
                    await pgClient.query("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL");
                    await pgClient.query("DELETE FROM orders");
                  } finally { pgClient.release(); }
                }
              } catch (e) { console.error("Immediate Supabase Save Error (TABLES_RESET_ALL):", e); }
            })();

            broadcast({ type: "TABLES_SYNC", payload: db.prepare("SELECT * FROM tables").all() });
            broadcast({ type: "ORDERS_SYNC", payload: [] });
            broadcast({ type: "NOTIFICATION", payload: { message: "Todas as mesas foram resetadas!", type: 'warning' } });
            
            await logHistory(userId, username, "RESET_MESAS", "Todas as mesas foram resetadas e pedidos excluídos");
            break;
          }

          case "ORDER_SEND": {
            const tableId = Number(data.payload.tableId);
            // Check if table is in bill_requested status and revert to open
            if (tableId !== -1) {
              const currentTableStatus = db.prepare("SELECT status FROM tables WHERE id = ?").get(tableId) as any;
              if (currentTableStatus && currentTableStatus.status === 'bill_requested') {
                db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(tableId);
                
                (async () => {
                  try {
                    const pool = getPgPool();
                    if (pool) {
                      await pool.query("UPDATE tables SET status = 'open' WHERE id = $1", [tableId]);
                    }
                  } catch (e) { console.error("Immediate Supabase Save Error (ORDER_SEND_OPEN):", e); }
                })();

                const updatedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
                broadcast({ type: "TABLE_UPDATE", payload: updatedTable });
              }
            }

            const newOrders: any[] = [];
            const historyItems: string[] = [];

            for (const item of data.payload.items) {
              const orderId = uuidv4();
              const timestamp = new Date().toISOString();
              
              db.prepare("INSERT INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .run(orderId, tableId, item.menuItemId, item.quantity, 'pending', 0, item.observation || null, timestamp);
              
              const menuItem = db.prepare("SELECT name, price, type, category, is_stockable, current_stock FROM menu_items WHERE id = ?").get(item.menuItemId) as any;
              
              if (!menuItem) {
                console.error(`Menu item not found: ${item.menuItemId}`);
                continue;
              }

              if (menuItem.is_stockable) {
                const newStock = Math.max(0, (menuItem.current_stock || 0) - item.quantity);
                db.prepare("UPDATE menu_items SET current_stock = ? WHERE id = ?").run(newStock, item.menuItemId);
              }

              const orderData = {
                table_id: tableId,
                menu_item_id: item.menuItemId,
                quantity: item.quantity,
                status: 'pending',
                is_read: 0,
                observation: item.observation || null,
                timestamp: timestamp,
                item_name: menuItem.name,
                item_price: menuItem.price,
                category: menuItem.type,
                group: menuItem.category
              };

              // Automatic Firestore sync removed.

              newOrders.push({
                id: orderId,
                ...orderData
              });

              const obsText = item.observation ? ` (Obs: ${item.observation})` : '';
              const group = db.prepare("SELECT * FROM item_groups WHERE name = ?").get(menuItem.category) as any;
              const groupText = (menuItem.category && (!group || group.show_in_history !== 0)) ? `-(${menuItem.category})` : '';
              await logHistory(
                data.payload.userId,
                data.payload.username,
                "NOVO_PEDIDO",
                `${item.quantity}x ${menuItem.name}${obsText}${groupText}`,
                orderId,
                (!group || group.show_in_history !== 0) ? menuItem.category : null,
                tableId
              );
            }

            // Automatic Firestore sync removed.
            
            broadcast({ type: "ORDER_NEW", payload: newOrders });
            broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });

            // --- SALVAMENTO IMEDIATO NO SUPABASE ---
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  const pgClient = await pool.connect();
                  try {
                    for (const o of newOrders) {
                      await pgClient.query(`
                        INSERT INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (id) DO NOTHING
                      `, [o.id, o.table_id, o.menu_item_id, o.quantity, o.status, o.is_read, o.observation, o.timestamp]);
                    }
                  } finally { pgClient.release(); }
                }
              } catch (e) { console.error("Immediate Supabase Save Error (ORDER_SEND):", e); }
            })();

            if (tableId === -1) {
              broadcast({ type: "NOTIFICATION", payload: { message: `Novo pedido no Balcão!`, type: 'info' } });
            } else {
              broadcast({ type: "NOTIFICATION", payload: { message: `Novo pedido para a Mesa ${formatTableNumber(tableId)}`, type: 'info' } });
            }

            // Automatic kitchen printing
            const itemsToPrint = newOrders.map(o => {
              const itemInfo = db.prepare("SELECT name, print_enabled FROM menu_items WHERE id = ?").get(o.menu_item_id) as any;
              return { ...o, name: itemInfo?.name, print_enabled: itemInfo?.print_enabled };
            }).filter(i => i.print_enabled !== 0 && i.print_enabled !== false);

            if (itemsToPrint.length > 0) {
              let tableData;
              if (tableId === -1) {
                tableData = { number: -1, customer_name: 'Avulso' };
              } else {
                tableData = db.prepare("SELECT number, customer_name FROM tables WHERE id = ?").get(tableId) as any;
              }
              broadcast({
                type: "PRINT_COMMAND",
                payload: {
                  type: 'order_kitchen',
                  tableNumber: tableId === -1 ? -1 : formatTableNumber(tableData.number),
                  operator: data.payload.username || 'Sistema',
                  items: itemsToPrint.map(i => {
                    const group = db.prepare("SELECT * FROM item_groups WHERE name = ?").get(i.group) as any;
                    return {
                      ...i,
                      group: (i.group && (!group || group.show_in_history !== 0)) ? i.group : undefined,
                      customerName: tableData.customer_name
                    };
                  })
                }
              });
            }
            
            // For Balcao, tell the UI to immediate redirect to checkout if we sent orders
            if (tableId === -1) {
              broadcast({
                type: "BALCAO_CHECKOUT_TRIGGER",
                payload: {
                   orders: newOrders,
                   username: data.payload.username,
                   userId: data.payload.userId
                }
              });
            }
            break;
          }

          case "ORDER_DELETE":
            const orderToDelete = db.prepare(`
              SELECT o.*, m.name as item_name, m.type as category, m.category as "group", m.print_enabled
              FROM orders o 
              JOIN menu_items m ON o.menu_item_id = m.id 
              WHERE o.id = ?
            `).get(data.payload.orderId) as any;
            if (orderToDelete) {
              db.prepare("DELETE FROM orders WHERE id = ?").run(data.payload.orderId);
              
              const menuItemFull = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(orderToDelete.menu_item_id) as any;
              if (menuItemFull && menuItemFull.is_stockable && orderToDelete.quantity) {
                const updatedStock = (menuItemFull.current_stock || 0) + orderToDelete.quantity;
                db.prepare("UPDATE menu_items SET current_stock = ? WHERE id = ?").run(updatedStock, orderToDelete.menu_item_id);
                broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
              }

              // Automatic Firestore sync removed.
              
              const obsText = orderToDelete.observation ? ` (Obs: ${orderToDelete.observation})` : '';
              const group = db.prepare("SELECT * FROM item_groups WHERE name = ?").get(orderToDelete.group) as any;
              const groupText = (orderToDelete.group && (!group || group.show_in_history !== 0)) ? `-(${orderToDelete.group})` : '';
              await logHistory(
                data.payload.userId,
                data.payload.username,
                "EXCLUIR_PEDIDO",
                `${orderToDelete.quantity}x ${orderToDelete.item_name}${obsText}${groupText} excluído`,
                data.payload.orderId,
                (!group || group.show_in_history !== 0) ? orderToDelete.group : null,
                orderToDelete.table_id
              );

              // Print cancellation slip if enabled
              if (orderToDelete.print_enabled !== 0 && orderToDelete.print_enabled !== false) {
                const table = db.prepare("SELECT number FROM tables WHERE id = ?").get(orderToDelete.table_id) as any;
                broadcast({
                  type: "PRINT_COMMAND",
                  payload: {
                    type: 'order_kitchen',
                    title: 'CANCELAMENTO DE PEDIDO',
                    tableNumber: formatTableNumber(table.number),
                    operator: data.payload.username || 'Sistema',
                    items: [{ ...orderToDelete, name: orderToDelete.item_name }]
                  }
                });
              }

              broadcast({ type: "ORDER_DELETED", payload: { orderId: data.payload.orderId, tableId: orderToDelete.table_id } });
              broadcast({ type: "NOTIFICATION", payload: { message: `Pedido excluído da Mesa ${formatTableNumber(orderToDelete.table_id)}`, type: 'warning' } }, ws);
            }
            break;

          case "HISTORY_MARK_READ":
            const historyEvent = db.prepare("SELECT is_read FROM history WHERE id = ? AND deleted = 0").get(data.payload.historyId) as any;
            if (historyEvent) {
              const newHistoryStatus = historyEvent.is_read === 1 ? 0 : 1;
              db.prepare("UPDATE history SET is_read = ? WHERE id = ?").run(newHistoryStatus, data.payload.historyId);
              const updatedHistoryList = db.prepare("SELECT * FROM history WHERE deleted = 0 ORDER BY timestamp DESC LIMIT 100").all();
              broadcast({ type: "HISTORY_UPDATE", payload: updatedHistoryList });
            }
            break;

          case "HISTORY_DELETE":
            const historyItem = db.prepare("SELECT id FROM history WHERE id = ? AND deleted = 0").get(data.payload.historyId) as any;
            if (historyItem) {
              db.prepare("UPDATE history SET deleted = 1 WHERE id = ?").run(data.payload.historyId);
              
              const pool = getPgPool();
              if (pool) {
                pool.query("UPDATE history SET deleted = 1 WHERE id = $1", [data.payload.historyId]).catch(e => console.error("Error deleting history from Supabase:", e));
              }

              const updatedHistoryList = db.prepare("SELECT * FROM history WHERE deleted = 0 ORDER BY timestamp DESC LIMIT 100").all();
              broadcast({ type: "HISTORY_UPDATE", payload: updatedHistoryList });
              broadcast({ type: "NOTIFICATION", payload: { message: "Item do histórico excluído com sucesso", type: "success" } }, ws);
            }
            break;

          case "HISTORY_CLEAR":
            db.prepare("UPDATE history SET deleted = 1").run();
            // Also clear from Supabase
            const pgPoolClear = getPgPool();
            if (pgPoolClear) {
              pgPoolClear.query("UPDATE history SET deleted = 1").catch(e => console.error("Error clearing history from Supabase:", e));
            }
            broadcast({ type: "HISTORY_UPDATE", payload: [] });
            broadcast({ type: "NOTIFICATION", payload: { message: "Histórico limpo com sucesso!", type: "success" } }, ws);
            break;

          case "ORDER_MARK_READ":
            const currentOrder = db.prepare("SELECT is_read FROM orders WHERE id = ?").get(data.payload.orderId) as any;
            if (currentOrder) {
              const newStatus = currentOrder.is_read === 1 ? 0 : 1;
              db.prepare("UPDATE orders SET is_read = ? WHERE id = ?").run(newStatus, data.payload.orderId);
              // Automatic Firestore sync removed.
              
              const updatedOrder = db.prepare(`
                SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
                FROM orders o 
                JOIN menu_items m ON o.menu_item_id = m.id 
                WHERE o.id = ?
              `).get(data.payload.orderId);
              broadcast({ type: "ORDER_UPDATE", payload: updatedOrder });
            }
            break;

          case "TABLE_TRANSFER": {
            const { fromTableId, toTableId, orderIds, userId, username, targetType } = data.payload;
            
            // Ensure destination table is open
            const toTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(toTableId);
            const fromTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(fromTableId);
            
            if (toTable.status === 'free') {
              const openedAt = new Date().toISOString();
              const finalType = targetType || fromTable.type || 'salao';
              db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ?, type = ? WHERE id = ?")
                .run(fromTable.customer_name, fromTable.people_count, openedAt, finalType, toTableId);
              
              (async () => {
                try {
                  const pool = getPgPool();
                  if (pool) {
                    await pool.query("UPDATE tables SET status = 'open', customer_name = $1, people_count = $2, opened_at = $3, type = $4 WHERE id = $5", [fromTable.customer_name, fromTable.people_count, openedAt, finalType, toTableId]);
                  }
                } catch (e) { console.error("Immediate PG Error (TABLE_TRANSFER_OPEN):", e); }
              })();
            }

            for (const orderId of orderIds) {
              db.prepare("UPDATE orders SET table_id = ? WHERE id = ?").run(toTableId, orderId);
            }
            
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  for (const orderId of orderIds) {
                    await pool.query("UPDATE orders SET table_id = $1 WHERE id = $2", [toTableId, orderId]);
                  }
                }
              } catch (e) { console.error("Immediate PG Error (TABLE_TRANSFER_ORDERS):", e); }
            })();

            // Check if fromTable is now empty
            const remainingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ?").get(fromTableId);
            if (remainingOrders.count === 0) {
              db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL, type = 'salao' WHERE id = ?").run(fromTableId);
              
              (async () => {
                try {
                  const pool = getPgPool();
                  if (pool) {
                    await pool.query("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL, type = 'salao' WHERE id = $1", [fromTableId]);
                  }
                } catch (e) { console.error("Immediate PG Error (TABLE_TRANSFER_FREE):", e); }
              })();
            }

            broadcast({ type: "TABLES_SYNC", payload: db.prepare("SELECT * FROM tables").all() });
            broadcast({ type: "ORDERS_SYNC", payload: db.prepare(`
              SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
              FROM orders o 
              JOIN menu_items m ON o.menu_item_id = m.id
            `).all() });
            broadcast({ type: "NOTIFICATION", payload: { message: `Itens transferidos da Mesa ${formatTableNumber(fromTableId)} para a Mesa ${formatTableNumber(toTableId)}`, type: 'success' } });
            await logHistory(userId, username, "TRANSFERIR_MESA", `Transferência de itens para a Mesa ${formatTableNumber(toTableId)}`, null, null, fromTableId);
            break;
          }

          case "TABLE_TRANSFER_REQUEST": {
            const requestId = uuidv4();
            const { fromTableId, toTableId, orderIds, userId, username, targetType } = data.payload;
            db.prepare("INSERT INTO transfer_requests (id, from_table_id, to_table_id, order_ids, user_id, username, target_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
              .run(requestId, fromTableId, toTableId, JSON.stringify(orderIds), userId, username, targetType || 'salao', new Date().toISOString());
            
            broadcast({ type: "NOTIFICATION", payload: { message: `Solicitação de transferência da Mesa ${formatTableNumber(fromTableId)} para a Mesa ${formatTableNumber(toTableId)}`, type: 'warning' } });
            broadcast({ type: "TRANSFER_REQUESTS_SYNC", payload: db.prepare("SELECT * FROM transfer_requests ORDER BY timestamp DESC").all() });
            await logHistory(userId, username, "SOLICITAR_TRANSFERENCIA", `Solicitou transferência para a Mesa ${formatTableNumber(toTableId)}`, null, null, fromTableId, requestId);
            break;
          }

          case "TABLE_TRANSFER_APPROVE": {
            const { requestId, userId, username } = data.payload;
            const request = db.prepare("SELECT * FROM transfer_requests WHERE id = ?").get(requestId);
            if (!request) break;

            const orderIds = JSON.parse(request.order_ids);
            
            const toTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(request.to_table_id);
            const fromTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(request.from_table_id);
            
            if (toTable.status === 'free') {
              const openedAt = new Date().toISOString();
              const finalType = request.target_type || fromTable.type || 'salao';
              db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ?, type = ? WHERE id = ?")
                .run(fromTable.customer_name, fromTable.people_count, openedAt, finalType, request.to_table_id);
              
              (async () => {
                try {
                  const pool = getPgPool();
                  if (pool) {
                    await pool.query("UPDATE tables SET status = 'open', customer_name = $1, people_count = $2, opened_at = $3, type = $4 WHERE id = $5", [fromTable.customer_name, fromTable.people_count, openedAt, finalType, request.to_table_id]);
                  }
                } catch (e) { console.error("Immediate PG Error (TABLE_TRANSFER_APPROVE_OPEN):", e); }
              })();
            }

            for (const orderId of orderIds) {
              db.prepare("UPDATE orders SET table_id = ? WHERE id = ?").run(request.to_table_id, orderId);
            }
            
            (async () => {
              try {
                const pool = getPgPool();
                if (pool) {
                  for (const orderId of orderIds) {
                    await pool.query("UPDATE orders SET table_id = $1 WHERE id = $2", [request.to_table_id, orderId]);
                  }
                }
              } catch (e) { console.error("Immediate PG Error (TABLE_TRANSFER_APPROVE_ORDERS):", e); }
            })();

            const remainingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ?").get(request.from_table_id);
            if (remainingOrders.count === 0) {
              db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL, type = 'salao' WHERE id = ?").run(request.from_table_id);
              
              (async () => {
                try {
                  const pool = getPgPool();
                  if (pool) {
                    await pool.query("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL, type = 'salao' WHERE id = $1", [request.from_table_id]);
                  }
                } catch (e) { console.error("Immediate PG Error (TABLE_TRANSFER_APPROVE_FREE):", e); }
              })();
            }

            db.prepare("UPDATE transfer_requests SET status = 'approved' WHERE id = ?").run(requestId);

            broadcast({ type: "TABLES_SYNC", payload: db.prepare("SELECT * FROM tables").all() });
            broadcast({ type: "ORDERS_SYNC", payload: db.prepare(`
              SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
              FROM orders o 
              JOIN menu_items m ON o.menu_item_id = m.id
            `).all() });
            broadcast({ type: "TRANSFER_REQUESTS_SYNC", payload: db.prepare("SELECT * FROM transfer_requests ORDER BY timestamp DESC").all() });
            broadcast({ type: "NOTIFICATION", payload: { message: `Transferência aprovada por ${username}`, type: 'success' } });
            await logHistory(userId, username, "APROVAR_TRANSFERENCIA", `Aprovou transferência para a Mesa ${formatTableNumber(request.to_table_id)}`, null, null, request.from_table_id, requestId);
            break;
          }

          case "TABLE_TRANSFER_REJECT": {
            const { requestId, userId, username } = data.payload;
            const request = db.prepare("SELECT * FROM transfer_requests WHERE id = ?").get(requestId);
            if (!request) break;

            db.prepare("UPDATE transfer_requests SET status = 'rejected' WHERE id = ?").run(requestId);

            broadcast({ type: "TRANSFER_REQUESTS_SYNC", payload: db.prepare("SELECT * FROM transfer_requests ORDER BY timestamp DESC").all() });
            broadcast({ type: "NOTIFICATION", payload: { message: `Transferência recusada por ${username}`, type: 'warning' } });
            await logHistory(userId, username, "RECUSAR_TRANSFERENCIA", `Recusou transferência para a Mesa ${formatTableNumber(request.to_table_id)}`, null, null, request.from_table_id, requestId);
            break;
          }

          case "PRINT_ACK":
            broadcast({ type: "NOTIFICATION", payload: { message: `✅ Impressão confirmada: ${data.payload.title}`, type: 'success' } });
            break;

          case "MENU_ADD": {
            const newItemId = uuidv4();
            const createdAt = new Date().toISOString();
            db.prepare("INSERT INTO menu_items (id, name, price, type, category, active, print_enabled, created_at, is_stockable, is_solid, current_stock, is_event_item, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .run(
                newItemId, 
                data.payload.name, 
                data.payload.price, 
                data.payload.type, 
                data.payload.category, 
                data.payload.active ? 1 : 0, 
                data.payload.print_enabled ? 1 : 0,
                createdAt,
                data.payload.is_stockable ? 1 : 0,
                data.payload.is_solid ? 1 : 0,
                data.payload.current_stock || 0,
                data.payload.is_event_item ? 1 : 0,
                data.payload.description || null,
                data.payload.image_url || null
              );
            // Automatic Firestore sync removed as requested. Manual sync handles it.
            const newMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: newMenu });
            break;
          }

          case "MENU_DELETE":
            db.prepare("DELETE FROM menu_items WHERE id = ?").run(data.payload.id);
            // Automatic Firestore sync removed as requested.
            const updatedMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: updatedMenu });
            break;

          case "MENU_EDIT":
            db.prepare("UPDATE menu_items SET name = ?, price = ?, type = ?, category = ?, active = ?, print_enabled = ?, is_stockable = ?, is_solid = ?, description = ?, image_url = ? WHERE id = ?")
              .run(
                data.payload.name, 
                data.payload.price, 
                data.payload.type, 
                data.payload.category, 
                data.payload.active ? 1 : 0, 
                data.payload.print_enabled ? 1 : 0, 
                data.payload.is_stockable ? 1 : 0,
                data.payload.is_solid ? 1 : 0,
                data.payload.description || null,
                data.payload.image_url || null,
                data.payload.id
              );
            // Automatic Firestore sync removed.
            const editedMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: editedMenu });
            break;

          case "PURCHASE_ADD": {
            const purchaseId = uuidv4();
            const { menu_item_id, quantity, cost_price, userId, username } = data.payload;
            const timestamp = new Date().toISOString();
            
            db.prepare("INSERT INTO stock_purchases (id, menu_item_id, quantity, cost_price, timestamp, user_id, username) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .run(purchaseId, menu_item_id, quantity, cost_price, timestamp, userId, username);
            
            // Update current stock
            db.prepare("UPDATE menu_items SET current_stock = current_stock + ? WHERE id = ?").run(quantity, menu_item_id);
            
            // Automatic Firestore sync removed.
            
            const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(menu_item_id) as any;
            if (item) {
              // Automatic Firestore sync removed.
            }

            broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            broadcast({ type: "STOCK_SYNC", payload: db.prepare("SELECT * FROM stock_purchases ORDER BY timestamp DESC").all() });
            broadcast({ type: "NOTIFICATION", payload: { message: `Compra registrada: ${quantity} unidades adicionadas ao estoque`, type: 'success' } });
            break;
          }

          case "CATEGORY_ADD":
            const newCatId = uuidv4();
            const maxCatOrder = (db.prepare("SELECT MAX(sort_order) as maxOrder FROM categories").get() as any).maxOrder || 0;
            db.prepare("INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)").run(newCatId, data.payload.name, maxCatOrder + 1);
            // Automatic Firestore sync removed.
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            break;

          case "CATEGORY_EDIT": {
            const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldCat && oldCat.name !== data.payload.name) {
              db.prepare("UPDATE menu_items SET type = ? WHERE type = ?").run(data.payload.name, oldCat.name);
              // Automatic Firestore sync removed.
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });

              // Update related groups
              db.prepare("UPDATE item_groups SET category_name = ? WHERE category_name = ?").run(data.payload.name, oldCat.name);
              // Automatic Firestore sync removed.
              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
            }
            db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(data.payload.name, data.payload.id);
            // Automatic Firestore sync removed.
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            break;
          }

          case "CATEGORY_DELETE": {
            const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldCat) {
              db.prepare("UPDATE menu_items SET type = NULL WHERE type = ?").run(oldCat.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE type IS NULL").all() as any[];
              // Automatic Firestore sync removed.
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });

              // Update related groups
              db.prepare("UPDATE item_groups SET category_name = NULL WHERE category_name = ?").run(oldCat.name);
              const updatedGroups = db.prepare("SELECT * FROM item_groups WHERE category_name IS NULL").all() as any[];
              // Automatic Firestore sync removed.
              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
            }
            db.prepare("DELETE FROM categories WHERE id = ?").run(data.payload.id);
            // Automatic Firestore sync removed.
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            break;
          }

          case "CATEGORY_TOGGLE_PRINT": {
            const { id, enabled } = data.payload;
            const val = enabled ? 1 : 0;
            const cat = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as { name: string };
            if (cat) {
              db.prepare("UPDATE categories SET print_enabled = ? WHERE id = ?").run(val, id);
              // Automatic Firestore sync removed.
              
              // Cascade to groups
              db.prepare("UPDATE item_groups SET print_enabled = ? WHERE category_name = ?").run(val, cat.name);
              const groups = db.prepare("SELECT id FROM item_groups WHERE category_name = ?").all() as { id: string }[];
              // Automatic Firestore sync removed.

              // Cascade to items
              db.prepare("UPDATE menu_items SET print_enabled = ? WHERE type = ?").run(val, cat.name);
              const items = db.prepare("SELECT id FROM menu_items WHERE type = ?").all() as { id: string }[];
              // Automatic Firestore sync removed.

              broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            break;
          }

          case "DETAIL_TOGGLE_PRINT": {
            const { id, enabled } = data.payload;
            const val = enabled ? 1 : 0;
            const group = db.prepare("SELECT name FROM item_groups WHERE id = ?").get(id) as { name: string };
            if (group) {
              db.prepare("UPDATE item_groups SET print_enabled = ? WHERE id = ?").run(val, id);
              // Automatic Firestore sync removed.

            // Cascade to items
            db.prepare("UPDATE menu_items SET print_enabled = ? WHERE category = ?").run(val, group.name);
            const items = db.prepare("SELECT id FROM menu_items WHERE category = ?").all() as { id: string }[];
            // Automatic Firestore sync removed.

              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            break;
          }

          case "MENU_TOGGLE_PRINT": {
            const { id, enabled } = data.payload;
            const val = enabled ? 1 : 0;
            db.prepare("UPDATE menu_items SET print_enabled = ? WHERE id = ?").run(val, id);
            // Automatic Firestore sync removed.
            broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            break;
          }

          case "CATEGORY_SAVE_CONFIG": {
            const { categories } = data.payload;
            if (Array.isArray(categories)) {
              for (const item of categories) {
                const oldCat = db.prepare("SELECT name, print_enabled FROM categories WHERE id = ?").get(item.id) as { name: string, print_enabled: number };
                db.prepare("UPDATE categories SET sort_order = ?, print_enabled = ? WHERE id = ?").run(item.sort_order, item.print_enabled, item.id);
                // Automatic Firestore sync removed.
                
                // If print_enabled changed, cascade to items (groups are already handled by the batch save from frontend)
                if (oldCat && oldCat.print_enabled !== item.print_enabled) {
                  db.prepare("UPDATE menu_items SET print_enabled = ? WHERE type = ?").run(item.print_enabled, oldCat.name);
                  // Automatic Firestore sync removed.
                }
              }
              broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
              broadcast({ type: "NOTIFICATION", payload: { message: "Configurações de categorias salvas", type: "success" } });
            }
            break;
          }

          case "DETAIL_SAVE_CONFIG": {
            const { groups } = data.payload;
            if (Array.isArray(groups)) {
              for (const item of groups) {
                const oldGroup = db.prepare("SELECT name, print_enabled FROM item_groups WHERE id = ?").get(item.id) as { name: string, print_enabled: number };
                db.prepare("UPDATE item_groups SET sort_order = ?, print_enabled = ?, show_in_history = ? WHERE id = ?").run(item.sort_order, item.print_enabled, item.show_in_history, item.id);
                // Automatic Firestore sync removed.
                
                // If print_enabled changed, cascade to items
                if (oldGroup && oldGroup.print_enabled !== item.print_enabled) {
                  db.prepare("UPDATE menu_items SET print_enabled = ? WHERE category = ?").run(item.print_enabled, oldGroup.name);
                  // Automatic Firestore sync removed.
                }
              }
              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
              broadcast({ type: "NOTIFICATION", payload: { message: "Configurações de grupos salvas", type: "success" } });
            }
            break;
          }

          case "CATEGORY_REORDER": {
            const { id, direction } = data.payload;
            const all = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() as any[];
            const index = all.findIndex(c => c.id === id);
            if (index === -1) break;

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex >= 0 && targetIndex < all.length) {
              const current = all[index];
              const other = all[targetIndex];
              
              all[index] = other;
              all[targetIndex] = current;

              all.forEach((c, i) => {
                const newOrder = i + 1;
                db.prepare("UPDATE categories SET sort_order = ? WHERE id = ?").run(newOrder, c.id);
                // Automatic Firestore sync removed.
              });
            }
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            broadcast({ type: "NOTIFICATION", payload: { message: "Ordem das categorias atualizada", type: "success" } });
            break;
          }

          case "DETAIL_ADD":
            const newGroupId = uuidv4();
            const maxGroupOrder = (db.prepare("SELECT MAX(sort_order) as maxOrder FROM item_groups WHERE IFNULL(category_name, '') = IFNULL(?, '')").get(data.payload.category_name) as any).maxOrder || 0;
            db.prepare("INSERT INTO item_groups (id, name, category_name, sort_order) VALUES (?, ?, ?, ?)").run(newGroupId, data.payload.name, data.payload.category_name, maxGroupOrder + 1);
            // Automatic Firestore sync removed.
            broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
              SELECT g.* 
              FROM item_groups g 
              LEFT JOIN categories c ON g.category_name = c.name 
              ORDER BY c.sort_order ASC, g.sort_order ASC
            `).all() });
            break;

          case "DETAIL_REORDER": {
            const { id, direction } = data.payload;
            const currentItem = db.prepare("SELECT * FROM item_groups WHERE id = ?").get(id) as any;
            if (!currentItem) break;

            const catName = currentItem.category_name;
            const allInCategory = db.prepare("SELECT * FROM item_groups WHERE IFNULL(category_name, '') = IFNULL(?, '') ORDER BY sort_order ASC").all(catName) as any[];
            const index = allInCategory.findIndex(g => g.id === id);
            if (index === -1) break;

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex >= 0 && targetIndex < allInCategory.length) {
              const current = allInCategory[index];
              const other = allInCategory[targetIndex];
              
              allInCategory[index] = other;
              allInCategory[targetIndex] = current;

              allInCategory.forEach((g, i) => {
                const newOrder = i + 1;
                db.prepare("UPDATE item_groups SET sort_order = ? WHERE id = ?").run(newOrder, g.id);
                // Automatic Firestore sync removed.
              });
            }
            broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
              SELECT g.* 
              FROM item_groups g 
              LEFT JOIN categories c ON g.category_name = c.name 
              ORDER BY c.sort_order ASC, g.sort_order ASC
            `).all() });
            broadcast({ type: "NOTIFICATION", payload: { message: "Ordem dos grupos atualizada", type: "success" } });
            break;
          }

          case "DETAIL_EDIT": {
            const oldGroup = db.prepare("SELECT name, category_name FROM item_groups WHERE id = ?").get(data.payload.id) as { name: string, category_name: string };
            if (oldGroup && oldGroup.name !== data.payload.name) {
              db.prepare("UPDATE menu_items SET category = ? WHERE category = ?").run(data.payload.name, oldGroup.name);
              // Automatic Firestore sync removed.
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            
            if (oldGroup && oldGroup.category_name !== data.payload.category_name) {
              const maxGroupOrder = (db.prepare("SELECT MAX(sort_order) as maxOrder FROM item_groups WHERE IFNULL(category_name, '') = IFNULL(?, '')").get(data.payload.category_name) as any).maxOrder || 0;
              db.prepare("UPDATE item_groups SET name = ?, category_name = ?, sort_order = ? WHERE id = ?").run(data.payload.name, data.payload.category_name, maxGroupOrder + 1, data.payload.id);
              // Automatic Firestore sync removed.
            } else {
              db.prepare("UPDATE item_groups SET name = ?, category_name = ? WHERE id = ?").run(data.payload.name, data.payload.category_name, data.payload.id);
              // Automatic Firestore sync removed.
            }
            broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
              SELECT g.* 
              FROM item_groups g 
              LEFT JOIN categories c ON g.category_name = c.name 
              ORDER BY c.sort_order ASC, g.sort_order ASC
            `).all() });
            break;
          }

          case "DETAIL_TOGGLE_HISTORY": {
            const { id, show } = data.payload;
            db.prepare("UPDATE item_groups SET show_in_history = ? WHERE id = ?").run(show ? 1 : 0, id);
            // Automatic Firestore sync removed.
            broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
              SELECT g.* 
              FROM item_groups g 
              LEFT JOIN categories c ON g.category_name = c.name 
              ORDER BY c.sort_order ASC, g.sort_order ASC
            `).all() });
            break;
          }

          case "DETAIL_DELETE": {
            const oldGroup = db.prepare("SELECT name FROM item_groups WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldGroup) {
              db.prepare("UPDATE menu_items SET category = NULL WHERE category = ?").run(oldGroup.name);
              // Automatic Firestore sync removed.
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            db.prepare("DELETE FROM item_groups WHERE id = ?").run(data.payload.id);
            // Automatic Firestore sync removed.
            broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
              SELECT g.* 
              FROM item_groups g 
              LEFT JOIN categories c ON g.category_name = c.name 
              ORDER BY c.sort_order ASC, g.sort_order ASC
            `).all() });
            break;
          }
        }
      } catch (err) {
        console.error("WS Error:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      broadcastOnlineUsers();
    });
  });

  // Auth Routes
  app.post("/api/login", async (req, res) => {
    const { username, password, token } = req.body;

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (!user) {
      return res.status(401).json({ success: false, message: "Usuário ou senha incorretos" });
    }

    const passwordOk = await verifyPassword(password, user.password, user.id);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: "Usuário ou senha incorretos" });
    }

    if (user.role !== 'host') {
      const storedToken = db.prepare("SELECT value FROM settings WHERE key = 'access_token'").get() as { value: string } | undefined;
      if (!storedToken || token !== storedToken.value) {
        return res.status(401).json({ success: false, message: "Token de acesso inválido" });
      }
    }

    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar || "👤" }
    });
  });

  app.post("/api/admin/reset-history", async (req, res) => {
    const requestingUserId = req.headers['x-app-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || requestingUser.role !== 'host') {
      return res.status(403).json({ success: false, message: "Apenas o Host pode limpar o histórico" });
    }

    try {
      db.prepare("UPDATE history SET deleted = 1").run();
      
      const pool = getPgPool();
      if (pool) {
        const pgClient = await pool.connect();
        try {
          await pgClient.query("UPDATE history SET deleted = 1");
        } finally {
          pgClient.release();
        }
      }
      
      broadcast({ type: "HISTORY_UPDATE", payload: [] });
      
      console.log(`History reset by host in Supabase and SQLite.`);
      res.json({ success: true });
    } catch (e) {
      console.error("Error resetting history:", e);
      res.status(500).json({ success: false, message: "Erro ao limpar histórico" });
    }
  });

  app.get("/api/debug/schema", (req, res) => {
    const requestingUserId = req.headers['x-app-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'host')) {
      return res.status(403).json({ success: false, message: "Acesso negado: apenas administradores." });
    }

    try {
      const schema = db.prepare("PRAGMA table_info(users)").all();
      res.json({ success: true, schema });
    } catch (e) {
      res.status(500).json({ success: false, message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/debug/users", (req, res) => {
    const requestingUserId = req.headers['x-app-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'host')) {
      return res.status(403).json({ success: false, message: "Acesso negado: apenas administradores." });
    }

    try {
      const users = db.prepare("SELECT id, username, role FROM users").all();
      res.json({ success: true, users });
    } catch (e) {
      res.status(500).json({ success: false, message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role, avatar FROM users").all();
    res.json(users);
  });

  // Global error handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Server] Global error:", err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Erro interno no servidor"
    });
  });

  app.post("/api/users", async (req, res) => {
    const requestingUserId = req.headers['x-app-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || (requestingUser.role !== 'host' && requestingUser.role !== 'admin')) {
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    const { username, password, role, avatar } = req.body;

    if (requestingUser.role === 'admin' && role === 'host') {
      return res.status(403).json({ success: false, message: "Admin não pode criar Host" });
    }

    try {
      const id = uuidv4();
      const hashedPwd = await hashPassword(password);
      db.prepare("INSERT INTO users (id, username, password, role, avatar) VALUES (?, ?, ?, ?, ?)")
        .run(id, username, hashedPwd, role, avatar || "👤");
      
      // Automatic Firestore sync removed.
      scheduleCloudSave();

      res.json({ success: true });
    } catch (e) {
      console.error("Insert user error:", e);
      res.status(400).json({ success: false, message: "Erro ao criar usuário. Verifique se o login já existe." });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const requestingUserId = req.headers['x-app-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;
    const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;

    if (!requestingUser || (requestingUser.role !== 'host' && requestingUser.role !== 'admin')) {
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    if (targetUser && targetUser.username === 'deckserrinha') {
      return res.status(403).json({ success: false, message: "O host inicial não pode ser excluído" });
    }

    if (targetUser && targetUser.role === 'host' && requestingUser.role !== 'host') {
      return res.status(403).json({ success: false, message: "Admin não pode excluir Host" });
    }

    try {
      const result = db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      
      if (result.changes > 0) {
        // Force logout if user is online
        const logoutMsg = JSON.stringify({ 
          type: "FORCE_LOGOUT", 
          payload: { message: "Sua conta foi removida pelo administrador." } 
        });
        clients.forEach((info, client) => {
          if (info.userId === req.params.id) {
            client.send(logoutMsg);
            setTimeout(() => client.close(), 500);
          }
        });

        // Automatic Firestore sync removed.
        scheduleCloudSave();
        console.log(`User ${req.params.id} deleted`);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Usuário não encontrado" });
      }
    } catch (e) {
      console.error("Error deleting user:", e);
      res.status(500).json({ success: false, message: "Erro ao excluir usuário" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    console.log(`[Server] PUT /api/users/${req.params.id} - Request received`);
    console.log(`[Server] Request body:`, JSON.stringify(req.body));
    try {
      const requestingUserId = req.headers['x-app-user-id'] as string;
      console.log(`[Server] Requesting User ID: ${requestingUserId}`);
      
      if (!requestingUserId) {
        console.warn("[Server] Update user request missing x-app-user-id header");
        return res.status(400).json({ success: false, message: "ID do usuário solicitante ausente" });
      }

      const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;
      const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;

      if (!requestingUser) {
        console.warn(`[Server] Requesting user ${requestingUserId} not found in database`);
        return res.status(403).json({ success: false, message: "Sem permissão (usuário não encontrado)" });
      }

      if (!targetUser) {
        console.warn(`[Server] Target user ${req.params.id} not found in database`);
        return res.status(404).json({ success: false, message: "Usuário alvo não encontrado" });
      }

      const isSelf = requestingUserId === req.params.id;
      const isHost = requestingUser.role === 'host';
      const isAdmin = requestingUser.role === 'admin';

      // Dev restriction: Only Dev can edit Dev
      if (targetUser.username === 'Dev' && requestingUser.username !== 'Dev') {
        return res.status(403).json({ success: false, message: "Apenas o desenvolvedor pode alterar os dados desta conta" });
      }

      // Permission Logic
      if (!isHost && !isAdmin && !isSelf) {
        return res.status(403).json({ success: false, message: "Sem permissão" });
      }

      if (isAdmin && targetUser.role === 'host' && !isSelf) {
        return res.status(403).json({ success: false, message: "Admin não pode editar Host" });
      }

      const { username, password, role, avatar } = req.body;

      let passwordChanged = false;
      if (password && password !== targetUser.password) {
        passwordChanged = true;
      }

      if (targetUser && targetUser.username === 'deckserrinha' && role !== 'host') {
        return res.status(403).json({ success: false, message: "O host inicial não pode ser removido do cargo" });
      }

      // Only Host can change roles to/from Host
      if (role && role === 'host' && !isHost) {
         return res.status(403).json({ success: false, message: "Apenas Host pode promover a Host" });
      }

      // Non-host/admin cannot change their own role
      if (isSelf && !isHost && role && role !== targetUser.role) {
         return res.status(403).json({ success: false, message: "Você não pode alterar sua própria função" });
      }

      let query = "UPDATE users SET id = id"; // Dummy start to simplify appending
      let params = [];

      if (username !== undefined) {
        query += ", username = ?";
        params.push(username);
      }
      if (password !== undefined) {
        const hashedPwd = await hashPassword(password);
        query += ", password = ?";
        params.push(hashedPwd);
      }
      if (role !== undefined) {
        query += ", role = ?";
        params.push(role);
      }
      if (avatar !== undefined) {
        query += ", avatar = ?";
        params.push(avatar);
      }

      query += " WHERE id = ?";
      params.push(req.params.id);

      db.prepare(query).run(...params);
      scheduleCloudSave();
      
      // Force logout if password or role changed OR if the target user is not a host (per user request)
      const targetIsHost = targetUser.role === 'host';
      const forceLogout = passwordChanged || (role !== undefined && role !== targetUser.role) || !targetIsHost;

      if (forceLogout) {
        const logoutMsg = JSON.stringify({ 
          type: "FORCE_LOGOUT", 
          payload: { message: "Seus dados de acesso foram atualizados. Por favor, faça login novamente." } 
        });
        clients.forEach((info, client) => {
          if (info.userId === req.params.id) {
            client.send(logoutMsg);
            setTimeout(() => client.close(), 500);
          }
        });
      }

      console.log(`[Server] User ${req.params.id} updated successfully by ${requestingUserId}`);

      // Automatic Firestore sync removed.

      res.json({ success: true });
    } catch (e) {
      console.error("Error updating user:", e);
      res.status(500).json({ success: false, message: "Erro interno ao atualizar usuário" });
    }
  });

  app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
      FROM orders o 
      JOIN menu_items m ON o.menu_item_id = m.id 
      JOIN tables t ON o.table_id = t.id
      WHERE t.status != 'free'
    `).all();
    res.json(orders);
  });

  app.get("/api/orders/:tableId", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
      FROM orders o 
      JOIN menu_items m ON o.menu_item_id = m.id 
      WHERE o.table_id = ?
    `).all(req.params.tableId);
    res.json(orders);
  });

  // Menu Export/Import
  app.get("/api/menu/export", (req, res) => {
    const menu = db.prepare("SELECT * FROM menu_items").all();
    const categories = db.prepare("SELECT * FROM categories").all();
    const itemGroups = db.prepare("SELECT * FROM item_groups").all();
    
    const exportData = {
      menu_items: menu,
      categories: categories,
      item_groups: itemGroups
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=cardapio.json');
    res.send(JSON.stringify(exportData, null, 2));
  });

  app.post("/api/menu/import", async (req, res) => {
    const data = req.body;
    
    let menuItems: any[] = [];
    let categories: any[] = [];
    let itemGroups: any[] = [];

    if (Array.isArray(data)) {
      menuItems = data;
    } else if (data && typeof data === 'object') {
      menuItems = Array.isArray(data.menu_items) ? data.menu_items : [];
      categories = Array.isArray(data.categories) ? data.categories : [];
      itemGroups = Array.isArray(data.item_groups) ? data.item_groups : [];
    } else {
      return res.status(400).json({ success: false, message: "Formato inválido" });
    }

    try {
      const transaction = db.transaction(() => {
        if (categories.length > 0) {
          const insertCat = db.prepare(`
            INSERT OR REPLACE INTO categories (id, name, sort_order) 
            VALUES (?, ?, ?)
          `);
          for (const cat of categories) {
            const id = cat.id || uuidv4();
            insertCat.run(
              id, 
              cat.name, 
              cat.sort_order ?? 0
            );
          }
        }

        if (itemGroups.length > 0) {
          const insertGroup = db.prepare(`
            INSERT OR REPLACE INTO item_groups (id, name, category_name, sort_order, show_in_history) 
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const group of itemGroups) {
            const id = group.id || uuidv4();
            insertGroup.run(
              id, 
              group.name, 
              group.category_name || null,
              group.sort_order ?? 0,
              group.show_in_history ?? 1
            );
          }
        }

        if (menuItems.length > 0) {
          const insertMenu = db.prepare(`
            INSERT OR REPLACE INTO menu_items (
              id, name, price, type, category, active, 
              description, image_url, print_enabled, is_event_item
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const item of menuItems) {
            const id = item.id || uuidv4();
            insertMenu.run(
              id, 
              item.name, 
              item.price, 
              item.type, 
              item.category, 
              item.active !== undefined ? item.active : 1,
              item.description || null,
              item.image_url || null,
              item.print_enabled !== undefined ? item.print_enabled : 1,
              item.is_event_item !== undefined ? item.is_event_item : 0
            );
          }
        }
      });
      
      transaction();
      
      if (categories.length > 0) {
        broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
      }
      if (itemGroups.length > 0) {
        broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
          SELECT g.* 
          FROM item_groups g 
          LEFT JOIN categories c ON g.category_name = c.name 
          ORDER BY c.sort_order ASC, g.sort_order ASC
        `).all() });
      }
      if (menuItems.length > 0) {
        broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
      }
      
      res.json({ success: true });
    } catch (e) {
      console.error("Import error:", e);
      res.status(500).json({ success: false, message: "Erro ao importar cardápio" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
    
    // Initialize Supabase Tables (non-blocking)
    initSupabase().then(() => {
      console.log("[Supabase] Initialization finished.");
    }).catch(err => {
      console.error("[Supabase] Initialization failed:", err);
    });

    // Initial counting of users to verify database
    try {
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      console.log(`[Database] Initialized with ${userCount.count} users`);
    } catch (e) {
      console.error("[Database] Error counting users:", e);
    }
  });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
}

startServer().catch(err => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
