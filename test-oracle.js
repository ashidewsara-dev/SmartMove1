
require("dotenv").config();
const oracledb = require("oracledb");

async function testOracle() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    const result = await connection.execute(
      "SELECT USER AS CURRENT_USER, SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS SERVICE_NAME FROM dual"
    );

    console.log("Oracle connected successfully!");
    console.log(result.rows);
  } catch (error) {
    console.error("Oracle connection failed:", error.message);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

testOracle();
