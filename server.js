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

// ==========================================
// UNIWERSALNA WALIDACJA CIĄGŁOŚCI BLOKU
// ==========================================
const validateContinuousBlock = (slots) => {
    if (slots.length === 0) return true;
    if (slots.length === 1) return false;
    if (slots.length > 4) return false;

    const sortedSlots = [...slots].sort();
    const timeToMins = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    for (let i = 1; i < sortedSlots.length; i++) {
        if (timeToMins(sortedSlots[i]) - timeToMins(sortedSlots[i - 1]) !== 30) {
            return false;
        }
    }
    return true;
};


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

        // ZAWSZE przypisujemy rolę zwykłego klienta. Nikt z zewnątrz nie utworzy admina!
        const role = 'client';

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

    if (!email || !password) {
        return res.status(400).json({ message: 'Brakujące dane: adres e-mail i hasło są wymagane.' });
    }
    
    // Sprawdzenie czy e-mail zawiera "@"
    if (!email.includes('@')) {
        return res.status(400).json({ message: 'Podaj poprawny format e-mail (musi zawierać znak @).' });
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

// ==========================================
// POBIERANIE REZERWACJI DLA DANEGO DNIA (GET)
// ==========================================
app.get('/api/reservations', async (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Wymagane jest podanie daty.' });
    }

    try {
        // Pobieramy rezerwacje dla danego dnia wraz z ID i e-mailem właściciela
        const result = await db.query(
            `SELECT r.id, r.user_id, r.reservation_date, r.time_slot, u.email 
             FROM reservations r 
             JOIN users u ON r.user_id = u.id 
             WHERE r.reservation_date = $1`,
            [date]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Błąd serwera podczas pobierania rezerwacji.' });
    }
});

// ==========================================
// TWORZENIE NOWEJ REZERWACJI (POST)
// ==========================================
app.post('/api/reservations', async (req, res) => {
    const { user_id, reservation_date, time_slots } = req.body;

    if (!user_id || !reservation_date || !Array.isArray(time_slots) || time_slots.length === 0) {
        return res.status(400).json({ message: 'Brakujące dane rezerwacji.' });
    }

    try {
        // Pobieramy obecne kafelki z bazy dla tego użytkownika w tym dniu
        const currentRes = await db.query(
            'SELECT time_slot FROM reservations WHERE user_id = $1 AND reservation_date = $2',
            [user_id, reservation_date]
        );
        const currentSlots = currentRes.rows.map(row => row.time_slot);
        
        // Symulujemy stan po dodaniu nowych kafelków
        const proposedSlots = [...currentSlots, ...time_slots];

        // Rygorystyczna walidacja logiki biznesowej na backendzie
        if (!validateContinuousBlock(proposedSlots)) {
            return res.status(400).json({ message: 'Odmowa serwera: Naruszono zasady ciągłości i długości bloku rezerwacji.' });
        }

        for (const slot of time_slots) {
            await db.query(
                'INSERT INTO reservations (user_id, reservation_date, time_slot) VALUES ($1, $2, $3)',
                [user_id, reservation_date, slot]
            );
        }

        res.status(201).json({ message: 'Rezerwacja została pomyślnie zapisana!' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ message: 'Błąd: Jeden z kafelków został właśnie zajęty.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Błąd serwera podczas zapisywania rezerwacji.' });
    }
});

// ==========================================
// USUWANIE REZERWACJI (DELETE)
// ==========================================
app.delete('/api/reservations', async (req, res) => {
    const { user_id, user_role, reservation_date, time_slots } = req.body;

    if (!reservation_date || !Array.isArray(time_slots) || time_slots.length === 0) {
        return res.status(400).json({ message: 'Brak danych do usunięcia.' });
    }

    try {
        // Administrator omija walidację - może usuwać bez ograniczeń "brzydkie" blokady i pojedyncze kafelki
        if (user_role !== 'admin') {
            const currentRes = await db.query(
                'SELECT time_slot FROM reservations WHERE user_id = $1 AND reservation_date = $2',
                [user_id, reservation_date]
            );
            const currentSlots = currentRes.rows.map(row => row.time_slot);
            
            // Symulujemy stan po usunięciu wybranych kafelków
            const remainingSlots = currentSlots.filter(s => !time_slots.includes(s));

            if (!validateContinuousBlock(remainingSlots)) {
                return res.status(400).json({ message: 'Odmowa serwera: Po anulowaniu musi pozostać ciągły blok (min. 1h).' });
            }
        }

        for (const slot of time_slots) {
            if (user_role === 'admin') {
                await db.query(
                    'DELETE FROM reservations WHERE reservation_date = $1 AND time_slot = $2',
                    [reservation_date, slot]
                );
            } else {
                await db.query(
                    'DELETE FROM reservations WHERE user_id = $1 AND reservation_date = $2 AND time_slot = $3',
                    [user_id, reservation_date, slot]
                );
            }
        }

        res.status(200).json({ message: 'Wybrane rezerwacje zostały usunięte.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Błąd serwera podczas usuwania rezerwacji.' });
    }
});

// --- URUCHOMIENIE SERWERA ---
app.listen(PORT, () => {
    console.log(`[SERVER] Serwer siłowni został uruchomiony i nasłuchuje na porcie: ${PORT}`);
});