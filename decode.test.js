const Decoder =  require('./decode');
const fs = require('fs');
const exampleData = require('./exampleData');
describe('MessagePack Decoder - decode:',() => {
  let decoder;
  beforeEach(() => {
    decoder = new Decoder();
  });
  exampleData
  // .filter(data => data.fileName === 'ref_deep_nested_map')
  .map(testData => {
    it(testData.fileName, () => {
      const bufferData = fs.readFileSync(`${testData.fileName}.bin`);
      const decodedData = decoder.decode(bufferData);
      console.log('DECODED DATA');
      console.log(JSON.stringify(decodedData));
      expect(decodedData).toEqual(testData.data);
    });
  });
});