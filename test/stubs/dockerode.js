/* global setTimeout */
var sinon = require('sinon');
var crypto = require('crypto');

module.exports =function stubDockerode(docker) {
  'use strict';

  //createContainer
  sinon.stub(docker, "createContainer", function(conf, cb){
    setTimeout(function(){
      cb(false, {id: crypto.randomBytes(20).toString('hex')});
    }, Math.floor((Math.random()*20)+1));
  });

  docker.startContainer = function(){};
  docker.inspectContainer = function(){};

  sinon.stub(docker, 'startContainer', function(conf, cb){
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*100)+1));
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