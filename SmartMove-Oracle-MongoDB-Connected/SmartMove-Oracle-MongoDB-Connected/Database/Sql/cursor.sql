
CREATE OR REPLACE PROCEDURE show_trips_cursor
IS
    CURSOR trip_cursor IS
        SELECT
            d.driver_name,
            t.trip_id,
            r.origin,
            r.destination,
            t.trip_status
        FROM trips t
        JOIN drivers d
            ON d.driver_id = t.driver_id
        JOIN routes r
            ON r.route_id = t.route_id
        ORDER BY d.driver_name;

    v_driver_name drivers.driver_name%TYPE;
    v_trip_id     trips.trip_id%TYPE;
    v_origin      routes.origin%TYPE;
    v_destination routes.destination%TYPE;
    v_status      trips.trip_status%TYPE;

BEGIN
    OPEN trip_cursor;

    LOOP
        FETCH trip_cursor
        INTO v_driver_name, v_trip_id, v_origin,
             v_destination, v_status;

        EXIT WHEN trip_cursor%NOTFOUND;

        DBMS_OUTPUT.PUT_LINE(
            'Driver: ' || v_driver_name ||
            ' | Trip: ' || v_trip_id ||
            ' | Route: ' || v_origin || ' to ' ||
            v_destination ||
         
            ' | Status: ' || v_status
        );
    END LOOP;

    CLOSE trip_cursor;

EXCEPTION
    WHEN OTHERS THEN
        IF trip_cursor%ISOPEN THEN
            CLOSE trip_cursor;
        END IF;

        RAISE;
END;
/


BEGIN
    show_trips_cursor;
END;
/
