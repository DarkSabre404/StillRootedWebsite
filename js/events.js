function escapeHTML(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const eventsNow = new Date();
let currentDate = new Date(eventsNow.getFullYear(), eventsNow.getMonth(), 1); // opens on the current month
let selectedDateStr = getLocalDateKey(eventsNow);
let allEvents = [];
let isAdmin = false;
let selectedEventId = null;
let eventsLoaded = false;
const MIN_UPCOMING_EVENTS = 3;
const MAX_UPCOMING_EVENTS = 7;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminRole();
    fetchEvents();

    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleSaveEvent);
    }

    const eventDetailsDialog = document.getElementById('eventDetailsDialog');
    const closeEventDetailsBtn = document.getElementById('closeEventDetailsBtn');
    const editSelectedEventBtn = document.getElementById('editSelectedEventBtn');
    const deleteSelectedEventBtn = document.getElementById('deleteSelectedEventBtn');

    if (eventDetailsDialog && closeEventDetailsBtn) {
        closeEventDetailsBtn.addEventListener('click', () => eventDetailsDialog.close());
        eventDetailsDialog.addEventListener('click', (event) => {
            if (event.target === eventDetailsDialog) eventDetailsDialog.close();
        });
    }

    if (eventDetailsDialog && editSelectedEventBtn) {
        editSelectedEventBtn.addEventListener('click', () => {
            const eventId = selectedEventId;
            eventDetailsDialog.close();
            if (eventId) editEvent(eventId);
        });
    }

    if (deleteSelectedEventBtn) {
        deleteSelectedEventBtn.addEventListener('click', () => {
            if (selectedEventId) deleteEvent(selectedEventId);
        });
    }
});

function checkAdminRole() {
    firebase.auth().onAuthStateChanged((user) => {
        isAdmin = false;
        const panel = document.getElementById('adminEventPanel');
        if (panel) panel.style.display = 'none';

        const dialog = document.getElementById('eventDetailsDialog');
        if (dialog && dialog.open) dialog.close();

        if (!user || typeof db === 'undefined') {
            if (eventsLoaded) renderEventsList();
            return;
        }

        db.collection('users').doc(user.uid).get().then((doc) => {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser || currentUser.uid !== user.uid) return;

            isAdmin = doc.exists && doc.data().role === 'admin';
            if (panel) panel.style.display = isAdmin ? 'block' : 'none';
            if (eventsLoaded) renderEventsList();
        }).catch(err => {
            console.warn(err);
            if (eventsLoaded) renderEventsList();
        });
    });
}

function fetchEvents() {
    if (typeof db === 'undefined') return;
    db.collection('events').onSnapshot((snapshot) => {
        allEvents = [];
        snapshot.forEach((doc) => {
            allEvents.push({ id: doc.id, ...doc.data() });
        });
        eventsLoaded = true;
        renderCalendar();
        renderEventsList();
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendarDaysGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthHeader = document.getElementById('currentMonthYear');
    if (monthHeader) monthHeader.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Render Previous Month Padding Days
    for (let i = firstDay - 1; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'other-month';
        cell.innerHTML = `<span class="cell-date-num">${prevMonthDays - i}</span>`;
        grid.appendChild(cell);
    }

    // Render Current Month Days
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');

        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const dateKey = `${year}-${formattedMonth}-${formattedDay}`;

        if (dateKey === selectedDateStr) {
            cell.classList.add('selected');
        }

        const dateNumber = document.createElement('span');
        dateNumber.className = 'cell-date-num';
        dateNumber.textContent = day;
        cell.appendChild(dateNumber);

        // Event bars open their details without triggering the day-cell selection.
        const matchingEvents = allEvents.filter(e => e.date === dateKey);
        matchingEvents.forEach(evt => {
            const eventTitle = String(evt.title || 'Untitled event');
            const eventPill = document.createElement('button');
            eventPill.type = 'button';
            eventPill.className = 'cell-event-pill';
            eventPill.title = eventTitle;
            eventPill.textContent = eventTitle;
            eventPill.setAttribute('aria-label', `View details for ${eventTitle}`);
            eventPill.setAttribute('aria-haspopup', 'dialog');
            eventPill.setAttribute('aria-controls', 'eventDetailsDialog');
            eventPill.addEventListener('click', (event) => {
                event.stopPropagation();
                openEventDetails(evt.id);
            });
            cell.appendChild(eventPill);
        });

        cell.onclick = () => {
            selectedDateStr = dateKey;
            renderCalendar();
            renderEventsList();
        };

        grid.appendChild(cell);
    }
}

function openEventDetails(id) {
    const event = allEvents.find(item => item.id === id);
    const dialog = document.getElementById('eventDetailsDialog');
    if (!event || !dialog) return;

    const date = new Date(`${event.date}T00:00:00`);
    const dateText = Number.isNaN(date.getTime())
        ? event.date
        : date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    document.getElementById('eventDetailsTitle').textContent = event.title || 'Untitled event';
    document.getElementById('eventDetailsDate').textContent = dateText || 'Date not specified';
    document.getElementById('eventDetailsDate').dateTime = event.date || '';
    document.getElementById('eventDetailsTiming').textContent = event.timing || 'Not specified';
    document.getElementById('eventDetailsDescription').textContent = event.description || 'No description provided.';
    document.getElementById('eventDetailsAdminActions').hidden = !isAdmin;

    selectedEventId = id;
    dialog.showModal();
    document.getElementById('closeEventDetailsBtn').focus();
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

function renderEventsList() {
    const container = document.getElementById('eventsListContainer');
    if (!container) return;
    container.innerHTML = '';

    const todayDateKey = getLocalDateKey(new Date());
    const eventsToDisplay = allEvents
        .filter(event => typeof event.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.date >= todayDateKey)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-MAX_UPCOMING_EVENTS);

    if (eventsToDisplay.length === 0) {
        container.innerHTML = '<p class="events-empty">No upcoming community events scheduled.</p>';
        return;
    }

    eventsToDisplay.forEach(event => {
        const dateObj = new Date(event.date + 'T00:00:00');
        const monthShort = dateObj.toLocaleString('en-US', { month: 'short' });
        const dayNum = dateObj.getDate();

        const card = document.createElement('div');

        let adminActions = '';
        if (isAdmin) {
            adminActions = `
                <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button onclick="editEvent('${event.id}')" class="btn-ghost" style="padding: 4px 10px; font-size: 12px;">Edit</button>
                    <button onclick="deleteEvent('${event.id}')" class="btn-ghost" style="padding: 4px 10px; font-size: 12px; color: #8A2E2E; border-color: #D9A39B;">Delete</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div style="display: flex; gap: 16px; align-items: center;">
                <div style="background: var(--champagne-tint); border: 1px solid var(--champagne); padding: 8px 12px; text-align: center; border-radius: 2px; min-width: 55px;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: var(--forest);">${monthShort}</div>
                    <div style="font-size: 20px; font-weight: bold; color: var(--forest-deep);">${dayNum}</div>
                </div>
                <div style="flex: 1;">
                    <h3>${escapeHTML(event.title)}</h3>
                    <p style="margin: 0 0 4px 0;">${escapeHTML(event.description)}</p>
                    <span style="font-size: 13px; color: var(--text-muted);">🕒 ${escapeHTML(event.timing)}</span>
                    ${adminActions}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

async function handleSaveEvent(e) {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value;
    const timing = document.getElementById('eventTiming').value;
    const date = document.getElementById('eventDate').value;
    const description = document.getElementById('eventDescription').value;

    const eventData = { title, timing, date, description };

    try {
        if (id) {
            await db.collection('events').doc(id).update(eventData);
        } else {
            await db.collection('events').add(eventData);
        }
        resetForm();
    } catch (err) {
        alert("Error saving event: " + err.message);
    }
}

function editEvent(id) {
    const event = allEvents.find(e => e.id === id);
    if (!event) return;

    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventTiming').value = event.timing;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventDescription').value = event.description;

    document.getElementById('formTitle').innerText = '✏️ Edit Event';
    document.getElementById('saveEventBtn').innerText = 'Update Event';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.getElementById('adminEventPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('eventTitle').focus({ preventScroll: true });
}

async function deleteEvent(id) {
    if (confirm("Are you sure you want to delete this event?")) {
        await db.collection('events').doc(id).delete();
        const dialog = document.getElementById('eventDetailsDialog');
        if (dialog && dialog.open) dialog.close();
    }
}

function resetForm() {
    const form = document.getElementById('eventForm');
    if (form) form.reset();
    document.getElementById('eventId').value = '';
    document.getElementById('formTitle').innerText = '⚙️ Admin: Manage Community Events';
    document.getElementById('saveEventBtn').innerText = 'Save Event';
    document.getElementById('cancelEditBtn').style.display = 'none';
}