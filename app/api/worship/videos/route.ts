import { publicClient,noStore } from '@/lib/server-access';
import { worshipTypes } from '@/lib/site-content';
const columns='id,service_type,service_date,video_id,title,featured' as const;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,type=params.get('type')??'sunday';
 const date=params.get('beforeDate'),id=params.get('beforeId');
 if(!worshipTypes.some(w=>w.key===type)||(!!date!==!!id)||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))||(id&&!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)))return Response.json({error:'올바른 예배 종류와 목록 위치가 필요합니다.'},{status:400,headers:noStore});
 try{
  const db=publicClient();let query=db.from('worship_videos').select(columns).eq('service_type',type).order('service_date',{ascending:false}).order('id',{ascending:false}).limit(21);
  if(date&&id)query=query.or(`service_date.lt.${date},and(service_date.eq.${date},id.lt.${id})`);
  const [list,featured]=await Promise.all([query,date?Promise.resolve({data:null,error:null}):db.from('worship_videos').select(columns).eq('service_type',type).eq('featured',true).maybeSingle()]);
  if(list.error||featured.error)throw list.error??featured.error;
  const videos=list.data.slice(0,20),last=videos.at(-1);
  return Response.json({videos,featured:featured.data,next:list.data.length>20&&last?{date:last.service_date,id:last.id}:null},{headers:noStore});
 }catch{return Response.json({error:'예배 영상을 불러오지 못했습니다.'},{status:503,headers:noStore});}
}
