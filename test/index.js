'use strict';
require('should');

var mongoose = require('mongoose');
var gridStore = require('../index.js');
var URI = 'mongodb://localhost/test';

describe('The plugin',function() {
   var email;

    before(function(done) {
       mongoose.connect(URI, function(err){
            if (err) {
              return done(err);
            } 
          
            var emailSchema = new mongoose.Schema({
                from   : {type:String},
                to     : {type:String},
                subject: {type:String}
            });
            
            emailSchema.plugin(gridStore);
            var Email = mongoose.model('Email', emailSchema);
            email = new Email();
            done();
       });
    });       
});
