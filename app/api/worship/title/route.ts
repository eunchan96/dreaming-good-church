import {noStore,requireEditor} from '@/lib/server-access';
export async function GET(request:Request){
 try{
  if(!await requireEditor(request))return Response.json({error:'관리자 로그인이 필요합니다.'},{status:401,headers:noStore});
  const id=new URL(request.url).searchParams.get('id');
  if(!id||!/^[-\w]{11}$/.test(id))return Response.json({error:'올바른 영상 링크를 입력해 주세요.'},{status:400,headers:noStore});
  const response=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,{signal:AbortSignal.timeout(6000),cache:'no-store'});
  if(!response.ok)throw new Error('unavailable');
  const data=await response.json();if(typeof data.title!=='string'||!data.title.trim())throw new Error('title');
  return Response.json({title:data.title.trim().slice(0,200)},{headers:noStore});
 }catch{return Response.json({error:'제목을 가져오지 못했습니다.'},{status:502,headers:noStore});}
}
