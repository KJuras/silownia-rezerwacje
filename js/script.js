// Czekamy na pełne załadowanie strony HTML przed uruchomieniem kodu
document.addEventListener('DOMContentLoaded', () => {
    
    // --- POBIERANIE ELEMENTÓW Z EKRANU ---
    // Przypisujemy fragmenty strony (np. formularze, przyciski) do zmiennych, aby móc nimi sterować
    const authSection = document.getElementById('auth-section'); 
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm'); 
    const reservationSection = document.getElementById('reservation-section');
    const messageBox = document.getElementById('auth-message-box'); 
    const logoutBtn = document.getElementById('logout-btn');

    // Funkcja pomocnicza: wyświetla kolorowe komunikaty (czerwone błędy lub zielone sukcesy)
    const showMessage = (message, isError = true) => {
        if (!messageBox) return; // Zabezpieczenie przed brakiem elementu
        messageBox.textContent = message;
        messageBox.style.display = 'block';
        messageBox.className = 'message-box ' + (isError ? 'error' : 'success');
    };

    // Funkcja sprawdzająca czy podany tekst wygląda jak prawdziwy e-mail (tzw. Wyrażenie Regularne)
    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email); // Zwraca prawda/fałsz
    };

    // --- ANIMOWANIE ZMIANY WIDOKÓW (Logowanie <-> Rejestracja) ---
    // Zamiast ładować nową stronę, po prostu ukrywamy jeden box i pokazujemy drugi
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault(); // Blokuje domyślne "skakanie" strony do góry po kliknięciu w link
        if (loginBox) loginBox.style.display = 'none';
        if (registerBox) registerBox.style.display = 'block';
        if (messageBox) messageBox.style.display = 'none';
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (registerBox) registerBox.style.display = 'none';
        if (loginBox) loginBox.style.display = 'block';
        if (messageBox) messageBox.style.display = 'none';
    });

    // ==========================================
    // ETAP 1: SYSTEM KONT (Rejestracja, Logowanie, Wylogowanie)
    // ==========================================

    // CO SIĘ DZIEJE PO KLIKNIĘCIU "UTWÓRZ KONTO":
    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            // Pobranie wpisanych danych
            const emailInput = document.getElementById('reg-email')?.value.trim();
            const passwordInput = document.getElementById('reg-password')?.value.trim();

            // Sprawdzanie poprawności danych (walidacja po stronie przeglądarki)
            if (!emailInput || !passwordInput) return showMessage('Proszę wypełnić wszystkie pola rejestracji.', true); 
            if (!isValidEmail(emailInput)) return showMessage('Podaj poprawny adres e-mail.', true);
            if (passwordInput.length < 8) return showMessage('Hasło musi mieć minimum 8 znaków.', true); 

            // Jeśli wszystko ok - wyświetl sukces
            showMessage('Konto pomyślnie utworzone! Możesz się teraz zalogować.', false);
            registerForm.reset(); // Czyszczenie formularza
            
            // Po 2 sekundach automatycznie przenieś na ekran logowania
            setTimeout(() => {
                if (registerBox) registerBox.style.display = 'none';
                if (loginBox) loginBox.style.display = 'block';
            }, 2000);
        });
    }

    // CO SIĘ DZIEJE PO KLIKNIĘCIU "ZALOGUJ SIĘ":
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const emailInput = document.getElementById('login-email')?.value.trim();
            const passwordInput = document.getElementById('login-password')?.value.trim();

            // Walidacja upewniająca się, że nikt nie wcisnął "Zaloguj" zostawiając puste pola
            if (!emailInput || !passwordInput) return showMessage('Proszę wypełnić wszystkie pola.', true); 
            if (!isValidEmail(emailInput)) return showMessage('Podaj poprawny format e-mail.', true);
            if (passwordInput.length < 8) return showMessage('Hasło musi mieć min. 8 znaków.', true); 

            showMessage('Trwa logowanie...', false);
            
            try {
                // Wysłanie zapytania z danymi logowania do naszego serwera Node.js
                const response = await fetch('http://127.0.0.1:5000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput, password: passwordInput })
                });
                
                // Oczekiwanie na to, co odpowie serwer
                const data = await response.json();

                if (response.ok) {
                    // Logowanie udane: Ukrywamy formularze, pokazujemy kalendarz
                    if (authSection) authSection.style.display = 'none';
                    if (reservationSection) reservationSection.style.display = 'block';
                    
                    // Ustawiamy w kalendarzu dzisiejszą datę
                    const dateEl = document.getElementById('reservation-date');
                    if (dateEl) dateEl.valueAsDate = new Date();
                    
                    // Rysujemy siatkę godzin
                    generateTimeSlots(); 
                } else {
                    // Serwer odrzucił dane (np. złe hasło)
                    showMessage(data.message || 'Błąd logowania.', true);
                }
            } catch (error) {
                // Błąd krytyczny np. wyłączony serwer Node.js
                showMessage('Brak połączenia z serwerem.', true);
            }
        });
    }

    // CO SIĘ DZIEJE PO KLIKNIĘCIU "WYLOGUJ":
    logoutBtn?.addEventListener('click', () => {
        // Chowamy kalendarz, przywracamy ekran logowania, ukrywamy wszystkie ewentualne okienka z błędami
        if (reservationSection) reservationSection.style.display = 'none';
        if (authSection) authSection.style.display = 'block';
        if (loginBox) loginBox.style.display = 'block';
        if (registerBox) registerBox.style.display = 'none';
        if (loginForm) loginForm.reset();
        
        if (messageBox) messageBox.style.display = 'none';
        const bMsg = document.getElementById('booking-message');
        if (bMsg) bMsg.style.display = 'none';
        const cancelCont = document.getElementById('cancel-container');
        if (cancelCont) cancelCont.style.display = 'none';
    });

    // ==========================================
    // ETAP 2: KALENDARZ (Siatka godzin i reguły biznesowe)
    // ==========================================
    const gridContainer = document.getElementById('time-slots-grid');
    const dateInput = document.getElementById('reservation-date');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const bookingMessage = document.getElementById('booking-message');
    
    const cancelContainer = document.getElementById('cancel-container');
    const cancelTimeLabel = document.getElementById('cancel-time-label');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const closeCancelBtn = document.getElementById('close-cancel-btn');
    
    // Tablice śledzące wyklikiwane przez nas elementy
    let currentlySelectedSlots = [];
    let slotsToCancel = []; 
    let generatedHoursArray = []; 
    
    // Tymczasowe dane: Nasze zajęte okienka i zajęte przez innych (później zastąpi je baza danych)
    let myBookings = ['16:00', '16:30']; 
    const takenByOthers = ['17:00', '17:30', '19:00']; 

    // Jak użytkownik wybierze inną datę z kalendarzyka, odświeżamy siatkę godzin
    dateInput?.addEventListener('change', () => generateTimeSlots());

    // Główna funkcja budująca godziny od 5:00 do 23:00 na ekranie
    const generateTimeSlots = () => {
        if (!gridContainer) return;
        
        // Czyszczenie starego widoku
        gridContainer.innerHTML = '';
        currentlySelectedSlots = []; 
        slotsToCancel = [];
        if (cancelContainer) cancelContainer.style.display = 'none';
        generatedHoursArray = [];

        // Matematyczne pętle generujące godziny np. 05:00, 05:30
        for (let h = 5; h <= 23; h++) {
            const formattedHour = h.toString().padStart(2, '0');
            generatedHoursArray.push(`${formattedHour}:00`);
            if (h < 23) { generatedHoursArray.push(`${formattedHour}:30`); }
        }

        // Nakładanie kafelków na stronę na podstawie wygenerowanej przed chwilą rozpiski
        generatedHoursArray.forEach(time => {
            const slot = document.createElement('div');
            slot.classList.add('time-slot');
            slot.textContent = time; // Podpis okienka to godzina
            slot.dataset.time = time; // Pamiętamy godzinę w parametrach "pod spodem"

            // Nadawanie kafelkom kolorów i zachowań w zależności od tego, do kogo należą
            if (myBookings.includes(time)) {
                slot.classList.add('my-booking'); // ZIELONY - nasze, kliknięcie pozwala anulować
                slot.addEventListener('click', () => toggleCancelSelection(slot, time));
            } else if (takenByOthers.includes(time)) {
                slot.classList.add('taken'); // CZERWONY - cudze, zablokowane
            } else {
                slot.classList.add('free'); // BIAŁY - wolny, pozwala rezerwować
                slot.addEventListener('click', () => toggleSlotSelection(slot, time));
            }

            gridContainer.appendChild(slot);
        });
    };

    // Obsługa klikania w zielone okienka w celu ich skasowania
    const toggleCancelSelection = (slotElement, time) => {
        // Zaznacz/odznacz godzinę
        if (slotsToCancel.includes(time)) {
            slotsToCancel = slotsToCancel.filter(t => t !== time);
            slotElement.classList.remove('to-cancel');
        } else {
            slotsToCancel.push(time);
            slotElement.classList.add('to-cancel');
        }

        // Jeśli wybrano coś do usunięcia, pokaż mały panel ostrzegawczy na dole
        if (cancelContainer && cancelTimeLabel) {
            if (slotsToCancel.length > 0) {
                cancelTimeLabel.textContent = slotsToCancel.sort().join(', ');
                cancelContainer.style.display = 'block';
                if (bookingMessage) bookingMessage.style.display = 'none';
            } else {
                cancelContainer.style.display = 'none';
            }
        }
    };

    // Zwijanie panelu anulowania rezerwacji
    closeCancelBtn?.addEventListener('click', () => {
        slotsToCancel = [];
        generateTimeSlots(); 
    });

    // Zabezpieczenie logiczne - sprawdza, czy godziny układają się "po kolei", a nie z przerwami
    const isValidBookingState = (proposedBookings) => {
        if (proposedBookings.length === 0) return true; 
        const indices = proposedBookings.map(t => generatedHoursArray.indexOf(t));
        
        // Pętla sprawdza, czy obok zaznaczonego indeksu znajduje się bezpośrednio okienko o numer przed lub numer po nim
        for (let i = 0; i < indices.length; i++) {
            const currentIdx = indices[i];
            const hasNeighbor = indices.includes(currentIdx - 1) || indices.includes(currentIdx + 1);
            if (!hasNeighbor) return false; 
        }
        return true;
    };

    // Zatwierdzanie usunięcia starych rezerwacji
    confirmCancelBtn?.addEventListener('click', () => {
        if (slotsToCancel.length === 0) return;

        // Symulacja tego, jak wyglądałby kalendarz po usunięciu wybranych okienek
        const proposedNewBookings = myBookings.filter(t => !slotsToCancel.includes(t));

        // Sprawdzamy, czy po kasowaniu nie zostały puste luki (pojedyncze okienka trwające zaledwie 30 min)
        if (!isValidBookingState(proposedNewBookings)) {
            if (bookingMessage) {
                bookingMessage.textContent = `Błąd: Zaznacz wszystkie powiązane okienka, aby anulować cały blok.`;
                bookingMessage.className = 'message-box error';
                bookingMessage.style.display = 'block';
            }
            return;
        }

        // Wszystko gra, podmieniamy stan aplikacji i generujemy nowe widoki
        myBookings = proposedNewBookings;
        const removedSlotsText = slotsToCancel.sort().join(', ');
        generateTimeSlots(); 
        
        if (bookingMessage) {
            bookingMessage.textContent = `Pomyślnie anulowano rezerwacje: ${removedSlotsText}.`;
            bookingMessage.className = 'message-box success';
            bookingMessage.style.display = 'block';
        }
    });

    // Obsługa wybierania białych (pustych) okienek
    const toggleSlotSelection = (slotElement, time) => {
        if (slotElement.classList.contains('selecting')) {
            slotElement.classList.remove('selecting'); // Odznaczanie
            currentlySelectedSlots = currentlySelectedSlots.filter(t => t !== time);
        } else {
            slotElement.classList.add('selecting'); // Zaznaczanie (żółty kolor)
            currentlySelectedSlots.push(time);
        }
    };

    // Zatwierdzanie dodania NOWYCH rezerwacji (Przycisk pod kalendarzem)
    confirmBtn?.addEventListener('click', () => {
        if (currentlySelectedSlots.length === 0) return;

        // Reguła biznesowa nr 1: Jeśli próbujesz zarezerwować tylko 1 okienko (30 min)
        if (currentlySelectedSlots.length === 1) {
            const selectedTime = currentlySelectedSlots[0];
            const indexInArray = generatedHoursArray.indexOf(selectedTime);
            
            // Sprawdzamy co było pół godziny temu i co będzie za pół godziny
            const prevSlot = generatedHoursArray[indexInArray - 1];
            const nextSlot = generatedHoursArray[indexInArray + 1];
            
            // Pojedyncze okienko możemy zatwierdzić TYLKO gdy sąsiaduje już z inną naszą rezerwacją (jest przedłużeniem)
            const isExtension = myBookings.includes(prevSlot) || myBookings.includes(nextSlot);
            
            if (!isExtension) {
                if (bookingMessage) {
                    bookingMessage.textContent = 'Błąd: Nowa rezerwacja musi trwać minimum 1 godzinę. Pojedynczy kafelek możesz wybrać tylko jako przedłużenie.';
                    bookingMessage.className = 'message-box error';
                    bookingMessage.style.display = 'block';
                }
                return;
            }
        } else {
            // Reguła biznesowa nr 2: Gdy rezerwujesz wiele okien, muszą iść po kolei
            const selectedIndices = currentlySelectedSlots
                .map(time => generatedHoursArray.indexOf(time))
                .sort((a, b) => a - b);

            let isConsecutive = true;
            for (let i = 1; i < selectedIndices.length; i++) {
                if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
                    isConsecutive = false;
                    break; // Przerwanie pętli ze względu na znalezienie przerwy
                }
            }

            if (!isConsecutive) {
                if (bookingMessage) {
                    bookingMessage.textContent = 'Błąd: Wybrane godziny muszą następować bezpośrednio po sobie.';
                    bookingMessage.className = 'message-box error';
                    bookingMessage.style.display = 'block';
                }
                return;
            }
        }

        // Wszystkie sprawdziany pomyślne - wpisujemy rezerwację (później wyślemy to do bazy)
        myBookings.push(...currentlySelectedSlots);
        if (bookingMessage) {
            bookingMessage.textContent = `Sukces! Zarezerwowano terminy: ${currentlySelectedSlots.sort().join(', ')}`;
            bookingMessage.className = 'message-box success';
            bookingMessage.style.display = 'block';
        }
        
        generateTimeSlots(); // Przerysuj kalendarz z nowymi zielonymi polami
    });
});