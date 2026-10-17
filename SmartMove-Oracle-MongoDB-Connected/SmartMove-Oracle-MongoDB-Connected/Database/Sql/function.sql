
CREATE OR REPLACE FUNCTION calculate_trip_fare(
    p_fare_per_passenger IN NUMBER,
    p_number_of_passengers IN NUMBER
)
RETURN NUMBER
IS
BEGIN
    RETURN p_fare_per_passenger * p_number_of_passengers;
END;
/



SELECT calculate_trip_fare(2500, 4) AS total_fare
FROM dual;
