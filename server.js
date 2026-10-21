// Import frameworka Express.js do zarządzenia trasami HTTP i serwerem
const express = require('express');

// Import middleware CORS (Cross-Origin Resource Sharing).
// Bez tej paczki przeglądarka zablokuje zapytania wysyłane z Live Servera (np. port 5500) do Node.js (port 5000).
const cors = require('cors');

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

// Endpoint POST do obsługi logowania użytkownika
app.post('/api/login', (req, res) => {
    
    // Odbiór sparsowanych danych z ciał zapytania (req.body)
    const { email, password } = req.body;

    // Walidacja po stronie serwera - zabezpieczenie przed pustymi żądaniami
    if (!email || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Brakujące dane: adres e-mail i hasło są wymagane.'
        });
    }

    console.log(`[LOGIN ATTEMPT] Próba logowania dla e-mail: ${email}`);

    // Dane testowe (mockowanie bazy danych do czasu integracji z PostgreSQL)
    const MOCK_DB_EMAIL = 'admin@silownia.pl';
    const MOCK_DB_PASSWORD = 'haslo123';

    // Weryfikacja tożsamości
    if (email === MOCK_DB_EMAIL && password === MOCK_DB_PASSWORD) {
        return res.status(200).json({
            status: 'success',
            message: 'Zalogowano pomyślnie. Witaj w systemie rezerwacji!',
            user: { email: email, role: 'admin' }
        });
    } else {
        return res.status(401).json({
            status: 'error',
            message: 'Błędny e-mail lub hasło. Spróbuj ponownie.'
        });
    }
});

// --- URUCHOMIENIE SERWERA ---
app.listen(PORT, () => {
    console.log(`[SERVER] Serwer siłowni został uruchomiony i nasłuchuje na porcie: ${PORT}`);
});