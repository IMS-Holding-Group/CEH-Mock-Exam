const mysql = require('mysql2/promise');
const config = require('./config');

let pool = null;

async function getPool() {
    if (!pool) {
        pool = mysql.createPool(config.db);
    }
    return pool;
}

async function query(sql, params) {
    const db = await getPool();
    const [rows] = await db.execute(sql, params || []);
    return rows;
}

module.exports = { getPool, query };
