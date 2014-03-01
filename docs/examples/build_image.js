/* jshint strict: false */
var Dock = require('../../index.js'); // --> npm install dock.js
var Docker = require('dockerode'); // --> npm install dockerode
var winston = require('winston'); // --> npm install winston

var client = new Docker({host: 'http://172.12.8.150', port: 4243});

var image = new Dock.Image(client, __dirname + '/sandbox', 'sandbox:0.3', {nocache: true});
var dock = new Dock(client);

dock.logger.add(winston.transports.Console, {colorize: true}); 
image.logger.add(winston.transports.Console, {colorize: true}); 

dock.service('src', [], 'sandbox:0.3', {Cmd: 'pwd'});

image.build();