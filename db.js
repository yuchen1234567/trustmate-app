const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '000000',
    database: process.env.DB_NAME || 'c372_003_team5',
    port: 3306
});

module.exports = db;
