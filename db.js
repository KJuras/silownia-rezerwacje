// ==========================================
// IMPORT BIBLIOTEK I KONFIGURACJA BAZY DANYCH
// ==========================================

// Pobieramy "Pool" z biblioteki pg. 
// Pool automatycznie zarządza wieloma połączeniami do bazy Neon.tech jednocześnie,
// dzięki czemu serwer się nie zapcha, jeśli kilku użytkowników kliknie rezerwację w tej samej sekundzie.
const { Pool } = require('pg');

// Biblioteka bcrypt pozwala zaszyfrować (zahashować) hasło.
// Nawet administrator serwera nie może odczytać prawdziwego hasła z bazy danych.
const bcrypt = require('bcrypt');

// Wczytanie bezpiecznych zmiennych konfiguracyjnych (np. linku do bazy) z ukrytego pliku .env
require('dotenv').config();

// Tworzymy nową instancję puli połączeń.
// Używamy zmiennej środowiskowej 'DATABASE_URL', aby nie wpisywać hasła do chmury wprost w kodzie.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Wymagane przez bazę chmurową Neon.tech ze względów bezpieczeństwa (szyfrowanie SSL)
});


// ==========================================
// FUNKCJA INICJALIZUJĄCA STRUKTURĘ TABEL
// ==========================================
// Ta funkcja uruchamia się tylko raz, automatycznie podczas startu serwera Node.js
const initDb = async () => {
    
    // Zapisujemy zapytanie SQL (tworzące tabele) jako długi "string" testowy
    const query = `
        -- Tabela 1: Przechowuje konta zarejestrowanych klientów oraz samego administratora
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,                        -- Automatycznie numerowane ID dla każdego konta
            email VARCHAR(255) UNIQUE NOT NULL,           -- Adres musi być unikalny (blokada wielu kont na ten sam mail)
            password VARCHAR(255) NOT NULL,               -- Tutaj wyląduje bezpiecznie zaszyfrowane hasło
            role VARCHAR(50) DEFAULT 'client'             -- Domyślnie każdy jest 'klientem' (chyba że wpiszemy 'admin')
        );

        -- Tabela 2: Przechowuje poszczególne zarezerwowane okienka czasowe
        CREATE TABLE IF NOT EXISTS reservations (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id) ON DELETE CASCADE,  -- Połączone z kontem z Tabeli 1. Jeśli usuniemy usera, jego terminy też znikną (CASCADE).
            reservation_date DATE NOT NULL,                      -- Dzień (np. 2024-05-12)
            time_slot VARCHAR(10) NOT NULL,                      -- Konkretny kafelek z tego dnia (np. 15:30)
            UNIQUE(reservation_date, time_slot)                  -- ZABEZPIECZENIE: Nie można zapisać tej samej godziny dwa razy w jednym dniu
        );
    `;

    try {
        // Wysyłamy nasze polecenie CREATE TABLE do bazy Neon.tech
        await pool.query(query);
        console.log('[DATABASE] Połączono z Neon.tech. Tabele "users" i "reservations" są gotowe!');


        // ==========================================
        // AUTO-KONFIGURACJA KONTA ADMINISTRATORA
        // ==========================================
        // Ustalamy na sztywno e-mail "głównego" pracownika siłowni
        const adminEmail = 'admin@silownia.pl';
        
        // Sprawdzamy, czy takie konto przypadkiem już w bazie nie istnieje
        const checkAdmin = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
        
        if (checkAdmin.rows.length === 0) {
            // Skoro konta nie ma, to szyfrujemy proste hasło ("haslo123") algorytmem z trudnością ustawioną na "10"
            const hashedAdminPassword = await bcrypt.hash('haslo123', 10);
            
            // Rejestrujemy administratora bezpośrednio z poziomu skryptu, wpisując mu specjalną rolę 'admin'
            await pool.query(
                'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
                [adminEmail, hashedAdminPassword, 'admin']
            );
            console.log('[DATABASE] Utworzono domyślne konto administratora w bazie danych.');
        }

    } catch (err) {
        // Jeśli np. zły link w pliku .env uniemożliwi zalogowanie do Neona, wypisujemy to w konsoli
        console.error('[DATABASE BŁĄD] Nie udało się połączyć z bazą:', err.message);
    }
};

// Automatyczne wywołanie funkcji sprawdzającej podczas każdego uruchomienia serwera `npm start`
// Uruchamiamy poniższą funkcję. Dzięki temu przy każdym włączeniu aplikacji 
// system od razu sam sprawdzi, czy tabele w bazie i konto admina są gotowe do pracy.
initDb();

// Udostępniamy (tzw. eksportujemy) gotowe połączenie z bazą danych na zewnątrz tego pliku.
// Dzięki temu nasz główny serwer (plik server.js) będzie mógł z niego korzystać, 
// żeby zapisywać i usuwać rezerwacje klientów.
module.exports = pool;