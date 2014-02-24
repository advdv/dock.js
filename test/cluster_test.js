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

var Cluster = require('../lib/cluster');
var Service = require('../lib/service');

describe('Cluster()', function(){
  'use strict';

  var docker, cluster;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');
    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
    cluster = new Cluster(docker);
  });

  it('should construct as expected', function(){
    var services = [];
    var c = new Cluster(docker);

    c.should.have.property('service').and.be.instanceOf(Function);
    c.should.have.property('get').and.be.instanceOf(Function);
    c.should.have.property('has').and.be.instanceOf(Function);
    c.should.have.property('add').and.be.instanceOf(Function);

    c.should.have.property('docker').and.equal(docker);

    c = new Cluster(docker);
    c.should.have.property('services').and.eql(services);
  });

  describe('.add(), .has(), .get()', function(){

    it('should add services correctly', function(){
      var s = {name: 'phpfpm'};

      cluster.add(s);
      cluster.services.length.should.equal(1);
      cluster.get('phpfpm').should.equal(s);
      cluster.get('bogus').should.equal(false);

      cluster.has('phpfpm').should.equal(true);
      cluster.has('bogus').should.equal(false);
    });

  });

  describe('.service()', function(){

    it('should return a service instance', function(){

      var s = cluster.service('nginx');
      s.should.be.an.instanceOf(Service);

    });

  });

});