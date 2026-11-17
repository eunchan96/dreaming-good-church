import type {BrowserClient} from './bulletin-store';
import type {Json} from './database.types';
import {defaultPageSettings,validPageSetting,type SettingKey} from './church-page-settings';
export function readPageSettings(rows:{key:string;payload:unknown;revision:number}[]){
 const values=structuredClone(defaultPageSettings),revisions:Record<SettingKey,number>={worship_times:0,offering_accounts:0,location:0};
 for(const row of rows){if(!Object.hasOwn(values,row.key)||!validPageSetting(row.key as SettingKey,row.payload))throw new Error('Invalid page settings');Object.assign(values,{[row.key]:row.payload});revisions[row.key as SettingKey]=row.revision;}
 return {values,revisions};
}
export async function savePageSetting(client:BrowserClient,key:SettingKey,revision:number,payload:unknown){
 if(!validPageSetting(key,payload))throw Object.assign(new Error('INVALID_CHURCH_SETTING'),{code:'22023'});
 const {data,error}=await client.rpc('save_church_page_setting',{p_key:key,p_revision:revision,p_payload:payload as Json});if(error)throw error;
 if(data.key!==key||!validPageSetting(key,data.payload))throw new Error('Unexpected page settings');return data;
}
