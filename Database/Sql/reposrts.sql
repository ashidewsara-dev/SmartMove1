--most used routes
SELECT
    r.origin,
    r.destination,
    COUNT(b.booking_id) AS total_bookings
FROM routes r
JOIN trips t
    ON t.route_id = r.route_id
JOIN bookings b
    ON b.trip_id = t.trip_id
WHERE b.booking_status IN ('CONFIRMED', 'COMPLETED')
GROUP BY r.origin, r.destination
ORDER BY total_bookings DESC;


--total tickets
SELECT
    COUNT(*) AS total_bookings,
    NVL(SUM(fare), 0) AS total_revenue
FROM bookings
WHERE booking_status IN ('CONFIRMED', 'COMPLETED')
  AND traveled_date >= TO_DATE('2026-10-01', 'YYYY-MM-DD')
  AND traveled_date <  TO_DATE('2026-11-01', 'YYYY-MM-DD');
  
  --travel history
  
SELECT
    p.passenger_id,
    p.passenger_name,
    b.traveled_date,
    b.departure_time,
    r.origin,
    r.destination,
    b.fare,
    b.booking_status
FROM bookings b
JOIN passengers p
    ON p.passenger_id = b.passenger_id
JOIN trips t
    ON t.trip_id = b.trip_id
JOIN routes r
    ON r.route_id = t.route_id
ORDER BY
    p.passenger_id,
    b.traveled_date DESC;

--vehicle maintenance
SELECT
    v.vehicle_id,
    v.vehicle_name,
    v.registration_plate,
    v.status AS vehicle_status,
    m.task,
    m.due_date,
    m.maintenance_status
FROM vehicles v
LEFT JOIN maintenance m
    ON m.vehicle_id = v.vehicle_id
WHERE v.status = 'MAINTENANCE'
   OR m.maintenance_status IN ('SCHEDULED', 'IN_PROGRESS')
ORDER BY m.due_date;

--trips for drivers
SELECT
    d.driver_id,
    d.driver_name,
    t.trip_id,
    r.origin,
    r.destination,
    v.vehicle_name,
    v.registration_plate,
    t.trip_date,
    t.departure_time,
    t.trip_status
FROM trips t
JOIN drivers d
    ON d.driver_id = t.driver_id
JOIN routes r
    ON r.route_id = t.route_id
JOIN vehicles v
    ON v.vehicle_id = t.vehicle_id
ORDER BY
    d.driver_id,
    t.trip_date;

