
SELECT
    column_name,
    data_type,
    nullable
FROM user_tab_columns
WHERE table_name = 'BOOKINGS'
ORDER BY column_id;



CREATE OR REPLACE TRIGGER trg_validate_booking_fare
BEFORE INSERT OR UPDATE OF fare ON bookings
FOR EACH ROW
BEGIN
    IF :NEW.fare IS NULL OR :NEW.fare <= 0 THEN
        RAISE_APPLICATION_ERROR(
            -20001,
            'Booking fare must be greater than zero.'
        );
    END IF;
END;
/


SELECT trigger_name, status
FROM user_triggers
WHERE trigger_name = 'TRG_VALIDATE_BOOKING_FARE';
