import pg from 'pg';
async function test() {
  const { Client } = pg;
  const client = new Client({
    connectionString: 'postgresql://postgres.lhzafcaewdndehwlmawh:4kR2l0DyOAyiHjbL@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=no-verify',
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined }
  });
  try {
    await client.connect();
    console.log('CONECTADO COM SUCESSO');
    await client.end();
  } catch (e: any) {
    console.log('ERRO:', e.message, 'code:', e.code);
  }
}
test();
