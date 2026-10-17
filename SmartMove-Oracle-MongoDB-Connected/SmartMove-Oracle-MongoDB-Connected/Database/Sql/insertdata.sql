INSERT INTO drivers (driver_name, licence_num, phone, experience, availability)
VALUES ('Kasun Perera', 'B1234567', '0771234567', 8, 'AVAILABLE');

INSERT INTO passengers(passenger_name, email, joined_date,bookings, status)
VALUES('Nimali Silva', 'nimali@example.com', TO_DATE('2026-10-12', 'YYYY-MM-DD'),9 , 'ACTIVE');

INSERT INTO routes (origin, destination, distance, duration, fare)
VALUES ('Colombo', 'Kandy', 115, 180, 2500);


INSERT INTO trips (route_id,vehicle_id,driver_id,trip_date,departure_time,seats,trip_status)
VALUES (1,  1, 1,  TO_DATE('2026-10-15', 'YYYY-MM-DD'), TO_DATE('2026-10-15 08:00', 'YYYY-MM-DD HH24:MI'), 45, 'SCHEDULED');


INSERT INTO bookings (passenger_id,traveled_date,departure_time,vehicle_id,fare,booking_status)
VALUES ( 1, 1, SYSDATE, 1, 2500,'CONFIRMED');

INSERT INTO bookings (passenger_id,trip_id,traveled_date,departure_time,vehicle_id,fare,booking_status)
VALUES ( 7, 1, TO_DATE('2026-10-15', 'YYYY-MM-DD'), TO_DATE('2026-10-15 08:00', 'YYYY-MM-DD HH24:MI'), 1, 2500, 'CONFIRMED');


INSERT INTO maintenance (vehicle_id,task, due_date, cost, maintenance_status)
VALUES (1, 'Engine oil and filter inspection', TO_DATE('2026-10-12', 'YYYY-MM-DD'), 15000, 'SCHEDULED');


INSERT INTO reviews (pas_name, trip_id, rating, description)
VALUES (7, 1, 5, '...');

COMMIT;

COMMIT;


SELECT driver_id, driver_name, licence_num
FROM drivers
WHERE licence_num = 'B1234567';

SELECT passenger_id, passenger_name, email, joined_date
FROM passengers
WHERE email = 'nimali@example.com';

SELECT * FROM trips;
SELECT * FROM vehicles;
SELECT * FROM passengers;
SELECT *FROM maintenance;

SELECT column_name, data_type
FROM user_tab_columns
WHERE table_name = 'REVIEWS'
ORDER BY column_id;