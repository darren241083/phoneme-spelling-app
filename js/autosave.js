
export function createAutosave({intervalMs=15000,onSave}){let timer=null; return {start(){if(timer) clearInterval(timer); timer=setInterval(()=>onSave?.(),intervalMs);}, stop(){if(timer) clearInterval(timer); timer=null;}};}
