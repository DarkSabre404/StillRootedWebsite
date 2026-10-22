let currentDate = new Date(2026, 9, 1); // Defaults to October 2026
let selectedDateStr = "2026-10-22";
let allEvents = [];
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAdminRole();
    fetchEvents();

    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleSaveEvent);
    }
});

function checkAdminRole() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user && typeof db !== 'undefined') {
            db.collection('users').doc(user.uid).get().then((doc) => {
                if (doc.exists && doc.data().role === 'admin') {
                    isAdmin = true;
                    const panel = document.getElementById('adminEventPanel');
                    if (panel) panel.style.display = 'block';
                    renderEventsList();
                }
            }).catch(err => console.warn(err));
        }
    });
}

function fetchEvents() {
    if (typeof db === 'undefined') return;
    db.collection('events').onSnapshot((snapshot) => {
        allEvents = [];
        snapshot.forEach((doc) => {
            allEvents.push({ id: doc.id, ...doc.data() });
        });
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

        let cellHTML = `<span class="cell-date-num">${day}</span>`;

        // Check and render event titles inside date box
        const matchingEvents = allEvents.filter(e => e.date === dateKey);
        matchingEvents.forEach(evt => {
            cellHTML += `<span class="cell-event-pill" title="${evt.title}">${evt.title}</span>`;
        });

        cell.innerHTML = cellHTML;

        cell.onclick = () => {
            selectedDateStr = dateKey;
            renderCalendar();
            renderEventsList();
        };

        grid.appendChild(cell);
    }
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

function renderEventsList() {
    const container = document.getElementById('eventsListContainer');
    if (!container) return;
    container.innerHTML = '';

    let eventsToDisplay = allEvents;

    if (eventsToDisplay.length === 0) {
        container.innerHTML = '<p class="events-empty">No community events scheduled for this period.</p>';
        return;
    }

    eventsToDisplay.sort((a, b) => new Date(a.date) - new Date(b.date));

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
                    <h3>${event.title}</h3>
                    <p style="margin: 0 0 4px 0;">${event.description}</p>
                    <span style="font-size: 13px; color: var(--text-muted);">🕒 ${event.timing}</span>
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
}

async function deleteEvent(id) {
    if (confirm("Are you sure you want to delete this event?")) {
        await db.collection('events').doc(id).delete();
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