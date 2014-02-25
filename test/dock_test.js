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

describe('Cluster()', function(){
  'use strict';

  var docker, cluster;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');
    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
    cluster = new Dock(docker);
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

      cluster.add('phpfpm', s);
      cluster.has('phpfpm').should.equal(true);
      cluster.get('phpfpm').should.equal(s);
      
      (function(){
        cluster.get('bogus');
      }).should.throw(/Could not retrieve service/);
            
      cluster.has('bogus').should.equal(false);
    });

  });

  describe('.service()', function(){
    it('should throw on invalid deps', function(){
      (function(){
        cluster.service('nginx', [{}]);
      }).should.throw(/dependencies to be specified as string/);

    });
    
    it('should return a service instance', function(){

      var s1 = cluster.service('phpfpm');
      var s2 = cluster.service('nginx', ['phpfpm']);
      var s3 = cluster.service('data', ['bogus']);
      s2.should.be.an.instanceOf(Service);
      s2.dependencies.length.should.equal(1);
      s2.dependencies[0].should.equal(s1);

      s1.should.be.an.instanceOf(Service);

      (function(){
        s3.start();
      }).should.throw(/Could not retrieve service/);
    });

  });

});