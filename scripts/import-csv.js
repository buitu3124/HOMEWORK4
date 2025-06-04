const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const iconv = require('iconv-lite');
const csv = require('csv-parser');

const db = new sqlite3.Database('./db/database.db');

// Create table
db.run(`
    CREATE TABLE IF NOT EXISTS air_quality (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        StationCode TEXT,
        StationName TEXT,
        MonitoringDate TEXT,
        TestCode TEXT,
        TestItemName TEXT,
        TestItemEnglishName TEXT,
        Unit TEXT,
        Value REAL
    )
`);

const file = path.join(__dirname, '../空氣品質指標.csv');
const rows = [];

fs.createReadStream(file)
    .pipe(iconv.decodeStream('big5'))
    .pipe(csv())
    .on('data', row => {
        rows.push({
            StationCode: row['測站代碼'],
            StationName: row['測站名稱'],
            MonitoringDate: row['監測日期'].replace(/\//g, '-'),
            TestCode: row['測項代碼'],
            TestItemName: row['測項名稱'],
            TestItemEnglishName: row['測項英文名稱'],
            Unit: row['測項單位'],
            Value: row['數值'] === '' ? null : parseFloat(row['數值']),
        });
    })
    .on('end', () => {
        const stmt = db.prepare(`
            INSERT INTO air_quality (
                StationCode, StationName, MonitoringDate,
                TestCode, TestItemName, TestItemEnglishName,
                Unit, Value
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        rows.forEach(r => {
            stmt.run([
                r.StationCode, r.StationName, r.MonitoringDate,
                r.TestCode, r.TestItemName, r.TestItemEnglishName,
                r.Unit, r.Value
            ]);
        });

        stmt.finalize(() => {
            db.close();
            console.log(`✅ Imported ${rows.length} records into air_quality`);
        });
    });
