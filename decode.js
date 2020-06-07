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
    console.log('getObjectAtPath', pathArr, 'target', JSON.stringify(targetObj));
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
    const parentObj = this.getObjectAtCurrStackPath();
    //init a new key at parentObj to initial undefined value
    parentObj[string] = undefined;
    stack.nextKey = false;
    stack.lastKey = string;
  }
  readMapValueAtOffset(len){
    console.log('readMapValueAtOffset', len);
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
    console.log('readDataType', this.offset, 'stack', JSON.stringify(this.stack));
    if(this.offset === this.buffer.byteLength){
      return this.endOfData();
    }
    // this.cleanUpStack();
    //map up to 15 el
    if((currType >>> 4) === 0x08){
      console.log('readDataType - map detected');
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
  resetParentStacks(){
    console.log('reset parent stacks');
    let depth = this.stack.length -1;
    while(this.stack[depth]) {
      const nStack = this.stack[depth];
      if(nStack.length <= 1 && !this.stack[depth].root){
        console.log('remove stack @ depth',depth)
        this.stack.pop()
      }
      depth--;
    }
  }
  endOfData() {
    console.log('endOfData');
    return this.output;
  }
}
const rawData = fs.readFileSync('./ref_deep_nest_single_el_.bin');
// const rawData = fs.readFileSync('./ref_deep_nested_empty.bin');
console.log('raw:',rawData);
const decoder = new Decoder();
const outputData = decoder.decode(rawData);
console.log('decoded:', JSON.stringify(outputData));