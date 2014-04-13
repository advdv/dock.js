/* global describe, it, beforeEach */
var Docker = require('dockerode');
var url = require('url');
var fs = require('fs');
var winston = require('winston');
var sinon = require('sinon');

var stubDockerode = require('./stubs/dockerode');
var Image = require('../lib/image');

//promise should always throw
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    'use strict';
    throw error;
  });

describe('Image()', function(){
  'use strict';

  var docker;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));

  });

  it('should construct correctly', function(done){
    var img = new Image(docker, __dirname + '/./fixtures/docker', 'sandbox:latest');
    
    img.contextDir.should.equal(__dirname + '/fixtures/docker');
    
    img.should.have.property('options');
    img.should.have.property('buildConf').and.eql({});
    img.should.have.property('pushConf').and.eql({});
    img.should.have.property('logger').and.be.instanceOf(winston.Logger);
    img.should.have.property('pushing').and.equal(false);
    img.should.have.property('tagging').and.equal(false);
    img.should.have.property('tarred').and.equal(false);
    img.should.have.property('built').and.equal(false);
    img.should.have.property('imageTag').and.equal('sandbox:latest');
    img.should.have.property('imageName').and.equal('sandbox');
    img.should.have.property('imageVersion').and.equal('latest');

    var img1 = new Image(docker, './', 'test');
    var img2 = new Image({docker: docker, contextDir: __dirname + '/./fixtures/docker', imageTag: 'sandbox:latest', from: img1 });
    img2.from.then(function(f){
      f().should.equal(img1);
      done();
    });

  });

  it('should .normalizeTag() correctly', function(){

    Image.normalizeTag('user/rep:12.3').should.equal('user/rep:12.3');
    Image.normalizeTag('user/rep:').should.equal('user/rep:latest');    
    Image.normalizeTag('user/rep').should.equal('user/rep:latest');    
    Image.normalizeTag('reg.stepshape.com:5000/sandbox').should.equal('reg.stepshape.com:5000/sandbox:latest');

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


  describe('.extend', function(){

    it('should normalize to function', function(){

      var img1 = new Image(docker, __dirname + '/fixtures/docker', 'test:0.1');
      var img2 = new Image(docker, __dirname + '/fixtures/docker', 'test:0.1');

      (function(){
        img1.extend('a');
      }).should.throw(/Expected Image instance/);
      
      var fn = function(){ return 'a';};
      img1.extend(fn);
      img1.from.should.be.instanceOf(Promise);


      // img1.from.should.equal('a');

      img1.extend(img2);
      // img1.from.should.equal(img2);
    });

  });

  describe('.build()', function(){
    it('should build correctly', function(done){
      var conf = {};
      var img = new Image({docker: docker, contextDir: __dirname + '/fixtures/docker', imageTag: 'sandbox:latest', buildConf: conf });
      var p = img.build();
      p.should.be.instanceOf(Promise);
      img.built.should.equal(p);
      img.build().should.equal(p);
      img.buildConf.should.eql(conf);

      p.then(function(imageId){
        fs.existsSync(img.tarFile).should.equal(false);
        imageId.should.equal('3d65aee0eaea');

        docker.buildImage.calledOnce.should.equal(true);  
        docker.buildImage.getCall(0).args[1].should.equal(conf);
        done();
      });
    });
    
    it('should correctly show status', function(done){
      var img = new Image(docker, __dirname + '/fixtures/docker', 'statusMe');
      var memTrans = new winston.transports.Memory();
      img.logger.add(memTrans, {}, true);

      //it fails but should have logged the status
      img.build().catch(function(err){
        err.message.should.equal('Could not retrieve image id from build');
        memTrans.writeOutput.join(' ').indexOf('Pulling repository stackbrew/ubuntu').should.not.equal(-1);

        done();
      });
    });

    it('should correctly show downloading status', function(done){
      var img = new Image(docker, __dirname + '/fixtures/docker', 'downloadMe');
      var memTrans = new winston.transports.Memory();
      img.logger.add(memTrans, {}, true);

      //it fails but should have logged the status
      img.build().catch(function(err){
        err.message.should.equal('Could not retrieve image id from build');

        //should filter downloading spam
        memTrans.writeOutput.join(' ').indexOf('Downloading').should.equal(-1);
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
        err.message.should.startWith('Docker build returned error');
        done();
      });
    });

    it('it should build dependencies first when it is also specified', function(done){
      //img2 is dependendant on test:0.1 image          
      var img1 = new Image(docker, __dirname + '/fixtures/docker', 'test:0.1');
      sinon.spy(img1, 'tar');
      sinon.spy(img1, 'build');

      var img2 = new Image({docker: docker, contextDir: __dirname + '/fixtures/dependency', imageTag: 'sandbox:latest', from: img1});
      sinon.spy(img2, 'tar');

      //calling twice doen't occur overhead
      img2.build().then(img2.build).then(function(){

        //test if called after each other
        img1.build.calledOnce.should.equal(true);
        img1.tar.calledBefore(img2.tar).should.equal(true);

        done();
      });
    });
  });

  describe('.push()', function(){
    it('should return a promise', function(){
      var img = new Image({docker: docker, contextDir: __dirname + '/fixtures/docker', imageTag: 'sandbox:latest'});
      var p = img.push();
      
      p.should.be.instanceOf(Promise);
    });

    it('should push succesfull and allow pushing again', function(done){
      var img = new Image({docker: docker, contextDir: __dirname + '/fixtures/docker', imageTag: 'sandbox:latest'});
      img.push().then(function(){
        img.pushing.should.equal(false);
        done();
      });
    });

    // @todo add more test for push status parsing
  });
  
  describe('.tag()', function(){
    it('should return a promise', function(){
      var img = new Image({docker: docker, contextDir: __dirname + '/fixtures/docker', imageTag: 'sandbox:latest'});
      var p = img.tag();
      
      p.should.be.instanceOf(Promise);
    });

    it('should tag succesfull and allow tagging again', function(done){
      var img = new Image({docker: docker, contextDir: __dirname + '/fixtures/docker', imageTag: 'sandbox:latest'});
      img.tag().then(function(){

        img.tagging.should.equal(false);
        done();
      });
    });

  });

});