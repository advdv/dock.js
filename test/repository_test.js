/* global describe, it, beforeEach */
var Docker = require('dockerode');
var url = require('url');
var fs = require('fs');
var winston = require('winston');
var sinon = require('sinon');

var stubDockerode = require('./stubs/dockerode');
var Repository = require('../lib/repository');
var Image = require('../lib/image');

//promise should always throw
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    'use strict';
    throw error;
  });

describe('Repository()', function(){
  'use strict';

  var docker, rep;
  beforeEach(function(){
    var parts = url.parse('tcp://192.168.1.50:4342');    
    docker = stubDockerode(new Docker({host: 'http://' + parts.hostname, port: parts.port}));
    rep = new Repository(docker);
  });

  it('should construct correctly', function(){
    rep.should.have.property('docker').and.equal(docker);
    rep.should.have.property('images').and.be.instanceOf(Array);
  });


  describe('accessor methods', function(){
    it('should .get()/.has() correctly', function(){

      var img = new Image(docker, '.', 'image:tag');      
      rep.add(img);

      (function(){
        rep.get('bogus');
      }).should.throw(/Could not retrieve image/);

      rep.get('image:tag').should.equal(img);

      rep.has('image:tag').should.equal(true);
      rep.has('bogus').should.equal(false);

      //normalize to 'latest'
      var img2 = new Image(docker, '.', 'image');
      rep.add(img2);      

      rep.get('image:latest').should.equal(img2);
      rep.has('image:latest').should.equal(true);
      rep.get('image').should.equal(img2);
      rep.has('image').should.equal(true);
    });

    it('should .add() correctly', function(){
      (function(){
        rep.add('a');
      }).should.throw();

      var img = new Image(docker, '.', 'image:tag');
      var img2 = new Image(docker, '.', 'image:tag'); //duplicate
      rep.add(img);
      rep.images[0].should.equal(img);
    
      (function(){
        rep.add(img2);
      }).should.throw(/already exists/);
    });

  });

  describe('create()', function(){
    it('should throw correctly on create->build', function(done){
      var img = rep.create('image:tag', __dirname + '/fixtures/bogus');
      img.build().catch(function(err){
        err.code.should.equal('ENOENT');
        done();
      });
    });

    it('should return an image on successfull read', function(done){
      var base = new Image(docker, __dirname + '/fixtures/docker', 'test:0.1');  
      rep.add(base);

      var i = rep.create('image:tag', __dirname + '/fixtures/dependency');
      i.should.be.instanceOf(Image);

      i.logger.should.equal(rep.logger);
      i.docker.should.equal(rep.docker);
      i.from.then(function(dep){
        dep().should.equal(base);
        done();
      });
    });
  });


  describe('build()', function(){
    it('should build all images', function(done){
      var memTrans = new winston.transports.Memory();
      rep.logger.add(memTrans, {}, true);

      var img1 = rep.create('test', __dirname + '/fixtures/docker');
      var img2 = rep.create('sandbox', __dirname + '/fixtures/dependency2');

      rep.add(img1).add(img2);
      rep.build().then(function(){        
        var o = memTrans.writeOutput;


        //tarring of the image should only start when its dependency completed
        (o.indexOf('info: [test:latest] cleanup done!')).should.be.lessThan(o.indexOf('info: [sandbox:latest] tarring context....'));
        done();
      });
    });

  });

});