![alt tag](https://travis-ci.org/dlemon/mongoose-gridstore.svg?branch=master) [![NPM version][npm-version-image]][npm-url]  [![MIT License][license-image]][license-url] [![NPM downloads][npm-downloads-image]][npm-url]

# mongoose-gridstore
Promise based mongoose plugin for storing large size attachments to your document schema.

## Installation

```shell
npm install mongoose-gridstore
```
or add it to your `package.json`.

## Usage
This module is a mongoose plugin that decorates your schema with large size attachments. 
Attachments are stored as base64 strings.

### Granularity
You have the ability to partially/fully load all attachments or do the same for a single attachment.

### Schema decoration
```javascript
var mongoose  = require('mongoose');
var gridStore = require('mongoose-gridstore');

var emailSchema = new mongoose.Schema({
    from   : {type:String},
    to     : {type:String},
	subject: {type:String}
});

emailSchema.plugin(gridStore);
var Email = mongoose.model('Email', emailSchema);
```

#### Plugin options
```javascript

emailSchema.plugin(gridStore, {    
	keys     : ['property1', 'property2'],  //optional, property names that you want to add to the attachment object.
    mongoose : mongoose  //optional, the mongoose instance your app is using. Defaults to latest mongoose version.
});
```

## API

### Adding an attachment
Once you have decorated your schema as shown above you can start adding attachments.

```javascript
var email = new Email();

email.addAttachment("file.txt", new Buffer('test'))
.then(function(doc) {
    //email contains the attachment. promise returns the doc for further promise chaining.
})
.catch(function(err) {
    throw err;
});
```

### Accessing attachments

```javascript
email.attachments.forEach(function(attachment) {
	console.log(attachment.name);
	console.log(attachment.mime-type);
});
```

#### Attachment object

```javascript
var attachment = {
	filename : '',	              //the filename of the attachment
	buffer   : new Buffer(''),    //base64 string with the content of your attachment
	mimetype : ''	              //mime-type of your attachment
};
```
If you have specified the keys option, these keys are added automatically as properties to the attachment object.
The keys will be stored as meta-data in the gridstore. Keys are explicitly updated as follows:

```javascript
email.attachments.forEach(function(attachment) {
	attachment.property1 = 'test property 1'  //any javascript object you like
    attachment.property2 = 'test property 2'  //any javascript object you like
});

email.save();
```

### Retrieving attachments

```javascript
email.loadAttachments()
.then(function(doc) {
    //your email object now contains the attachments
    console.log(doc.attachments.length); 
})
.catch(function(err) {
    throw err;
});
```

### Saving attachments
When you save the document its attachements are stored in the gridstore. The pre-middleware detaches the buffer, keys etc. from the attachments
because mongodb cannot store large files. Since mongoose does not contain post middleware to manipulate the document after a save, 
you have to reload attachments yourself right after a save (or find for that matter):

```javascript
var email = new Email();

email.addAttachment("file.txt", new Buffer('test'))
.then(function() {
    return email.save();
})
.then(email.loadAttachments)
.then(function(doc) {
    //doc now contains all attachments again after a save.
})
.catch(function(err) {
    throw(err);
});

//Query and loadAttachments
Email.find({}, function(err,docs) {
    if(err) throw err;
    docs.forEach(function(doc) {
        doc.loadAttachments.done();
    });
})
```

### Updating attachments
```javascript

email.updateAttachment('file.txt', new Buffer('updated test'))
.then(function(doc) {
	//modified document including attachments is given back by the promise for further chaining.
})
.catch(function(err) {
	console.log('error updating attachment');
	throw err;
});
```

### Removing attachments

```javascript
email.removeAttachment('file.json')
.then(function(doc) {
	//modified document including updated attachments is given back by the promise
})
.catch(function(err) {
	console.log('error removing attachment');
	throw err;
});
```

### Loading attachments

#### Load all attachments

```javascript
email.loadAttachments()
.then(function(doc) {
	//All attachments including buffers are in the attachments array.
})
.catch(function(err) {
	console.log('error loading all attachments');
	throw err;
});
```

#### Partially load all attachments

```javascript
email.partialLoadAttachments()
.then(function(doc) {
	//All attachments are in the attachments array. Buffers are empty for each attachment.
})
.catch(function(err) {
	console.log('error partial loading all attachments');
	throw err;
});
```

#### Partially load a single attachment

```javascript
email.partialLoadSingleAttachment('file.json')
.then(function(doc) {
	//only filename, keys and mimetype filled in the attachment. Buffer is empty.
})
.catch(function(err) {
	console.log('error partial loading attachment');
	throw err;
});
```

#### Full load of a single attachment

```javascript
email.loadSingleAttachment('file.json')
.then(function(doc) {
	//attachment is fully loaded and stored in the attachments array.
})
.catch(function(err) {
	console.log('error full loading attachment');
	throw err;
});
```


### Test
Above scenarios have been tested and can be found in the test directory of the node module. 
You can verify the package by executing mocha test in the root of the module.

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: license.txt

[npm-url]: https://npmjs.org/package/mongoose-gridstore
[npm-version-image]: https://img.shields.io/npm/v/mongoose-gridstore.svg?style=flat
[npm-downloads-image]: https://img.shields.io/npm/dm/mongoose-gridstore.svg?style=flat

