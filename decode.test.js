const Decoder =  require('./decode');
const fs = require('fs');
const exampleData = require('./exampleData');
describe('MessagePack Decoder - decode:',() => {
  let decoder;
  beforeEach(() => {
    decoder = new Decoder();
  });
  exampleData
  // .filter(data => data.fileName === 'ref_simple_map_with_array')
  .map(testData => {
    it(testData.fileName, () => {
      const bufferData = fs.readFileSync(`${testData.fileName}.bin`);
      decoder.setDebugMode(false);
      const decodedData = decoder.decode(bufferData);
      console.log('EXPECTED');
      console.log(JSON.stringify(testData.data));
      console.log('DECODED DATA');
      console.log(JSON.stringify(decodedData));
      expect(decodedData).toEqual(testData.data);
    });
  });
});