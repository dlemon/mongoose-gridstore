'use strict';

(function() {
    var gridStore = function(schema, options) {
        var Q = require('q');
        if(!options) {
            options = {};
        }
        var mongoose = options.mongoose || require('mongoose');
        var lazyLoading = options.lazyLoading || false;
        var keys = options.keys || [];
        
        schema.set('strict', true);
        schema.add({attachments:[]});
    };

module.exports = exports = gridStore;
})();