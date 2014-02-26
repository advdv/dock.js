/* global describe, it, beforeEach */
var Docker = require('dockerode');
var url = require('url');
var winston = require('winston');
var stubDockerode = require('./stubs/dockerode');
var Container = require('../lib/container');
var sinon = require('sinon');

//promise should always throw
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    'use strict';
    throw error;
  });

describe('Container()', function(){
  'use strict';

  var docker;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');
    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
  });

  it('should construct as expected', function(){
    var conf1 = {};

    var con = new Container(docker, 'nginx');
    con.should.have.property('docker').and.equal(docker);
    con.should.have.property('id').and.equal(false);
    con.should.have.property('info').and.equal(false);
    con.should.have.property('created').and.equal(false);
    con.should.have.property('started').and.equal(false);
    con.should.have.property('imageTag').and.equal('nginx');
    con.should.have.property('createConf').and.eql({Image: 'nginx'});
    con.should.have.property('logger').and.be.instanceOf(winston.Logger);

    con = new Container(docker, 'nginx', conf1);
    con.should.have.property('createConf').and.equal(conf1);
    conf1.should.eql({Image: 'nginx'});

  });

  describe('.create()', function(){
    var container;
    beforeEach(function(){
      container = new Container(docker, 'phpfpm');
    });

    it('should create container', function(done){
      var p = container.create();
      p.should.be.instanceOf(Promise);

      p.then(function(containerId){
        containerId.should.be.instanceOf(String);
        container.id.should.equal(containerId);

        done();
      });

      var p2 = container.create();
      p2.should.equal(p);
    });
  });

  describe('.start()', function(){
    
    var container;
    beforeEach(function(){
      container = new Container(docker, 'phpfpm');
    });

    it('should return promise and call create itself', function(done){
      sinon.spy(container, 'create');

      container.create();
      var p = container.start();

      p.then(function(info){

        //return low level info
        container.info.should.not.equal(false);
        info.should.have.property('NetworkSettings');

        //create is called twice, create container once
        container.create.calledTwice.should.equal(true);
        docker.createContainer.calledOnce.should.equal(true);
        docker.getContainer.calledOnce.should.equal(true);
        done();
      });

      var p2 = container.start();
      p2.should.equal(p);
      container.started.should.equal(p2);

    });

  });

});