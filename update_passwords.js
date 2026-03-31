const users = [
  { id: '823b4b5a-d2e6-46ec-91bc-359484c112b3', password: 'Rose_k7m2' },
  { id: 'ce67051d-ca10-42b2-9581-6578245b869e', password: 'Brewen_p9x4' },
  { id: '0f817409-524a-4ca1-be70-c524b854a89a', password: 'Amaury_t3n8' },
  { id: 'f04e4150-9fa6-47e2-b51b-a9641b4b8ea4', password: 'Juliette_w6r1' },
  { id: '8ce3a45f-dd0b-421d-8fad-7b833a5bfaf8', password: 'Yacine_b5j9' },
  { id: '56cf813f-bba3-4da7-95a1-e48d96653614', password: 'Max_fd12' },
  { id: 'adcf32d0-7262-4ff4-9901-a30004e10ccd', password: 'Aby_q4v7' },
  { id: '1d5f1c83-5825-4fbe-87c2-5b46d8a0b4ac', password: 'Charlie_h8z3' },
  { id: 'c3f81ae9-179e-4f8f-b309-6e6ee9ec7f01', password: 'Médine_c2s6' },
  { id: 'a2d9153b-625b-400d-82e0-1a7b59629c1b', password: 'Neila_y1d5' },
  { id: 'bd56346d-b7d4-4e20-9512-3acf7b4619f6', password: 'Paola_m9w4' },
  { id: '00adf49c-aa86-4950-89fa-2aae0741d01c', password: 'Jana_x3f8' },
  { id: '934f8198-d11c-40a4-b96a-b50cf55dfb0c', password: 'Nanou_g6k1' },
];

const SUPABASE_URL = 'https://rvonutomiuvsxjxeuipq.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function updateAll() {
  for (const user of users) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: user.password }),
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✓ ${user.password} — OK`);
    } else {
      console.error(`✗ ${user.password} — ${JSON.stringify(data)}`);
    }
  }
}

updateAll();