import Database from "better-sqlite3";
const db = new Database("deck_serrinha.db");
console.log(db.prepare("SELECT * FROM menu_items LIMIT 5;").all());
