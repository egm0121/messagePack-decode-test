const fs = require('fs');
const data= {name:'test', myprop:'demo'};

const encodeString = (str) => {
  const strl = str.length;
  let ret = [];
  if(strl < 32){
    ret[0] = 0xa0 | strl;
  }
  for(let i = 0; i < strl; i++){
    ret[i+1] = str[i].charCodeAt(0);
  }
  return ret;
}

const encodeMapLength = len => {
  if(len < 16){
    return [0x80 | len];
  }
}
const encodeMap = (map) => {
  const output = [];
  const mapKeys = Object.keys(data);
  output.push(...encodeMapLength(mapKeys.length));
  mapKeys.forEach(key => {
    const value = map[key];
    const encodedKeyValue = [...encodeString(key),...encodeString(value)];
    output.push(...encodedKeyValue);
  });
  return output;
};

const encodeData = data => {
  if(typeof data === 'object'){
    const encoded = encodeMap(data);
    const intArr = new Uint8Array(2**22);
    encoded.forEach((byte,offset) => {
      intArr[offset] = byte; 
    });
    return Buffer.from(intArr).slice(0, encoded.length);
  }
}

encodedBuffer = encodeData(data);
fs.writeFileSync('bsondata.bin', encodedBuffer, 'hex');

