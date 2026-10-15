-- Run once as SMARTMOVE only when VEHICLES already exists with VARCHAR2(10).
ALTER TABLE vehicles MODIFY vehicle_type VARCHAR2(20);
