import type {Page} from '@playwright/test';
export async function showBulletinVisibility(page:Page){
 await page.getByRole('button',{name:'주보 설정',exact:true}).click();await page.getByLabel('웹 공개 설정 표시',{exact:true}).check();await page.getByRole('button',{name:'돌아가기',exact:true}).click();
}
