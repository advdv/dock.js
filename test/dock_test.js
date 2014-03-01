/* global describe, it, beforeEach */
var url = require('url');
var Docker = require('dockerode');
var winston = require('winston');
var stubDockerode = require('./stubs/dockerode');

//promise should always throw
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    'use strict';
    throw error;
  });

var Dock = require('../lib/dock');
var Service = require('../lib/service');

describe('Dock()', function(){
  'use strict';

  var docker, dock;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');
    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
    dock = new Dock(docker);
  });

  it('should construct as expected', function(){
    var c = new Dock(docker);

    c.should.have.property('service').and.be.instanceOf(Function);
    c.should.have.property('get').and.be.instanceOf(Function);
    c.should.have.property('has').and.be.instanceOf(Function);
    c.should.have.property('add').and.be.instanceOf(Function);

    c.should.have.property('docker').and.equal(docker);

    //test logger
    c.should.have.property('logger').and.be.instanceOf(winston.Logger);

    var l = new winston.Logger();
    c = new Dock(docker, l);
    c.logger.should.equal(l);

    //invalid logger, initiated default
    c = new Dock(docker, 'bogus');
    c.should.have.property('logger').and.be.instanceOf(winston.Logger);
  });

  describe('.add(), .has(), .get()', function(){
    it('should add services correctly', function(){
      var s = {};

      dock.add('phpfpm', s);
      dock.has('phpfpm').should.equal(true);
      dock.get('phpfpm').should.equal(s);
      
      (function(){
        dock.get('bogus');
      }).should.throw(/Could not retrieve service/);
            
      dock.has('bogus').should.equal(false);
    });
  });

  describe('.service()', function(){
    it('should throw on invalid deps', function(){
      (function(){
        dock.service('nginx', [{}]);
      }).should.throw(/dependencies to be specified as string/);

    });
    
    it('should return a service instance', function(){

      var s1 = dock.service('phpfpm');
      var s2 = dock.service('nginx', ['phpfpm']);
      var s3 = dock.service('data', ['bogus']);
      var s4 = dock.service('src', [], 'busybox:latest', {Cmd: 'ls'}); //shorthand

      s2.should.be.an.instanceOf(Service);
      s2.dependencies.length.should.equal(1);
      s2.dependencies[0].should.equal(s1);

      s1.should.be.an.instanceOf(Service);
      s1.should.have.property('logger').and.equal(dock.logger);
      s1.should.have.property('docker').and.equal(dock.docker);

      s4.should.be.an.instanceOf(Service);
      s4.containers.length.should.equal(1);
      s4.containers[0].imageTag.should.equal('busybox:latest');
      s4.containers[0].configuration.creating.should.eql({Cmd: 'ls'});

      (function(){
        s3.start();
      }).should.throw(/Could not retrieve service/);
    });
  });


  describe('.analyse()', function(){
    
    it('should be able to retrieve root services', function(){

      var d = new Dock(docker);
      
      d.service('f'); //lone service counts as root

      d.service('y');
      d.service('x', ['y']); // x -> y
      
      d.service('a', ['b']); // a -> b
      d.service('b', ['c']);   // b -> c  
      d.service('c', []);  // c

      d.getRootServices().should.eql(['f', 'x', 'a']);
    });

    it('should throw on circular dependency', function(){
      var d = new Dock(docker);
      
      d.service('a', ['b']);
      d.service('b', ['c']);      

      (function(){
        d.analyse('b'); //not yet circular
      }).should.throw(/Could not retrieve service/);

      d.service('c', ['a']); //now it circular

      (function(){
        d.getRootServices()();
      }).should.throw(/Circular dependency/);

      (function(){
        d.analyse('b');
      }).should.throw(/Circular dependency/);

    });
  });


  describe('test valid complex example', function(){

    var d, memTrans;
    beforeEach(function(){
      memTrans = new winston.transports.Memory();
      d = new Dock(docker);

      d.logger.add(memTrans, {}, true);
      d.service('src').container('busybox:latest');
      d.service('data', ['php', 'http']).container('busybox:latest');
      d.service('php', ['src']).container('scstest/php-fpm:latest')
                                  .container('scstest/php-fpm:latest')
                                  .container('scstest/php-fpm:latest');

      d.service('http', ['src', 'php']).container('dockerfile/nginx:latest');
      d.service('sql').container('paintedfox/postgresql:latest');
    });

    it('should start completely from scratch', function(done){
      d.get('data').start().then(function(){
                  
        //test started order
        var o = memTrans.writeOutput;
        (o.indexOf('info: [src] started!')).should.be.lessThan(o.indexOf('info: [php] started!'));
        (o.indexOf('info: [php] started!')).should.be.lessThan(o.indexOf('info: [data] started!'));
        (o.indexOf('info: [php] started!')).should.be.lessThan(o.indexOf('info: [http] started!'));
        (o.indexOf('info: [http] started!')).should.be.lessThan(o.indexOf('info: [data] started!'));
        o.indexOf('info: [sql] started!').should.equal(-1);

        done();
      });

    });

    it('should start completely with .start()', function(done){
      var p = d.start();
      p.should.be.instanceOf(Promise);

      p.then(function(){
                    
        //test started order
        var o = memTrans.writeOutput;

        //busybox and sql can start concurrently: sql starts while src is'nt started yet
        (o.indexOf('info: [sql] starting...')).should.be.lessThan(o.indexOf('info: [src] started!'));
        (o.indexOf('info: [src] starting...')).should.be.lessThan(o.indexOf('info: [sql] starting...'));

        //general order
        (o.indexOf('info: [src] started!')).should.be.lessThan(o.indexOf('info: [php] started!'));
        (o.indexOf('info: [php] started!')).should.be.lessThan(o.indexOf('info: [data] started!'));
        (o.indexOf('info: [php] started!')).should.be.lessThan(o.indexOf('info: [http] started!'));
        (o.indexOf('info: [http] started!')).should.be.lessThan(o.indexOf('info: [data] started!'));
        
        //this also starts independant sql service
        o.indexOf('info: [sql] started!').should.not.equal(-1);
        done();
      });

    });


  });


  describe('test complex edge cases', function(){
    var d;
    beforeEach(function(){
      d = new Dock(docker);
      
      d.service('srce').container('busybox:latest');
      d.service('data', ['php', 'http']).container('busybox:latest');
      d.service('php', ['src']).container('scstest/php-fpm:latest')
                                  .container('scstest/php-fpm:latest')
                                  .container('scstest/php-fpm:latest');

      d.service('http', ['src', 'php']).container('dockerfile/nginx:latest');
      d.service('sql').container('paintedfox/postgresql:latest');
    });

    it('start should throw due to misspell', function(done){
      (function(){
        d.get('data').start();
      }).should.throw();
      
      //fix spelling      
      d.service('src').container('busybox:latest');
      d.get('data').start().then(function(){
        done();
      });
    });

    // it('should handle circular dependencies', function(done){

    //   // console.log('\n');
    //   d.logger.add(winston.transports.Console, {colorize: true});     

    //   //create circular dependency
    //   d.service('src', ['data']).container('busybox:latest');


            
    //   done();
    // });


  });


});