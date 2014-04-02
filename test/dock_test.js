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
var Repository = require('../lib/repository');
var Processes = require('../lib/processes');

describe('Dock()', function(){
  'use strict';

  var docker, dock;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');
    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
    dock = new Dock(docker);
    dock.prefix  = 'test_';
  });

  it('should construct as expected', function(){
    var c = new Dock(docker);

    c.should.have.property('service').and.be.instanceOf(Function);
    c.should.have.property('get').and.be.instanceOf(Function);
    c.should.have.property('has').and.be.instanceOf(Function);
    c.should.have.property('add').and.be.instanceOf(Function);
    
    c.should.have.property('prefix').and.equal('');
    c.should.have.property('repository').and.be.instanceOf(Repository);
    c.should.have.property('processes').and.be.instanceOf(Processes);
    c.should.have.property('docker').and.equal(docker);

    //test logger
    c.should.have.property('logger').and.be.instanceOf(winston.Logger);

    var l = new winston.Logger();
    c = new Dock(docker, l);
    c.logger.should.equal(l);

    //specify prefix, should have defautl logger 
    c = new Dock(docker, 'wkmb-');
    c.should.have.property('logger').and.be.instanceOf(winston.Logger);

    c.prefix.should.equal('wkmb-');

  });

  describe('.add(), .has(), .get()', function(){
    it('should add services correctly', function(){
      var s = {};

      dock.prefix  = '';
      dock.add('phpfpm', s);
      dock.has('phpfpm').should.equal(true);
      dock.get('phpfpm').should.equal(s);
      dock.get('phpfpm').name.should.equal('phpfpm');
      
      (function(){
        dock.get('bogus');
      }).should.throw(/Could not retrieve service/);
            
      dock.has('bogus').should.equal(false);
    });

    it('should add services correctly with prefix', function(){
      var s = {};

      dock.prefix  = 'test_';

      dock.add('phpfpm', s);
      dock.has('phpfpm').should.equal(true);
      dock.get('phpfpm').should.equal(s);
      dock.get('phpfpm').name.should.equal('test_phpfpm');
      
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

      s4.containers[0].name.should.equal('test_src_0');

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


  describe('.image()', function(){
    it('should create images sucessfully', function(done){
      var d = new Dock(docker);
      var c = {};
      var res = d.image('sandbox', __dirname + '/bogus', c);
      res.should.equal(d);    
      res.repository.images.length.should.equal(1);
      res.repository.images[0].buildConf.should.equal(c);

      res.repository.images[0].from.catch(function(){
        //it shoiuld have trown because of bogus path
        done();
      });
    });

  });

  describe('.analyse()', function(){

    it('should be able to retrieve root services with prefix', function(){

      var d = new Dock(docker, 'p_');
      
      d.service('f'); //lone service counts as root

      d.service('y');
      d.service('x', ['y']); // x -> y
      
      d.service('a', ['b']); // a -> b
      d.service('b', ['c']);   // b -> c  
      d.service('c', []);  // c

      d.getRootServices().should.eql(['p_f', 'p_x', 'p_a']);
    });


    
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
      d.prefix = 'fix_';

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

        (o.indexOf('info: [fix_src] started!')).should.be.lessThan(o.indexOf('info: [fix_php] started!'));
        (o.indexOf('info: [fix_php] started!')).should.be.lessThan(o.indexOf('info: [fix_data] started!'));
        (o.indexOf('info: [fix_php] started!')).should.be.lessThan(o.indexOf('info: [fix_http] started!'));
        (o.indexOf('info: [fix_http] started!')).should.be.lessThan(o.indexOf('info: [fix_data] started!'));
        o.indexOf('info: [fix_sql] started!').should.equal(-1);

        done();
      });

    });

    it('should start completely with .start()', function(done){
      var p = d.start();

      p.should.be.instanceOf(Promise);
      p.then(function(infos){
                    
        //returns info of the root services
        infos.length.should.equal(2);

        //only returns info on its own container
        infos[0].length.should.equal(1);
        infos[0][0].should.have.property('NetworkSettings');

        //test started order
        var o = memTrans.writeOutput;

        //busybox and sql can start concurrently: sql starts while src is'nt started yet
        (o.indexOf('info: [fix_sql] starting...')).should.be.lessThan(o.indexOf('info: [fix_src] started!'));
        (o.indexOf('info: [fix_src] starting...')).should.be.lessThan(o.indexOf('info: [fix_sql] starting...'));

        //general order
        (o.indexOf('info: [fix_src] started!')).should.be.lessThan(o.indexOf('info: [fix_php] started!'));
        (o.indexOf('info: [fix_php] started!')).should.be.lessThan(o.indexOf('info: [fix_data] started!'));
        (o.indexOf('info: [fix_php] started!')).should.be.lessThan(o.indexOf('info: [fix_http] started!'));
        (o.indexOf('info: [fix_http] started!')).should.be.lessThan(o.indexOf('info: [fix_data] started!'));
        
        //this also starts independant sql service
        o.indexOf('info: [fix_sql] started!').should.not.equal(-1);
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

  });


});