import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db as firestoreDb, auth as firestoreAuth } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, where, limit, writeBatch, onSnapshot } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = "deck_serrinha.db";

let db: any;

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
        avatar TEXT
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
        print_enabled INTEGER DEFAULT 0,
        created_at TEXT,
        is_stockable INTEGER DEFAULT 0,
        is_solid INTEGER DEFAULT 0,
        current_stock REAL DEFAULT 0
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
        timestamp TEXT
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
        final_balance REAL,
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
        username TEXT
      );

      CREATE TABLE IF NOT EXISTS accounts_payable (
        id TEXT PRIMARY KEY,
        description TEXT,
        amount REAL,
        due_date TEXT,
        status TEXT DEFAULT 'pending',
        category TEXT,
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
    `);

    console.log("[Database] Running migrations...");
    // Migrations
    const migrations = [
      "ALTER TABLE users ADD COLUMN email TEXT",
      "ALTER TABLE users ADD COLUMN avatar TEXT",
      "ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0",
      "ALTER TABLE item_groups ADD COLUMN sort_order INTEGER DEFAULT 0",
      "ALTER TABLE item_groups ADD COLUMN category_name TEXT",
      "ALTER TABLE item_groups ADD COLUMN show_in_history INTEGER DEFAULT 1",
      "ALTER TABLE categories ADD COLUMN print_enabled INTEGER DEFAULT 0",
      "ALTER TABLE item_groups ADD COLUMN print_enabled INTEGER DEFAULT 0",
      "ALTER TABLE menu_items ADD COLUMN print_enabled INTEGER DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN is_read INTEGER DEFAULT 0",
      "ALTER TABLE history ADD COLUMN order_id TEXT",
      "ALTER TABLE menu_items ADD COLUMN active INTEGER DEFAULT 1",
      "ALTER TABLE tables ADD COLUMN type TEXT DEFAULT 'salao'",
      "ALTER TABLE history ADD COLUMN item_group TEXT",
      "ALTER TABLE history ADD COLUMN table_id INTEGER",
      "ALTER TABLE history ADD COLUMN request_id TEXT",
      "ALTER TABLE orders ADD COLUMN observation TEXT",
      "ALTER TABLE menu_items ADD COLUMN created_at TEXT",
      "ALTER TABLE menu_items ADD COLUMN is_stockable INTEGER DEFAULT 0",
      "ALTER TABLE menu_items ADD COLUMN is_solid INTEGER DEFAULT 0",
      "ALTER TABLE menu_items ADD COLUMN current_stock REAL DEFAULT 0"
    ];

    migrations.forEach(sql => {
      try {
        db.prepare(sql).run();
      } catch (e: any) {
        if (!e.message.includes("duplicate column name") && !e.message.includes("already exists")) {
          console.warn(`[Database] Migration failed: ${sql}`, e.message);
        }
      }
    });

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
      admin: { mesas: true, historico: true, cardapio: true, erp: true, config: true, edit_menu: true, delete_order: true, manage_users: true, clear_history: true, mark_history_read: true, manage_categories: true, reorder_categories: true, reorder_groups: true, apply_discount: true, remove_service_fee: true, manage_printer: true, manage_tasks: true, manage_tables: true },
      waiter: { mesas: true, historico: true, cardapio: true, erp: false, config: true, edit_menu: false, delete_order: false, manage_users: false, clear_history: false, mark_history_read: false, manage_categories: false, reorder_categories: false, reorder_groups: false, apply_discount: false, remove_service_fee: false, manage_printer: false, manage_tasks: false, manage_tables: false },
      kitchen: { mesas: true, historico: false, cardapio: true, erp: false, config: true, edit_menu: false, delete_order: false, manage_users: false, clear_history: false, mark_history_read: false, manage_categories: false, reorder_categories: false, reorder_groups: false, apply_discount: false, remove_service_fee: false, manage_printer: false, manage_tasks: false, manage_tables: false },
      caixa: { mesas: true, historico: true, cardapio: true, erp: true, config: true, edit_menu: false, delete_order: true, manage_users: false, clear_history: false, mark_history_read: true, manage_categories: false, reorder_categories: false, reorder_groups: false, apply_discount: true, remove_service_fee: true, manage_printer: false, manage_tasks: false, manage_tables: false }
    };

    for (const role of ['admin', 'waiter', 'kitchen', 'caixa']) {
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

    // Seed SQLite Users
    const hostUser = db.prepare("SELECT * FROM users WHERE username = ?").get("deckserrinha") as any;
    if (!hostUser) {
      db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)").run(uuidv4(), "deckserrinha", "deckappadmin", "host");
    } else if (!hostUser.password) {
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run("deckappadmin", "deckserrinha");
    }

    const devUser = db.prepare("SELECT * FROM users WHERE username = ?").get("Dev") as any;
    if (!devUser) {
      db.prepare("INSERT INTO users (id, username, password, role, avatar) VALUES (?, ?, ?, ?, ?)").run(uuidv4(), "Dev", "2212", "host", "👨‍💻");
    } else {
      db.prepare("UPDATE users SET password = ?, role = ? WHERE username = ?").run("2212", "host", "Dev");
    }

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

async function authenticateServer() {
  // Using a versioned email to allow "resetting" the server identity if password issues occur
  const email = "server-v2@deckserrinha.com";
  const password = process.env.SERVER_PASSWORD || "2212";
  
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn("Authentication timeout. Proceeding without Firestore sync.");
      unsubscribe();
      resolve();
    }, 10000); // 10s timeout

    const unsubscribe = onAuthStateChanged(firestoreAuth, (user) => {
      if (user) {
        console.log("Server authenticated with Firestore successfully.");
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });

    signInWithEmailAndPassword(firestoreAuth, email, password)
      .then(async (userCredential) => {
        // Ensure server user exists in Firestore users collection
        try {
          await setDoc(doc(firestoreDb, "users", userCredential.user.uid), {
            username: "Dev",
            email: email,
            password: password,
            role: "host",
            avatar: "👨‍💻"
          }, { merge: true });
        } catch (e) {
          console.error("Failed to ensure server user in Firestore:", e);
        }
      })
      .catch((error: any) => {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          createUserWithEmailAndPassword(firestoreAuth, email, password)
            .then(async (userCredential) => {
              try {
                await setDoc(doc(firestoreDb, "users", userCredential.user.uid), {
                  username: "Dev",
                  email: email,
                  password: password,
                  role: "host",
                  avatar: "👨‍💻"
                }, { merge: true });
              } catch (e) {
                console.error("Failed to ensure server user in Firestore:", e);
              }
            })
            .catch((createError) => {
              if (createError.code === 'auth/email-already-in-use') {
                console.warn("Server user already exists but authentication failed (likely wrong password).");
              } else {
                console.error("Failed to create server user:", createError);
              }
              clearTimeout(timeout);
              unsubscribe();
              resolve(); // Resolve anyway to allow server to start
            });
        } else {
          console.error("Failed to authenticate server:", error);
          clearTimeout(timeout);
          unsubscribe();
          resolve(); // Resolve anyway to allow server to start
        }
      });
  });
}

async function syncHostToFirestore(hostId: string) {
  // Ensure host exists in Firestore with correct password
  try {
    const hostDoc = await getDoc(doc(firestoreDb, "users", hostId)).catch(() => null);
    if (!hostDoc?.exists() || !hostDoc.data()?.password) {
      await setDoc(doc(firestoreDb, "users", hostId), {
        username: "deckserrinha",
        password: "deckappadmin",
        role: "host",
        email: "deckserrinha@deckserrinha.com",
        avatar: "👤"
      }, { merge: true });
      console.log("[Seed] Host user synced to Firestore");
    }
  } catch (e) {
    console.error("[Seed] Error syncing host to Firestore:", e);
  }
}

async function loadFromFirestore(hostId: string) {
  try {
    await authenticateServer();
    await syncHostToFirestore(hostId);
    console.log("Loading data from Firestore...");
    
    // Menu Items
    const menuSnapshot = await getDocs(collection(firestoreDb, "menu_items")).catch(e => handleFirestoreError(e, OperationType.GET, "menu_items"));
    if (menuSnapshot && !menuSnapshot.empty) {
      db.prepare("DELETE FROM menu_items").run();
      const insertMenu = db.prepare("INSERT INTO menu_items (id, name, price, type, category, active, print_enabled, created_at, is_stockable, is_solid, current_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      menuSnapshot.forEach(doc => {
        const data = doc.data();
        insertMenu.run(
          doc.id, 
          data.name, 
          data.price, 
          data.type, 
          data.category, 
          data.active ?? 1, 
          data.print_enabled ?? 0,
          data.created_at || new Date().toISOString(),
          data.is_stockable ?? 0,
          data.is_solid ?? 0,
          data.current_stock ?? 0
        );
      });
    } else if (menuSnapshot) {
      console.log("Firestore menu_items is empty. Syncing from SQLite...");
      const menuItems = db.prepare("SELECT * FROM menu_items").all() as any[];
      for (const item of menuItems) {
        await setDoc(doc(firestoreDb, "menu_items", item.id), {
          name: item.name,
          price: item.price,
          type: item.type ?? null,
          category: item.category ?? null,
          active: item.active ?? 1,
          created_at: item.created_at || new Date().toISOString(),
          is_stockable: item.is_stockable ?? 0,
          is_solid: item.is_solid ?? 0,
          current_stock: item.current_stock ?? 0
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, "menu_items"));
      }
    }

    // Stock Purchases
    const stockSnapshot = await getDocs(collection(firestoreDb, "stock_purchases")).catch(e => handleFirestoreError(e, OperationType.GET, "stock_purchases"));
    if (stockSnapshot && !stockSnapshot.empty) {
      db.prepare("DELETE FROM stock_purchases").run();
      const insertStock = db.prepare("INSERT INTO stock_purchases (id, menu_item_id, quantity, cost_price, timestamp, user_id, username) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stockSnapshot.forEach(doc => {
        const data = doc.data();
        insertStock.run(doc.id, data.menu_item_id, data.quantity, data.cost_price, data.timestamp, data.user_id, data.username);
      });
    }

    // Categories
    const catSnapshot = await getDocs(collection(firestoreDb, "categories")).catch(e => handleFirestoreError(e, OperationType.GET, "categories"));
    if (catSnapshot && !catSnapshot.empty) {
      db.prepare("DELETE FROM categories").run();
      const insertCat = db.prepare("INSERT INTO categories (id, name, sort_order, print_enabled) VALUES (?, ?, ?, ?)");
      catSnapshot.forEach(doc => {
        const data = doc.data();
        insertCat.run(doc.id, data.name, data.sort_order ?? 0, data.print_enabled ?? 0);
      });
    } else if (catSnapshot) {
      console.log("Firestore categories is empty. Syncing from SQLite...");
      const categories = db.prepare("SELECT * FROM categories").all() as any[];
      for (const cat of categories) {
        await setDoc(doc(firestoreDb, "categories", cat.id), { name: cat.name }).catch(e => handleFirestoreError(e, OperationType.CREATE, "categories"));
      }
    }

    // Item Groups
    const groupSnapshot = await getDocs(collection(firestoreDb, "item_groups")).catch(e => handleFirestoreError(e, OperationType.GET, "item_groups"));
    if (groupSnapshot && !groupSnapshot.empty) {
      db.prepare("DELETE FROM item_groups").run();
      const insertGroup = db.prepare("INSERT INTO item_groups (id, name, category_name, sort_order, print_enabled, show_in_history) VALUES (?, ?, ?, ?, ?, ?)");
      groupSnapshot.forEach(doc => {
        const data = doc.data();
        insertGroup.run(doc.id, data.name, data.category_name || null, data.sort_order ?? 0, data.print_enabled ?? 0, data.show_in_history ?? 1);
      });
    } else if (groupSnapshot) {
      console.log("Firestore item_groups is empty. Syncing from SQLite...");
      const groups = db.prepare("SELECT * FROM item_groups").all() as any[];
      for (const group of groups) {
        await setDoc(doc(firestoreDb, "item_groups", group.id), { name: group.name, category_name: group.category_name || null }).catch(e => handleFirestoreError(e, OperationType.CREATE, "item_groups"));
      }
    }

    // Users
    const usersSnapshot = await getDocs(collection(firestoreDb, "users")).catch(e => handleFirestoreError(e, OperationType.GET, "users"));
    if (usersSnapshot && !usersSnapshot.empty) {
      const upsertUser = db.prepare(`
        INSERT INTO users (id, username, email, password, role, avatar) 
        VALUES (?, ?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
          username = excluded.username, 
          email = excluded.email, 
          password = COALESCE(NULLIF(excluded.password, ''), users.password),
          role = excluded.role,
          avatar = COALESCE(NULLIF(excluded.avatar, ''), users.avatar)
      `);
      const deleteConflict = db.prepare("DELETE FROM users WHERE username = ? AND id != ?");
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id !== 'server') {
          // Resolve username conflict before upserting
          if (data.username) {
            deleteConflict.run(data.username, doc.id);
          }
          upsertUser.run(doc.id, data.username, data.email || null, data.password || null, data.role, data.avatar || null);
        }
      });
    } else if (usersSnapshot) {
      console.log("Firestore users is empty. Syncing from SQLite...");
      const users = db.prepare("SELECT * FROM users").all() as any[];
      for (const user of users) {
        await setDoc(doc(firestoreDb, "users", user.id), { 
          username: user.username, 
          email: user.email || `${user.username}@deckserrinha.com`, 
          password: user.password,
          role: user.role,
          avatar: user.avatar || "👤"
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, "users"));
      }
    }

    // Tables
    const tablesSnapshot = await getDocs(collection(firestoreDb, "tables")).catch(e => handleFirestoreError(e, OperationType.GET, "tables"));
    if (tablesSnapshot && !tablesSnapshot.empty) {
      const insertTable = db.prepare("INSERT OR REPLACE INTO tables (id, number, status, customer_name, people_count, opened_at, type) VALUES (?, ?, ?, ?, ?, ?, ?)");
      tablesSnapshot.forEach(doc => {
        const data = doc.data();
        const tableId = parseInt(doc.id);
        if (isNaN(tableId)) {
          console.error(`Invalid table ID in Firestore: ${doc.id}`);
          return;
        }
        const tableNumber = data.number || tableId;
        insertTable.run(tableId, tableNumber, data.status || 'free', data.customer_name || null, data.people_count || null, data.opened_at || null, data.type || 'salao');
      });
    } else if (tablesSnapshot) {
      console.log("Firestore tables is empty. Syncing from SQLite...");
      const tables = db.prepare("SELECT * FROM tables").all() as any[];
      for (const table of tables) {
        await setDoc(doc(firestoreDb, "tables", String(table.id)), {
          number: table.number,
          status: table.status,
          customer_name: table.customer_name || null,
          people_count: table.people_count || null,
          opened_at: table.opened_at || null,
          type: table.type || 'salao'
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, "tables"));
      }
    }

    // Settings
    const settingsSnapshot = await getDocs(collection(firestoreDb, "settings")).catch(e => handleFirestoreError(e, OperationType.GET, "settings"));
    if (settingsSnapshot && !settingsSnapshot.empty) {
      const insertSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
      settingsSnapshot.forEach(doc => {
        const data = doc.data();
        insertSetting.run(doc.id, data.value);
      });
    } else if (settingsSnapshot) {
      console.log("Firestore settings is empty. Syncing from SQLite...");
      const settings = db.prepare("SELECT * FROM settings").all() as any[];
      for (const setting of settings) {
        await setDoc(doc(firestoreDb, "settings", setting.key), { value: setting.value }).catch(e => handleFirestoreError(e, OperationType.CREATE, "settings"));
      }
    }

    // History (Only last 100)
    const historySnapshot = await getDocs(collection(firestoreDb, "history")).catch(e => handleFirestoreError(e, OperationType.GET, "history"));
    if (historySnapshot && !historySnapshot.empty) {
      const insertHistory = db.prepare("INSERT OR REPLACE INTO history (id, user_id, username, action, details, order_id, item_group, table_id, request_id, is_read, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      historySnapshot.forEach(doc => {
        const data = doc.data();
        insertHistory.run(doc.id, data.user_id, data.username, data.action, data.details, data.order_id || null, data.item_group || null, data.table_id || null, data.request_id || null, data.is_read || 0, data.timestamp);
      });
    }

    // Orders
    const ordersSnapshot = await getDocs(collection(firestoreDb, "orders")).catch(e => handleFirestoreError(e, OperationType.GET, "orders"));
    if (ordersSnapshot && !ordersSnapshot.empty) {
      const insertOrder = db.prepare("INSERT OR REPLACE INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      ordersSnapshot.forEach(doc => {
        const data = doc.data();
        insertOrder.run(doc.id, data.table_id, data.menu_item_id, data.quantity, data.status, data.is_read || 0, data.observation || null, data.timestamp);
      });
    }

    // Cashier
    const sessionsSnapshot = await getDocs(collection(firestoreDb, "cashier_sessions")).catch(e => handleFirestoreError(e, OperationType.GET, "cashier_sessions"));
    if (sessionsSnapshot && !sessionsSnapshot.empty) {
      const insertSession = db.prepare("INSERT OR REPLACE INTO cashier_sessions (id, opened_at, closed_at, opened_by_id, opened_by_name, closed_by_id, closed_by_name, initial_balance, final_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      sessionsSnapshot.forEach(doc => {
        const data = doc.data();
        insertSession.run(doc.id, data.opened_at, data.closed_at || null, data.opened_by_id, data.opened_by_name, data.closed_by_id || null, data.closed_by_name || null, data.initial_balance || 0, data.final_balance || null, data.status || 'open');
      });
    }

    // Transactions
    const transactionsSnapshot = await getDocs(collection(firestoreDb, "cashier_transactions")).catch(e => handleFirestoreError(e, OperationType.GET, "cashier_transactions"));
    if (transactionsSnapshot && !transactionsSnapshot.empty) {
      const insertTx = db.prepare("INSERT OR REPLACE INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        insertTx.run(doc.id, data.session_id, data.type, data.amount, data.description || null, data.method || null, data.timestamp, data.user_id || null, data.username || null);
      });
    }

    // Accounts Payable
    const payableSnapshot = await getDocs(collection(firestoreDb, "accounts_payable")).catch(e => handleFirestoreError(e, OperationType.GET, "accounts_payable"));
    if (payableSnapshot && !payableSnapshot.empty) {
      const insertPayable = db.prepare("INSERT OR REPLACE INTO accounts_payable (id, description, amount, due_date, status, paid_at, method, category, recurring, user_id, username, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      payableSnapshot.forEach(doc => {
        const data = doc.data();
        insertPayable.run(doc.id, data.description || '', data.amount || 0, data.due_date || '', data.status || 'pending', data.paid_at || null, data.method || null, data.category || 'Outros', data.recurring || 0, data.user_id || null, data.username || null, data.timestamp || Date.now());
      });
    }

    console.log("Data loaded/synced from Firestore successfully.");

    // After loading, ensure clean sort_order sequence
    try {
      const allCats = db.prepare("SELECT id FROM categories ORDER BY sort_order ASC").all() as any[];
      allCats.forEach((c, i) => {
        db.prepare("UPDATE categories SET sort_order = ? WHERE id = ?").run(i + 1, c.id);
        setDoc(doc(firestoreDb, "categories", c.id), { sort_order: i + 1 }, { merge: true }).catch(() => {});
      });

      const allGroups = db.prepare(`
        SELECT g.id, g.category_name 
        FROM item_groups g 
        LEFT JOIN categories c ON g.category_name = c.name 
        ORDER BY c.sort_order ASC, g.sort_order ASC
      `).all() as any[];
      const grouped: { [key: string]: any[] } = {};
      allGroups.forEach(g => {
        const cat = g.category_name || "";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(g);
      });

      Object.values(grouped).forEach(groupItems => {
        groupItems.forEach((g, i) => {
          db.prepare("UPDATE item_groups SET sort_order = ? WHERE id = ?").run(i + 1, g.id);
          setDoc(doc(firestoreDb, "item_groups", g.id), { sort_order: i + 1 }, { merge: true }).catch(() => {});
        });
      });
    } catch (e) {
      console.error("Post-load re-indexing failed:", e);
    }
  } catch (error) {
    console.error("Error loading data from Firestore:", error);
  }
}

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

type OperationType = typeof OperationType[keyof typeof OperationType];

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = firestoreAuth.currentUser;
  if (!currentUser) {
    // Silently skip Firestore errors when the server is not authenticated
    // to prevent spamming the console if the user hasn't enabled Email/Password auth.
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

function formatTableNumber(num: number | string) {
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (isNaN(n)) return num;
  return n < 10 ? `0${n}` : `${n}`;
}

async function startServer() {
  console.log("[Server] Starting initialization...");
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Basic health check to confirm server is responding
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  const hostUser = db.prepare("SELECT * FROM users WHERE username = ?").get("deckserrinha") as any;
  const hostId = hostUser?.id || "deckserrinha";

  // IMPORTANT: Initialize sync IN PARALLEL or non-blocking to allow port binding
  // But we want it started before or during port binding
  const syncPromise = loadFromFirestore(hostId).catch(err => {
    console.error("[Server] Initial Firestore sync failed:", err);
  });

  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade for WebSocket
  // Note: We'll attach this after listen

  // Periodic sync from Firestore every 60 minutes (reduced frequency to save on costs)
  setInterval(async () => {
    console.log("Periodic Firestore sync starting...");
    try {
      await loadFromFirestore(hostId);
      
      // Broadcast updates only if necessary, binned together
      const tables = db.prepare("SELECT * FROM tables").all();
      broadcast({ type: "TABLES_SYNC", payload: tables });
      
      const menu = db.prepare("SELECT * FROM menu_items").all();
      broadcast({ type: "MENU_UPDATE", payload: menu });
      
      const history = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
      broadcast({ type: "HISTORY_UPDATE", payload: history });
    } catch (err) {
      console.error("Periodic sync failed:", err);
    }
  }, 60 * 60 * 1000);

  const clients = new Map<WebSocket, { userId?: string, username?: string, role?: string }>();

  function broadcast(data: any, excludeWs?: WebSocket) {
    const message = JSON.stringify(data);
    clients.forEach((_, client) => {
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        client.send(message);
      }
    });
  }

  // Real-time Firestore Listeners to keep SQLite in sync across multiple server instances or manual Firestore edits
  onSnapshot(collection(firestoreDb, "tables"), (snapshot) => {
    let hasChanges = false;
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const tableId = parseInt(change.doc.id);
      if (isNaN(tableId)) return;
      
      hasChanges = true;
      if (change.type === "added" || change.type === "modified") {
        db.prepare("INSERT OR REPLACE INTO tables (id, number, status, customer_name, people_count, opened_at, type) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(tableId, data.number || tableId, data.status || 'free', data.customer_name || null, data.people_count || null, data.opened_at || null, data.type || 'salao');
      } else if (change.type === "removed") {
        db.prepare("DELETE FROM tables WHERE id = ?").run(tableId);
      }
    });

    if (hasChanges) {
      const tables = db.prepare("SELECT * FROM tables").all();
      broadcast({ type: "TABLES_SYNC", payload: tables });
    }
  });

  onSnapshot(collection(firestoreDb, "orders"), (snapshot) => {
    let hasChanges = false;
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      hasChanges = true;
      if (change.type === "added" || change.type === "modified") {
        db.prepare("INSERT OR REPLACE INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(change.doc.id, data.table_id, data.menu_item_id, data.quantity, data.status, data.is_read || 0, data.observation || null, data.timestamp);
      } else if (change.type === "removed") {
        db.prepare("DELETE FROM orders WHERE id = ?").run(change.doc.id);
      }
    });

    if (hasChanges) {
      const orders = db.prepare(`
        SELECT o.*, m.name as item_name, m.price as item_price, m.type as category, m.category as "group" 
        FROM orders o 
        JOIN menu_items m ON o.menu_item_id = m.id
      `).all();
      broadcast({ type: "ORDERS_SYNC", payload: orders });
    }
  });

  onSnapshot(collection(firestoreDb, "history"), (snapshot) => {
    let hasChanges = false;
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      hasChanges = true;
      if (change.type === "added" || change.type === "modified") {
        db.prepare("INSERT OR REPLACE INTO history (id, user_id, username, action, details, order_id, item_group, table_id, request_id, is_read, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(change.doc.id, data.user_id, data.username, data.action, data.details, data.order_id || null, data.item_group || null, data.table_id || null, data.request_id || null, data.is_read || 0, data.timestamp);
      } else if (change.type === "removed") {
        db.prepare("DELETE FROM history WHERE id = ?").run(change.doc.id);
      }
    });

    if (hasChanges) {
      broadcast({ type: "HISTORY_UPDATE", payload: db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all() });
    }
  });

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
    
    await setDoc(doc(firestoreDb, "history", id), {
      user_id: userId,
      username: username,
      action: action,
      details: details,
      order_id: orderId || null,
      item_group: itemGroup || null,
      table_id: tableId || null,
      request_id: requestId || null,
      is_read: 0,
      timestamp: timestamp
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, "history"));

    const history = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
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

    const activeSession = db.prepare("SELECT * FROM cashier_sessions WHERE status = 'open'").get() as any;
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
      const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(activeSession.id);
      ws.send(JSON.stringify({ type: "CASHIER_TRANSACTIONS", payload: transactions }));
    } else {
      ws.send(JSON.stringify({ type: "CASHIER_STATUS", payload: { status: 'closed' } }));
    }

    const tasks = db.prepare("SELECT * FROM tasks ORDER BY timestamp DESC").all();
    ws.send(JSON.stringify({ type: "TASKS_SYNC", payload: tasks }));

    const accountsPayable = db.prepare("SELECT * FROM accounts_payable ORDER BY due_date ASC").all();
    ws.send(JSON.stringify({ type: "ACCOUNTS_PAYABLE_SYNC", payload: accountsPayable }));

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case "FULL_SYNC": {
            console.log("FULL_SYNC requested");
            const tables = db.prepare("SELECT * FROM tables").all();
            ws.send(JSON.stringify({ type: "TABLES_SYNC", payload: tables }));
            
            const menu = db.prepare("SELECT * FROM menu_items").all();
            ws.send(JSON.stringify({ type: "MENU_UPDATE", payload: menu }));
            
            const history = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
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
            
            const onlineUsers = Array.from(clients.values())
              .filter(u => u.userId)
              .map(u => ({ userId: u.userId, username: u.username, role: u.role }));
            ws.send(JSON.stringify({ type: "ONLINE_USERS", payload: onlineUsers }));
            
            const activeSession = db.prepare("SELECT * FROM cashier_sessions WHERE status = 'open'").get() as any;
            if (activeSession) {
              ws.send(JSON.stringify({ 
                type: "CASHIER_STATUS", 
                payload: { 
                  status: 'open', 
                  sessionId: activeSession.id, 
                  initialBalance: activeSession.initial_balance 
                } 
              }));
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(activeSession.id);
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
            const allHistory = db.prepare("SELECT * FROM history ORDER BY timestamp DESC").all();
            ws.send(JSON.stringify({ type: "HISTORY_ALL_DATA", payload: allHistory }));
            break;
          }

          case "CASHIER_OPEN": {
            const { userId, username, initialBalance } = data.payload;
            const id = uuidv4();
            const timestamp = new Date().toISOString();
            db.prepare("INSERT INTO cashier_sessions (id, opened_at, opened_by_id, opened_by_name, initial_balance, status) VALUES (?, ?, ?, ?, ?, ?)")
              .run(id, timestamp, userId, username, initialBalance, 'open');
            
            setDoc(doc(firestoreDb, "cashier_sessions", id), {
              opened_at: timestamp, opened_by_id: userId, opened_by_name: username, initial_balance: initialBalance, status: 'open'
            }).catch(e => handleFirestoreError(e, OperationType.CREATE, "cashier_sessions"));
            
            broadcast({ type: "CASHIER_STATUS", payload: { status: 'open', sessionId: id, initialBalance, openedAt: timestamp } });
            broadcast({ type: "CASHIER_TRANSACTIONS", payload: [] });
            
            broadcast({
              type: "PRINT_COMMAND",
              payload: {
                type: 'cashier_open', // Specific type
                title: 'Abertura de Caixa',
                operator: username,
                data: { 'Saldo Inicial': initialBalance }
              }
            });
            break;
          }

          case "CASHIER_CLOSE": {
            const { userId, username, sessionId, finalBalance } = data.payload;
            const timestamp = new Date().toISOString();

            // Calculate summary for printing
            const session = db.prepare("SELECT * FROM cashier_sessions WHERE id = ?").get(sessionId) as any;
            const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ?").all(sessionId) as any[];
            
            const income = transactions.filter(t => t.type === 'sale' || t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            const byMethod = transactions.filter(t => t.type === 'sale' || t.type === 'income').reduce((acc, t) => {
              const m = t.method || 'outros';
              acc[m] = (acc[m] || 0) + t.amount;
              return acc;
            }, {} as any);

            db.prepare("UPDATE cashier_sessions SET closed_at = ?, closed_by_id = ?, closed_by_name = ?, final_balance = ?, status = ? WHERE id = ?")
              .run(timestamp, userId, username, finalBalance, 'closed', sessionId);
            
            setDoc(doc(firestoreDb, "cashier_sessions", sessionId), {
              closed_at: timestamp, closed_by_id: userId, closed_by_name: username, final_balance: finalBalance, status: 'closed'
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "cashier_sessions"));
            
            broadcast({ type: "CASHIER_STATUS", payload: { status: 'closed' } });

            broadcast({
              type: "PRINT_COMMAND",
              payload: {
                type: 'cashier_close', // Specific type
                title: 'Fechamento de Caixa',
                operator: username,
                data: {
                  'Abertura': new Date(session.opened_at).toLocaleString(),
                  'Saldo Inicial': session.initial_balance,
                  'Total Entradas': income,
                  'Total Saídas': expense,
                  'Saldo Final': finalBalance,
                  'Entradas por Método': byMethod
                }
              }
            });
            break;
          }

          case "CASHIER_TRANSACTION": {
            const { sessionId, type, amount, description, method, userId, username } = data.payload;
            const id = uuidv4();
            const timestamp = new Date().toISOString();
            db.prepare("INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .run(id, sessionId, type, amount, description, method.toLowerCase(), timestamp, userId, username);
            
            setDoc(doc(firestoreDb, "cashier_transactions", id), {
              session_id: sessionId, type, amount, description: description || null, method: method.toLowerCase(), timestamp, user_id: userId || null, username: username || null
            }).catch(e => handleFirestoreError(e, OperationType.CREATE, "cashier_transactions"));

            const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(sessionId);
            broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });

            if (type === 'expense' || type === 'income') {
              broadcast({
                type: "PRINT_COMMAND",
                payload: {
                  type: 'cashier_slip',
                  title: type === 'expense' ? 'Comprovante de Sangria' : 'Comprovante de Reforço',
                  operator: username,
                  data: {
                    'Valor': amount,
                    'Descrição': description,
                    'Método': method
                  }
                }
              });
            }
            break;
          }

          case "CASHIER_TRANSACTION_UPDATE": {
            const { transactionId, method, amount, description, userId, username } = data.payload;
            const existingT = db.prepare("SELECT * FROM cashier_transactions WHERE id = ?").get(transactionId) as any;
            
            if (existingT) {
              db.prepare("UPDATE cashier_transactions SET method = ?, amount = ?, description = ? WHERE id = ?")
                .run(method.toLowerCase(), amount, description || existingT.description, transactionId);

              // Update Firestore
              setDoc(doc(firestoreDb, "cashier_transactions", transactionId), {
                method: method.toLowerCase(),
                amount,
                description: description || existingT.description
              }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "cashier_transactions"));

              const sessionId = existingT.session_id;
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(sessionId);
              broadcast({ type: "CASHIER_TRANSACTIONS", payload: transactions });
              broadcast({ type: "NOTIFICATION", payload: { message: "Transação atualizada!", type: 'success' } });
              
              await logHistory(userId, username, "CASHIER_EDIT", `Transação editada de ${existingT.method}/R$${existingT.amount} para ${method}/R$${amount}`);
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
                db.prepare("INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                  .run(uuidv4(), sessionId, 'expense', account.amount, `Pagamento: ${account.description}`, 'dinheiro', new Date().toISOString(), userId, username);
                
                const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(sessionId);
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
              setDoc(doc(firestoreDb, "settings", key), { value: String(value) }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "settings"));
            }
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

          case "ROLE_RENAME": {
            const { oldName, newName } = data.payload;
            db.prepare("UPDATE users SET role = ? WHERE role = ?").run(newName, oldName);
            const oldPermsKey = `permissions_${oldName}`;
            const newPermsKey = `permissions_${newName}`;
            const oldPerms = db.prepare("SELECT value FROM settings WHERE key = ?").get(oldPermsKey) as any;
            if (oldPerms) {
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(newPermsKey, oldPerms.value);
              db.prepare("DELETE FROM settings WHERE key = ?").run(oldPermsKey);
            }
            const customRolesStr = db.prepare("SELECT value FROM settings WHERE key = 'custom_roles'").get() as any;
            if (customRolesStr) {
              let roles = JSON.parse(customRolesStr.value);
              roles = roles.map((r: string) => r === oldName ? newName : r);
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('custom_roles', JSON.stringify(roles));
            }
            const users = db.prepare("SELECT * FROM users").all();
            broadcast({ type: "USERS_SYNC", payload: users });
            const settings = db.prepare("SELECT * FROM settings").all();
            const settingsObj = settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            broadcast({ type: "SETTINGS_UPDATE", payload: settingsObj });
            break;
          }

          case "ROLE_DELETE": {
            const { roleName } = data.payload;
            db.prepare("UPDATE users SET role = 'waiter' WHERE role = ?").run(roleName);
            db.prepare("DELETE FROM settings WHERE key = ?").run(`permissions_${roleName}`);
            const customRolesStr = db.prepare("SELECT value FROM settings WHERE key = 'custom_roles'").get() as any;
            if (customRolesStr) {
              let roles = JSON.parse(customRolesStr.value);
              roles = roles.filter((r: string) => r !== roleName);
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('custom_roles', JSON.stringify(roles));
            }
            const users = db.prepare("SELECT * FROM users").all();
            broadcast({ type: "USERS_SYNC", payload: users });
            const settings = db.prepare("SELECT * FROM settings").all();
            const settingsObj = settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            broadcast({ type: "SETTINGS_UPDATE", payload: settingsObj });
            break;
          }

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
            
            // Sync order deletion to Firestore using batch
            const ordersQuery = query(collection(firestoreDb, "orders"), where("table_id", "==", tableId));
            const ordersToDelete = await getDocs(ordersQuery).catch(e => handleFirestoreError(e, OperationType.GET, "orders"));
            
            if (ordersToDelete && !ordersToDelete.empty) {
              const batch = writeBatch(firestoreDb);
              ordersToDelete.docs.forEach(orderDoc => {
                batch.delete(orderDoc.ref);
              });
              await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, "orders"));
            }
            
            const openedAt = new Date().toISOString();
            db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ?, type = ? WHERE id = ?")
              .run(data.payload.customerName, data.payload.peopleCount, openedAt, tableType, tableId);
            
            await setDoc(doc(firestoreDb, "tables", String(tableId)), {
              number: tableId,
              status: 'open',
              customer_name: data.payload.customerName || null,
              people_count: data.payload.peopleCount || null,
              opened_at: openedAt,
              type: tableType
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "tables"));

            const updatedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
            broadcast({ type: "TABLE_UPDATE", payload: updatedTable });
            broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${formatTableNumber(tableId)} (${currentType.name}) aberta`, type: 'info' } });
            
            await logHistory(data.payload.userId, data.payload.username, "ABRIR_MESA", `(${currentType.name}) aberta para ${data.payload.customerName || 'N/A'}`, null, null, tableId);
            break;
          }

          case "TABLE_UPDATE_DATA":
            db.prepare("UPDATE tables SET customer_name = ?, people_count = ?, type = ? WHERE id = ?")
              .run(data.payload.customerName, data.payload.peopleCount, data.payload.tableType || 'salao', data.payload.tableId);
            await setDoc(doc(firestoreDb, "tables", String(data.payload.tableId)), {
              customer_name: data.payload.customerName || null,
              people_count: data.payload.peopleCount || null,
              type: data.payload.tableType || 'salao'
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "tables"));
            const updatedTableData = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: updatedTableData });
            break;

          case "TABLE_REQUEST_BILL":
            db.prepare("UPDATE tables SET status = 'bill_requested' WHERE id = ?").run(data.payload.tableId);
            await setDoc(doc(firestoreDb, "tables", String(data.payload.tableId)), {
              status: 'bill_requested'
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "tables"));
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
                operator: data.payload.username || 'Sistema'
              }
            });
            break;

          case "TABLE_CLOSE": {
            const { tableId, userId, username, paymentMethods, paymentDetails, total } = data.payload;
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
              methods.forEach((method: string) => {
                const amount = paymentDetails ? paymentDetails[method] : (total / methods.length);
                const description = customerName ? `Venda ${tableNum === -1 ? 'Balcão' : 'Mesa ' + (tableData?.number || tableNum)} (${customerName})` : `Venda ${tableNum === -1 ? 'Balcão' : 'Mesa ' + (tableData?.number || tableNum)}`;
                db.prepare(`
                  INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), activeSession.id, 'sale', amount, description, method.toLowerCase(), new Date().toISOString(), userId, username);
              });
            }

            if (tableNum !== -1) {
              // Clear table in SQLite
              db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL WHERE id = ?")
                .run(tableNum);
              
              // Clear table in Firestore
              await setDoc(doc(firestoreDb, "tables", String(tableNum)), {
                number: tableNum,
                status: 'free',
                customer_name: null,
                people_count: null,
                opened_at: null
              }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "tables"));

              const closedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableNum);
              broadcast({ type: "TABLE_UPDATE", payload: closedTable });
            }
            
            // Broadcast table close unconditionally so that Orders from -1 are deleted in the UI
            broadcast({ type: "TABLE_CLOSE", payload: { tableId: tableNum, paymentMethods: paymentMethods } });

            // Deduct stock for each order
            receiptOrders.forEach((order) => {
              const item = db.prepare("SELECT id, is_stockable, current_stock FROM menu_items WHERE id = ?").get(order.menu_item_id) as any;
              if (item && item.is_stockable) {
                const newStock = Math.max(0, (item.current_stock || 0) - order.quantity);
                db.prepare("UPDATE menu_items SET current_stock = ? WHERE id = ?").run(newStock, order.menu_item_id);
                // Also update Firestore
                setDoc(doc(firestoreDb, "menu_items", order.menu_item_id), { current_stock: newStock }, { merge: true }).catch(() => {});
              }
            });

            // Always clear orders for this table in SQLite (including -1)
            db.prepare("DELETE FROM orders WHERE table_id = ?").run(tableNum);
            
            // Broadcast menu update if stock might have changed
            if (receiptOrders.some(o => db.prepare("SELECT is_stockable FROM menu_items WHERE id = ?").get(o.menu_item_id))) {
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            
            // Clear orders for this table in Firestore using batch
            const closeOrdersQuery = query(collection(firestoreDb, "orders"), where("table_id", "==", tableNum));
            const tableOrdersToDelete = await getDocs(closeOrdersQuery).catch(e => handleFirestoreError(e, OperationType.GET, "orders"));
            
            if (tableOrdersToDelete && !tableOrdersToDelete.empty) {
              const batch = writeBatch(firestoreDb);
              tableOrdersToDelete.docs.forEach(orderDoc => {
                batch.delete(orderDoc.ref);
              });
              await batch.commit().catch(e => handleFirestoreError(e, OperationType.DELETE, "orders"));
            }

            // Print Receipt command broadcast
            if (receiptOrders && receiptOrders.length > 0) {
              broadcast({
                type: "PRINT_COMMAND",
                payload: {
                  type: tableNum === -1 ? 'table_bill' : 'table_close', // Reuse table_bill style for explicit print passing
                  title: 'CUPOM NÃO FISCAL',
                  table: tableData,
                  orders: receiptOrders,
                  operator: username,
                  serviceFeePercentage: tableNum === -1 ? 0 : 10 // explicit 0 fee for balcao receipt format
                }
              });
            }

            if (activeSession) {
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(activeSession.id);
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
              paymentMethods, 
              paymentDetails, 
              total,
              subtotal,
              discount,
              serviceFee 
            } = data.payload;

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
              methods.forEach((method: string) => {
                const amount = paymentDetails ? paymentDetails[method] : (total / methods.length);
                const description = `Venda Balcão (Direta)`;
                db.prepare(`
                  INSERT INTO cashier_transactions (id, session_id, type, amount, description, method, timestamp, user_id, username)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), activeSession.id, 'sale', amount, description, method.toLowerCase(), new Date().toISOString(), userId, username);
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
                        operator: username || 'Sistema',
                        items: itemsToPrint.map((i: any) => ({
                            quantity: i.quantity,
                            item_name: i.item_name || i.name,
                            observation: i.observation,
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
                    total: total
                }
            });

            // 5. Deduct Stock
            items.forEach((item: any) => {
                const menuItemId = item.menuItemId || item.id;
                const dbItem = db.prepare("SELECT id, is_stockable, current_stock FROM menu_items WHERE id = ?").get(menuItemId) as any;
                if (dbItem && dbItem.is_stockable) {
                  const newStock = Math.max(0, (dbItem.current_stock || 0) - item.quantity);
                  db.prepare("UPDATE menu_items SET current_stock = ? WHERE id = ?").run(newStock, menuItemId);
                  // Also update Firestore
                  setDoc(doc(firestoreDb, "menu_items", menuItemId), { current_stock: newStock }, { merge: true }).catch(() => {});
                }
            });

            // 6. Syncs
            if (activeSession) {
              const transactions = db.prepare("SELECT * FROM cashier_transactions WHERE session_id = ? ORDER BY timestamp DESC").all(activeSession.id);
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
            
            // Sync deletion to Firestore
            await deleteDoc(doc(firestoreDb, "tables", String(tableId))).catch(e => handleFirestoreError(e, OperationType.DELETE, "tables"));

            const tables = db.prepare("SELECT * FROM tables").all();
            broadcast({ type: "TABLES_SYNC", payload: tables });
            broadcast({ type: "NOTIFICATION", payload: { message: "Mesa excluída permanentemente", type: 'success' } });
            break;
          }

          case "TABLES_RESET_ALL": {
            const { userId, username } = data.payload;
            db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL").run();
            db.prepare("DELETE FROM orders").run();
            
            // Sync to Firestore
            try {
              const tablesSnapshot = await getDocs(collection(firestoreDb, "tables"));
              if (!tablesSnapshot.empty) {
                const batch = writeBatch(firestoreDb);
                tablesSnapshot.docs.forEach(tableDoc => {
                  batch.update(tableDoc.ref, {
                    status: 'free',
                    customer_name: null,
                    people_count: null,
                    opened_at: null
                  });
                });
                await batch.commit();
              }

              const ordersSnapshot = await getDocs(collection(firestoreDb, "orders"));
              if (!ordersSnapshot.empty) {
                const batch = writeBatch(firestoreDb);
                ordersSnapshot.docs.forEach(orderDoc => {
                  batch.delete(orderDoc.ref);
                });
                await batch.commit();
              }
            } catch (e) {
              console.error("Error resetting Firestore tables/orders:", e);
            }

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
                await setDoc(doc(firestoreDb, "tables", String(tableId)), {
                  status: 'open'
                }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "tables"));
                const updatedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
                broadcast({ type: "TABLE_UPDATE", payload: updatedTable });
              }
            }

            const newOrders: any[] = [];
            const batch = writeBatch(firestoreDb);
            const historyItems: string[] = [];

            for (const item of data.payload.items) {
              const orderId = uuidv4();
              const timestamp = new Date().toISOString();
              
              db.prepare("INSERT INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .run(orderId, tableId, item.menuItemId, item.quantity, 'pending', 0, item.observation || null, timestamp);
              
              const menuItem = db.prepare("SELECT name, price, type, category FROM menu_items WHERE id = ?").get(item.menuItemId) as any;
              
              if (!menuItem) {
                console.error(`Menu item not found: ${item.menuItemId}`);
                continue;
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

              batch.set(doc(firestoreDb, "orders", orderId), orderData);

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

            await batch.commit().catch(e => handleFirestoreError(e, OperationType.CREATE, "orders"));
            
            broadcast({ type: "ORDER_NEW", payload: newOrders });
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
              await deleteDoc(doc(firestoreDb, "orders", data.payload.orderId)).catch(e => handleFirestoreError(e, OperationType.DELETE, "orders"));
              
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
            const historyEvent = db.prepare("SELECT is_read FROM history WHERE id = ?").get(data.payload.historyId) as any;
            if (historyEvent) {
              const newHistoryStatus = historyEvent.is_read === 1 ? 0 : 1;
              db.prepare("UPDATE history SET is_read = ? WHERE id = ?").run(newHistoryStatus, data.payload.historyId);
              setDoc(doc(firestoreDb, "history", data.payload.historyId), { is_read: newHistoryStatus }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "history"));
              const updatedHistoryList = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
              broadcast({ type: "HISTORY_UPDATE", payload: updatedHistoryList });
            }
            break;

          case "HISTORY_DELETE":
            const historyItem = db.prepare("SELECT id FROM history WHERE id = ?").get(data.payload.historyId) as any;
            if (historyItem) {
              db.prepare("DELETE FROM history WHERE id = ?").run(data.payload.historyId);
              deleteDoc(doc(firestoreDb, "history", data.payload.historyId)).catch(e => handleFirestoreError(e, OperationType.DELETE, "history"));
              const updatedHistoryList = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
              broadcast({ type: "HISTORY_UPDATE", payload: updatedHistoryList });
              broadcast({ type: "NOTIFICATION", payload: { message: "Item do histórico excluído com sucesso", type: "success" } }, ws);
            }
            break;

          case "ORDER_MARK_READ":
            const currentOrder = db.prepare("SELECT is_read FROM orders WHERE id = ?").get(data.payload.orderId) as any;
            if (currentOrder) {
              const newStatus = currentOrder.is_read === 1 ? 0 : 1;
              db.prepare("UPDATE orders SET is_read = ? WHERE id = ?").run(newStatus, data.payload.orderId);
              setDoc(doc(firestoreDb, "orders", data.payload.orderId), { is_read: newStatus }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "orders"));
              
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
            const batch = writeBatch(firestoreDb);
            
            // Ensure destination table is open
            const toTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(toTableId);
            const fromTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(fromTableId);
            
            if (toTable.status === 'free') {
              const openedAt = new Date().toISOString();
              const finalType = targetType || fromTable.type || 'salao';
              db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ?, type = ? WHERE id = ?")
                .run(fromTable.customer_name, fromTable.people_count, openedAt, finalType, toTableId);
              
              await setDoc(doc(firestoreDb, "tables", String(toTableId)), {
                status: 'open',
                customer_name: fromTable.customer_name,
                people_count: fromTable.people_count,
                opened_at: openedAt,
                type: finalType
              }, { merge: true });
            }

            for (const orderId of orderIds) {
              db.prepare("UPDATE orders SET table_id = ? WHERE id = ?").run(toTableId, orderId);
              batch.update(doc(firestoreDb, "orders", orderId), { table_id: toTableId });
            }
            
            await batch.commit();

            // Check if fromTable is now empty
            const remainingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ?").get(fromTableId);
            if (remainingOrders.count === 0) {
              db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL, type = 'salao' WHERE id = ?").run(fromTableId);
              await setDoc(doc(firestoreDb, "tables", String(fromTableId)), {
                status: 'free',
                customer_name: null,
                people_count: null,
                opened_at: null,
                type: 'salao'
              }, { merge: true });
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
            const batch = writeBatch(firestoreDb);
            
            const toTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(request.to_table_id);
            const fromTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(request.from_table_id);
            
            if (toTable.status === 'free') {
              const openedAt = new Date().toISOString();
              const finalType = request.target_type || fromTable.type || 'salao';
              db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ?, type = ? WHERE id = ?")
                .run(fromTable.customer_name, fromTable.people_count, openedAt, finalType, request.to_table_id);
              
              await setDoc(doc(firestoreDb, "tables", String(request.to_table_id)), {
                status: 'open',
                customer_name: fromTable.customer_name,
                people_count: fromTable.people_count,
                opened_at: openedAt,
                type: finalType
              }, { merge: true });
            }

            for (const orderId of orderIds) {
              db.prepare("UPDATE orders SET table_id = ? WHERE id = ?").run(request.to_table_id, orderId);
              batch.update(doc(firestoreDb, "orders", orderId), { table_id: request.to_table_id });
            }
            
            await batch.commit();

            const remainingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ?").get(request.from_table_id);
            if (remainingOrders.count === 0) {
              db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL, type = 'salao' WHERE id = ?").run(request.from_table_id);
              await setDoc(doc(firestoreDb, "tables", String(request.from_table_id)), {
                status: 'free',
                customer_name: null,
                people_count: null,
                opened_at: null,
                type: 'salao'
              }, { merge: true });
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

          case "MENU_ADD": {
            const newItemId = uuidv4();
            const createdAt = new Date().toISOString();
            db.prepare("INSERT INTO menu_items (id, name, price, type, category, active, print_enabled, created_at, is_stockable, is_solid, current_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
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
                data.payload.current_stock || 0
              );
            setDoc(doc(firestoreDb, "menu_items", newItemId), {
              name: data.payload.name,
              price: data.payload.price,
              type: data.payload.type ?? null,
              category: data.payload.category ?? null,
              active: data.payload.active ? 1 : 0,
              print_enabled: data.payload.print_enabled ? 1 : 0,
              created_at: createdAt,
              is_stockable: data.payload.is_stockable ? 1 : 0,
              is_solid: data.payload.is_solid ? 1 : 0,
              current_stock: data.payload.current_stock || 0
            }).catch(e => handleFirestoreError(e, OperationType.CREATE, "menu_items"));
            const newMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: newMenu });
            break;
          }

          case "MENU_DELETE":
            db.prepare("DELETE FROM menu_items WHERE id = ?").run(data.payload.id);
            deleteDoc(doc(firestoreDb, "menu_items", data.payload.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "menu_items"));
            const updatedMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: updatedMenu });
            break;

          case "MENU_EDIT":
            db.prepare("UPDATE menu_items SET name = ?, price = ?, type = ?, category = ?, active = ?, print_enabled = ?, is_stockable = ?, is_solid = ? WHERE id = ?")
              .run(
                data.payload.name, 
                data.payload.price, 
                data.payload.type, 
                data.payload.category, 
                data.payload.active ? 1 : 0, 
                data.payload.print_enabled ? 1 : 0, 
                data.payload.is_stockable ? 1 : 0,
                data.payload.is_solid ? 1 : 0,
                data.payload.id
              );
            setDoc(doc(firestoreDb, "menu_items", data.payload.id), {
              name: data.payload.name,
              price: data.payload.price,
              type: data.payload.type ?? null,
              category: data.payload.category ?? null,
              active: data.payload.active ? 1 : 0,
              print_enabled: data.payload.print_enabled ? 1 : 0,
              is_stockable: data.payload.is_stockable ? 1 : 0,
              is_solid: data.payload.is_solid ? 1 : 0
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
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
            
            setDoc(doc(firestoreDb, "stock_purchases", purchaseId), {
              menu_item_id,
              quantity,
              cost_price,
              timestamp,
              user_id: userId,
              username
            }).catch(e => handleFirestoreError(e, OperationType.CREATE, "stock_purchases"));
            
            const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(menu_item_id) as any;
            if (item) {
              setDoc(doc(firestoreDb, "menu_items", menu_item_id), {
                current_stock: item.current_stock
              }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
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
            setDoc(doc(firestoreDb, "categories", newCatId), { name: data.payload.name, sort_order: maxCatOrder + 1 }).catch(e => handleFirestoreError(e, OperationType.CREATE, "categories"));
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            break;

          case "CATEGORY_EDIT": {
            const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldCat && oldCat.name !== data.payload.name) {
              db.prepare("UPDATE menu_items SET type = ? WHERE type = ?").run(data.payload.name, oldCat.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE type = ?").all(data.payload.name) as any[];
              for (const item of updatedItems) {
                setDoc(doc(firestoreDb, "menu_items", item.id), { type: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });

              // Update related groups
              db.prepare("UPDATE item_groups SET category_name = ? WHERE category_name = ?").run(data.payload.name, oldCat.name);
              const updatedGroups = db.prepare("SELECT * FROM item_groups WHERE category_name = ?").all(data.payload.name) as any[];
              for (const group of updatedGroups) {
                setDoc(doc(firestoreDb, "item_groups", group.id), { category_name: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
              }
              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
            }
            db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(data.payload.name, data.payload.id);
            setDoc(doc(firestoreDb, "categories", data.payload.id), { name: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "categories"));
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            break;
          }

          case "CATEGORY_DELETE": {
            const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldCat) {
              db.prepare("UPDATE menu_items SET type = NULL WHERE type = ?").run(oldCat.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE type IS NULL").all() as any[];
              for (const item of updatedItems) {
                setDoc(doc(firestoreDb, "menu_items", item.id), { type: null }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });

              // Update related groups
              db.prepare("UPDATE item_groups SET category_name = NULL WHERE category_name = ?").run(oldCat.name);
              const updatedGroups = db.prepare("SELECT * FROM item_groups WHERE category_name IS NULL").all() as any[];
              for (const group of updatedGroups) {
                setDoc(doc(firestoreDb, "item_groups", group.id), { category_name: null }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
              }
              broadcast({ type: "DETAILS_UPDATE", payload: db.prepare(`
                SELECT g.* 
                FROM item_groups g 
                LEFT JOIN categories c ON g.category_name = c.name 
                ORDER BY c.sort_order ASC, g.sort_order ASC
              `).all() });
            }
            db.prepare("DELETE FROM categories WHERE id = ?").run(data.payload.id);
            deleteDoc(doc(firestoreDb, "categories", data.payload.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "categories"));
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all() });
            break;
          }

          case "CATEGORY_TOGGLE_PRINT": {
            const { id, enabled } = data.payload;
            const val = enabled ? 1 : 0;
            const cat = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as { name: string };
            if (cat) {
              db.prepare("UPDATE categories SET print_enabled = ? WHERE id = ?").run(val, id);
              setDoc(doc(firestoreDb, "categories", id), { print_enabled: val }, { merge: true }).catch(() => {});
              
              // Cascade to groups
              db.prepare("UPDATE item_groups SET print_enabled = ? WHERE category_name = ?").run(val, cat.name);
              const groups = db.prepare("SELECT id FROM item_groups WHERE category_name = ?").all() as { id: string }[];
              for (const g of groups) {
                setDoc(doc(firestoreDb, "item_groups", g.id), { print_enabled: val }, { merge: true }).catch(() => {});
              }

              // Cascade to items
              db.prepare("UPDATE menu_items SET print_enabled = ? WHERE type = ?").run(val, cat.name);
              const items = db.prepare("SELECT id FROM menu_items WHERE type = ?").all() as { id: string }[];
              for (const item of items) {
                setDoc(doc(firestoreDb, "menu_items", item.id), { print_enabled: val }, { merge: true }).catch(() => {});
              }

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
              setDoc(doc(firestoreDb, "item_groups", id), { print_enabled: val }, { merge: true }).catch(() => {});

              // Cascade to items
              db.prepare("UPDATE menu_items SET print_enabled = ? WHERE category = ?").run(val, group.name);
              const items = db.prepare("SELECT id FROM menu_items WHERE category = ?").all() as { id: string }[];
              for (const item of items) {
                setDoc(doc(firestoreDb, "menu_items", item.id), { print_enabled: val }, { merge: true }).catch(() => {});
              }

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
            setDoc(doc(firestoreDb, "menu_items", id), { print_enabled: val }, { merge: true }).catch(() => {});
            broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            break;
          }

          case "CATEGORY_SAVE_CONFIG": {
            const { categories } = data.payload;
            if (Array.isArray(categories)) {
              for (const item of categories) {
                const oldCat = db.prepare("SELECT name, print_enabled FROM categories WHERE id = ?").get(item.id) as { name: string, print_enabled: number };
                db.prepare("UPDATE categories SET sort_order = ?, print_enabled = ? WHERE id = ?").run(item.sort_order, item.print_enabled, item.id);
                setDoc(doc(firestoreDb, "categories", item.id), { sort_order: item.sort_order, print_enabled: item.print_enabled }, { merge: true }).catch(() => {});
                
                // If print_enabled changed, cascade to items (groups are already handled by the batch save from frontend)
                if (oldCat && oldCat.print_enabled !== item.print_enabled) {
                  db.prepare("UPDATE menu_items SET print_enabled = ? WHERE type = ?").run(item.print_enabled, oldCat.name);
                  const items = db.prepare("SELECT id FROM menu_items WHERE type = ?").all(oldCat.name) as { id: string }[];
                  for (const m of items) {
                    setDoc(doc(firestoreDb, "menu_items", m.id), { print_enabled: item.print_enabled }, { merge: true }).catch(() => {});
                  }
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
                setDoc(doc(firestoreDb, "item_groups", item.id), { sort_order: item.sort_order, print_enabled: item.print_enabled, show_in_history: item.show_in_history }, { merge: true }).catch(() => {});
                
                // If print_enabled changed, cascade to items
                if (oldGroup && oldGroup.print_enabled !== item.print_enabled) {
                  db.prepare("UPDATE menu_items SET print_enabled = ? WHERE category = ?").run(item.print_enabled, oldGroup.name);
                  const items = db.prepare("SELECT id FROM menu_items WHERE category = ?").all(oldGroup.name) as { id: string }[];
                  for (const m of items) {
                    setDoc(doc(firestoreDb, "menu_items", m.id), { print_enabled: item.print_enabled }, { merge: true }).catch(() => {});
                  }
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
                setDoc(doc(firestoreDb, "categories", c.id), { sort_order: newOrder }, { merge: true }).catch(() => {});
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
            setDoc(doc(firestoreDb, "item_groups", newGroupId), { name: data.payload.name, category_name: data.payload.category_name, sort_order: maxGroupOrder + 1 }).catch(e => handleFirestoreError(e, OperationType.CREATE, "item_groups"));
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
                setDoc(doc(firestoreDb, "item_groups", g.id), { sort_order: newOrder }, { merge: true }).catch(() => {});
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
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE category = ?").all(data.payload.name) as any[];
              for (const item of updatedItems) {
                setDoc(doc(firestoreDb, "menu_items", item.id), { category: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            
            if (oldGroup && oldGroup.category_name !== data.payload.category_name) {
              const maxGroupOrder = (db.prepare("SELECT MAX(sort_order) as maxOrder FROM item_groups WHERE IFNULL(category_name, '') = IFNULL(?, '')").get(data.payload.category_name) as any).maxOrder || 0;
              db.prepare("UPDATE item_groups SET name = ?, category_name = ?, sort_order = ? WHERE id = ?").run(data.payload.name, data.payload.category_name, maxGroupOrder + 1, data.payload.id);
              setDoc(doc(firestoreDb, "item_groups", data.payload.id), { name: data.payload.name, category_name: data.payload.category_name, sort_order: maxGroupOrder + 1 }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
            } else {
              db.prepare("UPDATE item_groups SET name = ?, category_name = ? WHERE id = ?").run(data.payload.name, data.payload.category_name, data.payload.id);
              setDoc(doc(firestoreDb, "item_groups", data.payload.id), { name: data.payload.name, category_name: data.payload.category_name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
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
            setDoc(doc(firestoreDb, "item_groups", id), { show_in_history: show ? 1 : 0 }, { merge: true }).catch(() => {});
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
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE category IS NULL").all() as any[];
              for (const item of updatedItems) {
                setDoc(doc(firestoreDb, "menu_items", item.id), { category: null }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            db.prepare("DELETE FROM item_groups WHERE id = ?").run(data.payload.id);
            deleteDoc(doc(firestoreDb, "item_groups", data.payload.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "item_groups"));
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
  app.post("/api/login", (req, res) => {
    const { username, password, token } = req.body;
    let user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    
    // Safety fallback for Dev user
    if (!user && username === 'Dev' && password === '2212') {
       user = db.prepare("SELECT * FROM users WHERE username = 'Dev'").get() as any;
       if (!user) {
         const id = uuidv4();
         db.prepare("INSERT INTO users (id, username, password, role, avatar) VALUES (?, 'Dev', '2212', 'host', '👨‍💻')").run(id);
         user = { id, username: 'Dev', role: 'host', avatar: '👨‍💻' };
       }
    }

    if (user) {
      if (user.role !== 'host') {
        const storedToken = db.prepare("SELECT value FROM settings WHERE key = 'access_token'").get() as { value: string };
        if (token !== storedToken.value) {
          return res.status(401).json({ success: false, message: "Token de acesso inválido" });
        }
      }
      res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar || "👤" } });
    } else {
      res.status(401).json({ success: false, message: "Usuário ou senha incorretos" });
    }
  });

  app.post("/api/admin/reset-history", async (req, res) => {
    const requestingUserId = req.headers['x-app-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || requestingUser.role !== 'host') {
      return res.status(403).json({ success: false, message: "Apenas o Host pode limpar o histórico" });
    }

    try {
      db.prepare("DELETE FROM history").run();
      
      // Handle deletion in batches of 500 (Firestore limit)
      let deletedCount = 0;
      while (true) {
        // Fetch a page of history docs using limit instead of problematic __name__ query
        // We use limit(500) because we delete them immediately, so the 'next' 500 will be the head of the collection
        const historySnapshot = await getDocs(query(collection(firestoreDb, "history"), limit(500))).catch(e => {
          console.error("Error fetching history for deletion:", e);
          return null;
        });
        
        if (!historySnapshot || historySnapshot.empty) break;
        
        const batch = writeBatch(firestoreDb);
        let batchSize = 0;
        
        for (const historyDoc of historySnapshot.docs) {
          batch.delete(historyDoc.ref);
          batchSize++;
        }
        
        await batch.commit();
        deletedCount += batchSize;
        
        // If we processed fewer than 500 it means we reached the end
        if (batchSize < 500) break;
        
        // To be safe and avoid infinite loops if it fails to empty
        if (deletedCount > 20000) {
          console.warn("[ResetHistory] Break circuit: too many history records (capped at 20k per reset)");
          break;
        }
      }
      
      broadcast({ type: "HISTORY_UPDATE", payload: [] });
      console.log(`History reset by host. Deleted approx ${deletedCount} docs.`);
      res.json({ success: true });
    } catch (e) {
      console.error("Error resetting history:", e);
      res.status(500).json({ success: false, message: "Erro ao limpar histórico" });
    }
  });

  app.get("/api/debug/schema", (req, res) => {
    try {
      const schema = db.prepare("PRAGMA table_info(users)").all();
      res.json({ success: true, schema });
    } catch (e) {
      res.status(500).json({ success: false, message: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/debug/users", (req, res) => {
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
      db.prepare("INSERT INTO users (id, username, password, role, avatar) VALUES (?, ?, ?, ?, ?)")
        .run(id, username, password, role, avatar || "👤");
      
      setDoc(doc(firestoreDb, "users", id), {
        username: username,
        email: `${username}@deckserrinha.com`,
        password: password,
        role: role,
        avatar: avatar || "👤"
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, "users"));

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

        await deleteDoc(doc(firestoreDb, "users", req.params.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "users"));
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
        query += ", password = ?";
        params.push(password);
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

      const updateData: any = {};
      if (username !== undefined) updateData.username = username;
      if (password !== undefined) updateData.password = password;
      if (role !== undefined) updateData.role = role;
      if (avatar !== undefined) updateData.avatar = avatar;

      setDoc(doc(firestoreDb, "users", req.params.id), updateData, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "users"));

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
          const insertCat = db.prepare("INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)");
          for (const cat of categories) {
            const id = cat.id || uuidv4();
            insertCat.run(id, cat.name);
            setDoc(doc(firestoreDb, "categories", id), { name: cat.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "categories"));
          }
        }

        if (itemGroups.length > 0) {
          const insertGroup = db.prepare("INSERT OR REPLACE INTO item_groups (id, name, category_name) VALUES (?, ?, ?)");
          for (const group of itemGroups) {
            const id = group.id || uuidv4();
            insertGroup.run(id, group.name, group.category_name || null);
            setDoc(doc(firestoreDb, "item_groups", id), { name: group.name, category_name: group.category_name || null }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
          }
        }

        if (menuItems.length > 0) {
          const insertMenu = db.prepare("INSERT OR REPLACE INTO menu_items (id, name, price, type, category, active) VALUES (?, ?, ?, ?, ?, ?)");
          for (const item of menuItems) {
            const id = item.id || uuidv4();
            const active = item.active !== undefined ? item.active : 1;
            insertMenu.run(id, item.name, item.price, item.type, item.category, active);
            setDoc(doc(firestoreDb, "menu_items", id), {
              name: item.name,
              price: item.price,
              type: item.type ?? null,
              category: item.category ?? null,
              active: active
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
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

  const server = app.listen(PORT, "0.0.0.0", async () => {
    console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
    
    // Ensure sync is complete after port is bound if it hasn't already
    await syncPromise;
    console.log("[Server] Sync background task completed/ready.");
    
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
