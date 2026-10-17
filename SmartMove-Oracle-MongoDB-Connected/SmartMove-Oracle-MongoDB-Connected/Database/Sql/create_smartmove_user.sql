-- Run this while connected as SYSTEM (or another DBA account)
-- to the correct pluggable database service, e.g. XEPDB1 or FREEPDB1.
-- Change the password below before running the script.

CREATE USER SMARTMOVE IDENTIFIED BY "ChangeThisStrongPassword";

GRANT CREATE SESSION,
      CREATE TABLE,
      CREATE SEQUENCE,
      CREATE PROCEDURE,
      CREATE TRIGGER,
      CREATE VIEW
TO SMARTMOVE;

ALTER USER SMARTMOVE QUOTA UNLIMITED ON USERS;

-- Then create a SQL Developer connection using:
-- Username: SMARTMOVE
-- Password: the password you set above
-- Service name: the same PDB service used above
