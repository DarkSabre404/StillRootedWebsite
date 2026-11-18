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

function getEventDateParts(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
    if (!match) return null;

    const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) {
        return null;
    }
    return parts;
}

function getTimeInMinutes(match, periodHint) {
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const period = (match[3] || periodHint || '').toUpperCase();

    if (minute > 59) return null;
    if (period) {
        if (hour < 1 || hour > 12) return null;
        hour = (hour % 12) + (period === 'PM' ? 12 : 0);
    } else if (hour > 23) {
        return null;
    }
    return hour * 60 + minute;
}

function parseEventTimes(event) {
    const date = getEventDateParts(event.date);
    if (!date) return null;

    const timeMatches = Array.from(String(event.timing || '').matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi));
    if (!timeMatches.length) {
        const startDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
        startDate.setUTCDate(startDate.getUTCDate() + 1);
        return {
            allDay: true,
            start: date,
            end: { year: startDate.getUTCFullYear(), month: startDate.getUTCMonth() + 1, day: startDate.getUTCDate() }
        };
    }

    const startMatch = timeMatches[0];
    const endMatch = timeMatches[1];
    let startMinutes = getTimeInMinutes(startMatch, startMatch[3] || null);
    let endMinutes = endMatch
        ? getTimeInMinutes(endMatch, endMatch[3] || startMatch[3] || null)
        : startMinutes === null ? null : startMinutes + 60;

    if (endMatch && !startMatch[3] && endMatch[3] && endMinutes !== null) {
        const startCandidates = ['AM', 'PM']
            .map(period => getTimeInMinutes(startMatch, period))
            .filter(value => value !== null);
        if (startCandidates.length) {
            startMinutes = startCandidates.reduce((best, candidate) => {
                const duration = (endMinutes - candidate + 1440) % 1440 || 1440;
                const bestDuration = (endMinutes - best + 1440) % 1440 || 1440;
                return duration < bestDuration ? candidate : best;
            }, startCandidates[0]);
        }
    } else if (endMatch && startMatch[3] && !endMatch[3] && startMinutes !== null) {
        const endCandidates = ['AM', 'PM']
            .map(period => getTimeInMinutes(endMatch, period))
            .filter(value => value !== null);
        if (endCandidates.length) {
            endMinutes = endCandidates.reduce((best, candidate) => {
                const duration = (candidate - startMinutes + 1440) % 1440 || 1440;
                const bestDuration = (best - startMinutes + 1440) % 1440 || 1440;
                return duration < bestDuration ? candidate : best;
            }, endCandidates[0]);
        }
    }

    if (startMinutes === null || endMinutes === null) {
        return {
            allDay: true,
            start: date,
            end: (() => {
                const nextDay = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
                return { year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate() };
            })()
        };
    }
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;

    const baseTime = Date.UTC(date.year, date.month - 1, date.day);
    const makeDateTime = minutes => {
        const value = new Date(baseTime + minutes * 60 * 1000);
        return {
            year: value.getUTCFullYear(),
            month: value.getUTCMonth() + 1,
            day: value.getUTCDate(),
            hour: value.getUTCHours(),
            minute: value.getUTCMinutes()
        };
    };

    return {
        allDay: false,
        start: makeDateTime(startMinutes),
        end: makeDateTime(endMinutes)
    };
}

function formatCalendarDate(date) {
    return `${date.year}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}`;
}

function formatCalendarDateTime(date) {
    return `${formatCalendarDate(date)}T${String(date.hour).padStart(2, '0')}${String(date.minute).padStart(2, '0')}00`;
}

function buildGoogleCalendarUrl(event, times) {
    const dates = times.allDay
        ? `${formatCalendarDate(times.start)}/${formatCalendarDate(times.end)}`
        : `${formatCalendarDateTime(times.start)}/${formatCalendarDateTime(times.end)}`;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title || 'Untitled event',
        dates,
        details: event.description || '',
        ctz: 'Asia/Kolkata'
    });
    if (event.location) params.set('location', event.location);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function foldIcsLine(line) {
    const encoder = new TextEncoder();
    const foldedLines = [];
    let currentLine = '';
    let byteLength = 0;

    for (const character of line) {
        const characterLength = encoder.encode(character).length;
        if (byteLength + characterLength > 75) {
            foldedLines.push(currentLine);
            currentLine = ' ';
            byteLength = 1;
        }
        currentLine += character;
        byteLength += characterLength;
    }
    foldedLines.push(currentLine);
    return foldedLines.join('\r\n');
}

function formatIcsUtc(date) {
    // Event wall times are IST (UTC+05:30); store their equivalent UTC instant for broad calendar compatibility.
    const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day, date.hour, date.minute) - 330 * 60 * 1000);
    return utcDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildIcsContent(event, times) {
    const eventId = String(event.id || 'event').replace(/[^a-zA-Z0-9._-]/g, '-');
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Asvattha//Community Events//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${eventId}@YOUR-DOMAIN.example`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
        `SUMMARY:${escapeIcsText(event.title || 'Untitled event')}`,
        `DESCRIPTION:${escapeIcsText(event.description || '')}`
    ];

    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (times.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${formatCalendarDate(times.start)}`);
        lines.push(`DTEND;VALUE=DATE:${formatCalendarDate(times.end)}`);
    } else {
        lines.push(`DTSTART:${formatIcsUtc(times.start)}`);
        lines.push(`DTEND:${formatIcsUtc(times.end)}`);
    }
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function downloadIcs(event) {
    const times = parseEventTimes(event);
    if (!times) return;

    const content = buildIcsContent(event, times);
    const fileName = (event.title || 'event')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'event';
    const file = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${fileName}.ics`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
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
    fetchEvents();
    checkAdminRole();

    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleSaveEvent);
    }

    const eventDetailsDialog = document.getElementById('eventDetailsDialog');
    const closeEventDetailsBtn = document.getElementById('closeEventDetailsBtn');
    const editSelectedEventBtn = document.getElementById('editSelectedEventBtn');
    const deleteSelectedEventBtn = document.getElementById('deleteSelectedEventBtn');
    const downloadIcsBtn = document.getElementById('downloadIcsBtn');

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

    if (downloadIcsBtn) {
        downloadIcsBtn.addEventListener('click', () => {
            const event = allEvents.find(item => item.id === selectedEventId);
            if (event) downloadIcs(event);
        });
    }
});

function checkAdminRole() {
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') return;

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
    renderCalendar();
    renderEventsList();

    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
        showEventsLoadError();
        return;
    }

    try {
        db.collection('events').onSnapshot((snapshot) => {
            allEvents = [];
            snapshot.forEach((doc) => {
                allEvents.push({ id: doc.id, ...doc.data() });
            });
            eventsLoaded = true;
            renderCalendar();
            renderEventsList();
        }, (error) => {
            console.error('Error loading events:', error);
            showEventsLoadError();
        });
    } catch (error) {
        console.error('Error subscribing to events:', error);
        showEventsLoadError();
    }
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

    if (!eventsLoaded) {
        grid.setAttribute('aria-busy', 'true');
        const cellCount = firstDay + daysInMonth;
        for (let index = 0; index < cellCount; index++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-skeleton-cell';
            cell.setAttribute('aria-hidden', 'true');

            const number = document.createElement('span');
            number.className = 'skeleton skeleton-title calendar-skeleton-number';
            const eventLine = document.createElement('span');
            eventLine.className = 'skeleton calendar-skeleton-event';
            cell.append(number, eventLine);
            grid.appendChild(cell);
        }
        return;
    }

    grid.removeAttribute('aria-busy');

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

    const googleCalendarLink = document.getElementById('googleCalendarLink');
    const downloadIcsBtn = document.getElementById('downloadIcsBtn');
    const eventCalendarActions = document.getElementById('eventCalendarActions');
    const calendarTimes = parseEventTimes(event);
    if (googleCalendarLink && downloadIcsBtn && eventCalendarActions) {
        eventCalendarActions.hidden = !calendarTimes;
        if (calendarTimes) {
            const eventTitle = event.title || 'Untitled event';
            googleCalendarLink.href = buildGoogleCalendarUrl(event, calendarTimes);
            googleCalendarLink.setAttribute('aria-label', `Add ${eventTitle} to Google Calendar`);
            googleCalendarLink.removeAttribute('aria-disabled');
            downloadIcsBtn.disabled = false;
            downloadIcsBtn.setAttribute('aria-label', `Download calendar file for ${eventTitle}`);
        } else {
            googleCalendarLink.removeAttribute('href');
            googleCalendarLink.setAttribute('aria-disabled', 'true');
            downloadIcsBtn.disabled = true;
            downloadIcsBtn.setAttribute('aria-label', 'Calendar file unavailable because the event date is invalid');
        }
    }

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

    if (!eventsLoaded) {
        container.setAttribute('aria-busy', 'true');
        container.innerHTML = Array.from({ length: 3 }, () => `
            <div class="events-skeleton-card" aria-hidden="true">
                <div class="skeleton events-skeleton-date"></div>
                <div class="events-skeleton-content">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line skeleton-line--short"></div>
                </div>
            </div>
        `).join('');
        return;
    }

    container.removeAttribute('aria-busy');

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

        card.innerHTML = `
            <div style="display: flex; gap: 16px; align-items: center;">
                <div style="background: var(--champagne-tint); border: 1px solid var(--champagne); padding: 8px 12px; text-align: center; border-radius: 2px; min-width: 55px;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: var(--forest);">${monthShort}</div>
                    <div style="font-size: 20px; font-weight: bold; color: var(--forest-deep);">${dayNum}</div>
                </div>
                <div class="event-list-content" style="flex: 1;">
                    <h3>${escapeHTML(event.title)}</h3>
                    <p style="margin: 0 0 4px 0;">${escapeHTML(event.description)}</p>
                    <span style="font-size: 13px; color: var(--text-muted);">🕒 ${escapeHTML(event.timing)}</span>
                </div>
            </div>
        `;

        if (isAdmin) {
            const actions = document.createElement('div');
            actions.className = 'event-list-actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'btn-ghost';
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => editEvent(event.id));

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'btn-ghost event-delete-btn';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => deleteEvent(event.id));

            actions.append(editButton, deleteButton);
            card.querySelector('.event-list-content').appendChild(actions);
        }

        container.appendChild(card);
    });
}

function showEventsLoadError() {
    eventsLoaded = true;
    allEvents = [];
    renderCalendar();

    const container = document.getElementById('eventsListContainer');
    if (container) {
        container.removeAttribute('aria-busy');
        const message = document.createElement('p');
        message.className = 'events-empty';
        message.textContent = 'Events could not be loaded. Please try again later.';
        container.replaceChildren(message);
    }
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