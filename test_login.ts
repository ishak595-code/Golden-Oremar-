const login = async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@oremar.com', password: 'admin123' })
  });
  const data = await res.json();
  console.log(res.status, data);
};
login();
