/* global describe, it, beforeEach */
var Docker = require('dockerode');
var Processes = require('../lib/processes');

var url = require('url');
var stubDockerode = require('./stubs/dockerode');

//promise should always throw
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    'use strict';
    throw error;
  });


describe('Processes()', function(){
  'use strict';

  var docker, processes;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));    
    processes = new Processes(docker);
  });

  it('should provide the correct api', function(){    
    processes.refresh.should.be.instanceOf(Function);
  });

  describe('refresh()', function(){

    it('should return a promise', function(){
      processes.refresh().should.be.instanceOf(Promise);
    });

    it('should resolve with array of containers and set processes props', function(done){
      processes.refresh().then(function(containers){
        containers.should.be.instanceOf(Array);

        processes.list.length.should.equal(2);
        processes.list[0].should.eql(containers[0]);
        processes.list[1].should.eql(containers[1]);
        done();
      });
    });

  });


  describe('accessor methods', function(){

    beforeEach(function(done){
      processes.refresh().then(function(){
        done();
      });
    });

    it('get()', function(){
      (function(){
        processes.get('bogus');
      }).should.throw(/No running container/);
      processes.get('/wkmb-sql_0').ID.should.equal('2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643');
      processes.get('wkmb-sql_0').ID.should.equal('2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643');
    });

    it('has()', function(){
      processes.has('bogus').should.equal(false);
      processes.has('/wkmb-sql_0').should.equal(true);
      processes.has('wkmb-sql_0').should.equal(true);
    });


    it('add()', function(){
      processes.add({});
      processes.list.length.should.equal(3);
    });

  });


  describe('stop()', function(){

    beforeEach(function(done){
      processes.refresh().then(function(){
        done();
      });
    });

    it('should return promise', function(){
      processes.stop('/wkmb-sql_0').should.be.instanceOf(Promise);
    });

    it('should resolve promise', function(done){
      processes.stop('/wkmb-sql_0').then(function(){
        done();
      });
    });

  });


  describe('remove()', function(){

    beforeEach(function(done){
      processes.refresh().then(function(){
        done();
      });
    });

    it('should return promise', function(){
      processes.remove('/wkmb-sql_0').should.be.instanceOf(Promise);
    });

    it('should resolve promise', function(done){
      processes.remove('/wkmb-sql_0').then(function(){        
        processes.has('/wkmb-sql_0').should.equal(false);
        done();
      });
    });

  });

});