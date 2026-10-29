// Import frameworka Express.js do zarządzenia trasami HTTP i serwerem
const express = require('express');
const bcrypt = require('bcrypt'); // Import bcrypt do szyfrowania haseł

// Import middleware CORS (Cross-Origin Resource Sharing).
// Bez tej paczki przeglądarka zablokuje zapytania wysyłane z Live Servera (np. port 5500) do Node.js (port 5000).
const cors = require('cors');
const db = require('./db'); // <-- Wczytujemy połączenie z bazą Neon.tech
// Wczytanie konfiguracji ze zmiennych środowiskowych (.env)
require('dotenv').config();

// Inicjalizacja instancji aplikacji Express
const app = express();

// Konfiguracja portu (domyślnie 5000)
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE (Warstwy pośredniczące) ---

// Zezwolenie na zapytania sieciowe z innych portów/domen (CORS)
app.use(cors());

// Automatyczne parsowanie przychodzących żądań w formacie JSON do obiektów JS (req.body)
app.use(express.json());

// --- TRASY / ENDPOINTY (REST API) ---

// Testowy endpoint kontrolny (Health Check)
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'success', 
        message: 'Serwer siłowni działa poprawnie!' 
    });
});

// ==========================================
// REJESTRACJA (Zapis do bazy danych PostgreSQL)
// ==========================================
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    // Walidacja po stronie serwera - zabezpieczenie przed pustymi żądaniami
    if (!email || !password) {
        return res.status(400).json({ message: 'Brakujące dane: adres e-mail i hasło są wymagane.' });
    }
// Sprawdzenie czy e-mail zawiera "@"
    if (!email.includes('@')) {
        return res.status(400).json({ message: 'Podaj poprawny format e-mail (musi zawierać znak @).' });
    }
    // Zabezpieczenie przed przeciążeniem i wstrzykiwaniem danych - ograniczenie długości pól
    if (email.length > 255) {
        return res.status(400).json({ message: 'Błąd: Adres e-mail przekracza limit 255 znaków.' });
    }
    if (password.length > 72) {
        return res.status(400).json({ message: 'Błąd: Hasło przekracza limit 72 znaków.' });
    }

    try {
        console.log(`[REGISTER ATTEMPT] Próba rejestracji dla e-mail: ${email}`);
        
        // Szyfrujemy hasło algorytmem bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Nadajemy rolę 'admin' jeśli email zawiera słowo admin, w przeciwnym razie 'client'
        const role = email.includes('admin') ? 'admin' : 'client';

        // Zapis do bazy Neon.tech
        const result = await db.query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
            [email, hashedPassword, role]
        );

        res.status(201).json({ message: 'Konto utworzone pomyślnie!', user: result.rows[0] });
    } catch (err) {
        // Kod 23505 w PostgreSQL oznacza błąd unikalności (ten e-mail już istnieje w tabeli)
        if (err.code === '23505') {
            return res.status(400).json({ message: 'Taki e-mail już istnieje w systemie.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Błąd serwera podczas rejestracji.' });
    }
});

// ==========================================
// LOGOWANIE (Odczyt z bazy danych PostgreSQL)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
// Sprawdzenie czy e-mail zawiera "@"
    if (!email.includes('@')) {
        return res.status(400).json({ message: 'Podaj poprawny format e-mail (musi zawierać znak @).' });
    }
    if (!email || !password) {
        return res.status(400).json({ message: 'Brakujące dane: adres e-mail i hasło są wymagane.' });
    }

    if (email.length > 255 || password.length > 72) {
        return res.status(400).json({ message: 'Błędne dane logowania.' });
    }

    try {
        console.log(`[LOGIN ATTEMPT] Próba logowania dla e-mail: ${email}`);
        
        // Szukamy użytkownika w bazie na podstawie e-maila
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Błędny e-mail lub hasło. Spróbuj ponownie.' });
        }

        const user = result.rows[0];

        // Porównujemy wpisane hasło z zaszyfrowanym hasłem w bazie
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Błędny e-mail lub hasło. Spróbuj ponownie.' });
        }

        // Zwracamy dane użytkownika (bez hasła!) do przeglądarki
        res.status(200).json({ 
            message: 'Zalogowano pomyślnie. Witaj w systemie rezerwacji!', 
            user: { id: user.id, email: user.email, role: user.role } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Błąd serwera podczas logowania.' });
    }
});

// --- URUCHOMIENIE SERWERA ---
app.listen(PORT, () => {
    console.log(`[SERVER] Serwer siłowni został uruchomiony i nasłuchuje na porcie: ${PORT}`);
});