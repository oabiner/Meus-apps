const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
content = content.replace(
  "import { \n  User, ",
  "import { db } from './firebase';\nimport { handleSendWS, logHistory } from './firebase-logic';\nimport { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, writeBatch, orderBy, limit } from 'firebase/firestore';\nimport { \n  User, "
);

// Replace fetchUsers
content = content.replace(
  "const fetchUsers = () => fetch('/api/users').then(res => res.json()).then(setUsers);",
  "const fetchUsers = () => { getDocs(collection(db, 'users')).then(s => setUsers(s.docs.map(d => d.data() as User))); };"
);

// Replace fetchOrders
content = content.replace(
  "const fetchOrders = () => fetch('/api/orders').then(res => res.json()).then(setAllOrders);",
  "const fetchOrders = () => { getDocs(collection(db, 'orders')).then(s => setAllOrders(s.docs.map(d => d.data() as any))); };"
);

// Replace useEffect for WS
const wsEffectRegex = /useEffect\(\(\) => \{\n    if \(isLoggedIn\) \{[\s\S]*?return \(\) => ws\.close\(\);\n    \}\n  \}, \[isLoggedIn\]\);/;
const firebaseEffect = `useEffect(() => {
    if (isLoggedIn) {
      fetchUsers();
      fetchOrders();

      const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
        setTables(snapshot.docs.map(d => d.data() as any));
      });
      const unsubMenu = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
        setMenu(snapshot.docs.map(d => d.data() as any));
      });
      const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
        setCategories(snapshot.docs.map(d => d.data() as any));
      });
      const unsubDetails = onSnapshot(collection(db, 'item_groups'), (snapshot) => {
        setDetails(snapshot.docs.map(d => d.data() as any));
      });
      const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
        setAllOrders(snapshot.docs.map(d => d.data() as any));
      });
      const qHistory = query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(100));
      const unsubHistory = onSnapshot(qHistory, (snapshot) => {
        setHistoryEvents(snapshot.docs.map(d => d.data() as any));
      });
      const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
        const s = snapshot.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data().value }), {});
        setSettings((prev: any) => ({ ...prev, ...s }));
      });

      return () => {
        unsubTables();
        unsubMenu();
        unsubCategories();
        unsubDetails();
        unsubOrders();
        unsubHistory();
        unsubSettings();
      };
    }
  }, [isLoggedIn]);`;

content = content.replace(wsEffectRegex, firebaseEffect);

// Replace handleLogin
const loginRegex = /const handleLogin = async \([\s\S]*?toast\.error\('Erro ao conectar ao servidor'\);\n    \}\n  \};/;
const firebaseLogin = `const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const token = formData.get('token') as string;

    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().username === username && d.data().password === password);
      
      if (userDoc) {
        const userData = userDoc.data() as User;
        if (userData.role !== 'host') {
          const settingsSnap = await getDocs(collection(db, 'settings'));
          const tokenDoc = settingsSnap.docs.find(d => d.id === 'access_token');
          if (token !== tokenDoc?.data().value) {
            toast.error('Token de acesso inválido');
            return;
          }
        }
        setUser(userData);
        setIsLoggedIn(true);
        toast.success('Bem-vindo ao Deck Serrinha!');
      } else {
        toast.error('Usuário ou senha incorretos');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    }
  };`;

content = content.replace(loginRegex, firebaseLogin);

// Replace sendWS
const sendWSRegex = /const sendWS = \([\s\S]*?\};/;
const firebaseSendWS = `const sendWS = (type: string, payload: any) => {
    handleSendWS(type, payload);
  };`;

content = content.replace(sendWSRegex, firebaseSendWS);

// Replace fetch('/api/admin/reset-history'
const resetHistoryRegex = /const res = await fetch\('\/api\/admin\/reset-history'[\s\S]*?toast\.error\('Erro de conexão'\);\n                      \}/;
const firebaseResetHistory = `try {
                          const historySnap = await getDocs(collection(db, 'history'));
                          const batch = writeBatch(db);
                          historySnap.forEach(d => batch.delete(d.ref));
                          await batch.commit();
                          toast.success('Histórico limpo!');
                          onResetHistory();
                      } catch (error) {
                          toast.error('Erro de conexão');
                      }`;

content = content.replace(resetHistoryRegex, firebaseResetHistory);

// Replace fetch('/api/users'
const fetchUsersPostRegex = /const res = await fetch\('\/api\/users', \{\n          method: 'POST'[\s\S]*?toast\.error\('Erro de conexão'\);\n      \}/;
const firebaseFetchUsersPost = `try {
        const newId = crypto.randomUUID();
        await setDoc(doc(db, 'users', newId), {
          id: newId,
          username: data.username,
          password: data.password,
          role: data.role
        });
        toast.success('Usuário criado!');
        onSave();
      } catch (error) {
        toast.error('Erro de conexão');
      }`;

content = content.replace(fetchUsersPostRegex, firebaseFetchUsersPost);

// Replace fetch('/api/users/:id' (DELETE)
const fetchUsersDeleteRegex = /const res = await fetch\(\`\/api\/users\/\$\{id\}\`, \{\n              method: 'DELETE'[\s\S]*?toast\.error\('Erro de conexão'\);\n          \}/;
const firebaseFetchUsersDelete = `try {
              await deleteDoc(doc(db, 'users', id));
              toast.success('Usuário excluído!');
              onDelete();
          } catch (error) {
              toast.error('Erro de conexão');
          }`;

content = content.replace(fetchUsersDeleteRegex, firebaseFetchUsersDelete);

// Replace fetch('/api/users/:id' (PUT)
const fetchUsersPutRegex = /const res = await fetch\(\`\/api\/users\/\$\{user\.id\}\`, \{\n          method: 'PUT'[\s\S]*?toast\.error\('Erro de conexão'\);\n      \}/;
const firebaseFetchUsersPut = `try {
        await updateDoc(doc(db, 'users', user.id), {
          username: data.username,
          password: data.password,
          role: data.role
        });
        toast.success('Usuário atualizado!');
        onSave();
      } catch (error) {
        toast.error('Erro de conexão');
      }`;

content = content.replace(fetchUsersPutRegex, firebaseFetchUsersPut);

// Replace fetch('/api/users/:id' (PUT) for current user
const fetchUsersPutCurrentRegex = /const res = await fetch\(\`\/api\/users\/\$\{currentUser\.id\}\`, \{\n                  method: 'PUT'[\s\S]*?toast\.error\('Erro de conexão'\);\n              \}/;
const firebaseFetchUsersPutCurrent = `try {
                  await updateDoc(doc(db, 'users', currentUser.id), {
                    username: e.currentTarget.username.value,
                    password: e.currentTarget.password.value
                  });
                  toast.success('Perfil atualizado!');
                  setIsEditingProfile(false);
              } catch (error) {
                  toast.error('Erro de conexão');
              }`;

content = content.replace(fetchUsersPutCurrentRegex, firebaseFetchUsersPutCurrent);

fs.writeFileSync('src/App.tsx', content);
