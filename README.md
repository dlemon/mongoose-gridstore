# mongoose-gridstore
mongoose plugin for storing attachments to your document schema.

## Installation

```shell
npm install mongoose-gridstore
```

or add it to your `package.json`.

## Status
This package contains the interface description only. Implementation is ready May 25th.

## Usage
This module is a mongoose plugin that decorates your schema with attachments.

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
var email = new Email();
```

#### Plugin options
```javascript

emailSchema.plugin(gridStore, {
    //optional, defaults to the latest mongoose version.
	mongoose    : mongoose, 				    
	//optional, property names that you want to add to the attachment object.
	keys        : ['property1', 'property2'], 	
	//optional, defaults to false
	lazyLoading : true							
}
```

### Adding an attachment
Once you have decorated your schema as shown above you can start adding attachments.

```javascript
var email = new Email();

email.addAttachment("file.json", buffer);
```

### Accessing attachments

```javascript
email.attachments.forEach(function(attachment) {
	console.log(attachment.name);
	console.log(attachment.mime-type);
});
```

### Attachment object

```javascript
var attachment = {
	filename : '',
	buffer   : new Buffer(),
	mime-type: ''
};
```
If you have specified the keys option, these keys are added automatically as properties to the attachment object:

```javascript
email.attachments.forEach(function(attachment) {
	attachment.property1 = <any javascript object you like>
});
```

### Saving an attachment
Done automatically when you save the object it is attached too:

```javascript
var email = new Email();

email.addAttachment("file.json", buffer);
email.save(function(err) {
	throw err;
});
```

### Retrieving attachments
Default lazy loading is turned off, so you have to load attachments yourself:

```javascript
console.log(email.attachments.length); //should be 0
//load the attachments stored for this object
email.loadAttachments()
.then(function(attachments) {
	//attachments are loaded, and given back by the promise
	//your email object now contains the attachments
	console.log(email.attachments.length);
})
.catch(function(err) {
	console.log('error loading attachments');
	throw err;
});
```

### Updating attachments
```javascript

email.updateAttachment('file.json', buffer)
.then(function(attachments) {
	//modified attachments are loaded, and given back by the promise
})
.catch(function(err) {
	console.log('error removing attachment');
	throw err;
});
```

### Removing attachments

```javascript
email.removeAttachment('file.json')
.then(function(attachments) {
	//modified attachments are loaded, and given back by the promise
})
.catch(function(err) {
	console.log('error removing attachment');
	throw err;
});
```

