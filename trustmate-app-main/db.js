const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: 'c372-003.mysql.database.azure.com',
    user: 'c372003',
    password: 'RepublicPoly2026',
    database: 'C372_003_Team5',
    port: 3306,
    ssl: {
        rejectUnauthorized: true
    }
});

module.exports = db;
