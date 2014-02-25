/* global describe, it, beforeEach */
var url = require('url');
var stubDockerode = require('./stubs/dockerode');

var Docker = require('dockerode');
var sinon = require('sinon');

var Service = require('../lib/service');
var Container = require('../lib/container');

//promise should always throw
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    'use strict';
    throw error;
  });

describe('Service()', function(){
  'use strict';

  var docker, service;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');
    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
    service = new Service(docker);
  });

  it('should construct as expected', function(){
    var s = new Service(docker);

    s.should.have.property('instantiate').and.be.instanceOf(Function);
    s.should.have.property('container').and.be.instanceOf(Function);
    s.should.have.property('add').and.be.instanceOf(Function);

    s.should.have.property('configurationFn').and.be.instanceOf(Function);
    s.should.have.property('instantiated').and.equal(false);
    s.should.have.property('started').and.equal(false);
    s.should.have.property('docker').and.equal(docker);
    s.should.have.property('containers').and.eql([]);

    var dep2 = {};
    var dep = function(){ return dep2; };
    var dep1 = {};
    var s2 = new Service(docker, [dep1, dep], 'stepshape/nginx:latest');
    s2.containers.length.should.equal(1);

    s2.dependencies[0].should.equal(dep1);
    s2.dependencies[1].should.equal(dep2);
  });

  describe('.requires()', function(){
    it('should add an dependency', function(){

      var dep1 = {};
      var s = service.requires(dep1);
      s.should.equal(service);
      service.requires(function(){ return dep1; });
      service.dependencies[0].should.equal(dep1);
      service.dependencies[1].should.equal(dep1);
    });
  });

  describe('.add()', function(){
    it('should add containers correctly', function(){
      var c = {tag: 'phpfpm'};

      service.add(c);
      service.containers.length.should.equal(1);
    });
  });

  describe('.container()', function(){
    it('should add containers correctly', function(){

      var s = service.container('stepshape/nginx');
      service.containers[0].should.be.an.instanceOf(Container);
      s.should.equal(service);

    });
  });

  describe('.create()', function(){
    it('should create its dependencies first', function(done){

      var dep1 = new Service(docker);
      sinon.spy(dep1, 'instantiate');

      var c1 = new Container(docker, 'nginx');
      sinon.spy(c1, 'create');

      var c2 = new Container(docker, 'nginx');
      sinon.spy(c2, 'create');

      service.requires(dep1);
      service.add(c1);
      service.add(c2);

      var p = service.instantiate();
      p.should.equal(service.instantiated);

      p.should.be.an.instanceOf(Promise);
      dep1.instantiate.calledOnce.should.equal(true);
      dep1.instantiate.calledBefore(c1.create);

      c1.create.calledOnce.should.equal(true);
      c2.create.calledOnce.should.equal(true);
      c1.create.calledBefore(c2.create);
      p.then(function(){
        done();
      });

      //double instantiate should reuse promise and not call containers again
      var p2 = service.instantiate();
      p2.should.equal(p);
      c1.create.calledOnce.should.equal(true);

    });

    describe('.configure()', function(){
      it('should return the service and set function', function(){
        var fn = function(){};
        service.configure(fn).should.equal(service);
        service.configurationFn.should.equal(fn);
      });
    });

    describe('.start()', function(){
      it('should return promise', function(){
        var p = service.start();
        p.should.be.instanceOf(Promise);

        var p2 = service.start();
        p2.should.equal(p);
      });

      it('should throw on invalid configurationFn', function(done){
        
        var fn = function(){
          //invalid because it returns nothing
        };

        service.configurationFn = fn;
        sinon.spy(service, 'configurationFn');

        var c1 = new Container(docker, 'nginx');
        sinon.spy(c1, 'start');
        service.add(c1);

        service.start().catch(function(err){

          err.message.match(/configuration function/).should.not.equal(null);
          service.configurationFn.calledOnce.should.equal(true);

          done();
        });


      });

      it('should use configurationFn', function(done){
          
        var dep1 = new Service(docker);
        var fn = function(con, d1){
          con.should.be.instanceOf(Container);
          d1.should.equal(dep1);
          d1.started.isFulfilled().should.equal(true);
          con.id.should.equal(false); //not yet created
          con.info.should.equal(false); //not yet started

          return {
            //valid
          };
        };

        service.configurationFn = fn;
        sinon.spy(service, 'configurationFn');
        var c1 = new Container(docker, 'nginx');
        sinon.spy(c1, 'start');
        service.add(c1);
        service.requires(dep1);

        service.start().then(function(){
          service.configurationFn.calledOnce.should.equal(true);
          done();
        });
      });


      it('should start dependencies first', function(done){
        
        var dep1 = new Service(docker);
        sinon.spy(dep1, 'start');

        var c1 = new Container(docker, 'nginx');
        sinon.spy(c1, 'start');

        var c2 = new Container(docker, 'nginx');
        sinon.spy(c2, 'start');

        service.requires(dep1);
        service.add(c1);
        service.add(c2);

        service.start().then(function(){
          dep1.start.calledOnce.should.equal(true);
          dep1.start.calledBefore(c1.start);
    
          c1.start.calledOnce.should.equal(true);
          c2.start.calledOnce.should.equal(true);

          docker.startContainer.calledTwice.should.equal(true);
          done();
        });

      });
    });


    it('should create/start correctly in complicated examples', function(done){
      var conf = new Service(docker, [], 'busybox:latest');
      var src = new Service(docker, [], 'busybox:latest');

      var php = new Service(docker, [conf, src])
                      .container('stepshape/phpfpm:latest')
                      .container('stepshape/phpfpm:latest')
                      .container('stepshape/phpfpm:latest')
                      .configure(function(con, c, s){
                        con.should.be.instanceOf(Container);
                        c.should.equal(conf);
                        c.containers[0].id.should.be.instanceOf(String);
                        c.containers[0].info.should.have.property("NetworkSettings");

                        s.should.equal(src);
                        c.containers[0].id.should.be.instanceOf(String);
                        c.containers[0].info.should.have.property("NetworkSettings");
                        return {
                          //we can base configuration on the 
                        };
                      });

      var http = new Service(docker, [php, conf, src], 'stepshape/nginx:latest');

      http.instantiate().then(function(){
        //everything build with id
        var php1id = php.containers[0].id;
        var php2id = php.containers[1].id;
        var php3id = php.containers[2].id;
        var confid = conf.containers[0].id;
        var srcid = src.containers[0].id;

        php1id.should.be.instanceOf(String);
        php2id.should.be.instanceOf(String);
        php3id.should.be.instanceOf(String);
        confid.should.be.instanceOf(String);
        srcid.should.be.instanceOf(String);

        //double initiate should yield the same ids
        http.instantiate().then(function(){
          php.containers[0].id.should.equal(php1id);
          conf.containers[0].id.should.equal(confid);
          src.containers[0].id.should.equal(srcid);

          //gogo start
          http.start().then(function(){
            done();
          });
          
        });
      });


    });

  });



});