// To dobra praktyka, która gwarantuje, że skrypt nie spróbuje odwołać się do elementów HTML, zanim te nie zostaną wyrenderowane.
document.addEventListener('DOMContentLoaded', () => {
    
    // Pobieramy element formularza logowania z drzewa DOM za pomocą jego identyfikatora (ID)
    const loginForm = document.getElementById('loginForm');

    // Upewniamy się, że element istnieje na stronie, aby uniknąć błędów w konsoli
    if (loginForm) {
        // Nasłuchujemy na zdarzenie 'submit' (wysłanie formularza, np. poprzez kliknięcie przycisku "Zaloguj się")
        loginForm.addEventListener('submit', function(event) {
            
            // event.preventDefault() blokuje domyślne zachowanie przeglądarki, czyli przeładowanie strony.
            // Dzięki temu będziemy mogli weryfikować i wysyłać dane "w tle" (Single Page Application).
            event.preventDefault();

            // Pobieramy aktualne wartości z pól tekstowych i usuwamy białe znaki na początku i końcu (.trim())
            const emailInput = document.getElementById('email').value.trim();
            const passwordInput = document.getElementById('password').value.trim();

            // 1. Walidacja obecności danych (zabezpieczenie na wypadek obejścia atrybutu 'required' w HTML)
            if (!emailInput || !passwordInput) {
                alert('Proszę wypełnić wszystkie pola.');
                return; // Zatrzymujemy dalsze wykonywanie funkcji
            }

            // 2. Walidacja formatu e-mail za pomocą wyrażenia regularnego (RegEx)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput)) {
                alert('Proszę podać poprawny adres e-mail.');
                return;
            }

            // 3. Walidacja bezpieczeństwa: minimalna długość hasła
            if (passwordInput.length < 16) {
                alert('Hasło musi składać się z co najmniej 16 znaków.');
                return;
            }

            // Jeśli kod dotarł do tego miejsca, walidacja po stronie klienta zakończyła się sukcesem.
            console.log('Walidacja lokalna poprawna. E-mail:', emailInput);
            alert('Dane poprawne! W kolejnym etapie połączymy to z backendem w Node.js.');
            
            // Opcjonalne wyczyszczenie formularza po udanej akcji
            // loginForm.reset();
        });
    }
});