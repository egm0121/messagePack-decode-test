const fs = require('fs');

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
    this.debug('getObjectAtPath', pathArr, 'target', JSON.stringify(targetObj));
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
    this.resetParentStacks();
    if (stack.length) {
      stack.nextKey = true;
    }
  }
  readDataType(){
    this.offset++;
    const currType = this.buffer[this.offset];
    this.debug('readDataType', this.offset, 'stack', JSON.stringify(this.stack));
    if(this.offset === this.buffer.byteLength){
      return this.endOfData();
    }
    //map up to 15 el
    if((currType >>> 4) === 0x08){
      this.debug('readDataType - map detected');
      const isRoot = this.stack.length === 0;
      const mapPath = !isRoot && this.getCurrStack().lastKey;
      const mapLength= (currType & 0x0f);
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
    //string up to 31bytes length
    if((currType >>> 5) === 0x05) {
      this.debug('readDataType - string detected');
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
const data1 = fs.readFileSync('./ref_deep_nest_single_el_.bin');
const data2 = fs.readFileSync('./ref_deep_nested_empty.bin');

const decoder = new Decoder();
[data1, data2].map(encoded => {
  const outputData = decoder.decode(encoded);
  console.log('decoded:', JSON.stringify(outputData));
});
