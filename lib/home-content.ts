export type HomeContent={title_line1:string;title_line2:string;description_line1:string;description_line2:string;link_label:string;footnote:string;image_mode:'art'|'photo'|'illustration';image_ratio:'portrait'|'square'|'landscape';image_asset_id:string|null;image_alt:string;focus_x:number;focus_y:number};
export const defaultHomeContent:HomeContent={title_line1:'하나님 앞에서,',title_line2:'더 나은 예배.',description_line1:'함께 예배하고, 함께 사랑하며.',description_line2:'당신의 일상에 좋은 소식이 시작되는 곳.',link_label:'우리 교회 이야기',footnote:'꿈꾸는좋은교회에 오신 여러분을 환영합니다.',image_mode:'art',image_ratio:'portrait',image_asset_id:null,image_alt:'',focus_x:50,focus_y:50};
export const homeTextLimits={title_line1:12,title_line2:12,description_line1:48,description_line2:48,link_label:24,footnote:80,image_alt:200} as const;
export function validHomeContent(value:unknown,preview=false):value is HomeContent{
 if(!value||typeof value!=='object')return false;const v=value as Record<string,unknown>;
 for(const [key,max]of Object.entries(homeTextLimits)){if(typeof v[key]!=='string'||(v[key] as string).length>max||/[\r\n]/.test(v[key] as string))return false;}
 if(!preview&&!['title_line1','title_line2','link_label'].every(key=>(v[key] as string).trim()))return false;
 if(typeof v.image_mode!=='string'||!['art','photo','illustration'].includes(v.image_mode)||typeof v.image_ratio!=='string'||!['portrait','square','landscape'].includes(v.image_ratio))return false;
 if(!['focus_x','focus_y'].every(key=>Number.isInteger(v[key])&&Number(v[key])>=0&&Number(v[key])<=100))return false;
 return v.image_mode==='art'||preview&&v.image_asset_id===null?v.image_asset_id===null:typeof v.image_asset_id==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v.image_asset_id)&&(preview||!!(v.image_alt as string).trim());
}
