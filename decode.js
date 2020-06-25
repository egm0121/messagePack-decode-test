const fs = require('fs');

const DATATYPES = {
  NIL: 'NIL',
  BOOL: 'BOOL',
  UINT: 'UINT',
  INT: 'INT',
  FLOAT: 'FLOAT',
  STR: 'STR',
  BIN: 'BIN',
  ARRAY: 'ARRAY',
  MAP: 'MAP',
  TIMESTAMP: 'TIMESTAMP'
}
const DATATYPE_LENGTH = {
  BIN:{
    0xc4: 1,
    0xc5: 2,
    0xc6: 4,
  },
  UINT:{ 
    0xcc: 1,
    0xcd: 2,
    0xce: 4,
    0xcf: 8,
  },
  INT:{
    0xd0: 1,
    0xd1: 2,
    0xd2: 4,
    0xd3: 8,
  },
  FLOAT:{
    0xca: 4,
    0xcb: 8,
  },
  STR:{
    0xd9: 1,
    0xda: 2,
    0xdb: 4
  },
  MAP: {
    0xde: 2,
    0xdf: 4,
  },
  ARRAY: {
    0xdc: 2,
    0xdd: 4
  }
};
const BYTE_TO_DATATYPE = {
  0x0c : DATATYPES.NIL,
  0xc2: DATATYPES.BOOL,
  0xc3: DATATYPES.BOOL,
  0xc4: DATATYPES.BIN,
  0xc5: DATATYPES.BIN,
  0xc6: DATATYPES.BIN,
  0xca: DATATYPES.FLOAT,
  0xcb: DATATYPES.FLOAT,
  0xcc: DATATYPES.UINT,
  0xcd: DATATYPES.UINT,
  0xce: DATATYPES.UINT,
  0xcf: DATATYPES.UINT,
  0xd0: DATATYPES.INT,
  0xd1: DATATYPES.INT,
  0xd2: DATATYPES.INT,
  0xd3: DATATYPES.INT,
  0xd9: DATATYPES.STR,
  0xda: DATATYPES.STR,
  0xdb: DATATYPES.STR,
  0xdc: DATATYPES.ARRAY,
  0xdd: DATATYPES.ARRAY,
  0xde: DATATYPES.MAP,
  0xdf: DATATYPES.MAP
}
class Decoder {
  constructor() {
    this.isDebugMode = false;
    this.output = undefined;
    this.stack = [];
    this.offset = -1;
  }
  debug(...args){
    if(this.isDebugMode){
      console.log(...args);
    }
  }
  setDebugMode(value){
    this.isDebugMode = value;
  }
  decode(rawBuffer){
    this.resetState();
    this.buffer = rawBuffer;
    this.readDataType();
    return this.output;
  }
  resetState(){
    this.output = undefined;
    this.buffer = undefined;
    this.stack = [];
    this.offset = -1;
  }
  getObjectAtPath(pathArr){
    //if no path returns root object
    let targetObj = this.output;
    let i = 0;
    if(!pathArr || pathArr.length == 0) return targetObj;
    while(pathArr[i]){
      const currLevelKey = pathArr[i];
      if(currLevelKey) targetObj = targetObj[currLevelKey];
      i++;
    }
    this.debug('getObjectAtPath', pathArr);
    return targetObj;
  }
  getCurrStackPath(){
    if(this.stack.length < 2) return false;
    return this.stack.slice(1).map(level => level.path);
  }
  getObjectAtCurrStackPath() {
    const currPath = this.getCurrStackPath();
    return this.getObjectAtPath(currPath);
  }
  readStringAtOffset(len){
    this.debug('readStringAtOffset',len);
    let str = '';
    for(let i=0; i < len; i++){
      this.offset++;
      str +=  String.fromCharCode(this.buffer[this.offset]);
    }
    return str;
  }
  readMapKeyAtOffset(len){
    this.debug('readMapKeyAtOffset', len);
    const string = this.readStringAtOffset(len);
    const stack = this.getCurrStack();
    const parentObj = this.getObjectAtCurrStackPath();
    //init a new key at parentObj to initial undefined value
    parentObj[string] = undefined;
    stack.nextKey = false;
    stack.lastKey = string;
  }
  readMapValueAtOffset(len){
    this.debug('readMapValueAtOffset', len);
    const valueString = this.readStringAtOffset(len);
    const stack = this.getCurrStack();
    const parentObj = this.getObjectAtCurrStackPath();
    //set value for lastKey at parentObj
    parentObj[stack.lastKey] = valueString;
    stack.length--;
    stack.nextKey = true;
    if (stack.length === 0) {
      stack.nextKey = false;
      this.resetParentStacks();
    }
  }
  readMultiByteUInt(bytesLength){
    let length = 0;
    this.offset++; //increment offset to the start of the int bytes
    if(bytesLength === 1){
      length = this.buffer.readUInt8(this.offset);
    }
    if(bytesLength === 2){
      this.offset++; //increment twice since it's a 16bit uint
      length = this.buffer.readUInt16BE(this.offset)
    }
    if(bytesLength === 4){
      this.offset += 2;
      length = this.buffer.readUInt32BE(this.offset);
    }
    this.debug('read multi byte uint:', bytesLength, 'value: ',length);
    return length;
  }
  readMultiByteInt(bytesLength){
    let length = 0;
    this.offset++; //increment offset to the start of the int bytes
    if(bytesLength === 1){
      length = this.buffer.readInt8(this.offset);
    }
    if(bytesLength === 2){
      this.offset++; //increment twice since it's a 16bit uint
      length = this.buffer.readInt16BE(this.offset)
    }
    if(bytesLength === 4){
      this.offset += 2;
      length = this.buffer.readInt32BE(this.offset);
    }
    this.debug('read multi byte int:', bytesLength, 'value: ',length);
    return length;
  }
  readDataType(){
    this.offset++;
    const currType = this.buffer[this.offset];
    this.debug('readDataType', this.offset, 'stack', JSON.stringify(this.stack));
    if(this.offset === this.buffer.byteLength){
      return this.endOfData();
    }
    //parse MAP
    if( BYTE_TO_DATATYPE[currType] === DATATYPES.MAP || (currType >>> 4) === 0x08 ){
      this.readMapDataType(currType)
    }
    //parse STR
    if( BYTE_TO_DATATYPE[currType] === DATATYPES.STR || (currType >>> 5) === 0x05) {
     this.readStringDataType(currType);
    }
    return this.readDataType();
  }
  readMapDataType(firstByte){
    this.debug('readDataType - map detected');
    const isRoot = this.stack.length === 0;
    const mapPath = !isRoot && this.getCurrStack().lastKey;
    let mapLength = (firstByte & 0x0f);
    const multiByteLength = DATATYPE_LENGTH.MAP[firstByte];
    if (multiByteLength) {
      mapLength = this.readMultiByteUInt(multiByteLength);
    }
    if (isRoot) {
      this.output = {};
    } else {
      const parentNode = this.getObjectAtCurrStackPath();
      parentNode[mapPath] = {};
      this.getCurrStack().nextKey = true;
    }
    this.stack.push({
      root: isRoot,
      path: mapPath,
      type:'map',
      length: mapLength,
      nextKey: true,
      lastKey: undefined
    });
    //handle empty map case
    if(mapLength === 0){
      // all parents stack with one child element
      // can now be marked as completed since the
      // leaf is the empty map we just added on the stack 
      this.resetParentStacks();
    }
  }
  readStringDataType(firstByte){
    this.debug('readDataType - string detected');
    let strLen = (firstByte & 0x1f);
    const multiByteLength = DATATYPE_LENGTH.STR[firstByte];
    if (multiByteLength) {
      strLen = this.readMultiByteUInt(multiByteLength);
    }
    const stack = this.getCurrStack();
    if(!stack){
      this.output = this.readStringAtOffset(strLen);
    }
    if(stack.type === 'map'){
      if(stack.nextKey){
        this.readMapKeyAtOffset(strLen);
      }
      else {
        this.readMapValueAtOffset(strLen);
      }
    }
  }
  getCurrStack(){
    return this.stack[this.stack.length-1];
  }
  isStackRoot(){
    return this.stack.length === 1;
  }
  resetParentStacks(){
    this.debug('reset parent stacks');
    let depth = this.stack.length -1;
    while(this.stack[depth]) {
      const nStack = this.stack[depth];
      if(nStack.length <= 1 && !this.stack[depth].root){
        this.debug('remove stack @ depth',depth)
        this.stack.pop()
      }
      depth--;
    }
  }
  endOfData() {
    this.debug('endOfData');
    return this.output;
  }
}

module.exports = Decoder;
