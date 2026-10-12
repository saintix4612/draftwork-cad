import {solveSolidStudy} from './solid-study.js';
self.onmessage=event=>{
  try{const result=solveSolidStudy(event.data.mesh,event.data.inputs,p=>self.postMessage({progress:p}));self.postMessage({result});}
  catch(error){self.postMessage({error:error.message});}
};
