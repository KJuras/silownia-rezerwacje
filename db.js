const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // Dodajemy bcrypt do szyfrowania hasła admina
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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

        // NOWE: Twarde wstrzyknięcie konta administratora do bazy danych
        const adminEmail = 'admin@silownia.pl';
        const checkAdmin = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
        
        if (checkAdmin.rows.length === 0) {
            const hashedAdminPassword = await bcrypt.hash('haslo123', 10);
            await pool.query(
                'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
                [adminEmail, hashedAdminPassword, 'admin']
            );
            console.log('[DATABASE] Utworzono domyślne konto administratora w bazie danych.');
        }

    } catch (err) {
        console.error('[DATABASE BŁĄD] Nie udało się połączyć z bazą:', err.message);
    }
};

initDb();

module.exports = pool;