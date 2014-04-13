
/* global setTimeout, Buffer */
var sinon = require('sinon');
var Readable = require('stream').Readable;

var StubContainer = require('./dockerode_container.js');
var StubImage = require('./dockerode_image.js');

module.exports = function stubDockerode(docker) {
  'use strict';

  //createContainer
  sinon.stub(docker, "createContainer", function(conf, cb){
    setTimeout(function(){
      if(conf.errorMe === true) {
        cb(new Error('deliberate fail'));
      }

      cb(false, new StubContainer(docker));
    }, Math.floor((Math.random()*20)+1));
  });


  //list all containers
  sinon.stub(docker, "listContainers", function(opts, cb){
    setTimeout(function(){
      cb(false, [ 
        { 
          Command: '/usr/lib/postgresql/9.3/bin/postgres -D /etc/postgresql/9.3/main',
          Created: 1396362124,
          Id: '2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643',
          Image: 'stepshape/wkmb/pgsql:latest',
          Names: [ '/wkmb-sql_0' ],
          Ports: [ [Object] ],
          Status: 'Up 6 seconds'
        },{
          Command: '/usr/sbin/nginx ',
          Created: 1396362103,
          Id: '93b8cb7511bf1dee5be0966b0fa6caf1eb466be1fd7c39ee4b08e667b9b65caf',
          Image: 'stepshape/wkmb/nginx:latest',
          Names: [ '/wkmb-http_0' ],
          Ports: [ [Object] ],
          Status: 'Up 27 seconds' 
        } 
      ]);
    }, Math.floor((Math.random()*20)+1));
  });


  //build image
  sinon.stub(docker, 'buildImage', function(file, conf, cb){
    setTimeout(function(){
      var stream = new Readable();

      if(conf.t === 'failMe:latest') {
        stream.push(new Buffer(JSON.stringify({error: 'test error'})));
      } else if(conf.t === 'statusMe:latest') {
        stream.push(new Buffer(JSON.stringify({status: 'Pulling repository stackbrew/ubuntu'})));
      } else if(conf.t === 'downloadMe:latest') {
        stream.push(new Buffer(JSON.stringify({status: 'Downloading'})));
      } else {
        stream.push(new Buffer('{"stream":"Successfully built 3d65aee0eaea"}'));  
      }
      
      stream.push(null);

      cb(false, stream);
    },Math.floor((Math.random()*20)+1));
  });

  // @todo move to stub container
  docker.startContainer = function(){};
  sinon.stub(docker, 'startContainer', function(conf, cb){
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  });


  //get image
  sinon.stub(docker, 'getImage', function(name){
    var i = new StubImage(name);
    return i;
  });

  //get Container
  sinon.stub(docker, "getContainer", function(id){
    
    var c = new StubContainer(id);

    c.start = docker.startContainer;

    return c;
  });


  return docker;
};