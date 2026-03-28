import { db } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export const logHistory = async (userId: string, username: string, action: string, details: string, orderId: string | null = null) => {
  const id = uuidv4();
  await setDoc(doc(db, 'history', id), {
    id,
    user_id: userId,
    username,
    action,
    details,
    order_id: orderId,
    is_read: 0,
    timestamp: new Date().toISOString()
  });
};

export const handleSendWS = async (type: string, payload: any) => {
  try {
    switch (type) {
      case 'SETTINGS_UPDATE': {
        const batch = writeBatch(db);
        Object.entries(payload).forEach(([key, value]) => {
          batch.set(doc(db, 'settings', key), { key, value: String(value) });
        });
        await batch.commit();
        break;
      }
      case 'TABLE_OPEN': {
        // Delete old orders for this table
        const ordersQuery = query(collection(db, 'orders'), where('table_id', '==', payload.tableId));
        const ordersSnapshot = await getDocs(ordersQuery);
        const batch = writeBatch(db);
        ordersSnapshot.forEach(d => batch.delete(d.ref));
        
        batch.update(doc(db, 'tables', String(payload.tableId)), {
          status: 'open',
          customer_name: payload.customerName,
          people_count: payload.peopleCount,
          opened_at: new Date().toISOString()
        });
        await batch.commit();
        await logHistory(payload.userId, payload.username, "ABRIR_MESA", `Mesa ${payload.tableId} aberta para ${payload.customerName || 'N/A'}`);
        break;
      }
      case 'TABLE_UPDATE_DATA': {
        await updateDoc(doc(db, 'tables', String(payload.tableId)), {
          customer_name: payload.customerName,
          people_count: payload.peopleCount
        });
        break;
      }
      case 'TABLE_REQUEST_BILL': {
        await updateDoc(doc(db, 'tables', String(payload.tableId)), {
          status: 'bill_requested'
        });
        await logHistory(payload.userId, payload.username, "PEDIR_CONTA", `Mesa ${payload.tableId} solicitou fechamento`);
        break;
      }
      case 'TABLE_CLOSE': {
        const ordersQuery = query(collection(db, 'orders'), where('table_id', '==', payload.tableId));
        const ordersSnapshot = await getDocs(ordersQuery);
        const batch = writeBatch(db);
        ordersSnapshot.forEach(d => batch.delete(d.ref));
        
        batch.update(doc(db, 'tables', String(payload.tableId)), {
          status: 'free',
          customer_name: null,
          people_count: null,
          opened_at: null
        });
        await batch.commit();
        await logHistory(payload.userId, payload.username, "FECHAR_MESA", `Mesa ${payload.tableId} fechada. Métodos: ${payload.paymentMethods.join(', ')}`);
        break;
      }
      case 'ORDER_SEND': {
        const tableDoc = await getDoc(doc(db, 'tables', String(payload.tableId)));
        if (tableDoc.exists() && tableDoc.data().status === 'bill_requested') {
          await updateDoc(doc(db, 'tables', String(payload.tableId)), { status: 'open' });
        }

        const batch = writeBatch(db);
        for (const item of payload.items) {
          const orderId = uuidv4();
          const menuItemDoc = await getDoc(doc(db, 'menu_items', item.menuItemId));
          const menuItem = menuItemDoc.data();
          
          batch.set(doc(db, 'orders', orderId), {
            id: orderId,
            table_id: payload.tableId,
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            status: 'pending',
            is_read: 0,
            observation: item.observation || null,
            timestamp: new Date().toISOString(),
            item_name: menuItem?.name || 'Item',
            item_price: menuItem?.price || 0
          });

          const obsText = item.observation ? ` (Obs: ${item.observation})` : '';
          await logHistory(
            payload.userId, 
            payload.username, 
            "NOVO_PEDIDO", 
            `Mesa ${payload.tableId}: ${item.quantity}x ${menuItem?.name || 'Item'}${obsText}`,
            orderId
          );
        }
        await batch.commit();
        break;
      }
      case 'ORDER_DELETE': {
        const orderDoc = await getDoc(doc(db, 'orders', payload.orderId));
        if (orderDoc.exists()) {
          const orderData = orderDoc.data();
          await deleteDoc(doc(db, 'orders', payload.orderId));
          const obsText = orderData.observation ? ` (Obs: ${orderData.observation})` : '';
          await logHistory(
            payload.userId,
            payload.username,
            "EXCLUIR_PEDIDO",
            `Mesa ${payload.tableId}: ${orderData.quantity}x ${orderData.item_name}${obsText} excluído`,
            payload.orderId
          );
        }
        break;
      }
      case 'HISTORY_MARK_READ': {
        const historyDoc = await getDoc(doc(db, 'history', payload.historyId));
        if (historyDoc.exists()) {
          const newStatus = historyDoc.data().is_read === 1 ? 0 : 1;
          await updateDoc(doc(db, 'history', payload.historyId), { is_read: newStatus });
        }
        break;
      }
      case 'ORDER_MARK_READ': {
        const orderDoc = await getDoc(doc(db, 'orders', payload.orderId));
        if (orderDoc.exists()) {
          const newStatus = orderDoc.data().is_read === 1 ? 0 : 1;
          await updateDoc(doc(db, 'orders', payload.orderId), { is_read: newStatus });
        }
        break;
      }
      case 'MENU_ADD': {
        const newItemId = uuidv4();
        await setDoc(doc(db, 'menu_items', newItemId), {
          id: newItemId,
          name: payload.name,
          price: payload.price,
          type: payload.type ?? null,
          category: payload.category ?? null,
          active: payload.active ? 1 : 0
        });
        break;
      }
      case 'MENU_DELETE': {
        await deleteDoc(doc(db, 'menu_items', payload.id));
        break;
      }
      case 'MENU_EDIT': {
        await updateDoc(doc(db, 'menu_items', payload.id), {
          name: payload.name,
          price: payload.price,
          type: payload.type ?? null,
          category: payload.category ?? null,
          active: payload.active ? 1 : 0
        });
        break;
      }
      case 'CATEGORY_ADD': {
        const newCatId = uuidv4();
        await setDoc(doc(db, 'categories', newCatId), { id: newCatId, name: payload.name });
        break;
      }
      case 'CATEGORY_EDIT': {
        const catDoc = await getDoc(doc(db, 'categories', payload.id));
        if (catDoc.exists() && catDoc.data().name !== payload.name) {
          const oldName = catDoc.data().name;
          const itemsQuery = query(collection(db, 'menu_items'), where('type', '==', oldName));
          const itemsSnapshot = await getDocs(itemsQuery);
          const batch = writeBatch(db);
          itemsSnapshot.forEach(d => batch.update(d.ref, { type: payload.name }));
          batch.update(doc(db, 'categories', payload.id), { name: payload.name });
          await batch.commit();
        } else {
          await updateDoc(doc(db, 'categories', payload.id), { name: payload.name });
        }
        break;
      }
      case 'CATEGORY_DELETE': {
        const catDoc = await getDoc(doc(db, 'categories', payload.id));
        if (catDoc.exists()) {
          const oldName = catDoc.data().name;
          const itemsQuery = query(collection(db, 'menu_items'), where('type', '==', oldName));
          const itemsSnapshot = await getDocs(itemsQuery);
          const batch = writeBatch(db);
          itemsSnapshot.forEach(d => batch.update(d.ref, { type: null }));
          batch.delete(doc(db, 'categories', payload.id));
          await batch.commit();
        }
        break;
      }
      case 'DETAIL_ADD': {
        const newGroupId = uuidv4();
        await setDoc(doc(db, 'item_groups', newGroupId), { id: newGroupId, name: payload.name, category_name: payload.category_name });
        break;
      }
      case 'DETAIL_EDIT': {
        const groupDoc = await getDoc(doc(db, 'item_groups', payload.id));
        if (groupDoc.exists() && groupDoc.data().name !== payload.name) {
          const oldName = groupDoc.data().name;
          const itemsQuery = query(collection(db, 'menu_items'), where('category', '==', oldName));
          const itemsSnapshot = await getDocs(itemsQuery);
          const batch = writeBatch(db);
          itemsSnapshot.forEach(d => batch.update(d.ref, { category: payload.name }));
          batch.update(doc(db, 'item_groups', payload.id), { name: payload.name, category_name: payload.category_name });
          await batch.commit();
        } else {
          await updateDoc(doc(db, 'item_groups', payload.id), { name: payload.name, category_name: payload.category_name });
        }
        break;
      }
      case 'DETAIL_DELETE': {
        const groupDoc = await getDoc(doc(db, 'item_groups', payload.id));
        if (groupDoc.exists()) {
          const oldName = groupDoc.data().name;
          const itemsQuery = query(collection(db, 'menu_items'), where('category', '==', oldName));
          const itemsSnapshot = await getDocs(itemsQuery);
          const batch = writeBatch(db);
          itemsSnapshot.forEach(d => batch.update(d.ref, { category: null }));
          batch.delete(doc(db, 'item_groups', payload.id));
          await batch.commit();
        }
        break;
      }
    }
  } catch (error) {
    console.error("Error in handleSendWS:", error);
  }
};
