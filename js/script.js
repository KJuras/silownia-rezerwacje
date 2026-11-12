// ==========================================
// STAN APLIKACJI I ZMIENNE GLOBALNE
// ==========================================
// Te zmienne żyją w pamięci przeglądarki tak długo, jak karta jest otwarta
let userRole = 'client'; 
let currentUserId = null;    // Przechowuje ID zalogowanego użytkownika (null = brak zalogowania)
let selectedSlots = [];      // Kafelki wybrane do nowej rezerwacji
let selectedToCancel = [];   // Kafelki wybrane do anulowania

let myBookings = [];         // Pobierane dynamicznie z bazy danych
let takenByOthers = {};      // Pobierane dynamicznie z bazy danych

const grid = document.getElementById('time-slots-grid'); // Główny kontener kafelków w kalendarzu
const dateInput = document.getElementById('reservation-date');  // Pole wyboru daty w kalendarzu

// ==========================================
// UNIWERSALNA WALIDACJA CIĄGŁOŚCI BLOKU
// ==========================================
function validateContinuousBlock(slots) { // Funkcja sprawdza, czy wybrane kafelki tworzą ciągły blok od 1 do 2 godzin (1-4 kafelki po 30 minut)
    if (slots.length === 0) return true; // Usunięcie wszystkich kafelków jest dozwolone
    if (slots.length === 1) return false; // Minimum to 2 kafelki (1 godzina)
    if (slots.length > 4) return false; // Maksimum to 4 kafelki (2 godziny)

    // Sortujemy kafelki rosnąco, np. ['15:00', '15:30', '16:00']
    const sortedSlots = [...slots].sort();
    const timeToMinutes = (t) => { 
        const [h, m] = t.split(':').map(Number); // Rozdzielamy godzinę i minuty, np. '15:30' -> [15, 30], map(Number) konwertuje stringi na liczby
        return h * 60 + m; 
    };

    // Sprawdzamy, czy każdy kolejny kafelek jest dokładnie 30 minut po poprzednim
    for (let i = 1; i < sortedSlots.length; i++) {
        if (timeToMinutes(sortedSlots[i]) - timeToMinutes(sortedSlots[i - 1]) !== 30) {
            return false; // Wykryto lukę między kafelkami
        }
    }
    return true; // Blok jest ciągły i ma odpowiednią długość
}

// ==========================================
// INICJALIZACJA WYBIERAKA DATY
// ==========================================
if (dateInput) {
    // Blokujemy możliwość wyboru daty z przeszłości (min = dzisiaj)
    const today = new Date().toISOString().split('T')[0]; // Pobieramy dzisiejszą datę w formacie YYYY-MM-DD, toISSOSTRING() zwraca datę w formacie ISO, a split('T')[0] odcina część czasu
    dateInput.min = today; // Ustawiamy minimalną datę w polu wyboru na dzisiejszą datę, aby użytkownik nie mógł wybrać przeszłości
    
    // Zdarzenie zmiany daty w kalendarzu, gdy użytkownik wybierze nowy dzień, resetujemy wybrane kafelki i pobieramy aktualny stan z bazy danych
    dateInput.addEventListener('change', () => { 
        selectedSlots = [];
        selectedToCancel = [];
        hideMessage('booking-message');
        document.getElementById('cancel-container').style.display = 'none';
        
        // Zamiast generować puste kafelki, pobieramy stan z bazy danych dla wybranego dnia
        fetchReservations(dateInput.value); 
    });
}

// ==========================================
// POMOCNICZE: KOMUNIKATY WIZUALNE ON-PAGE
// ==========================================
// Funkcja wyświetlająca zielony (sukces) lub czerwony (błąd) prostokąt z tekstem pod kalendarzem
function showMessage(elementId, text, isError = false) { // isError = false oznacza, że domyślnie komunikat jest traktowany jako sukces (zielony), chyba że jawnie podamy true
    const msgBox = document.getElementById(elementId);
    if (msgBox) {
        msgBox.textContent = text;
        msgBox.style.display = 'block';
        // Jeżeli isError jest prawdziwe (true), nakładamy kolory ostrzegawcze
        msgBox.style.backgroundColor = isError ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)';
        msgBox.style.color = isError ? '#dc3545' : '#28a745';
        msgBox.style.border = `1px solid ${isError ? '#dc3545' : '#28a745'}`;
    }
}
// Funkcja zwijająca komunikat z powrotem do niewidzialności, np. po kliknięciu w inny kafelek lub przycisk
function hideMessage(elementId) {
    const msgBox = document.getElementById(elementId);
    if (msgBox) {
        msgBox.style.display = 'none';
    }
}

// ==========================================
// POBIERANIE DANYCH Z BAZY DANYCH (FETCH)
// ==========================================

// Pobieranie rezerwacji z serwera dla wybranej daty
async function fetchReservations(dateString) {
    if (!currentUserId) return; // Zapobiega pobieraniu bez zalogowania

    try {
        // Wysyłamy zapytanie GET na nasz port 5000 z doklejoną datą
        const response = await fetch(`http://localhost:5000/api/reservations?date=${dateString}`); // await czeka na odpowiedź serwera, zanim przejdzie do kolejnej linii
        if (!response.ok) throw new Error('Błąd pobierania rezerwacji'); // Jeżeli serwer zwróci błąd (np. 404 lub 500), rzucamy wyjątek, który zostanie złapany w catch
        
        // Zapisujemy odpowiedź serwera (JSON z rezerwacjami) do zmiennej
        const reservationsFromDb = await response.json();
        
        // Czyszczenie lokalnych tablic
        myBookings = [];
        takenByOthers = {}; // Zmiana na obiekt

        // Rozdzielamy pobrane z bazy rezerwacje na dwa "worki"
        reservationsFromDb.forEach(res => {
            if (res.user_id === currentUserId) {
                // Worek 1: To nasza własna rezerwacja (będzie zielona)
                myBookings.push(res.time_slot);
            } else {
                // Worek 2: To cudza rezerwacja (będzie czerwona).
                // Dodajemy też adres e-mail tej osoby, z którego potem skorzysta Admin.
                takenByOthers[res.time_slot] = res.email; // Przypisujemy e-mail do konkretnej godziny
            }
        });

        // Po rozdzieleniu danych rysujemy kalendarz
        generateTimeSlots();

    } catch (err) {
        console.error("Fetch error:", err); // Wypisujemy błąd w konsoli, aby programista mógł go zobaczyć
        showMessage('booking-message', 'Błąd: Nie udało się pobrać rezerwacji z serwera.', true); // Wyświetlamy komunikat błędu dla użytkownika
    }
}

// ==========================================
// GENEROWANIE SIATKI KALENDARZA (Z a11y)
// ==========================================
function generateTimeSlots() {
    if (!grid) return; // Zapobiega błędom, jeśli kontener kafelków nie istnieje w DOM
    grid.innerHTML = '';  // Usuwamy stare kafelki przed nałożeniem nowych
    
    // Pętla budująca kalendarz od godziny 8:00 do 21:00
    for (let hour = 8; hour <= 21; hour++) {
        ['00', '30'].forEach(minutes => {
            // Formatujemy liczbę do ładnego tekstu, np. "08:30" (zabezpieczając zera z przodu)
            const time = `${hour.toString().padStart(2, '0')}:${minutes}`; // padStart(2, '0') dodaje zero z przodu, jeśli liczba jest jednocyfrowa (np. 8 -> "08")
            
            let status = 'free'; // Domyślnie zakładamy, że dana godzina jest pusta

            // Jeśli ta godzina jest na naszej liście pobranej z bazy - zmieniamy jej łatkę (status)
            if (Object.keys(takenByOthers).includes(time)) status = 'taken'; // Cudza rezerwacja (czerwony)
            if (myBookings.includes(time)) status = 'my-booking'; // Własna rezerwacja (zielony)

            if (selectedSlots.includes(time)) status = 'selecting'; // Wybrany do rezerwacji (żółty)
            if (selectedToCancel.includes(time)) status = 'canceling'; // Wybrany do anulowania (czerwony)

            const slot = document.createElement('div'); // Tworzymy nowy kafelek w DOM
            slot.classList.add('time-slot', status); // Dodajemy klasę CSS odpowiadającą statusowi kafelka (free, taken, my-booking, selecting, canceling)
            
            //Wyświetlanie e-maila tylko dla admina
            // Zabezpieczamy prywatność: tylko zalogowany administrator może zobaczyć pełne dane.
            if (status === 'taken' && userRole === 'admin') {
                // Pobieramy adres e-mail klienta, który zarezerwował ten termin
                const clientEmail = takenByOthers[time]; // Pobieramy e-mail z obiektu takenByOthers, gdzie kluczem jest godzina
                // Wstawiamy e-mail do kafelka, włączając dzielenie wyrazów (word-break), 
                // aby długie adresy e-mail nie psuły układu siatki.
                slot.innerHTML = `${time}<br><span style="font-size: 10px; word-break: break-all;">${clientEmail}</span>`;
                // Dodajemy wyskakujące okienko z informacją pojawiającą się po najechaniu myszką
                slot.title = `Rezerwacja klienta: ${clientEmail}`; 
            } else {
                // Jeśli kafelek przegląda zwykły klient lub gość, pokazujemy wyłącznie godzinę
                slot.textContent = time;
            }

            slot.tabIndex = 0; // Umożliwia nawigację po kafelkach za pomocą klawisza TAB (dostępność dla osób niewidomych)
            slot.setAttribute('aria-label', `Godzina ${time}, status: ${status}`); // Dodajemy opis dla czytników ekranowych (A11Y), aby osoby niewidome wiedziały, co oznacza dany kafelek

            slot.addEventListener('click', () => handleSlotAction(slot, time, status)); // Dodajemy obsługę kliknięcia w kafelek, wywołując funkcję handleSlotAction z odpowiednimi parametrami (slot, godzina, status)
            
            slot.addEventListener('keydown', (event) => { // Dodajemy obsługę klawiszy Enter i Spacja, aby osoby korzystające z klawiatury mogły również wybrać kafelek
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); // Zapobiegamy domyślnemu zachowaniu przeglądarki (np. przewijaniu strony przy spacji)
                    slot.click(); // Symulujemy kliknięcie w kafelek, wywołując funkcję handleSlotAction z odpowiednimi parametrami (slot, godzina, status)
                }
            });

            grid.appendChild(slot); // Ostatecznie wrzucamy gotowy <div> kafelka do wielkiej siatki CSS
        });
    }
}

// ==========================================
// ZARZĄDZANIE KLIKNIĘCIAMI KAFELKÓW
// ==========================================
// Ta funkcja odpala się za każdym razem, gdy kliknięty jest dowolny prostokącik kalendarza
function handleSlotAction(slot, time, status) {
    hideMessage('booking-message'); // Ukrywamy poprzednie komunikaty o błędach lub sukcesie przed nowym kliknięciem

   // -- PRZYPADEK 1: Kliknięto kafelek zajęty przez kogoś innego (Czerwony) --
    if (status === 'taken') {
        // Admin traktuje "taken" jak własną rezerwację - może ją anulować
        if (userRole === 'admin') {
            slot.classList.replace('taken', 'canceling'); // Zmieniamy kolor kafelka na czerwony, aby pokazać, że jest wybrany do anulowania
            selectedToCancel.push(time); // Dodajemy godzinę do listy terminów przeznaczonych do skasowania
            
            const cancelContainer = document.getElementById('cancel-container'); // Pokazujemy dolny panel potwierdzenia usunięcia i wypisujemy wybrane godziny
            document.getElementById('cancel-time-label').textContent = selectedToCancel.sort().join(', '); // Sortujemy godziny rosnąco i łączymy je w jeden string, np. "15:00, 15:30"
            cancelContainer.style.display = 'block'; // Pokazujemy panel potwierdzenia anulacji, jeśli wybrano co najmniej jedną godzinę; w przeciwnym razie go ukrywamy
            
        } else {
            // Zwykły klient dostaje po prostu komunikat o zablokowanym terminie
            showMessage('booking-message', `Termin ${time} jest niedostępny. Wybierz wolny godzinowy blok.`, true);
        }
        return; 
    }

    // -- PRZYPADEK 2: Kliknięto kafelek wolny (Biały) lub przed chwilą przez nas wybrany (Żółty) --
    if (status === 'free' || status === 'selecting') { 
        // Jeśli kafelek był już zaznaczony na żółto, kliknięcie go odznacza (wraca na biały)
        if (slot.classList.contains('selecting')) {
            slot.classList.replace('selecting', 'free');
            selectedSlots = selectedSlots.filter(t => t !== time); // Usuwamy tę godzinę z listy wybranych do rezerwacji
        } else { // Jeśli był wolny, zaznaczamy go do rezerwacji i dodajemy godzinę do listy
            slot.classList.replace('free', 'selecting');
            selectedSlots.push(time);
        }
        // Aktualizujemy opis kafelka dla czytników ekranowych (wsparcie dla osób niewidomych)
        slot.setAttribute('aria-label', `Godzina ${time}, status: ${slot.classList[1]}`);
    }

    // -- PRZYPADEK 3: Kliknięto na swój własny potwierdzony kafelek (Zielony) lub ten, z którego usunięcia się rozmyśliliśmy --
    if (status === 'my-booking' || status === 'canceling') {
        if (slot.classList.contains('canceling')) {
            // Użytkownik rozmyślił się i odznacza kafelek z listy do usunięcia.
            if (userRole === 'admin' && Object.keys(takenByOthers).includes(time)) { // Jeśli to admin i odznacza cudzy termin, kafelek wraca do czerwonego
                slot.classList.replace('canceling', 'taken');
            } else { // Własna rezerwacja po odznaczeniu bezpiecznie wraca do koloru zielonego
                slot.classList.replace('canceling', 'my-booking');
            }
            // Usuwamy tę godzinę z listy terminów przeznaczonych do skasowania
            selectedToCancel = selectedToCancel.filter(t => t !== time); 
        } else {
            // Zaznaczamy własny zielony kafelek do anulowania i dopisujemy go do listy
            slot.classList.replace('my-booking', 'canceling');
            selectedToCancel.push(time);
        }
        // Pokazujemy panel potwierdzenia anulacji, jeśli wybrano co najmniej jedną godzinę; w przeciwnym razie go ukrywamy
        const cancelContainer = document.getElementById('cancel-container');
        if (selectedToCancel.length > 0) {
            cancelContainer.style.display = 'block';
            document.getElementById('cancel-time-label').textContent = selectedToCancel.sort().join(', ');
        } else {
            cancelContainer.style.display = 'none';
        }
    }
}

// ==========================================
// WYSYŁANIE NOWEJ REZERWACJI (ZABEZPIECZENIA I POST)
// ==========================================
const confirmBookingBtn = document.getElementById('confirm-booking-btn'); // Pobieramy przycisk potwierdzający rezerwację z DOM
if (confirmBookingBtn) { 
    confirmBookingBtn.addEventListener('click', async () => { // "async" oznacza operację która dzieje się w tle i na której zakończenie (await) przeglądarka musi poczekać
        const resDate = dateInput.value; // Pobieramy wybraną datę z pola wyboru w kalendarzu

        if (!resDate) {
            showMessage('booking-message', 'Błąd: Wybierz datę rezerwacji z kalendarza.', true); // Wyświetlamy komunikat błędu, jeśli użytkownik nie wybrał daty
            return;
        }

       
        const proposedBookings = [...myBookings, ...selectedSlots]; // Tworzymy tymczasową listę wszystkich godzin, które użytkownik chce mieć w rezerwacji (stare + nowe)
        
        if (selectedSlots.length === 0) {
            showMessage('booking-message', 'Błąd: Zaznacz kafelki, które chcesz zarezerwować.', true); // Wyświetlamy komunikat błędu, jeśli użytkownik nie zaznaczył żadnych kafelków do rezerwacji
            return;
        }

        // Weryfikujemy naszą regułą biznesową (minimum 2h, brak dziur), jeszcze zanim połączymy się z serwerem
        if (!validateContinuousBlock(proposedBookings)) {
            showMessage('booking-message', 'Błąd: Twój pobyt na siłowni musi stanowić ciągły blok od 1 do 2 godzin (maksymalnie 4 kafelki). Kafelki muszą do siebie przylegać.', true);
            return;
        }

        // Odpalamy asynchroniczne żądanie Fetch typu POST do naszego Node.js.
        // Wysyłamy nasze "wnioski" spakowane i zakodowane w formie pliku tekstowego JSON.
        try {
            const response = await fetch('http://localhost:5000/api/reservations', { // fetch wysyła żądanie do serwera, a await czeka na odpowiedź zanim przejdzie do kolejnej linii
                method: 'POST', // Metoda POST oznacza, że chcemy wysłać dane do serwera w celu utworzenia nowej rezerwacji
                headers: { 'Content-Type': 'application/json' }, // Nagłówek Content-Type informuje serwer, że wysyłamy dane w formacie JSON
                body: JSON.stringify({ // body to treść żądania, którą wysyłamy do serwera. JSON.stringify zamienia obiekt JavaScript na tekst JSON
                    user_id: currentUserId, // ID zalogowanego użytkownika, który chce dokonać rezerwacji
                    reservation_date: resDate, // Data rezerwacji w formacie YYYY-MM-DD, pobrana z pola wyboru w kalendarzu
                    time_slots: selectedSlots // Lista godzin (kafelków) wybranych do rezerwacji, np. ['15:00', '15:30']
                })
            });

            const data = await response.json(); // Odczytujemy odpowiedź serwera i zamieniamy ją z formatu JSON na obiekt JavaScript, aby móc łatwo odczytać komunikaty lub dane zwrócone przez serwer

            if (response.ok) {
                showMessage('booking-message', 'Pomyślnie zarezerwowano trening!', false);
                selectedSlots = [];
                // Po udanym zapisie pobieramy odświeżony stan kafelków
                fetchReservations(resDate);
            } else {
                showMessage('booking-message', data.message, true);
            }
        } catch (err) {
            console.error(err);
            showMessage('booking-message', 'Błąd połączenia z serwerem.', true);
        }
    });
}

// ==========================================
// ANULOWANIE I CZYSZCZENIE
// ==========================================
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', async () => { // dodajemy obsługę kliknięcia w przycisk potwierdzający anulowanie rezerwacji
        if (selectedToCancel.length === 0) return; // Jeśli nie wybrano żadnych kafelków do anulowania, nic nie robimy

        const remainingBookings = myBookings.filter(t => !selectedToCancel.includes(t)); // sprawdzamy, które kafelki pozostaną po anulowaniu wybranych

        if (!validateContinuousBlock(remainingBookings)) { // jeśli po anulowaniu pozostałe kafelki nie tworzą ciągłego bloku, wyświetlamy komunikat błędu
            showMessage('booking-message', 'Błąd: Po anulowaniu, Twój pozostały czas musi stanowić ciągły blok min. 1 godziny. Nie możesz "rozbić" treningu na pół ani zostawić pojedynczego kafelka.', true);
            return;
        }

        const resDate = dateInput.value;
        const count = selectedToCancel.length;

        try {
            // Wysłanie zapytania DELETE do serwera
            const response = await fetch('http://localhost:5000/api/reservations', {
                method: 'DELETE', // Metoda DELETE oznacza, że chcemy usunąć dane z serwera
                headers: { 'Content-Type': 'application/json' }, // Nagłówek Content-Type informuje serwer, że wysyłamy dane w formacie JSON
                body: JSON.stringify({ // ciało żądania zawiera dane potrzebne do anulowania rezerwacji
                    user_id: currentUserId,
                    user_role: userRole,
                    reservation_date: resDate,
                    time_slots: selectedToCancel
                })
            });

            const data = await response.json(); // Odczytujemy odpowiedź serwera i zamieniamy ją z formatu JSON na obiekt JavaScript, aby móc łatwo odczytać komunikaty lub dane zwrócone przez serwer

            if (response.ok) {
                showMessage('booking-message', `Usunięto z rezerwacji ${count} blok(i) czasowe.`, false);
                selectedToCancel = [];
                document.getElementById('cancel-container').style.display = 'none';
                
                // Odświeżenie widoku kalendarza (pobranie aktualnego stanu z bazy)
                fetchReservations(resDate);
            } else {
                showMessage('booking-message', data.message, true);
            }
        } catch (err) {
            console.error(err);
            showMessage('booking-message', 'Błąd połączenia z serwerem podczas anulowania.', true);
        }
    });
}

// Przycisk "Zwiń" na dolnym pasku kasowania – porzuca procedurę usuwania
const closeCancelBtn = document.getElementById('close-cancel-btn'); // Pobieramy przycisk zamykający panel anulowania rezerwacji
if (closeCancelBtn) { 
    closeCancelBtn.addEventListener('click', () => { // Dodajemy obsługę kliknięcia w przycisk zamykający panel anulowania rezerwacji
        selectedToCancel = []; // Czyścimy listę wybranych kafelków do anulowania
        document.getElementById('cancel-container').style.display = 'none'; // Ukrywamy panel anulowania rezerwacji
        generateTimeSlots(); // Odświeżamy widok kalendarza, aby przywrócić kolory kafelków do stanu sprzed zaznaczenia do anulowania
    });
}

// ==========================================
// WYLOGOWANIE I RESET STANU
// ==========================================
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        // CZYŚCIMY RAM PRZEGLĄDARKI
        // Trzeba pozbyć się ról, ID i cudzych maili, żeby osoba, która usiądzie
        // do tego komputera 5 sekund po nas, nie weszła na nasze własne konto.
        userRole = 'client';
        currentUserId = null;
        selectedSlots = [];
        selectedToCancel = [];
        myBookings = [];
        takenByOthers = {}; // {} zamiast [] bo to obiekt, nie tablica
        
        hideMessage('booking-message');
        hideMessage('auth-message-box');
        
        // Ukrywamy wielki panel kalendarza i ponownie nakładamy białą planszę z oknem logowania
        document.getElementById('loginForm').reset();
        document.getElementById('cancel-container').style.display = 'none';
        document.getElementById('reservation-section').style.display = 'none';
        document.getElementById('auth-section').style.display = 'block';
    });
}

// ==========================================
// ODPALANIE LOGOWANIA ORAZ REJESTRACJI
// ==========================================

// --- LOGOWANIE ---
document.getElementById('loginForm').addEventListener('submit', async (e) => { // Dodajemy obsługę zdarzenia "submit" dla formularza logowania
    e.preventDefault();  // "preventDefault()" blokuje klasyczne zachowanie przeglądarek (które automatycznie 
    // przeładowują całą stronę po wciśnięciu przycisku 'Submit'). My wysyłamy logowanie dyskretnie (w tle).
    
    const email = document.getElementById('login-email').value.trim(); // value.trim() usuwa spacje z początku i końca tekstu, aby przypadkowe spacje nie powodowały błędów logowania
    const password = document.getElementById('login-password').value; // .value pobiera aktualną wartość pola hasła z formularza logowania
    const msgBox = document.getElementById('auth-message-box'); // Pobieramy element DOM, w którym wyświetlamy komunikaty o błędach lub sukcesie logowania

    // Błyskawiczna weryfikacja u klienta (po co odpytywać bazę, skoro w mailu i tak nie ma znaku '@'?)
    if (!email.includes('@')) {
        if (msgBox) {
            msgBox.textContent = "Podaj poprawny format e-mail (musi zawierać znak @).";
            msgBox.style.display = 'block';
            msgBox.style.color = '#dc3545';
        }
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/login', {
            method: 'POST', // Metoda POST oznacza, że chcemy wysłać dane do serwera w celu zalogowania użytkownika
            headers: { 'Content-Type': 'application/json' }, // Nagłówek Content-Type informuje serwer, że wysyłamy dane w formacie JSON
            body: JSON.stringify({ email, password }) // stringify zamienia obiekt JS na tekst JSON, który wysyłamy do serwera
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // === PRZEJŚCIE DO PANELU PO ZALOGOWANIU ===
            currentUserId = data.user.id; // Zapisujemy ID zalogowanego użytkownika w pamięci przeglądarki, aby wiedzieć, które rezerwacje należą do niego
            userRole = data.user.role;  // Zapisujemy rolę użytkownika (admin/klient) w pamięci przeglądarki, aby wiedzieć, jakie uprawnienia ma zalogowany użytkownik
            
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('reservation-section').style.display = 'block';
            
            if (msgBox) msgBox.style.display = 'none';
            
            // Automatyczne ustawienie daty i wczytanie rezerwacji z bazy
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.value = today;
                fetchReservations(today);
            }
        } else {
            // Błąd zwrócony przez serwer
            if (msgBox) {
                msgBox.textContent = data.message;
                msgBox.style.display = 'block';
                msgBox.style.color = '#dc3545';
            }
        }
    } catch (err) {
        console.error("Błąd fetch:", err);
        if (msgBox) {
            msgBox.textContent = "Błąd połączenia z serwerem. Upewnij się, że serwer działa na porcie 5000.";
            msgBox.style.display = 'block';
            msgBox.style.color = '#dc3545';
        }
    }
});

// ==========================================
// REJESTRACJA (Połączenie z serwerem)
// ==========================================
// Wszystko podobnie jak w logowaniu, tylko że wysyłamy dane do innego endpointu i nie logujemy od razu użytkownika
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const msgBox = document.getElementById('auth-message-box');

        // Walidacja formatu e-mail
        if (!email.includes('@')) {
            if (msgBox) {
                msgBox.textContent = "Podaj poprawny format e-mail (musi zawierać znak @).";
                msgBox.style.display = 'block';
                msgBox.style.color = '#dc3545';
            }
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (msgBox) {
                    msgBox.textContent = "Konto założone! Możesz się teraz zalogować.";
                    msgBox.style.display = 'block';
                    msgBox.style.color = '#28a745'; 
                }
                registerForm.reset(); // Czyścimy formularz rejestracji po udanej rejestracji
                
                setTimeout(() => { // Po 2 sekundach automatycznie przełączamy widok na logowanie, aby użytkownik mógł się zalogować po rejestracji
                    document.getElementById('show-login').click();
                    if(msgBox) msgBox.style.display = 'none';
                }, 2000);
            } else {
                if (msgBox) { // Wyświetlamy komunikat błędu zwrócony przez serwer, np. "Użytkownik już istnieje"
                    msgBox.textContent = data.message;
                    msgBox.style.display = 'block';
                    msgBox.style.color = '#dc3545';
                }
            }
        } catch (err) { 
            console.error("Błąd fetch:", err);
            if (msgBox) {
                msgBox.textContent = "Błąd połączenia z serwerem.";
                msgBox.style.display = 'block';
                msgBox.style.color = '#dc3545';
            }
        }
    });
}

// ==========================================
// PRZEŁĄCZANIE WIDOKÓW LOGOWANIE / REJESTRACJA
// ==========================================
// Obsługa kliknięcia w link "Nie masz konta? Zarejestruj się" i "Masz już konto? Zaloguj się"
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-box').style.display = 'none';
    document.getElementById('register-box').style.display = 'block';
    const msgBox = document.getElementById('auth-message-box');
    if(msgBox) msgBox.style.display = 'none';
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-box').style.display = 'none';
    document.getElementById('login-box').style.display = 'block';
    const msgBox = document.getElementById('auth-message-box');
    if(msgBox) msgBox.style.display = 'none';
});

// ==========================================
// NAWIGACJA STRZAŁKAMI PO KAFELKACH (a11y)
// ==========================================
if (grid) {
    grid.addEventListener('keydown', (e) => {
        // Lista klawiszy, na które ma reagować nasz kalendarz (tylko strzałki)
        const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        
        // Ignoruj inne klawisze, niech obsługuje je domyślna logika (np. Tab, Enter)
        if (!allowedKeys.includes(e.key)) return; // .key zwraca nazwę wciśniętego klawisza, np. 'ArrowUp', 'Enter', 'Tab'

        // Zbieramy wszystkie kafelki do listy i szukamy, na którym z nich aktualnie jesteśmy
        const slots = Array.from(grid.querySelectorAll('.time-slot'));
        const currentIndex = slots.indexOf(document.activeElement); 
        
        // Jeśli kursor w ogóle nie jest na kalendarzu, przerywamy działanie
        if (currentIndex === -1) return; 
        // Blokujemy domyślne przesuwanie strony w górę/dół podczas wciskania strzałek
        e.preventDefault();

        // Obliczamy, ile kafelków mieści się w jednym rzędzie. 
        // Dzięki temu strzałki działają dobrze zarówno na telefonie, jak i na komputerze.
        let cols = 0;
        if (slots.length > 0) {
            const firstTop = slots[0].offsetTop;
            for (let i = 0; i < slots.length; i++) {
                if (slots[i].offsetTop === firstTop) cols++;
                else break;
            }
        }
        // Ustalamy, na który kafelek mamy przeskoczyć w zależności od wciśniętej strzałki
        let nextIndex = currentIndex;
        switch (e.key) {
            case 'ArrowLeft':
                nextIndex = currentIndex - 1;
                break;
            case 'ArrowRight':
                nextIndex = currentIndex + 1;
                break;
            case 'ArrowUp':
                nextIndex = currentIndex - cols;
                break;
            case 'ArrowDown':
                nextIndex = currentIndex + cols;
                break;
        }

        // Jeśli docelowy kafelek istnieje, przenosimy na niego podświetlenie
        if (nextIndex >= 0 && nextIndex < slots.length) {
            slots[nextIndex].focus();
        }
    });
}