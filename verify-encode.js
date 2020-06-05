const fs = require('fs');
const MessagePack = require('what-the-pack');
const { encode } = MessagePack.initialize(2**22); // 4MB

const exampleData = [
  {
    fileName: 'ref_simple_map',
    data: {name:'test', myprop:'demo'}
  },
  {
    fileName: 'ref_nested_map',
    data: { name: 'giulio', surname: 'dellorbo', about: { age: '27' } }
  },
  {
    fileName: 'ref_nested_map_2',
    data: { name: 'giulio', surname: 'dellorbo', about: { age: '27' }, other: 'hello' }
  },
  {
    fileName: 'ref_map_long_strings',
    data: { name: 'averyveryveryveryveryveryveryveryveryveryveryverylongname','bigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigkey':'value'}
  }
]
exampleData.forEach((test) => {
  console.log('encoding data',JSON.stringify(test.data));
  fs.writeFileSync(`${test.fileName}.bin`, encode(test.data), 'hex');
});
