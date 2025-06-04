const express = require('express'); // Ensure you're requiring express
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const cors = require('cors');

const app = express();  // Initialize express correctly
const PORT = process.env.PORT || 3000;  // Set port as either the environment variable or 3000
const CSV_FILE = path.join(__dirname, '空氣品質監測.csv'); // Correct path to your CSV file

let rows = [];

function parseDate(str) {
    return new Date(str);
}

// Function to load the CSV data
function loadCsv() {
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_FILE)
            .pipe(iconv.decodeStream('utf8')) // Decode if file encoding is not UTF-8
            .pipe(csv({ headers: ['StationCode', 'StationName', 'MonitoringTime', 'TestCode', 'TestName', 'TestEngName', 'Unit', 'Value'], skipLines: 0 }))
            .on('data', row => {
                if (row.StationName && row.MonitoringTime && row.TestName && row.Value) {
                    rows.push({
                        stationCode: row.StationCode,
                        stationName: row.StationName,
                        monitoringTime: row.MonitoringTime,
                        testCode: row.TestCode,
                        testName: row.TestName,
                        testEngName: row.TestEngName,
                        unit: row.Unit,
                        value: row.Value
                    });
                }
            })
            .on('end', () => {
                console.log(`Loaded ${rows.length} rows from CSV.`);
                resolve();  // Resolve when the CSV is completely loaded
            })
            .on('error', reject);  // Reject if an error occurs during reading
    });
}

// Middleware to handle CORS and serve static files
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to fetch data from the CSV file
app.get('/api/data', (req, res) => {
    const { station, from, to, type } = req.query;
    let filtered = rows;

    // Filter by station name
    if (station) {
        filtered = filtered.filter(r => r.stationName === station);
    }

    // Filter by type (testName)
    if (type) {
        filtered = filtered.filter(r => r.testName === type);
    }

    // Filter by date range (inclusive, by date only)
    if (from) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => {
            const rowDate = new Date(r.monitoringTime);
            rowDate.setHours(0, 0, 0, 0);
            return rowDate >= fromDate;
        });
    }

    if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => {
            const rowDate = new Date(r.monitoringTime);
            rowDate.setHours(0, 0, 0, 0);
            return rowDate <= toDate;
        });
    }

    res.json(filtered);
});

// Endpoint to get unique stations
app.get('/api/stations', (req, res) => {
    const stations = [...new Set(rows.map(row => row.stationName))]; // Get unique stations
    res.json(stations);
});

// Endpoint to get unique types (測項名稱)
app.get('/api/types', (req, res) => {
    const types = [...new Set(rows.map(row => row.testName))]; // Get unique test names
    res.json(types);
});

// Load the CSV and then export the app for use in bin/www
loadCsv()
    .then(() => {
        console.log('CSV loaded.');
    })
    .catch((err) => {
        console.error('Error loading CSV:', err);
    });

module.exports = app;
