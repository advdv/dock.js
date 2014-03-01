/* jshint strict: false */
var Dock = require('../../index.js'); // --> npm install dock.js
var Docker = require('dockerode'); // --> npm install dockerode
var winston = require('winston'); // --> npm install winston

//create the docker server using dockerocde
var server = new Docker({host: 'http://172.12.8.150', port: 4243});

//create a new dock
var dock = new Dock(server);

//add a winston console transport
dock.logger.add(winston.transports.Console, {colorize: true}); 

//create services
dock.service('data', [], 'busybox:latest');

dock.start();