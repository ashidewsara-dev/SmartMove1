# SmartMove database + frontend setup

## 1. Requirements
- Node.js 20 or newer (recommended for the current packages)
- Oracle Database XE/Free running locally, with the SmartMove schema user created in the correct pluggable database
- MongoDB Community Server running locally

## 2. Configure connection details
1. Copy `.env.example` to `.env`.
2. Set `ORACLE_USER`, `ORACLE_PASSWORD` and `ORACLE_CONNECT_STRING` to match SQL Developer. Use the service name, not the connection label: Oracle XE commonly uses `localhost:1521/XEPDB1`; Oracle Database Free commonly uses `localhost:1521/FREEPDB1`.
3. Set `MONGODB_URI=mongodb://127.0.0.1:27017` for a local MongoDB Community Server. For an authenticated server, use its authenticated URI.
4. Never share or commit `.env`; it contains database credentials.

## 3. Create the Oracle user and schema
If the `SMARTMOVE` database user does not exist yet, first connect in SQL Developer as `SYSTEM` to the **pluggable database service** (usually `XEPDB1` for Oracle XE or `FREEPDB1` for Oracle Database Free), then run `Database/Sql/create_smartmove_user.sql`. Change the example password in that script before executing it. Running `GRANT ... TO SMARTMOVE` before `CREATE USER` will produce `ORA-01917`.

Next create a SQL Developer connection using user `SMARTMOVE`, the password you set, and the same service name. Run `Database/Sql/tables.sql` as `SMARTMOVE` only if the tables have not been created already. The SQL file was corrected to remove a duplicate, invalid passenger foreign-key statement.

If you already created `VEHICLES` using the older script, run this once as the schema owner if your vehicle type column is still `VARCHAR2(10)`:

```sql
ALTER TABLE vehicles MODIFY vehicle_type VARCHAR2(20);
```

The API expects these tables and columns from the SQL file: `VEHICLES`, `DRIVERS`, `ROUTES`, `TRIPS`, `MAINTENANCE`, `PASSENGERS` and `BOOKINGS`. The trips and maintenance tables reference existing routes, vehicles and drivers, so create the parent records before adding trips or maintenance. Oracle prevents deleting records that are still referenced by other records.

## 4. Install and run
From the project root in a terminal:

```bash
npm install
npm start
```

Open `http://localhost:3000`. Do not open `index.html` directly using `file://`; the browser needs the Express API. The API health endpoint is `http://localhost:3000/api/health`, and `http://localhost:3000/api/oracle-test` checks Oracle access.

## 5. Where data is saved
- Vehicles, drivers, routes, trips, maintenance, passengers and bookings are stored in Oracle. Admin forms use GET/POST/PUT/DELETE APIs.
- Passenger reviews, rating, comment and an optional small photo are stored in MongoDB collection `smartmove.passenger_reviews`. Review create/read/update/delete are available through the website/API.
- Refreshing the browser loads saved database records. Demo sample records are not inserted automatically.

## Security note
This is a local coursework prototype. The current frontend role selection is not secure server-side authentication; do not expose the server to the internet or use sensitive production data until real authentication and authorization are implemented.
