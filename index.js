const express = require('express')
const cors = require('cors');
const client = require('ssh2-sftp-client');
const mysql = require('mysql2');
const mqtt = require('mqtt');

const { spawn } = require('child_process');

const app = express()
app.listen(5000, () => {
    console.log('Start server at port 5000.')
})

app.use(express.json());
app.use(cors({
    credentials: true,
    origin: '*'
}));

const mqttClient = mqtt.connect({
    host: '54.179.41.166',
    port: "1883",
    username: 'username',
    password: 'kG0882521310',
    clean: true
});

mqttClient.on('connect', () => {
    console.log('MQTT connected');

    mqttClient.subscribe('TowerMon/#');
});

const db = mysql.createPool({
    host: '54.179.41.166',
    port: '3306',
    user: 'keng',
    password: 'kG0882521310@',
    database: 'tower_iot',
    // connectionLimit: 10, // Adjust according to your needs
    // host: 'localhost',
    // port: '3306',
    // user: 'root',
    // password: '',
    // database: 'tower_iot',
    // connectionLimit: 10, // Adjust according to your needs
});

mqttClient.on('message', (topic, message) => {
    const mqttMessage = message.toString();
    const mqttMessageInsert = JSON.parse(mqttMessage)
    const tableName = topic.replace(/\//g, '_');
    console.log(mqttMessageInsert)
    // if(mqttMessageInsert.rmsX >= 0.3 || mqttMessageInsert.rmsY >= 0.3 || mqttMessageInsert.rmsZ >= 0.3){
    //     db.query(`INSERT INTO ${tableName + '_E'} (rmsx, rmsy, rmsz) VALUES (?, ?, ?)`, [mqttMessageInsert.rmsX.toString(), mqttMessageInsert.rmsY.toString(), mqttMessageInsert.rmsZ.toString()], (error, results, fields) => {
    //         if (error) throw error;

    //         });
    // }else{
        

    // }
    
    // const tableName = topic.replace(/\//g, '_');
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rmsx TEXT,
      rmsy TEXT,
      rmsz TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
    
    db.query(createTableQuery, (error, results, fields) => {
        if (error) throw error;
        // console.log(`Table ${tableName} created or already exists`);

        // Save message to the corresponding table

    });



    const insertMessageQuery = `
    INSERT INTO ${tableName} (rmsx, rmsy, rmsz) VALUES (?, ?, ?)
    `;

    db.query(insertMessageQuery, [mqttMessageInsert.rmsX.toString(), mqttMessageInsert.rmsY.toString(), mqttMessageInsert.rmsZ.toString()], (error, results, fields) => {
        if (error) throw error;

    });
})

app.get('/api/lastData', async (req, res) => {
    try {
        const Darray = [];
        for (let i = 1; i < 6; i++) {
            const selectDataQuery = `SELECT * FROM TowerMon_Device${i} ORDER BY id DESC LIMIT 1`;
            const results = await new Promise((resolve, reject) => {
                db.query(selectDataQuery, (error, results, fields) => {
                    if (error) {
                        console.error(`Error fetching data from table Towermon_Device${i}:`, error);
                        reject(error);
                    } else {
                        resolve(results);
                    }
                });
            });
            const formattedData = results.map(result => ({
                Device: i,
                rmsx: result.rmsx,
                rmsy: result.rmsy,
                rmsz: result.rmsz,
                timestamp: result.timestamp.toLocaleString('en-US', {hour12: false}),
            }));
            Darray.push(...formattedData);
        }
        res.json(Darray);
    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});


app.get('/api/rmsData/:tableName/:date', (req, res) => {


    const {
        tableName,
        date
    } = req.params;


    const selectDataQuery = `
      SELECT * FROM ${tableName} WHERE timestamp BETWEEN '${date.split('T')[0]} 00:00:00' AND '${date.split('T')[0]} 23:59:59';
    `;

    db.query(selectDataQuery, (error, results, fields) => {
        if (error) {
            console.error(`Error fetching data from table ${tableName}:`, error);
            res.status(500).json({
                error: 'Internal Server Error'
            });
            return;
        }
        const formattedData = results.map(result => ({
            rmsx: result.rmsx,
            rmsy: result.rmsy,
            rmsz: result.rmsz,
            timestamp: result.timestamp.toUTCString('en-US'),
        }));

        res.json(formattedData);

    });
});

app.get('/api/file/:deviceName', (req, res) => {
    const {deviceName} = req.params;
    const sftp = new client();
    sftp.connect({
            host: '54.179.41.166',
            port: '22',
            username: deviceName,
            privateKey: require('fs').readFileSync(`ftp_key.pem`),
        }).then(() => {
            return sftp.list(`/home/${deviceName}/data`);
        }).then(data => {
            let namesArray = []; // Declare an empty array to store the names
            for (let i = 0; i < data.length; i++) {
                namesArray.push(data[i].name); // Push each flist[i].name into the array
            }
            res.send(namesArray); // Send the array as response
        })
        .then(() => {
            sftp.end();
        })
        .catch((err) => {
            console.log(err, 'catch error');
        });

})

app.get('/api/data/:deviceName/:fileName', (req, res) => {
    const {deviceName, fileName} =req.params;
    console.log(deviceName)
    console.log(fileName)
    const sftp = new client();
    let results = [];

    sftp.connect({
            host: '54.179.41.166',
            port: '22',
            username: deviceName,
            privateKey: require('fs').readFileSync(`ftp_key.pem`)
        }).then(() => {
            return sftp.get(`/home/${deviceName}/data/${fileName}`);

        }).then(data => {
            const lines = data.toString().split("\n");
            
            for(let i=1;i<lines.length-1;i++){
                if (i === 0) continue;

                const jsonObject = {};
                const values=lines[i].split(",");
          
                for(let j=0;j<values.length;j++){
                    jsonObject[`column_${j+1}`] = values[j].trim();
                }
          
                results.push(jsonObject);
            }

            res.json(results);
        })
        .then(() => {
            sftp.end();
        })
        .catch((err) => {
            console.log(err, 'catch error');
        });

})

app.post('/api/calculate-fft', (req, res) => {
    const data = req.body.data;

    const pythonProcess = spawn('python', ['fft_script.py']);

    let result = '';

    pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error executing Python script: ${data}`);
    });

    pythonProcess.on('close', () => {
        res.send(result);
    });

    pythonProcess.stdin.write(JSON.stringify(data));
    pythonProcess.stdin.end();
});