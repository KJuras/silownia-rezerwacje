// Nasłuchiwanie na zdarzenie 'DOMContentLoaded' gwarantuje, że skrypt uruchomi się 
// dopiero po pełnym wyrenderowaniu struktury HTML (DOM) przez przeglądarkę.
document.addEventListener('DOMContentLoaded', () => {
    
    // Inicjalizacja stałych - pobieranie kluczowych elementów interfejsu za pomocą ich ID.
    const loginForm = document.getElementById('loginForm');
    const messageBox = document.getElementById('message-box');

    // Funkcja pomocnicza odpowiedzialna za dynamiczną aktualizację elementu DOM.
    // Służy do wyświetlania komunikatów zwrotnych (sukces/błąd) bez przeładowania strony.
    const showMessage = (message, isError = true) => {
        // Wstrzyknięcie treści komunikatu
        messageBox.textContent = message;
        // Resetowanie klas elementu do stanu początkowego
        messageBox.className = 'message-box';
        // Dodanie odpowiedniej klasy CSS (.error lub .success), która zmieni wygląd 
        // i zmieni właściwość display na 'block', ujawniając komunikat
        messageBox.classList.add(isError ? 'error' : 'success'); 
    };

    // Warunek sprawdzający obecność formularza - zabezpiecza przed błędami na podstronach bez logowania
    if (loginForm) {
        
        // Główny mechanizm obsługi zdarzenia wysłania formularza
        loginForm.addEventListener('submit', function(event) {
            
            // event.preventDefault() blokuje natywne przeładowanie strony,
            // co pozwala na asynchroniczne przetworzenie danych (SPA).
            event.preventDefault();

            // Usunięcie ewentualnych poprzednich stylów ukrywających, aby CSS mógł działać poprawnie
            messageBox.style.display = '';
            // Ukrycie komunikatu na ułamek sekundy przed nową walidacją poprzez reset klasy
            messageBox.className = 'message-box';

            // Pobranie danych wejściowych i usunięcie białych znaków (spacji na początku/końcu)
            const emailInput = document.getElementById('email').value.trim();
            const passwordInput = document.getElementById('password').value.trim();

            // --- ETAP WALIDACJI PO STRONIE KLIENTA ---

            // 1. Walidacja obecności danych: sprawdzenie czy pola nie są puste
            if (!emailInput || !passwordInput) {
                showMessage('Proszę wypełnić wszystkie pola.', true);
                return; // Przerwanie funkcji - formularz nie przechodzi dalej
            }

            // 2. Walidacja formatu e-mail: użycie wyrażenia regularnego (RegEx)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput)) {
                showMessage('Proszę podać poprawny adres e-mail.', true);
                return;
            }

            // 3. Walidacja polityki bezpieczeństwa: minimalna długość hasła
            if (passwordInput.length < 8) {
                showMessage('Hasło musi składać się z co najmniej 8 znaków.', true);
                return;
            }

            // --- SUKCES WALIDACJI ---
            
            // Aktualizacja DOM z komunikatem o pozytywnym przebiegu weryfikacji
            showMessage('Dane poprawne! Gotowe do wysłania przez Fetch API.', false);
            
            // TODO: Zgodnie z założeniami projektu, tutaj nastąpi integracja z backendem (Node.js)
            // za pomocą Fetch API (wysyłanie danych w formacie JSON na serwer).
        });
    }
});