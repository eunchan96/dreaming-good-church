'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {defaultPageSettings,validPageSetting,type ChurchPageSettings,type SettingKey} from '@/lib/church-page-settings';
type Content={fields:Record<string,string>|null;settings:ChurchPageSettings;fieldsFailed:boolean;settingsStatus:'loading'|'ready'|'error';retry:()=>void};
const Context=createContext<Content>({fields:null,settings:defaultPageSettings,fieldsFailed:false,settingsStatus:'loading',retry:()=>{}});
export function useChurchContent(){return useContext(Context);}
export function publicChurchField(fields:Record<string,string>|null,key:string,fallback:string){return fields===null?null:Object.hasOwn(fields,key)?fields[key].trim()||fallback:null;}
export default function ChurchContentProvider({children}:{children:ReactNode}){
 const [fields,setFields]=useState<Record<string,string>|null>(null),[settings,setSettings]=useState<ChurchPageSettings>(defaultPageSettings),[fieldsFailed,setFieldsFailed]=useState(false),[settingsStatus,setSettingsStatus]=useState<Content['settingsStatus']>('loading'),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();let sequence=0;
  async function load(){const current=++sequence;const responses=await Promise.allSettled(['/api/church','/api/church-settings'].map(async url=>{const r=await fetch(url,{cache:'no-store',signal:abort.signal});if(!r.ok)throw new Error();return r.json();}));if(abort.signal.aborted||current!==sequence)return;
   try{const result=responses[0];if(result.status==='rejected'||!Array.isArray(result.value.fields))throw new Error();setFields(Object.fromEntries(result.value.fields.map((f:{key:string;body:string})=>[f.key,f.body])));setFieldsFailed(false);}catch{setFields(null);setFieldsFailed(true);}
   try{const result=responses[1];if(result.status==='rejected')throw new Error();const groups=result.value.groups;for(const key of Object.keys(defaultPageSettings) as SettingKey[])if(!validPageSetting(key,groups?.[key]))throw new Error();setSettings(groups);setSettingsStatus('ready');}catch{setSettingsStatus('error');}
  }
  void load();const timer=setInterval(load,15000);addEventListener('focus',load);return()=>{abort.abort();clearInterval(timer);removeEventListener('focus',load);};
 },[retry]);
 return <Context value={{fields,settings,fieldsFailed,settingsStatus,retry:()=>setRetry(n=>n+1)}}>{children}</Context>;
}
