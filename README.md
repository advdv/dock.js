dock.js
=======

[![Build Status](https://travis-ci.org/advanderveer/dock.js.png)](https://travis-ci.org/advanderveer/dock.js)
[![Dependency Status](https://david-dm.org/advanderveer/dock.js.png)](https://david-dm.org/advanderveer/dock.js)
[![NPM version](https://badge.fury.io/js/dock.js.png)](http://badge.fury.io/js/dock.js)

An easy-to-use Promise based Node.js module that orchestrates Docker containers and handles interdependencies for you. It aims to keep an minimal feature set and instead focusses on stability and usability, a more extensive altertive is offered by [decking](http://decking.io/)

Introduction
------------

Docker has introduced an whole new way of looking at the server architecture of our applications. I won't go in full detail because a much better introduction can be found on the [docker.io website](https://www.docker.io/learn_more/) but Docker allows us to have individual processes (e.g nginx, mysql, mongdb) isolated in their own container (a lightweight virtual server) making them extremely portable. As an web application might require several different processes and additional "data-only" containers for persisting data, launching all these containers consistently becomes a hassle very quickly. Dock.js aims to solve this by providing a fluent high-level Object-Oriented interface for the Docker Remote Api that introduces the notion of "Services" and solving the dependencies between them.

Example
--------

A basic php web application might require several processes: a http server (dockerfile/nginx:latest), some php (scstest/php-fpm:latest) workers and a database (paintedfox/postgresql:latest). In addition, logs and data need be persistent in their own container through the use of volumes (busybox:latest). The source code of our application is kept seperate from the process (containers) and thus requires a seperate container as well (busybox:latest). 

[wip explain services]

Dock.js allows us to easily specify services and their dependencies:

```JavaScript
var Docker = require('dockerode'); // --> npm install dockerode
var Dock = require('dock.js'); // --> npm install dock.js

//create the docker server using dockerocde
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
var data = new Dock.Service(server, [php, http, sql], 'busybox:latest');

```
	



