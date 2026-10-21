document.addEventListener('DOMContentLoaded', () => {
    
    // --- REFERENCJE DO ELEMENTÓW ---
    const loginForm = document.getElementById('loginForm');
    const messageBox = document.getElementById('message-box');
    const loginSection = document.getElementById('login-section');
    const reservationSection = document.getElementById('reservation-section');

    const showMessage = (message, isError = true) => {
        messageBox.textContent = message;
        messageBox.style.display = 'block';
        messageBox.className = 'message-box';
        messageBox.classList.add(isError ? 'error' : 'success'); 
    };

    // ==========================================
    // ETAP 1: LOGOWANIE
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const emailInput = document.getElementById('email').value.trim();
            const passwordInput = document.getElementById('password').value.trim();

            if (!emailInput || !passwordInput) { return showMessage('Proszę wypełnić wszystkie pola.', true); }
            if (passwordInput.length < 8) { return showMessage('Hasło musi mieć min. 8 znaków.', true); }

            const attemptLogin = async () => {
                showMessage('Trwa logowanie...', false);
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailInput, password: passwordInput })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        loginSection.style.display = 'none';
                        reservationSection.style.display = 'block';
                        document.getElementById('reservation-date').valueAsDate = new Date();
                        
                        generateTimeSlots(); // Inicjalizacja siatki po logowaniu
                    } else {
                        showMessage(data.message, true);
                    }
                } catch (error) {
                    showMessage('Brak połączenia z serwerem. Upewnij się, że backend działa.', true);
                }
            };
            
            attemptLogin(); 
        });
    }

    // ==========================================
    // ETAP 2: KALENDARZ I ZARZĄDZANIE REZERWACJAMI
    // ==========================================
    const gridContainer = document.getElementById('time-slots-grid');
    const dateInput = document.getElementById('reservation-date');
    const confirmBtn = document.getElementById('confirm-booking-btn');
    const bookingMessage = document.getElementById('booking-message');
    
    let currentlySelectedSlots = [];
    let generatedHoursArray = []; 
    
    // SYMULACJA BAZY DANYCH (Teraz jako zmienne globalne, aby można było je aktualizować i usuwać)
    let myBookings = ['16:00', '16:30']; // Nasze zielone kafelki
    const takenByOthers = ['17:00', '17:30', '19:00']; // Czerwone kafelki innych

    // Reakcja na zmianę daty
    dateInput.addEventListener('change', () => {
        generateTimeSlots();
    });

    const generateTimeSlots = () => {
        gridContainer.innerHTML = '';
        currentlySelectedSlots = []; 
        generatedHoursArray = [];

        // Generowanie przedziału 5:00 - 23:00
        for (let h = 5; h <= 23; h++) {
            const formattedHour = h.toString().padStart(2, '0');
            generatedHoursArray.push(`${formattedHour}:00`);
            if (h < 23) { generatedHoursArray.push(`${formattedHour}:30`); }
        }

        generatedHoursArray.forEach(time => {
            const slot = document.createElement('div');
            slot.classList.add('time-slot');
            slot.textContent = time;
            slot.dataset.time = time;

            if (myBookings.includes(time)) {
                slot.classList.add('my-booking'); // ZIELONE
                // NOWOŚĆ: Nasłuchiwanie na kliknięcie własnej rezerwacji (Anulowanie)
                slot.addEventListener('click', () => handleCancelBooking(time));
                
            } else if (takenByOthers.includes(time)) {
                slot.classList.add('taken'); // CZERWONE (Zablokowane)
                
            } else {
                slot.classList.add('free'); // BIAŁE (Można rezerwować)
                slot.addEventListener('click', () => toggleSlotSelection(slot, time));
            }

            gridContainer.appendChild(slot);
        });
    };

    // --- FUNKCJA ANULOWANIA REZERWACJI ---
    const handleCancelBooking = (time) => {
        // window.confirm to wbudowana w przeglądarkę funkcja okienka z pytaniem (OK / Anuluj)
        const isConfirmed = window.confirm(`Czy na pewno chcesz anulować rezerwację na godzinę ${time}?`);
        
        if (isConfirmed) {
            // Usunięcie wybranej godziny z tablicy naszych rezerwacji
            myBookings = myBookings.filter(t => t !== time);
            
            // Przeładowanie widoku kalendarza, by zaktualizować kolory
            generateTimeSlots();
            
            bookingMessage.textContent = `Pomyślnie anulowano rezerwację o godzinie ${time}.`;
            bookingMessage.className = 'message-box success';
            bookingMessage.style.display = 'block';
        }
    };

    const toggleSlotSelection = (slotElement, time) => {
        if (slotElement.classList.contains('selecting')) {
            slotElement.classList.remove('selecting');
            currentlySelectedSlots = currentlySelectedSlots.filter(t => t !== time);
        } else {
            slotElement.classList.add('selecting');
            currentlySelectedSlots.push(time);
        }
    };

    // ==========================================
    // ETAP 3: WALIDACJA I WYSYŁKA NOWYCH REZERWACJI
    // ==========================================
    confirmBtn.addEventListener('click', () => {
        
        if (currentlySelectedSlots.length === 0) {
            return; // Brak wyboru, nic nie robimy
        }

        // --- REGUŁA 1: Przedłużanie vs Nowa rezerwacja ---
        if (currentlySelectedSlots.length === 1) {
            const selectedTime = currentlySelectedSlots[0];
            const indexInArray = generatedHoursArray.indexOf(selectedTime);
            
            // Pobieramy godzinę "przed" i "po" wybranym kafelku
            const prevSlot = generatedHoursArray[indexInArray - 1];
            const nextSlot = generatedHoursArray[indexInArray + 1];
            
            // Sprawdzamy, czy któryś z sąsiadów znajduje się na liście naszych rezerwacji
            const isExtension = myBookings.includes(prevSlot) || myBookings.includes(nextSlot);
            
            if (!isExtension) {
                bookingMessage.textContent = 'Błąd: Nowa rezerwacja musi trwać minimum 1 godzinę (2 okienka). Pojedynczy kafelek możesz wybrać tylko jako przedłużenie istniejącej rezerwacji.';
                bookingMessage.className = 'message-box error';
                bookingMessage.style.display = 'block';
                return;
            }
        } 
        // --- REGUŁA 2: Sprawdzenie ciągłości dla wielu okienek ---
        else {
            const selectedIndices = currentlySelectedSlots
                .map(time => generatedHoursArray.indexOf(time))
                .sort((a, b) => a - b);

            let isConsecutive = true;
            for (let i = 1; i < selectedIndices.length; i++) {
                if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
                    isConsecutive = false;
                    break;
                }
            }

            if (!isConsecutive) {
                bookingMessage.textContent = 'Błąd: Wybrane godziny muszą następować bezpośrednio po sobie (brak pustych luk).';
                bookingMessage.className = 'message-box error';
                bookingMessage.style.display = 'block';
                return;
            }
        }

        // --- SUKCES ---
        // Dodajemy nowo wybrane godziny do naszej listy zielonych rezerwacji
        myBookings.push(...currentlySelectedSlots);
        
        bookingMessage.textContent = `Sukces! Zarezerwowano terminy: ${currentlySelectedSlots.sort().join(', ')}`;
        bookingMessage.className = 'message-box success';
        bookingMessage.style.display = 'block';
        
        // Przeładowujemy siatkę, by nowe godziny stały się zielone i reagowały na anulowanie
        generateTimeSlots();
    });
});