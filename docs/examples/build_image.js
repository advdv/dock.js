/* jshint strict: false */
var Dock = require('../../index.js'); // --> npm install dock.js
var Docker = require('dockerode'); // --> npm install dockerode
var winston = require('winston'); // --> npm install winston

//create client
var client = new Docker({host: 'http://172.12.8.150', port: 4243});

//create api
var dock = new Dock(client);

//display logging in console
dock.logger.add(winston.transports.Console, {colorize: true}); 
 
//define images
dock.image('sandbox:0.3', __dirname + '/sandbox', {nocache: true});

//define services
dock.service('src', [], 'sandbox:0.3', {Cmd: 'pwd'});

//build then start
dock.build()
    .then(dock.start)
    .catch(function(err){
      dock.logger.error(err.message);
    });