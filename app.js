const API_BASE =
  window.API_BASE ||
  `${window.location.protocol}//localhost:4000`;

const state = {
  patients: [],
  appointments: [],
  loggedIn: false,
  activeTab: 'patients',
};

// Local persistence helpers
const LS_PATIENTS = 'smile_patients';
const LS_APPTS = 'smile_appts';

function loadLocal() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PATIENTS) || '[]');
    const a = JSON.parse(localStorage.getItem(LS_APPTS) || '[]');
    return { patients: p, appointments: a };
  } catch (_) {
    return { patients: [], appointments: [] };
  }
}

function saveLocal() {
  localStorage.setItem(LS_PATIENTS, JSON.stringify(state.patients));
  localStorage.setItem(LS_APPTS, JSON.stringify(state.appointments));
}

const demoPatients = [
  { id: 1, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', phone: '+44 7700 900123', dob: '1990-05-12', address: '12 Crescent Rd, London', consent: 1, created_at: '2026-04-01T10:00:00Z' },
  { id: 2, first_name: 'Adam', last_name: 'Khan', email: 'adam.khan@example.com', phone: '+44 7555 220011', dob: '1987-02-09', address: 'Flat 5, Greenway', consent: 1, created_at: '2026-04-02T13:00:00Z' },
];

const demoAppointments = [
  { id: 10, patient_id: 1, patient_email: 'jane@example.com', patient_name: 'Jane Smith', service: 'Check-up', clinician: 'Dr. Omar', start_at: new Date(Date.now() + 86400000).toISOString(), status: 'booked', notes: 'Sensitivity upper molar' },
  { id: 11, patient_id: 2, patient_email: 'adam.khan@example.com', patient_name: 'Adam Khan', service: 'Hygiene clean', clinician: 'Dr. Aisha', start_at: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'completed', notes: '' },
];

// Helpers
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

function showToast(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle('toast--error', isError);
  el.classList.add('toast--show');
  setTimeout(() => el.classList.remove('toast--show'), 4000);
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };
  try {
    const res = await fetch(url, { ...defaults, ...options });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.error || `API error ${res.status}`;
      throw new Error(msg);
    }
    return body;
  } catch (err) {
    console.warn('API fallback triggered', err.message);
    return { error: err.message };
  }
}

function isoFromDateTime(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function renderKPIs() {
  const kToday = $('#kpiToday');
  const kWeek = $('#kpiWeek');
  const kPatients = $('#kpiPatients');
  if (!kToday || !kWeek || !kPatients) return;
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const todayCount = state.appointments.filter((a) => a.start_at.slice(0, 10) === today).length;
  const weekCount = state.appointments.filter((a) => a.start_at <= week.toISOString() && a.start_at >= today).length;
  kToday.textContent = todayCount;
  kWeek.textContent = weekCount;
  kPatients.textContent = state.patients.length;
}

function appointmentRows(list) {
  return list
    .map((a) => {
      const start = new Date(a.start_at);
      return `<tr>
        <td>${a.patient_name || a.first_name || ''}</td>
        <td>${a.service}</td>
        <td>${a.clinician}</td>
        <td>${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</td>
        <td>${a.status}</td>
        <td><button data-ics="${a.id}">ICS</button></td>
      </tr>`;
    })
    .join('');
}

function patientRows(list) {
  return list
    .map((p) => `<tr>
      <td>${p.first_name} ${p.last_name}</td>
      <td>${p.email}</td>
      <td>${p.phone || ''}</td>
      <td>${p.dob || ''}</td>
      <td>${p.consent ? 'Yes' : 'No'}</td>
    </tr>`)
    .join('');
}

function renderTables() {
  const patientsPanel = $('#patientsPanel');
  const futurePanel = $('#futurePanel');
  const pastPanel = $('#pastPanel');
  if (!patientsPanel || !futurePanel || !pastPanel) return; // not on staff page

  const filterEl = $('#filterInput');
  const filter = (filterEl ? filterEl.value : '').toLowerCase();
  const filteredPatients = state.patients.filter((p) =>
    `${p.first_name || ''} ${p.last_name || ''} ${p.email || ''}`.toLowerCase().includes(filter)
  );
  const filteredFuture = state.appointments.filter((a) => a.start_at >= new Date().toISOString());
  const filteredPast = state.appointments.filter((a) => a.start_at < new Date().toISOString());
  const tables = {
    patients: `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>DoB</th><th>Consent</th></tr></thead><tbody>${patientRows(filteredPatients)}</tbody></table>`,
    future: `<table><thead><tr><th>Patient</th><th>Service</th><th>Clinician</th><th>Start</th><th>Status</th><th>ICS</th></tr></thead><tbody>${appointmentRows(filteredFuture)}</tbody></table>`,
    past: `<table><thead><tr><th>Patient</th><th>Service</th><th>Clinician</th><th>Start</th><th>Status</th><th>ICS</th></tr></thead><tbody>${appointmentRows(filteredPast)}</tbody></table>`,
  };
  patientsPanel.innerHTML = tables.patients;
  futurePanel.innerHTML = tables.future;
  pastPanel.innerHTML = tables.past;
  renderKPIs();
}

function renderTablesIfPresent() {
  renderTables();
}

function exportCsv() {
  const tab = state.activeTab;
  const rows = [['Patient','Email','Service','Clinician','Start','Status']];
  const data = tab === 'patients' ? state.patients : state.appointments;
  data.forEach((item) => {
    if (tab === 'patients') {
      rows.push([`${item.first_name} ${item.last_name}`, item.email, item.phone, item.dob, item.consent ? 'Yes' : 'No']);
    } else {
      rows.push([item.patient_name || '', item.patient_email || '', item.service, item.clinician, item.start_at, item.status]);
    }
  });
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${tab}-report.csv`;
  a.click();
}

function downloadICS(id) {
  const appt = state.appointments.find((a) => String(a.id) === String(id));
  if (!appt) return;
  const start = new Date(appt.start_at);
  const end = new Date(start.getTime() + 30 * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmileBright//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${appt.id}@smilebright`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${appt.service} - ${appt.clinician}`,
    `DESCRIPTION:Patient ${appt.patient_name || ''} (${appt.patient_email || ''})`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `appointment-${appt.id}.ics`;
  a.click();
}

async function loadData() {
  const local = loadLocal();
  const patientsRes = await api('/api/reports/patients');
  const apptFuture = await api('/api/reports/appointments?scope=future');
  const apptPast = await api('/api/reports/appointments?scope=past');

  if (patientsRes && !patientsRes.error && Array.isArray(patientsRes)) {
    state.patients = patientsRes;
  } else if (local.patients.length) {
    state.patients = local.patients;
  } else {
    state.patients = demoPatients;
  }

  if (apptFuture && !apptFuture.error && apptPast && !apptPast.error) {
    state.appointments = [...apptFuture, ...apptPast];
  } else if (local.appointments.length) {
    state.appointments = local.appointments;
  } else {
    const nowIso = new Date().toISOString();
    state.appointments = [
      ...demoAppointments.filter(a => a.start_at >= nowIso),
      ...demoAppointments.filter(a => a.start_at < nowIso),
    ];
  }
  saveLocal();
  renderTables();
}

function setActiveTab(tab) {
  state.activeTab = tab;
  $all('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.tab === tab));
  $('#patientsPanel').hidden = tab !== 'patients';
  $('#futurePanel').hidden = tab !== 'future';
  $('#pastPanel').hidden = tab !== 'past';
}

function attachEvents() {
  // Quick API health indicator if present
  const apiBadge = $('#apiStatus');
  if (apiBadge) {
    api('/api/health').then((res) => {
      if (res && !res.error) {
        apiBadge.textContent = 'API: online';
        apiBadge.classList.add('badge--ok');
      } else {
        apiBadge.textContent = 'API: offline (using local data)';
        apiBadge.classList.add('badge--warn');
      }
    }).catch(() => {
      apiBadge.textContent = 'API: offline (using local data)';
      apiBadge.classList.add('badge--warn');
    });
  }

  // Nav toggle (shared across pages)
  const toggle = document.querySelector('.nav__toggle');
  const navList = document.querySelector('.nav__list');
  if (toggle && navList) {
    toggle.addEventListener('click', () => {
      const open = navList.classList.toggle('nav__list--open');
      toggle.setAttribute('aria-expanded', open);
    });
  }

  // Register form (register page)
  const registerForm = $('#registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!e.target.checkValidity()) {
        showToast($('#registerToast'), 'Please complete all required fields.', true);
        return;
      }
      data.consent = e.target.consent.checked;
      const btn = registerForm.querySelector('button[type=\"submit\"]');
      if (btn) btn.disabled = true;
      const res = await api('/api/patients', { method: 'POST', body: JSON.stringify(data) });
      if (res && !res.error && res.id) {
        state.patients.push(res);
        renderTablesIfPresent();
        showToast($('#registerToast'), 'Registration received.');
        e.target.reset();
      } else {
        const id = Math.max(0, ...state.patients.map((p) => p.id || 0)) + 1;
        state.patients.push({ id, ...data });
        renderTablesIfPresent();
        const msg = res && res.error ? `Saved locally (API issue: ${res.error})` : 'Saved locally (API offline).';
        showToast($('#registerToast'), msg, !!(res && res.error));
      }
      saveLocal();
      if (btn) btn.disabled = false;
    });
  }

  // Booking form (book page)
  const bookingForm = $('#bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const data = Object.fromEntries(form.entries());
      if (!e.target.checkValidity()) {
        showToast($('#bookingToast'), 'Please fill every required field.', true);
        return;
      }
      const iso = isoFromDateTime(data.date, data.time);
      const payload = { ...data, start_at: iso };
      const btn = bookingForm.querySelector('button[type=\"submit\"]');
      if (btn) btn.disabled = true;
      const res = await api('/api/appointments', { method: 'POST', body: JSON.stringify(payload) });
      if (res && !res.error && res.id) {
        state.appointments.push(res);
        renderTablesIfPresent();
        showToast($('#bookingToast'), 'Appointment booked.');
        e.target.reset();
      } else {
        const id = Math.max(0, ...state.appointments.map((a) => a.id || 0)) + 1;
        state.appointments.push({ id, patient_email: data.email, patient_name: data.email, service: data.service, clinician: data.clinician, start_at: iso, status: 'booked', notes: data.notes });
        renderTablesIfPresent();
        const msg = res && res.error ? `Saved locally (API issue: ${res.error})` : 'Booked (stored locally – API offline).';
        showToast($('#bookingToast'), msg, !!(res && res.error));
      }
      saveLocal();
      if (btn) btn.disabled = false;
    });
  }

  // Staff login + reports (staff page)
  const staffLogin = $('#staffLogin');
  if (staffLogin) {
    staffLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = e.target.password.value.trim();
      const toast = $('#staffToast');
      if (pass === 'staffdemo') {
        state.loggedIn = true;
        setActiveTab('patients');
        loadData();
        $('#staffArea').hidden = false;
        showToast(toast, 'Staff area unlocked. Scroll down to view reports.');
        e.target.reset();
      } else {
        showToast(toast, 'Incorrect password. Use "staffdemo" (lowercase).', true);
      }
    });

    $all('.tab').forEach((tab) => tab.addEventListener('click', () => {
      setActiveTab(tab.dataset.tab);
    }));

    const filter = $('#filterInput');
    if (filter) filter.addEventListener('input', renderTables);

    const exportBtn = $('#exportCsv');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-ics]');
      if (btn) downloadICS(btn.dataset.ics);
    });
  }
}

function init() {
  attachEvents();
}

document.addEventListener('DOMContentLoaded', init);
