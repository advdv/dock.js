/* global describe, it, beforeEach */
var Docker = require('dockerode');
var url = require('url');
var fs = require('fs');
var winston = require('winston');

var stubDockerode = require('./stubs/dockerode');
var Image = require('../lib/image');

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

  it('should construct correctly', function(){
    var img = new Image(docker, __dirname + '/./fixtures/docker', 'sandbox:latest');
    
    img.contextDir.should.equal(__dirname + '/fixtures/docker');
    
    img.should.have.property('archiver');
    img.should.have.property('options');
    img.should.have.property('buildConf').and.eql({
      t: 'sandbox:latest'
    });
    img.should.have.property('logger').and.be.instanceOf(winston.Logger);
    img.should.have.property('tarred').and.equal(false);
    img.should.have.property('built').and.equal(false);
    img.should.have.property('imageTag').and.equal('sandbox:latest');
  });

  describe('.tar()', function(){
    it('should throw if the context dir doesnt exist', function(done){
      var img = new Image(docker, __dirname + '/fixtures/bogus', 'sandbox:latest');
      img.tar().error(function(err){
        err.code.should.equal('ENOENT');
        done();
      });
    });

    it('should throw if the docker file doesnt exist', function(done){
      var img2 = new Image(docker, __dirname + '/fixtures/nodocker', 'sandbox:latest');
      img2.tar().error(function(err){
        err.code.should.equal('ENOENT');
        done();
      });
    });

    it('should create a valid tar file', function(done){
      var img = new Image(docker, __dirname + '/fixtures/docker', 'sandbox:latest');

      var p = img.tar();
      p.should.be.instanceOf(Promise);
      img.tarred.should.equal(p);
      img.tar().should.equal(p);

      p.then(function(tarFile){
        fs.existsSync(tarFile).should.equal(true);
        img.tarFile.should.equal(tarFile);
        done();
      });
    });
  });


  describe('.build()', function(){
    it('should build correctly', function(done){

      var conf = {};
      var img = new Image(docker, __dirname + '/fixtures/docker', 'sandbox:latest', conf);
      var p = img.build();
      p.should.be.instanceOf(Promise);
      img.built.should.equal(p);
      img.build().should.equal(p);
      img.buildConf.should.eql({
        t: 'sandbox:latest'
      });

      p.then(function(imageId){

        fs.existsSync(img.tarFile).should.equal(false);
        imageId.should.equal('3d65aee0eaea');

        docker.buildImage.calledOnce.should.equal(true);  
        docker.buildImage.getCall(0).args[1].should.equal(conf);
        done();
      });

    });

    it('should correctly fail on built fail', function(done){

      var img = new Image(docker, __dirname + '/fixtures/docker', 'failMe');
      var p = img.build();
      p.should.be.instanceOf(Promise);
      img.built.should.equal(p);
      img.build().should.equal(p);

      p.catch(function(err){
        err.message.should.equal('test error');
        done();
      });

    });

  });

});