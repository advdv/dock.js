dock.js
=======

[![Build Status](https://travis-ci.org/advanderveer/dock.js.png)](https://travis-ci.org/advanderveer/dock.js)
[![Dependency Status](https://david-dm.org/advanderveer/dock.js.png)](https://david-dm.org/advanderveer/dock.js)
[![NPM version](https://badge.fury.io/js/dock.js.png)](http://badge.fury.io/js/dock.js)

An easy-to-use Promise based Node.js module that orchestrates Docker containers and handles interdependencies for you. It aims to keep a minimal feature set and instead focusses on stability and usability, a more extensive alternative is offered by [decking](http://decking.io/)

Introduction
------------

Docker has introduced an whole new way of looking at the server architecture of our applications. I won't go in full detail because a much better introduction can be found on the [docker.io website](https://www.docker.io/learn_more/) but Docker allows us to have individual processes (e.g nginx, mysql, mongdb) isolated in their own container (a lightweight virtual server) making them extremely portable. As an web application might require several different processes plus additional "data-only" containers for persisting data, launching all these containers consistently becomes a hassle very quickly. Dock.js aims to solve this by providing a fluent high-level Object-Oriented interface for the Docker Remote Api that introduces the notion of "Services" and solving the dependencies between them.

Example
--------

A basic php web application might require several processes: a http server (dockerfile/nginx:latest), some php (scstest/php-fpm:latest) workers and a database (paintedfox/postgresql:latest). In addition, logs and data need be persisted in their own container (busybox:latest) through the use of volumes. The source code of our application is kept seperate from the process (containers) and thus requires a seperate container as well (busybox:latest). 

Dock.js introduces "services" which can be thought of as modules. They can specify dependencies to other services and group docker containers with a common purpose. Each container in the service is started with the same options (e.i the same run command) and are started only when the containers of dependant services are up and running. One could group several database process (master/slave) but single container are also quiet common.

Using services, Dock.js allows us to specify the above example as follows:

```JavaScript
var Docker = require('dockerode'); // --> npm install dockerode
var Dock = require('dock.js'); // --> npm install dock.js

//create the docker server using dockerode
var server = new Docker({host: 'http://172.12.8.150', port: 4243});

//create a service with a single container for our source code
var src = new Dock.Service(server, [])
                .container('busybox:latest');

//the php service is dependant on the source code and runs several containers
var php = new Dock.Service(server, [src])
                .container('scstest/php-fpm:latest')
                .container('scstest/php-fpm:latest')
                .container('scstest/php-fpm:latest');

//nginx container that delegates php scripts to the php container
var http = new Dock.Service(server, [src, php])
                .container('dockerfile/nginx:latest');

//spawn two database processes
var sql = new Dock.Service(server, [])
                .container('paintedfox/postgresql:latest')
                .container('paintedfox/postgresql:latest');


//create a single container service responsible for persisting logs and data of the other services
// NOTE: this uses the shorthand notation, single container services can be quiet common...
var data = new Dock.Service(server, [php, http, sql], 'busybox:latest');

```

All services can now be started easily:

```JavaScript
//the Service.start() function returns a promise that fulfills when 
//all containers of this server and their depedant services are running.
data.start().then(function(){  
	  console.log('Services started...');
	}).catch(function(err){
	  console.error('something went wrong...' + err)
	})
```

