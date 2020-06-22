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
    fileName: 'ref_deep_nested_map',
    data: { name: 'giulio', surname: 'dellorbo', about: { age: '27', eyes: 'green'}, documents:{test:{ nest1:{ nest2:{ nest3: { demo: 'demovalue'}}}}},country: 'US'}
  },
  {
    fileName: 'ref_deep_nested_empty',
    data: { name: 'giulio', surname: 'dellorbo', about: { age: '27', eyes: 'green'}, documents:{test:{ nest1:{ nest2:{ nest3:{}}}}},country: 'US'}
  },
  {
    fileName: 'ref_deep_nest_single_el_',
    data: { name: 'giulio', surname: 'dellorbo', about: { age: '27', eyes: 'green'}, documents:{test:{ nest1:{ nest2:{ nest3: { demo: 'demovalue'}}}},visa:{id:'12345'}},country: 'US'}
  },
  {
    fileName: 'ref_map_long_strings',
    data: { name: 'averyveryveryveryveryveryveryveryveryveryveryverylongname','bigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigbigkey':'value'}
  },
  {
    fileName: 'manyprops_map',
    data: {
      name: 'giulio', 
      surname: 'dellorbo',
      a:'a',
      b:'b',
      c:'c',
      d:'d',
      e:'e',
      f:'f',
      g:'g',
      h:'h',
      i:'i',
      l:'l',
      m:'m',
      n:'n',
      o:'o',
      p:'p',
      q:'q',
      r:'r',
      s:'s',
      t:'t',
      u:'u',
      v:'v',
      w:'w',
      z:'z',
      x:'x',
      y:'y'
    }
  }
]
exampleData.forEach((test) => {
  console.log('encoding data',JSON.stringify(test.data));
  fs.writeFileSync(`${test.fileName}.bin`, encode(test.data), 'hex');
});
