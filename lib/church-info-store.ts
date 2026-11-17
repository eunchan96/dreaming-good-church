import type {BrowserClient} from './bulletin-store';
import type {ChurchField} from './church';
/** Save all six fields in one existing transaction; a revision conflict rolls back the entire group. */
export async function saveChurchInfo(client:BrowserClient,fields:ChurchField[]){
 const {data,error}=await client.rpc('save_church_info',{p_fields:fields.map(({key,body,web_visible,revision})=>({key,body,web_visible,revision}))});
 if(error)throw error;
 return data;
}
