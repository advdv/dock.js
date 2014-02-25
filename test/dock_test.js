/* global describe, it, beforeEach */
var url = require('url');
var Docker = require('dockerode');
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
      s2.should.be.an.instanceOf(Service);
      s2.dependencies.length.should.equal(1);
      s2.dependencies[0].should.equal(s1);

      s1.should.be.an.instanceOf(Service);

      (function(){
        s3.start();
      }).should.throw(/Could not retrieve service/);
    });
  });


  describe('complex example', function(){

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