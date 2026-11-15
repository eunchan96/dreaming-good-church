import type {Page} from '@playwright/test';
export async function showBulletinVisibility(page:Page){
 await page.getByRole('button',{name:'주보 설정',exact:true}).click();await page.getByLabel('웹 공개 설정 표시',{exact:true}).check();const save=page.getByRole('button',{name:'저장',exact:true});if(await save.isEnabled())await save.click();await page.getByRole('button',{name:'주보 등록',exact:true}).click();
}
