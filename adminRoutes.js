const express = require("express");
const statusCodes = require('./StatusCodes');
const router = express.Router();

function buildRoutes(connectionPool) {
    router.use((req, res, next) => {
        const key = req?.body?.key;

        if (process.env.ADMIN_KEY === undefined) {
            return next();
        } else if (key === undefined) {
            return res.status(401).json({status: statusCodes.MISSING_KEY, message: 'Missing key.'});
        } else if (key === process.env.ADMIN_KEY) {
            return next();
        } else {
            return res.status(401).json({status: statusCodes.INVALID_KEY, message: 'Invalid key.'});
        }
    });

    router.post('/surveillance', (req, res) => {
        const data = req.body;
        const type = data?.type;
        const week = data?.week;
        const year = data?.year;
        const responsible = data?.responsible;

        const missingProperties = [];

        if (type === undefined) {
            missingProperties.push('type');
        }
        if (week === undefined) {
            missingProperties.push('week');
        }
        if (year === undefined) {
            missingProperties.push('year');
        }
        if (responsible === undefined) {
            missingProperties.push('responsible');
        }

        if (missingProperties.length > 0) {
            return res.status(400).json({status: statusCodes.MISSING_PROPERTY, missingProperties});
        }

        if (type !== 'MDM' && type !== 'EDI') {
            return res.status(400).json({
                status: statusCodes.INVALID_TYPE,
                message: 'Invalid value for property `type`. Expected `MDM` or `EDI`.',
            });
        }
        const weekNum = parseInt(week);
        if (isNaN(weekNum) || weekNum <= 0 || weekNum > 52) {
            return res.status(400).json({
                status: statusCodes.INVALID_TYPE,
                message: 'Invalid value for property `weekNum`. Expected integer 0 <= n <= 52.',
            });
        }
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum <= 0 || yearNum > 3000) {
            return res.status(400).json({
                status: statusCodes.INVALID_TYPE,
                message: 'Invalid value for property `weekNum`. Expected integer 0 <= n <= 3000.',
            });
        }

        connectionPool.query('INSERT INTO surveillance SET `type` = ?, `year` = ?, `week` = ?, `responsible` = ?', [type, yearNum, weekNum, responsible], function (error, results) {
            if (error) {
                return res.status(500).json({status: statusCodes.SERVER_ERROR, message: error.message});
            }

            console.log(results);

            return res.status(200).json(results);
        });
    });

    return router;
}

module.exports = buildRoutes;