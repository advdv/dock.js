/* global describe, it, beforeEach, process */
var Docker = require('dockerode');
var url = require('url');
var winston = require('winston');
var sinon = require('sinon');

var stubDockerode = require('./stubs/dockerode');
var Container = require('../lib/container');
var Processes = require('../lib/processes');
var Configuration = require('../lib/configuration');
var errors = require('../lib/errors');

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

    var con = new Container(docker, 'nginx');
    con.should.have.property('docker').and.equal(docker);
    con.should.have.property('id').and.equal(false);
    con.should.have.property('info').and.equal(false);
    con.should.have.property('name').and.equal(false);
    con.should.have.property('created').and.equal(false);
    con.should.have.property('started').and.equal(false);
    con.should.have.property('imageTag').and.equal('nginx');
    con.should.have.property('logger').and.be.instanceOf(winston.Logger);
    con.should.have.property('configuration').and.be.instanceOf(Configuration);
    con.should.have.property('processes').and.be.instanceOf(Processes);

    con = new Container(docker, 'nginx', 'test');
    con.should.have.property('name').and.equal('test');

  });

  describe('.create()', function(){
    var container, container2;
    beforeEach(function(){
      container = new Container(docker, 'phpfpm');
      container2 = new Container(docker, 'nginx', 'myhttp');
    });

    describe('.create() from processes', function(){

      var processes, container3, container4;
      beforeEach(function(){
        processes = new Processes(docker);
        container3 = new Container({docker: docker, imageTag: 'data', name: 'wkmb-data_0', processes: processes});
        container4 = new Container({docker: docker, imageTag: 'mysql', name: 'wkmb-data_0', processes: processes});

        processes.add({
          ID: 'test',
          Name: 'wkmb-data_0',
          Image: 'data'
        });

      });

      it('processes container is created equal', function(done){
        container3.create().then(function(containerId){
          containerId.should.equal('test');

          container3.id.should.equal('test');

          done();
        });
      });

      it('processes container is not created euqal', function(done){
        container4.create().then(function(containerId){

          containerId.should.not.equal('test');
          container4.processes.has('wkmb-data_0').should.equal(false);

          done();
        });
      });

    });



    it('should handle create fails', function(done){      
      container.configuration.creating = {errorMe: true};

      var p = container.create();

      p.catch(errors.ClientError, function(){
        done();
      });

    });

    it('should create container', function(done){
      var conf = {};
      container.configuration.creating = conf;
      var p = container.create();
      p.should.be.instanceOf(Promise);

      p.then(function(containerId){
        
        docker.createContainer.calledOnce.should.equal(true);
        docker.createContainer.calledWith(conf).should.equal(true);

        //test if conf got overwritten
        conf.Image.should.equal('phpfpm');

        containerId.should.be.instanceOf(String);
        container.id.should.equal(containerId);

        done();
      });

    });

    it('should create container with name', function(done){
      var conf = {a: 'b'};
      container2.configuration.creating = conf;
      container2.create().then(function(){

        //test if conf got overwritten
        conf.Image.should.equal('nginx');
        conf.name.should.equal('myhttp');

        done();
      });

    });


  });

  describe('.start()', function(){
    
    var container;
    beforeEach(function(){
      container = new Container(docker, 'phpfpm');
    });

    it('should return promise and call create itself', function(done){
      var createConf = {};
      var startConf = {};

      container.configuration.creating = createConf;
      container.configuration.starting = startConf;

      sinon.spy(container, 'create');
      sinon.spy(container, 'attach');
      var p = container.start();

      p.then(function(info){

        docker.createContainer.calledWith(createConf).should.equal(true);
        docker.startContainer.calledWith(startConf).should.equal(true);

        //return low level info
        container.info.should.not.equal(false);
        info.should.have.property('NetworkSettings');

        //create is called twice, create container once
        container.create.calledOnce.should.equal(true);
        docker.createContainer.calledOnce.should.equal(true);
        docker.getContainer.calledOnce.should.equal(true);

        //attach shouldn't be called
        container.attach.calledOnce.should.equal(false);
        done();
      });

      var p2 = container.start();
      p2.should.equal(p);
      container.started.should.equal(p2);

    });

    it('should also attach when configuration specifies so', function(done){

      container.configuration.attaching.stream = true;

      sinon.spy(container, 'create');
      sinon.spy(container, 'attach');

      container.start().then(function(){
        container.create.calledOnce.should.equal(true);
        container.attach.calledOnce.should.equal(true);
        done();
      });

    });


  });


  describe('.attach()', function(){
    
    var container;
    beforeEach(function(){
      container = new Container(docker, 'phpfpm');
    });

    it('should return promise and call create itself', function(done){      
      var createConf = {};
      var attachConf = {};

      container.configuration.creating = createConf;
      container.configuration.attaching = attachConf;

      sinon.spy(container, 'create');
      var p = container.attach();

      p.should.be.instanceOf(Promise);
      p.then(function(stream){

        stream.should.have.property('on').an.instanceOf(Function);

        container.create.calledOnce.should.equal(true);
        docker.createContainer.calledWith(createConf).should.equal(true);

        done();
      });

    });

    it('should pipe output correctly  to func', function(done){     
      var fn = function(stream) {
        
        stream.on.should.instanceOf(Function);
        done();
      };

      container.pipe(fn);
      container.attach();
    });

    it('should pipe output correctly', function(done){      
      (function(){
        container.pipe('a');
      }).should.throw(/Argument/);

      container.pipe(process.stdout);
      container.attach().then(function(){

        done();
      });
    });

  });


});