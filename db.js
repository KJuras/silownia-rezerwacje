const { Pool } = require('pg');
require('dotenv').config();

// Konfiguracja połączenia z bazą w chmurze (Neon.tech wymaga SSL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Automatyczne tworzenie wymaganych tabel przy pierwszeym uruchomieniu
const initDb = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'client'
        );

        CREATE TABLE IF NOT EXISTS reservations (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,
            reservation_date DATE NOT NULL,
            time_slot VARCHAR(10) NOT NULL,
            UNIQUE(reservation_date, time_slot)
        );
    `;

    try {
        await pool.query(query);
        console.log('[DATABASE] Połączono z Neon.tech. Tabele "users" i "reservations" są gotowe!');
    } catch (err) {
        console.error('[DATABASE BŁĄD] Nie udało się połączyć z bazą:', err.message);
    }
};

initDb();

module.exports = pool;