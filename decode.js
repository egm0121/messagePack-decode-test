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
  readStringAtPosition(firstByte) {
    this.debug('readStringAtPosition',firstByte);
    let strLen = (firstByte & 0x1f);
    const multiByteLength = DATATYPE_LENGTH.STR[firstByte];
    if (multiByteLength) {
      strLen = this.readMultiByteUInt(multiByteLength);
    }
    let str = '';
    for(let i=0; i < strLen; i++){
      this.offset++;
      str +=  String.fromCharCode(this.buffer[this.offset]);
    }
    return str;
  }
  addMapKey(keyStr) {
    this.debug('addMapKey', keyStr);
    const stack = this.getCurrStack();
    const parentObj = this.getObjectAtCurrStackPath();
    //init a new key at parentObj to initial undefined value
    parentObj[keyStr] = undefined;
    stack.nextKey = false;
    stack.lastKey = keyStr;
  }
  addMapValue(value) {
    this.debug('addMapValue', value);
    const stack = this.getCurrStack();
    const parentObj = this.getObjectAtCurrStackPath();
    //set value for lastKey at parentObj
    parentObj[stack.lastKey] = value;
    stack.length--;
    stack.nextKey = true;
    if (stack.length === 0) {
      stack.nextKey = false;
      this.resetCompletedStacks();
    }
  }
  addArrayValue(value) {
    this.debug('addArrayValue', value);
    const stack = this.getCurrStack();
    const parentObj = this.getObjectAtCurrStackPath();
    //set value for lastKey at parentObj
    parentObj.push(value);
    stack.length--;
    if (stack.length === 0) {
      this.resetCompletedStacks();
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
     // this.readStringDataType(currType);
     this.addDataAtCurrentStack(DATATYPES.STR, currType);
    }
    //parse ARRAY
    if( BYTE_TO_DATATYPE[currType] === DATATYPES.ARRAY || (currType >>> 4) === 0x09){
      this.readArrayDataType(currType);
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
      this.resetCompletedStacks();
    }
  }
  readArrayDataType(firstByte){
    this.debug('readArrayDataType');
    const isRoot = this.stack.length === 0;
    const arrPath = !isRoot && this.getCurrStack().lastKey;
    let arrLength = (firstByte & 0x0f);
    const multiByteLength = DATATYPE_LENGTH.ARRAY[firstByte];
    if (multiByteLength) {
      arrLength = this.readMultiByteUInt(multiByteLength);
    }
    if (isRoot) {
      this.output = [];
    } else {
      const parentNode = this.getObjectAtCurrStackPath();
      parentNode[arrPath] = [];
      if(this.getCurrStack().type == 'map'){
        this.getCurrStack().nextKey = true;
      }
    }
    this.stack.push({
      root: isRoot,
      path: arrPath,
      type:'array',
      length: arrLength,
    });
    //handle empty map case
    if(arrLength === 0) {
      this.resetCompletedStacks();
    }
  }
  addDataAtCurrentStack(type, firstByte){
    this.debug('addDataAtCurrentStack');
    let data = null;
    if (type === DATATYPES.STR) {
      data = this.readStringAtPosition(firstByte);
    }
    const stack = this.getCurrStack();
    if (!stack) {
      this.output = data;
    }
    if (stack.type === 'map'){
      stack.nextKey ?
      this.addMapKey(data):
      this.addMapValue(data);
    }
    if (stack.type === 'array') {
      this.addArrayValue(data);
    }
  }
  getCurrStack(){
    return this.stack[this.stack.length-1];
  }
  isStackRoot(){
    return this.stack.length === 1;
  }
  decrementParentStack() {
    this.debug('decrement parent stack');
    if(this.isStackRoot()) return false;
    let parentDepth = this.stack.length - 2;
    this.stack[parentDepth].length--;
  }
  resetCompletedStacks(){
    this.decrementParentStack();
    this.debug('reset parent stacks');
    let depth = this.stack.length-1;
    while(this.stack[depth]) {
      const nStack = this.stack[depth];
      if(nStack.length <= 1 && !this.stack[depth].root){
        this.debug('remove stack @ depth',depth,'path:',this.stack.path)
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
