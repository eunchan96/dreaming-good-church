import {noStore,publicClient} from '@/lib/server-access';
import {defaultPageSettings,validPageSetting,type SettingKey} from '@/lib/church-page-settings';
export async function GET(){try{const {data,error}=await publicClient().from('church_page_settings').select('key,payload');if(error)throw error;
 const groups=structuredClone(defaultPageSettings);for(const row of data){if(!Object.hasOwn(groups,row.key)||!validPageSetting(row.key as SettingKey,row.payload))throw new Error();Object.assign(groups,{[row.key]:row.payload});}
 return Response.json({groups},{headers:noStore});
}catch{return Response.json({error:'교회 안내 설정을 불러오지 못했습니다.'},{status:503,headers:noStore});}}
