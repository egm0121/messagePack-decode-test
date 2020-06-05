const fs = require('fs');

class Decoder {
  constructor() {
    this.output = undefined;
    this.stack = [];
    this.offset = -1;
  }
  decode(rawBuffer){
    this.buffer = rawBuffer;
    this.readDataType();
    return this.output;
  }
  readStringAtOffset(len){
    console.log('readStringAtOffset',len);
    let str = '';
    for(let i=0; i < len; i++){
      this.offset++;
      str +=  String.fromCharCode(this.buffer[this.offset]);
    }
    return str;
  }
  readMapKeyAtOffset(len){
    console.log('readMapKeyAtOffset', len);
    const string = this.readStringAtOffset(len);
    const stack = this.getCurrStack();
    if(this.isStackRoot()){
      this.output[string] = undefined;
    }
    stack.nextKey = false;
    stack.lastKey = string;
  }
  readMapValueAtOffset(len){
    console.log('readMapValueAtOffset', len);
    const valueString = this.readStringAtOffset(len);
    const stack = this.getCurrStack();
    if(this.isStackRoot()){
      this.output[stack.lastKey] = valueString;
    }
    stack.length--;
    if (stack.length) {
      stack.nextKey = true;
    }
  }
  readDataType(){
    this.offset++;
    const currType = this.buffer[this.offset];
    console.log('readDataType', this.offset);
    if(this.offset === this.buffer.byteLength){
      return this.endOfData();
    }
    //map up to 15 el
    if((currType >>> 4) === 0x08){
      console.log('readDataType - map detected');
      this.output = {};
      const mapLength= (currType & 0x0f);
      this.stack.push({root:true, type:'map', length: mapLength, nextKey: true, lastKey: undefined});
    }
    //string up to 31bytes length
    if((currType >>> 5) === 0x05) {
      console.log('readDataType - string detected');
      const strLen = (currType & 0x1f);
      const stack = this.getCurrStack();
      if(!stack){
        this.output = this.readStringAtOffset(strLen);
      }
      if(stack.type == 'map'){
        if(stack.nextKey){
          this.readMapKeyAtOffset(strLen);
        }
        else {
          this.readMapValueAtOffset(strLen);
        }
      }
    }
    return this.readDataType();
  }
  getCurrStack(){
    return this.stack[this.stack.length-1];
  }
  isStackRoot(){
    return this.stack.length === 1;
  }
  endOfData() {
    console.log('endOfData');
    return this.output;
  }
}
const rawData = fs.readFileSync('./ref_simple_map.bin');
console.log('raw:',rawData);
const decoder = new Decoder();
const outputData = decoder.decode(rawData);
console.log('decoded:', JSON.stringify(outputData));