import type {Page,Locator} from '@playwright/test';
export const timeControl=(page:Page,label:string)=>page.locator(`[data-time-label="${label}"]`);
export async function selectTime(page:Page,control:Locator,value:string){
 const [hour,minute]=value.split(':').map(Number);await control.click();const dialog=page.locator('dialog[data-time-picker][open]');
 await dialog.getByRole('group',{name:'오전·오후',exact:true}).getByRole('button',{name:hour>=12?'오후':'오전',exact:true}).click();
 await dialog.getByRole('group',{name:'시 선택 시계',exact:true}).getByRole('button',{name:`${hour%12||12} 시`,exact:true}).click();
 if(minute%5===0)await dialog.getByRole('group',{name:'분 선택 시계',exact:true}).getByRole('button',{name:`${String(minute).padStart(2,'0')} 분`,exact:true}).click();else await dialog.getByLabel('분',{exact:true}).fill(String(minute));
 await dialog.getByRole('button',{name:'적용',exact:true}).click();
}
