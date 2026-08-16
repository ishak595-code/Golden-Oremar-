import bcrypt from "bcryptjs";
const hash = "$2b$10$M0WM8HeFEpz4WIELBA9x0eu7lU5POu0TFLpF.ur3oVx2lL70VcxWy";
console.log("Is admin123?", bcrypt.compareSync("admin123", hash));
