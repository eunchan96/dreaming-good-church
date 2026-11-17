import {noStore,publicClient} from '@/lib/server-access';
import {defaultPageSettings,validPageSetting,type SettingKey} from '@/lib/church-page-settings';
export async function GET(){try{const client=publicClient();const [{data,error},portrait]=await Promise.all([client.from('church_page_settings').select('key,payload'),client.from('church_portrait').select('image_asset_id,alt').eq('id',1).maybeSingle()]);if(error)throw error;
 const groups=structuredClone(defaultPageSettings);for(const row of data){if(!Object.hasOwn(groups,row.key)||!validPageSetting(row.key as SettingKey,row.payload))throw new Error();Object.assign(groups,{[row.key]:row.payload});}
 // The portrait is optional: a missing table/row (before the DB update) simply means "no photo yet".
 const photo=!portrait.error&&portrait.data?.image_asset_id?{imageId:portrait.data.image_asset_id,alt:portrait.data.alt}:null;
 return Response.json({groups,portrait:photo},{headers:noStore});
}catch{return Response.json({error:'교회 안내 설정을 불러오지 못했습니다.'},{status:503,headers:noStore});}}
