import type { BrowserClient } from './bulletin-store';
import type { ChurchField } from './church';
/** Update exactly one row under existing editor RLS and compare-and-swap revision. */
export async function saveChurchField(client:BrowserClient, field:ChurchField) {
  const { data,error }=await client.from('church_info').update({body:field.body,web_visible:field.web_visible,revision:field.revision+1}).eq('key',field.key).eq('revision',field.revision).select('*').maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error('다른 곳에서 이 항목이 변경되었습니다. 저장된 내용을 다시 확인해 주세요.'),{code:'40001'});
  return data;
}
