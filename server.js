const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const foodAndCo = require('./foodandco');
const domicilPhotos = require('./domicilPhotos');
const currentWeekNumber = require('current-week-number');
const DBMigrate = require('db-migrate');
const adminRoutes = require('./adminRoutes');
const {promises: fs} = require('fs');

const dbMigrate = DBMigrate.getInstance(true);
dbMigrate.up(() => {
    console.log('ran migrations, starting app...');
    run();
});

function run() {

    const app = express();

    const connectionPool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DATABASE,
        connectionLimit: 4,
    });

    // connectionPool.connect(function (err) {
    //     if (err) throw err;
    //     console.log('MYSQL Connected.');
    // });

    connectionPool.on('connection', function (connection) {
        console.log('DB Connection established');

        connection.on('error', function (err) {
            console.error(new Date(), 'MySQL error', err.code);
        });
        connection.on('close', function (err) {
            console.error(new Date(), 'MySQL close', err);
        });
    });

    foodAndCo(connectionPool);
    domicilPhotos();

    const corsOptions = {
        // origin: ['https://dash-cl.jeppevinkel.com', 'http://localhost:3000'],

    };

    app.use(cors(corsOptions));
    app.use(express.json());

    app.use('/images/domicil/latest', async (req, res) => {
        const files = await fs.readdir('./images/domicil', {withFileTypes: true});

        files.sort((a, b) => {
            const nameA = a.name.toUpperCase(); // ignore upper and lowercase
            const nameB = b.name.toUpperCase(); // ignore upper and lowercase
            if (nameA < nameB) {
                return 1;
            }
            if (nameA > nameB) {
                return -1;
            }

            // names must be equal
            return 0;
        })

        return res.redirect(`${process.env.PUBLIC_ADDRESS}/images/domicil/${files[0].name}`);
    });

    app.use('/images', express.static('images'));

    app.get('/menu', async (req, res) => {
        connectionPool.query('SELECT * FROM menus LEFT OUTER JOIN images ON menus.date = images.menu_date WHERE menus.date >= CURDATE() ORDER BY date ASC', function (error, results) {
            if (error) return;

            console.log('Found', results.length, 'menus');

            const menu = results.map(it => {
                return {
                    date: it.date,
                    day: it.day,
                    foodName: it.food_name,
                    correctedFoodName: it.corrected_food_name,
                    foodDescription: it.food_description,
                    foodContents: JSON.parse(it.food_contents) ?? [],
                    weekNumber: it.week_number,
                    image: it.menu_date !== null ? {
                        path: `${process.env.PUBLIC_ADDRESS}/images/${it.path}`,
                        prompt: it.prompt,
                        revisedPrompt: it.revised_prompt,
                    } : null,
                };
            });

            return res.json({menu});
        });
    });

    app.get('/surveillance', (req, res) => {
        connectionPool.query('SELECT * FROM surveillance WHERE week >= ?', [currentWeekNumber(undefined)], function (error, results) {
            if (error) throw error;

            const returnObject = results.reduce((accumulative, current) => {
                let key = current['type'];
                if (!accumulative[key]) {
                    accumulative[key] = [];
                }
                accumulative[key].push(current);
                return accumulative;
            }, {});

            return res.json(returnObject);
        });
    });

    app.get('/chartest', (req, res) => {
        return res.json({
            text: 'ae => æ, oe => ø, aa => å'
        });
    })

    app.use(adminRoutes(connectionPool));

    app.listen(8000, () => {
        console.log(`Server is running on port 8000.`);
    });

    app.once('closed', () => {
        connectionPool.end();
    });
}