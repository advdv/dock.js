
/* global setTimeout, Buffer */
var sinon = require('sinon');
var crypto = require('crypto');
var Readable = require('stream').Readable;

module.exports =function stubDockerode(docker) {
  'use strict';

  //createContainer
  sinon.stub(docker, "createContainer", function(conf, cb){
    setTimeout(function(){
      if(conf.errorMe === true) {
        cb(new Error('deliberate fail'));
      }

      cb(false, {id: crypto.randomBytes(20).toString('hex')});
    }, Math.floor((Math.random()*20)+1));
  });


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

  docker.startContainer = function(){};
  docker.inspectContainer = function(){};

  sinon.stub(docker, 'startContainer', function(conf, cb){
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  });


  sinon.stub(docker, 'inspectContainer', function(cb){
    setTimeout(function(){
      cb(false, {
        "NetworkSettings": {
          "IpAddress": "",
          "IpPrefixLen": 0,
          "Gateway": "",
          "Bridge": "",
          "PortMapping": null
        },
      });
    },Math.floor((Math.random()*20)+1));
  });


  //getContainer
  sinon.stub(docker, "getContainer", function(id){
    return {
      id: id,
      start: docker.startContainer,
      inspect: docker.inspectContainer
    };
  });


  return docker;
};