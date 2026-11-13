import {noStore,publicClient} from '@/lib/server-access';
import {validHomeContent} from '@/lib/home-content';
export async function GET(){try{
 const {data,error}=await publicClient().from('homepage_content').select('title_line1,title_line2,description_line1,description_line2,link_label,footnote,image_mode,image_ratio,image_asset_id,image_alt,focus_x,focus_y').maybeSingle();
 if(error||data&&!validHomeContent(data))throw error??new Error();
 return Response.json({content:data},{headers:noStore});
}catch{return Response.json({error:'홈 문구를 불러오지 못했습니다.'},{status:503,headers:noStore});}}
