/* SmartMove frontend. Operational data is loaded from the Express API and saved to Oracle/MongoDB. */
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const userRole = document.body.dataset.role || sessionStorage.getItem('smartmoveRole') || 'customer';
const allowedPages = userRole === 'admin' ? ['overview','vehicles','drivers','routes','trips','maintenance','passengers','tickets','reviews','reports','help'] : ['overview','book','tickets','reviews','help'];
const state = {
    
 page:'overview', selectedTrip:1, selectedRating:5,
 tickets:[
  {id:'SM-2048',route:'Colombo → Kandy',date:'2026-10-14',time:'08:30 AM',vehicle:'Express Coach',seat:'12A',fare:1450,status:'Confirmed',passenger:'Ash User'},
  {id:'SM-2049',route:'Kandy → Colombo',date:'2026-10-18',time:'03:15 PM',vehicle:'Comfort Van',seat:'04B',fare:1750,status:'Pending',passenger:'Ash User'},
  {id:'SM-2050',route:'Colombo → Galle',date:'2026-10-21',time:'10:00 AM',vehicle:'City Bus',seat:'08C',fare:980,status:'Confirmed',passenger:'Nimal Perera'}
 ],
 vehicles:[{id:'VH-001',name:'Volvo B8R Express',plate:'NB-2048',type:'Bus',seats:45,status:'Active',km:'42,800 km'},{id:'VH-002',name:'Toyota HiAce Comfort',plate:'ND-7781',type:'Van',seats:12,status:'Active',km:'28,450 km'},{id:'VH-003',name:'Ashok Leyland City',plate:'NA-3320',type:'Bus',seats:52,status:'Maintenance',km:'81,200 km'},{id:'VH-004',name:'Toyota Coaster',plate:'NC-9044',type:'Van',seats:25,status:'Active',km:'34,600 km'}],
 drivers:[{id:'DR-001',name:'Kasun Perera',licence:'B-458920',phone:'077 123 4567',experience:'8 years',status:'Available'},{id:'DR-002',name:'Ruwan Silva',licence:'B-336721',phone:'071 234 5678',experience:'12 years',status:'On trip'},{id:'DR-003',name:'Nadeesha Fernando',licence:'B-761340',phone:'076 345 6789',experience:'5 years',status:'Available'}],
 routes:[{id:'RT-001',from:'Colombo',to:'Kandy',distance:'115 km',duration:'3h 15m',fare:1450},{id:'RT-002',from:'Colombo',to:'Galle',distance:'125 km',duration:'2h 30m',fare:980},{id:'RT-003',from:'Kandy',to:'Nuwara Eliya',distance:'76 km',duration:'2h 45m',fare:1250},{id:'RT-004',from:'Colombo',to:'Negombo',distance:'38 km',duration:'1h 10m',fare:550}],
 trips:[{id:'TR-510',route:'Colombo → Kandy',vehicle:'Volvo B8R Express',driver:'Kasun Perera',date:'2026-10-14',time:'08:30 AM',seats:45,status:'Scheduled'},{id:'TR-511',route:'Colombo → Galle',vehicle:'Toyota HiAce Comfort',driver:'Ruwan Silva',date:'2026-10-14',time:'10:00 AM',seats:12,status:'Scheduled'},{id:'TR-512',route:'Kandy → Nuwara Eliya',vehicle:'Toyota Coaster',driver:'Nadeesha Fernando',date:'2026-10-15',time:'07:15 AM',seats:25,status:'In progress'}],
 maintenance:[{id:'MN-101',vehicle:'Ashok Leyland City · NA-3320',task:'Engine inspection',due:'2026-10-12',cost:18500,status:'Due soon'},{id:'MN-102',vehicle:'Volvo B8R Express · NB-2048',task:'Scheduled service',due:'2026-10-20',cost:24000,status:'Scheduled'},{id:'MN-103',vehicle:'Toyota HiAce Comfort · ND-7781',task:'Tyre replacement',due:'2026-10-08',cost:32000,status:'Overdue'}],
 passengers:[{id:'PS-001',name:'Ash User',email:'ash.user@example.com',joined:'2026-09-18',tickets:2,status:'Active'},{id:'PS-002',name:'Nimal Perera',email:'nimal@example.com',joined:'2026-09-22',tickets:4,status:'Active'},{id:'PS-003',name:'Sajini Silva',email:'sajini@example.com',joined:'2026-10-01',tickets:1,status:'Active'},{id:'PS-004',name:'Dilan Jay',email:'dilan@example.com',joined:'2026-10-03',tickets:0,status:'Pending'}],
 reviews:[{name:'Sajini Silva',route:'Colombo → Kandy',rating:5,date:'2026-10-10',text:'Very comfortable ride and the driver was friendly. Arrived right on time.'},{name:'Nimal Perera',route:'Colombo → Galle',rating:4,date:'2026-10-09',text:'Smooth journey and easy booking. Would love more departure times.'},{name:'Amaya Fernando',route:'Kandy → Nuwara Eliya',rating:5,date:'2026-10-07',text:'Beautiful route and a clean vehicle. Great overall experience.'}]
};
let generatedReport = null;
const pages = {
 overview:['Overview','Your transport operations, at a glance.'],book:['Book a trip','Find your route and reserve your next journey.'],tickets:['My tickets','Keep track of your upcoming and past journeys.'],reviews:['Passenger reviews','Share feedback and see what other passengers say.'],vehicles:['Vehicle management','Manage your fleet and vehicle availability.'],drivers:['Driver management','View driver details and availability.'],routes:['Route management','Manage service routes, distance and fares.'],trips:['Trip schedule','Coordinate departures, vehicles and drivers.'],maintenance:['Maintenance','Track inspections, servicing and vehicle repairs.'],passengers:['Passenger directory','Review registered passengers and booking activity.'],reports:['Reports & insights','A quick overview of sample operational performance.'],help:['Quick guide','Explore this front-end prototype and its demo controls.']
};
const money = n => 'LKR '+Number(n).toLocaleString('en-LK');

const getCurrentPassengerName = () =>
  sessionStorage.getItem('smartmoveName') || 'Demo Passenger';

const getCurrentPassengerEmail = () =>
  (sessionStorage.getItem('smartmoveEmail') || '').trim().toLowerCase();

const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pill(status){let c=['Pending','Due soon','Overdue'].includes(status)?'pending':['Cancelled','Inactive'].includes(status)?'cancelled':['Maintenance','In progress'].includes(status)?'purple':'';return `<span class="pill ${c}">${escapeHTML(status)}</span>`}
function heading(k,action=''){let [title,desc]=pages[k]||pages.overview;return `<div class="page-heading"><div><span class="eyebrow">SMARTMOVE / ${k.toUpperCase()}</span><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function stat(label,value,icon,foot,cls=''){return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot ${cls}">${foot}</div></article>`}
function panel(title,content,extra=''){return `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${content}</section>`}
function table(headers,rows,empty='No records to show yet.'){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}"><div class="empty-state">${empty}</div></td></tr>`}</tbody></table></div>`}
function toolbar(placeholder,action,label){return `<div class="toolbar"><input class="search" id="tableSearch" placeholder="⌕  ${placeholder}" aria-label="Search records">${action?`<button class="primary" data-action="${action}">＋ ${label}</button>`:''}</div>`}
function rowActions(id,edit=true){return `<div class="table-actions">${edit?`<button class="small-action" data-edit="${id}">Edit</button>`:''}<button class="small-action" data-delete="${id}">Remove</button></div>`}
function overview(){if(userRole==='admin'){return `${heading('overview')}<div class="hero-banner"><span class="eyebrow">OPERATIONS CONTROL CENTER</span><h2>Keep every journey moving.</h2><p>Review fleet readiness, coordinate scheduled trips, maintain vehicles, and monitor passenger activity.</p><button class="secondary" data-page="trips">Manage trip schedule ↗</button><span class="hero-bus">▰</span></div><div class="stats-grid">${stat('Fleet vehicles',state.vehicles.length,'▰','Registered demo vehicles')}${stat('Active drivers',state.drivers.filter(d=>d.status==='Available').length,'♙','Available for assignment','positive')}${stat('Scheduled trips',state.trips.filter(t=>t.status==='Scheduled').length,'◷','Upcoming departures')}${stat('Maintenance alerts',state.maintenance.filter(m=>['Due soon','Overdue'].includes(m.status)).length,'⚒','Requires attention','accent-text')}</div><div class="dashboard-grid">${panel('Maintenance requiring attention',table(['Vehicle','Task','Due date','Status'],state.maintenance.filter(m=>m.status!=='Completed').map(m=>`<tr><td>${escapeHTML(m.vehicle)}</td><td>${escapeHTML(m.task)}</td><td>${m.due}</td><td>${pill(m.status)}</td></tr>`)))}${panel('Quick management',`<div class="feature-list"><button class="secondary" data-page="vehicles">Manage vehicles →</button><button class="secondary" data-page="drivers">Manage drivers →</button><button class="secondary" data-page="passengers">Passenger directory →</button><button class="secondary" data-page="reports">View reports →</button></div>`)}</div>${panel('Upcoming trips',table(['Trip','Route','Vehicle','Driver','Departure','Status'],state.trips.map(t=>`<tr><td>${t.id}</td><td>${escapeHTML(t.route)}</td><td>${escapeHTML(t.vehicle)}</td><td>${escapeHTML(t.driver)}</td><td>${t.date} · ${t.time}</td><td>${pill(t.status)}</td></tr>`)))}`}let upcoming=state.tickets.filter(t=>t.passenger===getCurrentPassengerName()&&t.status!=='Cancelled');let rows=state.tickets.slice(0,4).map(t=>`<tr><td><span class="table-title">${t.id}</span><span class="subcell">${t.vehicle}</span></td><td>${escapeHTML(t.route)}</td><td>${t.date}<span class="subcell">${t.time}</span></td><td>${money(t.fare)}</td><td>${pill(t.status)}</td></tr>`);let bars=[35,52,43,72,59,87,64];return `${heading('overview',`<button class="primary" data-page="book">＋ Book a trip</button>`)}<div class="hero-banner"><span class="eyebrow">YOUR JOURNEY, REIMAGINED</span><h2>Move smarter. Travel better.</h2><p>Plan your next journey, manage bookings, and explore transport services from one simple workspace.</p><button class="secondary" data-page="book">Explore available trips ↗</button><span class="hero-bus">▰</span></div><div class="stats-grid">${stat('My bookings',upcoming.length,'▤','Across all upcoming journeys')}${stat('Active vehicles',state.vehicles.filter(v=>v.status==='Active').length,'▰','Fleet availability')}${stat('Available drivers',state.drivers.filter(d=>d.status==='Available').length,'♙','Ready for assignment','positive')}${stat('Passenger rating','4.8 ★','☆','Based on sample reviews','accent-text')}</div><div class="dashboard-grid">${panel('Booking activity',`<div class="legend"><span><i></i> This week</span><span><i class="grey"></i> Last week</span></div><div class="chart">${bars.map((h,i)=>`<div class="chart-col"><div class="chart-bars"><div class="bar secondary-bar" style="height:${Math.max(15,h-18)}%"></div><div class="bar" style="height:${h}%"></div></div><small>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</small></div>`).join('')}</div><div class="panel-foot muted" style="font-size:10px">Illustrative weekly activity · sample values</div>`)}${panel('Recent activity',`<div class="activity-list"><div class="activity"><span class="activity-icon">✓</span><div class="activity-text"><strong>Booking confirmed</strong><small>Colombo → Kandy</small></div><time>2h ago</time></div><div class="activity"><span class="activity-icon">☆</span><div class="activity-text"><strong>New passenger review</strong><small>4-star trip feedback</small></div><time>5h ago</time></div><div class="activity"><span class="activity-icon">⚒</span><div class="activity-text"><strong>Service reminder</strong><small>NA-3320 inspection due</small></div><time>1d ago</time></div><div class="activity"><span class="activity-icon">▰</span><div class="activity-text"><strong>Fleet status updated</strong><small>4 demo vehicles listed</small></div><time>1d ago</time></div></div><div class="panel-foot"><button class="text-button" data-page="reports">View all insights →</button></div>` )}</div>${panel('Recent bookings',table(['Booking ID / Vehicle','Route','Departure','Fare','Status'],rows),`<button class="text-button" data-page="tickets">View all →</button>`)}`}
function book(){return `${heading('book')}<div class="booking-layout"><section class="panel"><div class="panel-head"><h2>Where would you like to go?</h2><span class="pill purple">Demo booking</span></div><form id="bookingForm"><div class="form-grid"><div class="field"><label for="from">From</label><select id="from" required><option>Colombo</option><option>Kandy</option><option>Galle</option><option>Negombo</option><option>Nuwara Eliya</option></select></div><div class="field"><label for="to">Destination</label><select id="to" required><option>Kandy</option><option>Galle</option><option>Negombo</option><option>Nuwara Eliya</option><option>Colombo</option></select></div><div class="field"><label for="travelDate">Travel date</label>
<input
  id="travelDate"
  type="date"
  min="2026-10-11"
  value="2026-10-15"
  required>
</div><div class="field"><label for="passengersCount">Passengers</label><select id="passengersCount"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div></div>

</div>

<div class="panel-head" style="margin-top:12px">
  <h2>Available trips</h2>
  <span class="muted" style="font-size:10px">Select one</span>
</div>

<div id="tripOptions">
  <p class="muted">Choose your route and travel date to search available trips.</p>
</div></div><button class="primary" type="submit" style="width:100%;margin-top:8px">Continue to booking →</button></form></section><aside>${panel('Booking summary',`<div class="feature-list"><div class="feature-row"><span class="check">✓</span> Choose from demo transport options</div><div class="feature-row"><span class="check">✓</span> Review your selected travel details</div><div class="feature-row"><span class="check">✓</span> Booking saved for this browser session</div></div><div class="panel-foot"><span class="muted" style="font-size:10px;line-height:1.7">This prototype does not process payments or reserve real seats.</span></div>`)}<div style="height:14px"></div>${panel('Travel tips',`<div class="activity-list"><div class="activity"><span class="activity-icon">◷</span><div class="activity-text"><strong>Arrive early</strong><small>Be at the pickup point 15 minutes before departure.</small></div></div><div class="activity"><span class="activity-icon">▣</span><div class="activity-text"><strong>Keep your ticket handy</strong><small>Show your booking reference to the driver.</small></div></div></div>`)}</aside></div>`}
function tripOption(id,name,time,price,seats){return `<label class="trip-option ${state.selectedTrip===id?'selected':''}"><input type="radio" name="tripOption" value="${id}" ${state.selectedTrip===id?'checked':''} style="accent-color:var(--purple)"><span class="vehicle-icon">▰</span><span class="trip-info"><strong>${name}</strong><small>${time} · ${seats}</small></span><span class="trip-price">${money(price)}</span></label>`}

function formatTripTime(value) {
  if (!value) return 'Time unavailable';

  const text = String(value);

  // Handle ISO dates returned by Oracle through Node.js.
  const match = text.match(/T(\d{2}):(\d{2})/);

  if (match) {
    let hour = Number(match[1]);
    const minute = match[2];
    const period = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12 || 12;

    return `${String(hour).padStart(2, '0')}:${minute} ${period}`;
  }

  // Already formatted time, such as 08:30 AM.
  return text;
}

async function createBooking(form) {
  const origin = document.getElementById('from')?.value;
  const destination = document.getElementById('to')?.value;
  const travelDate = document.getElementById('travelDate')?.value;
  const email = (
    sessionStorage.getItem('smartmoveEmail') || ''
  ).trim().toLowerCase();

  const selected = form.querySelector(
    'input[name="tripOption"]:checked'
  );

  if (!origin || !destination || !travelDate) {
    toast('Please select your route and travel date.');
    return;
  }

  if (origin === destination) {
    toast('Origin and destination must be different.');
    return;
  }

  if (!selected) {
    toast('Please select an available trip first.');
    return;
  }

  if (!email) {
    toast('Please sign in again before booking.');
    return;
  }

  const payload = {
    tripId: Number(selected.value),
    passengerName:
      sessionStorage.getItem('smartmoveName') || 'Demo Passenger',
    passengerEmail: email
  };

  console.log('Sending booking request:', payload);

  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));

  console.log('Booking response:', response.status, result);

  if (!response.ok) {
    throw new Error(
      result.message || result.error ||
      `Booking failed (${response.status})`
    );
  }

  toast('Booking request submitted successfully!');
  navigate('tickets');
  await loadOracleBookings();
}

async function loadOracleTrips() {
  const container = $('#tripOptions');

  if (!container) return;

  const origin = $('#from')?.value;
  const destination = $('#to')?.value;
  const date = $('#travelDate')?.value;

  if (!origin || !destination || !date) return;

  if (origin === destination) {
    state.selectedTrip = null;
    container.innerHTML =
      '<p class="muted">Choose different origin and destination locations.</p>';
    return;
  }

  state.selectedTrip = null;
  container.innerHTML =
    '<p class="muted">Searching available trips...</p>';

  const params = new URLSearchParams({
    origin,
    destination,
    date
  });

  try {
    const response = await fetch(`/api/trips?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Trip search failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    const trips = Array.isArray(result)
  ? result
  : (Array.isArray(result.trips) ? result.trips : []);

    // Support common Oracle column and API property names.
    const field = (row, ...keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
          return row[key];
        }
      }
      return '';
    };

    const availableTrips = trips.map(row => ({
      id: Number(field(row, 'tripId', 'TRIP_ID', 'trip_id', 'id', 'ID')),
      vehicle: field(
        row,
        'vehicleName', 'VEHICLE_NAME', 'vehicle_name', 'vehicle'
      ) || 'Scheduled vehicle',
      time: formatTripTime(
        field(row, 'departureTime', 'DEPARTURE_TIME', 'departure_time', 'time')
      ),
      fare: Number(field(row, 'fare', 'FARE', 'price')) || 0,
      seats: Number(field(
        row,
        'availableSeats', 'AVAILABLE_SEATS', 'available_seats',
        'seatsAvailable'
      ))
    })).filter(trip => Number.isFinite(trip.id) && trip.id > 0);

    if (availableTrips.length === 0) {
      container.innerHTML =
        '<p class="muted">No scheduled trips found for these details.</p>';
      return;
    }

    state.selectedTrip = availableTrips[0].id;

    container.innerHTML = availableTrips.map(trip =>
      tripOption(
        trip.id,
        escapeHTML(trip.vehicle),
        `${escapeHTML(trip.time)} · ${
          Number.isFinite(trip.seats)
            ? `${trip.seats} seats available`
            : 'Availability not provided'
        }`,
        trip.fare,
        Number.isFinite(trip.seats)
          ? `${trip.seats} seats`
          : 'Availability unknown'
      )
    ).join('');

    // Ensure the first returned trip is selected.
    const firstOption = container.querySelector('input[name="tripOption"]');

    if (firstOption) {
      firstOption.checked = true;
    }

  } catch (error) {
    console.error('Could not load Oracle trips:', error);

    container.innerHTML =
      '<p class="muted">Could not load trips. Check the server and Oracle connection.</p>';

    toast('Could not load trips from Oracle.');
  }
}

function tickets(){let rows=state.tickets.filter(t=>t.passenger===getCurrentPassengerName()).map(t=>`<tr><td><span class="table-title">${t.id}</span><span class="subcell">${t.vehicle}</span></td><td>${escapeHTML(t.route)}<span class="subcell">Seat ${t.seat}</span></td><td>${t.date}<span class="subcell">${t.time}</span></td><td>${money(t.fare)}</td><td>${pill(t.status)}</td><td>${t.status!=='Cancelled'?`<button class="small-action" data-cancel-ticket="${t.id}">Cancel</button>`:'—'}</td></tr>`);return `${heading('tickets',`<button class="primary" data-page="book">＋ New booking</button>`)}<div class="stats-grid">${stat('Total bookings',state.tickets.filter(t=>t.passenger===getCurrentPassengerName()).length,'▤','All your demo bookings')}${stat('Confirmed',state.tickets.filter(t=>t.passenger===getCurrentPassengerName()&&t.status==='Confirmed').length,'✓','Ready for travel','positive')}${stat('Pending',state.tickets.filter(t=>t.passenger===getCurrentPassengerName()&&t.status==='Pending').length,'◷','Awaiting confirmation')}</div>${panel('Your bookings',table(['Reference','Journey','Departure','Fare','Status','Action'],rows))}<p class="muted" style="font-size:10px;margin-top:12px">Ticket actions only change temporary demonstration data.</p>`}
function reviews(){return `${heading('reviews',`<button class="primary" data-action="add-review">＋ Write a review</button>`)}<div class="stats-grid">${stat('Average rating',state.reviews.length?(state.reviews.reduce((total,r)=>total+Number(r.rating||0),0)/state.reviews.length).toFixed(1)+' ★':'—','☆','From saved reviews','accent-text')}${stat('Total reviews',state.reviews.length,'▤','Saved passenger feedback')}${stat('5-star reviews',state.reviews.filter(r=>Number(r.rating)===5).length,'✦','Positive trip feedback','positive')}</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Recent passenger feedback</h2><span class="pill purple">MongoDB</span></div>${state.reviews.map(r=>`<div class="review-card"><div class="review-meta"><strong>${escapeHTML(r.name)}</strong><span>${escapeHTML(r.date)}</span></div><div class="stars" style="margin-top:8px">${'★'.repeat(Number(r.rating)||5)}${'☆'.repeat(5-(Number(r.rating)||5))}</div><p>${escapeHTML(r.text)}</p>${r.photo?`<a href="${r.photo}" target="_blank" rel="noopener"><img class="review-photo" src="${r.photo}" alt="Photo shared with review" loading="lazy"></a>`:''}<div class="review-meta"><span>${escapeHTML(r.route)}</span><span>MongoDB</span></div>${userRole==='admin'&&r.id?`<div class="table-actions"><button class="small-action" data-edit-review="${escapeHTML(r.id)}">Edit</button><button class="small-action" data-delete-review="${escapeHTML(r.id)}">Remove</button></div>`:''}</div>`).join('')}</section>${panel('Share your experience',`<p class="muted" style="font-size:11px;line-height:1.7">Tell other passengers about your journey. You can attach one photo to your review.</p><button class="primary" data-action="add-review" style="width:100%">Write a review ↗</button><div class="panel-foot muted" style="font-size:10px">Reviews and photos are stored in MongoDB.</div>`)}</div>`}
function reports(){const types={tickets:{label:'Bookings / tickets',data:state.tickets,fields:{id:'Ticket ID',route:'Route',date:'Travel date',time:'Departure time',vehicle:'Vehicle',seat:'Seat',fare:'Fare (LKR)',status:'Status',passenger:'Passenger'}},vehicles:{label:'Vehicles',data:state.vehicles,fields:{id:'Vehicle ID',name:'Vehicle',plate:'Registration',type:'Type',seats:'Seats',status:'Status',km:'Odometer'}},drivers:{label:'Drivers',data:state.drivers,fields:{id:'Driver ID',name:'Name',licence:'Licence',phone:'Phone',experience:'Experience',status:'Availability'}},routes:{label:'Routes',data:state.routes,fields:{id:'Route ID',from:'Origin',to:'Destination',distance:'Distance',duration:'Duration',fare:'Fare (LKR)'}},trips:{label:'Scheduled trips',data:state.trips,fields:{id:'Trip ID',route:'Route',vehicle:'Vehicle',driver:'Driver',date:'Date',time:'Time',seats:'Seats',status:'Status'}},maintenance:{label:'Maintenance',data:state.maintenance,fields:{id:'Record ID',vehicle:'Vehicle',task:'Task',due:'Due date',cost:'Cost (LKR)',status:'Status'}},passengers:{label:'Passengers',data:state.passengers,fields:{id:'Passenger ID',name:'Name',email:'Email',joined:'Joined',tickets:'Bookings',status:'Status'}},reviews:{label:'Reviews',data:state.reviews,fields:{name:'Passenger',route:'Route',rating:'Rating',date:'Date',text:'Review'}}};const selected=$('#reportType')?.value||'tickets';const cfg=types[selected];const checked=$$('#reportFields input[type="checkbox"]:checked').map(i=>i.value);const output=generatedReport&&generatedReport.type===selected?generatedReport:null;const reportTable=output?table(output.columns.map(c=>cfg.fields[c]||c),output.rows.map(row=>`<tr>${output.columns.map(c=>`<td>${escapeHTML(row[c]??'')}</td>`).join('')}</tr>`),'No records match this report.'): '<div class="empty-state">Choose the data and fields above, then select Generate report.</div>';return `${heading('reports')}<div class="notice"><b>Live data report.</b> Reports use the records currently loaded from the connected databases.</div><section class="panel report-builder"><div class="panel-head"><h2>Report builder</h2><span class="pill purple">Custom fields</span></div><div class="form-grid"><div class="field"><label for="reportType">Data to report on</label><select id="reportType">${Object.entries(types).map(([key,t])=>`<option value="${key}" ${key===selected?'selected':''}>${t.label}</option>`).join('')}</select></div><div class="field"><label for="reportSearch">Optional keyword filter</label><input id="reportSearch" placeholder="Filter rows by any value" value="${escapeHTML($('#reportSearch')?.value||'')}"></div></div><div class="field"><label>Fields to include</label><div class="report-fields" id="reportFields">${Object.entries(cfg.fields).map(([key,label])=>`<label class="report-field"><input type="checkbox" value="${key}" ${checked.length?checked.includes(key)?'checked':'':'checked'}> ${label}</label>`).join('')}</div></div><div class="form-actions"><button class="secondary" data-action="select-report-fields">Select all fields</button><button class="primary" data-action="generate-report">Generate report</button></div></section><div class="panel" style="margin-top:16px"><div class="panel-head"><div><h2>Generated report</h2><p>${output?`${output.rows.length} row(s) · ${output.columns.length} selected field(s)`:'Your result will appear here.'}</p></div><button class="secondary" data-action="export-report" ${output?'':'disabled'}>Export CSV</button></div>${reportTable}</div>`}
function managementPage(key){
 const configs={
  vehicles:{title:'Vehicle management',list:state.vehicles,add:'vehicle',fields:['id','name','plate','type','seats','status','km'],headers:['Vehicle ID','Vehicle','Registration','Type','Seats','Status','Odometer','Actions'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td><span class="table-title">${escapeHTML(x.name)}</span></td><td>${escapeHTML(x.plate)}</td><td>${escapeHTML(x.type)}</td><td>${escapeHTML(x.seats)}</td><td>${pill(x.status)}</td><td>${escapeHTML(x.km)}</td><td>${rowActions(x.id)}</td></tr>`},
  drivers:{title:'Driver management',list:state.drivers,add:'driver',headers:['Driver ID','Name','Licence','Phone','Experience','Availability','Actions'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.licence)}</td><td>${escapeHTML(x.phone)}</td><td>${escapeHTML(x.experience)}</td><td>${pill(x.status)}</td><td>${rowActions(x.id)}</td></tr>`},
  routes:{title:'Route management',list:state.routes,add:'route',headers:['Route ID','Origin','Destination','Distance','Duration','Fare','Actions'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.from)}</td><td>${escapeHTML(x.to)}</td><td>${escapeHTML(x.distance)}</td><td>${escapeHTML(x.duration)}</td><td>${money(x.fare)}</td><td>${rowActions(x.id)}</td></tr>`},
  trips:{title:'Trip schedule',list:state.trips,add:'trip',headers:['Trip ID','Route','Vehicle','Driver','Date','Time','Seats','Status','Actions'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.route)}</td><td>${escapeHTML(x.vehicle)}</td><td>${escapeHTML(x.driver)}</td><td>${escapeHTML(x.date)}</td><td>${escapeHTML(x.time)}</td><td>${escapeHTML(x.seats)}</td><td>${pill(x.status)}</td><td>${rowActions(x.id)}</td></tr>`},
  maintenance:{title:'Maintenance management',list:state.maintenance,add:'maintenance',headers:['Record ID','Vehicle','Task','Due date','Estimated cost','Status','Action'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.vehicle)}</td><td>${escapeHTML(x.task)}</td><td>${escapeHTML(x.due)}</td><td>${money(x.cost)}</td><td>${pill(x.status)}</td><td><button class="small-action" data-complete-maint="${escapeHTML(x.id)}">Mark complete</button>${rowActions(x.id)}</td></tr>`},
  passengers:{title:'Passenger directory',list:state.passengers,add:'passenger',headers:['Passenger ID','Name','Email','Joined','Bookings','Status','Actions'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.email)}</td><td>${escapeHTML(x.joined)}</td><td>${escapeHTML(x.tickets)}</td><td>${pill(x.status)}</td><td>${rowActions(x.id)}</td></tr>`},
  tickets:{title:userRole==='admin'?'Booking records':'My tickets',list:userRole==='admin'?state.tickets:state.tickets.filter(t=>t.passenger===getCurrentPassengerName()),headers:['Booking ID','Passenger','Route','Travel date','Departure','Vehicle','Fare','Status','Action'],row:x=>`<tr><td>${escapeHTML(x.id)}</td><td>${escapeHTML(x.passenger)}</td><td>${escapeHTML(x.route)}</td><td>${escapeHTML(x.date)}</td><td>${escapeHTML(x.time)}</td><td>${escapeHTML(x.vehicle)}</td><td>${money(x.fare)}</td><td>${pill(x.status)}</td><td>${x.status!=='Cancelled'?`<button class="small-action" data-cancel-ticket="${escapeHTML(x.id)}">Cancel</button>`:'—'}</td></tr>`}
 };
 const c=configs[key]; if(!c)return help();
 const action=c.add&&userRole==='admin'?`<button class="primary" data-action="add-${c.add}">＋ Add ${c.add}</button>`:'';
 return `${heading(key,action)}${key==='maintenance'?`<div class="notice">Track service work and mark completed tasks. These are temporary demonstration records.</div>`:''}${toolbar('Search '+c.title.toLowerCase(),'','')}${panel(c.title,table(c.headers,c.list.map(c.row)))}`;
}
function help(){return `${heading('help')}<div class="dashboard-grid">${panel('Using the prototype',`<div class="feature-list"><div class="feature-row"><span class="check">✓</span> Use the sidebar to switch between sections.</div><div class="feature-row"><span class="check">✓</span> Admins can add and edit supported management records.</div><div class="feature-row"><span class="check">✓</span> Passengers can browse trips, manage demo tickets, and submit reviews.</div><div class="feature-row"><span class="check">✓</span> Admin reports can be configured by data category and selected fields.</div></div>`)}${panel('Important limitations',`<p class="muted" style="line-height:1.8">This is a front-end learning prototype. Operational records are loaded from Oracle and reviews are stored in MongoDB through the Express API. Sign-in is still a coursework prototype and is not secure production authentication.</p>`)}</div>`}
const renderers={overview,book,tickets:()=>managementPage('tickets'),reviews,vehicles:()=>managementPage('vehicles'),drivers:()=>managementPage('drivers'),routes:()=>managementPage('routes'),trips:()=>managementPage('trips'),maintenance:()=>managementPage('maintenance'),passengers:()=>managementPage('passengers'),reports,help};
async function loadReviewsFromDatabase() {
  try {
    const response = await fetch('/api/reviews');

    if (!response.ok) {
      throw new Error('Failed to load reviews');
    }

    const reviews = await response.json();

    state.reviews = reviews.map(review => ({
      id: review._id ? String(review._id) : '',
      name: review.passenger_name || 'Passenger',
      route: `${review.route_origin || ''} → ${review.route_destination || ''}`,
      rating: Number(review.rating) || 0,
      date: review.review_date
        ? new Date(review.review_date).toISOString().slice(0, 10)
        : '',
      text: review.comment || '',
      photo: review.photo || ''
    }));

    render();
  } catch (error) {
    console.error('Could not load reviews:', error);
    state.reviews = [];
    render();
  }
}
function render(){if(!allowedPages.includes(state.page))state.page='overview';$('#app').innerHTML=(renderers[state.page]||overview)();$('#breadcrumb').textContent=pages[state.page]?.[0]||'Overview';$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===state.page));$('#sidebar').classList.remove('open');bindSearch(); }

async function createBooking(form) {
  const origin = $('#from')?.value;
  const destination = $('#to')?.value;
  const travelDate = $('#travelDate')?.value;
  const passengers = Number($('#passengersCount')?.value || 1);
  const email = getCurrentPassengerEmail();

  const selected = form.querySelector(
    'input[name="tripOption"]:checked'
  );

  if (!origin || !destination || !travelDate) {
    toast('Please select your route and travel date.');
    return;
  }

  if (origin === destination) {
    toast('Origin and destination must be different.');
    return;
  }

  if (!selected) {
    toast('Please select an available trip first.');
    return;
  }

  if (!email) {
    toast('Please sign in again before booking.');
    return;
  }

  const payload = {
  tripId: Number(selected.value),
  passengerName: getCurrentPassengerName(),
  passengerEmail: email
};

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message || result.error ||
        `Booking request failed (${response.status})`
      );
    }

    toast('Booking request submitted successfully!');
    navigate('tickets');
    await loadOracleBookings();

  } catch (error) {
    console.error('Booking failed:', error);
    toast(error.message || 'Could not submit booking.');
  }
}

async function loadOracleBookings() {
  const email = getCurrentPassengerEmail();

  if (userRole === 'admin' || !email) return;

  try {
    const response = await fetch(
      '/api/bookings?email=' + encodeURIComponent(email)
    );

    if (!response.ok) {
      throw new Error('Could not load bookings from Oracle.');
    }

    const result = await response.json();
    const bookings = Array.isArray(result)
      ? result
      : (result.bookings || []);

    const field = (row, ...keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
          return row[key];
        }
      }
      return '';
    };

    const formatDate = value => {
      if (!value) return '';

      const str = String(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
      }

      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? str
        : [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
          ].join('-');
    };

    state.tickets = bookings.map(row => {
      const rawStatus = String(
        field(row, 'bookingStatus', 'BOOKING_STATUS', 'status', 'STATUS')
        || 'PENDING'
      );

      const status = {
        PENDING: 'Pending',
        CONFIRMED: 'Confirmed',
        CANCELLED: 'Cancelled',
        COMPLETED: 'Completed'
      }[rawStatus.toUpperCase()] || rawStatus;

      const origin = field(row, 'origin', 'ORIGIN');
      const destination = field(row, 'destination', 'DESTINATION');
      const route = field(row, 'route', 'ROUTE') ||
        (origin && destination ? `${origin} → ${destination}` : 'Route unavailable');

      return {
        id: String(field(row, 'bookingId', 'BOOKING_ID', 'id', 'ID')),
        route,
        date: formatDate(
          field(row, 'travelDate', 'TRAVELED_DATE', 'TRIP_DATE', 'date')
        ),
        time: field(row, 'departureTime', 'DEPARTURE_TIME', 'time') || '—',
        vehicle: field(row, 'vehicleName', 'VEHICLE_NAME', 'vehicle') || '—',
        seat: field(row, 'seat', 'SEAT') || '—',
        fare: Number(field(row, 'fare', 'FARE')) || 0,
        status,
        passenger: field(row, 'passengerName', 'PASSENGER_NAME')
          || getCurrentPassengerName()
      };
    });

    if (state.page === 'tickets' || state.page === 'overview') {
      render();
    }
  } catch (error) {
    console.error('Could not load Oracle bookings:', error);
    toast('Could not load saved bookings. Check your backend.');
  }
}


function navigate(page) {
  if (!pages[page]) return;

  if (!allowedPages.includes(page)) {
    toast('That page is not available for this account type.');
    return;
  }

  state.page = page;
  render();

  if (page === 'book') {
    loadOracleTrips();
  }

  if (page === 'tickets' && userRole !== 'admin') {
    loadOracleBookings();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toast(message){const el=document.createElement('div');el.className='toast';el.innerHTML=`<span>✓</span>${escapeHTML(message)}`;$('#toasts').append(el);setTimeout(()=>el.remove(),3200)}
function bindSearch(){const search=$('#tableSearch');if(!search)return;search.addEventListener('input',()=>{const q=search.value.toLowerCase();$$('#app tbody tr').forEach(tr=>tr.style.display=tr.innerText.toLowerCase().includes(q)?'':'none')})}
function showModal(title,fields,submitLabel,callback){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=`<form id="modalForm"><div class="form-grid">${fields.map(f=>`<div class="field ${f.full?'full':''}"><label for="f_${f.name}">${f.label}</label>${f.options?`<select id="f_${f.name}" name="${f.name}" ${f.required===false?'':'required'}>${f.options.map(o=>`<option value="${escapeHTML(o.value??o)}" ${String(o.value??o).toLowerCase()===String(f.value??'').toLowerCase()?'selected':''}>${escapeHTML(o.label??o)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea id="f_${f.name}" name="${f.name}" ${f.required===false?'':'required'}>${f.value!==undefined?escapeHTML(f.value):''}</textarea>`:f.type==='file'?`<input id="f_${f.name}" name="${f.name}" type="file" accept="image/*" ${f.required===false?'':'required'}><small class="muted">Image only · max 3 MB</small>`:`<input id="f_${f.name}" name="${f.name}" type="${f.type||'text'}" ${f.value!==undefined?`value="${escapeHTML(f.value)}"`:''} ${f.placeholder?`placeholder="${escapeHTML(f.placeholder)}"`:''} ${f.min!==undefined?`min="${f.min}"`:''} ${f.required===false?'':'required'}>`}</div>`).join('')}</div><div class="form-actions"><button type="button" class="secondary" id="modalCancel">Cancel</button><button class="primary" type="submit">${submitLabel}</button></div></form>`;const dialog=$('#modal');if(!dialog.open)dialog.showModal();$('#modalCancel').onclick=()=>dialog.close();$('#modalForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));const fileField=form.querySelector('input[type="file"]');if(fileField&&fileField.files[0]){const file=fileField.files[0];if(!file.type.startsWith('image/')){toast('Please choose an image file.');return}if(file.size>3*1024*1024){toast('Please choose an image smaller than 3 MB.');return}data.photo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});delete data.photoFile}try{await callback(data);dialog.close();render()}catch(error){console.error('SmartMove form save failed:',error);toast(error.message||'Could not save changes. Check the database connection.')}}}
const itemForms = {
 vehicle:{title:'Vehicle',list:'vehicles',fields:[{name:'name',label:'Vehicle name'},{name:'plate',label:'Registration plate'},{name:'type',label:'Vehicle type',options:['Bus','Van','Car','Three-wheeler']},{name:'seats',label:'Passenger seats',type:'number',min:1},{name:'km',label:'Odometer',placeholder:'e.g. 12000 km'},{name:'status',label:'Status',options:['Active','Maintenance','Inactive']}]},
 driver:{title:'Driver',list:'drivers',fields:[{name:'name',label:'Full name'},{name:'licence',label:'Licence number'},{name:'phone',label:'Contact number',placeholder:'e.g. 0771234567'},{name:'experience',label:'Driving experience',placeholder:'e.g. 6 years'},{name:'status',label:'Availability',options:['Available','On trip','Off duty']}]},
 route:{title:'Route',list:'routes',fields:[{name:'from',label:'Origin'},{name:'to',label:'Destination'},{name:'distance',label:'Distance',placeholder:'e.g. 40 km'},{name:'duration',label:'Estimated duration',placeholder:'e.g. 1h 30m'},{name:'fare',label:'Base fare (LKR)',type:'number',min:0}]},
 trip:{title:'Trip',list:'trips',fields:[{name:'route',label:'Route',options:()=>state.routes.map(r=>r.from+' → '+r.to)},{name:'vehicle',label:'Vehicle',options:()=>state.vehicles.map(v=>v.name)},{name:'driver',label:'Driver',options:()=>state.drivers.map(d=>d.name)},{name:'date',label:'Departure date',type:'date'},{name:'time',label:'Departure time',type:'time'},{name:'seats',label:'Total seats',type:'number',min:1},{name:'status',label:'Status',options:['Scheduled','In Progress','Completed','Cancelled']}]},
 maintenance:{title:'Maintenance record',list:'maintenance',fields:[{name:'vehicle',label:'Vehicle',options:()=>state.vehicles.map(v=>v.name+' · '+v.plate)},{name:'task',label:'Work required'},{name:'due',label:'Due date',type:'date'},{name:'cost',label:'Estimated cost (LKR)',type:'number',min:0},{name:'status',label:'Status',options:['Scheduled','Due soon','Overdue','Completed']}]},
 passenger:{title:'Passenger',list:'passengers',fields:[{name:'name',label:'Full name'},{name:'email',label:'Email',type:'email'},{name:'joined',label:'Registration date',type:'date'},{name:'status',label:'Status',options:['Active','Inactive']}]}
};
const apiByList = {vehicles:'vehicles',drivers:'drivers',routes:'routes',trips:'trips',maintenance:'maintenance',passengers:'passengers'};
async function apiRequest(url, options={}) {
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error||`Request failed (HTTP ${response.status})`);
 return data;
}
function normalizeFormFields(def, current={}) {
 return def.fields.map(field=>{
  const f={...field};
  if(typeof f.options==='function') f.options=f.options();
  if(current[f.name]!==undefined) f.value=current[f.name];
  if(f.type==='time'&&f.value) f.value=to24Hour(f.value);
  if(f.type==='number'&&f.value!==undefined) f.value=String(f.value).replace(/[^0-9.]/g,'');
  return f;
 });
}
function to24Hour(value){const s=String(value||'').trim();const m=s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return s;let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;return `${String(h).padStart(2,'0')}:${m[2]}`;}
async function loadManagementData(showErrors=true) {
 const keys=Object.keys(apiByList);
 const results=await Promise.allSettled(keys.map(key=>apiRequest(`/api/${apiByList[key]}`)));
 const failures=[];
 results.forEach((result,index)=>{
  const key=keys[index];
  if(result.status==='fulfilled') state[key]=Array.isArray(result.value)?result.value:[];
  else { state[key]=[]; failures.push(key); }
 });
 if(userRole==='admin'){
  try { const bookings=await apiRequest('/api/admin/bookings'); state.tickets=Array.isArray(bookings)?bookings:[]; }
  catch(error){ state.tickets=[]; failures.push('bookings'); }
 }
 if(showErrors&&failures.length) toast(`Could not load ${[...new Set(failures)].join(', ')} from Oracle. Check backend/SQL setup.`);
 render();
}
function addItem(type){
 const def=itemForms[type]; if(!def)return;
 showModal(`Add ${def.title.toLowerCase()}`,normalizeFormFields(def),'Save to database',async data=>{
  await apiRequest(`/api/${apiByList[def.list]}`,{method:'POST',body:JSON.stringify(data)});
  await loadManagementData(false); toast(`${def.title} saved to Oracle Database`);
 });
}
function editItem(id){
 let type, found;
 for(const [candidate,def] of Object.entries(itemForms)){
  found=state[def.list].find(x=>String(x.id)===String(id)); if(found){type=candidate;break;}
 }
 if(!found){toast('Record is not available in the database list.');return;}
 const def=itemForms[type];
 showModal(`Edit ${def.title.toLowerCase()} ${id}`,normalizeFormFields(def,found),'Save changes',async data=>{
  await apiRequest(`/api/${apiByList[def.list]}/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(data)});
  await loadManagementData(false); toast(`${def.title} updated in Oracle Database`);
 });
}
async function deleteItem(id){
 for(const def of Object.values(itemForms)){
  const index=state[def.list].findIndex(x=>String(x.id)===String(id));
  if(index<0)continue;
  if(!confirm(`Permanently remove ${id} from Oracle Database?`))return;
  try{await apiRequest(`/api/${apiByList[def.list]}/${encodeURIComponent(id)}`,{method:'DELETE'});await loadManagementData(false);toast('Record deleted from Oracle Database');}
  catch(error){toast(error.message||'Could not delete the record. It may be linked to another record.');}
  return;
 }
 toast('Record not found.');
}



async function loadOracleTrips() {
  const container = $('#tripOptions');

  if (!container) return;

  const origin = $('#from')?.value?.trim();
  const destination = $('#to')?.value?.trim();
  const date = $('#travelDate')?.value;

  if (!origin || !destination || !date) {
    container.innerHTML =
      '<p class="muted">Choose your route and travel date to search available trips.</p>';
    return;
  }

  if (origin.toLowerCase() === destination.toLowerCase()) {
    state.selectedTrip = null;
    container.innerHTML =
      '<p class="muted">Choose different origin and destination locations.</p>';
    return;
  }

  state.selectedTrip = null;
  container.innerHTML =
    '<p class="muted">Searching available trips...</p>';

  const params = new URLSearchParams({
    origin,
    destination,
    date
  });

  try {
    const response = await fetch(
      `/api/trips?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Trip search failed: HTTP ${response.status}`);
    }

    const result = await response.json();

    const trips = Array.isArray(result)
      ? result
      : Array.isArray(result.trips)
        ? result.trips
        : [];

    const field = (row, ...keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
          return row[key];
        }
      }
      return '';
    };

    const availableTrips = trips
      .map(row => ({
        id: Number(
          field(row, 'tripId', 'TRIP_ID', 'trip_id', 'id', 'ID')
        ),

        vehicle: String(
          field(
            row,
            'vehicleName',
            'VEHICLE_NAME',
            'vehicle_name',
            'vehicle'
          ) || 'Scheduled vehicle'
        ),

        time: formatTripTime(
          field(
            row,
            'departureTime',
            'DEPARTURE_TIME',
            'departure_time',
            'time'
          )
        ),

        fare: Number(
          field(row, 'fare', 'FARE', 'price')
        ) || 0,

        seats: Number(
          field(
            row,
            'availableSeats',
            'AVAILABLE_SEATS',
            'available_seats',
            'seatsAvailable',
            'SEATS'
          )
        )
      }))
      .filter(trip =>
        Number.isFinite(trip.id) && trip.id > 0
      );

    if (availableTrips.length === 0) {
      container.innerHTML =
        '<p class="muted">No scheduled trips found for these details.</p>';
      return;
    }

    container.innerHTML = availableTrips.map(trip =>
      tripOption(
        trip.id,
        escapeHTML(trip.vehicle),
        `${escapeHTML(trip.time)} · ${
          Number.isFinite(trip.seats)
            ? `${trip.seats} seats available`
            : 'Availability not provided'
        }`,
        trip.fare,
        Number.isFinite(trip.seats)
          ? `${trip.seats} seats`
          : 'Availability unknown'
      )
    ).join('');

    // Select the first returned trip.
    const firstOption =
      container.querySelector('input[name="tripOption"]');

    if (firstOption) {
      firstOption.checked = true;
      state.selectedTrip = Number(firstOption.value);
    } else {
      state.selectedTrip = availableTrips[0].id;
      console.error(
        'Trip radio input was not found. Check tripOption().'
      );
    }

  } catch (error) {
    console.error('Could not load Oracle trips:', error);

    container.innerHTML =
      '<p class="muted">Could not load trips. Check the server and Oracle connection.</p>';

    toast('Could not load trips from Oracle.');
  }
}

function exportGeneratedReport(){if(!generatedReport)return;const rows=[generatedReport.columns,...generatedReport.rows.map(r=>generatedReport.columns.map(c=>r[c]??''))];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='smartmove-custom-report.csv';a.click();URL.revokeObjectURL(a.href);toast('Custom report exported')}
function exportCSV(){const rows=[['Ticket ID','Route','Date','Vehicle','Fare','Status'],...state.tickets.map(t=>[t.id,t.route,t.date,t.vehicle,t.fare,t.status])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='smartmove-bookings.csv';a.click();URL.revokeObjectURL(a.href);toast('CSV exported')}
document.addEventListener('click',e=>{const p=e.target.closest('[data-page]');if(p){e.preventDefault();navigate(p.dataset.page);return}const action=e.target.closest('[data-action]')?.dataset.action;if(action){if(userRole!=='admin'&&action.startsWith('add-')&&action!=='add-review'){toast('Management actions require an administrator account.');return}if(action.startsWith('add-')&&action!=='add-review')addItem(action.slice(4));if(action==='export-report'){if(generatedReport)exportGeneratedReport();else exportCSV()}if(action==='add-review')showModal('Write a passenger review',[{name:'name',label:'Your name',placeholder:'Enter your name'},{name:'route',label:'Route',options:state.routes.map(r=>r.from+' → '+r.to)},{name:'rating',label:'Rating',options:[5,4,3,2,1].map(n=>({value:String(n),label:n+' star'+(n===1?'':'s')}))},{name:'text',label:'Your feedback',type:'textarea',full:true},{name:'photoFile',label:'Attach a photo (optional)',type:'file',required:false,full:true}], 'Submit review',async d=>{await apiRequest('/api/reviews',{method:'POST',body:JSON.stringify({name:d.name,route:d.route,text:d.text,rating:Number(d.rating)||5,photo:d.photo||'',email:getCurrentPassengerEmail()})});await loadReviewsFromDatabase();toast('Review saved to MongoDB'+(d.photo?' with photo':''))});if(action==='select-report-fields'){$$('#reportFields input[type="checkbox"]').forEach(i=>i.checked=true);return}if(action==='generate-report'){const type=$('#reportType')?.value;const configs={tickets:['tickets',['id','route','date','time','vehicle','seat','fare','status','passenger']],vehicles:['vehicles',['id','name','plate','type','seats','status','km']],drivers:['drivers',['id','name','licence','phone','experience','status']],routes:['routes',['id','from','to','distance','duration','fare']],trips:['trips',['id','route','vehicle','driver','date','time','seats','status']],maintenance:['maintenance',['id','vehicle','task','due','cost','status']],passengers:['passengers',['id','name','email','joined','tickets','status']],reviews:['reviews',['name','route','rating','date','text']]};const listKey=configs[type][0];const columns=$$('#reportFields input[type="checkbox"]:checked').map(i=>i.value);if(!columns.length){toast('Select at least one field.');return}const query=($('#reportSearch')?.value||'').trim().toLowerCase();const rows=state[listKey].filter(row=>!query||Object.values(row).some(v=>String(v??'').toLowerCase().includes(query))).map(row=>Object.fromEntries(columns.map(c=>[c,row[c]??''])));generatedReport={type,columns,rows};render();toast('Report generated from database records');return}return}const del=e.target.closest('[data-delete]');if(del){if(userRole!=='admin'){toast('Only administrators can remove management records.');return}deleteItem(del.dataset.delete);return}const edit=e.target.closest('[data-edit]');if(edit){if(userRole!=='admin'){toast('Only administrators can edit management records.');return}editItem(edit.dataset.edit);return}const cancel=e.target.closest('[data-cancel-ticket]');if(cancel){const t=state.tickets.find(t=>t.id===cancel.dataset.cancelTicket);if(t&&confirm('Cancel this booking?')){apiRequest(`/api/bookings/${encodeURIComponent(t.id)}`,{method:'PUT',body:JSON.stringify({status:'CANCELLED'})}).then(()=>{t.status='Cancelled';render();toast('Booking cancelled in Oracle Database')}).catch(error=>toast(error.message));}return}const complete=e.target.closest('[data-complete-maint]');if(complete){if(userRole!=='admin'){toast('Only administrators can update maintenance records.');return}const m=state.maintenance.find(m=>m.id===complete.dataset.completeMaint);if(m){apiRequest(`/api/maintenance/${encodeURIComponent(m.id)}`,{method:'PUT',body:JSON.stringify({...m,status:'Completed'})}).then(()=>loadManagementData(false)).then(()=>toast('Maintenance updated in Oracle Database')).catch(error=>toast(error.message));}return}const editReview=e.target.closest('[data-edit-review]');if(editReview){if(userRole!=='admin')return;const review=state.reviews.find(r=>r.id===editReview.dataset.editReview);if(review)showModal('Edit passenger review',[{name:'name',label:'Passenger name',value:review.name},{name:'rating',label:'Rating',options:[5,4,3,2,1].map(n=>({value:String(n),label:n+' star'+(n===1?'':'s')})),value:String(review.rating)},{name:'text',label:'Review',type:'textarea',value:review.text}], 'Save review',async d=>{await apiRequest(`/api/reviews/${encodeURIComponent(review.id)}`,{method:'PUT',body:JSON.stringify({name:d.name,rating:Number(d.rating),text:d.text})});await loadReviewsFromDatabase();toast('Review updated in MongoDB')});return}const delReview=e.target.closest('[data-delete-review]');if(delReview){if(userRole!=='admin')return;if(confirm('Permanently delete this review from MongoDB?'))apiRequest(`/api/reviews/${encodeURIComponent(delReview.dataset.deleteReview)}`,{method:'DELETE'}).then(()=>loadReviewsFromDatabase()).then(()=>toast('Review deleted from MongoDB')).catch(error=>toast(error.message));return}});




/* SmartMove booking form handler */
document.addEventListener("submit", async function (event) {
  const form = event.target;

  if (!form.matches("#bookingForm")) return;

  event.preventDefault();

  const button = form.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.textContent = "Booking...";
  }

  try {
    await createBooking(form);
  } catch (error) {
    console.error("SmartMove booking error:", error);
    toast(error.message || "Booking failed. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Continue to booking →";
    }
  }
});

/* Search Oracle trips whenever the route or date changes. */
document.addEventListener("change", function (event) {
  if (
    event.target.matches("#from, #to, #travelDate") &&
    state.page === "book"
  ) {
    loadOracleTrips();
  }
});

$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));$('#closeModal').addEventListener('click',()=>$('#modal').close());$('#notifications').addEventListener('click',()=>toast('You are all caught up.'));$('#profileMenu').addEventListener('click',()=>toast('SmartMove account'));render();loadManagementData();loadReviewsFromDatabase();

// Load the signed-in customer's data when the dashboard opens.
document.addEventListener('DOMContentLoaded', async () => {
  if (userRole !== 'customer') return;

  await loadOracleBookings();
  await loadReviewsFromDatabase();
});
