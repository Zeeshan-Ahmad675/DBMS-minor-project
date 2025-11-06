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

app.post('/api/usedb', (req, res) => {
    const { dbName } = req.body;
    connection.query(`USE ${dbName}`, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).send('Error connecting to database');
            return;
        }
        res.json({ success: true });
    });
})

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
        (async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/usedb', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dbName }),
                });
                const remoteResult = await response.json().catch(() => null);
                res.json({ tableNames, success: remoteResult.success });
            } catch (err) {
                console.error('Error calling downstream API:', err);
                res.json({ tableNames, success: false, apiError: String(err) });
            }
        })();
        // res.json({ tableNames, success: true });
    });
});

app.post('/api/createtable', (req, res) => {
    const {tName, fields} = req.body;
    if (!tName || typeof tName !== 'string') {
        res.status(400).send('Invalid database name');
        return;
    }
    if (!Array.isArray(fields) || fields.length === 0) {
        res.status(400).send('Invalid fields array');
        return;
    }

    // helper to safely escape qualified identifiers like "db.table" or "db.table.column"
    const escapeQualifiedId = (ident) => {
        if (typeof ident !== 'string') return '';
        const parts = ident.split('.');
        return parts.map(p => mysql.escapeId(p)).join('.');
    };

    const columnDefinitions = fields.map((field) => {
        if (typeof field === 'string') {
            return field;
        }
        const name = escapeQualifiedId(field.name);
        const type = field.type ? String(field.type) : 'VARCHAR(255)';
        // const nullable = field.nullable === false ? 'NOT NULL' : '';
        // const autoInc = field.autoIncrement ? 'AUTO_INCREMENT' : '';
        // const primary = field.primary ? 'PRIMARY KEY' : '';
        // const defaultClause = field.default !== undefined ? 'DEFAULT ' + mysql.escape(field.default) : '';

        return [name, type].filter(Boolean).join(' ').trim();
    }).join(', ');

    const query = `CREATE TABLE ${escapeQualifiedId(tName)} (
        ${columnDefinitions}
    )`;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error creating table:', err);
            res.status(500).send('Error creating table');
            return;
        }
        res.json({ results, success: true });
    });
});


const port = 8000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Get columns for a table
app.get('/api/columns', (req, res) => {
    const table = req.query.table;
    if (!table || typeof table !== 'string') {
        res.status(400).send('Invalid table name');
        return;
    }
    const sql = `SHOW COLUMNS FROM ${mysql.escapeId(table)}`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching columns:', err);
            res.status(500).send('Error fetching columns');
            return;
        }
        res.json({ columns: results, success: true });
    });
});

// Read rows from a table
app.get('/api/rows', (req, res) => {
    const table = req.query.table;
    if (!table || typeof table !== 'string') {
        res.status(400).send('Invalid table name');
        return;
    }
    const sql = `SELECT * FROM ${mysql.escapeId(table)}`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching rows:', err);
            res.status(500).send('Error fetching rows');
            return;
        }
        res.json({ rows: results, success: true });
    });
});

// Create a new row
app.post('/api/rows', (req, res) => {
    const { table, data } = req.body;
    if (!table || typeof table !== 'string' || typeof data !== 'object') {
        res.status(400).send('Invalid input');
        return;
    }
    const keys = Object.keys(data);
    if (keys.length === 0) {
        res.status(400).send('No data provided');
        return;
    }
    const cols = keys.map(k => mysql.escapeId(k)).join(', ');
    const placeholders = keys.map(_ => '?').join(', ');
    const values = keys.map(k => data[k]);
    const sql = `INSERT INTO ${mysql.escapeId(table)} (${cols}) VALUES (${placeholders})`;
    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error inserting row:', err);
            res.status(500).send('Error inserting row');
            return;
        }
        res.json({ insertId: results.insertId, success: true });
    });
});

// Update a row by id (assumes primary key column is named `id`)
app.put('/api/rows/:id', (req, res) => {
    const id = req.params.id;
    const { table, data } = req.body;
    if (!table || typeof table !== 'string' || typeof data !== 'object') {
        res.status(400).send('Invalid input');
        return;
    }
    const keys = Object.keys(data);
    if (keys.length === 0) {
        res.status(400).send('No data provided');
        return;
    }
    const setClause = keys.map(k => `${mysql.escapeId(k)} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    values.push(id);
    const sql = `UPDATE ${mysql.escapeId(table)} SET ${setClause} WHERE id = ?`;
    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error updating row:', err);
            res.status(500).send('Error updating row');
            return;
        }
        res.json({ affectedRows: results.affectedRows, success: true });
    });
});

// Delete a row by id (table passed as query param)
app.delete('/api/rows/:id', (req, res) => {
    const id = req.params.id;
    const table = req.query.table;
    if (!table || typeof table !== 'string') {
        res.status(400).send('Invalid table name');
        return;
    }
    const sql = `DELETE FROM ${mysql.escapeId(table)} WHERE id = ?`;
    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error deleting row:', err);
            res.status(500).send('Error deleting row');
            return;
        }
        res.json({ affectedRows: results.affectedRows, success: true });
    });
});
