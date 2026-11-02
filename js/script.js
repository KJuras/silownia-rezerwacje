// ==========================================
// STAN APLIKACJI I ZMIENNE GLOBALNE
// ==========================================
let userRole = 'client'; 
let currentUserId = null;    // Przechowuje ID zalogowanego użytkownika
let selectedSlots = [];      // Kafelki wybrane do nowej rezerwacji
let selectedToCancel = [];   // Kafelki wybrane do anulowania

let myBookings = [];         // Pobierane dynamicznie z bazy danych
let takenByOthers = [];      // Pobierane dynamicznie z bazy danych

const grid = document.getElementById('time-slots-grid');
const dateInput = document.getElementById('reservation-date');

// ==========================================
// UNIWERSALNA WALIDACJA CIĄGŁOŚCI BLOKU
// ==========================================
function validateContinuousBlock(slots) {
    if (slots.length === 0) return true; // Usunięcie wszystkich kafelków jest dozwolone
    if (slots.length === 1) return false; // Minimum to 2 kafelki (1 godzina)
    if (slots.length > 4) return false; // Maksimum to 4 kafelki (2 godziny)

    // Sortujemy kafelki rosnąco, np. ['15:00', '15:30', '16:00']
    const sortedSlots = [...slots].sort();
    const timeToMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
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
// INICJALIZACJA DATY
// ==========================================
if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    
    // Zdarzenie zmiany daty w kalendarzu
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
function showMessage(elementId, text, isError = false) {
    const msgBox = document.getElementById(elementId);
    if (msgBox) {
        msgBox.textContent = text;
        msgBox.style.display = 'block';
        msgBox.style.backgroundColor = isError ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)';
        msgBox.style.color = isError ? '#dc3545' : '#28a745';
        msgBox.style.border = `1px solid ${isError ? '#dc3545' : '#28a745'}`;
    }
}

function hideMessage(elementId) {
    const msgBox = document.getElementById(elementId);
    if (msgBox) {
        msgBox.style.display = 'none';
    }
}

// ==========================================
// KOMUNIKACJA Z BAZĄ DANYCH (REST API)
// ==========================================

// Pobieranie rezerwacji z serwera dla wybranej daty
async function fetchReservations(dateString) {
    if (!currentUserId) return; // Zapobiega pobieraniu bez zalogowania

    try {
        const response = await fetch(`http://localhost:5000/api/reservations?date=${dateString}`);
        if (!response.ok) throw new Error('Błąd pobierania rezerwacji');
        
        const reservationsFromDb = await response.json();
        
        // Czyszczenie lokalnych tablic
        myBookings = [];
        takenByOthers = [];

        // Kategoryzowanie pobranych rezerwacji
        reservationsFromDb.forEach(res => {
            if (res.user_id === currentUserId) {
                myBookings.push(res.time_slot);
            } else {
                takenByOthers.push(res.time_slot);
            }
        });

        // Po rozdzieleniu danych rysujemy kalendarz
        generateTimeSlots();

    } catch (err) {
        console.error("Fetch error:", err);
        showMessage('booking-message', 'Błąd: Nie udało się pobrać rezerwacji z serwera.', true);
    }
}

// ==========================================
// GENEROWANIE SIATKI KALENDARZA (Z a11y)
// ==========================================
function generateTimeSlots() {
    if (!grid) return;
    grid.innerHTML = ''; 
    
    for (let hour = 8; hour <= 21; hour++) {
        ['00', '30'].forEach(minutes => {
            const time = `${hour.toString().padStart(2, '0')}:${minutes}`;
            
            let status = 'free';
            if (takenByOthers.includes(time)) status = 'taken';
            if (myBookings.includes(time)) status = 'my-booking';

            // Zachowanie wizualnego stanu przy przerysowaniu
            if (selectedSlots.includes(time)) status = 'selecting';
            if (selectedToCancel.includes(time)) status = 'canceling';

            const slot = document.createElement('div');
            slot.classList.add('time-slot', status);
            slot.textContent = time;

            // Dostępność dla niedowidzących (a11y)
            slot.tabIndex = 0; 
            slot.setAttribute('aria-label', `Godzina ${time}, status: ${status}`);

            // Obsługa myszy
            slot.addEventListener('click', () => handleSlotAction(slot, time, status));
            
            // Obsługa klawiatury (Enter / Spacja)
            slot.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    slot.click();
                }
            });

            grid.appendChild(slot);
        });
    }
}

// ==========================================
// LOGIKA INTERAKCJI Z KAFELKAMI
// ==========================================
function handleSlotAction(slot, time, status) {
    hideMessage('booking-message');

    // 1. BLOKADA: Kafelki zajęte przez innych ubiegających się
    if (status === 'taken') {
        if (userRole === 'admin') {
            // Zwykła wizualizacja dla admina, bez logiki klikania w zajęte kafelki
            showMessage('booking-message', `[PODGLĄD ADMINA] Termin ${time} jest zarezerwowany przez innego klienta.`, true);
        } else {
            showMessage('booking-message', `Termin ${time} jest niedostępny. Wybierz wolny godzinowy blok.`, true);
        }
        return; 
    }

    // 2. REZERWOWANIE WOLNYCH KAFELKÓW
    if (status === 'free' || status === 'selecting') {
        if (slot.classList.contains('selecting')) {
            slot.classList.replace('selecting', 'free');
            selectedSlots = selectedSlots.filter(t => t !== time);
        } else {
            slot.classList.replace('free', 'selecting');
            selectedSlots.push(time);
        }
        slot.setAttribute('aria-label', `Godzina ${time}, status: ${slot.classList[1]}`);
    }

    // 3. ANULOWANIE WŁASNYCH REZERWACJI (Tylko zaznaczanie na razie)
    if (status === 'my-booking' || status === 'canceling') {
        if (slot.classList.contains('canceling')) {
            slot.classList.replace('canceling', 'my-booking');
            selectedToCancel = selectedToCancel.filter(t => t !== time);
        } else {
            slot.classList.replace('my-booking', 'canceling');
            selectedToCancel.push(time);
        }
        slot.setAttribute('aria-label', `Godzina ${time}, status: ${slot.classList[1]}`);

        const cancelContainer = document.getElementById('cancel-container');
        const cancelLabel = document.getElementById('cancel-time-label');

        if (selectedToCancel.length > 0) {
            cancelContainer.style.display = 'block';
            cancelLabel.textContent = selectedToCancel.sort().join(', ');
        } else {
            cancelContainer.style.display = 'none';
        }
    }
}

// ==========================================
// WYSYŁANIE NOWEJ REZERWACJI (ZABEZPIECZENIA I POST)
// ==========================================
const confirmBookingBtn = document.getElementById('confirm-booking-btn');
if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', async () => {
        const resDate = dateInput.value;

        if (!resDate) {
            showMessage('booking-message', 'Błąd: Wybierz datę rezerwacji z kalendarza.', true);
            return;
        }

        // WALIDACJA NOWEGO STANU
        const proposedBookings = [...myBookings, ...selectedSlots];
        
        if (selectedSlots.length === 0) {
            showMessage('booking-message', 'Błąd: Zaznacz kafelki, które chcesz zarezerwować.', true);
            return;
        }

        if (!validateContinuousBlock(proposedBookings)) {
            showMessage('booking-message', 'Błąd: Twój pobyt na siłowni musi stanowić ciągły blok od 1 do 2 godzin (maksymalnie 4 kafelki). Kafelki muszą do siebie przylegać.', true);
            return;
        }

        // WYSYŁKA DO BAZY DANYCH (POST)
        try {
            const response = await fetch('http://localhost:5000/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    reservation_date: resDate,
                    time_slots: selectedSlots
                })
            });

            const data = await response.json();

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
    confirmCancelBtn.addEventListener('click', async () => {
        if (selectedToCancel.length === 0) return;

        // WALIDACJA STANU PO USUNIĘCIU
        const remainingBookings = myBookings.filter(t => !selectedToCancel.includes(t));

        if (!validateContinuousBlock(remainingBookings)) {
            showMessage('booking-message', 'Błąd: Po anulowaniu, Twój pozostały czas musi stanowić ciągły blok min. 1 godziny. Nie możesz "rozbić" treningu na pół ani zostawić pojedynczego kafelka.', true);
            return;
        }

        const resDate = dateInput.value;
        const count = selectedToCancel.length;

        try {
            // Wysłanie zapytania DELETE do serwera
            const response = await fetch('http://localhost:5000/api/reservations', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    user_role: userRole,
                    reservation_date: resDate,
                    time_slots: selectedToCancel
                })
            });

            const data = await response.json();

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

const closeCancelBtn = document.getElementById('close-cancel-btn');
if (closeCancelBtn) {
    closeCancelBtn.addEventListener('click', () => {
        selectedToCancel = [];
        document.getElementById('cancel-container').style.display = 'none';
        generateTimeSlots();
    });
}

// ==========================================
// WYLOGOWANIE I RESET STANU
// ==========================================
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        userRole = 'client';
        currentUserId = null;
        selectedSlots = [];
        selectedToCancel = [];
        myBookings = [];
        takenByOthers = [];
        
        hideMessage('booking-message');
        hideMessage('auth-message-box');
        
        document.getElementById('loginForm').reset();
        document.getElementById('cancel-container').style.display = 'none';
        document.getElementById('reservation-section').style.display = 'none';
        document.getElementById('auth-section').style.display = 'block';
    });
}

// ==========================================
// PRAWDZIWE LOGOWANIE (Bezpieczne)
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
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
        const response = await fetch('http://localhost:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // === PRZEJŚCIE DO PANELU PO ZALOGOWANIU ===
            currentUserId = data.user.id;
            userRole = data.user.role; 
            
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
                registerForm.reset();
                
                setTimeout(() => {
                    document.getElementById('show-login').click();
                    if(msgBox) msgBox.style.display = 'none';
                }, 2000);
            } else {
                if (msgBox) {
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