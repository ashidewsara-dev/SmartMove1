
const express = require("express");
const { MongoClient } = require("mongodb");
const oracledb = require("oracledb");
require("dotenv").config();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, "smartmove-front-end-fixed");

let mongoDb;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(FRONTEND_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

function getOracleConnection() {
  return oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING
  });
}

function validDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function mapBooking(row) {
  return {
    id: String(row.BOOKING_ID),
    passenger: row.PASSENGER_NAME,
    route: `${row.ORIGIN} → ${row.DESTINATION}`,
    date: row.TRAVELED_DATE,
    time: row.DEPARTURE_TIME,
    vehicle: row.VEHICLE_NAME,
    fare: Number(row.FARE),
    status: titleValue(row.BOOKING_STATUS)
  };
}

// --- Oracle CRUD API used by the admin workspace ---
const ORACLE_RESOURCES = {
  vehicles: {
    prefix: 'VH', table: 'vehicles', idColumn: 'vehicle_id',
    listSql: `SELECT vehicle_id AS ID, vehicle_name AS NAME, registration_plate AS PLATE,
                     vehicle_type AS TYPE, seats AS SEATS, status AS STATUS,
                     odometer_km AS KM FROM vehicles ORDER BY vehicle_id`,
    map: r => ({ id: uiId('VH', r.ID), name: r.NAME, plate: r.PLATE, type: titleValue(r.TYPE),
      seats: Number(r.SEATS), status: titleValue(r.STATUS), km: `${Number(r.KM || 0).toLocaleString('en-US')} km` }),
    insert: async (c, d) => c.execute(
      `INSERT INTO vehicles (vehicle_name, registration_plate, vehicle_type, seats, status, odometer_km)
       VALUES (:name, :plate, :type, :seats, :status, :km) RETURNING vehicle_id INTO :newId`,
      { name: requiredText(d.name, 'Vehicle name', 100), plate: requiredText(d.plate, 'Registration plate', 20),
        type: requiredText(d.type, 'Vehicle type', 20).toUpperCase().slice(0, 20),
        seats: positiveInt(d.seats, 'Seats'), status: vehicleStatus(d.status), km: numericFromText(d.km),
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }),
    update: async (c, id, d) => c.execute(
      `UPDATE vehicles SET vehicle_name=:name, registration_plate=:plate, vehicle_type=:type,
       seats=:seats, status=:status, odometer_km=:km WHERE vehicle_id=:id`,
      { name: requiredText(d.name, 'Vehicle name', 100), plate: requiredText(d.plate, 'Registration plate', 20),
        type: requiredText(d.type, 'Vehicle type', 20).toUpperCase().slice(0, 20),
        seats: positiveInt(d.seats, 'Seats'), status: vehicleStatus(d.status), km: numericFromText(d.km), id }),
    remove: async (c, id) => c.execute('DELETE FROM vehicles WHERE vehicle_id=:id', { id })
  },
  drivers: {
    prefix: 'DR', table: 'drivers', idColumn: 'driver_id',
    listSql: `SELECT driver_id AS ID, driver_name AS NAME, licence_num AS LICENCE,
                     TO_CHAR(phone) AS PHONE, experience AS EXPERIENCE, availability AS STATUS
              FROM drivers ORDER BY driver_id`,
    map: r => ({ id: uiId('DR', r.ID), name: r.NAME, licence: r.LICENCE,
      phone: String(r.PHONE || '').padStart(10, '0'), experience: r.EXPERIENCE,
      status: titleValue(String(r.STATUS || '').replace('_', ' ')) }),
    insert: async (c, d) => c.execute(
      `INSERT INTO drivers (driver_name, licence_num, phone, experience, availability)
       VALUES (:name, :licence, :phone, :experience, :status) RETURNING driver_id INTO :newId`,
      { name: requiredText(d.name, 'Driver name', 100), licence: requiredText(d.licence, 'Licence number', 20),
        phone: phoneNumber(d.phone), experience: requiredText(d.experience, 'Experience', 20),
        status: driverStatus(d.status), newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }),
    update: async (c, id, d) => c.execute(
      `UPDATE drivers SET driver_name=:name, licence_num=:licence, phone=:phone,
       experience=:experience, availability=:status WHERE driver_id=:id`,
      { name: requiredText(d.name, 'Driver name', 100), licence: requiredText(d.licence, 'Licence number', 20),
        phone: phoneNumber(d.phone), experience: requiredText(d.experience, 'Experience', 20), status: driverStatus(d.status), id }),
    remove: async (c, id) => c.execute('DELETE FROM drivers WHERE driver_id=:id', { id })
  },
  routes: {
    prefix: 'RT', table: 'routes', idColumn: 'route_id',
    listSql: `SELECT route_id AS ID, origin AS ORIGIN, destination AS DESTINATION,
                     distance AS DISTANCE, duration AS DURATION, fare AS FARE
              FROM routes ORDER BY route_id`,
    map: r => ({ id: uiId('RT', r.ID), from: r.ORIGIN, to: r.DESTINATION, distance: r.DISTANCE,
      duration: r.DURATION, fare: Number(r.FARE) || r.FARE }),
    insert: async (c, d) => c.execute(
      `INSERT INTO routes (origin, destination, distance, duration, fare)
       VALUES (:origin, :destination, :distance, :duration, :fare) RETURNING route_id INTO :newId`,
      { origin: requiredText(d.from, 'Origin', 100), destination: requiredText(d.to, 'Destination', 100),
        distance: requiredText(d.distance, 'Distance', 50), duration: requiredText(d.duration, 'Duration', 50),
        fare: String(nonNegativeNumber(d.fare, 'Fare')), newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }),
    update: async (c, id, d) => c.execute(
      `UPDATE routes SET origin=:origin, destination=:destination, distance=:distance,
       duration=:duration, fare=:fare WHERE route_id=:id`,
      { origin: requiredText(d.from, 'Origin', 100), destination: requiredText(d.to, 'Destination', 100),
        distance: requiredText(d.distance, 'Distance', 50), duration: requiredText(d.duration, 'Duration', 50),
        fare: String(nonNegativeNumber(d.fare, 'Fare')), id }),
    remove: async (c, id) => c.execute('DELETE FROM routes WHERE route_id=:id', { id })
  },
  trips: {
    prefix: 'TR', table: 'trips', idColumn: 'trip_id',
    listSql: `SELECT t.trip_id AS ID, r.origin AS ORIGIN, r.destination AS DESTINATION,
                     v.vehicle_name AS VEHICLE, d.driver_name AS DRIVER,
                     TO_CHAR(t.trip_date, 'YYYY-MM-DD') AS TRIP_DATE,
                     TO_CHAR(t.departure_time, 'HH24:MI') AS TRIP_TIME,
                     t.seats AS SEATS, t.trip_status AS STATUS
              FROM trips t JOIN routes r ON r.route_id=t.route_id
              JOIN vehicles v ON v.vehicle_id=t.vehicle_id
              JOIN drivers d ON d.driver_id=t.driver_id ORDER BY t.trip_date, t.departure_time`,
    map: r => ({ id: uiId('TR', r.ID), route: `${r.ORIGIN} → ${r.DESTINATION}`, vehicle: r.VEHICLE,
      driver: r.DRIVER, date: r.TRIP_DATE, time: displayTime(r.TRIP_TIME), seats: Number(r.SEATS), status: titleValue(r.STATUS) }),
    insert: async (c, d) => {
      const refs = await tripReferences(c, d);
      return c.execute(
        `INSERT INTO trips (route_id, vehicle_id, driver_id, trip_date, departure_time, seats, trip_status)
         VALUES (:routeId, :vehicleId, :driverId, TO_DATE(:tripDate,'YYYY-MM-DD'),
                 TO_DATE(:tripDate || ' ' || :tripTime, 'YYYY-MM-DD HH24:MI'), :seats, :status)
         RETURNING trip_id INTO :newId`,
        { ...refs, tripDate: validDateText(d.date), tripTime: validTimeText(d.time), seats: positiveInt(d.seats, 'Seats'),
          status: tripStatus(d.status), newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
    },
    update: async (c, id, d) => {
      const refs = await tripReferences(c, d);
      return c.execute(
        `UPDATE trips SET route_id=:routeId, vehicle_id=:vehicleId, driver_id=:driverId,
         trip_date=TO_DATE(:tripDate,'YYYY-MM-DD'),
         departure_time=TO_DATE(:tripDate || ' ' || :tripTime, 'YYYY-MM-DD HH24:MI'),
         seats=:seats, trip_status=:status WHERE trip_id=:id`,
        { ...refs, tripDate: validDateText(d.date), tripTime: validTimeText(d.time), seats: positiveInt(d.seats, 'Seats'),
          status: tripStatus(d.status), id });
    },
    remove: async (c, id) => c.execute('DELETE FROM trips WHERE trip_id=:id', { id })
  },
  maintenance: {
    prefix: 'MN', table: 'maintenance', idColumn: 'maintenance_id',
    listSql: `SELECT m.maintenance_id AS ID, v.vehicle_name AS VEHICLE_NAME,
                     v.registration_plate AS PLATE, m.task AS TASK,
                     TO_CHAR(m.due_date, 'YYYY-MM-DD') AS DUE_DATE, m.cost AS COST,
                     m.maintenance_status AS STATUS
              FROM maintenance m JOIN vehicles v ON v.vehicle_id=m.vehicle_id ORDER BY m.due_date`,
    map: r => ({ id: uiId('MN', r.ID), vehicle: `${r.VEHICLE_NAME} · ${r.PLATE}`, task: r.TASK,
      due: r.DUE_DATE, cost: Number(r.COST), status: titleValue(r.STATUS) }),
    insert: async (c, d) => {
      const vehicleId = await maintenanceVehicleId(c, d.vehicle);
      return c.execute(
        `INSERT INTO maintenance (vehicle_id, task, due_date, cost, maintenance_status)
         VALUES (:vehicleId, :task, TO_DATE(:due,'YYYY-MM-DD'), :cost, :status)
         RETURNING maintenance_id INTO :newId`,
        { vehicleId, task: requiredText(d.task, 'Maintenance task', 50), due: validDateText(d.due),
          cost: nonNegativeNumber(d.cost, 'Cost'), status: maintenanceStatus(d.status),
          newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
    },
    update: async (c, id, d) => {
      const vehicleId = await maintenanceVehicleId(c, d.vehicle);
      return c.execute(
        `UPDATE maintenance SET vehicle_id=:vehicleId, task=:task, due_date=TO_DATE(:due,'YYYY-MM-DD'),
         cost=:cost, maintenance_status=:status WHERE maintenance_id=:id`,
        { vehicleId, task: requiredText(d.task, 'Maintenance task', 50), due: validDateText(d.due),
          cost: nonNegativeNumber(d.cost, 'Cost'), status: maintenanceStatus(d.status), id });
    },
    remove: async (c, id) => c.execute('DELETE FROM maintenance WHERE maintenance_id=:id', { id })
  },
  passengers: {
    prefix: 'PS', table: 'passengers', idColumn: 'passenger_id',
    listSql: `SELECT p.passenger_id AS ID, p.passenger_name AS NAME, p.email AS EMAIL,
                     TO_CHAR(p.joined_date, 'YYYY-MM-DD') AS JOINED, p.bookings AS TICKETS,
                     p.status AS STATUS FROM passengers p ORDER BY p.passenger_id`,
    map: r => ({ id: uiId('PS', r.ID), name: r.NAME, email: r.EMAIL, joined: r.JOINED,
      tickets: Number(r.TICKETS || 0), status: titleValue(r.STATUS) }),
    insert: async (c, d) => c.execute(
      `INSERT INTO passengers (passenger_name, email, joined_date, bookings, status)
       VALUES (:name, :email, TO_DATE(:joined,'YYYY-MM-DD'), 0, :status)
       RETURNING passenger_id INTO :newId`,
      { name: requiredText(d.name, 'Passenger name', 100), email: validEmail(d.email), joined: validDateText(d.joined),
        status: passengerStatus(d.status), newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }),
    update: async (c, id, d) => c.execute(
      `UPDATE passengers SET passenger_name=:name, email=:email,
       joined_date=TO_DATE(:joined,'YYYY-MM-DD'), status=:status WHERE passenger_id=:id`,
      { name: requiredText(d.name, 'Passenger name', 100), email: validEmail(d.email), joined: validDateText(d.joined),
        status: passengerStatus(d.status), id }),
    remove: async (c, id) => c.execute('DELETE FROM passengers WHERE passenger_id=:id', { id })
  }
};

function uiId(prefix, id) { return `${prefix}-${String(id).padStart(3, '0')}`; }
function dbId(raw, prefix) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const match = String(raw).match(/(?:^|\D)(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function titleValue(value) { return String(value ?? '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function requiredText(value, label, max) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return text;
}
function nonNegativeNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number.`);
  return n;
}
function positiveInt(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${label} must be a positive whole number.`);
  return n;
}
function numericFromText(value) { return nonNegativeNumber(String(value ?? '0').replace(/[^0-9.]/g, '') || '0', 'Odometer'); }
function vehicleStatus(v) { const x = String(v || 'Active').toUpperCase(); return ['ACTIVE','MAINTENANCE','INACTIVE'].includes(x) ? x : 'ACTIVE'; }
function driverStatus(v) { const x = String(v || 'Available').toUpperCase(); return ({ 'AVAILABLE':'AVAILABLE','ON TRIP':'ON_TRIP','ON_TRIP':'ON_TRIP','OFF DUTY':'OFF DUTY' })[x] || 'AVAILABLE'; }
function tripStatus(v) { const x = String(v || 'Scheduled').toUpperCase().replace(/ /g, '_'); return ['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(x) ? x : 'SCHEDULED'; }
function maintenanceStatus(v) { const x = String(v || 'Scheduled').toUpperCase(); return ['SCHEDULED','DUE SOON','OVERDUE','COMPLETED'].includes(x) ? x : 'SCHEDULED'; }
function passengerStatus(v) { return String(v || 'Active').toUpperCase() === 'INACTIVE' || String(v).toUpperCase() === 'PENDING' ? 'INACTIVE' : 'ACTIVE'; }
function phoneNumber(v) { const digits = String(v ?? '').replace(/\D/g, ''); if (!/^\d{9,10}$/.test(digits)) throw new Error('Enter a valid 9–10 digit phone number.'); return Number(digits); }
function validEmail(v) { const email = requiredText(v, 'Email', 100).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.'); return email; }
function validDateText(v) { if (!validDate(v)) throw new Error('Enter a valid date in YYYY-MM-DD format.'); return v; }
function validTimeText(v) { const x = String(v ?? '').trim(); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) throw new Error('Enter a valid time.'); return x; }
function displayTime(v) { if (!v) return ''; const [h, m] = String(v).split(':').map(Number); const suffix = h >= 12 ? 'PM' : 'AM'; return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`; }
async function tripReferences(c, d) {
  const routeParts = String(d.route || '').split(/\s*(?:→|->)\s*/);
  if (routeParts.length !== 2 || !routeParts.every(Boolean)) throw new Error('Choose a valid route.');
  const route = await c.execute(`SELECT route_id FROM routes WHERE UPPER(TRIM(origin))=UPPER(TRIM(:origin)) AND UPPER(TRIM(destination))=UPPER(TRIM(:destination))`, { origin: routeParts[0], destination: routeParts[1] });
  const vehicle = await c.execute(`SELECT vehicle_id FROM vehicles WHERE UPPER(TRIM(vehicle_name))=UPPER(TRIM(:name))`, { name: requiredText(d.vehicle, 'Vehicle', 100) });
  const driver = await c.execute(`SELECT driver_id FROM drivers WHERE UPPER(TRIM(driver_name))=UPPER(TRIM(:name))`, { name: requiredText(d.driver, 'Driver', 100) });
  if (!route.rows.length) throw new Error('The selected route no longer exists. Create the route first.');
  if (!vehicle.rows.length) throw new Error('The selected vehicle no longer exists.');
  if (!driver.rows.length) throw new Error('The selected driver no longer exists.');
  return { routeId: route.rows[0][0], vehicleId: vehicle.rows[0][0], driverId: driver.rows[0][0] };
}
async function maintenanceVehicleId(c, value) {
  const name = String(value || '').split(' · ')[0].trim();
  const result = await c.execute('SELECT vehicle_id FROM vehicles WHERE UPPER(TRIM(vehicle_name))=UPPER(TRIM(:name))', { name });
  if (!result.rows.length) throw new Error('Select a vehicle that exists in the Vehicles table.');
  return result.rows[0][0];
}
async function withOracle(res, work, successStatus = 200) {
  let connection;
  try {
    connection = await getOracleConnection();
    const result = await work(connection);
    if (result && typeof result.rowsAffected === 'number' && result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }
    await connection.commit();
    return res.status(successStatus).json(result?.payload ?? { status: 'OK', message: 'Saved to Oracle.' });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch {} }
    console.error('Oracle CRUD error:', error.message);
    const oracleCode = String(error?.message || '');
    const clientError = error instanceof Error && !/ORA-|NJS-|DPI-/.test(oracleCode);
    let message = clientError ? oracleCode : 'Oracle operation failed. Check the server log and database schema.';
    if (/ORA-02292/.test(oracleCode)) message = 'This record is linked to other records. Remove or reassign those records before deleting it.';
    else if (/ORA-00001/.test(oracleCode)) message = 'A unique value already exists. Check the registration plate, licence number or other unique fields.';
    else if (/ORA-02291/.test(oracleCode)) message = 'A related record does not exist. Verify the selected route, vehicle, driver or passenger.';
    return res.status(clientError ? 400 : 500).json({ error: message });
  } finally { if (connection) { try { await connection.close(); } catch {} } }
}

function registerOracleCrud(resource) {
  const cfg = ORACLE_RESOURCES[resource];
  if (resource !== 'trips') {
    app.get(`/api/${resource}`, async (req, res) => withOracle(res, async c => {
      const result = await c.execute(cfg.listSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return { payload: result.rows.map(cfg.map) };
    }));
  }
  app.post(`/api/${resource}`, async (req, res) => withOracle(res, async c => {
    const result = await cfg.insert(c, req.body || {});
    return { payload: { status: 'OK', message: 'Record saved to Oracle.', id: uiId(cfg.prefix, result.outBinds.newId[0]) } };
  }, 201));
  app.put(`/api/${resource}/:id`, async (req, res) => {
    const id = dbId(req.params.id, cfg.prefix);
    if (!id) return res.status(400).json({ error: 'Invalid record ID.' });
    return withOracle(res, async c => {
      const result = await cfg.update(c, id, req.body || {});
      return result;
    });
  });
  app.delete(`/api/${resource}/:id`, async (req, res) => {
    const id = dbId(req.params.id, cfg.prefix);
    if (!id) return res.status(400).json({ error: 'Invalid record ID.' });
    return withOracle(res, async c => cfg.remove(c, id));
  });
}
['vehicles', 'drivers', 'routes', 'trips', 'maintenance', 'passengers'].forEach(registerOracleCrud);

// Admin-wide booking listing and status update; customer listing stays email-scoped.
app.get('/api/admin/bookings', async (req, res) => withOracle(res, async c => {
  const result = await c.execute(
    `SELECT b.booking_id AS BOOKING_ID, p.passenger_name AS PASSENGER_NAME,
       p.email AS PASSENGER_EMAIL, r.origin AS ORIGIN, r.destination AS DESTINATION,
       TO_CHAR(b.traveled_date, 'YYYY-MM-DD') AS TRAVELED_DATE,
       TO_CHAR(b.departure_time, 'HH:MI AM') AS DEPARTURE_TIME, v.vehicle_name AS VEHICLE_NAME,
       b.fare AS FARE, b.booking_status AS BOOKING_STATUS
     FROM bookings b JOIN passengers p ON p.passenger_id=b.passenger_id
     JOIN trips t ON t.trip_id=b.trip_id JOIN routes r ON r.route_id=t.route_id
     JOIN vehicles v ON v.vehicle_id=b.vehicle_id ORDER BY b.booking_id DESC`, [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return { payload: result.rows.map(row => ({ ...mapBooking(row), passengerEmail: row.PASSENGER_EMAIL })) };
}));
app.put('/api/bookings/:id', async (req, res) => {
  const id = dbId(req.params.id, 'SM');
  const status = String(req.body?.status || '').toUpperCase();
  if (!id || !['PENDING','CONFIRMED','CANCELLED','COMPLETED'].includes(status)) return res.status(400).json({ error: 'Invalid booking ID or status.' });
  return withOracle(res, async c => c.execute('UPDATE bookings SET booking_status=:status WHERE booking_id=:id', { status, id }));
});

// Check Oracle connection and list tables.
app.get("/api/oracle-test", async (req, res) => {
  let connection;

  try {
    connection = await getOracleConnection();

    const result = await connection.execute(
      "SELECT table_name FROM user_tables ORDER BY table_name"
    );

    res.json({
      status: "OK",
      database: "Oracle connected",
      tables: result.rows.map(row => row[0])
    });
  } catch (error) {
    console.error("Oracle test failed:", error.message);
    res.status(500).json({
      status: "ERROR",
      message: "Oracle query failed"
    });
  } finally {
    if (connection) await connection.close();
  }
});

// Return scheduled trips matching the selected route and date.
app.get("/api/trips", async (req, res) => {
  const { origin, destination, date } = req.query;

  // With no filters, this endpoint supplies the persisted admin trip list.
  if (!origin && !destination && !date) {
    let listConnection;
    try {
      listConnection = await getOracleConnection();
      const listResult = await listConnection.execute(ORACLE_RESOURCES.trips.listSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json(listResult.rows.map(ORACLE_RESOURCES.trips.map));
    } catch (error) {
      console.error("Trip list failed:", error.message);
      return res.status(500).json({ error: "Could not retrieve trips from Oracle." });
    } finally { if (listConnection) await listConnection.close(); }
  }

  if (!origin || !destination ||
      origin.trim().toLowerCase() === destination.trim().toLowerCase() ||
      !validDate(date)) {
    return res.status(400).json({
      error: "Provide different origin and destination locations and a valid travel date."
    });
  }

  let connection;

  try {
    connection = await getOracleConnection();

    const result = await connection.execute(
      `SELECT
         t.trip_id AS TRIP_ID,
         r.origin AS ORIGIN,
         r.destination AS DESTINATION,
         TO_CHAR(t.trip_date, 'YYYY-MM-DD') AS TRIP_DATE,
         TO_CHAR(t.departure_time, 'HH:MI AM') AS DEPARTURE_TIME,
         r.duration AS DURATION,
         v.vehicle_name AS VEHICLE_NAME,
         t.vehicle_id AS VEHICLE_ID,
         TO_NUMBER(TRIM(r.fare)) AS FARE,
         t.seats - (
           SELECT COUNT(*)
           FROM bookings b
           WHERE b.trip_id = t.trip_id
             AND b.booking_status IN ('PENDING', 'CONFIRMED')
         ) AS AVAILABLE_SEATS
       FROM trips t
       JOIN routes r ON r.route_id = t.route_id
       JOIN vehicles v ON v.vehicle_id = t.vehicle_id
       WHERE UPPER(TRIM(r.origin)) = UPPER(TRIM(:origin))
         AND UPPER(TRIM(r.destination)) = UPPER(TRIM(:destination))
         AND t.trip_date >= TO_DATE(:travelDate, 'YYYY-MM-DD')
         AND t.trip_date < TO_DATE(:travelDate, 'YYYY-MM-DD') + 1
         AND t.trip_status = 'SCHEDULED'
         AND REGEXP_LIKE(TRIM(r.fare), '^[0-9]+([.][0-9]+)?$')
       ORDER BY t.departure_time`,
      {
        origin: origin.trim(),
        destination: destination.trim(),
        travelDate: date
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      trips: result.rows.filter(row => row.AVAILABLE_SEATS > 0)
    });
  } catch (error) {
    console.error("Trip search failed:", error.message);
    res.status(500).json({
      error: "Could not retrieve available trips. Check the Oracle schema and trip data."
    });
  } finally {
    if (connection) await connection.close();
  }
});

// Create a booking using real Oracle passenger and trip records.
// If the passenger does not exist, create a passenger record as part
// of the booking workflow.
app.post("/api/bookings", async (req, res) => {
  const { tripId, passengerName, passengerEmail } = req.body || {};

  const id = Number(tripId);
  const name = typeof passengerName === "string"
    ? passengerName.trim()
    : "";
  const email = typeof passengerEmail === "string"
    ? passengerEmail.trim().toLowerCase()
    : "";

  if (!Number.isSafeInteger(id) || id < 1 ||
      !name || name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 100) {
    return res.status(400).json({
      error: "A valid trip, passenger name and email are required."
    });
  }

  let connection;

  try {
    connection = await getOracleConnection();

    // Verify the trip exists, is scheduled, has a numeric fare,
    // and still has capacity.
    const tripResult = await connection.execute(
      `SELECT
         t.trip_id AS TRIP_ID,
         t.trip_date AS TRIP_DATE,
         t.departure_time AS DEPARTURE_DATE,
         t.vehicle_id AS VEHICLE_ID,
         t.seats AS SEATS,
         r.origin AS ORIGIN,
         r.destination AS DESTINATION,
         r.fare AS ROUTE_FARE,
         v.vehicle_name AS VEHICLE_NAME,
         (
           SELECT COUNT(*)
           FROM bookings b
           WHERE b.trip_id = t.trip_id
             AND b.booking_status IN ('PENDING', 'CONFIRMED')
         ) AS BOOKED_COUNT
       FROM trips t
       JOIN routes r ON r.route_id = t.route_id
       JOIN vehicles v ON v.vehicle_id = t.vehicle_id
       WHERE t.trip_id = :tripId
         AND t.trip_status = 'SCHEDULED'
       FOR UPDATE OF t.trip_status`,
      { tripId: id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (tripResult.rows.length === 0) {
      await connection.rollback();
      return res.status(409).json({
        error: "This trip does not exist or is not scheduled."
      });
    }

    const trip = tripResult.rows[0];
    const fareText = String(trip.ROUTE_FARE).trim();

    if (!/^\d+(\.\d+)?$/.test(fareText)) {
      await connection.rollback();
      return res.status(409).json({
        error: "This trip has no valid numeric fare configured in ROUTES."
      });
    }

    if (Number(trip.BOOKED_COUNT) >= Number(trip.SEATS)) {
      await connection.rollback();
      return res.status(409).json({
        error: "This trip has no seats remaining."
      });
    }

    const fare = Number(fareText);

    // Find the passenger by email. Refuse ambiguous matches.
    const passengerResult = await connection.execute(
      `SELECT passenger_id, passenger_name
       FROM passengers
       WHERE LOWER(TRIM(email)) = :email
         AND status = 'ACTIVE'
       FOR UPDATE`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let passengerId;
    let savedPassengerName = name;

    if (passengerResult.rows.length > 1) {
      await connection.rollback();
      return res.status(409).json({
        error: "More than one passenger has this email. Resolve duplicate passenger records first."
      });
    }

    if (passengerResult.rows.length === 1) {
      passengerId = passengerResult.rows[0].PASSENGER_ID;
      savedPassengerName = passengerResult.rows[0].PASSENGER_NAME;
    } else {
      const passengerInsert = await connection.execute(
        `INSERT INTO passengers
           (passenger_name, email, joined_date, bookings, status)
         VALUES
           (:name, :email, SYSDATE, 0, 'ACTIVE')
         RETURNING passenger_id INTO :passengerId`,
        {
          name,
          email,
          passengerId: {
            dir: oracledb.BIND_OUT,
            type: oracledb.NUMBER
          }
        }
      );

      passengerId = passengerInsert.outBinds.passengerId[0];
    }

    const bookingInsert = await connection.execute(
      `INSERT INTO bookings
         (passenger_id, trip_id, traveled_date, departure_time,
          vehicle_id, fare, booking_status)
       VALUES
         (:passengerId, :tripId, :travelDate, :departureTime,
          :vehicleId, :fare, 'PENDING')
       RETURNING booking_id INTO :bookingId`,
      {
        passengerId,
        tripId: id,
        travelDate: trip.TRIP_DATE,
        departureTime: trip.DEPARTURE_DATE,
        vehicleId: trip.VEHICLE_ID,
        fare,
        bookingId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      }
    );

    await connection.execute(
      `UPDATE passengers
       SET bookings = bookings + 1
       WHERE passenger_id = :passengerId`,
      { passengerId }
    );

    await connection.commit();

    const bookingId = bookingInsert.outBinds.bookingId[0];

    res.status(201).json({
      status: "OK",
      message: "Booking saved to Oracle.",
      booking: {
        id: String(bookingId),
        passenger: savedPassengerName,
        route: `${trip.ORIGIN} → ${trip.DESTINATION}`,
        date: trip.TRIP_DATE.toISOString().slice(0, 10),
        time: trip.DEPARTURE_DATE.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }),
        vehicle: trip.VEHICLE_NAME,
        fare,
        status: "PENDING"
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Booking rollback failed:", rollbackError.message);
      }
    }

    console.error("Booking creation failed:", error.message);
    res.status(500).json({
      error: "Could not save the booking to Oracle. Check the server log."
    });
  } finally {
    if (connection) await connection.close();
  }
});

// Retrieve bookings belonging to a passenger email.
app.get("/api/bookings", async (req, res) => {
  const email = typeof req.query.email === "string"
    ? req.query.email.trim().toLowerCase()
    : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: "A valid passenger email is required."
    });
  }

  let connection;

  try {
    connection = await getOracleConnection();

    const result = await connection.execute(
      `SELECT
         b.booking_id AS BOOKING_ID,
         p.passenger_name AS PASSENGER_NAME,
         r.origin AS ORIGIN,
         r.destination AS DESTINATION,
         TO_CHAR(b.traveled_date, 'YYYY-MM-DD') AS TRAVELED_DATE,
         TO_CHAR(b.departure_time, 'HH:MI AM') AS DEPARTURE_TIME,
         v.vehicle_name AS VEHICLE_NAME,
         b.fare AS FARE,
         b.booking_status AS BOOKING_STATUS
       FROM bookings b
       JOIN passengers p ON p.passenger_id = b.passenger_id
       JOIN trips t ON t.trip_id = b.trip_id
       JOIN routes r ON r.route_id = t.route_id
       JOIN vehicles v ON v.vehicle_id = b.vehicle_id
       WHERE LOWER(TRIM(p.email)) = :email
       ORDER BY b.booking_id DESC`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      bookings: result.rows.map(mapBooking)
    });
  } catch (error) {
    console.error("Booking retrieval failed:", error.message);
    res.status(500).json({
      error: "Could not retrieve bookings from Oracle."
    });
  } finally {
    if (connection) await connection.close();
  }
});

async function startServer() {
  // Register the health endpoint before starting the server.
  app.get("/api/health", (req, res) => {
    res.json({
      status: "OK",
      message: "SmartMove backend is running",
      mongodb: mongoDb ? "connected" : "unavailable"
    });
  });

  // Keep the existing review functionality.
  app.get("/api/reviews", async (req, res) => {
    if (!mongoDb) {
      return res.status(503).json({
        error: "MongoDB is unavailable. Reviews cannot be loaded."
      });
    }

    try {
      const reviews = await mongoDb
        .collection("passenger_reviews")
        .find({})
        .limit(50)
        .toArray();

      res.json(reviews);
    } catch (error) {
      console.error("Review query failed:", error.message);
      res.status(500).json({
        error: "Could not retrieve reviews"
      });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    if (!mongoDb) return res.status(503).json({ error: "MongoDB is unavailable. Reviews cannot be saved." });
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const route = typeof body.route === 'string' ? body.route.trim() : '';
    const comment = typeof body.text === 'string' ? body.text.trim() : '';
    const rating = Number(body.rating);
    if (!name || name.length > 100 || !route || route.length > 220 || !comment || comment.length > 2000 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Provide a name, route, review text and rating from 1 to 5." });
    }
    if (typeof body.photo === 'string' && body.photo.length > 4_200_000) return res.status(413).json({ error: "The review photo is too large." });
    const parts = route.split(/\s*(?:→|->)\s*/);
    const doc = { passenger_name: name, passenger_email: String(body.email || '').slice(0, 100),
      route_origin: parts[0] || route, route_destination: parts[1] || '', rating,
      review_date: new Date().toISOString(), comment, photo: typeof body.photo === 'string' ? body.photo : '', created_at: new Date() };
    try {
      const result = await mongoDb.collection("passenger_reviews").insertOne(doc);
      return res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (error) { console.error("Review save failed:", error.message); return res.status(500).json({ error: "Could not save review to MongoDB." }); }
  });

  app.put("/api/reviews/:id", async (req, res) => {
    if (!mongoDb) return res.status(503).json({ error: "MongoDB is unavailable." });
    let objectId;
    try { objectId = new (require('mongodb').ObjectId)(req.params.id); } catch { return res.status(400).json({ error: "Invalid review ID." }); }
    const body = req.body || {};
    const updates = {};
    if (typeof body.text === 'string' && body.text.trim()) updates.comment = body.text.trim().slice(0, 2000);
    if (Number.isInteger(Number(body.rating)) && Number(body.rating) >= 1 && Number(body.rating) <= 5) updates.rating = Number(body.rating);
    if (typeof body.name === 'string' && body.name.trim()) updates.passenger_name = body.name.trim().slice(0, 100);
    if (!Object.keys(updates).length) return res.status(400).json({ error: "Supply a valid name, review text or rating to update." });
    try { const result = await mongoDb.collection("passenger_reviews").updateOne({ _id: objectId }, { $set: updates });
      if (!result.matchedCount) return res.status(404).json({ error: "Review not found." });
      return res.json({ status: "OK", message: "Review updated in MongoDB." });
    } catch (error) { console.error("Review update failed:", error.message); return res.status(500).json({ error: "Could not update review." }); }
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    if (!mongoDb) return res.status(503).json({ error: "MongoDB is unavailable." });
    let objectId;
    try { objectId = new (require('mongodb').ObjectId)(req.params.id); } catch { return res.status(400).json({ error: "Invalid review ID." }); }
    try { const result = await mongoDb.collection("passenger_reviews").deleteOne({ _id: objectId });
      if (!result.deletedCount) return res.status(404).json({ error: "Review not found." });
      return res.json({ status: "OK", message: "Review deleted from MongoDB." });
    } catch (error) { console.error("Review delete failed:", error.message); return res.status(500).json({ error: "Could not delete review." }); }
  });

  // Start Express even if MongoDB is unavailable.
  app.listen(PORT, () => {
    console.log(`SmartMove server running at http://localhost:${PORT}`);
  });

  // Connect to MongoDB separately.
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI is missing. Reviews are unavailable.");
    return;
  }

  try {
    const mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db("smartmove");
    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn("Oracle booking endpoints can still be tested.");
  }
}

startServer();