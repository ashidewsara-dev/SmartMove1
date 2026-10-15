SELECT USER FROM dual;

SELECT SYS_CONTEXT('USERENV', 'CON_NAME') AS container_name
FROM dual;

SELECT table_name
FROM user_tables
ORDER BY table_name;