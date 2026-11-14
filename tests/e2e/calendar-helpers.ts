import type {Page,Locator} from '@playwright/test';
export const calendarControl=(page:Page,label:string)=>page.locator(`[data-calendar-label="${label}"]`);
export async function selectCalendar(page:Page,control:Locator,value:string){
 await control.click();const dialog=page.locator('dialog[data-calendar][open]');
 if(!value){await dialog.getByRole('button',{name:'초기화',exact:true}).click();return;}
 const [date,time]=value.split('T'),[year,month,day]=date.split('-').map(Number);
 await dialog.getByRole('button',{name:/연도·월 선택$/}).click();await dialog.getByLabel('이동할 연도',{exact:true}).fill(String(year));await dialog.getByRole('button',{name:`${month}월`,exact:true}).click();
 await dialog.getByRole('button',{name:`${day}, ${year}년 ${month}월`,exact:true}).click();
 if(time){await dialog.getByLabel('시 (24시간제)',{exact:true}).fill(time.slice(0,2));await dialog.getByLabel('분',{exact:true}).fill(time.slice(3,5));}
 await dialog.getByRole('button',{name:'적용',exact:true}).click();
}
