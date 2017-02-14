'use strict';

const Influx = require('influx');
const nzbget = require('node-nzbget');
const chalk = require('chalk');

const checkInterval = process.env.UPDATE_INTERVAL_MS || 1000 * 30;

const influxClient = new Influx.InfluxDB({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'nzbget'
});

const nzbgetConfig = {
    host: process.env.NZBGET_HOST || 'localhost',
    protocol: process.env.NZBGET_PROTOCOL ||'http',
    port: process.env.NZBGET_PORT || 6789,
    username: process.env.NZBGET_PASSWORD || '',
    password: process.env.NZBGET_PASSWORD || ''
};

function log(message, color) {
    color = color || 'black';
    console.log(chalk[color](message));
}

function writeToInflux(seriesName, values, tags) {
    let payload = {
        fields: values
    };

    if (tags) {
        payload.tags = tags;
    }

    return influxClient.writeMeasurement(seriesName, [payload]);
}

const ng = new nzbget({
    url: `${nzbgetConfig.host}:${nzbgetConfig.port}`,
    username: nzbgetConfig.username,
    password: nzbgetConfig.password
});

function onGetNZBData(data) {
    let nzbs = data.result;

    nzbs.forEach(function(nzb) {
        let value = {
            name: nzb.NZBName,
            size: nzb.FileSizeLo
        };
        let tags = {
            status: nzb.Status,
            category: nzb.Category
        };

        writeToInflux('nzb', value, tags).then(function() {
            log(`wrote ${nzb.NZBName} nzb data to influx: ${new Date()}`, 'blue');
        });
    });

    writeToInflux('nzbs', {
        count: nzbs.length
    }, null).then(function() {
        log(`wrote ${nzbs.length} nzb data to influx: ${new Date()}`, 'blue');
        restart();
    });
}

function restart() {
    log(`${new Date()}: fetching nzbget metrics`, 'green');

    // Every {checkInterval} seconds
    setTimeout(getAllTheMetrics, checkInterval);
}

function getAllTheMetrics() {
    ng.listgroups().then(onGetNZBData).catch(restart);
}

getAllTheMetrics();
