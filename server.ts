import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { db as firestoreDb, auth as firestoreAuth } from "./firebase.ts";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("deck_serrinha.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY,
    number INTEGER UNIQUE,
    status TEXT DEFAULT 'free',
    customer_name TEXT,
    people_count INTEGER,
    opened_at TEXT
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT,
    price REAL,
    type TEXT,
    category TEXT,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS item_groups (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE
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
    is_read INTEGER DEFAULT 0,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed initial settings
const serviceFeeExists = db.prepare("SELECT * FROM settings WHERE key = ?").get("service_fee");
if (!serviceFeeExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("service_fee", "10");
}

const tokenExists = db.prepare("SELECT * FROM settings WHERE key = ?").get("access_token");
if (!tokenExists) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("access_token", "123456");
}

try {
  db.prepare("ALTER TABLE orders ADD COLUMN is_read INTEGER DEFAULT 0").run();
} catch (e) {
  // Column already exists
}

// Migration for legacy roles
try {
  db.prepare("UPDATE users SET role = 'waiter' WHERE role = 'user'").run();
} catch (e) {
  console.error("Error migrating legacy roles:", e);
}

try {
  db.prepare("ALTER TABLE history ADD COLUMN order_id TEXT").run();
} catch (e) {
  // Column already exists
}

try {
  db.prepare("ALTER TABLE menu_items ADD COLUMN active INTEGER DEFAULT 1").run();
} catch (e) {
  // Column already exists
}

// Seed initial data
const hostExists = db.prepare("SELECT * FROM users WHERE username = ?").get("deckserrinha");
if (!hostExists) {
  db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)")
    .run(uuidv4(), "deckserrinha", "deckappadmin", "host");
}

const tablesCount = db.prepare("SELECT COUNT(*) as count FROM tables").get() as { count: number };
if (tablesCount.count === 0) {
  for (let i = 1; i <= 30; i++) {
    db.prepare("INSERT INTO tables (id, number) VALUES (?, ?)").run(i, i);
  }
}

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

async function authenticateServer() {
  const email = "server@deckserrinha.com";
  // Use a deterministic password based on the database or a hardcoded one for this applet
  const password = "ServerPassword123!";
  
  return new Promise<void>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(firestoreAuth, (user) => {
      if (user) {
        console.log("Server authenticated with Firestore successfully.");
        unsubscribe();
        resolve();
      }
    });

    signInWithEmailAndPassword(firestoreAuth, email, password)
      .then(async (userCredential) => {
        // Ensure server user exists in Firestore users collection
        try {
          await setDoc(doc(firestoreDb, "users", userCredential.user.uid), {
            username: "server",
            email: email,
            role: "host"
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
                  username: "server",
                  email: email,
                  role: "host"
                }, { merge: true });
              } catch (e) {
                console.error("Failed to ensure server user in Firestore:", e);
              }
            })
            .catch((createError) => {
              console.error("Failed to create server user:", createError);
              unsubscribe();
              reject(createError);
            });
        } else {
          console.error("Failed to authenticate server:", error);
          unsubscribe();
          reject(error);
        }
      });
  });
}

async function loadFromFirestore() {
  try {
    await authenticateServer();
    console.log("Loading data from Firestore...");
    const menuSnapshot = await getDocs(collection(firestoreDb, "menu_items")).catch(e => handleFirestoreError(e, OperationType.GET, "menu_items"));
    if (menuSnapshot && !menuSnapshot.empty) {
      db.prepare("DELETE FROM menu_items").run();
      const insertMenu = db.prepare("INSERT INTO menu_items (id, name, price, type, category, active) VALUES (?, ?, ?, ?, ?, ?)");
      menuSnapshot.forEach(doc => {
        const data = doc.data();
        insertMenu.run(doc.id, data.name, data.price, data.type, data.category, data.active);
      });
    } else if (menuSnapshot) {
      // Sync SQLite to Firestore
      console.log("Firestore menu_items is empty. Syncing from SQLite...");
      const menuItems = db.prepare("SELECT * FROM menu_items").all() as any[];
      for (const item of menuItems) {
        await setDoc(doc(firestoreDb, "menu_items", item.id), {
          name: item.name,
          price: item.price,
          type: item.type ?? null,
          category: item.category ?? null,
          active: item.active ?? 1
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, "menu_items"));
      }
    }

    const catSnapshot = await getDocs(collection(firestoreDb, "categories")).catch(e => handleFirestoreError(e, OperationType.GET, "categories"));
    if (catSnapshot && !catSnapshot.empty) {
      db.prepare("DELETE FROM categories").run();
      const insertCat = db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)");
      catSnapshot.forEach(doc => {
        const data = doc.data();
        insertCat.run(doc.id, data.name);
      });
    } else if (catSnapshot) {
      console.log("Firestore categories is empty. Syncing from SQLite...");
      const categories = db.prepare("SELECT * FROM categories").all() as any[];
      for (const cat of categories) {
        await setDoc(doc(firestoreDb, "categories", cat.id), { name: cat.name }).catch(e => handleFirestoreError(e, OperationType.CREATE, "categories"));
      }
    }

    const groupSnapshot = await getDocs(collection(firestoreDb, "item_groups")).catch(e => handleFirestoreError(e, OperationType.GET, "item_groups"));
    if (groupSnapshot && !groupSnapshot.empty) {
      db.prepare("DELETE FROM item_groups").run();
      const insertGroup = db.prepare("INSERT INTO item_groups (id, name) VALUES (?, ?)");
      groupSnapshot.forEach(doc => {
        const data = doc.data();
        insertGroup.run(doc.id, data.name);
      });
    } else if (groupSnapshot) {
      console.log("Firestore item_groups is empty. Syncing from SQLite...");
      const groups = db.prepare("SELECT * FROM item_groups").all() as any[];
      for (const group of groups) {
        await setDoc(doc(firestoreDb, "item_groups", group.id), { name: group.name }).catch(e => handleFirestoreError(e, OperationType.CREATE, "item_groups"));
      }
    }
    console.log("Data loaded/synced from Firestore successfully.");
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
  throw new Error(JSON.stringify(errInfo));
}

async function startServer() {
  await loadFromFirestore();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Add is_read column to history if it doesn't exist
  try {
    db.prepare("ALTER TABLE history ADD COLUMN is_read INTEGER DEFAULT 0").run();
  } catch (e) {
    // Column already exists or table doesn't exist yet
  }

  // Add observation column to orders if it doesn't exist
  try {
    db.prepare("ALTER TABLE orders ADD COLUMN observation TEXT").run();
  } catch (e) {
    // Column already exists
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  const clients = new Set<WebSocket>();

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function logHistory(userId: string, username: string, action: string, details: string, orderId: string | null = null) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO history (id, user_id, username, action, details, order_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, username, action, details, orderId, timestamp);
    
    const history = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
    broadcast({ type: "HISTORY_UPDATE", payload: history });
  }

  wss.on("connection", (ws) => {
    clients.add(ws);

    // Initial sync
    const tables = db.prepare("SELECT * FROM tables").all();
    ws.send(JSON.stringify({ type: "TABLES_SYNC", payload: tables }));

    const menu = db.prepare("SELECT * FROM menu_items").all();
    ws.send(JSON.stringify({ type: "MENU_UPDATE", payload: menu }));

    const history = db.prepare(`
      SELECT h.*, o.is_read 
      FROM history h 
      LEFT JOIN orders o ON h.order_id = o.id 
      ORDER BY h.timestamp DESC 
      LIMIT 100
    `).all();
    ws.send(JSON.stringify({ type: "HISTORY_UPDATE", payload: history }));

    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
    ws.send(JSON.stringify({ type: "SETTINGS_UPDATE", payload: settingsObj }));

    const categories = db.prepare("SELECT * FROM categories").all();
    ws.send(JSON.stringify({ type: "CATEGORIES_UPDATE", payload: categories }));

    const groups = db.prepare("SELECT * FROM item_groups").all();
    ws.send(JSON.stringify({ type: "GROUPS_UPDATE", payload: groups }));

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case "SETTINGS_UPDATE":
            let tokenChanged = false;
            Object.entries(data.payload).forEach(([key, value]) => {
              if (key === 'access_token') {
                const currentToken = db.prepare("SELECT value FROM settings WHERE key = 'access_token'").get() as { value: string };
                if (currentToken.value !== value) tokenChanged = true;
              }
              db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));
            });
            const updatedSettings = db.prepare("SELECT * FROM settings").all();
            const updatedSettingsObj = updatedSettings.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            broadcast({ type: "SETTINGS_UPDATE", payload: updatedSettingsObj });
            
            if (tokenChanged) {
              broadcast({ type: "FORCE_LOGOUT", payload: { message: "Token de acesso alterado. Por favor, faça login novamente." } });
            }
            break;

          case "TABLE_OPEN":
            // Ensure no old orders exist for this table
            db.prepare("DELETE FROM orders WHERE table_id = ?").run(data.payload.tableId);
            
            db.prepare("UPDATE tables SET status = 'open', customer_name = ?, people_count = ?, opened_at = ? WHERE id = ?")
              .run(data.payload.customerName, data.payload.peopleCount, new Date().toISOString(), data.payload.tableId);
            const updatedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: updatedTable });
            broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${data.payload.tableId} aberta`, type: 'info' } });
            logHistory(data.payload.userId, data.payload.username, "ABRIR_MESA", `Mesa ${data.payload.tableId} aberta para ${data.payload.customerName || 'N/A'}`);
            break;

          case "TABLE_UPDATE_DATA":
            db.prepare("UPDATE tables SET customer_name = ?, people_count = ? WHERE id = ?")
              .run(data.payload.customerName, data.payload.peopleCount, data.payload.tableId);
            const updatedTableData = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: updatedTableData });
            break;

          case "TABLE_REQUEST_BILL":
            db.prepare("UPDATE tables SET status = 'bill_requested' WHERE id = ?").run(data.payload.tableId);
            const tableWithBill = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: tableWithBill });
            broadcast({ type: "BILL_REQUEST", payload: { tableId: data.payload.tableId, customerName: tableWithBill.customer_name } });
            broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${data.payload.tableId} pediu a conta!`, type: 'warning' } });
            logHistory(data.payload.userId, data.payload.username, "PEDIR_CONTA", `Mesa ${data.payload.tableId} solicitou fechamento`);
            break;

          case "TABLE_CLOSE":
            // Clear table
            db.prepare("UPDATE tables SET status = 'free', customer_name = NULL, people_count = NULL, opened_at = NULL WHERE id = ?")
              .run(data.payload.tableId);
            // Clear orders for this table
            db.prepare("DELETE FROM orders WHERE table_id = ?").run(data.payload.tableId);
            
            const closedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
            broadcast({ type: "TABLE_UPDATE", payload: closedTable });
            broadcast({ type: "BILL_CLOSED", payload: { tableId: data.payload.tableId, paymentMethods: data.payload.paymentMethods } });
            broadcast({ type: "NOTIFICATION", payload: { message: `Mesa ${data.payload.tableId} fechada. Pagamento: ${data.payload.paymentMethods.join(', ')}`, type: 'success' } });
            logHistory(data.payload.userId, data.payload.username, "FECHAR_MESA", `Mesa ${data.payload.tableId} fechada. Métodos: ${data.payload.paymentMethods.join(', ')}`);
            break;

          case "ORDER_SEND":
            // Check if table is in bill_requested status and revert to open
            const currentTableStatus = db.prepare("SELECT status FROM tables WHERE id = ?").get(data.payload.tableId) as any;
            if (currentTableStatus && currentTableStatus.status === 'bill_requested') {
              db.prepare("UPDATE tables SET status = 'open' WHERE id = ?").run(data.payload.tableId);
              const updatedTable = db.prepare("SELECT * FROM tables WHERE id = ?").get(data.payload.tableId);
              broadcast({ type: "TABLE_UPDATE", payload: updatedTable });
            }

            const newOrders: any[] = [];
            data.payload.items.forEach((item: any) => {
              const orderId = uuidv4();
              const timestamp = new Date().toISOString();
              db.prepare("INSERT INTO orders (id, table_id, menu_item_id, quantity, status, is_read, observation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .run(orderId, data.payload.tableId, item.menuItemId, item.quantity, 'pending', 0, item.observation || null, timestamp);
              
              const menuItem = db.prepare("SELECT name, price FROM menu_items WHERE id = ?").get(item.menuItemId) as any;
              
              newOrders.push({
                id: orderId,
                table_id: data.payload.tableId,
                menu_item_id: item.menuItemId,
                quantity: item.quantity,
                status: 'pending',
                is_read: 0,
                observation: item.observation || null,
                timestamp: timestamp,
                item_name: menuItem.name,
                item_price: menuItem.price
              });

              const obsText = item.observation ? ` (Obs: ${item.observation})` : '';
              logHistory(
                data.payload.userId, 
                data.payload.username, 
                "NOVO_PEDIDO", 
                `Mesa ${data.payload.tableId}: ${item.quantity}x ${menuItem.name}${obsText}`,
                orderId
              );
            });
            broadcast({ type: "ORDER_NEW", payload: newOrders });
            broadcast({ type: "NOTIFICATION", payload: { message: `Novo pedido para a Mesa ${data.payload.tableId}`, type: 'info' } });
            break;

          case "ORDER_DELETE":
            const orderToDelete = db.prepare("SELECT * FROM orders WHERE id = ?").get(data.payload.orderId) as any;
            if (orderToDelete) {
              const menuItem = db.prepare("SELECT name FROM menu_items WHERE id = ?").get(orderToDelete.menu_item_id) as any;
              
              db.prepare("DELETE FROM orders WHERE id = ?").run(data.payload.orderId);
              
              const obsText = orderToDelete.observation ? ` (Obs: ${orderToDelete.observation})` : '';
              logHistory(
                data.payload.userId,
                data.payload.username,
                "EXCLUIR_PEDIDO",
                `Mesa ${data.payload.tableId}: ${orderToDelete.quantity}x ${menuItem ? menuItem.name : 'Item'}${obsText} excluído`,
                data.payload.orderId
              );

              broadcast({ type: "ORDER_DELETED", payload: { orderId: data.payload.orderId, tableId: data.payload.tableId } });
              broadcast({ type: "NOTIFICATION", payload: { message: `Pedido excluído da Mesa ${data.payload.tableId}`, type: 'warning' } });
            }
            break;

          case "HISTORY_MARK_READ":
            const historyEvent = db.prepare("SELECT is_read FROM history WHERE id = ?").get(data.payload.historyId) as any;
            if (historyEvent) {
              const newHistoryStatus = historyEvent.is_read === 1 ? 0 : 1;
              db.prepare("UPDATE history SET is_read = ? WHERE id = ?").run(newHistoryStatus, data.payload.historyId);
              const updatedHistoryList = db.prepare("SELECT * FROM history ORDER BY timestamp DESC LIMIT 100").all();
              broadcast({ type: "HISTORY_UPDATE", payload: updatedHistoryList });
            }
            break;

          case "ORDER_MARK_READ":
            const currentOrder = db.prepare("SELECT is_read FROM orders WHERE id = ?").get(data.payload.orderId) as any;
            if (currentOrder) {
              const newStatus = currentOrder.is_read === 1 ? 0 : 1;
              db.prepare("UPDATE orders SET is_read = ? WHERE id = ?").run(newStatus, data.payload.orderId);
              
              const updatedOrder = db.prepare(`
                SELECT o.*, m.name as item_name, m.price as item_price 
                FROM orders o 
                JOIN menu_items m ON o.menu_item_id = m.id 
                WHERE o.id = ?
              `).get(data.payload.orderId);
              broadcast({ type: "ORDER_UPDATE", payload: updatedOrder });
            }
            break;

          case "MENU_ADD":
            const newItemId = uuidv4();
            db.prepare("INSERT INTO menu_items (id, name, price, type, category, active) VALUES (?, ?, ?, ?, ?, ?)")
              .run(newItemId, data.payload.name, data.payload.price, data.payload.type, data.payload.category, data.payload.active ? 1 : 0);
            await setDoc(doc(firestoreDb, "menu_items", newItemId), {
              name: data.payload.name,
              price: data.payload.price,
              type: data.payload.type ?? null,
              category: data.payload.category ?? null,
              active: data.payload.active ? 1 : 0
            }).catch(e => handleFirestoreError(e, OperationType.CREATE, "menu_items"));
            const newMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: newMenu });
            break;

          case "MENU_DELETE":
            db.prepare("DELETE FROM menu_items WHERE id = ?").run(data.payload.id);
            await deleteDoc(doc(firestoreDb, "menu_items", data.payload.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "menu_items"));
            const updatedMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: updatedMenu });
            break;

          case "MENU_EDIT":
            db.prepare("UPDATE menu_items SET name = ?, price = ?, type = ?, category = ?, active = ? WHERE id = ?")
              .run(data.payload.name, data.payload.price, data.payload.type, data.payload.category, data.payload.active ? 1 : 0, data.payload.id);
            await setDoc(doc(firestoreDb, "menu_items", data.payload.id), {
              name: data.payload.name,
              price: data.payload.price,
              type: data.payload.type ?? null,
              category: data.payload.category ?? null,
              active: data.payload.active ? 1 : 0
            }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
            const editedMenu = db.prepare("SELECT * FROM menu_items").all();
            broadcast({ type: "MENU_UPDATE", payload: editedMenu });
            break;

          case "CATEGORY_ADD":
            const newCatId = uuidv4();
            db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run(newCatId, data.payload.name);
            await setDoc(doc(firestoreDb, "categories", newCatId), { name: data.payload.name }).catch(e => handleFirestoreError(e, OperationType.CREATE, "categories"));
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories").all() });
            break;

          case "CATEGORY_EDIT": {
            const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldCat && oldCat.name !== data.payload.name) {
              db.prepare("UPDATE menu_items SET type = ? WHERE type = ?").run(data.payload.name, oldCat.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE type = ?").all(data.payload.name) as any[];
              for (const item of updatedItems) {
                await setDoc(doc(firestoreDb, "menu_items", item.id), { type: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(data.payload.name, data.payload.id);
            await setDoc(doc(firestoreDb, "categories", data.payload.id), { name: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "categories"));
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories").all() });
            break;
          }

          case "CATEGORY_DELETE": {
            const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldCat) {
              db.prepare("UPDATE menu_items SET type = NULL WHERE type = ?").run(oldCat.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE type IS NULL").all() as any[];
              for (const item of updatedItems) {
                await setDoc(doc(firestoreDb, "menu_items", item.id), { type: null }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            db.prepare("DELETE FROM categories WHERE id = ?").run(data.payload.id);
            await deleteDoc(doc(firestoreDb, "categories", data.payload.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "categories"));
            broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories").all() });
            break;
          }

          case "GROUP_ADD":
            const newGroupId = uuidv4();
            db.prepare("INSERT INTO item_groups (id, name) VALUES (?, ?)").run(newGroupId, data.payload.name);
            await setDoc(doc(firestoreDb, "item_groups", newGroupId), { name: data.payload.name }).catch(e => handleFirestoreError(e, OperationType.CREATE, "item_groups"));
            broadcast({ type: "GROUPS_UPDATE", payload: db.prepare("SELECT * FROM item_groups").all() });
            break;

          case "GROUP_EDIT": {
            const oldGroup = db.prepare("SELECT name FROM item_groups WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldGroup && oldGroup.name !== data.payload.name) {
              db.prepare("UPDATE menu_items SET category = ? WHERE category = ?").run(data.payload.name, oldGroup.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE category = ?").all(data.payload.name) as any[];
              for (const item of updatedItems) {
                await setDoc(doc(firestoreDb, "menu_items", item.id), { category: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            db.prepare("UPDATE item_groups SET name = ? WHERE id = ?").run(data.payload.name, data.payload.id);
            await setDoc(doc(firestoreDb, "item_groups", data.payload.id), { name: data.payload.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
            broadcast({ type: "GROUPS_UPDATE", payload: db.prepare("SELECT * FROM item_groups").all() });
            break;
          }

          case "GROUP_DELETE": {
            const oldGroup = db.prepare("SELECT name FROM item_groups WHERE id = ?").get(data.payload.id) as { name: string };
            if (oldGroup) {
              db.prepare("UPDATE menu_items SET category = NULL WHERE category = ?").run(oldGroup.name);
              const updatedItems = db.prepare("SELECT * FROM menu_items WHERE category IS NULL").all() as any[];
              for (const item of updatedItems) {
                await setDoc(doc(firestoreDb, "menu_items", item.id), { category: null }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "menu_items"));
              }
              broadcast({ type: "MENU_UPDATE", payload: db.prepare("SELECT * FROM menu_items").all() });
            }
            db.prepare("DELETE FROM item_groups WHERE id = ?").run(data.payload.id);
            await deleteDoc(doc(firestoreDb, "item_groups", data.payload.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, "item_groups"));
            broadcast({ type: "GROUPS_UPDATE", payload: db.prepare("SELECT * FROM item_groups").all() });
            break;
          }
        }
      } catch (err) {
        console.error("WS Error:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const { username, password, token } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    
    if (user) {
      if (user.role !== 'host') {
        const storedToken = db.prepare("SELECT value FROM settings WHERE key = 'access_token'").get() as { value: string };
        if (token !== storedToken.value) {
          return res.status(401).json({ success: false, message: "Token de acesso inválido" });
        }
      }
      res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ success: false, message: "Usuário ou senha incorretos" });
    }
  });

  app.post("/api/admin/reset-history", (req, res) => {
    const requestingUserId = req.headers['x-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || requestingUser.role !== 'host') {
      return res.status(403).json({ success: false, message: "Apenas o Host pode limpar o histórico" });
    }

    try {
      db.prepare("DELETE FROM history").run();
      broadcast({ type: "HISTORY_UPDATE", payload: [] });
      console.log("History reset by host");
      res.json({ success: true });
    } catch (e) {
      console.error("Error resetting history:", e);
      res.status(500).json({ success: false, message: "Erro ao limpar histórico" });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const requestingUserId = req.headers['x-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;

    if (!requestingUser || (requestingUser.role !== 'host' && requestingUser.role !== 'admin')) {
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    const { username, password, role } = req.body;

    if (requestingUser.role === 'admin' && role === 'host') {
      return res.status(403).json({ success: false, message: "Admin não pode criar Host" });
    }

    try {
      db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)")
        .run(uuidv4(), username, password, role);
      res.json({ success: true });
    } catch (e) {
      console.error("Insert user error:", e);
      res.status(400).json({ success: false, message: "Erro ao criar usuário. Verifique se o login já existe." });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const requestingUserId = req.headers['x-user-id'] as string;
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

  app.put("/api/users/:id", (req, res) => {
    const requestingUserId = req.headers['x-user-id'] as string;
    const requestingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(requestingUserId) as any;
    const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;

    if (!requestingUser) return res.status(403).json({ success: false, message: "Sem permissão" });

    const isSelf = requestingUserId === req.params.id;
    const isHost = requestingUser.role === 'host';
    const isAdmin = requestingUser.role === 'admin';

    // Permission Logic
    if (!isHost && !isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    if (isAdmin && targetUser.role === 'host' && !isSelf) {
      return res.status(403).json({ success: false, message: "Admin não pode editar Host" });
    }

    const { username, password, role } = req.body;

    if (targetUser && targetUser.username === 'deckserrinha' && role !== 'host') {
      return res.status(403).json({ success: false, message: "O host inicial não pode ser removido do cargo" });
    }

    // Only Host can change roles to/from Host
    if (role === 'host' && !isHost) {
       return res.status(403).json({ success: false, message: "Apenas Host pode promover a Host" });
    }

    // Non-host/admin cannot change their own role
    if (isSelf && !isHost && role !== targetUser.role) {
       return res.status(403).json({ success: false, message: "Você não pode alterar sua própria função" });
    }

    if (password) {
      db.prepare("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?")
        .run(username, password, role, req.params.id);
    } else {
      db.prepare("UPDATE users SET username = ?, role = ? WHERE id = ?")
        .run(username, role, req.params.id);
    }
    res.json({ success: true });
  });

  app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, m.name as item_name, m.price as item_price 
      FROM orders o 
      JOIN menu_items m ON o.menu_item_id = m.id 
      JOIN tables t ON o.table_id = t.id
      WHERE t.status != 'free'
    `).all();
    res.json(orders);
  });

  app.get("/api/orders/:tableId", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, m.name as item_name, m.price as item_price 
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
          const insertGroup = db.prepare("INSERT OR REPLACE INTO item_groups (id, name) VALUES (?, ?)");
          for (const group of itemGroups) {
            const id = group.id || uuidv4();
            insertGroup.run(id, group.name);
            setDoc(doc(firestoreDb, "item_groups", id), { name: group.name }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, "item_groups"));
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
        broadcast({ type: "CATEGORIES_UPDATE", payload: db.prepare("SELECT * FROM categories").all() });
      }
      if (itemGroups.length > 0) {
        broadcast({ type: "ITEM_GROUPS_UPDATE", payload: db.prepare("SELECT * FROM item_groups").all() });
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
}

startServer();
