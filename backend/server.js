import express from "express";
import cors from "cors";
import mysql from "mysql2";

const app = express();
app.use(cors({
    origin: "http://127.0.0.1:3000",
    credentials: true,
}));
app.use(express.json());

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'institute',
    password: 'ins1234',
});
connection.connect(err => {
    if (err) throw err;
    console.log('Connected to the MySQL server.');
});

app.post('/api/createdb', (req, res) => {
    const { dbName } = req.body;
    if (!dbName || typeof dbName !== 'string') {
        res.status(400).send('Invalid database name');
        return;
    }
    const sql = `CREATE DATABASE ${mysql.escapeId(dbName)}`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Error creating database');
            return;
        }
        res.json({ results, success: true });
    });
});

app.get('/api/fetchdbs', (req, res) => {
    connection.query("SHOW DATABASES", (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Error fetching database');
            return;
        }
        const databaseNames = results.map(row => row.Database);
        ["mysql", "information_schema", "performance_schema", "sys"].forEach((item) => {
            databaseNames.splice(databaseNames.indexOf(item), 1);
        });
        res.json({ databaseNames, success: true });
    });
});

app.post('/api/fetchtnames', (req, res) => {
    const { dbName } = req.body;
    if (!dbName || typeof dbName !== 'string') {
        res.status(400).send('Invalid database name');
        return;
    }
    const query = `
        SELECT TABLE_NAME AS table_name
        FROM information_schema.tables
        WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
    `;
    connection.query(query, [dbName], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Error fetching table names');
            return;
        }
        const tableNames = results.map(row => row.table_name);
        res.json({ tableNames, success: true });
    });
});


const port = 8000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});