/* global describe, it */
var Dock = require('../index');

describe('Public Api', function(){
  'use strict';

  it('should listen to an specific public api', function(){
    var dock = new Dock({});
    dock.should.be.instanceOf(Dock);

    Dock.should.have.property('Image').and.be.instanceOf(Function);
    Dock.should.have.property('Service').and.be.instanceOf(Function);
    Dock.should.have.property('Container').and.be.instanceOf(Function);
  });

});