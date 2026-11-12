import { createClient } from "@supabase/supabase-js";
export async function GET(request: Request) {
  const headers={"Cache-Control":"no-store, max-age=0"};
  const query=new URL(request.url).searchParams;
  const kind=query.get("kind"), id=query.get("id");
  if(kind!=="notice"&&kind!=="event")return Response.json({error:"분류를 확인해 주세요."},{status:400,headers});
  if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({error:"내용을 찾을 수 없습니다."},{status:404,headers});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return Response.json({error:"서비스를 준비 중입니다."},{status:503,headers});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
  try{
    let selection=client.from("community_entries").select("id,kind,title,body,location,starts_at,ends_at,publish_from,publish_until,updated_at").eq("kind",kind);
    if(id)selection=selection.eq("id",id);
    const {data,error}=await selection.order(kind==="event"?"starts_at":"updated_at",{ascending:kind==="event"}).limit(100);
    if(error)throw error;
    if(id&&!data.length)return Response.json({error:"내용을 찾을 수 없습니다."},{status:404,headers});
    return Response.json({entries:data},{headers});
  }catch{return Response.json({error:"내용을 불러오지 못했습니다. 다시 시도해 주세요."},{status:503,headers});}
}
