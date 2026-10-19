// Nasłuchiwanie na pełne wyrenderowanie struktury drzewa DOM przed uruchomieniem skryptu
document.addEventListener('DOMContentLoaded', () => {
    
    // Pobranie elementów formularza i kontenera na komunikaty
    const loginForm = document.getElementById('loginForm');
    const messageBox = document.getElementById('message-box');

    // Funkcja pomocnicza do dynamicznej manipulacji DOM (wyświetlanie komunikatów zwrotnych)
    const showMessage = (message, isError = true) => {
        messageBox.textContent = message;
        messageBox.className = 'message-box';
        messageBox.classList.add(isError ? 'error' : 'success'); 
    };

    if (loginForm) {
        
        // Przechwycenie zdarzenia wysłania formularza
        loginForm.addEventListener('submit', function(event) {
            
            // Zablokowanie domyślnej akcji przeładowania strony po wysłaniu formularza
            event.preventDefault();

            // Przywrócenie widoczności kontenera i reset klas
            messageBox.style.display = '';
            messageBox.className = 'message-box';

            // Pobranie i oczyszczenie danych wejściowych od użytkownika
            const emailInput = document.getElementById('email').value.trim();
            const passwordInput = document.getElementById('password').value.trim();

            // =========================================================================
            // ETAP 1: WALIDACJA PO STRONIE KLIENTA (FRONTEND)
            // Chroni serwer przed niepotrzebnymi zapytaniami sieciowymi.
            // =========================================================================

            // 1. Sprawdzenie obecności danych (czy pola nie są puste)
            if (!emailInput || !passwordInput) {
                showMessage('Proszę wypełnić wszystkie pola.', true);
                return; // Przerwanie funkcji - fetch() NIE zostanie wywołany!
            }

            // 2. Sprawdzenie formatu adresu e-mail (wyrażenie regularne)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput)) {
                showMessage('Proszę podać poprawny adres e-mail.', true);
                return; // Przerwanie funkcji - fetch() NIE zostanie wywołany!
            }

            // 3. Sprawdzenie wymogów bezpieczeństwa (długość hasła min. 8 znaków)
            if (passwordInput.length < 8) {
                showMessage('Hasło musi składać się z co najmniej 8 znaków.', true);
                return; // Przerwanie funkcji - fetch() NIE zostanie wywołany!
            }

            // =========================================================================
            // ETAP 2: KOMUNIKACJA SIECIOWA (FETCH API / BACKEND)
            // Wywoływana TYLKO wtedy, gdy dane przeszły pomyślnie walidację frontendową.
            // =========================================================================
            
            const attemptLogin = async () => {
                
                // Informacja dla użytkownika o trwającym połączeniu
                showMessage('Trwa logowanie, proszę czekać...', false);
                messageBox.classList.remove('success');

                try {
                    // Użycie adresu 127.0.0.1 zamiast localhost zapobiega konfliktom z protokołem IPv6
                    const response = await fetch('http://127.0.0.1:5000/api/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        // Konwersja obiektu JS do ciągu znaków w formacie JSON
                        body: JSON.stringify({ 
                            email: emailInput, 
                            password: passwordInput 
                        })
                    });

                    // Odczytanie odpowiedzi przesłanej przez serwer Node.js
                    const data = await response.json();

                    // Obsługa odpowiedzi w zależności od statusu HTTP (2xx = sukces, inne = błąd)
                    if (response.ok) {
                        showMessage(data.message, false); // Zielony komunikat z backendu
                        console.log('Zalogowano poprawnie. Dane użytkownika:', data.user);
                    } else {
                        showMessage(data.message, true);  // Czerwony komunikat z backendu (np. złe hasło)
                    }

                } catch (error) {
                    // Wyłapanie błędów połączenia (np. brak uruchomionego serwera w terminalu)
                    console.error('[Sieć] Błąd połączenia z serwerem:', error);
                    showMessage('Brak połączenia z serwerem. Upewnij się, że backend jest uruchomiony.', true);
                }
            };

            // Wywołanie asynchronicznej funkcji logowania
            attemptLogin();
        });
    }
});