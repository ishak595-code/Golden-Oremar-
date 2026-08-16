import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
const db = new Database("database.sqlite");
const hash = bcrypt.hashSync("admin123", 10);
db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hash, "admin@oremar.com");
console.log("Password updated");
