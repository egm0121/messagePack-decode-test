const fs = require('fs');
const MessagePack = require('what-the-pack');
const { encode } = MessagePack.initialize(2**22); // 4MB
const exampleData = require('./exampleData');
exampleData.forEach((test) => {
  console.log('encoding data',JSON.stringify(test.data));
  fs.writeFileSync(`${test.fileName}.bin`, encode(test.data), 'hex');
});
