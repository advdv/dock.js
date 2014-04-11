/* global describe, it, beforeEach, process */
var url = require('url');
var stubDockerode = require('./stubs/dockerode');
var winston = require('winston');

var Docker = require('dockerode');
var sinon = require('sinon');

var Processes = require('../lib/processes');
var Service = require('../lib/service');
var Container = require('../lib/container');
var Configuration = require('../lib/configuration');

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
    service = new Service(docker, 'test');
  });

  it('should construct as expected', function(){
    var s = new Service(docker, 'test2');

    s.should.have.property('instantiate').and.be.instanceOf(Function);
    s.should.have.property('container').and.be.instanceOf(Function);
    s.should.have.property('add').and.be.instanceOf(Function);
    s.should.have.property('logger').and.be.instanceOf(winston.Logger);
    s.should.have.property('processes').and.be.instanceOf(Processes);
    s.should.have.property('instantiated').and.equal(false);
    s.should.have.property('started').and.equal(false);
    s.should.have.property('docker').and.equal(docker);
    s.should.have.property('containers').and.eql([]);

    s.should.have.property('configurationFn').and.be.instanceOf(Function);
    s.should.have.property('pipeFn').and.be.instanceOf(Function);

    var dep2 = new Service(docker, 'test44');
    var dep = function(){ return dep2; };
    var dep1 = new Service(docker, 'test55');
    var s2 = new Service(docker, 'test3', [dep1, dep], 'stepshape/nginx:latest');
    s2.containers.length.should.equal(1);

    s2.dependencies[0].should.equal(dep1);
    s2.dependencies[1].should.equal(dep2);
  });

  describe('access methods', function(){


    it('get', function(){
      var c1 = new Container(docker, 'nginx');
      var c2 = new Container(docker, 'nginx', 'containerx');

      service.add(c1)
             .add(c2);

      (function(){
        service.get('bogus');
      }).should.throw(/not retrieve container/);

      service.get('test_0').should.equal(c1);
      service.get('containerx').should.equal(c2);

    });

  });



  describe('.requires()', function(){
    it('should throw on non service as dep', function(){
      var dep = 'a';

      (function(){
        service.requires(dep);
      }).should.throw();

    });

    it('should add an dependency', function(){

      var dep1 = new Service(docker, 'test3', [], 'stepshape/nginx:latest');
      var s = service.requires(dep1);
      s.should.equal(service);
      service.requires(function(){ return dep1; });
      service.dependencies[0].should.equal(dep1);
      service.dependencies[1].should.equal(dep1);
    });
  });

  describe('.add()', function(){
    it('should add containers correctly', function(){
      var c = new Container(docker, 'nginx');

      service.add(c);
      service.containers.length.should.equal(1);

      c.name.should.equal('test_0');

    });
  });

  describe('.container()', function(){
    it('should add containers correctly', function(){

      var createConf = {};
      var s = service.container('stepshape/nginx', createConf);
      service.containers[0].should.be.an.instanceOf(Container);
      service.containers[0].configuration.creating.should.equal(createConf);
      service.containers[0].should.have.property('logger').and.equal(s.logger);
      s.should.equal(service);

    });
  });

  describe('.create()', function(){
    it('should create its dependencies first', function(done){

      var dep1 = new Service(docker, 'test4');
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


    describe('.pipe()', function(){
      it('should return service instance', function(){
        var res = service.pipe(process.stdout);
        res.should.equal(service);
      });

      it('should pipe first container by default', function(){
        var c1 = new Container(docker, 'nginx');
        service.pipe(process.stdout);
        service.add(c1);

        sinon.spy(c1, 'pipe');
        service.pipeFn.apply(service);

        c1.pipe.calledOnce.should.equal(true);
        c1.configuration.attaching.stream.should.equal(true);
      });

      it('should pipe specific container', function(){
        var c1 = new Container(docker, 'nginx', 'test');
        service.pipe(process.stdout, 'test');
        service.add(c1);

        sinon.spy(c1, 'pipe');
        service.pipeFn.apply(service);

        c1.pipe.calledOnce.should.equal(true);
        c1.configuration.attaching.stream.should.equal(true);
      });
    });

    describe('.start()', function(){
      it('should return promise', function(){
        service.container('test');

        var p = service.start();
        p.should.be.instanceOf(Promise);

        var p2 = service.start();
        p2.should.equal(p);
      });

      it('should throw without any container', function(done){

        service.start().catch(function(err){
          err.message.match(/without containers/).should.not.equal(null);
          done();
        });

      });

      it('should use configurationFn', function(done){
          
        var dep1 = new Service(docker, 'test5');
        dep1.container('busybox'); //needs at least one container

        var createConf = {};
        var fn = function(conf, d1){
          conf.should.be.instanceOf(Configuration);
          d1.should.equal(dep1);
          d1.started.isFulfilled().should.equal(true);

          conf.creating = createConf;
          this.should.equal(service);
        };

        service.configurationFn = fn;
        sinon.spy(service, 'configurationFn');
        var c1 = new Container(docker, 'nginx');
        sinon.spy(c1, 'start');
        service.add(c1);
        service.requires(dep1);

        service.start().then(function(){

          arguments[0].should.be.instanceOf(Array);
          arguments[0].length.should.equal(1);
          arguments[0][0].should.equal(c1.info);

          docker.createContainer.calledWith(createConf).should.equal(true);
          service.configurationFn.calledOnce.should.equal(true);
          done();
        });
      });


      it('should use pipeFn', function(done){
        var c1 = new Container(docker, 'nginx');
        var fn = function() {
          this.should.equal(service);
        };

        service.add(c1);
        service.pipeFn = fn;
        sinon.spy(service, 'pipeFn');

        service.start().then(function(){

          service.pipeFn.calledOnce.should.equal(true);
          done();
        });

      });


      it('should start dependencies first', function(done){
        
        var dep1 = new Service(docker, 'test6');
        dep1.container('busybox'); //needs at least one container
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

          docker.startContainer.callCount.should.equal(3);
          done();
        });

      });
    });


    it('should create/start correctly in complicated examples', function(done){
      var conf = new Service(docker, 'conf', [], 'busybox:latest');
      var src = new Service(docker, 'src', [], 'busybox:latest');

      var php = new Service(docker, 'php', [conf, src])
                      .container('stepshape/phpfpm:latest')
                      .container('stepshape/phpfpm:latest')
                      .container('stepshape/phpfpm:latest')
                      .configure(function(config, c, s){

                        config.should.be.instanceOf(Configuration);
                        c.should.equal(conf);
                        c.containers[0].id.should.be.instanceOf(String);
                        c.containers[0].info.should.have.property("NetworkSettings");

                        s.should.equal(src);
                        c.containers[0].id.should.be.instanceOf(String);
                        c.containers[0].info.should.have.property("NetworkSettings");

                      });

      var http = new Service(docker, 'http', [php, conf, src], 'stepshape/nginx:latest');

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