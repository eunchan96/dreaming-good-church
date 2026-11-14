import type { Tables } from './database.types';
export type WorshipEntry = Tables<'worship_videos'>;
export type PublicWorshipEntry = Pick<WorshipEntry,'id'|'service_type'|'service_date'|'video_id'|'title'|'featured'>;
export function youtubeId(value:string):string|null {
  const text=value.trim();if(/^[A-Za-z0-9_-]{11}$/.test(text))return text;
  try{const url=new URL(text);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)return null;
    const host=url.hostname.toLowerCase();let id:string|null=null;
    if(host==='youtu.be')id=url.pathname.split('/')[1];
    else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(embed|live|shorts)\//.test(url.pathname)?url.pathname.split('/')[2]:null;
    return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
  }catch{return null;}
}
