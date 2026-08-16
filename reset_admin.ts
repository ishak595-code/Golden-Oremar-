import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
const db = new Database("database.sqlite");
const hash = bcrypt.hashSync("i4h4k5a2", 10);

// Check if user exists
const user = db.prepare("SELECT * FROM users WHERE email = ?").get("goldenoremar@gmail.com");
if (user) {
  db.prepare("UPDATE users SET password = ?, role = 'admin' WHERE email = ?").run(hash, "goldenoremar@gmail.com");
} else {
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run("Admin", "goldenoremar@gmail.com", hash, "admin");
}
console.log("Admin password updated");
